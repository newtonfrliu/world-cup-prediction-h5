import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  analyzeScoreEventMatch,
  fetchScores,
  getMatchedEvent,
  getScoreEventCandidates,
  getScoresForMatch,
  isFinishedEvent,
  normalizeTeamName,
  scoreSyncDateFormat,
  scoreSyncDaysFrom,
  scoreSyncSportKey,
  scoresApiUrl,
} from "../lib/syncScores.ts";
import type { Database } from "../types/database.ts";

type MatchRow = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  | "id"
  | "match_number"
  | "home_team"
  | "away_team"
  | "start_time"
  | "status"
  | "stage"
  | "result"
  | "home_score"
  | "away_score"
  | "regular_home_score"
  | "regular_away_score"
  | "betting_result"
  | "final_home_score"
  | "final_away_score"
  | "advancement_winner"
>;

const envFilePath = path.join(process.cwd(), ".env.local");
const reportPath = path.join(
  process.cwd(),
  "docs",
  "CANADA_MOROCCO_SCORE_SYNC_DEBUG.md",
);

function loadLocalEnv() {
  if (!existsSync(envFilePath)) {
    return;
  }

  const envText = readFileSync(envFilePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));

  return arg?.slice(prefix.length);
}

function isSameFixture(match: MatchRow, home: string, away: string) {
  const targetHome = normalizeTeamName(home);
  const targetAway = normalizeTeamName(away);
  const localHome = normalizeTeamName(match.home_team);
  const localAway = normalizeTeamName(match.away_team);

  return (
    (localHome === targetHome && localAway === targetAway) ||
    (localHome === targetAway && localAway === targetHome)
  );
}

function isRelatedEvent(
  event: { home_team: string; away_team: string },
  home: string,
  away: string,
) {
  const targetHome = normalizeTeamName(home);
  const targetAway = normalizeTeamName(away);
  const apiHome = normalizeTeamName(event.home_team);
  const apiAway = normalizeTeamName(event.away_team);

  return (
    [apiHome, apiAway].includes(targetHome) ||
    [apiHome, apiAway].includes(targetAway) ||
    apiHome.includes(targetHome) ||
    apiAway.includes(targetHome) ||
    apiHome.includes(targetAway) ||
    apiAway.includes(targetAway)
  );
}

