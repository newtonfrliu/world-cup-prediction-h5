import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const sportKey = "soccer_fifa_world_cup";
const apiBaseUrl = "https://api.the-odds-api.com/v4";
const defaultLimit = 8;
const marketProbeGroups = [
  ["h2h"],
  ["h2h_3_way", "match_winner", "winner"],
  ["draw_no_bet", "btts"],
  ["spreads", "totals"],
  ["alternate_spreads", "alternate_totals"],
  ["h2h_h1", "h2h_3_way_h1", "totals_h1", "spreads_h1"],
  [
    "qualify",
    "qualification",
    "advance",
    "advances",
    "to_qualify",
    "team_to_advance",
  ],
  ["outrights"],
];
const advancementKeywords = [
  "qualify",
  "qualification",
  "advance",
  "advances",
  "to_qualify",
  "team_to_advance",
];

type ApiCredits = {
  last: string | null;
  remaining: string | null;
  used: string | null;
};

type OddsEvent = {
  id: string;
  sport_key?: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

type Outcome = {
  name: string;
  price: number;
  point?: number;
  description?: string;
};

type Market = {
  key: string;
  outcomes?: Outcome[];
};

type Bookmaker = {
  key: string;
  title: string;
  markets?: Market[];
};

type EventOdds = OddsEvent & {
  bookmakers?: Bookmaker[];
};

type LocalMatch = {
  id: string;
  match_number: number | null;
  home_team: string;
  away_team: string;
  start_time: string;
  stage: string | null;
  status: string | null;
};

type EventAudit = {
  event: OddsEvent;
  local_match_id: string | null;
  local_match_number: number | null;
  local_stage: string | null;
  marketEndpointStatus: string;
  marketKeys: string[];
  bookmakerMarkets: Array<{
    bookmaker: string;
    title: string;
    markets: string[];
  }>;
  oddsSamples: Array<{
    bookmaker: string;
    title: string;
    market: string;
    outcome: string;
    price: number;
    point: number | null;
    description: string | null;
  }>;
};

function loadLocalEnv() {
  const envFilePath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envFilePath)) return;

  const envText = readFileSync(envFilePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseLimit() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const value = limitArg ? Number(limitArg.split("=")[1]) : defaultLimit;

  if (!Number.isFinite(value) || value <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(value), 20);
}

function getCredits(response: Response): ApiCredits {
  return {
    last: response.headers.get("x-requests-last"),
    remaining: response.headers.get("x-requests-remaining"),
    used: response.headers.get("x-requests-used"),
  };
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

function isKnockoutStage(stage: string | null | undefined) {
  const normalized = (stage ?? "").trim().toLowerCase();

  return [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
    "knockout",
  ].includes(normalized);
}

function matchLocalEvent(event: OddsEvent, matches: LocalMatch[]) {
  const eventHome = normalizeTeamName(event.home_team);
  const eventAway = normalizeTeamName(event.away_team);
  const eventTime = new Date(event.commence_time).getTime();

  return (
    matches.find((match) => {
      const matchHome = normalizeTeamName(match.home_team);
      const matchAway = normalizeTeamName(match.away_team);
      const matchTime = new Date(match.start_time).getTime();
      const teamsMatch =
        (eventHome === matchHome && eventAway === matchAway) ||
        (eventHome === matchAway && eventAway === matchHome);

      if (!teamsMatch || Number.isNaN(eventTime) || Number.isNaN(matchTime)) {
        return false;
      }

      return Math.abs(eventTime - matchTime) <= 6 * 60 * 60 * 1000;
    }) ?? null
  );
}

async function fetchJson<T>(url: URL) {
  const response = await fetch(url);
  const credits = getCredits(response);
  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      credits,
      error: text,
      data: null,
    };
  }

  return {
    ok: true as const,
    status: response.status,
    credits,
    error: null,
    data: JSON.parse(text) as T,
  };
}

async function fetchEvents(apiKey: string) {
  const url = new URL(`${apiBaseUrl}/sports/${sportKey}/events`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("dateFormat", "iso");

  return fetchJson<OddsEvent[]>(url);
}

async function fetchMarkets(apiKey: string, eventId: string) {
  const url = new URL(`${apiBaseUrl}/sports/${sportKey}/events/${eventId}/markets`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "uk,eu,us,au");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  return fetchJson<unknown>(url);
}

function parseMarketKeys(data: unknown) {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "key" in item) {
          return String((item as { key: unknown }).key);
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof data === "object" && "markets" in data) {
    return parseMarketKeys((data as { markets: unknown }).markets);
  }

  return [];
}

