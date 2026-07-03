import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { settlePredictionMarket } from "../lib/predictionSettlement.ts";

type MatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  stage: string | null;
  status: string | null;
  result: string | null;
  betting_result: string | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  home_score: number | null;
  away_score: number | null;
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
};

type SettlementPlan = {
  prediction: PredictionRow;
  match: MatchRow;
  status: "won" | "lost" | "void" | "half_win" | "half_lost";
  payout: number;
  points: number;
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "RECENT_FINISHED_MATCHES_SETTLEMENT_DRY_RUN.md",
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

function getMatchForSettlement(match: MatchRow) {
  return {
    betting_result: match.betting_result,
    result: match.result,
    regular_home_score: match.regular_home_score,
    regular_away_score: match.regular_away_score,
    home_score: match.home_score,
    away_score: match.away_score,
    final_home_score: match.final_home_score,
    final_away_score: match.final_away_score,
    advancement_winner: match.advancement_winner,
  };
}

function summarizePlans(plans: SettlementPlan[]) {
  const byMatchMarket = new Map<
    string,
    {
      match: MatchRow;
      marketKey: string;
      activeCount: number;
      won: number;
      lost: number;
      void: number;
      halfWin: number;
      halfLost: number;
      totalPayout: number;
      affectedPlayers: Set<string>;
    }
  >();

  for (const plan of plans) {
    const marketKey = plan.prediction.market_key ?? "h2h_90";
    const key = `${plan.match.id}:${marketKey}`;
    const summary =
      byMatchMarket.get(key) ??
      {
        match: plan.match,
        marketKey,
        activeCount: 0,
        won: 0,
        lost: 0,
        void: 0,
        halfWin: 0,
        halfLost: 0,
        totalPayout: 0,
        affectedPlayers: new Set<string>(),
      };

    summary.activeCount += 1;
    summary.totalPayout += plan.payout;
    summary.affectedPlayers.add(plan.prediction.player_id);

    if (plan.status === "won") summary.won += 1;
    if (plan.status === "lost") summary.lost += 1;
    if (plan.status === "void") summary.void += 1;
    if (plan.status === "half_win") summary.halfWin += 1;
    if (plan.status === "half_lost") summary.halfLost += 1;

    byMatchMarket.set(key, summary);
  }

  return Array.from(byMatchMarket.values());
}

function writeReport(plans: SettlementPlan[], applied: boolean) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const summaries = summarizePlans(plans);
  const lines = [
    "# Recent Finished Matches Settlement Dry Run",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Mode: ${applied ? "apply" : "dry-run"}`,
    "",
    "## Summary",
    "",
    `- predictions to settle: ${plans.length}`,
    `- match/market groups: ${summaries.length}`,
    `- total payout: ${plans.reduce((sum, plan) => sum + plan.payout, 0)}`,
    "",
    "## Match Market Summary",
    "",
    "| match_id | match | market_key | active_count | won | lost | void | half_win | half_lost | total_payout | affected_players |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map((summary) =>
      [
        summary.match.id,
        `${summary.match.home_team} vs ${summary.match.away_team}`,
        summary.marketKey,
        summary.activeCount,
        summary.won,
        summary.lost,
        summary.void,
        summary.halfWin,
        summary.halfLost,
        summary.totalPayout,
        summary.affectedPlayers.size,
      ].join(" | "),
    ).map((line) => `| ${line} |`),
    "",
    "## Notes",
    "",
    "- Only `status = active` predictions are included.",
    "- `h2h_90` uses `betting_result`.",
    "- `totals_90` uses `regular_home_score + regular_away_score`.",
    "- `advance` uses `advancement_winner`; rows with missing `advancement_winner` are skipped.",
    "- This script does not update the `leaderboard` view.",
  ];

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

async function applyPlans(
  supabase: ReturnType<typeof createClient<any>>,
  plans: SettlementPlan[],
) {
  for (const plan of plans) {
    const { error: predictionError } = await supabase
      .from("predictions")
      .update({
        status: plan.status,
        payout: plan.payout,
        points: plan.points,
        settled_at: new Date().toISOString(),
      })
      .eq("id", plan.prediction.id)
      .eq("status", "active");

    if (predictionError) {
      throw new Error(`Failed to update prediction: ${predictionError.message}`);
    }

    if (plan.payout > 0 && (plan.prediction.payout ?? 0) === 0) {
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("coins")
        .eq("id", plan.prediction.player_id)
        .single();

      if (playerError) {
        throw new Error(`Failed to load player: ${playerError.message}`);
      }

      const { error: coinError } = await supabase
        .from("players")
        .update({ coins: (player.coins ?? 0) + plan.payout })
        .eq("id", plan.prediction.player_id);

      if (coinError) {
        throw new Error(`Failed to update player coins: ${coinError.message}`);
      }
    }
  }
}

async function main() {
  loadLocalEnv();

  const apply = process.argv.includes("--apply");
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
      "id, home_team, away_team, stage, status, result, betting_result, regular_home_score, regular_away_score, home_score, away_score, final_home_score, final_away_score, advancement_winner",
    )
    .eq("status", "finished")
    .not("betting_result", "is", null);

  if (matchesError) {
    throw new Error(`Failed to load matches: ${matchesError.message}`);
  }

  const finishedMatches = (matches ?? []) as MatchRow[];
  const matchById = new Map(finishedMatches.map((match) => [match.id, match]));
  const matchIds = finishedMatches.map((match) => match.id);
  let predictions: PredictionRow[] = [];

  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, market_key, selection_key, selection_label, line, odds_at_prediction, stake, payout, points, status",
      )
      .in("match_id", matchIds)
      .eq("status", "active");

    if (error) {
      throw new Error(`Failed to load predictions: ${error.message}`);
    }

    predictions = (data ?? []) as PredictionRow[];
  }

  const plans: SettlementPlan[] = [];

  for (const prediction of predictions) {
    const match = matchById.get(prediction.match_id);
    if (!match) continue;

    const settlement = settlePredictionMarket(
      prediction,
      getMatchForSettlement(match),
    );

    if (!settlement) continue;

    plans.push({
      prediction,
      match,
      status: settlement.status,
      payout: settlement.payout,
      points: settlement.points,
    });
  }

  writeReport(plans, apply);

  if (apply) {
    await applyPlans(supabase, plans);
  }

  const summaries = summarizePlans(plans);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Predictions to settle: ${plans.length}`);
  console.log(`Match/market groups: ${summaries.length}`);
  console.log(`Total payout: ${plans.reduce((sum, plan) => sum + plan.payout, 0)}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
