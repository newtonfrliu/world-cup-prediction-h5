import fs from "node:fs";
import path from "node:path";

type RarityLabel = "Legend" | "Epic" | "Rare" | "Common";
type PackageCard = {
  country: string;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: RarityLabel;
  production_priority: string;
  card_filename_suggestion: string;
  supabase_match_key: {
    team: string;
    player_name_en: string;
    roster_source: "fifa_official_squad";
  };
};
type RarityOverride = {
  country: string;
  team: string;
  player_name: string;
  player_name_en: string;
  normalized_player_name_en: string;
  shirt_number: number;
  position: string;
  rarity: string;
  rarity_label: RarityLabel;
  price: number;
  star_level: number;
  source_rarity: RarityLabel;
  match_type: string;
  supabase_match_key: PackageCard["supabase_match_key"];
};
type UnmatchedCandidate = {
  country: string;
  player_name_en: string;
  intended_rarity: RarityLabel;
  reason: string;
};
type FinalRow = {
  team: string;
  player_name: string;
  player_name_en: string;
  normalized_player_name_en: string;
  shirt_number: number;
  position: string;
  rarity: string;
  rarity_label: RarityLabel;
  price: number;
  star_level: number;
  source_rarity: RarityLabel;
  override_applied: boolean;
};

const root = process.cwd();
const packages = JSON.parse(
  fs.readFileSync(path.join(root, "data/card-production-packages.json"), "utf8"),
) as Record<string, PackageCard[]>;

const manual: Record<"Legend" | "Epic", Record<string, string[]>> = {
  Legend: {
    Portugal: ["CRISTIANO RONALDO"],
    Argentina: ["MESSI Lionel"],
    Brazil: ["NEYMAR JR", "VINICIUS JUNIOR"],
    France: ["MBAPPE Kylian", "DEMBELE Ousmane"],
    England: ["KANE Harry"],
    Germany: ["NEUER Manuel"],
    Spain: ["YAMAL Lamine"],
    Netherlands: ["VAN DIJK Virgil"],
    Japan: ["KUBO Takefusa"],
  },
  Epic: {
    Portugal: ["BRUNO FERNANDES", "BERNARDO SILVA", "VITINHA", "JOAO NEVES"],
    Argentina: [
      "MARTINEZ Lautaro",
      "ALVAREZ Julian",
      "FERNANDEZ Enzo",
      "MAC ALLISTER Alexis",
      "MARTINEZ Emiliano",
    ],
    Brazil: ["RAPHINHA", "CASEMIRO", "ALISSON"],
    France: ["TCHOUAMENI Aurelien", "SALIBA William", "HERNANDEZ Theo"],
    England: ["BELLINGHAM Jude", "SAKA Bukayo", "RICE Declan", "RASHFORD Marcus"],
    Germany: ["MUSIALA Jamal", "WIRTZ Florian", "KIMMICH Joshua", "HAVERTZ Kai"],
    Spain: ["PEDRI", "RODRI", "WILLIAMS Nico", "OLMO Dani"],
    Netherlands: ["GAKPO Cody", "DE JONG Frenkie", "AKE Nathan", "DEPAY Memphis"],
    Japan: ["TOMIYASU Takehiro", "DOAN Ritsu", "KAMADA Daichi", "ITO Junya"],
  },
};