async function fetchEventOdds(
  apiKey: string,
  eventId: string,
  markets: string[],
  mode: "regions" | "bet365",
) {
  const url = new URL(`${apiBaseUrl}/sports/${sportKey}/events/${eventId}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("markets", markets.join(","));
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  if (mode === "bet365") {
    url.searchParams.set("bookmakers", "bet365");
  } else {
    url.searchParams.set("regions", "uk,eu,us,au");
  }

  return fetchJson<EventOdds>(url);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function collectMarketsFromOdds(eventOdds: EventOdds | null) {
  const bookmakerMarkets =
    eventOdds?.bookmakers?.map((bookmaker) => ({
      bookmaker: bookmaker.key,
      title: bookmaker.title,
      markets: unique((bookmaker.markets ?? []).map((market) => market.key)),
    })) ?? [];
  const marketKeys = unique(
    bookmakerMarkets.flatMap((bookmaker) => bookmaker.markets),
  );

  return { bookmakerMarkets, marketKeys };
}

function collectOddsSamples(eventOdds: EventOdds | null) {
  const samples: EventAudit["oddsSamples"] = [];

  for (const bookmaker of eventOdds?.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        samples.push({
          bookmaker: bookmaker.key,
          title: bookmaker.title,
          market: market.key,
          outcome: outcome.name,
          price: outcome.price,
          point: typeof outcome.point === "number" ? outcome.point : null,
          description:
            typeof outcome.description === "string"
              ? outcome.description
              : null,
        });
      }
    }
  }

  return samples;
}

function mergeEventOdds(events: Array<EventOdds | null>) {
  const mergedBookmakers = new Map<string, Bookmaker>();
  let baseEvent: EventOdds | null = null;

  for (const eventOdds of events) {
    if (!eventOdds) continue;
    baseEvent ??= eventOdds;

    for (const bookmaker of eventOdds.bookmakers ?? []) {
      const existing = mergedBookmakers.get(bookmaker.key);

      if (!existing) {
        mergedBookmakers.set(bookmaker.key, {
          ...bookmaker,
          markets: [...(bookmaker.markets ?? [])],
        });
        continue;
      }

      const marketMap = new Map(
        (existing.markets ?? []).map((market) => [market.key, market]),
      );

      for (const market of bookmaker.markets ?? []) {
        marketMap.set(market.key, market);
      }

      existing.markets = Array.from(marketMap.values());
    }
  }

  if (!baseEvent) return null;

  return {
    ...baseEvent,
    bookmakers: Array.from(mergedBookmakers.values()),
  };
}

async function probeEventMarkets(apiKey: string, eventId: string) {
  const oddsResults: Array<EventOdds | null> = [];
  const credits: ApiCredits[] = [];

  for (const markets of marketProbeGroups) {
    const regionsResult = await fetchEventOdds(apiKey, eventId, markets, "regions");
    credits.push(regionsResult.credits);

    if (regionsResult.ok && (regionsResult.data?.bookmakers ?? []).length > 0) {
      oddsResults.push(regionsResult.data);
      continue;
    }

    const bet365Result = await fetchEventOdds(apiKey, eventId, markets, "bet365");
    credits.push(bet365Result.credits);

    if (bet365Result.ok && (bet365Result.data?.bookmakers ?? []).length > 0) {
      oddsResults.push(bet365Result.data);
    }
  }

  return {
    oddsData: mergeEventOdds(oddsResults),
    credits,
  };
}

function hasAdvancementMarket(markets: string[]) {
  return markets.some((market) =>
    advancementKeywords.some((keyword) => market.toLowerCase().includes(keyword)),
  );
}

function chooseEvents(events: OddsEvent[], localMatches: LocalMatch[], limit: number) {
  const now = Date.now();
  const withLocal = events.map((event) => ({
    event,
    localMatch: matchLocalEvent(event, localMatches),
  }));
  const knockoutUpcoming = withLocal
    .filter(
      ({ event, localMatch }) =>
        new Date(event.commence_time).getTime() >= now &&
        localMatch &&
        isKnockoutStage(localMatch.stage) &&
        localMatch.status !== "finished",
    )
    .sort(
      (a, b) =>
        new Date(a.event.commence_time).getTime() -
        new Date(b.event.commence_time).getTime(),
    );

  const fallback = withLocal
    .filter(({ event }) => new Date(event.commence_time).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.event.commence_time).getTime() -
        new Date(b.event.commence_time).getTime(),
    );

  return (knockoutUpcoming.length > 0 ? knockoutUpcoming : fallback).slice(
    0,
    limit,
  );
}

async function loadLocalMatches() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_number, home_team, away_team, start_time, stage, status")
    .order("start_time", { ascending: true });

  if (error) {
    console.warn(`Unable to load local matches for matching: ${error.message}`);
    return [];
  }

  return (data ?? []) as LocalMatch[];
}

function buildReport(params: {
  eventsCount: number;
  audited: EventAudit[];
  credits: ApiCredits[];
  marketEndpointNotes: string[];
}) {
  const advancementFound = params.audited.some((audit) =>
    hasAdvancementMarket(audit.marketKeys),
  );
  const lines = [
    "# The Odds API World Cup Markets Audit",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Scope",
    "",
    `- Sport key: \`${sportKey}\``,
    `- API events returned: ${params.eventsCount}`,
    `- Events audited: ${params.audited.length}`,
    "- Database was not modified.",
    "- UI / business logic was not modified.",
    "",
    "## Credit Headers",
    "",
    "| Request # | x-requests-last | x-requests-remaining | x-requests-used |",
    "| ---: | --- | --- | --- |",
    ...params.credits.map(
      (credit, index) =>
        `| ${index + 1} | ${credit.last ?? "-"} | ${credit.remaining ?? "-"} | ${credit.used ?? "-"} |`,
    ),
    "",
    "## Markets Endpoint Notes",
    "",
    ...(params.marketEndpointNotes.length > 0
      ? params.marketEndpointNotes.map((note) => `- ${note}`)
      : ["- No endpoint errors recorded."]),
    "",
    "## Event Market Summary",
    "",
  ];

  for (const audit of params.audited) {
    lines.push(
      `### ${audit.event.home_team} vs ${audit.event.away_team}`,
      "",
      `- Event id: \`${audit.event.id}\``,
      `- Local match id: ${audit.local_match_id ? `\`${audit.local_match_id}\`` : "-"}`,
      `- Local match number: ${audit.local_match_number ? `M${audit.local_match_number}` : "-"}`,
      `- Local stage: ${audit.local_stage ?? "-"}`,
      `- Commence time: ${audit.event.commence_time}`,
      `- Markets endpoint: ${audit.marketEndpointStatus}`,
      `- Market keys: ${audit.marketKeys.length > 0 ? audit.marketKeys.map((market) => `\`${market}\``).join(", ") : "-"}`,
      "",
      "| Bookmaker | Markets |",
      "| --- | --- |",
    );

    if (audit.bookmakerMarkets.length === 0) {
      lines.push("| - | - |");
    } else {
      for (const bookmaker of audit.bookmakerMarkets) {
        lines.push(
          `| ${bookmaker.title} (${bookmaker.bookmaker}) | ${bookmaker.markets.map((market) => `\`${market}\``).join(", ")} |`,
        );
      }
    }

    lines.push("", "#### Odds Samples", "", "| Bookmaker | Market | Outcome | Price | Point | Description |", "| --- | --- | --- | ---: | --- | --- |");

    if (audit.oddsSamples.length === 0) {
      lines.push("| - | - | - | - | - | - |");
    } else {
      for (const sample of audit.oddsSamples.slice(0, 80)) {
        lines.push(
          `| ${sample.title} (${sample.bookmaker}) | \`${sample.market}\` | ${sample.outcome} | ${sample.price} | ${sample.point ?? "-"} | ${sample.description ?? "-"} |`,
        );
      }
    }

    lines.push("");
  }

  lines.push(
    "## Advancement / Qualify Market Check",
    "",
    advancementFound
      ? "- Found at least one market key containing qualify / advance keywords. Review the event sections above before integrating."
      : "- The Odds API 当前返回中未发现稳定的晋级盘口，需要手动录入或换 API。",
    "",
    "## Recommended Integrations",
    "",
    "- 90分钟胜平负：use `h2h` only if it is confirmed as three-way regular-time pricing from the bookmaker feed.",
    "- 晋级投注：only integrate if a stable qualify / advance market appears in this audit.",
    "- 大小球：`totals` / `alternate_totals` if returned.",
    "- 双方进球：`btts` if returned.",
    "- 让球：`spreads` / `alternate_spreads` if returned.",
    "- 平局退款：`draw_no_bet` if returned.",
    "- 半场胜平负：`h2h_h1` / `h2h_3_way_h1` if returned.",
    "",
  );

  return lines.join("\n");
}

