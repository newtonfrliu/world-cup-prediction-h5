import fs from "node:fs";
import path from "node:path";

type SquadPlayer = {
  country: string;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
};

type SquadCountry = {
  country: string;
  players: SquadPlayer[];
};

type SquadData = {
  countries: SquadCountry[];
};

type Rarity = "Legend" | "Epic" | "Rare" | "Common";
type ProductionPriority = "P0" | "P1" | "P2" | "P3";

type ProductionCard = {
  country: string;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: Rarity;
  production_priority: ProductionPriority;
  card_filename_suggestion: string;
  supabase_match_key: {
    team: string;
    player_name_en: string;
    roster_source: "fifa_official_squad";
  };
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
] as const;

const rarityByCountry: Record<string, Partial<Record<Rarity, string[]>>> = {
  Portugal: {
    Legend: ["CRISTIANO RONALDO"],
    Epic: ["BRUNO FERNANDES", "BERNARDO SILVA", "RAFAEL LEAO", "RUBEN DIAS"],
    Rare: ["DIOGO COSTA", "VITINHA", "NUNO MENDES", "JOAO NEVES", "DIOGO DALOT"],
  },
  Argentina: {
    Legend: ["MESSI Lionel"],
    Epic: [
      "MARTINEZ Lautaro",
      "ALVAREZ Julian",
      "MAC ALLISTER Alexis",
      "FERNANDEZ Enzo",
      "MARTINEZ Emiliano",
    ],
    Rare: ["MARTINEZ Lisandro", "MOLINA Nahuel", "ROMERO Cristian", "DE PAUL Rodrigo"],
  },
  Brazil: {
    Legend: ["NEYMAR JR"],
    Epic: ["VINICIUS JUNIOR", "RAPHINHA", "CASEMIRO", "ALISSON"],
    Rare: ["MARQUINHOS", "GABRIEL MAGALHAES", "BRUNO GUIMARAES", "ENDRICK"],
  },
  Germany: {
    Legend: ["NEUER Manuel"],
    Epic: ["MUSIALA Jamal", "WIRTZ Florian", "KIMMICH Joshua", "HAVERTZ Kai"],
    Rare: ["RUEDIGER Antonio", "TAH Jonathan", "SANE Leroy", "GORETZKA Leon", "SCHLOTTERBECK Nico"],
  },
  England: {
    Legend: ["KANE Harry"],
    Epic: ["BELLINGHAM Jude", "SAKA Bukayo", "RICE Declan", "RASHFORD Marcus"],
    Rare: ["PICKFORD Jordan", "STONES John", "GUEHI Marc", "WATKINS Ollie", "EZE Eberechi"],
  },
  Netherlands: {
    Legend: ["VAN DIJK Virgil"],
    Epic: ["GAKPO Cody", "DE JONG Frenkie"],
    Rare: ["DUMFRIES Denzel", "DEPAY Memphis", "GRAVENBERCH Ryan", "AKE Nathan", "MALEN Donyell"],
  },
  France: {
    Legend: ["MBAPPE Kylian"],
    Epic: ["DEMBELE Ousmane", "TCHOUAMENI Aurelien", "SALIBA William", "HERNANDEZ Theo"],
    Rare: ["MAIGNAN Mike", "KONATE Ibrahima", "KOUNDE Jules", "KOLO MUANI Randal", "OLISE Michael", "KANTE Ngolo"],
  },
  Spain: {
    Legend: ["YAMAL Lamine"],
    Epic: ["RODRI", "PEDRI", "WILLIAMS Nico", "OLMO Dani"],
    Rare: ["MORATA Alvaro", "CARVAJAL Dani", "CUCURELLA Marc", "SIMON Unai", "RAYA David", "GAVI"],
  },
  Japan: {
    Legend: ["KUBO Takefusa"],
    Epic: ["TOMIYASU Takehiro", "DOAN Ritsu", "KAMADA Daichi"],
    Rare: ["ITO Junya", "UEDA Ayase", "MAEDA Daizen", "NAKAMURA Keito", "SUZUKI Zion", "ITAKURA Kou"],
  },
};

const existingOrImmediateFilenames: Record<string, string> = {
  "Argentina:ALVAREZ Julian": "alvarez.png",
  "Argentina:MARTINEZ Lautaro": "lautaro.png",
  "Argentina:MARTINEZ Lisandro": "martinez.png",
  "Brazil:ALISSON": "alison.png",
  "Brazil:CASEMIRO": "casemiro.png",
  "Brazil:NEYMAR JR": "neymar.png",
  "Brazil:VINICIUS JUNIOR": "vinicius.png",
  "England:BELLINGHAM Jude": "bellingham.png",
  "England:KANE Harry": "kane.png",
  "England:RICE Declan": "rice.png",
  "England:SAKA Bukayo": "saka.png",
  "Germany:HAVERTZ Kai": "havertz.png",
  "Germany:KIMMICH Joshua": "kimmich.png",
  "Germany:MUSIALA Jamal": "musiala.png",
  "Germany:WIRTZ Florian": "wirtz.png",
  "Netherlands:GAKPO Cody": "gakpo.png",
  "Netherlands:VAN DIJK Virgil": "vandijk.png",
  "Portugal:BRUNO FERNANDES": "bruno.png",
  "Portugal:CRISTIANO RONALDO": "ronaldo.png",
  "Portugal:RAFAEL LEAO": "leao.png",
  "Portugal:RUBEN DIAS": "rubendias.png",
};

