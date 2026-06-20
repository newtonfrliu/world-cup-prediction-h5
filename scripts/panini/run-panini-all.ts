import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ProcessedSummary = {
  total_records: number;
  processed_count: number;
};

type ReviewStatusRecord = {
  status: "pending" | "approved" | "usable_low_quality" | "rejected";
};

type CountrySummary = {
  country: string;
  total_players: number;
  core_skip: number;
  panini_target: number;
  processed: number;
  missing: number;
  pending_review: number;
  output_dir: string;
  review_html: string;
  error?: string;
};

type SquadPlayer = {
  country: string;
  player_name: string;
  player_name_en: string;
  first_name?: string;
  last_name?: string;
  name_on_shirt?: string;
};

const root = process.cwd();
const targetCountries = [
  "Argentina",
  "Portugal",
  "Brazil",
  "Netherlands",
  "Spain",
  "Germany",
  "England",
  "France",
  "Japan",
];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function officialNameCandidates(player: SquadPlayer) {
  const values = new Set<string>();
  const add = (value?: string) => {
    if (value?.trim()) {
      values.add(normalize(value));
    }
  };

  add(player.player_name);
  add(player.player_name_en);
  add(player.name_on_shirt);

  if (player.first_name && player.last_name) {
    add(`${player.first_name} ${player.last_name}`);
    add(`${player.last_name} ${player.first_name}`);
  }

  const englishParts = player.player_name_en.trim().split(/\s+/);
  const firstMixedIndex = englishParts.findIndex((part) => part !== part.toUpperCase());

  if (firstMixedIndex > 0) {
    const lastName = englishParts.slice(0, firstMixedIndex).join(" ");
    const givenName = englishParts.slice(firstMixedIndex).join(" ");
    add(`${givenName} ${lastName}`);
    add(`${lastName} ${givenName}`);
  }

  return values;
}

function getRosterCounts(country: string) {
  const squadPath = path.join(root, "data", "fifa-2026-squads.json");
  const coreCardsPath = path.join(root, "data", "core-cards.json");
  const squadFile = JSON.parse(readFileSync(squadPath, "utf8")) as {
    countries: Array<{ country: string; players: SquadPlayer[] }>;
  };
  const coreCards = JSON.parse(readFileSync(coreCardsPath, "utf8")) as Record<string, string[]>;
  const squad = squadFile.countries.find((entry) => entry.country === country);

  if (!squad) {
    throw new Error(`${country} squad not found in data/fifa-2026-squads.json`);
  }

  const coreNames = new Set((coreCards[country] ?? []).map(normalize));
  const paniniTarget = squad.players.filter((player) => {
    const candidates = officialNameCandidates(player);
    return !Array.from(candidates).some((candidate) => coreNames.has(candidate));
  }).length;

  return {
    total_players: squad.players.length,
    core_skip: squad.players.length - paniniTarget,
    panini_target: paniniTarget,
  };
}

function runTeam(country: string) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "panini", "run-panini-team.ts"), "--country", country],
    {
      cwd: root,
      stdio: "inherit",
      shell: false,
    },
  );

  if (result.status !== 0) {
    throw new Error(`run-panini-team failed with exit code ${result.status ?? 1}`);
  }
}

function readCountrySummary(country: string): CountrySummary {
  const countrySlug = slugify(country);
  const counts = getRosterCounts(country);
  const processedSummaryPath = path.join(root, "processed", "panini", countrySlug, "processed-summary.json");
  const missingPath = path.join(root, "data", `panini-${countrySlug}-missing.json`);
  const reviewStatusPath = path.join(root, "data", `panini-${countrySlug}-review-status.json`);
  const outputDir = `public/cards/panini/${countrySlug}`;
  const reviewHtml = `processed/panini/${countrySlug}/review.html`;
  const processedSummary = existsSync(processedSummaryPath)
    ? JSON.parse(readFileSync(processedSummaryPath, "utf8")) as ProcessedSummary
    : null;
  const missing = existsSync(missingPath)
    ? JSON.parse(readFileSync(missingPath, "utf8")) as unknown[]
    : [];
  const reviewStatus = existsSync(reviewStatusPath)
    ? JSON.parse(readFileSync(reviewStatusPath, "utf8")) as ReviewStatusRecord[]
    : [];

  return {
    country,
    total_players: counts.total_players,
    core_skip: counts.core_skip,
    panini_target: counts.panini_target,
    processed: processedSummary?.processed_count ?? 0,
    missing: missing.length,
    pending_review: reviewStatus.filter((record) => record.status === "pending").length,
    output_dir: outputDir,
    review_html: reviewHtml,
  };
}

function main() {
  const summaries: CountrySummary[] = [];

  for (const country of targetCountries) {
    console.log(`\n=== Panini team flow: ${country} ===`);

    try {
      runTeam(country);
      summaries.push(readCountrySummary(country));
    } catch (error) {
      const fallback = readCountrySummary(country);

      summaries.push({
        ...fallback,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[${country}] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const outputPath = path.join(root, "data", "panini-all-summary.json");

  writeFileSync(outputPath, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    execution: "sequential",
    countries: summaries,
  }, null, 2)}\n`, "utf8");

  console.log(`\nSummary written: ${path.relative(root, outputPath)}`);
}

main();