async function main() {
  loadLocalEnv();

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  const limit = parseLimit();
  const credits: ApiCredits[] = [];
  const marketEndpointNotes: string[] = [];
  const eventsResult = await fetchEvents(apiKey);
  credits.push(eventsResult.credits);

  if (!eventsResult.ok) {
    throw new Error(`Events request failed: ${eventsResult.status} ${eventsResult.error}`);
  }

  const events = eventsResult.data ?? [];
  const localMatches = await loadLocalMatches();
  const selectedEvents = chooseEvents(events, localMatches, limit);
  const audited: EventAudit[] = [];

  for (const { event, localMatch } of selectedEvents) {
    const marketsResult = await fetchMarkets(apiKey, event.id);
    credits.push(marketsResult.credits);

    let marketKeys = marketsResult.ok
      ? parseMarketKeys(marketsResult.data)
      : [];
    let marketEndpointStatus = marketsResult.ok
      ? `ok (${marketKeys.length} market keys)`
      : `failed ${marketsResult.status}`;

    if (!marketsResult.ok) {
      marketEndpointNotes.push(
        `${event.home_team} vs ${event.away_team}: /markets returned ${marketsResult.status}. Falling back to candidate market odds probing.`,
      );
    }

    if (marketKeys.length === 0) {
      const probeResult = await probeEventMarkets(apiKey, event.id);
      credits.push(...probeResult.credits);
      const oddsData = probeResult.oddsData;

      const collected = collectMarketsFromOdds(oddsData);
      marketKeys = collected.marketKeys;
      marketEndpointStatus =
        marketEndpointStatus === "ok (0 market keys)"
          ? "ok but empty; used odds probing"
          : `${marketEndpointStatus}; used odds probing`;

      audited.push({
        event,
        local_match_id: localMatch?.id ?? null,
        local_match_number: localMatch?.match_number ?? null,
        local_stage: localMatch?.stage ?? null,
        marketEndpointStatus,
        marketKeys,
        bookmakerMarkets: collected.bookmakerMarkets,
        oddsSamples: collectOddsSamples(oddsData),
      });
      continue;
    }

    const regionsOdds = await fetchEventOdds(apiKey, event.id, marketKeys, "regions");
    credits.push(regionsOdds.credits);
    let oddsData = regionsOdds.ok ? regionsOdds.data : null;

    if (!regionsOdds.ok || (oddsData?.bookmakers ?? []).length === 0) {
      const bet365Odds = await fetchEventOdds(apiKey, event.id, marketKeys, "bet365");
      credits.push(bet365Odds.credits);
      oddsData = bet365Odds.ok ? bet365Odds.data : oddsData;
    }

    const collected = collectMarketsFromOdds(oddsData);
    audited.push({
      event,
      local_match_id: localMatch?.id ?? null,
      local_match_number: localMatch?.match_number ?? null,
      local_stage: localMatch?.stage ?? null,
      marketEndpointStatus,
      marketKeys: collected.marketKeys.length > 0 ? collected.marketKeys : marketKeys,
      bookmakerMarkets: collected.bookmakerMarkets,
      oddsSamples: collectOddsSamples(oddsData),
    });
  }

  const report = buildReport({
    eventsCount: events.length,
    audited,
    credits,
    marketEndpointNotes,
  });
  const reportPath = path.join(process.cwd(), "docs", "ODDS_MARKETS_AUDIT.md");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, "utf8");

  console.log(`World Cup events returned: ${events.length}`);
  console.log(`Events audited: ${audited.length}`);
  console.log(
    `Advancement market found: ${audited.some((audit) => hasAdvancementMarket(audit.marketKeys)) ? "yes" : "no"}`,
  );
  console.log(`Report written: ${reportPath}`);
  const lastCredits = credits.at(-1);
  console.log(
    `Credits last=${lastCredits?.last ?? "-"} remaining=${lastCredits?.remaining ?? "-"} used=${lastCredits?.used ?? "-"}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
