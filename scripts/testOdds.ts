import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

loadLocalEnv();

const oddsApiKey = process.env.ODDS_API_KEY;

if (!oddsApiKey) {
  console.error("ODDS_API_KEY not found");
  process.exit(1);
}

const maskedKey = `${oddsApiKey.slice(0, 6)}...${oddsApiKey.slice(-4)}`;

console.log("ODDS_API_KEY loaded");
console.log(maskedKey);

export {};
