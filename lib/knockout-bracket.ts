import { createClient } from "@supabase/supabase-js";

import { getCountryDisplayName, resolveCountry } from "@/lib/countries";

export type KnockoutStageKey =
  | "roundOf32"
  | "roundOf16"
  | "quarterFinals"
  | "semiFinals"
  | "thirdPlace"
  | "final";

export type KnockoutMatch = {
  id: string;
  stage: string | null;
  match_number: number | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  betting_result: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  advancement_winner: string | null;
  status: string | null;
  start_time: string | null;
};

export type TeamDisplay = {
  raw: string;
  label: string;
  flag: string | null;
  isPlaceholder: boolean;
};

export type GroupedKnockoutMatches = Record<KnockoutStageKey, KnockoutMatch[]>;

const knockoutStageMap: Record<string, KnockoutStageKey> = {
  round_of_32: "roundOf32",
  roundof32: "roundOf32",
  round_32: "roundOf32",
  r32: "roundOf32",
  round_of_16: "roundOf16",
  roundof16: "roundOf16",
  round_16: "roundOf16",
  r16: "roundOf16",
  quarter_final: "quarterFinals",
  quarter_finals: "quarterFinals",
  quarterfinal: "quarterFinals",
  quarterfinals: "quarterFinals",
  qf: "quarterFinals",
  semi_final: "semiFinals",
  semi_finals: "semiFinals",
  semifinal: "semiFinals",
  semifinals: "semiFinals",
  sf: "semiFinals",
  third_place: "thirdPlace",
  third_place_playoff: "thirdPlace",
  bronze_final: "thirdPlace",
  final: "final",
};

export const knockoutStageLabels: Record<KnockoutStageKey, string> = {
  roundOf32: "32强",
  roundOf16: "16强",
  quarterFinals: "8强",
  semiFinals: "半决赛",
  thirdPlace: "季军赛",
  final: "决赛",
};

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

const quarterFinalKnownPairs: Record<number, Array<[string, string]>> = {
  97: [["France", "Morocco"]],
  98: [["Argentina", "Switzerland"]],
  99: [["Norway", "England"]],
  100: [["Spain", "Belgium"]],
};

const placeholderSourceMap: Record<number, [number, number, "winners" | "losers"]> = {
  97: [89, 90, "winners"],
  98: [93, 94, "winners"],
  99: [91, 92, "winners"],
  100: [95, 96, "winners"],
  101: [97, 100, "winners"],
  102: [99, 98, "winners"],
  103: [101, 102, "losers"],
  104: [101, 102, "winners"],
};

