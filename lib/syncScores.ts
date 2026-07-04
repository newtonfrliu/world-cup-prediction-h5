import { createClient } from "@supabase/supabase-js";

import {
  settlePredictionMarket,
} from "./predictionSettlement.ts";
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
  | "stage"
  | "result"
  | "betting_result"
  | "regular_home_score"
  | "regular_away_score"
  | "final_home_score"
  | "final_away_score"
  | "advancement_winner"
>;
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type BettingResult = "home" | "draw" | "away";

type ScoreItem = {
  name: string;
  score: string | number;
};

export type ScoreEvent = {
  id?: string;
  sport_key?: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  completed?: boolean;
  status?: string;
  scores?: ScoreItem[] | null;
  last_update?: string;
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
  request: {
    sportKey: string;
    endpoint: string;
    daysFrom: number;
    dateFormat: string;
    serverTime: string;
    apiEvents: number;
    finishedApiEvents: number;
    localCandidates: number;
  };
  updatedMatches: Array<{
    id: string;
    home_team: string;
    away_team: string;
    stage: string | null;
    start_time: string;
    matched_event: {
      id?: string;
      home_team: string;
      away_team: string;
      commence_time: string;
      completed?: boolean;
      status?: string;
    };
    home_score: number;
    away_score: number;
    betting_result: BettingResult;
    advancement_winner: "home" | "away" | null;
    settled: number;
  }>;
  skipped: Array<{
    id?: string;
    home_team: string;
    away_team: string;
    stage?: string | null;
    start_time?: string;
    reason: string;
    candidates?: ScoreMatchDiagnostics[];
  }>;
  unmatchedEvents: Array<{
    id?: string;
    home_team: string;
    away_team: string;
    commence_time: string;
    completed?: boolean;
    status?: string;
    scores?: ScoreItem[] | null;
    reason: string;
  }>;
};

export const scoreSyncSportKey = "soccer_fifa_world_cup";
export const scoreSyncDaysFrom = 3;
export const scoreSyncDateFormat = "iso";
export const scoresApiUrl =
  "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores";
const maxStartTimeDiffMs = 6 * 60 * 60 * 1000;

const teamAliases: Record<string, string> = {
  curacao: "curacao",
  "curaçao": "curacao",
  库拉索: "curacao",
};

export function normalizeTeamName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");

  return teamAliases[normalized] ?? normalized;
}

