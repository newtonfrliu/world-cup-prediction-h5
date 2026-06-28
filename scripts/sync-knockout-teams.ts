import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { getCountryDisplayName } from "../lib/countries.ts";
import {
  buildRoundOf32,
  createEmptyRankings,
  type GroupRanking,
  WORLD_CUP_2026_GROUPS,
} from "../lib/world-cup-2026-round-of-32.ts";
import {
  GROUP_LETTERS,
} from "../lib/world-cup-2026-third-place-map.ts";
import type { GroupLetter } from "../lib/world-cup-2026-third-place-map.ts";
import type { Database } from "../types/database.ts";

type MatchRow = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  | "id"
  | "match_number"
  | "group_name"
  | "stage"
  | "home_team"
  | "away_team"
  | "home_score"
  | "away_score"
  | "status"
  | "result"
>;

type TeamStanding = {
  team: string;
  group: GroupLetter;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

type RoundOf32Update = {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  previousHomeTeam: string;
  previousAwayTeam: string;
};

const envFilePath = path.join(process.cwd(), ".env.local");
const knockoutMatchNumbers = Array.from({ length: 16 }, (_, index) => index + 73);
const roundOf32Placeholders: Record<number, [string, string]> = {
  73: ["Group A runners-up", "Group B runners-up"],
  74: ["Group E winners", "Group A/B/C/D/F third place"],
  75: ["Group F winners", "Group C runners-up"],
  76: ["Group C winners", "Group F runners-up"],
  77: ["Group I winners", "Group C/D/F/G/H third place"],
  78: ["Group E runners-up", "Group I runners-up"],
  79: ["Group A winners", "Group C/E/F/H/I third place"],
  80: ["Group L winners", "Group E/H/I/J/K third place"],
  81: ["Group D winners", "Group B/E/F/I/J third place"],
  82: ["Group G winners", "Group A/E/H/I/J third place"],
  83: ["Group K runners-up", "Group L runners-up"],
  84: ["Group H winners", "Group J runners-up"],
  85: ["Group B winners", "Group E/F/G/I/J third place"],
  86: ["Group J winners", "Group H runners-up"],
  87: ["Group K winners", "Group D/E/I/J/L third place"],
  88: ["Group D runners-up", "Group G runners-up"],
};

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
  if (process.argv.includes("--apply")) {
    return "apply" as const;
  }

  return "dry-run" as const;
}

function assertGroupLetter(value: string | null): GroupLetter {
  const normalized = value?.trim().toUpperCase();

  if (GROUP_LETTERS.includes(normalized as GroupLetter)) {
    return normalized as GroupLetter;
  }

  throw new Error(`Invalid or missing group_name: ${value ?? "null"}`);
}

function inferGroupFromTeams(homeTeam: string, awayTeam: string) {
  const matchedGroup = GROUP_LETTERS.find((group) => {
    const teams = WORLD_CUP_2026_GROUPS[group];

    return teams.includes(homeTeam) && teams.includes(awayTeam);
  });

  if (!matchedGroup) {
    throw new Error(`Cannot infer group for match: ${homeTeam} vs ${awayTeam}`);
  }

  return matchedGroup;
}

