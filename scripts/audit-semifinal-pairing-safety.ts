import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type MatchRow = {
  id: string;
  match_number: number | null;
  stage: string | null;
  home_team: string;
  away_team: string;
  status: string | null;
  start_time: string;
};

type PredictionRow = {
  id: string;
  match_id: string;
  market_key: string | null;
  status: string | null;
};

type MarketRow = {
  id: string;
  match_id: string;
  market_key: string;
  selection_key: string;
  selection_label: string;
  odds: number;
  line: number | null;
  is_active: boolean | null;
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "SEMIFINAL_PAIRING_SAFETY_AUDIT.md",
);
const fixSqlPath = path.join(process.cwd(), "supabase_fix_semifinal_pairing.sql");
const cleanupSqlPath = path.join(
  process.cwd(),
  "supabase_cleanup_wrong_semifinal_markets.sql",
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
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function formatShanghaiTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function groupPredictions(predictions: PredictionRow[]) {
  const counts = new Map<string, number>();

  for (const prediction of predictions) {
    const key = `${prediction.match_id}:${prediction.market_key ?? "null"}:${prediction.status ?? "null"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function buildFixSql(semis: MatchRow[]) {
  const [earlier, later] = semis;

  return [
    "-- Fix semifinal pairing after correcting the 8-team bracket mapping.",
    "-- Scope: update only public.matches.home_team / away_team for the two semifinal rows.",
    "-- M101 is inferred as the earlier semifinal by start_time because match_number is nullable in this dataset.",
    "-- M102 is inferred as the later semifinal by start_time because match_number is nullable in this dataset.",
    "-- Do not modify predictions, players, odds, points, coins, settlement, status, or start_time.",
    "begin;",
    "",
    "update public.matches",
    "set home_team = 'France',",
    "    away_team = 'Spain'",
    `where id = ${sqlString(earlier.id)}`,
    "  and stage in ('semi_final', 'semi_finals')",
    `  and start_time = ${sqlString(earlier.start_time)};`,
    "",
    "update public.matches",
    "set home_team = 'England',",
    "    away_team = 'Argentina'",
    `where id = ${sqlString(later.id)}`,
    "  and stage in ('semi_final', 'semi_finals')",
    `  and start_time = ${sqlString(later.start_time)};`,
    "",
    "commit;",
    "",
    "-- Verification:",
    "-- select id, match_number, stage, home_team, away_team, status, start_time",
    "-- from public.matches",
    "-- where stage in ('semi_final', 'semi_finals')",
    "-- order by start_time;",
    "",
  ].join("\n");
}

function buildCleanupSql(markets: MarketRow[]) {
  if (markets.length === 0) {
    return "";
  }

  return [
    "-- Deactivate semifinal markets that were attached while semifinal teams were incorrectly paired.",
    "-- Generated for review only. Do not run if those markets are already for the corrected fixtures.",
    "begin;",
    "",
    "update public.match_betting_markets",
    "set is_active = false,",
    "    updated_at = now()",
    `where id in (${markets.map((market) => sqlString(market.id)).join(", ")});`,
    "",
    "commit;",
    "",
  ].join("\n");
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
  const { data: semisData, error: semisError } = await supabase
    .from("matches")
    .select("id, match_number, stage, home_team, away_team, status, start_time")
    .in("stage", ["semi_final", "semi_finals"])
    .order("start_time", { ascending: true });

  if (semisError) {
    throw new Error(`Failed to load semifinals: ${semisError.message}`);
  }

  const semis = (semisData ?? []) as MatchRow[];
  if (semis.length !== 2) {
    throw new Error(`Expected 2 semifinal rows, found ${semis.length}.`);
  }

  const semiIds = semis.map((match) => match.id);
  const { data: predictionsData, error: predictionsError } = await supabase
    .from("predictions")
    .select("id, match_id, market_key, status")
    .in("match_id", semiIds);

  if (predictionsError) {
    throw new Error(`Failed to load semifinal predictions: ${predictionsError.message}`);
  }

  const { data: marketsData, error: marketsError } = await supabase
    .from("match_betting_markets")
    .select("id, match_id, market_key, selection_key, selection_label, odds, line, is_active")
    .in("match_id", semiIds);

  if (marketsError) {
    throw new Error(`Failed to load semifinal markets: ${marketsError.message}`);
  }

  const predictions = (predictionsData ?? []) as PredictionRow[];
  const markets = (marketsData ?? []) as MarketRow[];
  const predictionCounts = groupPredictions(predictions);

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(fixSqlPath, buildFixSql(semis), "utf8");

  const cleanupSql = buildCleanupSql(markets);
  if (cleanupSql) {
    writeFileSync(cleanupSqlPath, cleanupSql, "utf8");
  }

  const lines = [
    "# Semifinal Pairing Safety Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Current Wrong Semifinals",
    "",
    "| inferred slot | id | current home | current away | status | start_time | Beijing time |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...semis.map((match, index) =>
      [
        index === 0 ? "M101 / earlier semifinal" : "M102 / later semifinal",
        match.id,
        match.home_team,
        match.away_team,
        match.status ?? "-",
        match.start_time,
        formatShanghaiTime(match.start_time),
      ].join(" | "),
    ).map((line) => `| ${line} |`),
    "",
    "## Correct Semifinals",
    "",
    "- M101 / earlier semifinal: France vs Spain",
    "- M102 / later semifinal: England vs Argentina",
    "",
    "## Why Current Pairing Is Wrong",
    "",
    "- Previous mapping used M101 = winner(M97) vs winner(M98), producing France vs Argentina.",
    "- Previous mapping used M102 = winner(M99) vs winner(M100), producing England vs Spain.",
    "- The corrected mapping is M101 = winner(M97) vs winner(M100), M102 = winner(M99) vs winner(M98).",
    "- The Odds API candidate fixtures also indicate France vs Spain and England vs Argentina.",
    "",
    "## Existing Semifinal Predictions",
    "",
    `- total predictions: ${predictions.length}`,
    predictionCounts.size === 0
      ? "- none"
      : Array.from(predictionCounts.entries())
          .map(([key, count]) => `- ${key}: ${count}`)
          .join("\n"),
    "",
    "## Existing Semifinal Betting Markets",
    "",
    `- total markets: ${markets.length}`,
    markets.length === 0
      ? "- no market cleanup needed"
      : markets
          .map(
            (market) =>
              `- ${market.id}: match=${market.match_id}, ${market.market_key}/${market.selection_key}, ${market.selection_label}, odds=${market.odds}, active=${market.is_active}`,
          )
          .join("\n"),
    "",
    "## Generated SQL",
    "",
    `- fix SQL: \`${path.basename(fixSqlPath)}\``,
    markets.length > 0
      ? `- cleanup SQL for review: \`${path.basename(cleanupSqlPath)}\``
      : "- cleanup SQL: not generated because no semifinal markets exist",
    "",
    "## Safety Decision",
    "",
    predictions.length > 0
      ? "STOP: Existing semifinal predictions were found. Do not auto-apply pairing correction without a separate prediction remediation plan."
      : "SAFE TO APPLY: No semifinal predictions exist. Pairing correction can update only matches.home_team / matches.away_team.",
  ];

  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Semifinals: ${semis.length}`);
  console.log(`Predictions: ${predictions.length}`);
  console.log(`Markets: ${markets.length}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Fix SQL: ${fixSqlPath}`);
  if (cleanupSql) console.log(`Cleanup SQL: ${cleanupSqlPath}`);
  if (predictions.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
