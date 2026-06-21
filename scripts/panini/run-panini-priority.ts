import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SquadPlayer = {
  country: string;
  player_name: string;
  player_name_en: string;
  first_name?: string;
  last_name?: string;
  name_on_shirt?: string;
};

type ProcessedSummary = {
  processed_count: number;
};

type QuotaError = {
  error_type: "quota_exceeded";
  remaining_unstarted: number;
};

type ReviewStatusRecord = {
  status: "pending" | "approved" | "usable_low_quality" | "rejected";
};

type CountrySummary = {
  country: string;
  total_players: number;
  skipped_core: number;
  skipped_existing: number;
  panini_target: number;
  processed: number;
  missing: number;
  pending_review: number;
  not_started_due_to_quota: number;
  error_type?: "quota_exceeded" | "team_failed" | "team_timeout";
  error?: string;
};

const root = process.cwd();
const targetCountries = ["Germany", "France", "Japan"];
const skippedCountries = [
  "Argentina",
  "Portugal",
  "Brazil",
  "Netherlands",
  "Spain",
  "England",
];
const quotaExitCode = 75;
const teamTimeoutMs = 20 * 60 * 1000;

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

function getRosterInfo(country: string) {
  const squadFile = JSON.parse(
    readFileSync(path.join(root, "data", "fifa-2026-squads.json"), "utf8"),
  ) as {
    countries: Array<{ country: string; players: SquadPlayer[] }>;
  };
  const coreCards = JSON.parse(
    readFileSync(path.join(root, "data", "core-cards.json"), "utf8"),
  ) as Record<string, string[]>;
  const squad = squadFile.countries.find((entry) => entry.country === country);

  if (!squad) {
    throw new Error(`${country} squad not found`);
  }

  const coreNames = new Set((coreCards[country] ?? []).map(normalize));
  const targetPlayers = squad.players.filter((player) => {
    const candidates = officialNameCandidates(player);
    return !Array.from(candidates).some((candidate) => coreNames.has(candidate));
  });

  return {
    total_players: squad.players.length,
    skipped_core: squad.players.length - targetPlayers.length,
    panini_target: targetPlayers.length,
    target_players: targetPlayers,
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
      timeout: teamTimeoutMs,
    },
  );

  if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT") {
    return {
      status: 124,
      error_type: "team_timeout" as const,
      error: `${country} exceeded team timeout ${teamTimeoutMs}ms`,
    };
  }

  return {
    status: result.status ?? 0,
  };
}

function countExistingOutputs(country: string, targetPlayers: SquadPlayer[]) {
  const countrySlug = slugify(country);
  const publicRoot = path.join(root, "public", "cards", "panini", countrySlug);

  return targetPlayers.filter((player) => {
    const playerSlug = slugify(player.player_name_en);
    return existsSync(path.join(publicRoot, `${playerSlug}.png`));
  }).length;
}

function readCountrySummary(country: string, options?: { forceQuotaNotStarted?: boolean }): CountrySummary {
  const countrySlug = slugify(country);
  const counts = getRosterInfo(country);
  const processedSummaryPath = path.join(root, "processed", "panini", countrySlug, "processed-summary.json");
  const missingPath = path.join(root, "data", `panini-${countrySlug}-missing.json`);
  const reviewStatusPath = path.join(root, "data", `panini-${countrySlug}-review-status.json`);
  const skippedExistingPath = path.join(root, "data", `panini-${countrySlug}-skipped-existing.json`);
  const quotaPath = path.join(root, "data", `panini-${countrySlug}-quota-error.json`);
  const processedSummary = existsSync(processedSummaryPath)
    ? JSON.parse(readFileSync(processedSummaryPath, "utf8")) as ProcessedSummary
    : null;
  const missing = existsSync(missingPath)
    ? JSON.parse(readFileSync(missingPath, "utf8")) as unknown[]
    : [];
  const reviewStatus = existsSync(reviewStatusPath)
    ? JSON.parse(readFileSync(reviewStatusPath, "utf8")) as ReviewStatusRecord[]
    : [];
  const skippedExistingRecords = existsSync(skippedExistingPath)
    ? JSON.parse(readFileSync(skippedExistingPath, "utf8")) as unknown[]
    : [];
  const quotaError = existsSync(quotaPath)
    ? JSON.parse(readFileSync(quotaPath, "utf8")) as QuotaError
    : null;
  const skippedExisting = options?.forceQuotaNotStarted
    ? countExistingOutputs(country, counts.target_players)
    : skippedExistingRecords.length;
  const processed = quotaError || options?.forceQuotaNotStarted
    ? 0
    : processedSummary?.processed_count ?? 0;
  const missingCount = options?.forceQuotaNotStarted ? 0 : missing.length;
  const notStartedDueToQuota = options?.forceQuotaNotStarted
    ? Math.max(counts.panini_target - skippedExisting, 0)
    : quotaError?.remaining_unstarted ?? 0;

  return {
    country,
    total_players: counts.total_players,
    skipped_core: counts.skipped_core,
    skipped_existing: skippedExisting,
    panini_target: counts.panini_target,
    processed,
    missing: missingCount,
    pending_review: options?.forceQuotaNotStarted ? 0 : reviewStatus.filter((record) => record.status === "pending").length,
    not_started_due_to_quota: notStartedDueToQuota,
    error_type: quotaError || options?.forceQuotaNotStarted ? "quota_exceeded" : undefined,
  };
}

