import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type CardPackagePlayer = {
  country: string;
  player_name: string;
  player_name_en: string;
  card_filename_suggestion: string;
};

type CardPackages = Record<string, CardPackagePlayer[]>;

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

type ManifestEntry = {
  country: string;
  player_name: string;
  player_name_en: string;
  output_path: string;
  status: "downloaded" | "skipped" | "exists" | "failed";
  source: "Wikimedia Commons";
  source_url?: string;
  commons_title?: string;
  license?: string;
  reason?: string;
};

const countryDirMap: Record<string, string> = {
  Portugal: "portugal",
  Argentina: "argentina",
  Brazil: "brazil",
  Germany: "germany",
  England: "england",
  France: "france",
  Spain: "spain",
  Netherlands: "netherlands",
  Japan: "japan",
};

const blockedTitleWords = [
  "logo",
  "flag",
  "kit",
  "jersey",
  "shirt",
  "formation",
  "stadium",
  "coach",
  "manager",
  "fans",
  "team",
  "squad",
  "map",
  "icon",
  "badge",
  "emblem",
];

const requestDelayMs = Number(process.env.FETCH_PLAYER_PHOTO_DELAY_MS ?? 1800);
const retryDelayMs = Number(process.env.FETCH_PLAYER_PHOTO_RETRY_DELAY_MS ?? 30000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRateLimit(url: string | URL) {
  await sleep(requestDelayMs);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "world-cup-prediction-h5/1.0 (local asset preparation; Wikimedia Commons open-license image lookup)",
    },
  });

  if (response.status !== 429) {
    return response;
  }

  await sleep(retryDelayMs);
  return fetch(url, {
    headers: {
      "User-Agent": "world-cup-prediction-h5/1.0 (local asset preparation; Wikimedia Commons open-license image lookup)",
    },
  });
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function displayNameFromFifaName(playerNameEn: string) {
  const parts = playerNameEn.trim().split(/\s+/);
  const firstLowerIndex = parts.findIndex((part) => /[a-z]/.test(part));
  if (firstLowerIndex <= 0) {
    return playerNameEn;
  }

  const last = parts.slice(0, firstLowerIndex).join(" ");
  const first = parts.slice(firstLowerIndex).join(" ");
  return `${first} ${last}`;
}

