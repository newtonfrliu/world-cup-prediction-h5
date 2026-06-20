import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ProductionPlayer = {
  country: string;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: string;
  production_priority: string;
  card_filename_suggestion: string;
};

type RarityOverride = {
  team: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  rarity: string;
  rarity_label: string;
};

type BindingConfidence = "exact" | "high" | "medium" | "low";

type BindingResult = {
  country: string;
  folder: string;
  filename: string;
  asset_url: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  rarity: string;
  confidence: BindingConfidence;
  reason: string;
  write_sql: boolean;
};

const COUNTRIES = [
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

const COUNTRY_FOLDERS: Record<string, string> = {
  Spain: "spain",
  Argentina: "argentina",
  Germany: "germany",
  England: "england",
  Netherlands: "netherlands",
  Portugal: "portugal",
  France: "france",
  Brazil: "brazil",
  Japan: "japan",
};

const CORE_FILENAME_ALIASES: Record<string, Record<string, string>> = {
  Portugal: {
    ronaldo: "CRISTIANO RONALDO",
    bruno: "BRUNO FERNANDES",
    bernardo: "BERNARDO SILVA",
    vitinha: "VITINHA",
    joao: "JOAO NEVES",
  },
  Argentina: {
    messi: "MESSI Lionel",
    lautaro: "MARTINEZ Lautaro",
    alvarez: "ALVAREZ Julian",
    enzo: "FERNANDEZ Enzo",
    martinez: "MARTINEZ Emiliano",
  },
  Brazil: {
    neymar: "NEYMAR JR",
    vini: "VINICIUS JUNIOR",
    vinicius: "VINICIUS JUNIOR",
    raphinha: "RAPHINHA",
    casemiro: "CASEMIRO",
    alison: "ALISSON",
    alisson: "ALISSON",
  },
  France: {
    mbappe: "MBAPPE Kylian",
    dembele: "DEMBELE Ousmane",
    tchouameni: "TCHOUAMENI Aurelien",
    saliba: "SALIBA William",
    theo: "HERNANDEZ Theo",
  },
  England: {
    kane: "KANE Harry",
    bellingham: "BELLINGHAM Jude",
    saka: "SAKA Bukayo",
    rice: "RICE Declan",
    rashford: "RASHFORD Marcus",
  },
  Germany: {
    neuer: "NEUER Manuel",
    musiala: "MUSIALA Jamal",
    wirtz: "WIRTZ Florian",
    kimmich: "KIMMICH Joshua",
    havertz: "HAVERTZ Kai",
  },
  Spain: {
    yamal: "YAMAL Lamine",
    pedri: "PEDRI",
    rodri: "RODRI",
    williams: "WILLIAMS Nico",
    olmo: "OLMO Dani",
  },
  Netherlands: {
    vandijk: "VAN DIJK Virgil",
    "van-dijk": "VAN DIJK Virgil",
    dejong: "DE JONG Frenkie",
    "de-jong": "DE JONG Frenkie",
    gakpo: "GAKPO Cody",
    ake: "AKE Nathan",
    depay: "DEPAY Memphis",
  },
  Japan: {
    "kubo-takefusa": "KUBO Takefusa",
    kubo: "KUBO Takefusa",
    tomiyasu: "TOMIYASU Takehiro",
    "ritsu-doan": "DOAN Ritsu",
    doan: "DOAN Ritsu",
    "kamada-daichi": "KAMADA Daichi",
    kamada: "KAMADA Daichi",
    "ito-junya": "ITO Junya",
  },
};

const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const root = process.cwd();
const productionPackagePath = path.join(root, "data", "card-production-packages.json");
const rarityOverridesPath = path.join(root, "data", "player-rarity-overrides.json");
const cardsRoot = path.join(root, "public", "cards");
const reportPath = path.join(root, "docs", "CORE_CARD_BINDING_REPORT.md");
const sqlPath = path.join(root, "supabase_core_card_asset_binding_migration.sql");

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function fileSlug(filename: string) {
  return path.basename(filename, path.extname(filename)).toLowerCase();
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function buildPlayerIndexes(
  packages: Record<string, ProductionPlayer[]>,
  overrides: RarityOverride[],
) {
  const playersByCountry = new Map<string, ProductionPlayer[]>();
  const overrideByPlayer = new Map<string, RarityOverride>();

  for (const override of overrides) {
    overrideByPlayer.set(
      `${override.team}:${normalize(override.player_name_en)}`,
      override,
    );
  }

  for (const country of COUNTRIES) {
    const players = (packages[country] ?? []).map((player) => {
      const override = overrideByPlayer.get(
        `${country}:${normalize(player.player_name_en)}`,
      );

      return {
        ...player,
        rarity: override?.rarity_label ?? player.rarity,
      };
    });

    playersByCountry.set(country, players);
  }

  return playersByCountry;
}

function findByEnglishName(players: ProductionPlayer[], englishName: string) {
  const key = normalize(englishName);
  return players.filter((player) => normalize(player.player_name_en) === key);
}

function findMatch(
  country: string,
  filename: string,
  players: ProductionPlayer[],
): BindingResult {
  const slug = fileSlug(filename);
  const filenameNormalized = normalize(slug);
  const exactMatches = players.filter(
    (player) =>
      normalize(path.basename(player.card_filename_suggestion, path.extname(player.card_filename_suggestion))) ===
      filenameNormalized,
  );

  if (exactMatches.length === 1) {
    return toResult(country, filename, exactMatches[0], "exact", "文件名等于 card_filename_suggestion。");
  }

  const aliasEnglishName = CORE_FILENAME_ALIASES[country]?.[slug];
  const aliasMatches = aliasEnglishName
    ? findByEnglishName(players, aliasEnglishName)
    : [];

  if (aliasMatches.length === 1) {
    return toResult(
      country,
      filename,
      aliasMatches[0],
      "high",
      `文件名 ${slug} 命中人工核心简称规则：${aliasEnglishName}。`,
    );
  }

  const normalizedAliasEnglishName =
    CORE_FILENAME_ALIASES[country]?.[filenameNormalized];
  const normalizedAliasMatches = normalizedAliasEnglishName
    ? findByEnglishName(players, normalizedAliasEnglishName)
    : [];

  if (normalizedAliasMatches.length === 1) {
    return toResult(
      country,
      filename,
      normalizedAliasMatches[0],
      "high",
      `文件名 ${slug} 命中归一化人工核心简称规则：${normalizedAliasEnglishName}。`,
    );
  }

  const nameMatches = players.filter((player) => {
    const english = normalize(player.player_name_en);
    const chinese = normalize(player.player_name);

    return (
      english === filenameNormalized ||
      chinese === filenameNormalized ||
      english.includes(filenameNormalized) ||
      filenameNormalized.includes(english)
    );
  });

  if (nameMatches.length === 1) {
    return toResult(
      country,
      filename,
      nameMatches[0],
      "medium",
      "文件名与球员中英文名存在唯一包含关系，需要人工确认。",
    );
  }

  return {
    country,
    folder: COUNTRY_FOLDERS[country],
    filename,
    asset_url: toAssetUrl(country, filename),
    player_name: "-",
    player_name_en: "-",
    shirt_number: 0,
    rarity: "-",
    confidence: "low",
    reason:
      nameMatches.length > 1
        ? `文件名匹配到多个候选：${nameMatches.map((player) => player.player_name_en).join(", ")}。`
        : "未命中 card_filename_suggestion、人工简称或唯一姓名匹配。",
    write_sql: false,
  };
}

function toAssetUrl(country: string, filename: string) {
  return `/cards/${COUNTRY_FOLDERS[country]}/${filename}`;
}

function toResult(
  country: string,
  filename: string,
  player: ProductionPlayer,
  confidence: BindingConfidence,
  reason: string,
): BindingResult {
  return {
    country,
    folder: COUNTRY_FOLDERS[country],
    filename,
    asset_url: toAssetUrl(country, filename),
    player_name: player.player_name,
    player_name_en: player.player_name_en,
    shirt_number: player.shirt_number,
    rarity: player.rarity,
    confidence,
    reason,
    write_sql: confidence === "exact" || confidence === "high",
  };
}

function scanImages(country: string) {
  const folder = COUNTRY_FOLDERS[country];
  const directory = path.join(cardsRoot, folder);

  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((filename) => supportedExtensions.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

function buildSql(results: BindingResult[]) {
  const writable = results.filter((result) => result.write_sql);
  const lines = [
    "-- Core card asset binding migration",
    "-- Generated by scripts/bind-core-card-assets.ts",
    "-- Review before executing. This updates only card_art_url and card_thumb_url.",
    "",
    "begin;",
    "",
  ];

  for (const result of writable) {
    lines.push(`-- ${result.country} #${result.shirt_number} ${result.player_name} / ${result.player_name_en} (${result.confidence})`);
    lines.push("update public.player_cards");
    lines.push("set");
    lines.push(`  card_art_url = ${sqlString(result.asset_url)},`);
    lines.push(`  card_thumb_url = ${sqlString(result.asset_url)}`);
    lines.push(`where team = ${sqlString(result.country)}`);
    lines.push(`  and shirt_number = ${result.shirt_number}`);
    lines.push("  and roster_source = 'fifa_official_squad';");
    lines.push("");
  }

  lines.push("commit;");
  lines.push("");

  return lines.join("\n");
}

function buildReport(results: BindingResult[]) {
  const countByConfidence = (confidence: BindingConfidence) =>
    results.filter((result) => result.confidence === confidence).length;
  const writableCount = results.filter((result) => result.write_sql).length;
  const unmatched = results.filter((result) => !result.write_sql);

  const lines = [
    "# Core Card Binding Report",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
    "本报告只扫描 9 国核心卡图，不执行 SQL。",
    "",
    "## 汇总",
    "",
    `- 扫描到的图片数量：${results.length}`,
    `- 成功匹配数量：${writableCount}`,
    `- exact 数量：${countByConfidence("exact")}`,
    `- high 数量：${countByConfidence("high")}`,
    `- medium 数量：${countByConfidence("medium")}`,
    `- low 数量：${countByConfidence("low")}`,
    "",
    "## 未写入 SQL 的图片",
    "",
  ];

  if (unmatched.length === 0) {
    lines.push("- 无");
  } else {
    for (const result of unmatched) {
      lines.push(
        `- ${result.country}/${result.filename}：${result.confidence}，${result.reason}`,
      );
    }
  }

  lines.push("");
  lines.push("## 逐图匹配结果");
  lines.push("");
  lines.push(
    "| Country | Filename | Player Name | English | Shirt No. | Rarity | Confidence | SQL | Reason |",
  );
  lines.push(
    "| --- | --- | --- | --- | ---: | --- | --- | --- | --- |",
  );

  for (const result of results) {
    lines.push(
      [
        result.country,
        result.filename,
        result.player_name,
        result.player_name_en,
        String(result.shirt_number || "-"),
        result.rarity,
        result.confidence,
        result.write_sql ? "yes" : "no",
        result.reason,
      ]
        .map((value) => String(value).replace(/\|/g, "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  lines.push("");
  lines.push("## SQL 输出");
  lines.push("");
  lines.push("- 文件：`supabase_core_card_asset_binding_migration.sql`");
  lines.push("- 只写入 confidence 为 `exact` / `high` 的图片。");
  lines.push("- SQL 使用 `team + shirt_number + roster_source = 'fifa_official_squad'` 匹配。");
  lines.push("- SQL 只更新 `card_art_url` 与 `card_thumb_url`。");
  lines.push("");

  return lines.join("\n");
}

function main() {
  const packages = loadJson<Record<string, ProductionPlayer[]>>(productionPackagePath);
  const rarityOverrides = loadJson<{ overrides: RarityOverride[] }>(rarityOverridesPath);
  const playersByCountry = buildPlayerIndexes(packages, rarityOverrides.overrides);
  const results: BindingResult[] = [];

  for (const country of COUNTRIES) {
    const players = playersByCountry.get(country) ?? [];
    const images = scanImages(country);

    for (const filename of images) {
      results.push(findMatch(country, filename, players));
    }
  }

  writeFileSync(reportPath, buildReport(results), "utf8");
  writeFileSync(sqlPath, buildSql(results), "utf8");

  const exactCount = results.filter((result) => result.confidence === "exact").length;
  const highCount = results.filter((result) => result.confidence === "high").length;
  const mediumCount = results.filter((result) => result.confidence === "medium").length;
  const lowCount = results.filter((result) => result.confidence === "low").length;

  console.log(`Scanned ${results.length} images.`);
  console.log(`exact=${exactCount}, high=${highCount}, medium=${mediumCount}, low=${lowCount}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  console.log(`SQL: ${path.relative(root, sqlPath)}`);
}

main();
