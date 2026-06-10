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
  }>;
};

type OddsEvent = {
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
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
  }>;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
};

type SyncOddsOptions = {
  oddsApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
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

function pickBookmaker(event: OddsEvent) {
  return (
    event.bookmakers.find((bookmaker) => bookmaker.key === "bet365") ??
    event.bookmakers[0]
  );
}

function getH2hOutcomes(event: OddsEvent) {
  const bookmaker = pickBookmaker(event);
  return bookmaker?.markets.find((market) => market.key === "h2h")?.outcomes;
}

function getMatchedOdds(match: Match, event: OddsEvent): MatchedOdds | null {
  const eventHomeTeam = normalizeTeamName(event.home_team);
  const eventAwayTeam = normalizeTeamName(event.away_team);
  const matchHomeTeam = normalizeTeamName(match.home_team);
  const matchAwayTeam = normalizeTeamName(match.away_team);
  const isSameOrder =
    matchHomeTeam === eventHomeTeam && matchAwayTeam === eventAwayTeam;
  const isReversedOrder =
    matchHomeTeam === eventAwayTeam && matchAwayTeam === eventHomeTeam;

  if (!isSameOrder && !isReversedOrder) {
    return null;
  }

  const outcomes = getH2hOutcomes(event);

  if (!outcomes) {
    return null;
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
    return null;
  }

  return {
    odds_home: oddsHome,
    odds_draw: oddsDraw,
    odds_away: oddsAway,
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
      `The Odds API error: ${response.status} ${await response.text()}`,
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
}: SyncOddsOptions): Promise<SyncOddsResult> {
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  const { events, credits } = await fetchOdds(oddsApiKey);
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, status")
    .or("status.is.null,status.neq.finished");

  if (matchesError) {
    throw matchesError;
  }

  const eligibleMatches = (matches ?? []).filter(
    (match) =>
      !isPlaceholderTeam(match.home_team) && !isPlaceholderTeam(match.away_team),
  );
  const skipped: SyncOddsResult["skipped"] = [];
  let updated = 0;

  for (const match of eligibleMatches) {
    const matchedOdds = events
      .map((event) => getMatchedOdds(match, event))
      .find((odds) => odds !== null);

    if (!matchedOdds) {
      skipped.push({
        home_team: match.home_team,
        away_team: match.away_team,
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update(matchedOdds)
      .eq("id", match.id);

    if (updateError) {
      throw updateError;
    }

    updated += 1;
  }

  return {
    updated,
    skipped,
    creditsUsed: credits.last,
    creditsRemaining: credits.remaining,
    creditsTotalUsed: credits.used,
  };
}
