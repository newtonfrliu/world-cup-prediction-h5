import "./load-env.ts";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  cardFactoryPlayers,
  cardFactoryRoot,
  type CardFactoryPlayer,
} from "./card-factory.config.ts";
import { formatAttemptedEnvPaths } from "./load-env.ts";

type ImageProvider =
  | "Bing Image Search"
  | "SerpAPI Google Images"
  | "Wikimedia Commons"
  | "Wikipedia";

type ImageCandidate = {
  imageUrl: string;
  sourcePage: string;
  provider: ImageProvider;
  title: string;
  width?: number;
  height?: number;
  mime?: string;
  score: number;
};

type DownloadedCandidate = ImageCandidate & {
  saved_path: string;
  downloaded_width: number;
  downloaded_height: number;
  card_score?: number;
  card_score_breakdown?: Record<string, number>;
  portrait_eligible?: boolean;
  portrait_reject_reasons?: string[];
};

type PlayerImageSource = {
  image_url: string;
  source_page: string;
  provider: ImageProvider;
  saved_path: string;
  selected_candidate_path: string;
  title: string;
  width: number;
  height: number;
  score: number;
  candidates: DownloadedCandidate[];
};

type MissingPlayer = {
  slug: string;
  player_name_en: string;
  country: string;
  queries: string[];
  reason: string;
};

type SearchProviderEnv = "bing" | "serpapi";

const playerImageSourcesPath = path.join(
  cardFactoryRoot,
  "data",
  "player-image-sources.json",
);
const missingPlayersPath = path.join(
  cardFactoryRoot,
  "data",
  "missing_players.json",
);