function main() {
  const summaries: CountrySummary[] = [];
  let quotaExceeded = false;
  const outputPath = path.join(root, "data", "panini-priority-summary.json");

  function writeSummary() {
    const totals = summaries.reduce(
      (sum, country) => ({
        processed: sum.processed + country.processed,
        missing: sum.missing + country.missing,
        pending_review: sum.pending_review + country.pending_review,
        skipped_existing: sum.skipped_existing + country.skipped_existing,
        not_started_due_to_quota: sum.not_started_due_to_quota + country.not_started_due_to_quota,
      }),
      { processed: 0, missing: 0, pending_review: 0, skipped_existing: 0, not_started_due_to_quota: 0 },
    );

    writeFileSync(outputPath, `${JSON.stringify({
      generated_at: new Date().toISOString(),
      execution: "priority",
      target_countries: targetCountries,
      skipped_countries: skippedCountries,
      stopped_due_to_quota: quotaExceeded,
      countries: summaries,
      totals,
    }, null, 2)}\n`, "utf8");
  }

  for (const country of targetCountries) {
    console.log(`\n=== Panini priority team flow: ${country} ===`);

    if (quotaExceeded) {
      summaries.push(readCountrySummary(country, {
        forceQuotaNotStarted: true,
      }));
      console.log(`[skip due to quota] ${country}`);
      writeSummary();
      continue;
    }

    try {
      const runResult = runTeam(country);
      const summary = readCountrySummary(country);

      if (runResult.error_type === "team_timeout") {
        summaries.push({
          ...summary,
          error_type: "team_timeout",
          error: runResult.error,
        });
        writeSummary();
        continue;
      }

      if (runResult.status === quotaExitCode || summary.error_type === "quota_exceeded") {
        quotaExceeded = true;
      } else if (runResult.status !== 0) {
        summaries.push({
          ...summary,
          error_type: "team_failed",
          error: `run-panini-team failed with exit code ${runResult.status}`,
        });
        writeSummary();
        continue;
      }

      summaries.push(summary);
      writeSummary();
    } catch (error) {
      const fallback = readCountrySummary(country);

      summaries.push({
        ...fallback,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[${country}] ${error instanceof Error ? error.message : String(error)}`);
      writeSummary();
    }
  }

  writeSummary();
  const finalSummary = JSON.parse(readFileSync(outputPath, "utf8")) as {
    totals: {
      processed: number;
      missing: number;
      pending_review: number;
      skipped_existing: number;
      not_started_due_to_quota: number;
    };
  };
  const { totals } = finalSummary;

  console.log(`\nSummary written: ${path.relative(root, outputPath)}`);
  console.log(`Total processed: ${totals.processed}`);
  console.log(`Total missing: ${totals.missing}`);
  console.log(`Total pending review: ${totals.pending_review}`);
  console.log(`Total skipped existing: ${totals.skipped_existing}`);
  console.log(`Total not started due to quota: ${totals.not_started_due_to_quota}`);
}

main();
