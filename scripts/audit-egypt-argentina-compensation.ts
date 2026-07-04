import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  settleAsianTotal,
  settlePredictionMarket,
  type MarketSettlementResult,
  type SettlementStatus,
} from "../lib/predictionSettlement.ts";

type MatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  stage: string | null;
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
  prediction: string | null;
  market_key: string | null;
  selection_key: string | null;
  selection_label: string | null;
  line: number | null;
  odds_at_prediction: number | null;
  stake: number | null;
  payout: number | null;
  points: number | null;
  status: string | null;
  settled_at: string | null;
};

type PlayerRow = {
  id: string;
  nickname: string | null;
  coins: number | null;
};

type MatchCorrection = {
  regular_home_score: number;
  regular_away_score: number;
  betting_result: "home" | "draw" | "away";
  final_home_score: number;
  final_away_score: number;
  advancement_winner: "home" | "away";
};

type AuditScope = {
  title: string;
  match: MatchRow;
  marketKey: "advance" | "h2h_90" | "totals_90";
  rule: string;
  predictions: PredictionRow[];
  rows: CompensationRow[];
};

type CompensationRow = {
  scope: string;
  matchId: string;
  matchLabel: string;
  predictionId: string;
  playerId: string;
  nickname: string;
  currentCoins: number;
  marketKey: string;
  selectionKey: string | null;
  selectionLabel: string | null;
  line: number | null;
  stake: number;
  oddsAtPrediction: number;
  oldStatus: string | null;
  newStatus: SettlementStatus;
  oldPayout: number;
  newPayout: number;
  coinDelta: number;
  oldPoints: number;
  newPoints: number;
  pointsDelta: number;
};

const auditableStatuses = new Set([
  "active",
  "won",
  "lost",
  "void",
  "half_win",
  "half_lost",
  "settled",
]);

const australiaEgyptCorrection: MatchCorrection = {
  regular_home_score: 1,
  regular_away_score: 1,
  betting_result: "draw",
  final_home_score: 1,
  final_away_score: 1,
  advancement_winner: "away",
};

const argentinaCapeVerdeCorrection: MatchCorrection = {
  regular_home_score: 1,
  regular_away_score: 1,
  betting_result: "draw",
  final_home_score: 3,
  final_away_score: 2,
  advancement_winner: "home",
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "EGYPT_ARGENTINA_COMPENSATION_AUDIT.md",
);
const matchFieldsSqlPath = path.join(
  process.cwd(),
  "supabase_fix_egypt_argentina_match_fields.sql",
);
const friendlySqlPath = path.join(
  process.cwd(),
  "supabase_fix_egypt_argentina_compensation_friendly.sql",
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

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | null | undefined) {
  return value ? sqlString(value) : "null";
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

function isTeamMatch(match: MatchRow, homeTeam: string, awayTeam: string) {
  return (
    normalizeTeamName(match.home_team) === normalizeTeamName(homeTeam) &&
    normalizeTeamName(match.away_team) === normalizeTeamName(awayTeam)
  );
}

function matchLabel(match: MatchRow) {
  return `${match.home_team} vs ${match.away_team}`;
}

function buildCorrectMatchForSettlement(match: MatchRow, correction: MatchCorrection) {
  return {
    betting_result: correction.betting_result,
    result: match.result,
    regular_home_score: correction.regular_home_score,
    regular_away_score: correction.regular_away_score,
    final_home_score: correction.final_home_score,
    final_away_score: correction.final_away_score,
    advancement_winner: correction.advancement_winner,
  };
}

function calculateH2hOrAdvanceSettlement(
  prediction: PredictionRow,
  match: MatchRow,
  correction: MatchCorrection,
): MarketSettlementResult {
  const settlement = settlePredictionMarket(
    {
      prediction: prediction.prediction,
      market_key: prediction.market_key,
      selection_key: prediction.selection_key,
      line: prediction.line,
      stake: prediction.stake,
      odds_at_prediction: prediction.odds_at_prediction,
    },
    buildCorrectMatchForSettlement(match, correction),
  );

  if (!settlement) {
    return { status: "lost", payout: 0, points: 0 };
  }

  return settlement;
}

function calculateTotalsSettlement(prediction: PredictionRow): MarketSettlementResult {
  if (typeof prediction.line !== "number") {
    return { status: "lost", payout: 0, points: 0 };
  }

  return settleAsianTotal(
    prediction.selection_key ?? prediction.prediction ?? "",
    prediction.line,
    2,
    prediction.stake,
    prediction.odds_at_prediction,
  );
}

function buildCompensationRow(
  params: {
    scope: string;
    match: MatchRow;
    prediction: PredictionRow;
    player: PlayerRow | undefined;
    settlement: MarketSettlementResult;
  },
): CompensationRow {
  const oldPayout = params.prediction.payout ?? 0;
  const oldPoints = params.prediction.points ?? 0;

  return {
    scope: params.scope,
    matchId: params.match.id,
    matchLabel: matchLabel(params.match),
    predictionId: params.prediction.id,
    playerId: params.prediction.player_id,
    nickname: params.player?.nickname ?? "(unknown)",
    currentCoins: params.player?.coins ?? 0,
    marketKey: params.prediction.market_key ?? "h2h_90",
    selectionKey: params.prediction.selection_key,
    selectionLabel: params.prediction.selection_label,
    line: params.prediction.line,
    stake: params.prediction.stake ?? 0,
    oddsAtPrediction: params.prediction.odds_at_prediction ?? 0,
    oldStatus: params.prediction.status,
    newStatus: params.settlement.status,
    oldPayout,
    newPayout: params.settlement.payout,
    coinDelta: params.settlement.payout - oldPayout,
    oldPoints,
    newPoints: params.settlement.points,
    pointsDelta: params.settlement.points - oldPoints,
  };
}

function isAffected(row: CompensationRow) {
  return (
    row.oldStatus !== row.newStatus ||
    row.oldPayout !== row.newPayout ||
    row.oldPoints !== row.newPoints
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item) ?? "null";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function formatCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([key, count]) => `${key}: ${count}`)
    .join(", ");
}