const providerPriority: Record<ImageProvider, number> = {
  "Bing Image Search": 520,
  "SerpAPI Google Images": 510,
  "Wikimedia Commons": 260,
  Wikipedia: 220,
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function getPlayerQueries(player: CardFactoryPlayer) {
  return [
    `${player.playerName} ${player.team} national team portrait`,
    `${player.playerName} ${player.team} football headshot`,
    `${player.playerName} ${player.team} official portrait`,
    `${player.playerName} ${player.team} player profile portrait`,
    `${player.playerName} ${player.team} media day portrait`,
    `${player.playerName} ${player.team} national team head and shoulders`,
    `${player.playerName} site:fifa.com ${player.team} profile`,
    `${player.playerName} site:uefa.com ${player.team} profile`,
    `${player.playerName} site:fpf.pt ${player.team} profile`,
  ];
}

function getConfiguredProvider() {
  const provider = process.env.IMAGE_SEARCH_PROVIDER?.trim().toLowerCase();

  if (provider === "bing" || provider === "serpapi") {
    return provider as SearchProviderEnv;
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreCandidate(player: CardFactoryPlayer, candidate: ImageCandidate) {
  const text = normalizeText(
    `${candidate.title} ${candidate.sourcePage} ${candidate.imageUrl}`,
  );
  const nameParts = normalizeText(player.playerName).split(" ");
  const hasPlayerName = nameParts.every((part) => text.includes(part));
  const hasPortugal = text.includes("portugal") || text.includes("portuguese");
  const hasPortrait =
    text.includes("portrait") ||
    text.includes("headshot") ||
    text.includes("profile") ||
    text.includes("photo") ||
    text.includes("official");
  const hasActionOrStock =
    includesAny(text, [
      "stock photo",
      "stock photography",
      "editorial",
      "live news",
      "during the",
      "match at",
      "qualifier",
      "semi final",
      "round of sixteen",
      "training",
      "alamy",
      "dreamstime",
      "depositphotos",
    ]);
  const isLikelySvg =
    candidate.mime?.includes("svg") || candidate.imageUrl.endsWith(".svg");
  const width = candidate.width ?? 0;
  const height = candidate.height ?? 0;
  const sizeScore = Math.min(Math.max(width, height) / 20, 90);

  let score = providerPriority[candidate.provider] + sizeScore;

  if (hasPlayerName) score += 140;
  if (hasPortugal) score += 45;
  if (hasPortrait) score += 40;
  if (width >= 500 && height >= 500) score += 60;
  if (width < 350 || height < 350) score -= 130;
  if (isLikelySvg) score -= 500;
  if (hasActionOrStock) score -= 260;
  if (text.includes("logo") || text.includes("kit") || text.includes("flag")) {
    score -= 180;
  }

  return score;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function scoreDownloadedCandidateForCard(candidate: DownloadedCandidate) {
  const text = normalizeText(
    `${candidate.title} ${candidate.sourcePage} ${candidate.imageUrl}`,
  );
  const width = candidate.downloaded_width;
  const height = candidate.downloaded_height;
  const aspect = width > 0 ? height / width : 0;
  const breakdown: Record<string, number> = {};

  if (
    includesAny(text, ["portrait", "headshot", "profile", "wall art"]) ||
    (aspect >= 0.95 && aspect <= 1.85)
  ) {
    breakdown.face_area = 40;
  } else if (aspect > 0.7 && aspect < 2.2) {
    breakdown.face_area_partial = 15;
  } else {
    breakdown.face_too_small = -40;
  }

  if (
    includesAny(text, [
      "team photo",
      "squad",
      "group",
      "lineup",
      "players",
      "fans",
    ])
  ) {
    breakdown.multiple_people = -50;
  } else {
    breakdown.single_person = 20;
  }

  if (
    includesAny(text, ["portrait", "headshot", "profile", "wall art"]) ||
    aspect >= 1.0
  ) {
    breakdown.head_complete = 20;
  }

  if (
    includesAny(text, ["portrait", "headshot", "profile", "half body"]) ||
    (aspect >= 0.9 && aspect <= 1.8)
  ) {
    breakdown.upper_body = 20;
  } else if (aspect > 2.0 || includesAny(text, ["full body", "full length"])) {
    breakdown.full_body_long_shot = -40;
  }

  if (
    includesAny(text, [
      "penalty save",
      "save v",
      "during the",
      "match at",
      " vs ",
      " v ",
      "running",
      "kick",
      "qualifier",
      "semi final",
      "round of sixteen",
    ])
  ) {
    breakdown.big_action = -20;
  }

  if (width < 500 || height < 500) {
    breakdown.too_small = -120;
  }

  return {
    total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown,
  };
}

function evaluatePortraitEligibility(candidate: DownloadedCandidate) {
  const text = normalizeText(
    `${candidate.title} ${candidate.sourcePage} ${candidate.imageUrl}`,
  );
  const width = candidate.downloaded_width;
  const height = candidate.downloaded_height;
  const aspect = width > 0 ? height / width : 0;
  const reasons: string[] = [];

  const hasPortraitCue = includesAny(text, [
    "portrait",
    "headshot",
    "profile",
    "official portrait",
    "media day",
    "head and shoulders",
    "head shoulders",
    "player profile",
    "squad profile",
    "signed photo",
    "autograph photo",
    "autographed photo",
    "printed photo",
    "picture display",
  ]);
  const hasStockOrEditorialCue = includesAny(text, [
    "stock photo",
    "stock photography",
    "stock editorial",
    "editorial",
    "live news",
    "photo by",
    "sipa",
    "icon sport",
    "dreamstime",
    "depositphotos",
    "alamy",
  ]);
  const hasActionCue = includesAny(text, [
    "penalty save",
    "save v",
    "during the",
    "match at",
    " vs ",
    " v ",
    "running",
    "sprint",
    "kick",
    "shoot",
    "celebrat",
    "qualifier",
    "semi final",
    "round of sixteen",
    "training session",
    "training of",
    "training ground",
    "goalkeeper diving",
    "dives",
    "diving",
    "with the ball",
    "soccer match",
    "football match",
  ]);
  const hasMultiplePeopleCue = includesAny(text, [
    "team photo",
    "squad",
    "group photo",
    "lineup",
    "line up",
    "players pose",
    "players celebrate",
    "teammates",
  ]);
  const hasFullBodyCue = includesAny(text, [
    "full body",
    "full length",
    "fullbody",
    "full-length",
    "profile full",
    "whole body",
  ]);
  const isUpperBodyAspect = aspect >= 0.85 && aspect <= 1.95;
  const hasStaticSquarePortraitFallback =
    aspect >= 0.95 &&
    aspect <= 1.08 &&
    !hasActionCue &&
    !hasMultiplePeopleCue &&
    !hasFullBodyCue &&
    !hasStockOrEditorialCue;
  const isLikelyHeadLargeEnough =
    (hasPortraitCue || hasStaticSquarePortraitFallback) &&
    aspect >= 0.85 &&
    aspect <= 1.85;

  if (width < 500 || height < 500) {
    reasons.push("image smaller than 500x500");
  }

  if (hasMultiplePeopleCue) {
    reasons.push("multiple people cue");
  }

  if (hasActionCue) {
    reasons.push("action/match cue");
  }

  if (hasStockOrEditorialCue && !hasPortraitCue) {
    reasons.push("stock/editorial source without portrait cue");
  }

  if (!hasPortraitCue && !hasStaticSquarePortraitFallback) {
    reasons.push("missing explicit portrait/headshot/profile cue");
  }

  if (hasFullBodyCue || aspect > 2.05) {
    reasons.push("full body or long-shot cue");
  }

  if (!isUpperBodyAspect) {
    reasons.push("not upper-body portrait aspect");
  }

  if (!isLikelyHeadLargeEnough) {
    reasons.push("head likely below 20% of image");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

function uniqueCandidates(candidates: ImageCandidate[]) {
  const seen = new Set<string>();
  const unique: ImageCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.imageUrl.trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

async function fetchWithRetry(url: string, init?: RequestInit) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "User-Agent":
            "world-cup-prediction-h5-card-factory/1.0 (local POC; contact: local-dev)",
          ...(init?.headers ?? {}),
        },
      });

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await wait(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2500 * attempt,
        );
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await wait(1200 * attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithRetry(url, init);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function searchBingImages(player: CardFactoryPlayer) {
  type BingImage = {
    name?: string;
    contentUrl?: string;
    hostPageUrl?: string;
    width?: number;
    height?: number;
    encodingFormat?: string;
  };
  type BingResponse = {
    value?: BingImage[];
  };

  const apiKey = process.env.BING_IMAGE_SEARCH_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      `Missing BING_IMAGE_SEARCH_API_KEY. Attempted env files: ${formatAttemptedEnvPaths()}`,
    );
  }

  const candidates: ImageCandidate[] = [];

  for (const query of getPlayerQueries(player)) {
    const url = new URL("https://api.bing.microsoft.com/v7.0/images/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "5");
    url.searchParams.set("safeSearch", "Moderate");
    url.searchParams.set("mkt", "en-US");
    url.searchParams.set("imageType", "Photo");

    const data = await fetchJson<BingResponse>(url.toString(), {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });

    for (const item of data.value ?? []) {
      if (!item.contentUrl) {
        continue;
      }

      const candidate: ImageCandidate = {
        imageUrl: item.contentUrl,
        sourcePage: item.hostPageUrl ?? item.contentUrl,
        provider: "Bing Image Search",
        title: item.name ?? query,
        width: item.width,
        height: item.height,
        mime: item.encodingFormat ? `image/${item.encodingFormat}` : undefined,
        score: 0,
      };
      candidate.score = scoreCandidate(player, candidate);
      candidates.push(candidate);
    }
  }

  return uniqueCandidates(candidates).sort((left, right) => right.score - left.score);
}

async function searchSerpApiImages(player: CardFactoryPlayer) {
  type SerpImage = {
    title?: string;
    original?: string;
    link?: string;
    source?: string;
    original_width?: number;
    original_height?: number;
  };
  type SerpResponse = {
    images_results?: SerpImage[];
  };

  const apiKey = process.env.SERPAPI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      `Missing SERPAPI_API_KEY. Attempted env files: ${formatAttemptedEnvPaths()}`,
    );
  }

  const candidates: ImageCandidate[] = [];

  for (const query of getPlayerQueries(player)) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_images");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("ijn", "0");
    url.searchParams.set("safe", "active");

    const data = await fetchJson<SerpResponse>(url.toString());

    for (const item of data.images_results ?? []) {
      if (!item.original) {
        continue;
      }

      const candidate: ImageCandidate = {
        imageUrl: item.original,
        sourcePage: item.link ?? item.source ?? item.original,
        provider: "SerpAPI Google Images",
        title: item.title ?? query,
        width: item.original_width,
        height: item.original_height,
        score: 0,
      };
      candidate.score = scoreCandidate(player, candidate);
      candidates.push(candidate);
    }
  }

  return uniqueCandidates(candidates).sort((left, right) => right.score - left.score);
}

async function searchWikipedia(player: CardFactoryPlayer) {
  type SearchResponse = [string, string[], string[], string[]];
  type SummaryResponse = {
    title?: string;
    originalimage?: {
      source?: string;
      width?: number;
      height?: number;
    };
    content_urls?: {
      desktop?: {
        page?: string;
      };
    };
  };

  const candidates: ImageCandidate[] = [];
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "opensearch");
  searchUrl.searchParams.set("search", player.playerName);
  searchUrl.searchParams.set("limit", "3");
  searchUrl.searchParams.set("namespace", "0");
  searchUrl.searchParams.set("format", "json");

  const searchData = await fetchJson<SearchResponse>(searchUrl.toString());
  const titles = searchData[1] ?? [];

  for (const title of titles) {
    const normalizedTitle = normalizeText(title);
    const normalizedName = normalizeText(player.playerName);

    if (!normalizedTitle.includes(normalizedName.split(" ")[0])) {
      continue;
    }

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summary = await fetchJson<SummaryResponse>(summaryUrl);
    const imageUrl = summary.originalimage?.source;

    if (!imageUrl) {
      continue;
    }

    const candidate: ImageCandidate = {
      imageUrl,
      sourcePage:
        summary.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      provider: "Wikipedia",
      title: summary.title ?? title,
      width: summary.originalimage?.width,
      height: summary.originalimage?.height,
      score: 0,
    };
    candidate.score = scoreCandidate(player, candidate);
    candidates.push(candidate);
  }

  return candidates;
}

