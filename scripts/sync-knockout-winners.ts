import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type MatchRow = {
  id: string;
  match_number: number | null;
  stage: string | null;
  home_team: string;
  away_team: string;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  betting_result: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  advancement_winner: string | null;
};

type RoundOf16Update = {
  matchNumber: number;
  sourceHomeMatch: number;
  sourceAwayMatch: number;
  oldHomeTeam: string;
  oldAwayTeam: string;
  newHomeTeam: string;
  newAwayTeam: string;
  status: string | null;
  updated: boolean;
  reason: string;
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "KNOCKOUT_TEAM_SYNC_AUDIT.md",
);

const roundOf32ExpectedPairs: Record<number, [string, string]> = {
  73: ["South Africa", "Canada"],
  74: ["Germany", "Paraguay"],
  75: ["Netherlands", "Morocco"],
  76: ["Brazil", "Japan"],
  77: ["France", "Sweden"],
  78: ["Ivory Coast", "Norway"],
  79: ["Mexico", "Ecuador"],
  80: ["England", "DR Congo"],
  81: ["Argentina", "Cape Verde"],
  82: ["Australia", "Egypt"],
  83: ["Switzerland", "Algeria"],
  84: ["Colombia", "Ghana"],
  85: ["Belgium", "Senegal"],
  86: ["USA", "Bosnia & Herzegovina"],
  87: ["Portugal", "Croatia"],
  88: ["Spain", "Austria"],
};

const roundOf16Mapping: Record<number, [number, number]> = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [87, 88],
  96: [86, 85],
};