function matchFieldMismatch(match: MatchRow, correction: MatchCorrection) {
  return (
    match.regular_home_score !== correction.regular_home_score ||
    match.regular_away_score !== correction.regular_away_score ||
    match.betting_result !== correction.betting_result ||
    match.final_home_score !== correction.final_home_score ||
    match.final_away_score !== correction.final_away_score ||
    match.advancement_winner !== correction.advancement_winner ||
    match.status !== "finished"
  );
}

function buildMatchUpdateSql(match: MatchRow, correction: MatchCorrection) {
  return [
    `-- ${matchLabel(match)}`,
    "update public.matches",
    "set",
    "  status = 'finished',",
    `  regular_home_score = ${correction.regular_home_score},`,
    `  regular_away_score = ${correction.regular_away_score},`,
    `  betting_result = ${sqlString(correction.betting_result)},`,
    `  final_home_score = ${correction.final_home_score},`,
    `  final_away_score = ${correction.final_away_score},`,
    `  advancement_winner = ${sqlString(correction.advancement_winner)}`,
    `where id = ${sqlString(match.id)}::uuid`,
    `  and home_team = ${sqlString(match.home_team)}`,
    `  and away_team = ${sqlString(match.away_team)};`,
  ].join("\n");
}

function buildMatchFieldsSql(
  australiaEgypt: MatchRow,
  argentinaCapeVerde: MatchRow,
) {
  return [
    "begin;",
    "",
    "-- Fix confirmed 90-minute / final / advancement fields only.",
    "-- This file does not update predictions, players, coins, payout, points, or public.leaderboard.",
    "",
    buildMatchUpdateSql(australiaEgypt, australiaEgyptCorrection),
    "",
    buildMatchUpdateSql(argentinaCapeVerde, argentinaCapeVerdeCorrection),
    "",
    "commit;",
    "",
  ].join("\n");
}

function buildPredictionUpdateSql(rows: CompensationRow[]) {
  if (rows.length === 0) {
    return "-- No affected predictions to update.";
  }

  return rows
    .map((row) =>
      [
        `-- ${row.matchLabel} / ${row.nickname} / ${row.marketKey} / ${row.selectionKey ?? "-"} / ${row.oldStatus ?? "-"} -> ${row.newStatus}`,
        "update public.predictions",
        "set",
        `  status = ${sqlString(row.newStatus)},`,
        `  payout = ${row.newPayout},`,
        `  points = ${row.newPoints},`,
        "  settled_at = now()",
        `where id = ${sqlString(row.predictionId)}::uuid`,
        `  and match_id = ${sqlString(row.matchId)}::uuid;`,
      ].join("\n"),
    )
    .join("\n\n");
}

