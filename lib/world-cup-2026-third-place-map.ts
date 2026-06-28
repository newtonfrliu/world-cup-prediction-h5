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

export type ThirdPlaceSlot = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8";

export type ThirdPlaceAssignment = Record<ThirdPlaceSlot, GroupLetter>;

export const GROUP_LETTERS: GroupLetter[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
];

const THIRD_PLACE_SLOT_CANDIDATES: Record<ThirdPlaceSlot, GroupLetter[]> = {
  T1: ["A", "B", "C", "D", "F"],
  T2: ["C", "D", "F", "G", "H"],
  T3: ["C", "E", "F", "H", "I"],
  T4: ["E", "H", "I", "J", "K"],
  T5: ["B", "E", "F", "I", "J"],
  T6: ["A", "E", "H", "I", "J"],
  T7: ["E", "F", "G", "I", "J"],
  // FIFA schedule lists Match 87 as 1K vs best 3rd from D/E/I/J/L.
  // Keeping L here is required; otherwise a qualified 3L could never be placed.
  T8: ["D", "E", "I", "J", "L"],
};

const THIRD_PLACE_SLOTS: ThirdPlaceSlot[] = [
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
];

function combinationKey(groups: GroupLetter[]) {
  return groups.slice().sort().join("");
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  function walk(start: number, picked: T[]) {
    if (picked.length === size) {
      result.push(picked.slice());
      return;
    }

    for (let index = start; index <= items.length - (size - picked.length); index += 1) {
      picked.push(items[index]);
      walk(index + 1, picked);
      picked.pop();
    }
  }

  walk(0, []);
  return result;
}

function resolveAssignment(groups: GroupLetter[]): ThirdPlaceAssignment | null {
  const selected = new Set(groups);
  const candidateSlots = THIRD_PLACE_SLOTS.map((slot) => ({
    slot,
    candidates: THIRD_PLACE_SLOT_CANDIDATES[slot].filter((group) => selected.has(group)),
  })).sort(
    (left, right) =>
      left.candidates.length - right.candidates.length ||
      left.slot.localeCompare(right.slot),
  );
  const usedGroups = new Set<GroupLetter>();
  const assignment = {} as ThirdPlaceAssignment;

  function search(slotIndex: number): boolean {
    if (slotIndex === candidateSlots.length) {
      return true;
    }

    const current = candidateSlots[slotIndex];

    for (const group of current.candidates) {
      if (usedGroups.has(group)) {
        continue;
      }

      usedGroups.add(group);
      assignment[current.slot] = group;

      if (search(slotIndex + 1)) {
        return true;
      }

      usedGroups.delete(group);
      delete assignment[current.slot];
    }

    return false;
  }

  return search(0) ? assignment : null;
}

function buildThirdPlaceMap() {
  const map: Record<string, ThirdPlaceAssignment> = {};

  for (const groups of combinations(GROUP_LETTERS, 8)) {
    const assignment = resolveAssignment(groups);

    if (assignment) {
      map[combinationKey(groups)] = assignment;
    }
  }

  // Verified against the reviewed 2026 round-of-32 bracket for the actual
  // best-third combination produced by the completed group stage.
  map.BDEFIJKL = {
    T1: "D",
    T2: "F",
    T3: "E",
    T4: "K",
    T5: "B",
    T6: "I",
    T7: "J",
    T8: "L",
  };

  return map;
}

export const THIRD_PLACE_ADVANCEMENT_MAP = buildThirdPlaceMap();

export function getThirdPlaceCombinationKey(groups: GroupLetter[]) {
  return combinationKey(groups);
}

export function validateThirdPlaceMap() {
  const errors: string[] = [];
  const keys = Object.keys(THIRD_PLACE_ADVANCEMENT_MAP);
  const allowedGroups = new Set(GROUP_LETTERS);

  if (keys.length !== 495) {
    errors.push(`expected 495 combinations, got ${keys.length}`);
  }

  for (const key of keys) {
    const keyGroups = key.split("") as GroupLetter[];
    const keyGroupSet = new Set(keyGroups);
    const value = THIRD_PLACE_ADVANCEMENT_MAP[key];

    if (key.length !== 8) {
      errors.push(`${key}: key length must be 8`);
    }

    if (keyGroups.some((group) => !allowedGroups.has(group))) {
      errors.push(`${key}: contains group outside A-L`);
    }

    if (keyGroupSet.size !== 8) {
      errors.push(`${key}: contains duplicate groups`);
    }

    for (const slot of THIRD_PLACE_SLOTS) {
      const group = value?.[slot];

      if (!group) {
        errors.push(`${key}: missing ${slot}`);
        continue;
      }

      if (!keyGroupSet.has(group)) {
        errors.push(`${key}: ${slot} uses 3${group}, not included in key`);
      }

      if (!THIRD_PLACE_SLOT_CANDIDATES[slot].includes(group)) {
        errors.push(`${key}: ${slot} cannot use 3${group}`);
      }
    }

    const valueGroups = THIRD_PLACE_SLOTS.map((slot) => value?.[slot]);
    if (new Set(valueGroups).size !== 8) {
      errors.push(`${key}: duplicated third-place assignment`);
    }
  }

  return {
    ok: errors.length === 0,
    count: keys.length,
    errors,
  };
}
