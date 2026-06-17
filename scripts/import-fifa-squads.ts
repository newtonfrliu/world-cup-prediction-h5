import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

const squadPdfUrl =
  "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf";
const outputPath = path.join(process.cwd(), "data", "fifa-2026-squads.json");
const sqlOutputPath = path.join(
  process.cwd(),
  "supabase_fifa_squads_migration.sql",
);
const rosterSource = "fifa_official_squad";
const rosterVersion = "2026_world_cup_final_squad_fifa_pdf_v1";

type SquadPlayer = {
  country: string;
  country_code: string;
  shirt_number: number;
  position: string;
  player_name: string;
  first_name: string;
  last_name: string;
  name_on_shirt: string;
  dob: string;
  club: string;
  height_cm: number | null;
  caps: number | null;
  goals: number | null;
};

type SquadCountry = {
  country: string;
  country_code: string;
  players: SquadPlayer[];
};

type PlayerCardRow = {
  id: string;
  team: string;
  player_name: string;
  player_name_en: string | null;
  shirt_number: number | null;
  rarity: string | null;
  price: number | null;
  star_level: number | null;
  card_art_url: string | null;
  card_thumb_url: string | null;
  roster_source: string | null;
};

const preservedArtByOfficialName: Record<string, string> = {
  "Brazil:VINICIUS JUNIOR": "/cards/brazil/vinicius.png",
  "Brazil:CASEMIRO": "/cards/brazil/casemiro.png",
  "Brazil:NEYMAR JR": "/cards/brazil/neymar.png",
};

const legacyNameAliases: Record<string, string> = {
  "brazil:neymar": "neymar jr",
};

