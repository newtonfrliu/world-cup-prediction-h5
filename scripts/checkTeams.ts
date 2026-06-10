import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type OddsEvent = {
  home_team?: string;
  away_team?: string;
  commence_time?: string;
};

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

  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds",
  );

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`The Odds API error: ${response.status} ${await response.text()}`);
  }

  const events = (await response.json()) as OddsEvent[];

  console.log(`返回赛事数量: ${events.length}`);
  console.log("返回赛事名称:");

  for (const event of events) {
    console.log(`${event.home_team ?? "-"} vs ${event.away_team ?? "-"}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

export {};