function isLocalUpdateCandidate(match: MatchRow) {
  return (
    match.status !== "finished" ||
    match.home_score === null ||
    match.away_score === null
  );
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildMarkdown({
  home,
  away,
  localMatches,
  rawEvents,
  relatedEvents,
  finalJudgement,
}: {
  home: string;
  away: string;
  localMatches: MatchRow[];
  rawEvents: Awaited<ReturnType<typeof fetchScores>>;
  relatedEvents: Awaited<ReturnType<typeof fetchScores>>;
  finalJudgement: string;
}) {
  const lines: string[] = [];

  lines.push("# Canada vs Morocco Score Sync Debug");
  lines.push("");
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Admin Sync Path");
  lines.push("");
  lines.push(
    "`app/admin/page.tsx` -> `app/api/admin/sync-scores/route.ts` -> `lib/syncScores.ts` -> The Odds API scores endpoint -> Supabase `matches` update -> active prediction settlement.",
  );
  lines.push("");
  lines.push("## Request Config");
  lines.push("");
  lines.push(`- sport_key: ${scoreSyncSportKey}`);
  lines.push(`- endpoint: ${scoresApiUrl}`);
  lines.push(`- daysFrom: ${scoreSyncDaysFrom}`);
  lines.push(`- dateFormat: ${scoreSyncDateFormat}`);
  lines.push(`- server_time: ${new Date().toISOString()}`);
  lines.push(`- api_key: exists, not printed`);
  lines.push("");
  lines.push("## Local Match Rows");
  lines.push("");

  if (localMatches.length === 0) {
    lines.push(`No local match found for ${home} vs ${away}.`);
  } else {
    for (const match of localMatches) {
      lines.push("```json");
      lines.push(formatJson(match));
      lines.push("```");
      lines.push(
        `Local selected by current sync query: ${isLocalUpdateCandidate(match) ? "yes" : "no"}`,
      );
      lines.push("");
    }
  }

  lines.push("## Raw Related API Events");
  lines.push("");
  lines.push(`- total API events returned: ${rawEvents.length}`);
  lines.push(`- related events for ${home}/${away}: ${relatedEvents.length}`);
  lines.push("");

  if (relatedEvents.length === 0) {
    lines.push("No related API event returned in the current scores window.");
  } else {
    for (const event of relatedEvents) {
      lines.push("```json");
      lines.push(formatJson(event));
      lines.push("```");
    }
  }

  lines.push("");
  lines.push("## Matching Diagnostics");
  lines.push("");

  for (const match of localMatches) {
    const finishedEvents = rawEvents.filter(isFinishedEvent);
    const matched = getMatchedEvent(match, finishedEvents);
    const scores = matched ? getScoresForMatch(match, matched) : null;
    const candidates = getScoreEventCandidates(match, rawEvents);

    lines.push(`### ${match.home_team} vs ${match.away_team}`);
    lines.push("");
    lines.push(`- matched by current sync: ${matched ? "yes" : "no"}`);
    lines.push(`- matched scores: ${scores ? `${scores.homeScore}-${scores.awayScore}` : "-"}`);
    lines.push("");

    if (matched) {
      lines.push("Matched event:");
      lines.push("```json");
      lines.push(formatJson(matched));
      lines.push("```");
    }

    lines.push("Candidates:");
    lines.push("```json");
    lines.push(formatJson(candidates));
    lines.push("```");
    lines.push("");

    if (relatedEvents.length > 0) {
      lines.push("Per related event diagnostics:");
      lines.push("```json");
      lines.push(formatJson(relatedEvents.map((event) => analyzeScoreEventMatch(match, event))));
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## Final Judgement");
  lines.push("");
  lines.push(finalJudgement);
  lines.push("");
  lines.push("## Fix Points");
  lines.push("");
  lines.push("- Admin sync now receives detailed skipped match reasons instead of only a count.");
  lines.push("- Score sync report includes request config, updated matches, skipped diagnostics, and unmatched API events.");
  lines.push("- The Odds API scores endpoint currently accepts `daysFrom=3`; a trial with `daysFrom=7` returned `INVALID_SCORES_DAYS_FROM`, so this project keeps the maximum accepted 3-day window.");
  lines.push("- This debug run is read-only and does not update matches, predictions, coins, payouts, or points.");

  return `${lines.join("\n")}\n`;
}

async function main() {
  loadLocalEnv();

  const home = getArg("home") ?? "Canada";
  const away = getArg("away") ?? "Morocco";
  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!oddsApiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, match_number, home_team, away_team, start_time, status, stage, result, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .order("start_time", { ascending: true });

  if (matchesError) {
    throw new Error(`Supabase read failed: ${matchesError.message}`);
  }

  const localMatches = ((matches ?? []) as MatchRow[]).filter((match) =>
    isSameFixture(match, home, away),
  );
  const rawEvents = await fetchScores(oddsApiKey);
  const relatedEvents = rawEvents.filter((event) =>
    isRelatedEvent(event, home, away),
  );

  let finalJudgement = "";

  if (localMatches.length === 0) {
    finalJudgement = `No local ${home} vs ${away} row was found, so sync cannot update it.`;
  } else if (relatedEvents.length === 0) {
    finalJudgement = `The Odds API did not return any related ${home}/${away} event in the current ${scoreSyncDaysFrom}-day scores window.`;
  } else {
    const finishedEvents = rawEvents.filter(isFinishedEvent);
    const localResults = localMatches.map((match) => {
      const matched = getMatchedEvent(match, finishedEvents);
      const scores = matched ? getScoresForMatch(match, matched) : null;

      if (!isLocalUpdateCandidate(match)) {
        return `${match.home_team} vs ${match.away_team}: already finished with scores, current sync query would not update it.`;
      }

      if (!matched) {
        const candidates = getScoreEventCandidates(match, rawEvents);
        const unfinishedCandidate = candidates.find(
          (candidate) =>
            (candidate.sameOrder || candidate.reversedOrder) &&
            candidate.withinTimeWindow &&
            candidate.notSelectedReason.includes("completed=false"),
        );

        if (unfinishedCandidate) {
          return `${match.home_team} vs ${match.away_team}: API event matches local teams/time, but The Odds API still reports completed=false/status not finished. Current sync intentionally does not mark the match finished or settle bets until the API finalizes the event.`;
        }

        return `${match.home_team} vs ${match.away_team}: API event exists, but current matcher did not select it. Check team alias/order/time proximity diagnostics.`;
      }

      if (!scores) {
        return `${match.home_team} vs ${match.away_team}: event matched, but score rows could not map back to local team names.`;
      }

      return `${match.home_team} vs ${match.away_team}: current sync can match a finished API event with score ${scores.homeScore}-${scores.awayScore}. Running sync:scores would update this match, but this debug script intentionally does not write.`;
    });

    finalJudgement = localResults.join("\n\n");
  }

  mkdirSync(path.dirname(reportPath), { recursive: true });
  const markdown = buildMarkdown({
    home,
    away,
    localMatches,
    rawEvents,
    relatedEvents,
    finalJudgement,
  });
  writeFileSync(reportPath, markdown, "utf8");

  console.log(`Score sync debug for ${home} vs ${away}`);
  console.log(`Local matches: ${localMatches.length}`);
  console.log(`API events returned: ${rawEvents.length}`);
  console.log(`Related API events: ${relatedEvents.length}`);
  console.log(finalJudgement);
  console.log(`Report: ${reportPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
