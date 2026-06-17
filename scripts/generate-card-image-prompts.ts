const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const sourcePath = path.join(root, "data", "card-production-packages.json");
const jsonOutputPath = path.join(root, "data", "card-image-prompts.json");
const csvOutputPath = path.join(root, "data", "card-image-prompts.csv");
const markdownOutputPath = path.join(root, "docs", "CARD_IMAGE_PROMPTS.md");

const countryMeta = {
  Portugal: {
    slug: "portugal",
    jersey: "Portugal red home jersey with green trim and subtle gold detailing",
    palette: "deep red, emerald green, antique gold, black",
  },
  Argentina: {
    slug: "argentina",
    jersey: "Argentina sky-blue and white striped home jersey with gold detailing",
    palette: "sky blue, white, gold, deep navy",
  },
  Brazil: {
    slug: "brazil",
    jersey: "Brazil yellow home jersey with green trim and blue accents",
    palette: "canary yellow, emerald green, royal blue, gold",
  },
  Germany: {
    slug: "germany",
    jersey: "Germany white home jersey with black, red, and gold accents",
    palette: "white, black, red, gold",
  },
  England: {
    slug: "england",
    jersey: "England white home jersey with deep navy and red accents",
    palette: "white, deep navy, red, silver",
  },
  France: {
    slug: "france",
    jersey: "France deep blue home jersey with white, red, and gold accents",
    palette: "deep blue, white, red, gold",
  },
  Spain: {
    slug: "spain",
    jersey: "Spain red home jersey with yellow-gold trim and dark blue accents",
    palette: "red, yellow-gold, dark blue",
  },
  Netherlands: {
    slug: "netherlands",
    jersey: "Netherlands orange home jersey with white and deep navy accents",
    palette: "orange, white, deep navy, gold",
  },
  Japan: {
    slug: "japan",
    jersey: "Japan deep blue home jersey with white and red accents",
    palette: "deep blue, white, red, silver",
  },
};

const rarityMeta = {
  Legend: {
    strength: "100% luxury",
    template: "black-and-gold cinematic national glory card, ornate premium border, strongest golden light, highest rarity, dramatic stadium atmosphere",
  },
  Epic: {
    strength: "80% luxury",
    template: "purple-gold and national-team energy card, star-player poster feeling, strong but controlled glow, premium gem-like border",
  },
  Rare: {
    strength: "60% luxury",
    template: "blue-silver formal World Cup collectible card, clean premium border, clear player portrait, reduced light effects",
  },
  Common: {
    strength: "40% luxury",
    template: "white-silver clean World Cup collectible card, simple but still premium, clear player portrait, minimal glow",
  },
};

const templateReferences = {
  Legend: "assets/card_templates/sample-legend-ronaldo.png",
  Epic: "assets/card_templates/sample-epic-bruno.png",
  Rare: "assets/card_templates/sample-rare-diogo-costa.png",
  Common: "assets/card_templates/sample-common-nelson-semedo.png",
};

type CountryName = keyof typeof countryMeta;
type RarityName = keyof typeof rarityMeta;

type ProductionPlayer = {
  country: CountryName;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: RarityName;
  production_priority: string;
  card_filename_suggestion: string;
  supabase_match_key: {
    team: string;
    player_name_en: string;
    roster_source: string;
  };
};

