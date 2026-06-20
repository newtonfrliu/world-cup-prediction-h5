const fs = require("node:fs");
const path = require("node:path");

export {};

const root = process.cwd();
const sourcePath = path.join(root, "data", "card-production-packages.json");
const markdownOutputPath = path.join(root, "docs", "CARD_PORTRAIT_PROMPTS.md");

const countryMeta = {
  Portugal: {
    slug: "portugal",
    jersey: "Portugal red national team jersey with green trim and subtle gold detailing",
  },
  Argentina: {
    slug: "argentina",
    jersey: "Argentina sky-blue and white striped national team jersey with gold detailing",
  },
  Brazil: {
    slug: "brazil",
    jersey: "Brazil yellow national team jersey with green trim and blue accents",
  },
  Germany: {
    slug: "germany",
    jersey: "Germany white national team jersey with black, red, and gold accents",
  },
  England: {
    slug: "england",
    jersey: "England white national team jersey with deep navy and red accents",
  },
  France: {
    slug: "france",
    jersey: "France deep blue national team jersey with white, red, and gold accents",
  },
  Spain: {
    slug: "spain",
    jersey: "Spain red national team jersey with yellow-gold trim and dark blue accents",
  },
  Netherlands: {
    slug: "netherlands",
    jersey: "Netherlands orange national team jersey with white and deep navy accents",
  },
  Japan: {
    slug: "japan",
    jersey: "Japan deep blue national team jersey with white and red accents",
  },
};

const rarityAtmosphere = {
  Legend:
    "Legend rarity atmosphere, premium black-gold cinematic rim light, strongest collectible-card lighting, heroic but clean portrait energy",
  Epic:
    "Epic rarity atmosphere, rich purple-gold or national-color energy light, star-player glow, premium but less ornate than Legend",
  Rare:
    "Rare rarity atmosphere, silver-blue collectible lighting, crisp official portrait feel, moderate highlight and clean contrast",
  Common:
    "Common rarity atmosphere, clean white-silver collectible lighting, simple premium portrait, minimal effects but still card-ready",
};

const negativePrompt =
  "logo, watermark, text, numbers, badge, sponsor, club logo, blurry, low quality, extra limbs";

type CountryName = keyof typeof countryMeta;
type RarityName = keyof typeof rarityAtmosphere;

type ProductionPlayer = {
  country: CountryName;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: RarityName;
  production_priority: string;
  card_filename_suggestion: string;
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildPortraitPrompt(
  player: ProductionPlayer,
  meta: (typeof countryMeta)[CountryName],
) {
  return [
    `PNG portrait layer with transparent background for ${player.player_name_en} / ${player.player_name}.`,
    `Create an original football player portrait with similar athletic vibe, role energy, and facial attitude, not an exact real-person likeness.`,
    `National team: ${player.country}. Jersey: ${meta.jersey}. Shirt number reference: #${player.shirt_number}. Position: ${player.position}.`,
    `Upper-body half-length composition, front view or slight three-quarter view, head and torso fully visible, clean cutout edges, suitable for placing into a football collectible card template later.`,
    `Card-grade studio lighting, sharp face, athletic posture, high-detail fabric texture, no background scene, transparent alpha background.`,
    `Rarity mood: ${rarityAtmosphere[player.rarity]}.`,
  ].join(" ");
}

const packages = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as Record<
  CountryName,
  ProductionPlayer[]
>;

const md: string[] = [];
const totals = {
  countries: 0,
  players: 0,
  rarity: {} as Record<string, number>,
  priority: {} as Record<string, number>,
};

md.push("# Card Portrait Prompts");
md.push("");
md.push("本文件用于生成球星卡的人物层素材，不生成完整球星卡。");
md.push("");
md.push("## Output Target");
md.push("");
md.push("- PNG");
md.push("- 透明背景");
md.push("- 上半身");
md.push("- 正面或半侧面");
md.push("- 国家队球衣");
md.push("- 适合后续套用球星卡模板");
md.push("");
md.push("## Global Negative Prompt");
md.push("");
md.push(`\`${negativePrompt}\``);
md.push("");

for (const [country, players] of Object.entries(packages) as [
  CountryName,
  ProductionPlayer[],
][]) {
  const meta = countryMeta[country];

  if (!meta) {
    throw new Error(`Missing country portrait metadata for ${country}`);
  }

  totals.countries += 1;
  totals.players += players.length;

  md.push(`## ${country}`);
  md.push("");
  md.push(
    "| # | 中文名 | English | Pos | Rarity | Priority | Output Path | portrait_prompt | negative_prompt |",
  );
  md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");

  for (const player of players) {
    const outputPath = `public/cards/${meta.slug}/portraits/${player.card_filename_suggestion}`;
    const portraitPrompt = buildPortraitPrompt(player, meta);

    totals.rarity[player.rarity] = (totals.rarity[player.rarity] ?? 0) + 1;
    totals.priority[player.production_priority] =
      (totals.priority[player.production_priority] ?? 0) + 1;

    md.push(
      [
        `| ${player.shirt_number}`,
        player.player_name,
        player.player_name_en,
        player.position,
        player.rarity,
        player.production_priority,
        outputPath,
        portraitPrompt.replace(/\|/g, "\\|"),
        `${negativePrompt} |`,
      ].join(" | "),
    );
  }

  md.push("");
}

md.splice(
  2,
  0,
  "",
  "## Totals",
  "",
  `- Countries: ${totals.countries}`,
  `- Players: ${totals.players}`,
  `- Rarity: ${Object.entries(totals.rarity)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")}`,
  `- Priority: ${Object.entries(totals.priority)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ")}`,
);

ensureDir(markdownOutputPath);
fs.writeFileSync(markdownOutputPath, `${md.join("\n")}\n`, "utf8");

if (totals.players !== 234) {
  throw new Error(`Expected 234 portrait prompts, generated ${totals.players}`);
}

console.log(`Generated ${totals.players} portrait prompts.`);
console.log(`Markdown: ${path.relative(root, markdownOutputPath)}`);