function buildFriendlyCoinSql(rows: CompensationRow[]) {
  const topUps = rows.filter((row) => row.coinDelta > 0);

  if (topUps.length === 0) {
    return "-- No positive coin compensation required.";
  }

  const values = topUps
    .map(
      (row) =>
        `  (${sqlString(row.playerId)}::uuid, ${sqlString(row.predictionId)}, ${row.coinDelta})`,
    )
    .join(",\n");

  return [
    "with compensation(player_id, prediction_id, amount) as (",
    "  values",
    values,
    "), inserted_transactions as (",
    "  insert into public.coin_transactions (player_id, amount, type, related_id, related_player_id)",
    "  select",
    "    c.player_id,",
    "    c.amount,",
    "    'knockout_rule_compensation',",
    "    c.prediction_id,",
    "    null",
    "  from compensation c",
    "  where not exists (",
    "    select 1",
    "    from public.coin_transactions existing",
    "    where existing.type = 'knockout_rule_compensation'",
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

function buildFriendlySql(
  australiaEgypt: MatchRow,
  argentinaCapeVerde: MatchRow,
  affectedRows: CompensationRow[],
) {
  return [
    "begin;",
    "",
    "-- Friendly compensation for confirmed knockout settlement corrections.",
    "-- Scope is limited to Australia vs Egypt and Argentina vs Cape Verde explicit prediction_id rows.",
    "-- public.leaderboard is a view and must not be updated directly; it refreshes from predictions.points.",
    "",
    buildMatchUpdateSql(australiaEgypt, australiaEgyptCorrection),
    "",
    buildMatchUpdateSql(argentinaCapeVerde, argentinaCapeVerdeCorrection),
    "",
    buildPredictionUpdateSql(affectedRows),
    "",
    "-- Friendly strategy: only top up positive coin_delta; do not deduct overpaid coins.",
    "-- coin_transactions has no description column; use type + related_id for idempotency.",
    buildFriendlyCoinSql(affectedRows),
    "",
    "commit;",
    "",
  ].join("\n");
}

function renderMatchFieldAudit(match: MatchRow, correction: MatchCorrection) {
  return [
    `### ${matchLabel(match)}`,
    "",
    "| Field | Current | Correct | Status |",
    "| --- | --- | --- | --- |",
    `| status | ${match.status ?? "-"} | finished | ${match.status === "finished" ? "ok" : "fix"} |`,
    `| regular_home_score | ${match.regular_home_score ?? "-"} | ${correction.regular_home_score} | ${match.regular_home_score === correction.regular_home_score ? "ok" : "fix"} |`,
    `| regular_away_score | ${match.regular_away_score ?? "-"} | ${correction.regular_away_score} | ${match.regular_away_score === correction.regular_away_score ? "ok" : "fix"} |`,
    `| betting_result | ${match.betting_result ?? "-"} | ${correction.betting_result} | ${match.betting_result === correction.betting_result ? "ok" : "fix"} |`,
    `| final_home_score | ${match.final_home_score ?? "-"} | ${correction.final_home_score} | ${match.final_home_score === correction.final_home_score ? "ok" : "fix"} |`,
    `| final_away_score | ${match.final_away_score ?? "-"} | ${correction.final_away_score} | ${match.final_away_score === correction.final_away_score ? "ok" : "fix"} |`,
    `| advancement_winner | ${match.advancement_winner ?? "-"} | ${correction.advancement_winner} | ${match.advancement_winner === correction.advancement_winner ? "ok" : "fix"} |`,
    "",
    `- match_id: \`${match.id}\``,
    `- legacy score/result: ${match.home_score ?? "-"}-${match.away_score ?? "-"} / ${match.result ?? "-"}`,
    `- needs field fix: ${matchFieldMismatch(match, correction) ? "yes" : "no"}`,
    "",
  ].join("\n");
}

function renderScope(scope: AuditScope) {
  const affected = scope.rows.filter(isAffected);
  const oldStatusCounts = countBy(scope.predictions, (row) => row.status);
  const newStatusCounts = countBy(scope.rows, (row) => row.newStatus);
  const selectionCounts = countBy(
    scope.predictions,
    (row) => row.selection_key ?? row.prediction,
  );

  const lines = [
    `## ${scope.title}`,
    "",
    `- Match: ${matchLabel(scope.match)}`,
    `- Market: \`${scope.marketKey}\``,
    `- Rule: ${scope.rule}`,
    `- Total predictions in market: ${scope.predictions.length}`,
    `- Audited non-cancelled predictions: ${scope.rows.length}`,
    `- Affected predictions: ${affected.length}`,
    `- Selection distribution: ${formatCounts(selectionCounts) || "-"}`,
    `- Old status distribution: ${formatCounts(oldStatusCounts) || "-"}`,
    `- New status distribution: ${formatCounts(newStatusCounts) || "-"}`,
    "",
    "| Nickname | Player ID | Prediction ID | Selection | Line | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of scope.rows) {
    lines.push(
      [
        row.nickname,
        `\`${row.playerId}\``,
        `\`${row.predictionId}\``,
        row.selectionLabel ?? row.selectionKey ?? "-",
        row.line === null ? "-" : String(row.line),
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
      ].join(" | "),
    );
  }

  lines.push("");
  return lines.join("\n");
}

function buildReport(
  australiaEgypt: MatchRow,
  argentinaCapeVerde: MatchRow,
  scopes: AuditScope[],
  affectedRows: CompensationRow[],
) {
  const strictCoinDelta = affectedRows.reduce((sum, row) => sum + row.coinDelta, 0);
  const friendlyTopUp = affectedRows
    .filter((row) => row.coinDelta > 0)
    .reduce((sum, row) => sum + row.coinDelta, 0);
  const pointsDelta = affectedRows.reduce((sum, row) => sum + row.pointsDelta, 0);
  const affectedUsers = new Set(affectedRows.map((row) => row.playerId));
  const negativeCoinRisks = affectedRows.filter(
    (row) => row.currentCoins + row.coinDelta < 0,
  );

  const lines = [
    "# Egypt / Argentina Knockout Compensation Audit",
    "",
    "This is a dry-run report. No database changes were applied.",
    "",
    "## Confirmed Settlement Rules",
    "",
    "- Australia vs Egypt: 90 minutes 1-1, penalty winner Egypt. `advance` settles by `advancement_winner = away`.",
    "- Argentina vs Cape Verde: 90 minutes 1-1, extra-time final 3-2. `h2h_90` settles by `betting_result = draw`.",
    "- Argentina vs Cape Verde: `totals_90` settles by 90-minute total goals only: 1 + 1 = 2.",
    "- Extra-time goals must not be included in `totals_90`.",
    "",
    "## Match Field Audit",
    "",
    renderMatchFieldAudit(australiaEgypt, australiaEgyptCorrection),
    renderMatchFieldAudit(argentinaCapeVerde, argentinaCapeVerdeCorrection),
    ...scopes.map(renderScope),
    "## Summary",
    "",
    `- affected predictions: ${affectedRows.length}`,
    `- affected users: ${affectedUsers.size}`,
    `- total coin_delta strict: ${strictCoinDelta}`,
    `- total friendly compensation amount: ${friendlyTopUp}`,
    `- total points_delta: ${pointsDelta}`,
    `- strict negative coin risk users: ${negativeCoinRisks.length}`,
    "",
  ];

  if (negativeCoinRisks.length > 0) {
    lines.push("### Strict Negative Coin Risks", "");
    for (const row of negativeCoinRisks) {
      lines.push(
        `- ${row.nickname} (${row.playerId}): ${row.currentCoins} + (${row.coinDelta}) = ${row.currentCoins + row.coinDelta}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Generated SQL",
    "",
    `- Match field SQL: \`${path.basename(matchFieldsSqlPath)}\``,
    `- Friendly compensation SQL: \`${path.basename(friendlySqlPath)}\``,
    "",
    "Neither SQL file was executed by this script.",
    "",
    "## Notes",
    "",
    "- Friendly SQL corrects `predictions.status`, `payout`, and `points` for affected prediction IDs.",
    "- Friendly SQL tops up only positive `coin_delta` and does not deduct overpaid coins.",
    "- `coin_transactions` uses `type = 'knockout_rule_compensation'` and `related_id = prediction_id` for idempotency.",
    "- `public.leaderboard` is a view and is not updated directly.",
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
      "id, home_team, away_team, stage, status, home_score, away_score, result, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    );

  if (matchError) {
    throw new Error(`Failed to load matches: ${matchError.message}`);
  }

  const allMatches = (matches ?? []) as MatchRow[];
  const australiaEgypt = allMatches.find((match) =>
    isTeamMatch(match, "Australia", "Egypt"),
  );
  const argentinaCapeVerde = allMatches.find((match) =>
    isTeamMatch(match, "Argentina", "Cape Verde"),
  );

  if (!australiaEgypt) {
    throw new Error("Australia vs Egypt match not found.");
  }

  if (!argentinaCapeVerde) {
    throw new Error("Argentina vs Cape Verde match not found.");
  }

  const matchIds = [australiaEgypt.id, argentinaCapeVerde.id];
  const { data: predictions, error: predictionError } = await supabase
    .from("predictions")
    .select(
      "id, player_id, match_id, prediction, market_key, selection_key, selection_label, line, odds_at_prediction, stake, payout, points, status, settled_at",
    )
    .in("match_id", matchIds);

  if (predictionError) {
    throw new Error(`Failed to load predictions: ${predictionError.message}`);
  }

  const allPredictions = (predictions ?? []) as PredictionRow[];
  const settledPredictions = allPredictions.filter((prediction) =>
    auditableStatuses.has((prediction.status ?? "").toLowerCase()),
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

  const australiaAdvancePredictions = allPredictions.filter(
    (prediction) =>
      prediction.match_id === australiaEgypt.id &&
      prediction.market_key === "advance",
  );
  const argentinaH2hPredictions = allPredictions.filter(
    (prediction) =>
      prediction.match_id === argentinaCapeVerde.id &&
      (prediction.market_key ?? "h2h_90") === "h2h_90",
  );
  const argentinaTotalsPredictions = allPredictions.filter(
    (prediction) =>
      prediction.match_id === argentinaCapeVerde.id &&
      prediction.market_key === "totals_90",
  );

  const buildRows = (
    scope: string,
    match: MatchRow,
    predictionRows: PredictionRow[],
    getSettlement: (prediction: PredictionRow) => MarketSettlementResult,
  ) =>
    predictionRows
      .filter((prediction) =>
        auditableStatuses.has((prediction.status ?? "").toLowerCase()),
      )
      .map((prediction) =>
        buildCompensationRow({
          scope,
          match,
          prediction,
          player: playersById.get(prediction.player_id),
          settlement: getSettlement(prediction),
        }),
      );

  const australiaRows = buildRows(
    "Australia vs Egypt advance",
    australiaEgypt,
    australiaAdvancePredictions,
    (prediction) =>
      calculateH2hOrAdvanceSettlement(
        prediction,
        australiaEgypt,
        australiaEgyptCorrection,
      ),
  );
  const argentinaH2hRows = buildRows(
    "Argentina vs Cape Verde h2h_90",
    argentinaCapeVerde,
    argentinaH2hPredictions,
    (prediction) =>
      calculateH2hOrAdvanceSettlement(
        prediction,
        argentinaCapeVerde,
        argentinaCapeVerdeCorrection,
      ),
  );
  const argentinaTotalsRows = buildRows(
    "Argentina vs Cape Verde totals_90",
    argentinaCapeVerde,
    argentinaTotalsPredictions,
    calculateTotalsSettlement,
  );

  const scopes: AuditScope[] = [
    {
      title: "Australia vs Egypt advance Audit",
      match: australiaEgypt,
      marketKey: "advance",
      rule: "Egypt advanced on penalties, so away_advance = won and home_advance = lost.",
      predictions: australiaAdvancePredictions,
      rows: australiaRows,
    },
    {
      title: "Argentina vs Cape Verde h2h_90 Audit",
      match: argentinaCapeVerde,
      marketKey: "h2h_90",
      rule: "90-minute score was 1-1, so draw = won and home_win / away_win = lost.",
      predictions: argentinaH2hPredictions,
      rows: argentinaH2hRows,
    },
    {
      title: "Argentina vs Cape Verde totals_90 Audit",
      match: argentinaCapeVerde,
      marketKey: "totals_90",
      rule: "90-minute total goals = 2; extra-time goals are excluded.",
      predictions: argentinaTotalsPredictions,
      rows: argentinaTotalsRows,
    },
  ];

  const allRows = [...australiaRows, ...argentinaH2hRows, ...argentinaTotalsRows];
  const affectedRows = allRows.filter(isAffected);

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    buildReport(australiaEgypt, argentinaCapeVerde, scopes, affectedRows),
    "utf8",
  );
  writeFileSync(
    matchFieldsSqlPath,
    buildMatchFieldsSql(australiaEgypt, argentinaCapeVerde),
    "utf8",
  );
  writeFileSync(
    friendlySqlPath,
    buildFriendlySql(australiaEgypt, argentinaCapeVerde, affectedRows),
    "utf8",
  );

  console.log("Egypt / Argentina compensation audit complete.");
  console.log(`Australia vs Egypt match_id: ${australiaEgypt.id}`);
  console.log(`Argentina vs Cape Verde match_id: ${argentinaCapeVerde.id}`);
  console.log(`Affected predictions: ${affectedRows.length}`);
  console.log(
    `Friendly top-up: ${affectedRows
      .filter((row) => row.coinDelta > 0)
      .reduce((sum, row) => sum + row.coinDelta, 0)}`,
  );
  console.log(
    `Points delta: ${affectedRows.reduce((sum, row) => sum + row.pointsDelta, 0)}`,
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Match fields SQL: ${matchFieldsSqlPath}`);
  console.log(`Friendly SQL: ${friendlySqlPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
