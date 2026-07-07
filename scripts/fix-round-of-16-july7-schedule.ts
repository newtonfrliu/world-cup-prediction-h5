import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type MatchRow = {
  id: string;
  match_number: number | null;
  stage: string | null;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string | null;
};

type FixtureKey = "switzerland-colombia" | "argentina-egypt";

const fixtureTargets: Record<FixtureKey, [string, string]> = {
  "switzerland-colombia": ["Switzerland", "Colombia"],
  "argentina-egypt": ["Argentina", "Egypt"],
};

const correctStartTimes: Record<FixtureKey, string> = {
  "argentina-egypt": "2026-07-07T16:00:00+00:00",
  "switzerland-colombia": "2026-07-07T20:00:00+00:00",
};

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

function normalizeTeamName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
}

function isFixture(match: MatchRow, [home, away]: [string, string]) {
  return (
    normalizeTeamName(match.home_team) === normalizeTeamName(home) &&
    normalizeTeamName(match.away_team) === normalizeTeamName(away)
  );
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
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_number, stage, home_team, away_team, start_time, status")
    .eq("stage", "round_of_16")
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to load round_of_16 matches: ${error.message}`);
  }

  const rows = (data ?? []) as MatchRow[];
  const byFixture = new Map<FixtureKey, MatchRow>();

  for (const [key, pair] of Object.entries(fixtureTargets) as Array<
    [FixtureKey, [string, string]]
  >) {
    const match = rows.find((row) => isFixture(row, pair));
    if (!match) {
      throw new Error(`Missing fixture: ${pair[0]} vs ${pair[1]}`);
    }
    byFixture.set(key, match);
  }

  const sourceArgentinaEgypt = byFixture.get("argentina-egypt")!;
  const sourceSwitzerlandColombia = byFixture.get("switzerland-colombia")!;
  const updates = [
    {
      match: sourceArgentinaEgypt,
      newStartTime: correctStartTimes["argentina-egypt"],
      reason: "Argentina vs Egypt should occupy the first July 8 slot.",
    },
    {
      match: sourceSwitzerlandColombia,
      newStartTime: correctStartTimes["switzerland-colombia"],
      reason: "Switzerland vs Colombia should occupy the second July 8 slot.",
    },
  ];

  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log("Round of 16 July 7 schedule correction:");

  for (const update of updates) {
    console.log(
      `- ${update.match.home_team} vs ${update.match.away_team}: ${update.match.start_time} (${formatShanghaiTime(
        update.match.start_time,
      )}) -> ${update.newStartTime} (${formatShanghaiTime(update.newStartTime)})`,
    );
    console.log(`  ${update.reason}`);
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write matches.start_time.");
    return;
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({ start_time: update.newStartTime })
      .eq("id", update.match.id);

    if (updateError) {
      throw new Error(
        `Failed to update ${update.match.home_team} vs ${update.match.away_team}: ${updateError.message}`,
      );
    }
  }

  const { data: updatedRows, error: reloadError } = await supabase
    .from("matches")
    .select("home_team, away_team, start_time, status")
    .eq("stage", "round_of_16")
    .order("start_time", { ascending: true });

  if (reloadError) {
    throw new Error(`Failed to reload round_of_16 matches: ${reloadError.message}`);
  }

  console.log("Updated round_of_16 schedule:");
  for (const row of (updatedRows ?? []) as Pick<
    MatchRow,
    "home_team" | "away_team" | "start_time" | "status"
  >[]) {
    console.log(
      `- ${formatShanghaiTime(row.start_time)} ${row.home_team} vs ${row.away_team} (${row.status ?? "-"})`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