export function isFinishedEvent(event: ScoreEvent) {
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

export function getScoresForMatch(match: Match, event: ScoreEvent) {
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

export type ScoreMatchDiagnostics = {
  apiHome: string;
  apiAway: string;
  normalizedApiHome: string;
  normalizedApiAway: string;
  commenceTime: string;
  completed?: boolean;
  status?: string;
  sameOrder: boolean;
  reversedOrder: boolean;
  includesHomeTeam: boolean;
  includesAwayTeam: boolean;
  timeDiffHours: number | null;
  withinTimeWindow: boolean;
  hasHomeScore: boolean;
  hasAwayScore: boolean;
  selectedByCurrentSync: boolean;
  notSelectedReason: string;
};

function getScoreEventKey(event: ScoreEvent) {
  return [
    event.id ?? "",
    event.home_team,
    event.away_team,
    event.commence_time,
  ].join("|");
}

export function analyzeScoreEventMatch(match: Match, event: ScoreEvent) {
  const matchHomeTeam = normalizeTeamName(match.home_team);
  const matchAwayTeam = normalizeTeamName(match.away_team);
  const eventHomeTeam = normalizeTeamName(event.home_team);
  const eventAwayTeam = normalizeTeamName(event.away_team);
  const isSameOrder =
    matchHomeTeam === eventHomeTeam && matchAwayTeam === eventAwayTeam;
  const isReversedOrder =
    matchHomeTeam === eventAwayTeam && matchAwayTeam === eventHomeTeam;
  const matchStartTime = new Date(match.start_time).getTime();
  const eventStartTime = new Date(event.commence_time).getTime();
  const timeDiffMs =
    Number.isNaN(matchStartTime) || Number.isNaN(eventStartTime)
      ? null
      : Math.abs(matchStartTime - eventStartTime);
  const withinTimeWindow =
    timeDiffMs !== null && timeDiffMs <= maxStartTimeDiffMs;
  const scores = getScoresForMatch(match, event);
  const selectedByCurrentSync =
    (isSameOrder || isReversedOrder) &&
    withinTimeWindow &&
    isFinishedEvent(event);
  let notSelectedReason = "selected";

  if (!isSameOrder && !isReversedOrder) {
    notSelectedReason = "team names/order did not match";
  } else if (!withinTimeWindow) {
    notSelectedReason = "commence_time outside 6-hour matching window";
  } else if (!isFinishedEvent(event)) {
    notSelectedReason =
      "API event matched by teams/time but completed=false/status is not finished";
  } else if (!scores) {
    notSelectedReason = "matched event but score rows do not map to local teams";
  }

  return {
    apiHome: event.home_team,
    apiAway: event.away_team,
    normalizedApiHome: eventHomeTeam,
    normalizedApiAway: eventAwayTeam,
    commenceTime: event.commence_time,
    completed: event.completed,
    status: event.status,
    sameOrder: isSameOrder,
    reversedOrder: isReversedOrder,
    includesHomeTeam:
      eventHomeTeam.includes(matchHomeTeam) ||
      eventAwayTeam.includes(matchHomeTeam) ||
      matchHomeTeam.includes(eventHomeTeam) ||
      matchHomeTeam.includes(eventAwayTeam),
    includesAwayTeam:
      eventHomeTeam.includes(matchAwayTeam) ||
      eventAwayTeam.includes(matchAwayTeam) ||
      matchAwayTeam.includes(eventHomeTeam) ||
      matchAwayTeam.includes(eventAwayTeam),
    timeDiffHours: timeDiffMs === null ? null : timeDiffMs / 60 / 60 / 1000,
    withinTimeWindow,
    hasHomeScore: scores?.homeScore !== undefined,
    hasAwayScore: scores?.awayScore !== undefined,
    selectedByCurrentSync,
    notSelectedReason,
  };
}

export function getScoreEventCandidates(match: Match, events: ScoreEvent[]) {
  return events
    .map((event) => analyzeScoreEventMatch(match, event))
    .filter((event) => event.includesHomeTeam || event.includesAwayTeam)
    .sort((a, b) => {
      const aScore =
        Number(a.sameOrder || a.reversedOrder) * 100 +
        Number(a.withinTimeWindow) * 10 -
        (a.timeDiffHours ?? 999);
      const bScore =
        Number(b.sameOrder || b.reversedOrder) * 100 +
        Number(b.withinTimeWindow) * 10 -
        (b.timeDiffHours ?? 999);

      return bScore - aScore;
    });
}

export function getMatchedEvent(match: Match, events: ScoreEvent[]) {
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

export function getUnmatchedScoreDiagnostics(match: Match, events: ScoreEvent[]) {
  return {
    dbHome: match.home_team,
    dbAway: match.away_team,
    normalizedHome: normalizeTeamName(match.home_team),
    normalizedAway: normalizeTeamName(match.away_team),
    startTime: match.start_time,
    apiCandidates: getScoreEventCandidates(match, events).slice(0, 5),
  };
}

function getResultFromScores(homeScore: number, awayScore: number): BettingResult {
  if (homeScore > awayScore) {
    return "home";
  }

  if (homeScore < awayScore) {
    return "away";
  }

  return "draw";
}

function getLegacyResultFromBettingResult(result: BettingResult) {
  if (result === "home") return "home_win";
  if (result === "away") return "away_win";
  return "draw";
}

function getAdvancementWinnerFromScores(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return null;
}

function isKnockoutStage(stage: string | null | undefined) {
  const normalized = (stage ?? "").trim().toLowerCase();

  return [
    "round_of_32",
    "round of 32",
    "round_of_16",
    "round of 16",
    "last_16",
    "quarter_final",
    "quarter-finals",
    "quarterfinal",
    "semi_final",
    "semi-finals",
    "semifinal",
    "third_place",
    "third-place",
    "final",
    "knockout",
  ].includes(normalized);
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

async function settleActivePredictionsForMatch({
  supabase,
  matchId,
  matchForSettlement,
}: {
  supabase: ReturnType<typeof createClient<Database>>;
  matchId: string;
  matchForSettlement: Parameters<typeof settlePredictionMarket>[1];
}) {
  let hasSettlementColumns = true;
  let { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select(
      "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, market_key, market_label, selection_key, selection_label, line, created_at",
    )
    .eq("match_id", matchId)
    .or("status.is.null,status.eq.active");

  if (predictionsError) {
    if (!isMissingPredictionStatusError(predictionsError)) {
      throw new Error(`Supabase update failed: ${predictionsError.message}`);
    }

    hasSettlementColumns = false;
    const fallbackResult = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, points, market_key, market_label, selection_key, selection_label, line, created_at",
      )
      .eq("match_id", matchId);

    predictions = fallbackResult.data as typeof predictions;
    predictionsError = fallbackResult.error;

    if (predictionsError) {
      throw new Error(`Supabase update failed: ${predictionsError.message}`);
    }
  }

  let settled = 0;

  for (const prediction of (predictions ?? []) as Prediction[]) {
    if (hasSettlementColumns && prediction.settled_at) {
      continue;
    }

    const settlement = settlePredictionMarket(prediction, matchForSettlement);

    if (!settlement) {
      continue;
    }

    const { points, payout, status } = settlement;
    const updatePayload = hasSettlementColumns
      ? {
          points,
          payout,
          status,
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

    if (payout > 0 && (prediction.payout ?? 0) === 0) {
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
        throw new Error(`Supabase update failed: ${playerUpdateError.message}`);
      }
    }

    settled += 1;
  }

  return settled;
}

export function buildScoresApiUrl(apiKey: string) {
  const url = new URL(scoresApiUrl);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(scoreSyncDaysFrom));
  url.searchParams.set("dateFormat", scoreSyncDateFormat);

  return url;
}

export async function fetchScores(apiKey: string) {
  const url = buildScoresApiUrl(apiKey);

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
  const rawEvents = await fetchScores(oddsApiKey);
  const events = rawEvents.filter(isFinishedEvent);
  onStep?.("update_supabase");
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, home_team, away_team, start_time, status, home_score, away_score, stage, result, betting_result, regular_home_score, regular_away_score, final_home_score, final_away_score, advancement_winner",
    )
    .or("status.is.null,status.neq.finished,home_score.is.null,away_score.is.null");

  if (matchesError) {
    throw new Error(`Supabase update failed: ${matchesError.message}`);
  }

  const skipped: SyncScoresResult["skipped"] = [];
  const updatedMatches: SyncScoresResult["updatedMatches"] = [];
  const matchedEventKeys = new Set<string>();
  let finished = 0;
  let settled = 0;

  for (const match of matches ?? []) {
    const event = getMatchedEvent(match, events);

    if (!event) {
      const candidates = getScoreEventCandidates(match, rawEvents).slice(0, 5);
      const sameFixtureUnfinishedCandidate = candidates.find(
        (candidate) =>
          (candidate.sameOrder || candidate.reversedOrder) &&
          candidate.withinTimeWindow &&
          candidate.notSelectedReason.includes("completed=false"),
      );
      const reason = sameFixtureUnfinishedCandidate
        ? "API event matched by teams/time but completed=false/status is not finished; waiting for The Odds API to finalize the score before settling."
        : "No matched finished score event";

      console.warn("unmatched score match:", {
        ...getUnmatchedScoreDiagnostics(match, events),
        reason,
      });
      skipped.push({
        id: match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        stage: match.stage,
        start_time: match.start_time,
        reason,
        candidates,
      });
      continue;
    }

    const scores = getScoresForMatch(match, event);

    if (!scores) {
      skipped.push({
        id: match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        stage: match.stage,
        start_time: match.start_time,
        reason: "Missing or invalid score",
        candidates: [analyzeScoreEventMatch(match, event)],
      });
      continue;
    }

    matchedEventKeys.add(getScoreEventKey(event));
    const result = getResultFromScores(scores.homeScore, scores.awayScore);

    if (isKnockoutStage(match.stage)) {
      const advancementWinner = getAdvancementWinnerFromScores(
        scores.homeScore,
        scores.awayScore,
      );

      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({
          regular_home_score: scores.homeScore,
          regular_away_score: scores.awayScore,
          betting_result: result,
          final_home_score: scores.homeScore,
          final_away_score: scores.awayScore,
          home_score: scores.homeScore,
          away_score: scores.awayScore,
          advancement_winner: advancementWinner,
          result: getLegacyResultFromBettingResult(result),
          status: "finished",
        })
        .eq("id", match.id);

      if (matchUpdateError) {
        throw new Error(`Supabase update failed: ${matchUpdateError.message}`);
      }

      const matchSettled = await settleActivePredictionsForMatch({
        supabase,
        matchId: match.id,
        matchForSettlement: {
          betting_result: result,
          result: getLegacyResultFromBettingResult(result),
          regular_home_score: scores.homeScore,
          regular_away_score: scores.awayScore,
          final_home_score: scores.homeScore,
          final_away_score: scores.awayScore,
          home_score: scores.homeScore,
          away_score: scores.awayScore,
          advancement_winner: advancementWinner,
        },
      });

      if (!advancementWinner) {
        skipped.push({
          id: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          stage: match.stage,
          start_time: match.start_time,
          reason:
            "淘汰赛最终比分为平局，晋级方需要人工录入；胜平负和大小球已按90分钟比分结算。",
        });
      }

      finished += 1;
      settled += matchSettled;
      updatedMatches.push({
        id: match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        stage: match.stage,
        start_time: match.start_time,
        matched_event: {
          id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          completed: event.completed,
          status: event.status,
        },
        home_score: scores.homeScore,
        away_score: scores.awayScore,
        betting_result: result,
        advancement_winner: advancementWinner,
        settled: matchSettled,
      });
      continue;
    }

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        home_score: scores.homeScore,
        away_score: scores.awayScore,
        regular_home_score: scores.homeScore,
        regular_away_score: scores.awayScore,
        betting_result: result,
        final_home_score: scores.homeScore,
        final_away_score: scores.awayScore,
        advancement_winner: null,
        result: getLegacyResultFromBettingResult(result),
        status: "finished",
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      throw new Error(`Supabase update failed: ${matchUpdateError.message}`);
    }

    const matchSettled = await settleActivePredictionsForMatch({
      supabase,
      matchId: match.id,
      matchForSettlement: {
        betting_result: result,
        result: getLegacyResultFromBettingResult(result),
        regular_home_score: scores.homeScore,
        regular_away_score: scores.awayScore,
        home_score: scores.homeScore,
        away_score: scores.awayScore,
      },
    });

    finished += 1;
    settled += matchSettled;
    updatedMatches.push({
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      stage: match.stage,
      start_time: match.start_time,
      matched_event: {
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        completed: event.completed,
        status: event.status,
      },
      home_score: scores.homeScore,
      away_score: scores.awayScore,
      betting_result: result,
      advancement_winner: null,
      settled: matchSettled,
    });
  }

  return {
    finished,
    settled,
    request: {
      sportKey: scoreSyncSportKey,
      endpoint: scoresApiUrl,
      daysFrom: scoreSyncDaysFrom,
      dateFormat: scoreSyncDateFormat,
      serverTime: new Date().toISOString(),
      apiEvents: rawEvents.length,
      finishedApiEvents: events.length,
      localCandidates: matches?.length ?? 0,
    },
    updatedMatches,
    skipped,
    unmatchedEvents: events
      .filter((event) => !matchedEventKeys.has(getScoreEventKey(event)))
      .slice(0, 20)
      .map((event) => ({
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        completed: event.completed,
        status: event.status,
        scores: event.scores,
        reason: "Finished API event was not matched to a local update candidate.",
      })),
  };
}
