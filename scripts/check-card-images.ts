import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type CardPackagePlayer = {
  country: string;
  shirt_number: number;
  player_name: string;
  player_name_en: string;
  position: string;
  rarity: string;
};

const root = process.cwd();
const targetCountries = ["Germany", "France"];

function normalize(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalize(value)
    .replace(/&/g, " and ")
    .replace(/ /g, "-")
    .replace(/^-+|-+$/g, "");
}

function nameCandidates(playerNameEn: string) {
  const values = new Set<string>([normalize(playerNameEn)]);
  const parts = playerNameEn.trim().split(/\s+/);
  const firstMixedIndex = parts.findIndex((part) => part !== part.toUpperCase());

  if (firstMixedIndex > 0) {
    const lastName = parts.slice(0, firstMixedIndex).join(" ");
    const givenName = parts.slice(firstMixedIndex).join(" ");
    values.add(normalize(`${givenName} ${lastName}`));
    values.add(normalize(`${lastName} ${givenName}`));
  }

  return values;
}

function isCorePlayer(country: string, player: CardPackagePlayer, coreCards: Record<string, string[]>) {
  const coreNames = new Set((coreCards[country] ?? []).map(normalize));
  const candidates = nameCandidates(player.player_name_en);

  return Array.from(candidates).some((candidate) => coreNames.has(candidate));
}

function getPaniniFiles() {
  const paniniRoot = path.join(root, "public", "cards", "panini");
  const files = new Set<string>();

  if (!existsSync(paniniRoot)) {
    return files;
  }

  for (const countrySlug of readdirSync(paniniRoot)) {
    const countryDir = path.join(paniniRoot, countrySlug);

    for (const filename of readdirSync(countryDir)) {
      if (filename.toLowerCase().endsWith(".png")) {
        files.add(`/cards/panini/${countrySlug}/${filename}`);
      }
    }
  }

  return files;
}

function main() {
  const packages = JSON.parse(
    readFileSync(path.join(root, "data", "card-production-packages.json"), "utf8"),
  ) as Record<string, CardPackagePlayer[]>;
  const coreCards = JSON.parse(
    readFileSync(path.join(root, "data", "core-cards.json"), "utf8"),
  ) as Record<string, string[]>;
  const paniniFiles = getPaniniFiles();
  const matchedPaniniFiles = new Set<string>();
  const genericFallbacks: Array<{
    country: string;
    player_name: string;
    player_name_en: string;
    expected_panini_path: string;
  }> = [];

  console.log("Card image source check");
  console.log("=======================");

  for (const country of targetCountries) {
    const players = packages[country] ?? [];
    const stats = {
      core: 0,
      panini: 0,
      generic: 0,
    };

    for (const player of players) {
      if (isCorePlayer(country, player, coreCards)) {
        stats.core += 1;
        continue;
      }

      const paniniPath = `/cards/panini/${slugify(country)}/${slugify(player.player_name_en)}.png`;

      if (paniniFiles.has(paniniPath)) {
        stats.panini += 1;
        matchedPaniniFiles.add(paniniPath);
      } else {
        stats.generic += 1;
        genericFallbacks.push({
          country,
          player_name: player.player_name,
          player_name_en: player.player_name_en,
          expected_panini_path: paniniPath,
        });
      }
    }

    console.log(`${country}: core=${stats.core}, panini=${stats.panini}, generic=${stats.generic}`);
  }

  for (const [country, players] of Object.entries(packages)) {
    for (const player of players) {
      if (isCorePlayer(country, player, coreCards)) {
        continue;
      }

      const paniniPath = `/cards/panini/${slugify(country)}/${slugify(player.player_name_en)}.png`;

      if (paniniFiles.has(paniniPath)) {
        matchedPaniniFiles.add(paniniPath);
      }
    }
  }

  const orphanFiles = Array.from(paniniFiles)
    .filter((filename) => !matchedPaniniFiles.has(filename))
    .sort();

  console.log("");
  console.log(`Orphan Panini files: ${orphanFiles.length}`);
  orphanFiles.forEach((filename) => console.log(`- ${filename}`));

  console.log("");
  console.log(`Non-core Germany/France players falling back to generic: ${genericFallbacks.length}`);
  genericFallbacks.forEach((item) => {
    console.log(`- ${item.country}: ${item.player_name} / ${item.player_name_en} -> ${item.expected_panini_path}`);
  });
}

main();