type PromptRow = {
  country: CountryName;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  rarity: RarityName;
  priority: string;
  output_path: string;
  file_name: string;
  prompt: string;
  supabase_match_key: ProductionPlayer["supabase_match_key"];
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildPrompt(player: ProductionPlayer, meta: (typeof countryMeta)[CountryName]) {
  const rarity = rarityMeta[player.rarity] ?? rarityMeta.Common;
  const filename = player.card_filename_suggestion;
  const outputPath = `public/cards/${meta.slug}/${filename}`;

  return [
    `Create one complete vertical 2:3 AI-generated 2026 World Cup football collectible card for ${player.player_name_en} / ${player.player_name}.`,
    `National team: ${player.country}. Jersey: ${meta.jersey}. Shirt number: #${player.shirt_number}. Position: ${player.position}.`,
    `Portrait direction: create an original footballer portrait with a similar playing-role energy and public vibe to ${player.player_name_en}, but do not request or imply an exact likeness, identity-copy, or real photo replication.`,
    `Rarity: ${player.rarity}. Visual strength: ${rarity.strength}. Design language: ${rarity.template}. Country palette: ${meta.palette}.`,
    `Use the unified card system inspired by the local ${player.rarity} template reference (${templateReferences[player.rarity] ?? templateReferences.Common}): Layer 1 background and border, Layer 2 player portrait, Layer 3 UI information; keep the face and upper body clear.`,
    `Visible card text only: "${player.player_name}", "${player.player_name_en}", "${player.country}", "#${player.shirt_number}", "${player.position}", "${player.rarity}", "2026 World Cup", "CAN / MEX / USA 2026".`,
    `Output filename: ${filename}. Intended path: ${outputPath}.`,
    `Strictly avoid UEFA EURO, EURO 2024, Qatar 2022, 2022 World Cup, ability values, attack/defense/speed attributes, FUT-style attribute panels, titles, codenames, slogans, short descriptive copy, club logos, sponsor logos, watermarks, extra random text, and misspelled tournament branding.`,
  ].join(" ");
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const packages = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as Record<CountryName, ProductionPlayer[]>;
const countries: Record<string, PromptRow[]> = {};
const flatRows: PromptRow[] = [];
const rarityCounts: Record<string, number> = {};
const priorityCounts: Record<string, number> = {};

for (const [country, players] of Object.entries(packages) as [CountryName, ProductionPlayer[]][]) {
  const meta = countryMeta[country];
  if (!meta) {
    throw new Error(`Missing country prompt metadata for ${country}`);
  }

  countries[country] = players.map((player) => {
    const filename = player.card_filename_suggestion;
    const outputPath = `public/cards/${meta.slug}/${filename}`;
    const prompt = buildPrompt(player, meta);
    const row = {
      country: player.country,
      player_name: player.player_name,
      player_name_en: player.player_name_en,
      shirt_number: player.shirt_number,
      position: player.position,
      rarity: player.rarity,
      priority: player.production_priority,
      output_path: outputPath,
      file_name: filename,
      prompt,
      supabase_match_key: player.supabase_match_key,
    };

    flatRows.push(row);
    rarityCounts[row.rarity] = (rarityCounts[row.rarity] ?? 0) + 1;
    priorityCounts[row.priority] = (priorityCounts[row.priority] ?? 0) + 1;
    return row;
  });
}

const result = {
  generated_at: new Date().toISOString(),
  source: {
    players: "data/card-production-packages.json",
    templates: templateReferences,
    note: "Prompt package only. No images are generated by this file.",
  },
  totals: {
    countries: Object.keys(countries).length,
    players: flatRows.length,
    rarity: rarityCounts,
    priority: priorityCounts,
  },
  prompt_rules: {
    exact_likeness: "Do not request exact real-player likeness. Generate an original footballer portrait with similar vibe.",
    required_branding: ["2026 World Cup", "CAN / MEX / USA 2026"],
    forbidden: [
      "UEFA EURO",
      "EURO 2024",
      "Qatar 2022",
      "2022 World Cup",
      "ability values",
      "attack/defense/speed attributes",
      "titles",
      "codenames",
      "short descriptive copy",
    ],
  },
  countries,
};

ensureDir(jsonOutputPath);
fs.writeFileSync(jsonOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const csvHeader = [
  "country",
  "player_name",
  "player_name_en",
  "shirt_number",
  "position",
  "rarity",
  "priority",
  "output_path",
  "prompt",
];
const csvLines = [csvHeader.join(",")];
for (const row of flatRows) {
  csvLines.push(
    [
      row.country,
      row.player_name,
      row.player_name_en,
      row.shirt_number,
      row.position,
      row.rarity,
      row.priority,
      row.output_path,
      row.prompt,
    ]
      .map(csvEscape)
      .join(","),
  );
}
fs.writeFileSync(csvOutputPath, `${csvLines.join("\n")}\n`, "utf8");

const md = [];
md.push("# Card Image Prompts");
md.push("");
md.push("本文件用于 9 国 234 名球员的 AI 球星卡图像量产。当前只生成 prompt，不生成图片。");
md.push("");
md.push("## Template Language");
md.push("");
md.push("| Rarity | Reference | Visual Strength | Design Language |");
md.push("| --- | --- | --- | --- |");
for (const [rarity, meta] of Object.entries(rarityMeta) as [RarityName, (typeof rarityMeta)[RarityName]][]) {
  md.push(`| ${rarity} | ${templateReferences[rarity]} | ${meta.strength} | ${meta.template} |`);
}
md.push("");
md.push("## Rules");
md.push("");
md.push("- 不要求精确复刻真实肖像，只生成“类似该球员气质的足球运动员肖像”。");
md.push("- 所有卡统一使用 2026 World Cup / CAN / MEX / USA 2026 赛事视觉。");
md.push("- 禁止 UEFA EURO、EURO 2024、Qatar 2022、2022 World Cup。");
md.push("- 禁止能力值、攻击/防守/速度属性、称号、短文案、FUT 属性面板。");
md.push("");
md.push("## Totals");
md.push("");
md.push(`- Countries: ${result.totals.countries}`);
md.push(`- Players: ${result.totals.players}`);
md.push(`- Rarity: ${Object.entries(rarityCounts).map(([key, count]) => `${key} ${count}`).join(", ")}`);
md.push(`- Priority: ${Object.entries(priorityCounts).map(([key, count]) => `${key} ${count}`).join(", ")}`);
md.push("");

for (const [country, rows] of Object.entries(countries) as [string, PromptRow[]][]) {
  md.push(`## ${country}`);
  md.push("");
  md.push("| # | 中文名 | English | Pos | Rarity | Priority | Output | Prompt |");
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    md.push(
      `| ${row.shirt_number} | ${row.player_name} | ${row.player_name_en} | ${row.position} | ${row.rarity} | ${row.priority} | ${row.output_path} | ${row.prompt.replace(/\|/g, "\\|")} |`,
    );
  }
  md.push("");
}

ensureDir(markdownOutputPath);
fs.writeFileSync(markdownOutputPath, `${md.join("\n")}\n`, "utf8");

if (flatRows.length !== 234) {
  throw new Error(`Expected 234 prompts, generated ${flatRows.length}`);
}

console.log(`Generated ${flatRows.length} prompts for ${Object.keys(countries).length} countries.`);
console.log(`JSON: ${path.relative(root, jsonOutputPath)}`);
console.log(`CSV: ${path.relative(root, csvOutputPath)}`);
console.log(`Markdown: ${path.relative(root, markdownOutputPath)}`);
