import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  formatStanding,
  syncKnockoutTeams,
  type RoundOf32Update,
  type TeamStanding,
} from "../lib/syncKnockoutTeams.ts";
import { GROUP_LETTERS } from "../lib/world-cup-2026-third-place-map.ts";
import type { GroupLetter } from "../lib/world-cup-2026-third-place-map.ts";

const envFilePath = path.join(process.cwd(), ".env.local");

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
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getMode() {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function printDryRun({
  standingsByGroup,
  bestThirds,
  combinationKey,
  updates,
}: {
  standingsByGroup: Record<GroupLetter, TeamStanding[]>;
  bestThirds: TeamStanding[];
  combinationKey: string;
  updates: RoundOf32Update[];
}) {
  console.log("Group rankings:");

  for (const group of GROUP_LETTERS) {
    console.log(
      `${group}: ${standingsByGroup[group]
        .map((standing, index) => `${index + 1}. ${formatStanding(standing)}`)
        .join(" | ")}`,
    );
  }

  console.log("");
  console.log(
    `Best third groups (${bestThirds.length}/8): ${bestThirds
      .map((standing) => `${standing.group}:${formatStanding(standing)}`)
      .join(" | ")}`,
  );
  console.log(`Annex C combination key: ${combinationKey}`);
  console.log("");
  console.log("Round of 32 updates:");

  for (const update of updates) {
    console.log(
      `M${update.matchNumber}: ${update.previousHomeTeam} vs ${update.previousAwayTeam} -> ${update.homeTeam} vs ${update.awayTeam}`,
    );
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const mode = getMode();
  const result = await syncKnockoutTeams({
    supabaseUrl,
    supabaseAnonKey,
    apply: mode === "apply",
  });

  if (result.skipped) {
    console.log(result.message);
    return;
  }

  printDryRun(result);

  if (mode !== "apply") {
    console.log("");
    console.log("Dry-run only. Re-run with --apply to update Supabase.");
    return;
  }

  console.log("");
  console.log(
    `Applied ${result.updated} round-of-32 team updates. home_team_zh/away_team_zh ${
      result.zhColumnsUpdated
        ? "were updated"
        : "were skipped because columns are missing"
    }.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

export {};
