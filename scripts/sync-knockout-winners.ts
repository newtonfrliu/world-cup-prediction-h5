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
  start_time: string | null;
  home_score: number | null;
  away_score: number | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  betting_result: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  advancement_winner: string | null;
};

type InferredMatch = MatchRow & {
  inferredMatchNumber: number | null;
};

type RoundUpdate = {
  roundLabel: string;
  targetStage: string;
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

const roundOf16KnownPairs: Record<number, Array<[string, string]>> = {
  89: [["Paraguay", "France"]],
  90: [["Canada", "Morocco"]],
  91: [["Brazil", "Norway"]],
  92: [["Mexico", "England"]],
  93: [["Argentina", "Egypt"]],
  94: [["Switzerland", "Colombia"]],
  95: [["Portugal", "Spain"]],
  96: [["USA", "Belgium"]],
};

const progressionMappings: Array<{
  sourceLabel: string;
  sourceStage: string;
  targetLabel: string;
  targetStage: string;
  rules: Record<number, [number, number]>;
}> = [
  {
    sourceLabel: "Round Of 32",
    sourceStage: "round_of_32",
    targetLabel: "Round Of 16",
    targetStage: "round_of_16",
    rules: {
      89: [74, 77],
      90: [73, 75],
      91: [76, 78],
      92: [79, 80],
      93: [81, 82],
      94: [83, 84],
      95: [87, 88],
      96: [86, 85],
    },
  },
  {
    sourceLabel: "Round Of 16",
    sourceStage: "round_of_16",
    targetLabel: "Quarter Finals",
    targetStage: "quarter_final",
    rules: {
      97: [89, 90],
      98: [93, 94],
      99: [91, 92],
      100: [95, 96],
    },
  },
  {
    sourceLabel: "Quarter Finals",
    sourceStage: "quarter_final",
    targetLabel: "Semi Finals",
    targetStage: "semi_final",
    rules: {
      101: [97, 98],
      102: [99, 100],
    },
  },
  {
    sourceLabel: "Semi Finals",
    sourceStage: "semi_final",
    targetLabel: "Final / Third Place",
    targetStage: "final",
    rules: {
      104: [101, 102],
    },
  },
];

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

function normalizePair(homeTeam: string, awayTeam: string) {
  return `${normalizeTeamName(homeTeam)}__${normalizeTeamName(awayTeam)}`;
}

function normalizeStage(stage: string | null | undefined) {
  return (stage ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isStage(match: MatchRow, stage: string) {
  const normalized = normalizeStage(match.stage);

  if (stage === "quarter_final") {
    return normalized === "quarter_final" || normalized === "quarter_finals";
  }

  if (stage === "semi_final") {
    return normalized === "semi_final" || normalized === "semi_finals";
  }

  return normalized === stage;
}

function isPlaceholderTeam(value: string) {
  const normalized = normalizeTeamName(value);
  return (
    /^match\s+\d+\s+winners?$/.test(normalized) ||
    /^winner of\s+match\s+\d+$/.test(normalized) ||
    normalized === "tbd"
  );
}

function getWinnerTeam(match: MatchRow) {
  if (match.advancement_winner === "home") return match.home_team;
  if (match.advancement_winner === "away") return match.away_team;
  return null;
}

function inferMatchNumber(match: MatchRow) {
  if (match.match_number) return match.match_number;

  const currentPair = normalizePair(match.home_team, match.away_team);
  const fromRoundOf32 = Object.entries(roundOf32ExpectedPairs).find(
    ([, [homeTeam, awayTeam]]) =>
      normalizePair(homeTeam, awayTeam) === currentPair,
  );

  if (fromRoundOf32) return Number(fromRoundOf32[0]);

  const fromRoundOf16 = Object.entries(roundOf16KnownPairs).find(([, pairs]) =>
    pairs.some(
      ([homeTeam, awayTeam]) => normalizePair(homeTeam, awayTeam) === currentPair,
    ),
  );

  if (fromRoundOf16) return Number(fromRoundOf16[0]);

  const homeWinner = match.home_team.match(/match\s+(\d+)\s+winners?/i);
  const awayWinner = match.away_team.match(/match\s+(\d+)\s+winners?/i);

  if (homeWinner && awayWinner) {
    const sources = [Number(homeWinner[1]), Number(awayWinner[1])];
    for (const mapping of progressionMappings) {
      const inferred = Object.entries(mapping.rules).find(
        ([, [homeSource, awaySource]]) =>
          homeSource === sources[0] && awaySource === sources[1],
      );

      if (inferred) return Number(inferred[0]);
    }
  }

  return null;
}

function canUpdateMatch(match: MatchRow) {
  const normalizedStatus = (match.status ?? "").trim().toLowerCase();
  return (
    !normalizedStatus ||
    normalizedStatus === "scheduled" ||
    normalizedStatus === "not_started" ||
    normalizedStatus === "open"
  );
}

function renderSourceRows(
  title: string,
  rows: InferredMatch[],
  missing: InferredMatch[],
) {
  return [
    `## ${title} Winners`,
    "",
    "| match | home | away | status | score | advancement_winner | winner_team |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows
      .map((match) =>
        [
          match.inferredMatchNumber ? `M${match.inferredMatchNumber}` : "-",
          match.home_team,
          match.away_team,
          match.status ?? "-",
          `${match.home_score ?? "-"}:${match.away_score ?? "-"}`,
          match.advancement_winner ?? "-",
          getWinnerTeam(match) ?? "-",
        ].join(" | "),
      )
      .map((line) => `| ${line} |`),
    "",
    `### Missing ${title} Advancement Winner`,
    "",
    missing.length === 0
      ? "- none"
      : missing
          .map(
            (match) =>
              `- M${match.inferredMatchNumber ?? "?"}: ${match.home_team} vs ${match.away_team} (${match.status ?? "-"})`,
          )
          .join("\n"),
    "",
  ];
}

function renderUpdates(title: string, updates: RoundUpdate[]) {
  return [
    `## ${title} Updates`,
    "",
    "| match | old home | old away | new home | new away | updated | reason |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...updates
      .map((update) =>
        [
          `M${update.matchNumber}`,
          update.oldHomeTeam,
          update.oldAwayTeam,
          update.newHomeTeam,
          update.newAwayTeam,
          update.updated ? "yes" : "no",
          update.reason,
        ].join(" | "),
      )
      .map((line) => `| ${line} |`),
    "",
  ];
}

function writeReport({
  applied,
  sourceSections,
  updates,
  remainingPlaceholders,
}: {
  applied: boolean;
  sourceSections: Array<{
    title: string;
    rows: InferredMatch[];
    missing: InferredMatch[];
  }>;
  updates: RoundUpdate[];
  remainingPlaceholders: InferredMatch[];
}) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const missingAdvancementCount = sourceSections.reduce(
    (total, section) => total + section.missing.length,
    0,
  );
  const lines = [
    "# Knockout Team Sync Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Mode: ${applied ? "apply" : "dry-run"}`,
    "",
    "## Summary",
    "",
    `- update plans: ${updates.length}`,
    `- updated: ${updates.filter((update) => update.updated).length}`,
    `- missing advancement_winner: ${missingAdvancementCount}`,
    `- remaining placeholders after plan: ${remainingPlaceholders.length}`,
    "",
    ...sourceSections.flatMap((section) =>
      renderSourceRows(section.title, section.rows, section.missing),
    ),
    ...renderUpdates("Knockout Round", updates),
    "## Placeholder Check",
    "",
    remainingPlaceholders.length === 0
      ? "- no placeholders found in synced target rounds"
      : remainingPlaceholders
          .map(
            (match) =>
              `- M${match.inferredMatchNumber ?? "?"}: ${match.home_team} vs ${match.away_team}`,
          )
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
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, start_time, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .in("stage", [
      "round_of_32",
      "round_of_16",
      "quarter_final",
      "quarter_finals",
      "semi_final",
      "semi_finals",
      "final",
      "third_place",
    ])
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to load knockout matches: ${error.message}`);
  }

  const allRows = ((data ?? []) as MatchRow[]).map((match) => ({
    ...match,
    inferredMatchNumber: inferMatchNumber(match),
  }));
  const byNumber = new Map<number, InferredMatch>();

  for (const match of allRows) {
    if (match.inferredMatchNumber) {
      byNumber.set(match.inferredMatchNumber, match);
    }
  }

  const sourceSections: Array<{
    title: string;
    rows: InferredMatch[];
    missing: InferredMatch[];
  }> = [];
  const updates: RoundUpdate[] = [];
  const changedTargetStages = new Set<string>();
  let blockedByMissingSource = false;

  for (const mapping of progressionMappings) {
    if (blockedByMissingSource) {
      break;
    }

    const sourceRows = allRows
      .filter((match) => isStage(match, mapping.sourceStage))
      .sort(
        (left, right) =>
          (left.inferredMatchNumber ?? 999) -
          (right.inferredMatchNumber ?? 999),
      );

    if (sourceRows.length === 0) {
      continue;
    }

    const sourceNumbers = new Set(
      Object.values(mapping.rules).flatMap(([home, away]) => [home, away]),
    );
    const relevantSourceRows = sourceRows.filter(
      (match) =>
        match.inferredMatchNumber !== null &&
        sourceNumbers.has(match.inferredMatchNumber),
    );
    const missing = relevantSourceRows.filter(
      (match) =>
        match.status !== "finished" ||
        match.inferredMatchNumber === null ||
        (match.advancement_winner !== "home" &&
          match.advancement_winner !== "away"),
    );

    sourceSections.push({
      title: mapping.sourceLabel,
      rows: relevantSourceRows,
      missing,
    });

    if (missing.length > 0) {
      blockedByMissingSource = true;
      continue;
    }

    for (const [
      matchNumberText,
      [sourceHomeMatch, sourceAwayMatch],
    ] of Object.entries(mapping.rules)) {
      const matchNumber = Number(matchNumberText);
      const target = byNumber.get(matchNumber);
      const sourceHome = byNumber.get(sourceHomeMatch);
      const sourceAway = byNumber.get(sourceAwayMatch);
      const newHomeTeam = sourceHome ? getWinnerTeam(sourceHome) : null;
      const newAwayTeam = sourceAway ? getWinnerTeam(sourceAway) : null;

      if (!target || !newHomeTeam || !newAwayTeam) {
        updates.push({
          roundLabel: mapping.targetLabel,
          targetStage: mapping.targetStage,
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

      const hasCorrectTeams =
        normalizeTeamName(target.home_team) === normalizeTeamName(newHomeTeam) &&
        normalizeTeamName(target.away_team) === normalizeTeamName(newAwayTeam);
      const canUpdate = canUpdateMatch(target);
      const oldHomeTeam = target.home_team;
      const oldAwayTeam = target.away_team;

      if (apply && canUpdate && !hasCorrectTeams) {
        const { error: updateError } = await supabase
          .from("matches")
          .update({
            home_team: newHomeTeam,
            away_team: newAwayTeam,
          })
          .eq("id", target.id);

        if (updateError) {
          throw new Error(`Failed to update M${matchNumber}: ${updateError.message}`);
        }

        target.home_team = newHomeTeam;
        target.away_team = newAwayTeam;
        changedTargetStages.add(mapping.targetStage);
      }

      updates.push({
          roundLabel: mapping.targetLabel,
          targetStage: mapping.targetStage,
          matchNumber,
          sourceHomeMatch,
          sourceAwayMatch,
          oldHomeTeam,
          oldAwayTeam,
        newHomeTeam,
        newAwayTeam,
        status: target.status,
        updated: apply && canUpdate && !hasCorrectTeams,
        reason: !canUpdate
          ? `skipped because status=${target.status ?? "null"}`
          : hasCorrectTeams
            ? "already correct"
            : apply
              ? "updated"
              : "dry-run",
      });
    }
  }

  const syncedTargetStages = new Set(
    updates.map((update) => update.targetStage),
  );
  const remainingPlaceholders = allRows.filter(
    (match) =>
      match.stage &&
      syncedTargetStages.has(normalizeStage(match.stage)) &&
      (isPlaceholderTeam(match.home_team) || isPlaceholderTeam(match.away_team)),
  );

  writeReport({
    applied: apply,
    sourceSections,
    updates,
    remainingPlaceholders,
  });

  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Update plans: ${updates.length}`);
  console.log(`Updated: ${updates.filter((update) => update.updated).length}`);
  console.log(
    `Blocked by missing advancement: ${sourceSections.reduce(
      (total, section) => total + section.missing.length,
      0,
    )}`,
  );
  console.log(`Report: ${reportPath}`);

  if (changedTargetStages.size > 0) {
    console.log(`Changed target stages: ${Array.from(changedTargetStages).join(", ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