const targetCountries = [
  "Spain",
  "Argentina",
  "Germany",
  "England",
  "Netherlands",
  "Portugal",
  "France",
  "Brazil",
  "Japan",
];
const excluded = ["FRIMPONG", "MITOMA", "XAVI SIMONS", "RODRYGO"];
const titleToDb: Record<RarityLabel, string> = {
  Legend: "legend",
  Epic: "epic",
  Rare: "rare",
  Common: "common",
};
const dbToTitle: Record<string, RarityLabel> = {
  legend: "Legend",
  epic: "Epic",
  rare: "Rare",
  common: "Common",
};
const priceByRarity: Record<string, number> = {
  legend: 10000,
  epic: 5000,
  rare: 2000,
  common: 500,
};
const starByRarity: Record<string, number> = {
  legend: 5,
  epic: 4,
  rare: 3,
  common: 1,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function findPlayer(country: string, playerNameEn: string) {
  const players = packages[country] ?? [];
  const exact = players.find((player) => player.player_name_en === playerNameEn);

  if (exact) {
    return { player: exact, matchType: "exact" };
  }

  const normalized = normalize(playerNameEn);
  const normalizedMatch = players.find(
    (player) => normalize(player.player_name_en) === normalized,
  );

  return normalizedMatch
    ? { player: normalizedMatch, matchType: "normalized" }
    : null;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

const overrides: RarityOverride[] = [];
const unmatched: UnmatchedCandidate[] = [];

for (const [rarityLabel, byCountry] of Object.entries(manual) as Array<
  ["Legend" | "Epic", Record<string, string[]>]
>) {
  for (const [country, playerNames] of Object.entries(byCountry)) {
    for (const playerNameEn of playerNames) {
      const found = findPlayer(country, playerNameEn);

      if (!found) {
        unmatched.push({
          country,
          player_name_en: playerNameEn,
          intended_rarity: rarityLabel,
          reason:
            "Not found in data/card-production-packages.json official squad package",
        });
        continue;
      }

      const player = found.player;
      const rarity = titleToDb[rarityLabel];
      overrides.push({
        country,
        team: country,
        player_name: player.player_name,
        player_name_en: player.player_name_en,
        normalized_player_name_en: normalize(player.player_name_en),
        shirt_number: player.shirt_number,
        position: player.position,
        rarity,
        rarity_label: rarityLabel,
        price: priceByRarity[rarity],
        star_level: starByRarity[rarity],
        source_rarity: player.rarity,
        match_type: found.matchType,
        supabase_match_key: player.supabase_match_key,
      });
    }
  }
}

const overrideByKey = new Map(
  overrides.map((override) => [
    `${override.team}:${normalize(override.player_name_en)}`,
    override,
  ]),
);
const finalRows: FinalRow[] = [];
const downgradedFromOldEpic = [];

for (const country of targetCountries) {
  for (const player of packages[country] ?? []) {
    const override = overrideByKey.get(
      `${country}:${normalize(player.player_name_en)}`,
    );
    const wasOldEpic = player.rarity === "Epic";
    const fallbackRarity =
      wasOldEpic && !override ? "rare" : titleToDb[player.rarity];
    const rarity = override?.rarity ?? fallbackRarity;

    if (wasOldEpic && !override) {
      downgradedFromOldEpic.push({
        team: country,
        player_name: player.player_name,
        player_name_en: player.player_name_en,
        shirt_number: player.shirt_number,
        old_rarity: "Epic",
        new_rarity: "Rare",
        reason: "Not included in the manual Epic list, so old Epic is downgraded.",
      });
    }

    finalRows.push({
      team: country,
      player_name: player.player_name,
      player_name_en: player.player_name_en,
      normalized_player_name_en: normalize(player.player_name_en),
      shirt_number: player.shirt_number,
      position: player.position,
      rarity,
      rarity_label: dbToTitle[rarity],
      price: priceByRarity[rarity],
      star_level: starByRarity[rarity],
      source_rarity: player.rarity,
      override_applied: Boolean(override),
    });
  }
}

const countsByCountry = Object.fromEntries(
  targetCountries.map((country) => [
    country,
    { Legend: 0, Epic: 0, Rare: 0, Common: 0, Total: 0 },
  ]),
) as Record<string, Record<RarityLabel | "Total", number>>;
const globalCounts: Record<RarityLabel | "Total", number> = {
  Legend: 0,
  Epic: 0,
  Rare: 0,
  Common: 0,
  Total: 0,
};

for (const row of finalRows) {
  const label = row.rarity_label;
  countsByCountry[row.team][label] += 1;
  countsByCountry[row.team].Total += 1;
  globalCounts[label] += 1;
  globalCounts.Total += 1;
}

const allPackagePlayers = targetCountries.flatMap((country) => packages[country] ?? []);
const excludedPresence = excluded.map((playerNameEn) => ({
  player_name_en: playerNameEn,
  in_overrides: overrides.some(
    (override) => normalize(override.player_name_en) === normalize(playerNameEn),
  ),
  in_sql_rows: finalRows.some(
    (row) => normalize(row.player_name_en) === normalize(playerNameEn),
  ),
  found_in_package: allPackagePlayers.some(
    (player) => normalize(player.player_name_en) === normalize(playerNameEn),
  ),
}));

const generatedAt = new Date().toISOString();
fs.writeFileSync(
  path.join(root, "data/player-rarity-overrides.json"),
  `${JSON.stringify(
    {
      generated_at: generatedAt,
      source: "data/card-production-packages.json",
      scope:
        "Only roster_source = 'fifa_official_squad' should be updated in Supabase.",
      price_table: { Legend: 10000, Epic: 5000, Rare: 2000, Common: 500 },
      star_level_table: { Legend: 5, Epic: 4, Rare: 3, Common: 1 },
      excluded_not_written: excludedPresence,
      downgraded_from_old_epic: downgradedFromOldEpic,
      overrides,
      counts_by_country: countsByCountry,
      global_counts: globalCounts,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(root, "data/unmatched-rarity-candidates.json"),
  `${JSON.stringify(
    {
      generated_at: generatedAt,
      source:
        "manual rarity candidates in task request matched against data/card-production-packages.json",
      unmatched_count: unmatched.length,
      unmatched,
      downgraded_from_old_epic_count: downgradedFromOldEpic.length,
      excluded_not_written: excludedPresence,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const values = finalRows
  .map(
    (row) =>
      `  ('${escapeSql(row.team)}', ${row.shirt_number}, '${escapeSql(row.player_name_en)}', '${escapeSql(row.normalized_player_name_en)}', '${escapeSql(row.rarity)}', ${row.price}, ${row.star_level})`,
  )
  .join(",\n");
const sql = `-- Phase rarity and price migration for 9-country official player card pool.
-- Generated from data/card-production-packages.json and data/player-rarity-overrides.json.
-- Scope: only roster_source = 'fifa_official_squad'.
-- Does not modify inactive records, user_cards, card_art_url, or card_thumb_url.
-- Coverage key: team + shirt_number, with player_name_en kept for audit.

begin;

with target_updates(team, shirt_number, player_name_en, normalized_player_name_en, rarity, price, star_level) as (
  values
${values}
), applied_updates as (
  update public.player_cards pc
  set
    rarity = tu.rarity,
    price = tu.price,
    star_level = tu.star_level
  from target_updates tu
  where pc.roster_source = 'fifa_official_squad'
    and pc.team = tu.team
    and pc.shirt_number = tu.shirt_number
  returning pc.id, pc.team, pc.shirt_number, pc.player_name_en
)
select
  (select count(*) from target_updates) as expected_updates,
  (select count(*) from applied_updates) as applied_updates;

-- Verification: should return no rows.
with target_updates(team, shirt_number, player_name_en, normalized_player_name_en, rarity, price, star_level) as (
  values
${values}
)
select tu.*
from target_updates tu
where not exists (
  select 1
  from public.player_cards pc
  where pc.roster_source = 'fifa_official_squad'
    and pc.team = tu.team
    and pc.shirt_number = tu.shirt_number
);

-- Verification: should return exactly 4 rows with counts 11 / 35 / 40 / 148.
select rarity, price, star_level, count(*)
from public.player_cards
where roster_source = 'fifa_official_squad'
  and team in (
    'Spain',
    'Argentina',
    'Germany',
    'England',
    'Netherlands',
    'Portugal',
    'France',
    'Brazil',
    'Japan'
  )
group by rarity, price, star_level
order by
  case rarity
    when 'legend' then 1
    when 'epic' then 2
    when 'rare' then 3
    when 'common' then 4
    else 5
  end;

commit;
`;

fs.writeFileSync(
  path.join(root, "supabase_player_rarity_and_price_migration.sql"),
  sql,
  "utf8",
);

console.log(JSON.stringify({ overrides: overrides.length, rows: finalRows.length, unmatched: unmatched.length, countsByCountry, globalCounts, excludedPresence }, null, 2));
