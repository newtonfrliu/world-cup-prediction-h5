import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type PlayerCardRow = {
  id: string;
  team: string;
  player_name: string;
  player_name_en: string | null;
  card_art_url: string | null;
  roster_source: string | null;
};

const cardAssetRoot = path.join(process.cwd(), "public", "cards");
const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

function toAssetUrl(filePath: string) {
  const relativePath = path.relative(path.join(process.cwd(), "public"), filePath);

  return `/${relativePath.replace(/\\/g, "/")}`;
}

function scanCardAssets(directory: string) {
  const assets: string[] = [];

  if (!existsSync(directory)) {
    return assets;
  }

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      assets.push(...scanCardAssets(fullPath));
      continue;
    }

    if (stats.isFile() && supportedExtensions.has(path.extname(entry).toLowerCase())) {
      assets.push(toAssetUrl(fullPath));
    }
  }

  return assets.sort((a, b) => a.localeCompare(b));
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function inferTeamFromAsset(assetUrl: string) {
  const parts = assetUrl.split("/").filter(Boolean);

  return parts.length >= 3 ? parts[1] : "";
}

function inferSlugFromAsset(assetUrl: string) {
  return path.basename(assetUrl, path.extname(assetUrl));
}

function findLikelyCardForAsset(assetUrl: string, cards: PlayerCardRow[]) {
  const teamSlug = inferTeamFromAsset(assetUrl);
  const assetSlug = normalize(inferSlugFromAsset(assetUrl));
  const teamCards = cards.filter(
    (card) =>
      card.roster_source === "fifa_official_squad" &&
      normalize(card.team) === normalize(teamSlug),
  );

  const candidateKeys = (card: PlayerCardRow) =>
    [card.player_name_en, card.player_name]
      .map(normalize)
      .filter((key) => key.length > 0);

  return (
    teamCards.find((card) =>
      candidateKeys(card).some((key) => key === assetSlug),
    ) ??
    teamCards.find((card) =>
      candidateKeys(card).some(
        (key) => key.includes(assetSlug) || assetSlug.includes(key),
      ),
    ) ??
    null
  );
}

async function loadPlayerCards() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const rows: PlayerCardRow[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("player_cards")
      .select("id, team, player_name, player_name_en, card_art_url, roster_source")
      .range(from, from + 999);

    if (error) {
      throw new Error(`Failed to load player_cards: ${error.message}`);
    }

    rows.push(...((data ?? []) as PlayerCardRow[]));

    if (!data || data.length < 1000) {
      break;
    }
  }

  return rows;
}

function printRows(rows: PlayerCardRow[]) {
  for (const row of rows) {
    console.log(
      `  - ${row.team} | ${row.player_name} / ${row.player_name_en ?? "-"} | ${row.roster_source ?? "-"} | id=${row.id}`,
    );
  }
}

async function main() {
  loadLocalEnv();

  const localAssets = scanCardAssets(cardAssetRoot);
  const localAssetSet = new Set(localAssets);
  const playerCards = await loadPlayerCards();
  const referencedAssets = new Map<string, PlayerCardRow[]>();

  for (const card of playerCards) {
    const assetUrl = card.card_art_url?.trim();

    if (!assetUrl) {
      continue;
    }

    const rows = referencedAssets.get(assetUrl) ?? [];
    rows.push(card);
    referencedAssets.set(assetUrl, rows);
  }

  const missingLocalFiles = [...referencedAssets.entries()]
    .filter(([assetUrl]) => !localAssetSet.has(assetUrl))
    .sort(([a], [b]) => a.localeCompare(b));

  const unreferencedLocalAssets = localAssets.filter(
    (assetUrl) => !referencedAssets.has(assetUrl),
  );

  const duplicatedReferences = [...referencedAssets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .sort(([a], [b]) => a.localeCompare(b));

  const officialNonOfficialAssetUsers = playerCards.filter(
    (card) => card.card_art_url && card.roster_source !== "fifa_official_squad",
  );

  console.log("Card asset check");
  console.log(`Local image files: ${localAssets.length}`);
  console.log(`Player cards loaded: ${playerCards.length}`);
  console.log(`Referenced card_art_url values: ${referencedAssets.size}`);
  console.log("");

  console.log("A. 数据库有 card_art_url，但本地文件不存在");
  if (missingLocalFiles.length === 0) {
    console.log("  OK: no missing local files.");
  } else {
    for (const [assetUrl, rows] of missingLocalFiles) {
      console.log(`\n  ${assetUrl}`);
      printRows(rows);
      console.log("  Suggested SQL:");
      for (const row of rows) {
        console.log(
          `    update public.player_cards set card_art_url = null, card_thumb_url = null where id = ${sqlString(row.id)};`,
        );
      }
    }
  }
  console.log("");

  console.log("B. 本地图片存在，但数据库没人引用");
  if (unreferencedLocalAssets.length === 0) {
    console.log("  OK: every local image is referenced.");
  } else {
    for (const assetUrl of unreferencedLocalAssets) {
      const likelyCard = findLikelyCardForAsset(assetUrl, playerCards);
      console.log(`\n  ${assetUrl}`);

      if (likelyCard?.player_name_en) {
        console.log(
          `  Suggested SQL: update public.player_cards set card_art_url = ${sqlString(assetUrl)}, card_thumb_url = ${sqlString(assetUrl)} where roster_source = 'fifa_official_squad' and player_name_en = ${sqlString(likelyCard.player_name_en)};`,
        );
      } else {
        console.log(
          "  Suggested SQL: -- no obvious official player match found; check the filename before assigning.",
        );
        console.log(
          `  -- update public.player_cards set card_art_url = ${sqlString(assetUrl)}, card_thumb_url = ${sqlString(assetUrl)} where roster_source = 'fifa_official_squad' and player_name_en = 'XXXX';`,
        );
      }
    }
  }
  console.log("");

  console.log("C. 同一张图片被多个球员引用");
  if (duplicatedReferences.length === 0) {
    console.log("  OK: no duplicated card_art_url references.");
  } else {
    for (const [assetUrl, rows] of duplicatedReferences) {
      console.log(`\n  ${assetUrl} count=${rows.length}`);
      printRows(rows);
      const officialRows = rows.filter(
        (row) => row.roster_source === "fifa_official_squad",
      );

      if (officialRows.length > 1) {
        console.log("  Suggested SQL:");
        for (const row of officialRows.slice(1)) {
          console.log(
            `    update public.player_cards set card_art_url = null, card_thumb_url = null where id = ${sqlString(row.id)};`,
          );
        }
      } else {
        console.log("  Note: duplicate only involves inactive/history cards or one official card.");
      }
    }
  }
  console.log("");

  console.log("D. inactive 旧卡仍保留 card_art_url");
  if (officialNonOfficialAssetUsers.length === 0) {
    console.log("  OK: no inactive card_art_url rows.");
  } else {
    console.log(
      `  Found ${officialNonOfficialAssetUsers.length} inactive/history rows with card_art_url. They do not affect the main card pool.`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

export {};
