import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  calculateSettlementPayout,
  calculateSettlementPoints,
  getPredictionSettlementStatus,
  isPredictionHit,
} from "../lib/predictionSettlement.ts";

type MatchRow = {
  id: string;
  status: string | null;
  result: string | null;
  betting_result: string | null;
  stage: string | null;
  home_team: string | null;
  away_team: string | null;
};

type PredictionRow = {
  id: string;
  player_id: string;
  match_id: string;
  prediction: string | null;
  odds_at_prediction: number | null;
  stake: number | null;
  payout: number | null;
  points: number | null;
  status: string | null;
  settled_at: string | null;
  matches: MatchRow | MatchRow[] | null;
};

type SettlementPlan = {
  prediction: PredictionRow;
  match: MatchRow;
  status: "won" | "lost";
  points: number;
  payout: number;
};

const sqlOutputPath = path.join(
  process.cwd(),
  "supabase_backfill_prediction_settlement.sql",
);

function loadLocalEnv() {
  const envFilePath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envFilePath)) {
    return;
  }

  const envText = readFileSync(envFilePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getMatch(prediction: PredictionRow) {
  const match = Array.isArray(prediction.matches)
    ? prediction.matches[0]
    : prediction.matches;

  return match ?? null;
}

async function fetchAllPredictions(
  supabase: ReturnType<typeof createClient<any>>,
) {
  const pageSize = 1000;
  let from = 0;
  const rows: PredictionRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, points, status, settled_at, matches!inner(id, status, result, betting_result, stage, home_team, away_team)",
      )
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load predictions: ${error.message}`);
    }

    const page = (data ?? []) as unknown as PredictionRow[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function buildSettlementPlans(rows: PredictionRow[]) {
  const plans: SettlementPlan[] = [];

  for (const prediction of rows) {
    const match = getMatch(prediction);

    if (
      prediction.status !== "active" ||
      match?.status !== "finished" ||
      !(match.betting_result ?? match.result)
    ) {
      continue;
    }

    const settlementResult = {
      betting_result: match.betting_result,
      result: match.result,
    };
    const hit = isPredictionHit(prediction.prediction, settlementResult);
    plans.push({
      prediction,
      match,
      status: getPredictionSettlementStatus(
        prediction.prediction,
        settlementResult,
      ),
      points: calculateSettlementPoints(prediction.odds_at_prediction, hit),
      payout: calculateSettlementPayout(
        prediction.stake,
        prediction.odds_at_prediction,
        hit,
      ),
    });
  }

  return plans;
}

function countByStatusAndMatch(rows: PredictionRow[]) {
  const counts = {
    activeFinished: 0,
    activeScheduled: 0,
    cancelled: 0,
    alreadyWon: 0,
    alreadyLost: 0,
    other: 0,
  };

  for (const prediction of rows) {
    const status = prediction.status ?? "null";
    const match = getMatch(prediction);

    if (status === "active" && match?.status === "finished") {
      counts.activeFinished += 1;
    } else if (status === "active" && match?.status !== "finished") {
      counts.activeScheduled += 1;
    } else if (status === "cancelled") {
      counts.cancelled += 1;
    } else if (status === "won") {
      counts.alreadyWon += 1;
    } else if (status === "lost") {
      counts.alreadyLost += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

function summarizePlans(plans: SettlementPlan[]) {
  const byPlayer = new Map<
    string,
    { payout: number; won: number; lost: number; total: number }
  >();

  for (const plan of plans) {
    const summary =
      byPlayer.get(plan.prediction.player_id) ??
      { payout: 0, won: 0, lost: 0, total: 0 };

    summary.payout += plan.payout;
    summary.total += 1;
    if (plan.status === "won") summary.won += 1;
    else summary.lost += 1;

    byPlayer.set(plan.prediction.player_id, summary);
  }

  return Array.from(byPlayer.entries()).map(([playerId, summary]) => ({
    playerId,
    ...summary,
  }));
}

function writeSqlFallback() {
  const sql = `begin;

with candidates as (
  select
    p.id,
    p.player_id,
    p.prediction,
    coalesce(p.stake, 0) as stake,
    coalesce(p.odds_at_prediction, 0) as odds_at_prediction,
    coalesce(m.betting_result, m.result) as settlement_result
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where p.status = 'active'
    and m.status = 'finished'
    and coalesce(m.betting_result, m.result) is not null
),
settled as (
  select
    id,
    player_id,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when settlement_result in ('home_win', 'home') then 'home'
          when settlement_result in ('away_win', 'away') then 'away'
          when settlement_result = 'draw' then 'draw'
          else settlement_result
        end
      then 'won'
      else 'lost'
    end as next_status,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when settlement_result in ('home_win', 'home') then 'home'
          when settlement_result in ('away_win', 'away') then 'away'
          when settlement_result = 'draw' then 'draw'
          else settlement_result
        end
      then round(odds_at_prediction * 100)::integer
      else 0
    end as next_points,
    case
      when
        case
          when prediction in ('home_win', 'home') then 'home'
          when prediction in ('away_win', 'away') then 'away'
          when prediction = 'draw' then 'draw'
          else prediction
        end
        =
        case
          when settlement_result in ('home_win', 'home') then 'home'
          when settlement_result in ('away_win', 'away') then 'away'
          when settlement_result = 'draw' then 'draw'
          else settlement_result
        end
      then round(stake * odds_at_prediction)::integer
      else 0
    end as next_payout
  from candidates
),
updated_predictions as (
  update public.predictions p
  set
    status = s.next_status,
    points = s.next_points,
    payout = s.next_payout,
    settled_at = now()
  from settled s
  where p.id = s.id
    and p.status = 'active'
  returning p.player_id, p.payout
),
player_payouts as (
  select player_id, sum(payout)::integer as total_payout
  from updated_predictions
  where payout > 0
  group by player_id
)
update public.players pl
set coins = coalesce(pl.coins, 1000) + pp.total_payout
from player_payouts pp
where pl.id = pp.player_id;

commit;
`;

  writeFileSync(sqlOutputPath, sql, "utf8");
}

async function applyPlans(
  supabase: ReturnType<typeof createClient<any>>,
  plans: SettlementPlan[],
) {
  const playerPayouts = new Map<string, number>();

  for (const plan of plans) {
    const { error } = await supabase
      .from("predictions")
      .update({
        status: plan.status,
        points: plan.points,
        payout: plan.payout,
        settled_at: new Date().toISOString(),
      })
      .eq("id", plan.prediction.id)
      .eq("status", "active");

    if (error) {
      throw new Error(
        `Failed to update prediction ${plan.prediction.id}: ${error.message}`,
      );
    }

    if (plan.payout > 0) {
      playerPayouts.set(
        plan.prediction.player_id,
        (playerPayouts.get(plan.prediction.player_id) ?? 0) + plan.payout,
      );
    }
  }

  for (const [playerId, payout] of playerPayouts.entries()) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("coins")
      .eq("id", playerId)
      .single();

    if (playerError) {
      throw new Error(`Failed to load player ${playerId}: ${playerError.message}`);
    }

    const { error: updateError } = await supabase
      .from("players")
      .update({ coins: (player.coins ?? 1000) + payout })
      .eq("id", playerId);

    if (updateError) {
      throw new Error(
        `Failed to update player coins ${playerId}: ${updateError.message}`,
      );
    }
  }
}

async function main() {
  loadLocalEnv();

  const apply = process.argv.includes("--apply");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const key = apply ? serviceRoleKey : anonKey;

  if (apply && !serviceRoleKey) {
    writeSqlFallback();
    console.log("SUPABASE_SERVICE_ROLE_KEY missing.");
    console.log(`Generated SQL fallback: ${sqlOutputPath}`);
    console.log("Run dry-run without --apply to inspect counts.");
    return;
  }

  const supabase = createClient<any>(supabaseUrl, key ?? anonKey);
  const rows = await fetchAllPredictions(supabase);
  const plans = buildSettlementPlans(rows);
  const counts = countByStatusAndMatch(rows);
  const byPlayer = summarizePlans(plans);

  console.log("BACKFILL_PREDICTION_SETTLEMENT_DRY_RUN", {
    mode: apply ? "apply" : "dry-run",
    activeFinishedTotal: plans.length,
    willBecomeWon: plans.filter((plan) => plan.status === "won").length,
    willBecomeLost: plans.filter((plan) => plan.status === "lost").length,
    playerPayouts: byPlayer.map((row) => ({
      playerId: row.playerId,
      payout: row.payout,
    })),
    playerStatusChanges: byPlayer.map((row) => ({
      playerId: row.playerId,
      total: row.total,
      won: row.won,
      lost: row.lost,
    })),
    activeScheduledNotProcessed: counts.activeScheduled,
    cancelledNotProcessed: counts.cancelled,
    alreadyWonNotProcessed: counts.alreadyWon,
    alreadyLostNotProcessed: counts.alreadyLost,
    otherNotProcessed: counts.other,
  });

  if (!apply) {
    writeSqlFallback();
    console.log(`SQL fallback refreshed: ${sqlOutputPath}`);
    return;
  }

  await applyPlans(supabase, plans);
  console.log(`Applied prediction settlement backfill: ${plans.length} rows.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
