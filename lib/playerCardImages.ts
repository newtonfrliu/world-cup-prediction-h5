import coreCards from "@/data/core-cards.json";
import cardAssetManifest from "@/data/card-asset-manifest.json";
import { getCanonicalTeamName, resolveCountry } from "@/lib/countries";

export type PlayerCardImageData = {
  team?: string | null;
  player_name?: string | null;
  player_name_en?: string | null;
  rarity?: string | null;
  card_art_url?: string | null;
  card_thumb_url?: string | null;
};

type ResolveOptions = {
  preferThumb?: boolean;
};

export type PlayerCardImageSourceType = "core_card" | "panini" | "generic";

export type PlayerCardImageSource = {
  src: string;
  sourceType: PlayerCardImageSourceType;
};

const coreCardsByCountry = coreCards as Record<string, string[]>;
const cardAssetSet = new Set(cardAssetManifest as string[]);
const genericByRarity: Record<string, string> = {
  legend: "/cards/generic/epic_generic.png",
  epic: "/cards/generic/epic_generic.png",
  rare: "/cards/generic/rare_generic.png",
  common: "/cards/generic/common_generic.png",
};
const coreAssetByPlayerKey: Record<string, string> = {
  "Spain:olmo dani": "/cards/spain/olmo.png",
  "Spain:pedri": "/cards/spain/pedri.png",
  "Spain:rodri": "/cards/spain/rodri.png",
  "Spain:williams nico": "/cards/spain/williams.png",
  "Spain:yamal lamine": "/cards/spain/yamal.png",
  "Argentina:alvarez julian": "/cards/argentina/alvarez.png",
  "Argentina:fernandez enzo": "/cards/argentina/enzo.png",
  "Argentina:martinez lautaro": "/cards/argentina/lautaro.png",
  "Argentina:martinez emiliano": "/cards/argentina/martinez.png",
  "Argentina:messi lionel": "/cards/argentina/messi.png",
  "Germany:havertz kai": "/cards/germany/havertz.png",
  "Germany:kimmich joshua": "/cards/germany/kimmich.png",
  "Germany:musiala jamal": "/cards/germany/musiala.png",
  "Germany:neuer manuel": "/cards/germany/neuer.png",
  "Germany:wirtz florian": "/cards/germany/wirtz.png",
  "England:bellingham jude": "/cards/england/bellingham.png",
  "England:kane harry": "/cards/england/kane.png",
  "England:rashford marcus": "/cards/england/rashford.png",
  "England:rice declan": "/cards/england/rice.png",
  "England:saka bukayo": "/cards/england/saka.png",
  "Netherlands:ake nathan": "/cards/netherlands/ake.png",
  "Netherlands:de jong frenkie": "/cards/netherlands/dejong.png",
  "Netherlands:depay memphis": "/cards/netherlands/depay.png",
  "Netherlands:gakpo cody": "/cards/netherlands/gakpo.png",
  "Netherlands:van dijk virgil": "/cards/netherlands/vandijk.png",
  "Portugal:bernardo silva": "/cards/portugal/bernardo.png",
  "Portugal:bruno fernandes": "/cards/portugal/bruno.png",
  "Portugal:joao neves": "/cards/portugal/joao.png",
  "Portugal:cristiano ronaldo": "/cards/portugal/ronaldo.png",
  "Portugal:vitinha": "/cards/portugal/vitinha.png",
  "France:dembele ousmane": "/cards/france/dembele.png",
  "France:mbappe kylian": "/cards/france/mbappe.png",
  "France:saliba william": "/cards/france/saliba.png",
  "France:tchouameni aurelien": "/cards/france/tchouameni.png",
  "France:hernandez theo": "/cards/france/theo.png",
  "Brazil:alisson": "/cards/brazil/alison.png",
  "Brazil:casemiro": "/cards/brazil/casemiro.png",
  "Brazil:neymar jr": "/cards/brazil/neymar.png",
  "Brazil:raphinha": "/cards/brazil/raphinha.png",
  "Brazil:vinicius junior": "/cards/brazil/vinicius.png",
  "Japan:ito junya": "/cards/japan/ito-junya.png",
  "Japan:kamada daichi": "/cards/japan/kamada-daichi.png",
  "Japan:kubo takefusa": "/cards/japan/kubo-takefusa.png",
  "Japan:doan ritsu": "/cards/japan/ritsu-doan.png",
  "Japan:tomiyasu takehiro": "/cards/japan/tomiyasu.png",
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCanonicalCountry(card?: PlayerCardImageData | null) {
  const team = card?.team ?? "";
  return resolveCountry(team)?.nameEn ?? getCanonicalTeamName(team);
}

function getPlayerNameCandidates(card?: PlayerCardImageData | null) {
  const names = new Set<string>();
  const add = (value?: string | null) => {
    const normalized = normalizeName(value);

    if (normalized) {
      names.add(normalized);
    }
  };

  add(card?.player_name);
  add(card?.player_name_en);

  const englishParts = (card?.player_name_en ?? "").trim().split(/\s+/);
  const firstMixedIndex = englishParts.findIndex((part) => part !== part.toUpperCase());

  if (firstMixedIndex > 0) {
    const lastName = englishParts.slice(0, firstMixedIndex).join(" ");
    const givenName = englishParts.slice(firstMixedIndex).join(" ");
    add(`${givenName} ${lastName}`);
    add(`${lastName} ${givenName}`);
  }

  return names;
}

export function isCorePlayerCard(card?: PlayerCardImageData | null) {
  const country = getCanonicalCountry(card);
  const coreNames = coreCardsByCountry[country] ?? [];

  if (!coreNames.length) {
    return false;
  }

  const candidates = getPlayerNameCandidates(card);

  return coreNames.some((name) => candidates.has(normalizeName(name)));
}

function assetExists(path?: string | null) {
  const value = path?.trim() ?? "";

  return value.length > 0 && cardAssetSet.has(value);
}

function getCorePlayerAssetPath(card?: PlayerCardImageData | null) {
  if (!isCorePlayerCard(card)) {
    return "";
  }

  const country = getCanonicalCountry(card);
  const normalizedEnglishName = normalizeName(card?.player_name_en);
  const path = coreAssetByPlayerKey[`${country}:${normalizedEnglishName}`];

  return assetExists(path) ? path : "";
}

export function getPaniniCardImagePath(card?: PlayerCardImageData | null) {
  const country = getCanonicalCountry(card);
  const countrySlug = slugify(country);
  const playerSlug = slugify(card?.player_name_en ?? "");

  if (!countrySlug || !playerSlug || isCorePlayerCard(card)) {
    return "";
  }

  const path = `/cards/panini/${countrySlug}/${playerSlug}.png`;

  return assetExists(path) ? path : "";
}

export function getGenericCardImagePath(card?: PlayerCardImageData | null) {
  const rarity = (card?.rarity ?? "common").toLowerCase();
  return genericByRarity[rarity] ?? genericByRarity.common;
}

export function resolvePlayerCardImage(card?: PlayerCardImageData | null, options?: ResolveOptions) {
  return resolvePlayerCardImageSource(card, options).src;
}

export function resolvePlayerCardImageSource(
  card?: PlayerCardImageData | null,
  options?: ResolveOptions,
): PlayerCardImageSource {
  const artUrl = card?.card_art_url?.trim() ?? "";
  const thumbUrl = card?.card_thumb_url?.trim() ?? "";
  const primaryDbImage = options?.preferThumb
    ? thumbUrl || artUrl
    : artUrl || thumbUrl;
  const isCore = isCorePlayerCard(card);
  const coreAssetPath = getCorePlayerAssetPath(card);
  const paniniPath = getPaniniCardImagePath(card);

  if (isCore && assetExists(primaryDbImage)) {
    return {
      src: primaryDbImage,
      sourceType: "core_card",
    };
  }

  if (coreAssetPath) {
    return {
      src: coreAssetPath,
      sourceType: "core_card",
    };
  }

  if (paniniPath) {
    return {
      src: paniniPath,
      sourceType: "panini",
    };
  }

  return {
    src: getGenericCardImagePath(card),
    sourceType: "generic",
  };
}

export function resolveNextPlayerCardImage(
  card: PlayerCardImageData | null | undefined,
  failedSrc: string,
  options?: ResolveOptions,
) {
  const normalizedFailed = failedSrc.trim();
  const candidates = [
    isCorePlayerCard(card) && assetExists(
      options?.preferThumb
      ? card?.card_thumb_url?.trim() || card?.card_art_url?.trim()
      : card?.card_art_url?.trim() || card?.card_thumb_url?.trim(),
    )
      ? options?.preferThumb
        ? card?.card_thumb_url?.trim() || card?.card_art_url?.trim()
        : card?.card_art_url?.trim() || card?.card_thumb_url?.trim()
      : "",
    getCorePlayerAssetPath(card),
    getPaniniCardImagePath(card),
    getGenericCardImagePath(card),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => candidate !== normalizedFailed) ?? "";
}
