import "./load-env.ts";

import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

import {
  cardFactoryPlayers,
  cardFactoryRoot,
} from "./card-factory.config.ts";

const execFileAsync = promisify(execFile);
const bundledPythonPath = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\newto",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);
const pythonExecutable =
  process.env.CARD_FACTORY_PYTHON?.trim() || bundledPythonPath;

function ensureDir(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

async function hasAlphaChannel(filePath: string) {
  const metadata = await sharp(filePath).metadata();
  return Boolean(metadata.hasAlpha);
}

async function normalizeUpperBodyPortrait(sourcePath: string, outputPath: string) {
  const trimmedBuffer = await sharp(sourcePath)
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  const metadata = await sharp(trimmedBuffer).metadata();
  const width = metadata.width ?? 900;
  const height = metadata.height ?? 1200;
  const cropHeight = Math.min(height, Math.round(width * 1.45));
  const croppedBuffer = await sharp(trimmedBuffer)
    .extract({
      left: 0,
      top: 0,
      width,
      height: cropHeight,
    })
    .toBuffer();

  ensureDir(outputPath);
  await sharp(croppedBuffer)
    .resize({
      width: 900,
      height: 1200,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);
}

async function processTransparentSource(sourcePath: string, outputPath: string) {
  await normalizeUpperBodyPortrait(sourcePath, outputPath);
}

async function removeBackgroundWithRembg(sourcePath: string, outputPath: string) {
  ensureDir(outputPath);
  const rawOutputPath = path.join(
    path.dirname(outputPath),
    ".matting",
    `${path.basename(outputPath, ".png")}-raw.png`,
  );
  ensureDir(rawOutputPath);

  await execFileAsync(
    pythonExecutable,
    [
      path.join(cardFactoryRoot, "scripts", "card-factory", "rembg-remove.py"),
      sourcePath,
      rawOutputPath,
    ],
    {
      cwd: cardFactoryRoot,
      env: {
        ...process.env,
        NUMBA_DISABLE_JIT: "1",
        U2NET_HOME: path.join(cardFactoryRoot, "processed", "models", "u2net"),
      },
      maxBuffer: 1024 * 1024 * 20,
      timeout: 1000 * 60 * 6,
    },
  );

  await normalizeUpperBodyPortrait(rawOutputPath, outputPath);
}

async function main() {
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const player of cardFactoryPlayers) {
    try {
      if (existsSync(player.transparentSourcePath)) {
        const alpha = await hasAlphaChannel(player.transparentSourcePath);

        if (alpha) {
          await processTransparentSource(
            player.transparentSourcePath,
            player.processedPortraitPath,
          );
          success += 1;
          console.log(
            `[ok] ${player.playerName}: transparent PNG source -> ${player.processedPortraitPath}`,
          );
          continue;
        }

        console.log(
          `[todo] ${player.playerName}: ${player.transparentSourcePath} exists but has no alpha channel; falling back to JPG crop if available.`,
        );
      }

      if (!existsSync(player.sourceImagePath)) {
        skipped += 1;
        console.log(
          `[skip] ${player.playerName}: source image missing. Expected ${player.sourceImagePath}`,
        );
        continue;
      }

      await removeBackgroundWithRembg(
        player.sourceImagePath,
        player.processedPortraitPath,
      );
      success += 1;
      console.log(
        `[ok] ${player.playerName}: rembg matte -> ${player.processedPortraitPath}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${player.playerName}: ${(error as Error).message}`);
    }
  }

  console.log(
    `Portrait matting complete. success=${success}, skipped=${skipped}, failed=${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