function createStanding(team: string, group: GroupLetter): TeamStanding {
  return {
    team,
    group,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

function ensureStanding(
  standings: Map<string, TeamStanding>,
  team: string,
  group: GroupLetter,
) {
  const key = `${group}:${team}`;
  const current = standings.get(key);

  if (current) {
    return current;
  }

  const standing = createStanding(team, group);
  standings.set(key, standing);
  return standing;
}

function addMatchToStandings(match: MatchRow, standings: Map<string, TeamStanding>) {
  const group = match.group_name
    ? assertGroupLetter(match.group_name)
    : inferGroupFromTeams(match.home_team, match.away_team);

  if (match.status !== "finished") {
    throw new Error(
      `Group match ${match.match_number ?? match.id} is not finished: ${match.home_team} vs ${match.away_team}`,
    );
  }

  if (match.home_score === null || match.away_score === null) {
    throw new Error(
      `Group match ${match.match_number ?? match.id} is missing score: ${match.home_team} vs ${match.away_team}`,
    );
  }

  const home = ensureStanding(standings, match.home_team, group);
  const away = ensureStanding(standings, match.away_team, group);

  home.played += 1;
  away.played += 1;
  home.goalsFor += match.home_score;
  home.goalsAgainst += match.away_score;
  away.goalsFor += match.away_score;
  away.goalsAgainst += match.home_score;

  if (match.home_score > match.away_score) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (match.home_score < match.away_score) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function getGroupMatchDataProblems(groupMatches: MatchRow[]) {
  return groupMatches.flatMap((match) => {
    const problems: string[] = [];

    if (match.status !== "finished") {
      problems.push(`status=${match.status ?? "null"}`);
    }

    if (match.home_score === null || match.away_score === null) {
      problems.push("missing score");
    }

    if (problems.length === 0) {
      return [];
    }

    return [
      `${match.match_number ? `M${match.match_number}` : match.id}: ${match.home_team} vs ${match.away_team} (${problems.join(", ")})`,
    ];
  });
}

function compareStandings(left: TeamStanding, right: TeamStanding) {
  return (
    right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor ||
    left.team.localeCompare(right.team)
  );
}

function buildGroupRankings(groupMatches: MatchRow[]) {
  const standings = new Map<string, TeamStanding>();

  for (const match of groupMatches) {
    addMatchToStandings(match, standings);
  }

  const standingsByGroup = Object.fromEntries(
    GROUP_LETTERS.map((group) => [group, [] as TeamStanding[]]),
  ) as Record<GroupLetter, TeamStanding[]>;

  for (const standing of standings.values()) {
    standingsByGroup[standing.group].push(standing);
  }

  for (const group of GROUP_LETTERS) {
    standingsByGroup[group].sort(compareStandings);

    if (standingsByGroup[group].length !== 4) {
      throw new Error(
        `Group ${group} has ${standingsByGroup[group].length} teams in standings, expected 4.`,
      );
    }
  }

  return standingsByGroup;
}

function buildCalculatorRankings(standingsByGroup: Record<GroupLetter, TeamStanding[]>) {
  const rankings = createEmptyRankings();
  const thirdPlacedTeams = GROUP_LETTERS.map((group) => standingsByGroup[group][2]);
  const bestThirds = thirdPlacedTeams
    .slice()
    .sort(compareStandings)
    .slice(0, 8);
  const bestThirdGroupSet = new Set(bestThirds.map((standing) => standing.group));

  for (const group of GROUP_LETTERS) {
    const groupTable = standingsByGroup[group];
    const groupRanking: GroupRanking = {
      first: groupTable[0].team,
      second: groupTable[1].team,
      third: groupTable[2].team,
      bestThird: bestThirdGroupSet.has(group),
    };
    rankings[group] = groupRanking;
  }

  return {
    rankings,
    bestThirds,
    bestThirdGroups: bestThirds.map((standing) => standing.group).sort(),
  };
}

function getMatchUpdatePayload(homeTeam: string, awayTeam: string, includeZh: boolean) {
  const base = {
    home_team: homeTeam,
    away_team: awayTeam,
  };

  if (!includeZh) {
    return base;
  }

  return {
    ...base,
    home_team_zh: getCountryDisplayName(homeTeam),
    away_team_zh: getCountryDisplayName(awayTeam),
  };
}

function formatStanding(standing: TeamStanding) {
  return `${standing.team} ${standing.points}pts GD ${standing.goalDifference} GF ${standing.goalsFor}`;
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

function isMissingZhColumnError(error: unknown) {
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("home_team_zh") ||
    message.includes("away_team_zh") ||
    message.includes("schema cache")
  );
}

function normalizePlaceholder(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferRoundOf32MatchNumber(match: MatchRow) {
  if (
    match.match_number &&
    match.match_number >= 73 &&
    match.match_number <= 88
  ) {
    return match.match_number;
  }

  const home = normalizePlaceholder(match.home_team);
  const away = normalizePlaceholder(match.away_team);
  const inferred = Object.entries(roundOf32Placeholders).find(
    ([, [placeholderHome, placeholderAway]]) =>
      normalizePlaceholder(placeholderHome) === home &&
      normalizePlaceholder(placeholderAway) === away,
  );

  return inferred ? Number(inferred[0]) : null;
}

async function main() {
  loadLocalEnv();

  const mode = getMode();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  const { data: groupMatches, error: groupMatchesError } = await supabase
    .from("matches")
    .select(
      "id, match_number, group_name, stage, home_team, away_team, home_score, away_score, status, result",
    )
    .eq("stage", "group")
    .order("match_number", { ascending: true });

  if (groupMatchesError) {
    throw new Error(`Failed to load group matches: ${groupMatchesError.message}`);
  }

  if (!groupMatches || groupMatches.length !== 72) {
    throw new Error(
      `Expected 72 group matches, got ${groupMatches?.length ?? 0}. Refusing to calculate knockout teams.`,
    );
  }

  const groupMatchProblems = getGroupMatchDataProblems(groupMatches as MatchRow[]);

  if (groupMatchProblems.length > 0) {
    console.error(
      `Cannot calculate knockout teams: ${groupMatchProblems.length} group matches are not finished or missing scores.`,
    );
    for (const problem of groupMatchProblems.slice(0, 20)) {
      console.error(`- ${problem}`);
    }
    if (groupMatchProblems.length > 20) {
      console.error(`...and ${groupMatchProblems.length - 20} more`);
    }
    throw new Error(
      "Run sync:scores or manually finish all group matches before syncing knockout teams.",
    );
  }

  const standingsByGroup = buildGroupRankings(groupMatches as MatchRow[]);
  const { rankings, bestThirds, bestThirdGroups } =
    buildCalculatorRankings(standingsByGroup);
  const roundOf32 = buildRoundOf32(rankings);

  if (roundOf32.error) {
    throw new Error(roundOf32.error);
  }

  if (bestThirdGroups.length !== 8 || !roundOf32.combinationKey) {
    throw new Error("Failed to determine 8 best third-place groups.");
  }

  const { data: knockoutMatches, error: knockoutError } = await supabase
    .from("matches")
    .select("id, match_number, home_team, away_team, status, home_score, away_score")
    .eq("stage", "round_of_32")
    .order("start_time", { ascending: true });

  if (knockoutError) {
    throw new Error(`Failed to load round of 32 matches: ${knockoutError.message}`);
  }

  if (!knockoutMatches || knockoutMatches.length !== 16) {
    throw new Error(
      `Expected 16 round_of_32 matches by match_number 73-88, got ${knockoutMatches?.length ?? 0}.`,
    );
  }

  const knockoutByMatchNumber = new Map(
    (knockoutMatches as MatchRow[]).map((match) => [
      inferRoundOf32MatchNumber(match),
      match,
    ]),
  );
  const missingKnockoutNumbers = knockoutMatchNumbers.filter(
    (matchNumber) => !knockoutByMatchNumber.has(matchNumber),
  );

  if (missingKnockoutNumbers.length > 0) {
    throw new Error(
      `Could not infer database rows for round-of-32 matches: ${missingKnockoutNumbers
        .map((matchNumber) => `M${matchNumber}`)
        .join(", ")}`,
    );
  }
  const updates: RoundOf32Update[] = roundOf32.matches.map((match) => {
    const dbMatch = knockoutByMatchNumber.get(match.matchNumber);

    if (!dbMatch) {
      throw new Error(`Missing database match M${match.matchNumber}`);
    }

    if (!match.home?.team || !match.away?.team) {
      throw new Error(`Round of 32 match M${match.matchNumber} has unresolved team.`);
    }

    if (dbMatch.home_score !== null || dbMatch.away_score !== null) {
      throw new Error(
        `M${match.matchNumber} already has score data. Refusing to overwrite teams.`,
      );
    }

    return {
      matchNumber: match.matchNumber,
      homeTeam: match.home.team,
      awayTeam: match.away.team,
      previousHomeTeam: dbMatch.home_team,
      previousAwayTeam: dbMatch.away_team,
    };
  });

  printDryRun({
    standingsByGroup,
    bestThirds,
    combinationKey: roundOf32.combinationKey,
    updates,
  });

  if (mode !== "apply") {
    console.log("");
    console.log("Dry-run only. Re-run with --apply to update Supabase.");
    return;
  }

  let includeZhColumns = true;
  let updated = 0;

  for (const update of updates) {
    const dbMatch = knockoutByMatchNumber.get(update.matchNumber);

    if (!dbMatch) {
      throw new Error(`Missing database match M${update.matchNumber}`);
    }

    const payload = getMatchUpdatePayload(
      update.homeTeam,
      update.awayTeam,
      includeZhColumns,
    );
    let { error: updateError } = await supabase
      .from("matches")
      .update(payload as never)
      .eq("id", dbMatch.id);

    if (updateError && includeZhColumns && isMissingZhColumnError(updateError)) {
      includeZhColumns = false;
      const fallbackPayload = getMatchUpdatePayload(
        update.homeTeam,
        update.awayTeam,
        false,
      );
      const fallback = await supabase
        .from("matches")
        .update(fallbackPayload)
        .eq("id", dbMatch.id);
      updateError = fallback.error;
    }

    if (updateError) {
      throw new Error(
        `Failed to update M${update.matchNumber}: ${updateError.message}`,
      );
    }

    updated += 1;
  }

  console.log("");
  console.log(
    `Applied ${updated} round-of-32 team updates. home_team_zh/away_team_zh ${
      includeZhColumns ? "were updated" : "were skipped because columns are missing"
    }.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

export {};
