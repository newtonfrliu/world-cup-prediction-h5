import { createClient } from "@supabase/supabase-js";

import {
  assertWorldCupApiUpdateAllowed,
  getWorldCupApiUpdateStoppedMessage,
  isWorldCupApiUpdateStopped,
} from "./worldCupFinalUpdate.ts";
import type { Database } from "@/types/database";

type Match = Pick<
  Database["public"]["Tables"]["matches"]["Row"],
  "id" | "home_team" | "away_team" | "status"
>;

type Outcome = {
  name: string;
  price: number;
  point?: number;
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
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
}

function getUnmatchedOddsDiagnostics(match: Match, events: OddsEvent[]) {
  const normalizedHome = normalizeTeamName(match.home_team);
  const normalizedAway = normalizeTeamName(match.away_team);
  const apiCandidates = events
    .map((event) => ({
      apiHome: event.home_team,
      apiAway: event.away_team,
      normalizedApiHome: normalizeTeamName(event.home_team),
      normalizedApiAway: normalizeTeamName(event.away_team),
    }))
    .filter((event) => {
      const apiTeams = [event.normalizedApiHome, event.normalizedApiAway];

      return (
        apiTeams.includes(normalizedHome) ||
        apiTeams.includes(normalizedAway) ||
        event.normalizedApiHome.includes(normalizedHome) ||
        event.normalizedApiAway.includes(normalizedAway) ||
        normalizedHome.includes(event.normalizedApiHome) ||
        normalizedAway.includes(event.normalizedApiAway)
      );
    })
    .slice(0, 5);

  return {
    dbHome: match.home_team,
    dbAway: match.away_team,
    normalizedHome,
    normalizedAway,
    apiCandidates,
  };
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
  bookmaker?: Bookmaker;
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

  return { outcomes: market.outcomes, bookmaker };
}

function getFirstCompleteTotals(event: OddsEvent): {
  over: Outcome;
  under: Outcome;
  line: number;
  bookmaker: Bookmaker;
} | null {
  const bookmakers = event.bookmakers ?? [];
  const bookmakersWithTotals = bookmakers.filter((bookmaker) =>
    (bookmaker.markets ?? []).some((market) => market.key === "totals"),
  );
  const orderedBookmakers = [
    ...bookmakersWithTotals.filter((bookmaker) => bookmaker.key === "bet365"),
    ...bookmakersWithTotals.filter((bookmaker) => bookmaker.key !== "bet365"),
  ];

  for (const bookmaker of orderedBookmakers) {
    const market = (bookmaker.markets ?? []).find(
      (item) => item.key === "totals",
    );
    const outcomes = market?.outcomes ?? [];

    for (const outcome of outcomes) {
      const line = outcome.point;

      if (typeof line !== "number") {
        continue;
      }

      const sameLine = outcomes.filter((item) => item.point === line);
      const over = sameLine.find(
        (item) => item.name.trim().toLowerCase() === "over",
      );
      const under = sameLine.find(
        (item) => item.name.trim().toLowerCase() === "under",
      );

      if (over && under) {
        return { over, under, line, bookmaker };
      }
    }
  }

  return null;
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

async function syncBettingMarkets(
  supabase: ReturnType<typeof createClient<Database>>,
  match: Match,
  event: OddsEvent,
) {
  const h2hResult = getH2hOutcomes(event);
  const marketRows: Database["public"]["Tables"]["match_betting_markets"]["Insert"][] =
    [];

  if (h2hResult.outcomes) {
    const pricesByTeam = new Map(
      h2hResult.outcomes.map((outcome) => [
        normalizeTeamName(outcome.name),
        outcome.price,
      ]),
    );
    const homeOdds = pricesByTeam.get(normalizeTeamName(match.home_team));
    const drawOdds = pricesByTeam.get("draw");
    const awayOdds = pricesByTeam.get(normalizeTeamName(match.away_team));

    if (typeof homeOdds === "number") {
      marketRows.push({
        match_id: match.id,
        market_key: "h2h_90",
        selection_key: "home_win",
        selection_label: "主胜",
        odds: homeOdds,
        line: 0,
        source: "the_odds_api",
        bookmaker: h2hResult.bookmaker?.key ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    if (typeof drawOdds === "number") {
      marketRows.push({
        match_id: match.id,
        market_key: "h2h_90",
        selection_key: "draw",
        selection_label: "平",
        odds: drawOdds,
        line: 0,
        source: "the_odds_api",
        bookmaker: h2hResult.bookmaker?.key ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    if (typeof awayOdds === "number") {
      marketRows.push({
        match_id: match.id,
        market_key: "h2h_90",
        selection_key: "away_win",
        selection_label: "客胜",
        odds: awayOdds,
        line: 0,
        source: "the_odds_api",
        bookmaker: h2hResult.bookmaker?.key ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const totals = getFirstCompleteTotals(event);

  if (totals) {
    const { error: deactivateError } = await supabase
      .from("match_betting_markets")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("match_id", match.id)
      .eq("market_key", "totals_90")
      .neq("line", totals.line);

    if (deactivateError) {
      throw new Error(`Supabase update failed: ${deactivateError.message}`);
    }

    marketRows.push(
      {
        match_id: match.id,
        market_key: "totals_90",
        selection_key: "over",
        selection_label: `大 ${totals.line}`,
        odds: totals.over.price,
        line: totals.line,
        source: "the_odds_api",
        bookmaker: totals.bookmaker.key,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        match_id: match.id,
        market_key: "totals_90",
        selection_key: "under",
        selection_label: `小 ${totals.line}`,
        odds: totals.under.price,
        line: totals.line,
        source: "the_odds_api",
        bookmaker: totals.bookmaker.key,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
    );
  } else {
    console.warn("totals market incomplete or unavailable", {
      home_team: match.home_team,
      away_team: match.away_team,
    });
  }

  if (marketRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("match_betting_markets")
    .upsert(marketRows, {
      onConflict: "match_id,market_key,selection_key,line",
    });

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }
}

async function fetchOdds(apiKey: string) {
  assertWorldCupApiUpdateAllowed();

  const url = new URL(oddsApiUrl);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "uk");
  url.searchParams.set("markets", "h2h,totals");
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
  if (isWorldCupApiUpdateStopped()) {
    return {
      updated: 0,
      skipped: [
        {
          home_team: "World Cup API updates",
          away_team: "stopped",
          reason: getWorldCupApiUpdateStoppedMessage(),
        },
      ],
      creditsUsed: null,
      creditsRemaining: null,
      creditsTotalUsed: null,
      settingsWarning: getWorldCupApiUpdateStoppedMessage(),
    };
  }

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
      console.warn("unmatched odds match:", {
        ...getUnmatchedOddsDiagnostics(match, events),
        reason: matchedResult?.reason ?? "No matched odds found",
      });
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

    const event = events.find(
      (item) => getMatchedOdds(match, item).odds !== null,
    );

    if (event) {
      await syncBettingMarkets(supabase, match, event);
    }

    updated += 1;
  }

  const syncedAt = new Date().toISOString();
  const { error: settingError } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "last_odds_sync",
        value: {
          syncedAt,
          updated,
          skipped: skipped.length,
          creditsUsed: credits.last,
          creditsRemaining: credits.remaining,
          creditsTotalUsed: credits.used,
        },
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
