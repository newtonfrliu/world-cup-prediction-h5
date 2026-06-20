import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDir = path.join(root, "public", "cards", "generic");

const cards = [
  {
    file: "epic_generic.png",
    background: "#2e1065",
    accent: "#a855f7",
    text: "#f6c84c",
    label: "EPIC",
  },
  {
    file: "rare_generic.png",
    background: "#0f3b8f",
    accent: "#2563eb",
    text: "#dbeafe",
    label: "RARE",
  },
  {
    file: "common_generic.png",
    background: "#f8fafc",
    accent: "#cbd5e1",
    text: "#071b3a",
    label: "COMMON",
  },
];

function buildSvg(card: (typeof cards)[number]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="${card.background}"/>
      <stop offset="0.62" stop-color="${card.accent}"/>
      <stop offset="1" stop-color="#071b3a"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="22%" r="60%">
      <stop stop-color="rgba(255,255,255,.45)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1536" rx="64" fill="url(#g)"/>
  <rect x="34" y="34" width="956" height="1468" rx="48" fill="none" stroke="${card.text}" stroke-width="18" opacity=".9"/>
  <text x="80" y="190" font-family="Arial, sans-serif" font-size="92" font-weight="900" fill="${card.text}" opacity=".22">26</text>
  <text x="80" y="275" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="${card.text}">FIFA 26</text>
  <circle cx="512" cy="600" r="230" fill="url(#r)"/>
  <path d="M375 740c50 42 224 42 274 0l120 55c54 25 87 79 87 139v335H168V934c0-60 34-114 88-139l119-55Z" fill="rgba(255,255,255,.78)"/>
  <circle cx="512" cy="525" r="150" fill="rgba(255,255,255,.92)"/>
  <path d="M370 515c32-128 162-182 272-109 42 28 62 70 58 126-74-71-176-95-330-17Z" fill="#071b3a" opacity=".9"/>
  <rect x="118" y="1190" width="788" height="176" rx="32" fill="rgba(255,255,255,.94)"/>
  <text x="512" y="1295" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="#071b3a">${card.label}</text>
</svg>`;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  for (const card of cards) {
    const outputPath = path.join(outputDir, card.file);
    await sharp(Buffer.from(buildSvg(card))).png().toFile(outputPath);
    console.log(path.relative(root, outputPath));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
