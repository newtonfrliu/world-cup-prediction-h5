import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { syncWorldCupScores } from "../lib/syncScores";

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

async function main() {
  loadLocalEnv();

  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!oddsApiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const result = await syncWorldCupScores({
    oddsApiKey,
    supabaseUrl,
    supabaseAnonKey,
  });

  console.log(
    `Finished ${result.finished} matches, Settled ${result.settled} predictions, Skipped ${result.skipped.length} matches`,
  );

  if (result.skipped.length > 0) {
    console.log("Skipped:");

    for (const match of result.skipped) {
      console.log(`- ${match.home_team} vs ${match.away_team}: ${match.reason}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
