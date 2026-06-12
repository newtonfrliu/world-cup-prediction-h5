import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Match = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  | "id"
  | "home_team"
  | "away_team"
  | "start_time"
  | "status"
  | "home_score"
  | "away_score"
>;
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type MatchResult = NonNullable<
  Database["public"]["Tables"]["matches"]["Row"]["result"]
>;

type ScoreItem = {
  name: string;
  score: string | number;
};

type ScoreEvent = {
  home_team: string;
  away_team: string;
  commence_time: string;
  completed?: boolean;
  status?: string;
  scores?: ScoreItem[] | null;
};

type SyncScoresOptions = {
  oddsApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onStep?: (step: "call_sync_odds" | "update_supabase") => void;
};

export type SyncScoresResult = {
  finished: number;
  settled: number;
  skipped: Array<{
    home_team: string;
    away_team: string;
    reason: string;
  }>;
};

const scoresApiUrl =
  "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores";
const maxStartTimeDiffMs = 6 * 60 * 60 * 1000;

function normalizeTeamName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isFinishedEvent(event: ScoreEvent) {
  return (
    event.completed === true ||
    event.status?.trim().toLowerCase() === "finished"
  );
}

function parseScore(value: string | number) {
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? score : null;
}

function getScoreByTeam(event: ScoreEvent, team: string) {
  const scoreItem = event.scores?.find(
    (item) => normalizeTeamName(item.name) === normalizeTeamName(team),
  );

  if (!scoreItem) {
    return null;
  }

  return parseScore(scoreItem.score);
}

function getScoresForMatch(match: Match, event: ScoreEvent) {
  const homeScore = getScoreByTeam(event, match.home_team);
  const awayScore = getScoreByTeam(event, match.away_team);

  if (homeScore === null || awayScore === null) {
    return null;
  }

  return {
    homeScore,
    awayScore,
  };
}

function getMatchedEvent(match: Match, events: ScoreEvent[]) {
  const matchHomeTeam = normalizeTeamName(match.home_team);
  const matchAwayTeam = normalizeTeamName(match.away_team);
  const matchStartTime = new Date(match.start_time).getTime();

  if (Number.isNaN(matchStartTime)) {
    return null;
  }

  return events.find((event) => {
    const eventHomeTeam = normalizeTeamName(event.home_team);
    const eventAwayTeam = normalizeTeamName(event.away_team);
    const isSameOrder =
      matchHomeTeam === eventHomeTeam && matchAwayTeam === eventAwayTeam;
    const isReversedOrder =
      matchHomeTeam === eventAwayTeam && matchAwayTeam === eventHomeTeam;
    const eventStartTime = new Date(event.commence_time).getTime();

    if (Number.isNaN(eventStartTime)) {
      return false;
    }

    return (
      (isSameOrder || isReversedOrder) &&
      Math.abs(matchStartTime - eventStartTime) <= maxStartTimeDiffMs
    );
  });
}

function getResultFromScores(homeScore: number, awayScore: number): MatchResult {
  if (homeScore > awayScore) {
    return "home_win";
  }

  if (homeScore < awayScore) {
    return "away_win";
  }

  return "draw";
}

function isMissingPredictionStatusError(error: unknown) {
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("'status' column of 'predictions'") ||
    message.includes("predictions.status") ||
    message.includes("settled_at") ||
    message.includes("schema cache")
  );
}

async function fetchScores(apiKey: string) {
  const url = new URL(scoresApiUrl);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", "3");
  url.searchParams.set("dateFormat", "iso");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `The Odds API failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as ScoreEvent[];
}

export async function syncWorldCupScores({
  oddsApiKey,
  supabaseUrl,
  supabaseAnonKey,
  onStep,
}: SyncScoresOptions): Promise<SyncScoresResult> {
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  onStep?.("call_sync_odds");
  const events = (await fetchScores(oddsApiKey)).filter(isFinishedEvent);
  onStep?.("update_supabase");
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, start_time, status, home_score, away_score")
    .or("status.is.null,status.neq.finished,home_score.is.null,away_score.is.null");

  if (matchesError) {
    throw new Error(`Supabase update failed: ${matchesError.message}`);
  }

  const skipped: SyncScoresResult["skipped"] = [];
  let finished = 0;
  let settled = 0;

  for (const match of matches ?? []) {
    const event = getMatchedEvent(match, events);

    if (!event) {
      skipped.push({
        home_team: match.home_team,
        away_team: match.away_team,
        reason: "No matched finished score event",
      });
      continue;
    }

    const scores = getScoresForMatch(match, event);

    if (!scores) {
      skipped.push({
        home_team: match.home_team,
        away_team: match.away_team,
        reason: "Missing or invalid score",
      });
      continue;
    }

    const result = getResultFromScores(scores.homeScore, scores.awayScore);

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        home_score: scores.homeScore,
        away_score: scores.awayScore,
        result,
        status: "finished",
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new Error(`Supabase update failed: ${matchUpdateError.message}`);
    }

    let hasSettlementColumns = true;
    let { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, created_at",
      )
      .eq("match_id", match.id)
      .or("status.is.null,status.eq.active");

    if (predictionsError) {
      if (!isMissingPredictionStatusError(predictionsError)) {
        throw new Error(`Supabase update failed: ${predictionsError.message}`);
      }

      hasSettlementColumns = false;
      const fallbackResult = await supabase
        .from("predictions")
        .select(
          "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, points, created_at",
        )
        .eq("match_id", match.id);

      predictions = fallbackResult.data as typeof predictions;
      predictionsError = fallbackResult.error;

      if (predictionsError) {
        throw new Error(`Supabase update failed: ${predictionsError.message}`);
      }
    }

    for (const prediction of (predictions ?? []) as Prediction[]) {
      if (hasSettlementColumns && prediction.settled_at) {
        continue;
      }

      const isHit = prediction.prediction === result;
      const points = isHit
        ? Math.round(prediction.odds_at_prediction * 100)
        : 0;
      const payout = isHit
        ? Math.round(prediction.stake * prediction.odds_at_prediction)
        : 0;

      const updatePayload = hasSettlementColumns
        ? {
            points,
            payout,
            settled_at: new Date().toISOString(),
          }
        : {
            points,
            payout,
          };
      const { error: predictionUpdateError } = await supabase
        .from("predictions")
        .update(updatePayload)
        .eq("id", prediction.id);

      if (predictionUpdateError) {
        throw new Error(
          `Supabase update failed: ${predictionUpdateError.message}`,
        );
      }

      if (payout > 0 && prediction.payout === 0) {
        const { data: player, error: playerLoadError } = await supabase
          .from("players")
          .select("coins")
          .eq("id", prediction.player_id)
          .single();

        if (playerLoadError) {
          throw new Error(`Supabase update failed: ${playerLoadError.message}`);
        }

        const { error: playerUpdateError } = await supabase
          .from("players")
          .update({ coins: player.coins + payout })
          .eq("id", prediction.player_id);

        if (playerUpdateError) {
          throw new Error(
            `Supabase update failed: ${playerUpdateError.message}`,
          );
        }
      }
    }

    finished += 1;
    settled += (predictions ?? []).length;
  }

  return {
    finished,
    settled,
    skipped,
  };
}