async function searchWikimediaCommons(player: CardFactoryPlayer) {
  type CommonsResponse = {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            url?: string;
            descriptionurl?: string;
            width?: number;
            height?: number;
            mime?: string;
          }>;
        }
      >;
    };
  };

  const candidates: ImageCandidate[] = [];

  for (const query of getPlayerQueries(player)) {
    await wait(350);
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|mime");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const data = await fetchJson<CommonsResponse>(url.toString());
    const pages = Object.values(data.query?.pages ?? {});

    for (const page of pages) {
      const image = page.imageinfo?.[0];

      if (!image?.url) {
        continue;
      }

      const candidate: ImageCandidate = {
        imageUrl: image.url,
        sourcePage: image.descriptionurl ?? "https://commons.wikimedia.org/",
        provider: "Wikimedia Commons",
        title: page.title ?? query,
        width: image.width,
        height: image.height,
        mime: image.mime,
        score: 0,
      };
      candidate.score = scoreCandidate(player, candidate);
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function searchFallbackImages(player: CardFactoryPlayer) {
  const candidates = [
    ...(await searchWikipedia(player)),
    ...(await searchWikimediaCommons(player)),
  ];

  return uniqueCandidates(candidates).sort((left, right) => right.score - left.score);
}

async function searchPrimaryImages(player: CardFactoryPlayer) {
  const provider = getConfiguredProvider();

  if (provider === "bing") {
    return searchBingImages(player);
  }

  if (provider === "serpapi") {
    return searchSerpApiImages(player);
  }

  throw new Error(
    `Missing IMAGE_SEARCH_PROVIDER. Use bing or serpapi. Attempted env files: ${formatAttemptedEnvPaths()}`,
  );
}

async function findImageCandidates(player: CardFactoryPlayer) {
  try {
    const primaryCandidates = await searchPrimaryImages(player);

    if (primaryCandidates.length > 0) {
      return primaryCandidates.slice(0, 24);
    }

    console.log(`[fallback] ${player.playerName}: primary provider returned no candidates`);
  } catch (error) {
    console.error(
      `[fallback] ${player.playerName}: ${(error as Error).message}`,
    );
  }

  const fallbackCandidates = await searchFallbackImages(player);
  return fallbackCandidates.slice(0, 24);
}

async function downloadAsJpeg(imageUrl: string, outputPath: string) {
  const response = await fetchWithRetry(imageUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  ensureDir(outputPath);
  await sharp(buffer)
    .rotate()
    .jpeg({
      quality: 94,
      mozjpeg: true,
    })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

async function downloadCandidates(player: CardFactoryPlayer, candidates: ImageCandidate[]) {
  const downloaded: DownloadedCandidate[] = [];
  const candidateDir = path.join(
    cardFactoryRoot,
    "source_images",
    player.country,
    "candidates",
    player.slug,
  );

  for (const [index, candidate] of candidates.entries()) {
    const candidatePath = path.join(
      candidateDir,
      `${String(index + 1).padStart(2, "0")}.jpg`,
    );

    try {
      const dimensions = await downloadAsJpeg(candidate.imageUrl, candidatePath);
      const downloadedCandidate: DownloadedCandidate = {
        ...candidate,
        saved_path: path.relative(cardFactoryRoot, candidatePath),
        downloaded_width: dimensions.width ?? 0,
        downloaded_height: dimensions.height ?? 0,
      };
      const cardScore = scoreDownloadedCandidateForCard(downloadedCandidate);
      const portraitEligibility =
        evaluatePortraitEligibility(downloadedCandidate);
      downloadedCandidate.card_score = cardScore.total;
      downloadedCandidate.card_score_breakdown = cardScore.breakdown;
      downloadedCandidate.portrait_eligible = portraitEligibility.eligible;
      downloadedCandidate.portrait_reject_reasons = portraitEligibility.reasons;

      downloaded.push(downloadedCandidate);
      console.log(
        `[candidate] ${player.playerName} #${String(index + 1).padStart(2, "0")}: ${downloadedCandidate.downloaded_width}x${downloadedCandidate.downloaded_height} cardScore=${downloadedCandidate.card_score} portrait=${downloadedCandidate.portrait_eligible ? "pass" : `reject:${downloadedCandidate.portrait_reject_reasons?.join(", ")}`}`,
      );
    } catch (error) {
      console.error(
        `[candidate-fail] ${player.playerName} #${index + 1}: ${(error as Error).message}`,
      );
    }
  }

  return downloaded;
}

async function saveSelectedCandidate(
  player: CardFactoryPlayer,
  candidate: DownloadedCandidate,
) {
  await sharp(path.join(cardFactoryRoot, candidate.saved_path))
    .rotate()
    .jpeg({
      quality: 94,
      mozjpeg: true,
    })
    .toFile(player.sourceImagePath);
}

function selectBestCardCandidate(candidates: DownloadedCandidate[]) {
  const validCandidates = candidates.filter(
    (candidate) =>
      candidate.downloaded_width >= 500 && candidate.downloaded_height >= 500,
  );
  const portraitCandidates = validCandidates.filter(
    (candidate) => candidate.portrait_eligible,
  );

  portraitCandidates.sort((left, right) => {
    const cardScoreDiff = (right.card_score ?? 0) - (left.card_score ?? 0);

    if (cardScoreDiff !== 0) {
      return cardScoreDiff;
    }

    return right.score - left.score;
  });

  return portraitCandidates[0] ?? null;
}

async function main() {
  const imageSources: Record<string, PlayerImageSource> = {};
  const missingPlayers: MissingPlayer[] = [];
  let selected = 0;

  for (const player of cardFactoryPlayers) {
    await wait(600);
    const queries = getPlayerQueries(player);
    console.log(`[search] ${player.playerName}`);

    try {
      const candidates = await findImageCandidates(player);

      if (candidates.length === 0) {
        missingPlayers.push({
          slug: player.slug,
          player_name_en: player.playerName,
          country: player.team,
          queries,
          reason: "No usable image candidates found.",
        });
        console.log(`[missing] ${player.playerName}`);
        continue;
      }

      const downloadedCandidates = await downloadCandidates(player, candidates);
      const selectedCandidate = selectBestCardCandidate(downloadedCandidates);

      if (!selectedCandidate) {
        missingPlayers.push({
          slug: player.slug,
          player_name_en: player.playerName,
          country: player.team,
          queries,
          reason: "No portrait-only candidate passed eligibility checks.",
        });
        console.log(
          `[missing] ${player.playerName}: no portrait-only candidate passed eligibility checks`,
        );
        continue;
      }

      await saveSelectedCandidate(player, selectedCandidate);
      selected += 1;
      console.log(
        `[ok] ${player.playerName}: ${player.sourceImagePath} cardScore=${selectedCandidate.card_score}`,
      );

      imageSources[player.slug] = {
        image_url: selectedCandidate.imageUrl,
        source_page: selectedCandidate.sourcePage,
        provider: selectedCandidate.provider,
        saved_path: path.relative(cardFactoryRoot, player.sourceImagePath),
        selected_candidate_path: selectedCandidate.saved_path,
        title: selectedCandidate.title,
        width: selectedCandidate.downloaded_width,
        height: selectedCandidate.downloaded_height,
        score: Math.round(selectedCandidate.score),
        candidates: downloadedCandidates,
      };
    } catch (error) {
      missingPlayers.push({
        slug: player.slug,
        player_name_en: player.playerName,
        country: player.team,
        queries,
        reason: (error as Error).message,
      });
      console.error(`[fail] ${player.playerName}: ${(error as Error).message}`);
    }
  }

  ensureDir(playerImageSourcesPath);
  ensureDir(missingPlayersPath);
  writeFileSync(
    playerImageSourcesPath,
    `${JSON.stringify(imageSources, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    missingPlayersPath,
    `${JSON.stringify(missingPlayers, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Fetch complete. selected=${selected}, sources=${Object.keys(imageSources).length}, missing=${missingPlayers.length}`,
  );

  if (missingPlayers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
