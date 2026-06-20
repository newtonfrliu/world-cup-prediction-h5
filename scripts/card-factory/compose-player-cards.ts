import "./load-env.ts";

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  cardFactoryPlayers,
  cardTemplateByRarity,
} from "./card-factory.config.ts";

function ensureDir(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

async function composeCard({
  templatePath,
  portraitPath,
  outputPath,
}: {
  templatePath: string;
  portraitPath: string;
  outputPath: string;
}) {
  const templateMetadata = await sharp(templatePath).metadata();
  const templateWidth = templateMetadata.width ?? 1024;
  const templateHeight = templateMetadata.height ?? 1536;
  const targetPortraitHeight = Math.round(templateHeight * 0.65);
  const maxPortraitWidth = Math.round(templateWidth * 0.72);
  const topSafeLine = Math.round(templateHeight * 0.08);
  const nameSafeLine = Math.round(templateHeight * 0.735);
  const trimmedPortraitBuffer = await sharp(portraitPath)
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const trimmedMetadata = await sharp(trimmedPortraitBuffer).metadata();
  const trimmedWidth = trimmedMetadata.width ?? 900;
  const trimmedHeight = trimmedMetadata.height ?? 1200;
  const maxPortraitAspect = maxPortraitWidth / targetPortraitHeight;
  const cropWidth = Math.min(
    trimmedWidth,
    Math.round(trimmedHeight * maxPortraitAspect),
  );
  const cropLeft = Math.max(0, Math.round((trimmedWidth - cropWidth) / 2));
  const focusedPortraitBuffer = await sharp(trimmedPortraitBuffer)
    .extract({
      left: cropLeft,
      top: 0,
      width: cropWidth,
      height: trimmedHeight,
    })
    .png()
    .toBuffer();
  const heightScale = targetPortraitHeight / trimmedHeight;
  const widthScale = maxPortraitWidth / cropWidth;
  const scale = Math.min(heightScale, widthScale);
  const outputPortraitWidth = Math.round(cropWidth * scale);
  const outputPortraitHeight = Math.round(trimmedHeight * scale);
  const portraitBuffer = await sharp(focusedPortraitBuffer)
    .resize({
      width: outputPortraitWidth,
      height: outputPortraitHeight,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const left = Math.round((templateWidth - outputPortraitWidth) / 2);
  const top = Math.max(
    topSafeLine,
    Math.round(nameSafeLine - outputPortraitHeight),
  );

  ensureDir(outputPath);
  await sharp(templatePath)
    .composite([
      {
        input: portraitBuffer,
        left,
        top,
      },
    ])
    .png()
    .toFile(outputPath);

  return {
    scale,
    offsetX: left,
    offsetY: top,
    portraitWidth: outputPortraitWidth,
    portraitHeight: outputPortraitHeight,
    cropLeft,
    cropWidth,
  };
}

async function main() {
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const player of cardFactoryPlayers) {
    const templatePath = cardTemplateByRarity[player.rarity];

    if (!existsSync(templatePath)) {
      failed += 1;
      console.error(`[fail] ${player.playerName}: template missing ${templatePath}`);
      continue;
    }

    if (!existsSync(player.processedPortraitPath)) {
      skipped += 1;
      console.log(
        `[skip] ${player.playerName}: processed portrait missing ${player.processedPortraitPath}`,
      );
      continue;
    }

    try {
      const composeInfo = await composeCard({
        templatePath,
        portraitPath: player.processedPortraitPath,
        outputPath: player.outputCardPath,
      });
      success += 1;
      console.log(
        `[ok] ${player.playerName}: ${player.outputCardPath} scale=${composeInfo.scale.toFixed(
          3,
        )} offsetX=${composeInfo.offsetX} offsetY=${composeInfo.offsetY} size=${composeInfo.portraitWidth}x${composeInfo.portraitHeight} cropLeft=${composeInfo.cropLeft} cropWidth=${composeInfo.cropWidth}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${player.playerName}: ${(error as Error).message}`);
    }
  }

  console.log(`Compose complete. success=${success}, skipped=${skipped}, failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
