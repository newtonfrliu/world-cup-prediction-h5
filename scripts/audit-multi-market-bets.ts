import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type PredictionRow = {
  id: string;
  player_id: string;
  match_id: string;
  prediction: string | null;
  market_key: string | null;
  selection_key: string | null;
  line: number | null;
  status: string | null;
  stake: number | null;
  odds_at_prediction: number | null;
  payout: number | null;
  points: number | null;
};

type MarketRow = {
  match_id: string;
  market_key: string;
  selection_key: string;
  selection_label: string;
  odds: number;
  line: number;
  is_active: boolean | null;
  matches?: {
    stage?: string | null;
  } | null;
};

type LeaderboardRow = {
  player_id?: string | null;
  nickname?: string | null;
  total_points?: number | null;
};

const reportPath = path.join(process.cwd(), "docs", "MULTI_MARKET_BETS_AUDIT.md");

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
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
    "knockout",
  ].includes(normalizeStage(stage));
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) return [];
      return walkFiles(fullPath);
    }
    if (/\.(ts|tsx|sql)$/.test(entry)) return [fullPath];
    return [];
  });
}

function scanSourceForLineRisks() {
  const files = [
    ...walkFiles(path.join(process.cwd(), "app")),
    ...walkFiles(path.join(process.cwd(), "lib")),
    ...walkFiles(path.join(process.cwd(), "scripts")),
  ];
  const hardcodedTwoPointFive: string[] = [];
  const quarterFilterRisks: string[] = [];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (/\b2\.5\b/.test(line) && !relative.includes("audit-multi-market-bets")) {
        hardcodedTwoPointFive.push(`${relative}:${index + 1}: ${line.trim()}`);
      }
      if (
        /25|75|quarter|\.0|\.5/.test(line) &&
        /(filter|includes|endsWith|Math\.round|Math\.floor|Math\.ceil)/.test(line) &&
        !relative.includes("audit-multi-market-bets")
      ) {
        quarterFilterRisks.push(`${relative}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  return { hardcodedTwoPointFive, quarterFilterRisks };
}

function expectedTotalsPayout(prediction: PredictionRow) {
  const stake = prediction.stake ?? 0;
  const odds = prediction.odds_at_prediction ?? 0;
  const status = prediction.status;

  if (status === "won") return Math.round(stake * odds);
  if (status === "void") return stake;
  if (status === "half_win") return Math.round((stake / 2) * odds + stake / 2);
  if (status === "half_lost") return Math.round(stake / 2);
  if (status === "lost") return 0;
  return null;
}

function expectedTotalsPoints(prediction: PredictionRow) {
  const odds = prediction.odds_at_prediction ?? 0;
  const status = prediction.status;

  if (status === "won") return Math.round(odds * 100);
  if (status === "half_win") return Math.round(odds * 50);
  if (["lost", "void", "half_lost"].includes(status ?? "")) return 0;
  return null;
}

function buildReport(params: {
  predictions: PredictionRow[];
  markets: MarketRow[];
  leaderboard: LeaderboardRow[];
  sourceRisks: ReturnType<typeof scanSourceForLineRisks>;
}) {
  const predictionsMissingMarketKey = params.predictions.filter((row) => !row.market_key);
  const predictionsMissingSelectionKey = params.predictions.filter((row) => !row.selection_key);
  const oldCompatible = params.predictions.filter(
    (row) => row.market_key === "h2h_90" && row.selection_key === row.prediction,
  );
  const duplicateActiveMarkets = new Map<string, number>();
  const activeMarkets = params.markets.filter((row) => row.is_active !== false);

  for (const market of activeMarkets) {
    const key = `${market.match_id}:${market.market_key}:${market.selection_key}:${market.line}`;
    duplicateActiveMarkets.set(key, (duplicateActiveMarkets.get(key) ?? 0) + 1);
  }

  const duplicateActiveMarketRows = Array.from(duplicateActiveMarkets.entries()).filter(
    ([, count]) => count > 1,
  );
  const advanceInGroup = activeMarkets.filter(
    (row) => row.market_key === "advance" && !isKnockoutStage(row.matches?.stage),
  );
  const totalsWithoutLine = activeMarkets.filter(
    (row) => row.market_key === "totals_90" && typeof row.line !== "number",
  );
  const totalsByMatchLine = new Map<string, MarketRow[]>();

  for (const market of activeMarkets.filter((row) => row.market_key === "totals_90")) {
    const key = `${market.match_id}:${market.line}`;
    const list = totalsByMatchLine.get(key) ?? [];
    list.push(market);
    totalsByMatchLine.set(key, list);
  }

  const incompleteTotalsPairs = Array.from(totalsByMatchLine.entries()).filter(
    ([, rows]) =>
      !rows.some((row) => row.selection_key === "over") ||
      !rows.some((row) => row.selection_key === "under"),
  );
  const totalsPredictionsWithoutLine = params.predictions.filter(
    (row) => row.market_key === "totals_90" && typeof row.line !== "number",
  );
  const badTotalsSettlements = params.predictions.filter((row) => {
    if (row.market_key !== "totals_90") return false;
    const expectedPayout = expectedTotalsPayout(row);
    const expectedPoints = expectedTotalsPoints(row);
    if (expectedPayout === null || expectedPoints === null) return false;
    return row.payout !== expectedPayout || row.points !== expectedPoints;
  });
  const voidProblems = params.predictions.filter(
    (row) =>
      row.status === "void" &&
      ((row.payout ?? 0) !== (row.stake ?? 0) || (row.points ?? 0) !== 0),
  );
  const pointsByPlayer = new Map<string, number>();

  for (const prediction of params.predictions) {
    pointsByPlayer.set(
      prediction.player_id,
      (pointsByPlayer.get(prediction.player_id) ?? 0) + (prediction.points ?? 0),
    );
  }

  const lines = [
    "# Multi-Market Bets Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- predictions total: ${params.predictions.length}`,
    `- predictions missing market_key: ${predictionsMissingMarketKey.length}`,
    `- predictions missing selection_key: ${predictionsMissingSelectionKey.length}`,
    `- h2h_90 legacy-compatible rows: ${oldCompatible.length}`,
    `- active market duplicate option keys: ${duplicateActiveMarketRows.length}`,
    `- advance markets outside knockout: ${advanceInGroup.length}`,
    `- totals_90 active rows without line: ${totalsWithoutLine.length}`,
    `- incomplete totals Over/Under pairs: ${incompleteTotalsPairs.length}`,
    `- totals_90 predictions without line: ${totalsPredictionsWithoutLine.length}`,
    `- totals_90 settlement math issues: ${badTotalsSettlements.length}`,
    `- void payout/points issues: ${voidProblems.length}`,
    `- hardcoded 2.5 source hits: ${params.sourceRisks.hardcodedTwoPointFive.length}`,
    `- quarter-line filter risk source hits: ${params.sourceRisks.quarterFilterRisks.length}`,
    "",
    "## Source Scan",
    "",
    "### Hardcoded 2.5",
    "",
    ...(params.sourceRisks.hardcodedTwoPointFive.length
      ? params.sourceRisks.hardcodedTwoPointFive.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "### Potential .25 / .75 Filter Risks",
    "",
    ...(params.sourceRisks.quarterFilterRisks.length
      ? params.sourceRisks.quarterFilterRisks.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "## Leaderboard Check",
    "",
    "Leaderboard is expected to be a view over `sum(predictions.points)` and must not be updated directly.",
    `- local grouped player count from predictions: ${pointsByPlayer.size}`,
    `- leaderboard rows returned: ${params.leaderboard.length}`,
    "",
  ];

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
  const [predictionResult, marketResult, leaderboardResult] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, market_key, selection_key, line, status, stake, odds_at_prediction, payout, points",
      ),
    supabase
      .from("match_betting_markets")
      .select(
        "match_id, market_key, selection_key, selection_label, odds, line, is_active, matches(stage)",
      ),
    supabase.from("leaderboard").select("*"),
  ]);

  if (predictionResult.error) {
    throw new Error(`Failed to load predictions: ${predictionResult.error.message}`);
  }
  if (marketResult.error) {
    throw new Error(`Failed to load match_betting_markets: ${marketResult.error.message}`);
  }
  if (leaderboardResult.error) {
    throw new Error(`Failed to load leaderboard: ${leaderboardResult.error.message}`);
  }

  const report = buildReport({
    predictions: (predictionResult.data ?? []) as PredictionRow[],
    markets: (marketResult.data ?? []) as unknown as MarketRow[],
    leaderboard: (leaderboardResult.data ?? []) as LeaderboardRow[],
    sourceRisks: scanSourceForLineRisks(),
  });

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