function normalizeKey(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function slugify(value: string) {
  return normalizeKey(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRarity(country: string, playerNameEn: string): Rarity {
  const countryRules = rarityByCountry[country] ?? {};
  const playerKey = normalizeKey(playerNameEn);

  for (const rarity of ["Legend", "Epic", "Rare"] as const) {
    const names = countryRules[rarity] ?? [];
    if (names.some((name) => normalizeKey(name) === playerKey)) {
      return rarity;
    }
  }

  return "Common";
}

function getFilename(country: string, playerNameEn: string) {
  return existingOrImmediateFilenames[`${country}:${playerNameEn}`] ?? `${slugify(playerNameEn)}.png`;
}

function getPriority(country: string, playerNameEn: string, rarity: Rarity): ProductionPriority {
  if (existingOrImmediateFilenames[`${country}:${playerNameEn}`]) {
    return "P0";
  }

  if (rarity === "Legend" || rarity === "Epic") {
    return "P1";
  }

  if (rarity === "Rare") {
    return "P2";
  }

  return "P3";
}

function toMarkdown(packages: Record<string, ProductionCard[]>, stats: Record<Rarity, number>) {
  const lines: string[] = [
    "# 球星卡制作 Package",
    "",
    "数据来源：`data/fifa-2026-squads.json`。",
    "",
    "说明：本文件只包含 FIFA 官方名单 JSON 中存在的球员；不在官方名单中的建议球员不会进入主卡池。",
    "",
    "## 汇总",
    "",
    `- 国家数：${Object.keys(packages).length}`,
    `- 球员总数：${Object.values(packages).reduce((sum, players) => sum + players.length, 0)}`,
    `- Legend：${stats.Legend}`,
    `- Epic：${stats.Epic}`,
    `- Rare：${stats.Rare}`,
    `- Common：${stats.Common}`,
    "",
  ];

  for (const country of targetCountries) {
    const players = packages[country];
    lines.push(`## ${country}`, "");
    lines.push("| 号码 | 中文名 | 英文名 | 位置 | 稀有度 | 优先级 | 文件名建议 | Supabase Match |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

    for (const player of players) {
      const match = `team=${player.supabase_match_key.team}; player_name_en=${player.supabase_match_key.player_name_en}; roster_source=${player.supabase_match_key.roster_source}`;
      lines.push(
        `| ${player.shirt_number} | ${player.player_name} | ${player.player_name_en} | ${player.position} | ${player.rarity} | ${player.production_priority} | ${player.card_filename_suggestion} | ${match} |`,
      );
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const root = process.cwd();
const squadPath = path.join(root, "data", "fifa-2026-squads.json");
const outputJsonPath = path.join(root, "data", "card-production-packages.json");
const docsDir = path.join(root, "docs");
const outputMarkdownPath = path.join(docsDir, "CARD_PRODUCTION_PACKAGES.md");

const squadData = JSON.parse(fs.readFileSync(squadPath, "utf8")) as SquadData;
const packages: Record<string, ProductionCard[]> = {};
const stats: Record<Rarity, number> = {
  Legend: 0,
  Epic: 0,
  Rare: 0,
  Common: 0,
};

for (const country of targetCountries) {
  const countryData = squadData.countries.find((item) => item.country === country);

  if (!countryData) {
    throw new Error(`Missing country in squad data: ${country}`);
  }

  if (countryData.players.length !== 26) {
    throw new Error(`${country} expected 26 players, got ${countryData.players.length}`);
  }

  packages[country] = countryData.players
    .slice()
    .sort((a, b) => a.shirt_number - b.shirt_number)
    .map((player) => {
      const rarity = getRarity(country, player.player_name_en);
      stats[rarity] += 1;

      return {
        country,
        shirt_number: player.shirt_number,
        player_name: player.player_name,
        player_name_en: player.player_name_en,
        position: player.position,
        rarity,
        production_priority: getPriority(country, player.player_name_en, rarity),
        card_filename_suggestion: getFilename(country, player.player_name_en),
        supabase_match_key: {
          team: country,
          player_name_en: player.player_name_en,
          roster_source: "fifa_official_squad",
        },
      };
    });
}

const totalPlayers = Object.values(packages).reduce((sum, players) => sum + players.length, 0);
if (totalPlayers !== 234) {
  throw new Error(`Expected 234 players, got ${totalPlayers}`);
}

fs.writeFileSync(outputJsonPath, `${JSON.stringify(packages, null, 2)}\n`, "utf8");
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outputMarkdownPath, toMarkdown(packages, stats), "utf8");

console.log("Generated data/card-production-packages.json");
console.log("Generated docs/CARD_PRODUCTION_PACKAGES.md");
console.log(`Countries: ${targetCountries.length}`);
console.log(`Players: ${totalPlayers}`);
console.log(`Legend: ${stats.Legend}`);
console.log(`Epic: ${stats.Epic}`);
console.log(`Rare: ${stats.Rare}`);
console.log(`Common: ${stats.Common}`);
console.log("Unmatched players: 0");
