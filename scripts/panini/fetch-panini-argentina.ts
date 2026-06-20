import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SquadPlayer = {
  country: string;
  shirt_number: number;
  position: string;
  player_name: string;
  player_name_en: string;
  name_on_shirt?: string;
};

type Candidate = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  source_page: string;
  image_url: string;
  title: string;
  alt: string;
  provider: string;
  width: number | null;
  height: number | null;
  score_breakdown: Record<string, number>;
  total_score: number;
  local_path?: string;
  download_error?: string;
};

type PlayerSourceRecord = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  search_queries: string[];
  candidates: Candidate[];
  selected_source_url: string | null;
  selected_local_path: string | null;
};

type MissingRecord = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  reason: string;
};

const root = process.cwd();
const rawRoot = path.join(root, "source_images", "panini", "argentina", "raw");
const sourcesPath = path.join(root, "data", "panini-argentina-sources.json");
const missingPath = path.join(root, "data", "panini-argentina-missing.json");
const squadPath = path.join(root, "data", "fifa-2026-squads.json");
const provider = process.env.IMAGE_SEARCH_PROVIDER ?? "serpapi";
const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadLocalEnv() {
  const envPath = path.join(root, ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, "utf8");

  for (const line of text.split(/\r?\n/)) {
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function loadArgentinaPlayers() {
  const data = JSON.parse(readFileSync(squadPath, "utf8")) as {
    countries: Array<{ country: string; players: SquadPlayer[] }>;
  };
  const argentina = data.countries.find((country) => country.country === "Argentina");

  if (!argentina) {
    throw new Error("Argentina squad not found in data/fifa-2026-squads.json");
  }

  return argentina.players.map((player) => ({
    ...player,
    player_slug: slugify(player.player_name_en),
  }));
}

function buildQueries(player: SquadPlayer) {
  return [
    `"Panini FIFA World Cup 2026" "${player.player_name_en}" "Argentina"`,
    `"Panini Adrenalyn XL 2026" "${player.player_name_en}" "Argentina"`,
    `"Panini 2026 World Cup card" "${player.player_name_en}"`,
    `"Panini Argentina 2026" "${player.player_name_en}"`,
  ];
}

function scoreCandidate(player: SquadPlayer, candidate: Omit<Candidate, "score_breakdown" | "total_score">) {
  const text = normalize(
    [
      candidate.title,
      candidate.alt,
      candidate.source_page,
      candidate.image_url,
    ].join(" "),
  );
  const playerTokens = [
    player.player_name_en,
    player.name_on_shirt ?? "",
    player.player_name,
  ]
    .filter(Boolean)
    .map(normalize);
  const score_breakdown: Record<string, number> = {};

  if (playerTokens.some((token) => token && text.includes(token))) {
    score_breakdown.player_name = 40;
  }

  if (text.includes("panini")) {
    score_breakdown.panini = 50;
  }

  if (text.includes("adrenalyn")) {
    score_breakdown.adrenalyn = 40;
  }

  if (text.includes("world cup")) {
    score_breakdown.world_cup = 20;
  }

  if (/#\d+|card number|no\.?\s?\d+/.test(text)) {
    score_breakdown.card_number = 20;
  }

  if (text.includes("argentina") && (text.includes("team set") || text.includes("collection"))) {
    score_breakdown.argentina_team_set = 20;
  }

  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height;

    if (ratio > 0.55 && ratio < 0.78) {
      score_breakdown.portrait_card_ratio = 20;
    }

    if (candidate.width > 600) {
      score_breakdown.width_gt_600 = 20;
    }

    if (ratio > 1.05) {
      score_breakdown.horizontal_image = -40;
    }

    if (candidate.width < 300 || candidate.height < 450) {
      score_breakdown.thumbnail = -30;
    }
  }

  for (const [term, penalty] of [
    ["fut", -100],
    ["ea fc", -100],
    ["fan card", -100],
    ["custom card", -100],
    ["dream team", -100],
  ] as const) {
    if (text.includes(term)) {
      score_breakdown[term.replace(/\s+/g, "_")] = penalty;
    }
  }

  const total_score = Object.values(score_breakdown).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    score_breakdown,
    total_score,
  };
}