function loadLocalEnv() {
  const envFilePath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envFilePath)) {
    return;
  }

  const envText = readFileSync(envFilePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function cleanText(value: string) {
  return value.replace(/\u0000/g, "fi").trim();
}

function normalizeKey(value: string | null | undefined) {
  return cleanText(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePersonKey(value: string | null | undefined) {
  return normalizeKey(value).split(" ").filter(Boolean).sort().join(" ");
}

function getLegacyMatchKey(team: string, value: string | null | undefined) {
  const normalized = normalizeKey(value);

  return legacyNameAliases[`${team.toLowerCase()}:${normalized}`] ?? normalized;
}

function getSquadPlayerKeys(player: SquadPlayer) {
  return new Set(
    [
      player.player_name,
      `${player.first_name} ${player.last_name}`,
      player.name_on_shirt,
      player.first_name,
    ]
      .map(normalizePersonKey)
      .filter(Boolean),
  );
}

function getPlayerCardKeys(card: PlayerCardRow) {
  return new Set(
    [
      card.player_name_en,
      card.player_name,
      getLegacyMatchKey(card.team, card.player_name_en),
      getLegacyMatchKey(card.team, card.player_name),
    ]
      .map(normalizePersonKey)
      .filter(Boolean),
  );
}

function escapeSql(value: string | number | null) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `'${value.replace(/'/g, "''")}'`;
}

function parseNumber(value: string) {
  const number = Number(cleanText(value));

  return Number.isFinite(number) ? number : null;
}

function parsePlayerLine(line: string, country: string, countryCode: string, shirtNumber: number) {
  const parts = line.split(/\t+/).map(cleanText).filter(Boolean);
  const firstColumn = parts[0] ?? "";
  const firstColumnMatch = firstColumn.match(/^(GK|DF|MF|FW)\s+(.+)$/);

  if (!firstColumnMatch || parts.length < 9) {
    return null;
  }

  return {
    country,
    country_code: countryCode,
    shirt_number: shirtNumber,
    position: firstColumnMatch[1],
    player_name: firstColumnMatch[2],
    first_name: parts[1] ?? "",
    last_name: parts[2] ?? "",
    name_on_shirt: parts[3] ?? "",
    dob: parts[4] ?? "",
    club: parts[5] ?? "",
    height_cm: parseNumber(parts[6] ?? ""),
    caps: parseNumber(parts[7] ?? ""),
    goals: parseNumber(parts[8] ?? ""),
  } satisfies SquadPlayer;
}

function parseSquadsFromText(text: string) {
  const lines = text.split(/\r?\n/).map(cleanText);
  const countries: SquadCountry[] = [];
  let index = 0;

  while (index < lines.length) {
    const headerMatch = lines[index]?.match(/^(.+?) \(([A-Z]{3})\)$/);

    if (!headerMatch || lines[index + 1]?.startsWith("# POS") !== true) {
      index += 1;
      continue;
    }

    const country = headerMatch[1];
    const countryCode = headerMatch[2];
    const players: SquadPlayer[] = [];
    index += 2;

    while (index < lines.length && !lines[index].startsWith("ROLE ")) {
      const line = lines[index];

      if (/^(GK|DF|MF|FW)\s+/.test(line)) {
        const player = parsePlayerLine(
          line,
          country,
          countryCode,
          players.length + 1,
        );

        if (player) {
          players.push(player);
        }
      }

      index += 1;
    }

    countries.push({
      country,
      country_code: countryCode,
      players,
    });
  }

  return countries;
}

function getRarityAndPrice(player: SquadPlayer) {
  const key = `${player.country}:${player.player_name}`;
  const legendPlayers = new Set([
    "Argentina:MESSI Lionel",
    "Brazil:NEYMAR JR",
    "Brazil:VINICIUS JUNIOR",
    "England:BELLINGHAM Jude",
    "England:KANE Harry",
    "France:MBAPPE Kylian",
    "Netherlands:VAN DIJK Virgil",
    "Portugal:RONALDO Cristiano",
    "Spain:RODRI",
    "Spain:YAMAL Lamine",
  ]);

  if (legendPlayers.has(key)) {
    return { rarity: "legend", price: 70000, star_level: 5 };
  }

  if (player.caps !== null && player.caps >= 50) {
    return { rarity: "epic", price: 40000, star_level: 4 };
  }

  if (player.caps !== null && player.caps >= 20) {
    return { rarity: "rare", price: 20000, star_level: 3 };
  }

  if (player.caps !== null && player.caps >= 5) {
    return { rarity: "common", price: 10000, star_level: 2 };
  }

  return { rarity: "common", price: 5000, star_level: 1 };
}

function getCardArtUrl(player: SquadPlayer, existingCard?: PlayerCardRow) {
  const preservedArt =
    preservedArtByOfficialName[`${player.country}:${player.player_name}`];

  return preservedArt ?? existingCard?.card_art_url ?? null;
}

function buildFifaSquadsSql(players: SquadPlayer[]) {
  const teams = [...new Set(players.map((player) => player.country))];
  const insertValues = players.map((player) => {
    const rarity = getRarityAndPrice(player);
    const artUrl = preservedArtByOfficialName[`${player.country}:${player.player_name}`] ?? null;

    return `(${[
      escapeSql(player.country),
      escapeSql(player.country_code),
      escapeSql(player.shirt_number),
      escapeSql(player.position),
      escapeSql(player.name_on_shirt || player.player_name),
      escapeSql(player.player_name),
      escapeSql(player.first_name),
      escapeSql(player.last_name),
      escapeSql(player.name_on_shirt),
      escapeSql(player.dob),
      escapeSql(player.club),
      escapeSql(player.height_cm),
      escapeSql(player.caps),
      escapeSql(player.goals),
      escapeSql(rarity.rarity),
      escapeSql(rarity.price),
      escapeSql(rarity.star_level),
      escapeSql(artUrl),
      escapeSql(artUrl),
    ].join(", ")})`;
  });

  const inactiveSql = `update public.player_cards
set roster_source = 'inactive',
    roster_version = '${rosterVersion}',
    shirt_number = null
where team in (${teams.map((team) => escapeSql(team)).join(", ")})
  and roster_source is distinct from '${rosterSource}';`;

  const insertSql = insertValues.length
    ? `-- Upsert the full FIFA official squad by the real unique key.
insert into public.player_cards (
  team,
  player_name,
  player_name_en,
  country_code,
  position,
  shirt_number,
  first_name,
  last_name,
  name_on_shirt,
  dob,
  club,
  height_cm,
  caps,
  goals,
  rarity,
  price,
  star_level,
  card_art_url,
  card_thumb_url,
  roster_source,
  roster_version
)
values
${insertValues.join(",\n")}
on conflict (team, shirt_number)
do update set
  player_name = excluded.player_name,
  player_name_en = excluded.player_name_en,
  country_code = excluded.country_code,
  position = excluded.position,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  name_on_shirt = excluded.name_on_shirt,
  dob = excluded.dob,
  club = excluded.club,
  height_cm = excluded.height_cm,
  caps = excluded.caps,
  goals = excluded.goals,
  rarity = excluded.rarity,
  price = excluded.price,
  star_level = excluded.star_level,
  card_art_url = coalesce(excluded.card_art_url, public.player_cards.card_art_url),
  card_thumb_url = coalesce(excluded.card_thumb_url, public.player_cards.card_thumb_url),
  roster_source = '${rosterSource}',
  roster_version = '${rosterVersion}';`
    : "-- No official cards to upsert.";

  return `begin;

alter table public.player_cards
  add column if not exists country_code text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists name_on_shirt text,
  add column if not exists dob text,
  add column if not exists club text,
  add column if not exists height_cm integer,
  add column if not exists caps integer,
  add column if not exists goals integer,
  add column if not exists roster_source text default 'current_pool',
  add column if not exists roster_version text default 'pre_2026_world_cup_final_squad',
  add column if not exists card_art_url text,
  add column if not exists card_thumb_url text,
  add column if not exists price integer default 5000,
  add column if not exists star_level integer default 1;

-- Mark old non-official cards as inactive and release their shirt numbers.
-- Do not delete them, so user_cards keeps historical assets intact.
${inactiveSql}

${insertSql}

commit;
`;
}

async function downloadAndParseSquads() {
  const response = await fetch(squadPdfUrl);

  if (!response.ok) {
    throw new Error(`Failed to download FIFA squad PDF: ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();

  const countries = parseSquadsFromText(result.text);
  const players = countries.flatMap((country) => country.players);

  return {
    source_url: squadPdfUrl,
    roster_source: rosterSource,
    roster_version: rosterVersion,
    generated_at: new Date().toISOString(),
    country_count: countries.length,
    player_count: players.length,
    countries,
    players,
  };
}

async function syncPlayerCards(players: SquadPlayer[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("Supabase env missing. Wrote JSON only.");
    return { inactiveCards: [] as PlayerCardRow[] };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const teams = [...new Set(players.map((player) => player.country))];
  const { data: existingCards, error: existingCardsError } = await supabase
    .from("player_cards")
    .select(
      "id, team, player_name, player_name_en, shirt_number, rarity, price, star_level, card_art_url, card_thumb_url, roster_source",
    )
    .in("team", teams);

  if (existingCardsError) {
    throw new Error(`Failed to load player_cards: ${existingCardsError.message}`);
  }

  const existing = (existingCards ?? []) as PlayerCardRow[];
  const officialByTeam = new Map<string, SquadPlayer[]>();

  for (const player of players) {
    const teamPlayers = officialByTeam.get(player.country) ?? [];
    teamPlayers.push(player);
    officialByTeam.set(player.country, teamPlayers);
  }

  const matchedCards = new Set<string>();
  const matchesByPlayer = new Map<SquadPlayer, PlayerCardRow>();

  for (const player of players) {
    const officialKeys = getSquadPlayerKeys(player);
    const match = existing.find((card) => {
      if (card.team !== player.country || matchedCards.has(card.id)) {
        return false;
      }

      const cardKeys = getPlayerCardKeys(card);

      return [...cardKeys].some((key) => officialKeys.has(key));
    });

    if (match) {
      matchedCards.add(match.id);
      matchesByPlayer.set(player, match);
    }
  }

  const inactiveCards = existing.filter((card) => {
    if (matchedCards.has(card.id)) {
      return false;
    }

    return officialByTeam.has(card.team);
  });

  writeFileSync(
    sqlOutputPath,
    buildFifaSquadsSql(players),
    "utf8",
  );

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      `SUPABASE_SERVICE_ROLE_KEY missing. Wrote SQL migration only: ${sqlOutputPath}`,
    );
    return { inactiveCards };
  }

  const { error: inactiveError } = await supabase
    .from("player_cards")
    .update({
      roster_source: "inactive",
      roster_version: rosterVersion,
      shirt_number: null,
    })
    .in("team", teams)
    .neq("roster_source", rosterSource);

  if (inactiveError) {
    throw new Error(`Failed to mark old player_cards inactive: ${inactiveError.message}`);
  }

  for (const player of players) {
    const existingCard = matchesByPlayer.get(player);
    const rarity = getRarityAndPrice(player);
    const cardArtUrl = getCardArtUrl(player, existingCard);
    const payload = {
      team: player.country,
      player_name: player.name_on_shirt || player.player_name,
      player_name_en: player.player_name,
      position: player.position,
      shirt_number: player.shirt_number,
      rarity: rarity.rarity,
      price: rarity.price,
      star_level: rarity.star_level,
      roster_source: rosterSource,
      roster_version: rosterVersion,
      card_art_url: cardArtUrl,
      card_thumb_url: cardArtUrl ?? existingCard?.card_thumb_url ?? null,
    };

    const { error } = await supabase
      .from("player_cards")
      .upsert(payload, { onConflict: "team,shirt_number" });

    if (error) {
      throw new Error(`Failed to upsert ${player.country} ${player.player_name}: ${error.message}`);
    }
  }

  return { inactiveCards };
}

function printTeamSummary(players: SquadPlayer[], country: string) {
  const teamPlayers = players.filter((player) => player.country === country);

  console.log(`${country}名单:`);
  for (const player of teamPlayers) {
    console.log(
      `${player.shirt_number}. ${player.position} ${player.player_name} (${player.name_on_shirt})`,
    );
  }
}

async function main() {
  loadLocalEnv();

  const squads = await downloadAndParseSquads();
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(squads, null, 2)}\n`, "utf8");

  const { inactiveCards } = await syncPlayerCards(squads.players);

  console.log(`Parsed countries: ${squads.country_count}`);
  console.log(`Parsed players: ${squads.player_count}`);
  printTeamSummary(squads.players, "Brazil");
  printTeamSummary(squads.players, "Germany");
  printTeamSummary(squads.players, "England");
  console.log("Inactive old players:");
  for (const card of inactiveCards) {
    console.log(`- ${card.team}: ${card.player_name} / ${card.player_name_en ?? "-"}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
