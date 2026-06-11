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
  { matchNumber: 87, home: direct(1, "K"), away: third(["D", "E", "I", "J", "L"]) },
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

function getThirdSlotId(ruleIndex: number, side: "home" | "away") {
  return `${ruleIndex}-${side}`;
}

function assignThirdGroups(
  rules: Rule[],
  selectedBestThirdGroups: GroupLetter[],
):
  | { ok: true; assignments: Map<string, GroupLetter> }
  | { ok: false; combination: string } {
  const selectedGroups = Array.from(new Set(selectedBestThirdGroups)).sort();
  const selectedSet = new Set<GroupLetter>(selectedGroups);
  const slots = rules.flatMap((rule, ruleIndex) =>
    (["home", "away"] as const).flatMap((side) => {
      const slot = rule[side];

      if (slot.type !== "third") {
        return [];
      }

      return [
        {
          id: getThirdSlotId(ruleIndex, side),
          candidates: slot.candidates.filter((group) => selectedSet.has(group)),
        },
      ];
    }),
  );

  if (selectedGroups.length !== slots.length || slots.some((slot) => slot.candidates.length === 0)) {
    return { ok: false, combination: selectedGroups.join("/") };
  }

  const orderedSlots = slots
    .slice()
    .sort(
      (left, right) =>
        left.candidates.length - right.candidates.length ||
        left.id.localeCompare(right.id),
    );
  const usedGroups = new Set<GroupLetter>();
  const assignments = new Map<string, GroupLetter>();

  function search(slotIndex: number): boolean {
    if (slotIndex === orderedSlots.length) {
      return true;
    }

    const slot = orderedSlots[slotIndex];

    for (const group of slot.candidates) {
      if (usedGroups.has(group)) {
        continue;
      }

      usedGroups.add(group);
      assignments.set(slot.id, group);

      if (search(slotIndex + 1)) {
        return true;
      }

      usedGroups.delete(group);
      assignments.delete(slot.id);
    }

    return false;
  }

  if (!search(0)) {
    return { ok: false, combination: selectedGroups.join("/") };
  }

  return { ok: true, assignments };
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
  const thirdAssignment = assignThirdGroups(rules, selectedBestThirdGroups);

  if (!thirdAssignment.ok) {
    return {
      ok: false,
      error: `当前最佳第三名组合（${thirdAssignment.combination || "未完整选择"}）无法生成对阵。请确认已选满 8 个最佳第三名；如果仍出现该提示，请截图反馈。`,
    };
  }
  const thirdAssignments = thirdAssignment.assignments;

  function resolveSlot(
    slot: Slot,
    ruleIndex: number,
    side: "home" | "away",
  ): QualifiedTeam | null {
    if (slot.type === "direct") {
      return slot.rank === 1
        ? groupWinners[slot.group] ?? null
        : groupRunnersUp[slot.group] ?? null;
    }

    const pickedGroup = thirdAssignments.get(getThirdSlotId(ruleIndex, side));

    if (!pickedGroup) {
      return null;
    }

    const team = groupThirds[pickedGroup];

    if (!team) {
      return null;
    }

    return team;
  }

  const matches: BracketMatch[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    const home = resolveSlot(rule.home, ruleIndex, "home");
    const away = resolveSlot(rule.away, ruleIndex, "away");

    if (!home || !away) {
      const combination = Array.from(new Set(selectedBestThirdGroups))
        .sort()
        .join("/");
      return {
        ok: false,
        error: `当前最佳第三名组合（${combination || "未完整选择"}）缺少已选择的小组第三名球队。请先完成 A-L 组第3名和 8 个最佳第三名选择。`,
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
