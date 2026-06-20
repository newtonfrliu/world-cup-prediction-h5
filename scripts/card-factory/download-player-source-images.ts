import "./load-env.ts";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  cardFactoryPlayers,
  cardFactoryRoot,
} from "./card-factory.config.ts";

type SourceManifest = {
  players: Record<
    string,
    {
      source_url?: string;
      source_note?: string;
    }
  >;
};

const manifestPath = path.join(
  cardFactoryRoot,
  "scripts",
  "card-factory",
  "source-images-manifest.json",
);

function ensureDir(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

async function downloadImage(url: string, outputPath: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "world-cup-prediction-h5-card-factory/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`URL did not return an image: ${contentType || "unknown"}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  ensureDir(outputPath);
  writeFileSync(outputPath, bytes);
}

async function main() {
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as SourceManifest;

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const player of cardFactoryPlayers) {
    const manifestEntry = manifest.players[player.slug];
    const sourceUrl = manifestEntry?.source_url?.trim();

    if (existsSync(player.sourceImagePath)) {
      skipped += 1;
      console.log(`[skip] ${player.playerName}: ${player.sourceImagePath}`);
      continue;
    }

    if (!sourceUrl) {
      skipped += 1;
      console.log(
        `[skip] ${player.playerName}: source_url is empty in source-images-manifest.json`,
      );
      continue;
    }

    try {
      await downloadImage(sourceUrl, player.sourceImagePath);
      success += 1;
      console.log(`[ok] ${player.playerName}: ${player.sourceImagePath}`);
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${player.playerName}: ${(error as Error).message}`);
    }
  }

  console.log(`Download complete. success=${success}, skipped=${skipped}, failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
