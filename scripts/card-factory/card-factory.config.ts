import path from "node:path";

export type CardFactoryRarity = "Legend" | "Epic" | "Rare" | "Common";

export type CardFactoryPlayer = {
  slug: string;
  country: "portugal";
  team: "Portugal";
  playerName: string;
  playerNameZh: string;
  rarity: CardFactoryRarity;
  position: string;
  shirtNumber: number;
  sourceImagePath: string;
  transparentSourcePath: string;
  processedPortraitPath: string;
  outputCardPath: string;
};

export const cardFactoryRoot = process.cwd();

export const cardTemplateByRarity: Record<CardFactoryRarity, string> = {
  Legend: path.join(
    cardFactoryRoot,
    "assets",
    "card_templates",
    "sample-legend-ronaldo.png",
  ),
  Epic: path.join(
    cardFactoryRoot,
    "assets",
    "card_templates",
    "sample-epic-bruno.png",
  ),
  Rare: path.join(
    cardFactoryRoot,
    "assets",
    "card_templates",
    "sample-rare-diogo-costa.png",
  ),
  Common: path.join(
    cardFactoryRoot,
    "assets",
    "card_templates",
    "sample-common-nelson-semedo.png",
  ),
};

export const cardFactoryPlayers: CardFactoryPlayer[] = [
  {
    slug: "cristiano-ronaldo",
    country: "portugal",
    team: "Portugal",
    playerName: "Cristiano Ronaldo",
    playerNameZh: "克里斯蒂亚诺·罗纳尔多",
    rarity: "Legend",
    position: "FW",
    shirtNumber: 7,
    sourceImagePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "cristiano-ronaldo.jpg",
    ),
    transparentSourcePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "cristiano-ronaldo.png",
    ),
    processedPortraitPath: path.join(
      cardFactoryRoot,
      "processed",
      "portraits",
      "portugal",
      "cristiano-ronaldo.png",
    ),
    outputCardPath: path.join(
      cardFactoryRoot,
      "public",
      "cards",
      "portugal",
      "cristiano-ronaldo.png",
    ),
  },
  {
    slug: "bruno-fernandes",
    country: "portugal",
    team: "Portugal",
    playerName: "Bruno Fernandes",
    playerNameZh: "布鲁诺·费尔南德斯",
    rarity: "Epic",
    position: "MF",
    shirtNumber: 8,
    sourceImagePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "bruno-fernandes.jpg",
    ),
    transparentSourcePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "bruno-fernandes.png",
    ),
    processedPortraitPath: path.join(
      cardFactoryRoot,
      "processed",
      "portraits",
      "portugal",
      "bruno-fernandes.png",
    ),
    outputCardPath: path.join(
      cardFactoryRoot,
      "public",
      "cards",
      "portugal",
      "bruno-fernandes.png",
    ),
  },
  {
    slug: "diogo-costa",
    country: "portugal",
    team: "Portugal",
    playerName: "Diogo Costa",
    playerNameZh: "迪奥戈·科斯塔",
    rarity: "Rare",
    position: "GK",
    shirtNumber: 1,
    sourceImagePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "diogo-costa.jpg",
    ),
    transparentSourcePath: path.join(
      cardFactoryRoot,
      "source_images",
      "portugal",
      "diogo-costa.png",
    ),
    processedPortraitPath: path.join(
      cardFactoryRoot,
      "processed",
      "portraits",
      "portugal",
      "diogo-costa.png",
    ),
    outputCardPath: path.join(
      cardFactoryRoot,
      "public",
      "cards",
      "portugal",
      "diogo-costa.png",
    ),
  },
];