async function searchSerpApi(query: string) {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is missing");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("ijn", "0");

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const data = await response.json() as {
    images_results?: Array<{
      title?: string;
      original?: string;
      thumbnail?: string;
      source?: string;
      link?: string;
      original_width?: number;
      original_height?: number;
    }>;
  };

  return (data.images_results ?? []).map((item) => ({
    title: item.title ?? "",
    alt: item.title ?? "",
    image_url: item.original ?? item.thumbnail ?? "",
    source_page: item.link ?? item.source ?? "",
    provider: "serpapi",
    width: item.original_width ?? null,
    height: item.original_height ?? null,
  })).filter((item) => item.image_url);
}

async function downloadCandidate(candidate: Candidate, outputPath: string) {
  const response = await fetch(candidate.image_url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length < 10_000) {
    throw new Error(`image too small: ${buffer.length} bytes`);
  }

  writeFileSync(outputPath, buffer);
}

function outputExtension(candidate: Candidate) {
  try {
    const ext = path.extname(new URL(candidate.image_url).pathname).toLowerCase();
    return supportedImageExtensions.has(ext) ? ext : ".jpg";
  } catch {
    return ".jpg";
  }
}

async function main() {
  loadLocalEnv();

  if (provider !== "serpapi") {
    throw new Error(`Unsupported IMAGE_SEARCH_PROVIDER for this POC: ${provider}`);
  }

  mkdirSync(rawRoot, { recursive: true });

  const players = loadArgentinaPlayers();
  const records: PlayerSourceRecord[] = [];
  const missing: MissingRecord[] = [];

  for (const player of players) {
    const playerSlug = player.player_slug;
    const playerRawDir = path.join(rawRoot, playerSlug);
    const queries = buildQueries(player);
    const candidateByUrl = new Map<string, Candidate>();

    mkdirSync(playerRawDir, { recursive: true });
    console.log(`[search] ${player.player_name_en}`);

    for (const query of queries) {
      try {
        const searchResults = await searchSerpApi(query);

        for (const searchResult of searchResults) {
          const candidateBase = {
            player_slug: playerSlug,
            player_name: player.player_name,
            player_name_en: player.player_name_en,
            shirt_number: player.shirt_number,
            position: player.position,
            ...searchResult,
          };
          const score = scoreCandidate(player, candidateBase);
          const candidate: Candidate = {
            ...candidateBase,
            ...score,
          };

          if (!candidateByUrl.has(candidate.image_url)) {
            candidateByUrl.set(candidate.image_url, candidate);
          }
        }
      } catch (error) {
        console.error(`[search failed] ${player.player_name_en}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const candidates = Array.from(candidateByUrl.values())
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 3);
    const downloadedCandidates: Candidate[] = [];

    for (const [index, candidate] of candidates.entries()) {
      const ext = outputExtension(candidate);
      const outputPath = path.join(
        playerRawDir,
        `${String(index + 1).padStart(2, "0")}${ext}`,
      );

      try {
        if (!existsSync(outputPath)) {
          await downloadCandidate(candidate, outputPath);
        }

        downloadedCandidates.push({
          ...candidate,
          local_path: path.relative(root, outputPath).replace(/\\/g, "/"),
        });
      } catch (error) {
        downloadedCandidates.push({
          ...candidate,
          download_error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const selected = downloadedCandidates.find((candidate) => candidate.local_path);

    records.push({
      player_slug: playerSlug,
      player_name: player.player_name,
      player_name_en: player.player_name_en,
      shirt_number: player.shirt_number,
      position: player.position,
      search_queries: queries,
      candidates: downloadedCandidates,
      selected_source_url: selected?.image_url ?? null,
      selected_local_path: selected?.local_path ?? null,
    });

    if (!selected) {
      missing.push({
        player_slug: playerSlug,
        player_name: player.player_name,
        player_name_en: player.player_name_en,
        reason: candidates.length === 0 ? "no candidates found" : "no candidate downloaded",
      });
    }
  }

  writeFileSync(sourcesPath, JSON.stringify(records, null, 2), "utf8");
  writeFileSync(missingPath, JSON.stringify(missing, null, 2), "utf8");

  console.log(`Argentina players: ${players.length}`);
  console.log(`Source records: ${records.length}`);
  console.log(`Missing: ${missing.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
