export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type QualifiedTeam = {
  key: string;
  team: string;
  group: GroupLetter;
  rank: 1 | 2 | 3;
};

export type BracketMatch = {
  id: string;
  label: string;
  teams: [QualifiedTeam, QualifiedTeam];
  winner?: QualifiedTeam;
};

type ThirdSlot = {
  type: "third";
  candidates: GroupLetter[];
};

type DirectSlot = {
  type: "direct";
  rank: 1 | 2;
  group: GroupLetter;
};

type Slot = DirectSlot | ThirdSlot;

type Rule = {
  matchNumber: number;
  home: Slot;
  away: Slot;
};

type GenerateRoundOf32Input = {
  groupWinners: Partial<Record<GroupLetter, QualifiedTeam>>;
  groupRunnersUp: Partial<Record<GroupLetter, QualifiedTeam>>;
  groupThirds: Partial<Record<GroupLetter, QualifiedTeam>>;
  selectedBestThirdGroups: GroupLetter[];
  officialPlaceholders?: Array<{
    matchNumber: number;
    homeTeam: string;
    awayTeam: string;
  }>;
};

const fallbackRules: Rule[] = [
  { matchNumber: 73, home: direct(2, "A"), away: direct(2, "B") },
  { matchNumber: 74, home: direct(1, "E"), away: third(["A", "B", "C", "D", "F"]) },
  { matchNumber: 75, home: direct(1, "F"), away: direct(2, "C") },
  { matchNumber: 76, home: direct(1, "C"), away: direct(2, "F") },
  { matchNumber: 77, home: direct(1, "I"), away: third(["C", "D", "F", "G", "H"]) },
  { matchNumber: 78, home: direct(2, "E"), away: direct(2, "I") },
  { matchNumber: 79, home: direct(1, "A"), away: third(["C", "E", "F", "H", "I"]) },
  { matchNumber: 80, home: direct(1, "L"), away: third(["E", "H", "I", "J", "K"]) },
  { matchNumber: 81, home: direct(1, "D"), away: third(["B", "E", "F", "I", "J"]) },
  { matchNumber: 82, home: direct(1, "G"), away: third(["A", "E", "H", "I", "J"]) },
  { matchNumber: 83, home: direct(2, "K"), away: direct(2, "L") },
  { matchNumber: 84, home: direct(1, "H"), away: direct(2, "J") },
  { matchNumber: 85, home: direct(1, "B"), away: third(["E", "F", "G", "I", "J"]) },
  { matchNumber: 86, home: direct(1, "J"), away: direct(2, "H") },
  { matchNumber: 87, home: direct(1, "K"), away: third(["D", "E", "F", "I", "J"]) },
  { matchNumber: 88, home: direct(2, "D"), away: direct(2, "G") },
];

function direct(rank: 1 | 2, group: GroupLetter): DirectSlot {
  return { type: "direct", rank, group };
}

function third(candidates: GroupLetter[]): ThirdSlot {
  return { type: "third", candidates };
}

function parseSlot(value: string): Slot | null {
  const normalized = value.trim().toUpperCase();
  const directMatch = normalized.match(/^([12])([A-L])$/);

  if (directMatch) {
    return direct(Number(directMatch[1]) as 1 | 2, directMatch[2] as GroupLetter);
  }

  const thirdMatch = normalized.match(/^BEST3 FROM ([A-L/]+)$/);

  if (thirdMatch) {
    return third(thirdMatch[1].split("/") as GroupLetter[]);
  }

  return null;
}

function parseOfficialRules(
  placeholders?: GenerateRoundOf32Input["officialPlaceholders"],
) {
  if (!placeholders || placeholders.length === 0) {
    return null;
  }

  const parsed = placeholders
    .filter((item) => item.matchNumber >= 73 && item.matchNumber <= 88)
    .map((item) => {
      const home = parseSlot(item.homeTeam);
      const away = parseSlot(item.awayTeam);

      if (!home || !away) {
        return null;
      }

      return {
        matchNumber: item.matchNumber,
        home,
        away,
      };
    });

  if (parsed.some((item) => item === null) || parsed.length !== 16) {
    return null;
  }

  return parsed as Rule[];
}

export function generateOfficialRoundOf32({
  groupWinners,
  groupRunnersUp,
  groupThirds,
  selectedBestThirdGroups,
  officialPlaceholders,
}: GenerateRoundOf32Input):
  | { ok: true; matches: BracketMatch[] }
  | { ok: false; error: string } {
  const rules = parseOfficialRules(officialPlaceholders) ?? fallbackRules;
  const usedThirdGroups = new Set<GroupLetter>();

  function resolveSlot(slot: Slot): QualifiedTeam | null {
    if (slot.type === "direct") {
      return slot.rank === 1
        ? groupWinners[slot.group] ?? null
        : groupRunnersUp[slot.group] ?? null;
    }

    const pickedGroup = slot.candidates.find(
      (group) =>
        selectedBestThirdGroups.includes(group) && !usedThirdGroups.has(group),
    );

    if (!pickedGroup) {
      return null;
    }

    const team = groupThirds[pickedGroup];

    if (!team) {
      return null;
    }

    usedThirdGroups.add(pickedGroup);
    return team;
  }

  const matches: BracketMatch[] = [];

  for (const rule of rules) {
    const home = resolveSlot(rule.home);
    const away = resolveSlot(rule.away);

    if (!home || !away) {
      return {
        ok: false,
        error: "当前最佳第三名组合暂无法生成官方对阵，请重新选择最佳第三名。",
      };
    }

    matches.push({
      id: `match-${rule.matchNumber}`,
      label: `Match ${rule.matchNumber}`,
      teams: [home, away],
    });
  }

  return { ok: true, matches };
}
