import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type PredictionRow = {
  id: string;
  player_id: string;
  status: string | null;
  odds_at_prediction: number | null;
  points: number | null;
};

type PlayerRow = {
  id: string;
  nickname: string | null;
};

type LeaderboardRow = {
  id: string;
  nickname: string | null;
  country: string | null;
  region: string | null;
  total_points: number | null;
};

const sqlOutputPath = path.join(
  process.cwd(),
  "supabase_fix_prediction_points_and_leaderboard.sql",
);

function loadLocalEnv() {
  const envFilePath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envFilePath)) return;

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

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase();
}

function expectedPoints(prediction: PredictionRow) {
  return normalizeStatus(prediction.status) === "won"
    ? Math.round((prediction.odds_at_prediction ?? 0) * 100)
    : 0;
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient<any>>,
  table: string,
  select: string,
) {
  const pageSize = 1000;
  let from = 0;
  const rows: T[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`);
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function writeFixSql(canUpdateLeaderboardById: boolean) {
  if (!canUpdateLeaderboardById) {
    writeFileSync(
      sqlOutputPath,
      `-- leaderboard.id was not confirmed to equal players.id.
-- Do not apply leaderboard refresh until id mapping is fixed or confirmed.
-- Prediction points repair only:

begin;

update public.predictions
set points = round(coalesce(odds_at_prediction, 0) * 100)
where status = 'won'
  and coalesce(points, 0) <> round(coalesce(odds_at_prediction, 0) * 100);

update public.predictions
set points = 0
where status in ('lost', 'active', 'cancelled')
  and coalesce(points, 0) <> 0;

commit;
`,
      "utf8",
    );
    return;
  }

  writeFileSync(
    sqlOutputPath,
    `begin;

-- Step 1: repair prediction points only.
-- Does not touch coins, payout, stake, or settlement status.
update public.predictions
set points = round(coalesce(odds_at_prediction, 0) * 100)
where status = 'won'
  and coalesce(points, 0) <> round(coalesce(odds_at_prediction, 0) * 100);

update public.predictions
set points = 0
where status in ('lost', 'active', 'cancelled')
  and coalesce(points, 0) <> 0;

-- Step 2: refresh leaderboard totals from repaired predictions.
-- Safe only because leaderboard.id has been confirmed to match players.id.
update public.leaderboard lb
set total_points = coalesce(calc.total_points, 0)
from (
  select
    p.player_id,
    sum(
      case
        when p.status = 'won' then round(coalesce(p.odds_at_prediction, 0) * 100)
        else 0
      end
    ) as total_points
  from public.predictions p
  group by p.player_id
) calc
where lb.id = calc.player_id;

update public.leaderboard lb
set total_points = 0
where not exists (
  select 1
  from public.predictions p
  where p.player_id = lb.id
);

commit;

-- Verification: won predictions with wrong points. Expected 0 rows.
select
  p.id as prediction_id,
  pl.nickname,
  p.status,
  p.odds_at_prediction,
  p.points,
  round(coalesce(p.odds_at_prediction, 0) * 100) as expected_points
from public.predictions p
join public.players pl on pl.id = p.player_id
where p.status = 'won'
  and coalesce(p.points, 0) <> round(coalesce(p.odds_at_prediction, 0) * 100);

-- Verification: non-won predictions with polluted points. Expected 0 rows.
select
  p.id as prediction_id,
  pl.nickname,
  p.status,
  p.points
from public.predictions p
join public.players pl on pl.id = p.player_id
where p.status in ('lost', 'active', 'cancelled')
  and coalesce(p.points, 0) <> 0;

-- Verification: leaderboard diff. Expected every diff = 0.
select
  lb.nickname,
  lb.total_points as leaderboard_points,
  coalesce(calc.expected_points, 0) as expected_points,
  lb.total_points - coalesce(calc.expected_points, 0) as diff
from public.leaderboard lb
left join (
  select
    p.player_id,
    sum(
      case
        when p.status = 'won' then round(coalesce(p.odds_at_prediction, 0) * 100)
        else 0
      end
    ) as expected_points
  from public.predictions p
  group by p.player_id
) calc on calc.player_id = lb.id
order by diff desc;
`,
    "utf8",
  );
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);
  const [predictions, players, leaderboard] = await Promise.all([
    fetchAll<PredictionRow>(
      supabase,
      "predictions",
      "id, player_id, status, odds_at_prediction, points",
    ),
    fetchAll<PlayerRow>(supabase, "players", "id, nickname"),
    fetchAll<LeaderboardRow>(
      supabase,
      "leaderboard",
      "id, nickname, country, region, total_points",
    ),
  ]);

  const playerById = new Map(players.map((player) => [player.id, player]));
  const wonWrongPoints = predictions.filter((prediction) => {
    const status = normalizeStatus(prediction.status);
    return (
      status === "won" &&
      (prediction.points ?? 0) !== expectedPoints(prediction)
    );
  });
  const wonInvalidOdds = predictions.filter((prediction) => {
    const status = normalizeStatus(prediction.status);
    return (
      status === "won" &&
      ((prediction.odds_at_prediction ?? 0) <= 0 ||
        prediction.odds_at_prediction === null)
    );
  });
  const nonWonPollutedPoints = predictions.filter((prediction) => {
    const status = normalizeStatus(prediction.status);
    return (
      (status === "lost" || status === "active" || status === "cancelled") &&
      (prediction.points ?? 0) !== 0
    );
  });

  const pointsByPlayer = new Map<
    string,
    { stored_points: number; expected_points: number }
  >();

  for (const prediction of predictions) {
    const summary =
      pointsByPlayer.get(prediction.player_id) ??
      { stored_points: 0, expected_points: 0 };
    summary.stored_points += prediction.points ?? 0;
    summary.expected_points += expectedPoints(prediction);
    pointsByPlayer.set(prediction.player_id, summary);
  }

  const playerPointDiffs = Array.from(pointsByPlayer.entries())
    .map(([playerId, summary]) => ({
      player_id: playerId,
      nickname: playerById.get(playerId)?.nickname ?? null,
      stored_points: summary.stored_points,
      expected_points: summary.expected_points,
      diff: summary.stored_points - summary.expected_points,
    }))
    .filter((row) => row.diff !== 0)
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));

  const leaderboardJoinPreview = leaderboard.slice(0, 20).map((row) => {
    const player = playerById.get(row.id);
    return {
      leaderboard_id: row.id,
      leaderboard_nickname: row.nickname,
      player_id: player?.id ?? null,
      player_nickname: player?.nickname ?? null,
    };
  });
  const leaderboardRowsMissingPlayer = leaderboard.filter(
    (row) => !playerById.has(row.id),
  );
  const canUpdateLeaderboardById = leaderboardRowsMissingPlayer.length === 0;

  const leaderboardDiffs = leaderboard
    .map((row) => {
      const expected = pointsByPlayer.get(row.id)?.expected_points ?? 0;
      return {
        id: row.id,
        nickname: row.nickname,
        leaderboard_points: row.total_points ?? 0,
        expected_points: expected,
        diff: (row.total_points ?? 0) - expected,
      };
    })
    .filter((row) => row.diff !== 0)
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff));

  writeFixSql(canUpdateLeaderboardById);

  console.log("POINTS_AND_LEADERBOARD_AUDIT", {
    predictionAnomalies: {
      wonWrongPoints: wonWrongPoints.length,
      wonInvalidOdds: wonInvalidOdds.length,
      nonWonPollutedPoints: nonWonPollutedPoints.length,
    },
    samples: {
      wonWrongPoints: wonWrongPoints.slice(0, 10).map((prediction) => ({
        id: prediction.id,
        player_id: prediction.player_id,
        nickname: playerById.get(prediction.player_id)?.nickname ?? null,
        status: prediction.status,
        odds_at_prediction: prediction.odds_at_prediction,
        points: prediction.points,
        expected_points: expectedPoints(prediction),
      })),
      nonWonPollutedPoints: nonWonPollutedPoints.slice(0, 10),
    },
    playerPointDiffs,
    leaderboardIdCheck: {
      canUpdateLeaderboardById,
      missingPlayerCount: leaderboardRowsMissingPlayer.length,
      missingPlayerSamples: leaderboardRowsMissingPlayer.slice(0, 10),
      preview: leaderboardJoinPreview,
    },
    leaderboardDiffs,
    sqlOutputPath,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