const roundOf16KnownPairs: Record<number, Array<[string, string]>> = {
  89: [["Paraguay", "France"]],
  90: [["Canada", "Morocco"]],
  91: [["Brazil", "Norway"]],
  92: [["Mexico", "England"]],
  93: [["Switzerland", "Colombia"]],
  94: [["Argentina", "Egypt"]],
  95: [
    ["Portugal", "Spain"],
    ["USA", "Spain"],
  ],
  96: [
    ["USA", "Belgium"],
    ["Belgium", "Portugal"],
  ],
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
    const value = trimmed.slice(separator + 1).trim();
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

function normalizePair(homeTeam: string, awayTeam: string) {
  return `${normalizeTeamName(homeTeam)}__${normalizeTeamName(awayTeam)}`;
}

function isPlaceholderTeam(value: string) {
  const normalized = normalizeTeamName(value);
  return (
    /^match\s+\d+\s+winners?$/.test(normalized) ||
    /^winner of\s+match\s+\d+$/.test(normalized) ||
    normalized === "tbd"
  );
}

function inferRoundOf32MatchNumber(match: MatchRow) {
  if (
    match.match_number &&
    match.match_number >= 73 &&
    match.match_number <= 88
  ) {
    return match.match_number;
  }

  const currentPair = normalizePair(match.home_team, match.away_team);
  const inferred = Object.entries(roundOf32ExpectedPairs).find(
    ([, [homeTeam, awayTeam]]) =>
      normalizePair(homeTeam, awayTeam) === currentPair,
  );

  return inferred ? Number(inferred[0]) : null;
}

function inferRoundOf16MatchNumber(match: MatchRow) {
  if (
    match.match_number &&
    match.match_number >= 89 &&
    match.match_number <= 96
  ) {
    return match.match_number;
  }

  const homeMatch = match.home_team.match(/match\s+(\d+)\s+winners?/i);
  const awayMatch = match.away_team.match(/match\s+(\d+)\s+winners?/i);

  if (!homeMatch || !awayMatch) {
    const currentPair = normalizePair(match.home_team, match.away_team);
    const inferred = Object.entries(roundOf16KnownPairs).find(([, pairs]) =>
      pairs.some(([homeTeam, awayTeam]) => normalizePair(homeTeam, awayTeam) === currentPair),
    );

    return inferred ? Number(inferred[0]) : null;
  }

  const sourcePair = [Number(homeMatch[1]), Number(awayMatch[1])];
  const inferred = Object.entries(roundOf16Mapping).find(
    ([, [homeSource, awaySource]]) =>
      homeSource === sourcePair[0] && awaySource === sourcePair[1],
  );

  return inferred ? Number(inferred[0]) : null;
}

function getWinnerTeam(match: MatchRow) {
  if (match.advancement_winner === "home") return match.home_team;
  if (match.advancement_winner === "away") return match.away_team;
  return null;
}

function writeReport({
  roundOf32Rows,
  updates,
  missingAdvancement,
  remainingPlaceholders,
  applied,
}: {
  roundOf32Rows: Array<MatchRow & { inferredMatchNumber: number | null }>;
  updates: RoundOf16Update[];
  missingAdvancement: Array<MatchRow & { inferredMatchNumber: number | null }>;
  remainingPlaceholders: MatchRow[];
  applied: boolean;
}) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    "# Knockout Team Sync Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Mode: ${applied ? "apply" : "dry-run"}`,
    "",
    "## Summary",
    "",
    `- round_of_32 matches: ${roundOf32Rows.length}`,
    `- missing advancement_winner: ${missingAdvancement.length}`,
    `- round_of_16 update plans: ${updates.length}`,
    `- remaining placeholders after plan: ${remainingPlaceholders.length}`,
    "",
    "## Round Of 32 Winners",
    "",
    "| match | home | away | status | score | advancement_winner | winner_team |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...roundOf32Rows.map((match) =>
      [
        match.inferredMatchNumber ? `M${match.inferredMatchNumber}` : "-",
        match.home_team,
        match.away_team,
        match.status ?? "-",
        `${match.home_score ?? "-"}:${match.away_score ?? "-"}`,
        match.advancement_winner ?? "-",
        getWinnerTeam(match) ?? "-",
      ].join(" | "),
    ).map((line) => `| ${line} |`),
    "",
    "## Missing Advancement Winner",
    "",
    missingAdvancement.length === 0
      ? "- none"
      : missingAdvancement
          .map(
            (match) =>
              `- M${match.inferredMatchNumber ?? "?"}: ${match.home_team} vs ${match.away_team}`,
          )
          .join("\n"),
    "",
    "## Round Of 16 Updates",
    "",
    "| match | old home | old away | new home | new away | updated | reason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...updates.map((update) =>
      [
        `M${update.matchNumber}`,
        update.oldHomeTeam,
        update.oldAwayTeam,
        update.newHomeTeam,
        update.newAwayTeam,
        update.updated ? "yes" : "no",
        update.reason,
      ].join(" | "),
    ).map((line) => `| ${line} |`),
    "",
    "## Placeholder Check",
    "",
    remainingPlaceholders.length === 0
      ? "- no placeholders found in round_of_16"
      : remainingPlaceholders
          .map((match) => `- ${match.home_team} vs ${match.away_team}`)
          .join("\n"),
  ];

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
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
  const { data: roundOf32, error: r32Error } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .eq("stage", "round_of_32");

  if (r32Error) {
    throw new Error(`Failed to load round_of_32: ${r32Error.message}`);
  }

  const roundOf32Rows = ((roundOf32 ?? []) as MatchRow[])
    .map((match) => ({
      ...match,
      inferredMatchNumber: inferRoundOf32MatchNumber(match),
    }))
    .sort((left, right) => (left.inferredMatchNumber ?? 999) - (right.inferredMatchNumber ?? 999));
  const missingAdvancement = roundOf32Rows.filter(
    (match) =>
      match.status !== "finished" ||
      match.inferredMatchNumber === null ||
      (match.advancement_winner !== "home" &&
        match.advancement_winner !== "away"),
  );

  const { data: roundOf16, error: r16Error } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .eq("stage", "round_of_16");

  if (r16Error) {
    throw new Error(`Failed to load round_of_16: ${r16Error.message}`);
  }

  const roundOf16Rows = ((roundOf16 ?? []) as MatchRow[]).map((match) => ({
    ...match,
    inferredMatchNumber: inferRoundOf16MatchNumber(match),
  }));
  const winnersByMatch = new Map<number, string>();

  for (const match of roundOf32Rows) {
    if (!match.inferredMatchNumber) continue;
    const winner = getWinnerTeam(match);
    if (winner) winnersByMatch.set(match.inferredMatchNumber, winner);
  }

  const updates: RoundOf16Update[] = [];

  if (missingAdvancement.length === 0) {
    for (const [matchNumberText, [sourceHomeMatch, sourceAwayMatch]] of Object.entries(
      roundOf16Mapping,
    )) {
      const matchNumber = Number(matchNumberText);
      const target = roundOf16Rows.find(
        (match) => match.inferredMatchNumber === matchNumber,
      );
      const newHomeTeam = winnersByMatch.get(sourceHomeMatch);
      const newAwayTeam = winnersByMatch.get(sourceAwayMatch);

      if (!target || !newHomeTeam || !newAwayTeam) {
        updates.push({
          matchNumber,
          sourceHomeMatch,
          sourceAwayMatch,
          oldHomeTeam: target?.home_team ?? "-",
          oldAwayTeam: target?.away_team ?? "-",
          newHomeTeam: newHomeTeam ?? "-",
          newAwayTeam: newAwayTeam ?? "-",
          status: target?.status ?? null,
          updated: false,
          reason: "missing target row or source winner",
        });
        continue;
      }

      const canUpdate =
        target.status === null ||
        target.status === "scheduled" ||
        target.status === "not_started" ||
        target.status === "open";

      if (apply && canUpdate) {
        const { error } = await supabase
          .from("matches")
          .update({
            home_team: newHomeTeam,
            away_team: newAwayTeam,
          })
          .eq("id", target.id);

        if (error) {
          throw new Error(`Failed to update M${matchNumber}: ${error.message}`);
        }
      }

      updates.push({
        matchNumber,
        sourceHomeMatch,
        sourceAwayMatch,
        oldHomeTeam: target.home_team,
        oldAwayTeam: target.away_team,
        newHomeTeam,
        newAwayTeam,
        status: target.status,
        updated: apply && canUpdate,
        reason: canUpdate
          ? apply
            ? "updated"
            : "dry-run"
          : `skipped because status=${target.status ?? "null"}`,
      });
    }
  }

  const remainingPlaceholders = roundOf16Rows.filter(
    (match) => isPlaceholderTeam(match.home_team) || isPlaceholderTeam(match.away_team),
  );

  writeReport({
    roundOf32Rows,
    updates,
    missingAdvancement,
    remainingPlaceholders,
    applied: apply,
  });

  if (missingAdvancement.length > 0) {
    console.log("Missing round_of_32 advancement_winner. Refusing to sync round_of_16.");
    for (const match of missingAdvancement) {
      console.log(
        `- M${match.inferredMatchNumber ?? "?"}: ${match.home_team} vs ${match.away_team}`,
      );
    }
    console.log(`Report: ${reportPath}`);
    return;
  }

  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Round of 16 update plans: ${updates.length}`);
  console.log(`Updated: ${updates.filter((update) => update.updated).length}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
