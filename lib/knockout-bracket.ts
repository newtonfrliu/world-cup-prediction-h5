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

export function normalizeStage(stage?: string | null) {
  return (stage ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getKnockoutStageKey(stage?: string | null) {
  return knockoutStageMap[normalizeStage(stage)] ?? null;
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
