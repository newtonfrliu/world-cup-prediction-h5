import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type MatchRow = {
  id: string;
  stage: string | null;
  home_team: string;
  away_team: string;
  start_time: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  betting_result: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  advancement_winner: string | null;
};

type PredictionRow = {
  match_id: string;
  status: string | null;
  market_key: string | null;
};

type AuditRow = MatchRow & {
  active_predictions_count: number;
  settled_predictions_count: number;
  market_keys_involved: string[];
  safe_to_auto_backfill: boolean;
  needs_manual_review: boolean;
  reason: string;
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "RECENT_FINISHED_MATCHES_SETTLEMENT_FIELDS_AUDIT.md",
);
const sqlOutputPath = path.join(
  process.cwd(),
  "supabase_backfill_recent_finished_match_fields.sql",
);

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeStage(stage: string | null | undefined) {
  return (stage ?? "").trim().toLowerCase();
}

function isKnockoutStage(stage: string | null | undefined) {
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
  ].includes(normalizeStage(stage));
}

function getBettingResult(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

function getAdvancementWinner(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return null;
}

function sqlString(value: string | null) {
  if (value === null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

function getPredictionSummary(predictions: PredictionRow[]) {
  const activeStatuses = new Set(["active", null]);
  const settledStatuses = new Set([
    "won",
    "lost",
    "void",
    "half_win",
    "half_lost",
  ]);
  const active = predictions.filter((prediction) =>
    activeStatuses.has(prediction.status),
  );
  const settled = predictions.filter((prediction) =>
    settledStatuses.has(prediction.status ?? ""),
  );
  const marketKeys = Array.from(
    new Set(predictions.map((item) => item.market_key ?? "h2h_90")),
  ).sort();

  return {
    activeCount: active.length,
    settledCount: settled.length,
    marketKeys,
  };
}

function shouldIncludeMatch(match: MatchRow) {
  if (match.status !== "finished") return false;

  const missingSettlementField =
    match.regular_home_score === null ||
    match.regular_away_score === null ||
    match.betting_result === null;
  const missingKnockoutAdvancement =
    isKnockoutStage(match.stage) && match.advancement_winner === null;

  return missingSettlementField || missingKnockoutAdvancement;
}

function auditMatch(match: MatchRow, predictions: PredictionRow[]): AuditRow {
  const summary = getPredictionSummary(predictions);
  const homeScore = match.home_score;
  const awayScore = match.away_score;
  const finalHomeScore = match.final_home_score ?? homeScore;
  const finalAwayScore = match.final_away_score ?? awayScore;
  const knockout = isKnockoutStage(match.stage);
  const missingScore = homeScore === null || awayScore === null;
  const finalMatchesScore =
    finalHomeScore === homeScore && finalAwayScore === awayScore;
  const finalDraw =
    typeof finalHomeScore === "number" &&
    typeof finalAwayScore === "number" &&
    finalHomeScore === finalAwayScore;

  let safe = false;
  let manual = false;
  let reason = "";

  if (missingScore) {
    manual = true;
    reason = "home_score / away_score 缺失，无法回填90分钟字段。";
  } else if (!finalMatchesScore) {
    manual = true;
    reason = "final score 与 home_score / away_score 不一致，可能存在加时变化，需要人工确认90分钟比分。";
  } else if (knockout && finalDraw) {
    manual = true;
    reason = "淘汰赛最终比分为平局，可能点球决胜；不自动猜晋级方。";
  } else {
    safe = true;
    reason = knockout
      ? "淘汰赛比分非平且 final score 与 score 一致，可安全回填90分钟字段和晋级方。"
      : "小组赛/非淘汰赛可安全回填90分钟结算字段。";
  }

  return {
    ...match,
    active_predictions_count: summary.activeCount,
    settled_predictions_count: summary.settledCount,
    market_keys_involved: summary.marketKeys,
    safe_to_auto_backfill: safe,
    needs_manual_review: manual,
    reason,
  };
}

function writeBackfillSql(rows: AuditRow[]) {
  const safeRows = rows.filter((row) => row.safe_to_auto_backfill);
  const statements = safeRows.map((row) => {
    const homeScore = row.home_score ?? 0;
    const awayScore = row.away_score ?? 0;
    const bettingResult = getBettingResult(homeScore, awayScore);
    const advancementWinner = isKnockoutStage(row.stage)
      ? getAdvancementWinner(homeScore, awayScore)
      : null;

    return `update public.matches
set
  regular_home_score = ${homeScore},
  regular_away_score = ${awayScore},
  betting_result = ${sqlString(bettingResult)},
  final_home_score = coalesce(final_home_score, home_score),
  final_away_score = coalesce(final_away_score, away_score),
  advancement_winner = coalesce(advancement_winner, ${sqlString(
    advancementWinner,
  )})
where id = ${sqlString(row.id)};`;
  });
  const sql = `-- Safe backfill for finished matches missing settlement fields.
-- Generated by scripts/audit-recent-finished-matches-settlement-fields.ts.
-- This migration only updates public.matches fields.
-- It does not update predictions, players, coins, points, payout, or leaderboard.

begin;

${statements.length > 0 ? statements.join("\n\n") : "-- No safe matches found."}

commit;
`;

  writeFileSync(sqlOutputPath, sql);
}

function writeReport(rows: AuditRow[]) {
  mkdirSync(path.dirname(reportPath), { recursive: true });

  const safeRows = rows.filter((row) => row.safe_to_auto_backfill);
  const manualRows = rows.filter((row) => row.needs_manual_review);
  const lines = [
    "# Recent Finished Matches Settlement Fields Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- audited matches: ${rows.length}`,
    `- safe_to_auto_backfill: ${safeRows.length}`,
    `- needs_manual_review: ${manualRows.length}`,
    `- sql output: ${path.basename(sqlOutputPath)}`,
    "",
    "## Matches",
    "",
    "| start_time | stage | match | score | regular | betting_result | final | advancement | active | settled | markets | safe | manual | reason |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
    ...rows.map((row) => [
      row.start_time ?? "-",
      row.stage ?? "-",
      `${row.home_team} vs ${row.away_team}`,
      `${row.home_score ?? "-"}:${row.away_score ?? "-"}`,
      `${row.regular_home_score ?? "-"}:${row.regular_away_score ?? "-"}`,
      row.betting_result ?? "-",
      `${row.final_home_score ?? "-"}:${row.final_away_score ?? "-"}`,
      row.advancement_winner ?? "-",
      row.active_predictions_count,
      row.settled_predictions_count,
      row.market_keys_involved.join(", ") || "-",
      row.safe_to_auto_backfill ? "yes" : "no",
      row.needs_manual_review ? "yes" : "no",
      row.reason,
    ].join(" | ")).map((line) => `| ${line} |`),
    "",
    "## Notes",
    "",
    "- `safe_to_auto_backfill = yes` rows are written to `supabase_backfill_recent_finished_match_fields.sql`.",
    "- The generated SQL only updates `public.matches` settlement fields.",
    "- It intentionally does not update `predictions`, `players`, `coins`, `points`, `payout`, or the `leaderboard` view.",
  ];

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, stage, home_team, away_team, start_time, status, home_score, away_score, result, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .eq("status", "finished")
    .order("start_time", { ascending: false });

  if (matchesError) {
    throw new Error(`Failed to load matches: ${matchesError.message}`);
  }

  const candidates = ((matches ?? []) as MatchRow[]).filter(shouldIncludeMatch);
  const matchIds = candidates.map((match) => match.id);
  let predictions: PredictionRow[] = [];

  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from("predictions")
      .select("match_id, status, market_key")
      .in("match_id", matchIds);

    if (error) {
      throw new Error(`Failed to load predictions: ${error.message}`);
    }

    predictions = (data ?? []) as PredictionRow[];
  }

  const predictionsByMatch = new Map<string, PredictionRow[]>();
  for (const prediction of predictions) {
    const list = predictionsByMatch.get(prediction.match_id) ?? [];
    list.push(prediction);
    predictionsByMatch.set(prediction.match_id, list);
  }

  const auditRows = candidates.map((match) =>
    auditMatch(match, predictionsByMatch.get(match.id) ?? []),
  );

  writeBackfillSql(auditRows);
  writeReport(auditRows);

  console.log(`Audited matches: ${auditRows.length}`);
  console.log(
    `Safe to auto backfill: ${
      auditRows.filter((row) => row.safe_to_auto_backfill).length
    }`,
  );
  console.log(
    `Needs manual review: ${
      auditRows.filter((row) => row.needs_manual_review).length
    }`,
  );
  console.log(`Report: ${reportPath}`);
  console.log(`SQL: ${sqlOutputPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