function getSearchQueries(player: CardPackagePlayer) {
  const displayName = displayNameFromFifaName(player.player_name_en);
  const queries = [
    `${displayName} footballer`,
    `${displayName} ${player.country} football`,
    `${player.player_name_en} footballer`,
  ];

  return [...new Set(queries)];
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isOpenLicense(metadata: Record<string, { value?: string }> | undefined) {
  const license = `${metadata?.LicenseShortName?.value ?? ""} ${metadata?.UsageTerms?.value ?? ""}`;
  const normalized = license.toLowerCase();
  return (
    normalized.includes("cc") ||
    normalized.includes("public domain") ||
    normalized.includes("pd") ||
    normalized.includes("gfdl")
  );
}

function scoreCandidate(player: CardPackagePlayer, page: CommonsPage) {
  const title = page.title ?? "";
  const normalizedTitle = normalizeName(title);
  const displayName = normalizeName(displayNameFromFifaName(player.player_name_en));
  const fifaName = normalizeName(player.player_name_en);
  const titleWordsBlocked = blockedTitleWords.some((word) => normalizedTitle.includes(word));

  if (titleWordsBlocked) {
    return -100;
  }

  let score = 0;
  if (normalizedTitle.includes(displayName)) score += 80;
  if (normalizedTitle.includes(fifaName)) score += 60;
  if (normalizedTitle.includes("football")) score += 8;
  if (normalizedTitle.includes("soccer")) score += 6;
  if (normalizedTitle.includes(normalizeName(player.country))) score += 4;
  if (normalizedTitle.endsWith(".jpg") || normalizedTitle.endsWith(".jpeg")) score += 3;
  if (normalizedTitle.endsWith(".png")) score += 2;

  return score;
}

async function searchCommons(player: CardPackagePlayer) {
  for (const query of getSearchQueries(player)) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime|extmetadata");
    url.searchParams.set("iiurlwidth", "768");

    const response = await fetchWithRateLimit(url);

    if (!response.ok) {
      throw new Error(`Wikimedia API failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = Object.values(data.query?.pages ?? {});
    const candidates = pages
      .filter((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.url) return false;
        if (!["image/jpeg", "image/png", "image/webp"].includes(info.mime ?? "")) return false;
        return isOpenLicense(info.extmetadata);
      })
      .map((page) => ({ page, score: scoreCandidate(player, page) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates[0]) {
      return candidates[0].page;
    }
  }

  return null;
}

async function downloadFile(url: string, outputPath: string) {
  const response = await fetchWithRateLimit(url);

  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${await response.text()}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const tempPath = `${outputPath}.source`;
  fs.writeFileSync(tempPath, bytes);

  try {
    const converter = [
      "Add-Type -AssemblyName System.Drawing",
      `$img=[System.Drawing.Image]::FromFile('${tempPath.replace(/'/g, "''")}')`,
      `$img.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
      "$img.Dispose()",
    ].join("; ");
    execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", converter], {
      stdio: "pipe",
    });
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

async function main() {
  const root = process.cwd();
  const packagePath = path.join(root, "data", "card-production-packages.json");
  const outputRoot = path.join(root, "assets", "player_photos");
  const manifestPath = path.join(outputRoot, "manifest.json");
  const packages = JSON.parse(fs.readFileSync(packagePath, "utf8")) as CardPackages;
  const manifest: ManifestEntry[] = [];
  const writeManifest = () => {
    ensureDir(outputRoot);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  };

  for (const [country, players] of Object.entries(packages)) {
    const dirName = countryDirMap[country];
    if (!dirName) continue;

    const countryDir = path.join(outputRoot, dirName);
    ensureDir(countryDir);

    for (const player of players) {
      const outputPath = path.join(countryDir, player.card_filename_suggestion);
      const relativeOutput = path.relative(root, outputPath).replace(/\\/g, "/");

      if (fs.existsSync(outputPath)) {
        manifest.push({
          country,
          player_name: player.player_name,
          player_name_en: player.player_name_en,
          output_path: relativeOutput,
          status: "exists",
          source: "Wikimedia Commons",
        });
        continue;
      }

      try {
        const page = await searchCommons(player);
        const info = page?.imageinfo?.[0];

        if (!page || !info?.url) {
          manifest.push({
            country,
            player_name: player.player_name,
            player_name_en: player.player_name_en,
            output_path: relativeOutput,
            status: "skipped",
            source: "Wikimedia Commons",
            reason: "No open-license Wikimedia Commons image confidently matched",
          });
          writeManifest();
          continue;
        }

        const downloadUrl = info.thumburl ?? info.url;
        await downloadFile(downloadUrl, outputPath);
        manifest.push({
          country,
          player_name: player.player_name,
          player_name_en: player.player_name_en,
          output_path: relativeOutput,
          status: "downloaded",
          source: "Wikimedia Commons",
          source_url: downloadUrl,
          commons_title: page.title,
          license: info.extmetadata?.LicenseShortName?.value ?? info.extmetadata?.UsageTerms?.value,
        });
        console.log(`Downloaded ${relativeOutput}`);
        writeManifest();
      } catch (error) {
        manifest.push({
          country,
          player_name: player.player_name,
          player_name_en: player.player_name_en,
          output_path: relativeOutput,
          status: "failed",
          source: "Wikimedia Commons",
          reason: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed ${relativeOutput}`, error);
        writeManifest();
      }
    }
  }

  writeManifest();

  const totals = manifest.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { downloaded: 0, skipped: 0, exists: 0, failed: 0 },
  );

  console.log(`Total players: ${manifest.length}`);
  console.log(`Downloaded: ${totals.downloaded}`);
  console.log(`Already exists: ${totals.exists}`);
  console.log(`Skipped: ${totals.skipped}`);
  console.log(`Failed: ${totals.failed}`);
  console.log(`Manifest: ${path.relative(root, manifestPath).replace(/\\/g, "/")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
