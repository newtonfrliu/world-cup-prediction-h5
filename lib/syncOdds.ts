import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Match = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  "id" | "home_team" | "away_team" | "status"
>;

type Outcome = {
  name: string;
  price: number;
};

type Bookmaker = {
  key: string;
  title: string;
  markets: Array<{
    key: string;
    outcomes: Outcome[];
  }> | null;
};

type OddsEvent = {
  home_team: string;
  away_team: string;
  bookmakers?: Bookmaker[] | null;
};

type MatchedOdds = {
  odds_home: number;
  odds_draw: number;
  odds_away: number;
};

export type SyncOddsResult = {
  updated: number;
  skipped: Array<{
    home_team: string;
    away_team: string;
    reason?: string;
  }>;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
  settingsWarning?: string;
};

type SyncOddsOptions = {
  oddsApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onStep?: (step: "call_sync_odds" | "update_supabase") => void;
};

const oddsApiUrl =
  "https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds";

function normalizeTeamName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlaceholderTeam(value: string) {
  const normalized = normalizeTeamName(value);

  return (
    /^match\s+\d+\s+winners$/.test(normalized) ||
    /^group\s+[a-z0-9]+\s+winners$/.test(normalized)
  );
}

function getH2hOutcomes(event: OddsEvent): {
  outcomes: Outcome[] | null;
  reason?: string;
} {
  const bookmakers = event.bookmakers ?? [];

  if (bookmakers.length === 0) {
    return { outcomes: null, reason: "No bookmakers found" };
  }

  const bookmakersWithH2h = bookmakers.filter((bookmaker) =>
    (bookmaker.markets ?? []).some((market) => market.key === "h2h"),
  );

  if (bookmakersWithH2h.length === 0) {
    return { outcomes: null, reason: "No h2h market found" };
  }

  const bookmaker =
    bookmakersWithH2h.find((item) => item.key === "bet365") ??
    bookmakersWithH2h[0];
  const market = (bookmaker.markets ?? []).find((item) => item.key === "h2h");

  if (!market?.outcomes || market.outcomes.length === 0) {
    return { outcomes: null, reason: "No outcomes found" };
  }

  return { outcomes: market.outcomes };
}

function getMatchedOdds(
  match: Match,
  event: OddsEvent,
): { odds: MatchedOdds | null; reason?: string } {
  const eventHomeTeam = normalizeTeamName(event.home_team);
  const eventAwayTeam = normalizeTeamName(event.away_team);
  const matchHomeTeam = normalizeTeamName(match.home_team);
  const matchAwayTeam = normalizeTeamName(match.away_team);
  const isSameOrder =
    matchHomeTeam === eventHomeTeam && matchAwayTeam === eventAwayTeam;
  const isReversedOrder =
    matchHomeTeam === eventAwayTeam && matchAwayTeam === eventHomeTeam;

  if (!isSameOrder && !isReversedOrder) {
    return { odds: null };
  }

  const { outcomes, reason } = getH2hOutcomes(event);

  if (!outcomes) {
    return { odds: null, reason };
  }

  const pricesByTeam = new Map(
    outcomes.map((outcome) => [normalizeTeamName(outcome.name), outcome.price]),
  );
  const oddsHome = pricesByTeam.get(matchHomeTeam);
  const oddsDraw = pricesByTeam.get("draw");
  const oddsAway = pricesByTeam.get(matchAwayTeam);

  if (
    typeof oddsHome !== "number" ||
    typeof oddsDraw !== "number" ||
    typeof oddsAway !== "number"
  ) {
    return { odds: null, reason: "No outcomes found" };
  }

  return {
    odds: {
      odds_home: oddsHome,
      odds_draw: oddsDraw,
      odds_away: oddsAway,
    },
  };
}

async function fetchOdds(apiKey: string) {
  const url = new URL(oddsApiUrl);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "uk");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `The Odds API failed: ${response.status} ${await response.text()}`,
    );
  }

  const events = (await response.json()) as OddsEvent[];

  return {
    events,
    credits: {
      last: response.headers.get("x-requests-last"),
      remaining: response.headers.get("x-requests-remaining"),
      used: response.headers.get("x-requests-used"),
    },
  };
}

export async function syncWorldCupOdds({
  oddsApiKey,
  supabaseUrl,
  supabaseAnonKey,
  onStep,
}: SyncOddsOptions): Promise<SyncOddsResult> {
  if (!oddsApiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing Supabase anon key");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  onStep?.("call_sync_odds");
  const { events, credits } = await fetchOdds(oddsApiKey);
  onStep?.("update_supabase");
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, status")
    .or("status.is.null,status.neq.finished");

  if (matchesError) {
    throw new Error(`Supabase update failed: ${matchesError.message}`);
  }

  const eligibleMatches = (matches ?? []).filter(
    (match) =>
      !isPlaceholderTeam(match.home_team) && !isPlaceholderTeam(match.away_team),
  );
  const skipped: SyncOddsResult["skipped"] = [];
  let updated = 0;

  for (const match of eligibleMatches) {
    const matchedResult = events
      .map((event) => getMatchedOdds(match, event))
      .find((result) => result.odds !== null || result.reason);

    if (!matchedResult?.odds) {
      skipped.push({
        home_team: match.home_team,
        away_team: match.away_team,
        reason: matchedResult?.reason ?? "No matched odds found",
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update(matchedResult.odds)
      .eq("id", match.id);

    if (updateError) {
      throw new Error(`Supabase update failed: ${updateError.message}`);
    }

    updated += 1;
  }

  const syncedAt = new Date().toISOString();
  const { error: settingError } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "last_odds_sync",
        value: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: "key" },
    );

  const settingsWarning = settingError
    ? `Supabase update failed: ${settingError.message}`
    : undefined;

  return {
    updated,
    skipped,
    creditsUsed: credits.last,
    creditsRemaining: credits.remaining,
    creditsTotalUsed: credits.used,
    settingsWarning,
  };
}
