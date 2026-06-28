import {
  getThirdPlaceCombinationKey,
  THIRD_PLACE_ADVANCEMENT_MAP,
} from "./world-cup-2026-third-place-map.ts";
import type {
  GroupLetter,
  ThirdPlaceSlot,
} from "./world-cup-2026-third-place-map.ts";

export type TeamName = string;

export type GroupRanking = {
  first: TeamName;
  second: TeamName;
  third: TeamName;
  bestThird: boolean;
};

export type RoundOf32Team = {
  slot: string;
  team: TeamName | null;
  group?: GroupLetter;
  rank?: 1 | 2 | 3;
};

export type KnockoutMatch = {
  matchNumber: number;
  home: RoundOf32Team | null;
  away: RoundOf32Team | null;
};

export type RoundOf32Match = KnockoutMatch;

export type SelectedKnockoutWinners = Record<string, TeamName>;

export type KnockoutBracket = {
  roundOf32: KnockoutMatch[];
  roundOf16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  final: KnockoutMatch;
  champion: RoundOf32Team | null;
};

export const WORLD_CUP_2026_GROUPS: Record<GroupLetter, TeamName[]> = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia & Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["USA", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

type DirectSlot = {
  type: "direct";
  group: GroupLetter;
  rank: 1 | 2;
};

type ThirdSlot = {
  type: "third";
  slot: ThirdPlaceSlot;
};

type MatchRule = {
  matchNumber: number;
  home: DirectSlot | ThirdSlot;
  away: DirectSlot | ThirdSlot;
};

function direct(group: GroupLetter, rank: 1 | 2): DirectSlot {
  return { type: "direct", group, rank };
}

function third(slot: ThirdPlaceSlot): ThirdSlot {
  return { type: "third", slot };
}

export const ROUND_OF_32_RULES: MatchRule[] = [
  { matchNumber: 73, home: direct("A", 2), away: direct("B", 2) },
  { matchNumber: 74, home: direct("E", 1), away: third("T1") },
  { matchNumber: 75, home: direct("F", 1), away: direct("C", 2) },
  { matchNumber: 76, home: direct("C", 1), away: direct("F", 2) },
  { matchNumber: 77, home: direct("I", 1), away: third("T2") },
  { matchNumber: 78, home: direct("E", 2), away: direct("I", 2) },
  { matchNumber: 79, home: direct("A", 1), away: third("T3") },
  { matchNumber: 80, home: direct("L", 1), away: third("T4") },
  { matchNumber: 81, home: direct("D", 1), away: third("T5") },
  { matchNumber: 82, home: direct("G", 1), away: third("T6") },
  { matchNumber: 83, home: direct("K", 2), away: direct("L", 2) },
  { matchNumber: 84, home: direct("H", 1), away: direct("J", 2) },
  { matchNumber: 85, home: direct("B", 1), away: third("T7") },
  { matchNumber: 86, home: direct("J", 1), away: direct("H", 2) },
  { matchNumber: 87, home: direct("K", 1), away: third("T8") },
  { matchNumber: 88, home: direct("D", 2), away: direct("G", 2) },
];

export const ROUND_OF_32_LAYOUT = {
  left: [74, 77, 73, 75, 83, 84, 81, 82],
  right: [76, 78, 79, 80, 86, 88, 85, 87],
};

const NEXT_ROUND_RULES = {
  roundOf16: [
    { matchNumber: 89, sources: [74, 77] },
    { matchNumber: 90, sources: [73, 75] },
    { matchNumber: 91, sources: [83, 84] },
    { matchNumber: 92, sources: [81, 82] },
    { matchNumber: 93, sources: [76, 78] },
    { matchNumber: 94, sources: [79, 80] },
    { matchNumber: 95, sources: [86, 88] },
    { matchNumber: 96, sources: [85, 87] },
  ],
  quarterFinals: [
    { matchNumber: 97, sources: [89, 90] },
    { matchNumber: 98, sources: [91, 92] },
    { matchNumber: 99, sources: [93, 94] },
    { matchNumber: 100, sources: [95, 96] },
  ],
  semiFinals: [
    { matchNumber: 101, sources: [97, 98] },
    { matchNumber: 102, sources: [99, 100] },
  ],
  final: [{ matchNumber: 104, sources: [101, 102] }],
} satisfies Record<
  "roundOf16" | "quarterFinals" | "semiFinals" | "final",
  Array<{ matchNumber: number; sources: [number, number] }>
>;

export function createEmptyRankings(): Record<GroupLetter, GroupRanking> {
  return Object.fromEntries(
    Object.keys(WORLD_CUP_2026_GROUPS).map((group) => [
      group,
      { first: "", second: "", third: "", bestThird: false },
    ]),
  ) as Record<GroupLetter, GroupRanking>;
}

export function createExampleRankings(): Record<GroupLetter, GroupRanking> {
  return Object.fromEntries(
    Object.entries(WORLD_CUP_2026_GROUPS).map(([group, teams], index) => [
      group,
      {
        first: teams[0],
        second: teams[1],
        third: teams[2],
        bestThird: index < 8,
      },
    ]),
  ) as Record<GroupLetter, GroupRanking>;
}

function resolveDirectSlot(
  rankings: Record<GroupLetter, GroupRanking>,
  slot: DirectSlot,
): RoundOf32Team | null {
  const team = slot.rank === 1 ? rankings[slot.group].first : rankings[slot.group].second;

  if (!team) {
    return null;
  }

  return {
    slot: `${slot.group}${slot.rank}`,
    team,
    group: slot.group,
    rank: slot.rank,
  };
}

function resolveThirdSlot(
  rankings: Record<GroupLetter, GroupRanking>,
  slot: ThirdSlot,
  selectedBestThirdGroups: GroupLetter[],
): RoundOf32Team | null {
  if (selectedBestThirdGroups.length !== 8) {
    return null;
  }

  const combinationKey = getThirdPlaceCombinationKey(selectedBestThirdGroups);
  const assignment = THIRD_PLACE_ADVANCEMENT_MAP[combinationKey];

  if (!assignment) {
    return null;
  }

  const group = assignment[slot.slot];
  const team = rankings[group]?.third;

  if (!team) {
    return null;
  }

  return {
    slot: `${group}3`,
    team,
    group,
    rank: 3,
  };
}

export function buildRoundOf32(rankings: Record<GroupLetter, GroupRanking>) {
  const selectedBestThirdGroups = Object.entries(rankings)
    .filter(([, ranking]) => ranking.bestThird && ranking.third)
    .map(([group]) => group as GroupLetter)
    .sort();
  const combinationKey =
    selectedBestThirdGroups.length === 8
      ? getThirdPlaceCombinationKey(selectedBestThirdGroups)
      : "";
  const thirdPlaceAssignment = combinationKey
    ? THIRD_PLACE_ADVANCEMENT_MAP[combinationKey] ?? null
    : null;
  const error =
    selectedBestThirdGroups.length === 8 && !thirdPlaceAssignment
      ? `Annex C 映射表缺少组合 ${combinationKey}，无法生成官方第三名槽位。`
      : "";

  const matches: RoundOf32Match[] = ROUND_OF_32_RULES.map((rule) => ({
    matchNumber: rule.matchNumber,
    home:
      rule.home.type === "direct"
        ? resolveDirectSlot(rankings, rule.home)
        : resolveThirdSlot(rankings, rule.home, selectedBestThirdGroups),
    away:
      rule.away.type === "direct"
        ? resolveDirectSlot(rankings, rule.away)
        : resolveThirdSlot(rankings, rule.away, selectedBestThirdGroups),
  }));

  return {
    matches,
    combinationKey,
    error,
    selectedBestThirdGroups,
    thirdPlaceAssignment,
  };
}

function getWinnerFromMatch(
  match: KnockoutMatch,
  selectedWinners: SelectedKnockoutWinners,
): RoundOf32Team | null {
  const selectedTeam = selectedWinners[`M${match.matchNumber}`];

  if (!selectedTeam) {
    return null;
  }

  if (match.home?.team === selectedTeam) {
    return match.home;
  }

  if (match.away?.team === selectedTeam) {
    return match.away;
  }

  return null;
}

function buildNextRound(
  previousRound: KnockoutMatch[],
  rules: Array<{ matchNumber: number; sources: [number, number] }>,
  selectedWinners: SelectedKnockoutWinners,
): KnockoutMatch[] {
  const previousRoundByNumber = new Map(
    previousRound.map((match) => [match.matchNumber, match]),
  );

  return rules.map((rule) => {
    const firstSourceMatch = previousRoundByNumber.get(rule.sources[0]);
    const secondSourceMatch = previousRoundByNumber.get(rule.sources[1]);

    return {
      matchNumber: rule.matchNumber,
      home: firstSourceMatch
        ? getWinnerFromMatch(firstSourceMatch, selectedWinners)
        : null,
      away: secondSourceMatch
        ? getWinnerFromMatch(secondSourceMatch, selectedWinners)
        : null,
    };
  });
}

export function resolveKnockoutBracket(
  roundOf32: KnockoutMatch[],
  selectedWinners: SelectedKnockoutWinners,
): KnockoutBracket {
  const roundOf16 = buildNextRound(
    roundOf32,
    NEXT_ROUND_RULES.roundOf16,
    selectedWinners,
  );
  const quarterFinals = buildNextRound(
    roundOf16,
    NEXT_ROUND_RULES.quarterFinals,
    selectedWinners,
  );
  const semiFinals = buildNextRound(
    quarterFinals,
    NEXT_ROUND_RULES.semiFinals,
    selectedWinners,
  );
  const [final] = buildNextRound(
    semiFinals,
    NEXT_ROUND_RULES.final,
    selectedWinners,
  );

  return {
    roundOf32,
    roundOf16,
    quarterFinals,
    semiFinals,
    final,
    champion: getWinnerFromMatch(final, selectedWinners),
  };
}
