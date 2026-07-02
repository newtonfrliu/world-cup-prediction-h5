import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type MatchRow = {
  id: string;
  match_number: number | null;
  stage: string | null;
  home_team: string;
  away_team: string;
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
  id: string;
  player_id: string;
  match_id: string;
  prediction: string;
  odds_at_prediction: number;
  stake: number;
  payout: number;
  points: number | null;
  status: string | null;
  settled_at: string | null;
};

type PlayerRow = {
  id: string;
  nickname: string;
  coins: number;
};

type CompensationRow = {
  predictionId: string;
  playerId: string;
  nickname: string;
  currentCoins: number;
  prediction: string;
  stake: number;
  oddsAtPrediction: number;
  oldStatus: string | null;
  newStatus: "won" | "lost";
  oldPayout: number;
  newPayout: number;
  coinDelta: number;
  oldPoints: number;
  newPoints: number;
  pointsDelta: number;
};

const correctRegularHomeScore = 2;
const correctRegularAwayScore = 2;
const correctBettingResult = "draw";
const correctFinalHomeScore = 3;
const correctFinalAwayScore = 2;
const correctAdvancementWinner = "home";

const reportPath = path.join(
  process.cwd(),
  "docs",
  "BELGIUM_SENEGAL_90MIN_COMPENSATION_AUDIT.md",
);
const strictSqlPath = path.join(
  process.cwd(),
  "supabase_fix_belgium_senegal_90min_strict.sql",
);
const friendlySqlPath = path.join(
  process.cwd(),
  "supabase_fix_belgium_senegal_90min_friendly.sql",
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

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeTeamName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
}

function isBelgiumSenegal(match: MatchRow) {
  const home = normalizeTeamName(match.home_team);
  const away = normalizeTeamName(match.away_team);

  return (
    home.includes("belgium") &&
    (away.includes("senegal") || away.includes("塞内加尔"))
  );
}

function nextStatus(prediction: string): "won" | "lost" {
  return prediction === "draw" ? "won" : "lost";
}

function calculateNewPayout(row: PredictionRow, status: "won" | "lost") {
  return status === "won"
    ? Math.round((row.stake ?? 0) * (row.odds_at_prediction ?? 0))
    : 0;
}

function calculateNewPoints(row: PredictionRow, status: "won" | "lost") {
  return status === "won" ? Math.round((row.odds_at_prediction ?? 0) * 100) : 0;
}