export function normalizeStage(stage?: string | null) {
  return (stage ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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

function normalizePair(homeTeam?: string | null, awayTeam?: string | null) {
  return `${normalizeTeamName(homeTeam ?? "")}__${normalizeTeamName(awayTeam ?? "")}`;
}

function matchPlaceholderPair(match: KnockoutMatch) {
  const home = match.home_team ?? "";
  const away = match.away_team ?? "";
  const homeWinner = home.match(/match\s*(\d+)\s*winners?/i);
  const awayWinner = away.match(/match\s*(\d+)\s*winners?/i);
  const homeLoser = home.match(/match\s*(\d+)\s*losers?/i);
  const awayLoser = away.match(/match\s*(\d+)\s*losers?/i);

  if (homeWinner && awayWinner) {
    return [Number(homeWinner[1]), Number(awayWinner[1]), "winners"] as const;
  }

  if (homeLoser && awayLoser) {
    return [Number(homeLoser[1]), Number(awayLoser[1]), "losers"] as const;
  }

  return null;
}

export function getKnockoutStageKey(stage?: string | null) {
  return knockoutStageMap[normalizeStage(stage)] ?? null;
}

export function inferKnockoutMatchNumber(match: KnockoutMatch) {
  if (match.match_number) return match.match_number;

  const stageKey = getKnockoutStageKey(match.stage);
  const pair = normalizePair(match.home_team, match.away_team);

  if (stageKey === "roundOf32") {
    const inferred = Object.entries(roundOf32ExpectedPairs).find(
      ([, [homeTeam, awayTeam]]) => normalizePair(homeTeam, awayTeam) === pair,
    );
    return inferred ? Number(inferred[0]) : null;
  }

  if (stageKey === "roundOf16") {
    const inferred = Object.entries(roundOf16KnownPairs).find(([, pairs]) =>
      pairs.some(([homeTeam, awayTeam]) => normalizePair(homeTeam, awayTeam) === pair),
    );
    return inferred ? Number(inferred[0]) : null;
  }

  if (stageKey === "quarterFinals") {
    const inferred = Object.entries(quarterFinalKnownPairs).find(([, pairs]) =>
      pairs.some(([homeTeam, awayTeam]) => normalizePair(homeTeam, awayTeam) === pair),
    );
    return inferred ? Number(inferred[0]) : null;
  }

  const placeholderPair = matchPlaceholderPair(match);

  if (placeholderPair) {
    const inferred = Object.entries(placeholderSourceMap).find(
      ([, [homeSource, awaySource, sourceType]]) =>
        homeSource === placeholderPair[0] &&
        awaySource === placeholderPair[1] &&
        sourceType === placeholderPair[2],
    );

    return inferred ? Number(inferred[0]) : null;
  }

  return null;
}

export function formatPlaceholderName(value?: string | null) {
  const raw = (value ?? "").trim();

  if (!raw) return "待定";
  if (/^tbd$/i.test(raw)) return "待定";

  const matchWinner = raw.match(/match\s*(\d+)\s*winners?/i);
  if (matchWinner) return `M${matchWinner[1]} 胜者`;

  const winnerOfMatch = raw.match(/winner\s*of\s*match\s*(\d+)/i);
  if (winnerOfMatch) return `M${winnerOfMatch[1]} 胜者`;

  const matchLoser = raw.match(/match\s*(\d+)\s*losers?/i);
  if (matchLoser) return `M${matchLoser[1]} 负者`;

  const loserOfMatch = raw.match(/loser\s*of\s*match\s*(\d+)/i);
  if (loserOfMatch) return `M${loserOfMatch[1]} 负者`;

  return raw;
}

export function isPlaceholderTeamName(value?: string | null) {
  const raw = (value ?? "").trim();

  return (
    !raw ||
    /^tbd$/i.test(raw) ||
    /match\s*\d+\s*(winner|winners|loser|losers)/i.test(raw) ||
    /(winner|loser)\s*of\s*match\s*\d+/i.test(raw)
  );
}

export function formatTeamDisplayName(team?: string | null): TeamDisplay {
  const raw = (team ?? "").trim();

  if (isPlaceholderTeamName(raw)) {
    return {
      raw,
      label: formatPlaceholderName(raw),
      flag: null,
      isPlaceholder: true,
    };
  }

  const country = resolveCountry(raw);

  return {
    raw,
    label: getCountryDisplayName(raw),
    flag: country?.flag ?? null,
    isPlaceholder: false,
  };
}

export function getKnockoutWinner(match: KnockoutMatch) {
  if (match.advancement_winner === "home") return "home";
  if (match.advancement_winner === "away") return "away";
  return null;
}

export function getWinnerTeam(match: KnockoutMatch) {
  const winner = getKnockoutWinner(match);

  if (winner === "home") return match.home_team;
  if (winner === "away") return match.away_team;
  return null;
}

function sortMatches(left: KnockoutMatch, right: KnockoutMatch) {
  const leftNumber = inferKnockoutMatchNumber(left);
  const rightNumber = inferKnockoutMatchNumber(right);

  if (leftNumber && rightNumber && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  const leftTime = left.start_time ? new Date(left.start_time).getTime() : 0;
  const rightTime = right.start_time ? new Date(right.start_time).getTime() : 0;
  const timeDiff = leftTime - rightTime;

  if (timeDiff !== 0) return timeDiff;

  return (left.match_number ?? 999) - (right.match_number ?? 999);
}

export function groupKnockoutMatches(matches: KnockoutMatch[]): GroupedKnockoutMatches {
  const grouped: GroupedKnockoutMatches = {
    roundOf32: [],
    roundOf16: [],
    quarterFinals: [],
    semiFinals: [],
    thirdPlace: [],
    final: [],
  };

  for (const match of matches) {
    const key = getKnockoutStageKey(match.stage);

    if (key) {
      grouped[key].push(match);
    }
  }

  for (const key of Object.keys(grouped) as KnockoutStageKey[]) {
    grouped[key].sort(sortMatches);
  }

  return grouped;
}

export async function fetchKnockoutMatches() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [] satisfies KnockoutMatch[];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, stage, match_number, home_team, away_team, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner, status, start_time",
    )
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to load knockout matches: ${error.message}`);
  }

  return ((data ?? []) as KnockoutMatch[]).filter((match) =>
    Boolean(getKnockoutStageKey(match.stage)),
  );
}
