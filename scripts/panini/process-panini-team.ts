import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

type Candidate = {
  local_path?: string;
  total_score: number;
  width: number | null;
  height: number | null;
  score_breakdown?: Record<string, number>;
};

type PlayerSourceRecord = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  candidates: Candidate[];
  selected_source_url: string | null;
};

type ProcessedRecord = {
  player_slug: string;
  player_name: string;
  player_name_en: string;
  shirt_number: number;
  position: string;
  source_url: string | null;
  source_path: string | null;
  processed_path: string | null;
  public_path: string | null;
  score: number;
  width: number | null;
  height: number | null;
  review_flags: string[];
  error?: string;
};

const root = process.cwd();
const targetWidth = 1024;
const targetHeight = 1536;
const targetRatio = targetWidth / targetHeight;

function getCountryArg() {
  const index = process.argv.indexOf("--country");
  const country = index >= 0 ? process.argv[index + 1] : "";

  if (!country) {
    throw new Error("Missing required argument: --country CountryName");
  }

  return country;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function relative(filePath: string) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function getReviewFlags(candidate: Candidate) {
  const flags: string[] = [];

  if (candidate.total_score < 70) {
    flags.push("score < 70");
  }

  if (!candidate.score_breakdown?.panini) {
    flags.push("无 Panini 关键词命中");
  }

  if ((candidate.width ?? 0) < 600) {
    flags.push("image width < 600");
  }

  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height;

    if (ratio < 0.45 || ratio > 0.9) {
      flags.push("ratio 异常");
    }
  } else {
    flags.push("missing dimensions");
  }

  return flags;
}

async function normalizeCard(inputPath: string, outputPath: string) {
  const metadata = await sharp(inputPath, { failOn: "none" }).rotate().metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("missing image metadata");
  }

  await sharp(inputPath, { failOn: "none" })
    .rotate()
    .trim({ threshold: 12 })
    .resize(targetWidth, targetHeight, {
      fit: "contain",
      position: "centre",
      background: { r: 246, g: 241, b: 231, alpha: 1 },
      withoutEnlargement: false,
    })
    .flatten({ background: { r: 246, g: 241, b: 231 } })
    .png()
    .toFile(outputPath);
}

async function main() {
  const country = getCountryArg();
  const countrySlug = slugify(country);
  const sourcesPath = path.join(root, "data", `panini-${countrySlug}-sources.json`);
  const missingPath = path.join(root, "data", `panini-${countrySlug}-missing.json`);
  const processedRoot = path.join(root, "processed", "panini", countrySlug);
  const publicRoot = path.join(root, "public", "cards", "panini", countrySlug);
  const processedSummaryPath = path.join(processedRoot, "processed-summary.json");

  mkdirSync(processedRoot, { recursive: true });
  mkdirSync(publicRoot, { recursive: true });

  const records = JSON.parse(readFileSync(sourcesPath, "utf8")) as PlayerSourceRecord[];
  const processed: ProcessedRecord[] = [];
  const missing = existsSync(missingPath)
    ? JSON.parse(readFileSync(missingPath, "utf8")) as unknown[]
    : [];

  for (const record of records) {
    const selected = record.candidates.find((candidate) => candidate.local_path);
    const outputPath = path.join(processedRoot, `${record.player_slug}.png`);
    const publicPath = path.join(publicRoot, `${record.player_slug}.png`);

    if (!selected?.local_path) {
      processed.push({
        player_slug: record.player_slug,
        player_name: record.player_name,
        player_name_en: record.player_name_en,
        shirt_number: record.shirt_number,
        position: record.position,
        source_url: record.selected_source_url,
        source_path: null,
        processed_path: null,
        public_path: null,
        score: 0,
        width: null,
        height: null,
        review_flags: ["missing source image"],
      });
      continue;
    }

    const sourcePath = path.join(root, selected.local_path);

    try {
      await normalizeCard(sourcePath, outputPath);
      await sharp(outputPath).toFile(publicPath);

      processed.push({
        player_slug: record.player_slug,
        player_name: record.player_name,
        player_name_en: record.player_name_en,
        shirt_number: record.shirt_number,
        position: record.position,
        source_url: record.selected_source_url,
        source_path: selected.local_path,
        processed_path: relative(outputPath),
        public_path: relative(publicPath),
        score: selected.total_score,
        width: selected.width,
        height: selected.height,
        review_flags: getReviewFlags(selected),
      });
    } catch (error) {
      processed.push({
        player_slug: record.player_slug,
        player_name: record.player_name,
        player_name_en: record.player_name_en,
        shirt_number: record.shirt_number,
        position: record.position,
        source_url: record.selected_source_url,
        source_path: selected.local_path,
        processed_path: null,
        public_path: null,
        score: selected.total_score,
        width: selected.width,
        height: selected.height,
        review_flags: ["processing failed"],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  writeFileSync(processedSummaryPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    country,
    target_size: `${targetWidth}x${targetHeight}`,
    target_ratio: targetRatio,
    total_records: records.length,
    processed_count: processed.filter((record) => record.processed_path).length,
    missing_count: missing.length,
    records: processed,
  }, null, 2), "utf8");

  console.log(`Processed: ${processed.filter((record) => record.processed_path).length}/${records.length}`);
  console.log(`Summary: ${relative(processedSummaryPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