function countBy<T extends string | null>(values: T[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value ?? "null";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function formatCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function valuesRows(rows: CompensationRow[]) {
  if (rows.length === 0) {
    return "";
  }

  return rows
    .map(
      (row) =>
        `  (${sqlString(row.playerId)}::uuid, ${sqlString(row.predictionId)}::uuid, ${row.coinDelta})`,
    )
    .join(",\n");
}

function buildMatchUpdateSql(match: MatchRow) {
  return [
    "update public.matches",
    "set",
    `  regular_home_score = ${correctRegularHomeScore},`,
    `  regular_away_score = ${correctRegularAwayScore},`,
    `  betting_result = ${sqlString(correctBettingResult)},`,
    `  final_home_score = ${correctFinalHomeScore},`,
    `  final_away_score = ${correctFinalAwayScore},`,
    `  advancement_winner = ${sqlString(correctAdvancementWinner)}`,
    `where id = ${sqlString(match.id)}::uuid`,
    `  and home_team = ${sqlString(match.home_team)}`,
    `  and away_team = ${sqlString(match.away_team)};`,
  ].join("\n");
}

function buildPredictionUpdates(rows: CompensationRow[], match: MatchRow) {
  return rows
    .map((row) =>
      [
        `-- ${row.nickname} / ${row.prediction} / ${row.oldStatus} -> ${row.newStatus}`,
        "update public.predictions",
        "set",
        `  status = ${sqlString(row.newStatus)},`,
        `  payout = ${row.newPayout},`,
        `  points = ${row.newPoints},`,
        "  settled_at = now()",
        `where id = ${sqlString(row.predictionId)}::uuid`,
        `  and match_id = ${sqlString(match.id)}::uuid;`,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildCoinAdjustmentSql(
  rows: CompensationRow[],
  transactionType: string,
  onlyPositive: boolean,
) {
  const eligibleRows = rows.filter((row) =>
    onlyPositive ? row.coinDelta > 0 : row.coinDelta !== 0,
  );

  if (eligibleRows.length === 0) {
    return "-- No coin adjustments required for this strategy.";
  }

  return [
    "with compensation(player_id, prediction_id, amount) as (",
    "  values",
    valuesRows(eligibleRows),
    "), inserted_transactions as (",
    "  insert into public.coin_transactions (player_id, amount, type, related_id, related_player_id)",
    "  select",
    "    c.player_id,",
    "    c.amount,",
    `    ${sqlString(transactionType)},`,
    "    c.prediction_id,",
    "    null",
    "  from compensation c",
    "  where not exists (",
    "    select 1",
    "    from public.coin_transactions existing",
    "    where existing.type = " + sqlString(transactionType),
    "      and existing.related_id = c.prediction_id",
    "  )",
    "  returning player_id, amount",
    "), totals as (",
    "  select player_id, sum(amount) as amount",
    "  from inserted_transactions",
    "  group by player_id",
    ")",
    "update public.players p",
    "set coins = p.coins + totals.amount",
    "from totals",
    "where p.id = totals.player_id;",
  ].join("\n");
}

function buildSql(
  match: MatchRow,
  rows: CompensationRow[],
  strategy: "strict" | "friendly",
) {
  const lines = [
    "begin;",
    "",
    "-- Belgium vs Senegal 90-minute settlement correction.",
    "-- Only this match_id and explicit prediction_id rows are touched.",
    "-- public.leaderboard is a view and must not be updated directly.",
    "",
    buildMatchUpdateSql(match),
    "",
    buildPredictionUpdates(rows, match) || "-- No prediction updates required.",
    "",
  ];

  if (strategy === "strict") {
    lines.push(
      buildCoinAdjustmentSql(
        rows,
        "belgium_senegal_90min_strict_adjustment",
        false,
      ),
    );
  } else {
    lines.push(
      buildCoinAdjustmentSql(
        rows,
        "belgium_senegal_90min_compensation",
        true,
      ),
    );
  }

  lines.push("", "commit;", "");
  return lines.join("\n");
}

function buildReport(match: MatchRow, predictions: PredictionRow[], rows: CompensationRow[]) {
  const predictionCounts = countBy(predictions.map((row) => row.prediction));
  const oldStatusCounts = countBy(predictions.map((row) => row.status));
  const newStatusCounts = countBy(rows.map((row) => row.newStatus));
  const strictCoinDelta = rows.reduce((sum, row) => sum + row.coinDelta, 0);
  const friendlyCoinTopUp = rows
    .filter((row) => row.coinDelta > 0)
    .reduce((sum, row) => sum + row.coinDelta, 0);
  const pointsDelta = rows.reduce((sum, row) => sum + row.pointsDelta, 0);
  const negativeCoinRisks = rows.filter(
    (row) => row.currentCoins + row.coinDelta < 0,
  );

  const lines = [
    "# Belgium vs Senegal 90-Minute Compensation Audit",
    "",
    "This is a dry-run report. No database changes were applied.",
    "",
    "## Confirmed Scope",
    "",
    "- Affected match: Belgium vs Senegal only.",
    "- Correct 90-minute score: Belgium 2-2 Senegal.",
    "- Correct betting_result: `draw`.",
    "- Final score after extra time: Belgium 3-2 Senegal.",
    "- advancement_winner: `home`.",
    "- Netherlands vs Morocco: 90 minutes 1-1, 120 minutes 1-1, penalty winner differs; if current result is draw, 1X2 settlement is correct. No compensation generated.",
    "- Germany vs Paraguay: 90 minutes 1-1, 120 minutes 1-1, penalty winner differs; if current result is draw, 1X2 settlement is correct. No compensation generated.",
    "",
    "## Current Match Data",
    "",
    `- match_id: \`${match.id}\``,
    `- stage: ${match.stage ?? "-"}`,
    `- home_team: ${match.home_team}`,
    `- away_team: ${match.away_team}`,
    `- legacy home_score / away_score: ${match.home_score ?? "-"}-${match.away_score ?? "-"}`,
    `- legacy result: ${match.result ?? "-"}`,
    `- current regular score: ${match.regular_home_score ?? "-"}-${match.regular_away_score ?? "-"}`,
    `- current betting_result: ${match.betting_result ?? "-"}`,
    `- current final score: ${match.final_home_score ?? "-"}-${match.final_away_score ?? "-"}`,
    `- current advancement_winner: ${match.advancement_winner ?? "-"}`,
    `- current result is home: ${match.result === "home" || match.result === "home_win" ? "yes" : "no"}`,
    "",
    "## Prediction Summary",
    "",
    `- total predictions: ${predictions.length}`,
    `- prediction choice distribution: ${formatCounts(predictionCounts) || "-"}`,
    `- old status distribution: ${formatCounts(oldStatusCounts) || "-"}`,
    `- new status distribution: ${formatCounts(newStatusCounts) || "-"}`,
    "",
    "## User-Level Delta",
    "",
    "| Nickname | Player ID | Prediction | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta | Current Coins | Strict Coins After |",
    "| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      [
        row.nickname,
        `\`${row.playerId}\``,
        row.prediction,
        String(row.stake),
        String(row.oddsAtPrediction),
        row.oldStatus ?? "-",
        row.newStatus,
        String(row.oldPayout),
        String(row.newPayout),
        String(row.coinDelta),
        String(row.oldPoints),
        String(row.newPoints),
        String(row.pointsDelta),
        String(row.currentCoins),
        String(row.currentCoins + row.coinDelta),
      ].join(" | "),
    );
  }

  lines.push(
    "",
    "## Strategy A: Strict Correction",
    "",
    "- Update prediction.status / payout / points to the corrected values.",
    "- Apply `players.coins += coin_delta`, including negative deltas.",
    `- Total coin_delta: ${strictCoinDelta}`,
    `- Total points_delta: ${pointsDelta}`,
    `- Users whose coins would become negative: ${negativeCoinRisks.length}`,
    "",
  );

  if (negativeCoinRisks.length > 0) {
    for (const row of negativeCoinRisks) {
      lines.push(
        `- ${row.nickname} (${row.playerId}): ${row.currentCoins} + (${row.coinDelta}) = ${row.currentCoins + row.coinDelta}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Strategy B: Friendly Compensation",
    "",
    "- Update prediction.status / payout / points to the corrected values.",
    "- Only top up `coin_delta > 0`.",
    "- Do not deduct coins for users who were overpaid by the old settlement.",
    "- Insert `coin_transactions` rows with `related_id = prediction_id` to prevent duplicate top-ups.",
    `- Total top-up coins: ${friendlyCoinTopUp}`,
    `- Total points_delta: ${pointsDelta}`,
    "",
    "## Generated SQL",
    "",
    `- Strict SQL: \`${path.basename(strictSqlPath)}\``,
    `- Friendly SQL: \`${path.basename(friendlySqlPath)}\``,
    "",
    "Neither SQL file was executed by this script.",
    "",
  );

  return lines.join("\n");
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
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, home_score, away_score, result, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    );

  if (matchError) {
    throw new Error(`Failed to load matches: ${matchError.message}`);
  }

  const match = ((matches ?? []) as MatchRow[]).find(isBelgiumSenegal);

  if (!match) {
    throw new Error("Belgium vs Senegal match not found.");
  }

  const { data: predictions, error: predictionError } = await supabase
    .from("predictions")
    .select(
      "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, points, status, settled_at",
    )
    .eq("match_id", match.id);

  if (predictionError) {
    throw new Error(`Failed to load predictions: ${predictionError.message}`);
  }

  const predictionRows = (predictions ?? []) as PredictionRow[];
  const settledPredictions = predictionRows.filter((prediction) =>
    ["won", "lost", "settled"].includes((prediction.status ?? "").toLowerCase()),
  );
  const playerIds = Array.from(
    new Set(settledPredictions.map((prediction) => prediction.player_id)),
  );
  const { data: players, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, coins")
    .in("id", playerIds);

  if (playerError) {
    throw new Error(`Failed to load players: ${playerError.message}`);
  }

  const playersById = new Map(
    ((players ?? []) as PlayerRow[]).map((player) => [player.id, player]),
  );
  const rows = settledPredictions.map((prediction): CompensationRow => {
    const player = playersById.get(prediction.player_id);
    const status = nextStatus(prediction.prediction);
    const newPayout = calculateNewPayout(prediction, status);
    const newPoints = calculateNewPoints(prediction, status);
    const oldPayout = prediction.payout ?? 0;
    const oldPoints = prediction.points ?? 0;

    return {
      predictionId: prediction.id,
      playerId: prediction.player_id,
      nickname: player?.nickname ?? "(unknown)",
      currentCoins: player?.coins ?? 0,
      prediction: prediction.prediction,
      stake: prediction.stake ?? 0,
      oddsAtPrediction: prediction.odds_at_prediction ?? 0,
      oldStatus: prediction.status,
      newStatus: status,
      oldPayout,
      newPayout,
      coinDelta: newPayout - oldPayout,
      oldPoints,
      newPoints,
      pointsDelta: newPoints - oldPoints,
    };
  });

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, buildReport(match, predictionRows, rows), "utf8");
  writeFileSync(strictSqlPath, buildSql(match, rows, "strict"), "utf8");
  writeFileSync(friendlySqlPath, buildSql(match, rows, "friendly"), "utf8");

  console.log(`Belgium vs Senegal match_id: ${match.id}`);
  console.log(`Total predictions: ${predictionRows.length}`);
  console.log(`Settled predictions audited: ${rows.length}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Strict SQL: ${strictSqlPath}`);
  console.log(`Friendly SQL: ${friendlySqlPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
