import coreCards from "@/data/core-cards.json";
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

const coreCardsByCountry = coreCards as Record<string, string[]>;
const genericByRarity: Record<string, string> = {
  legend: "/cards/generic/epic_generic.png",
  epic: "/cards/generic/epic_generic.png",
  rare: "/cards/generic/rare_generic.png",
  common: "/cards/generic/common_generic.png",
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

export function getPaniniCardImagePath(card?: PlayerCardImageData | null) {
  const country = getCanonicalCountry(card);
  const countrySlug = slugify(country);
  const playerSlug = slugify(card?.player_name_en ?? "");

  if (!countrySlug || !playerSlug || isCorePlayerCard(card)) {
    return "";
  }

  return `/cards/panini/${countrySlug}/${playerSlug}.png`;
}

export function getGenericCardImagePath(card?: PlayerCardImageData | null) {
  const rarity = (card?.rarity ?? "common").toLowerCase();
  return genericByRarity[rarity] ?? genericByRarity.common;
}

export function resolvePlayerCardImage(card?: PlayerCardImageData | null, options?: ResolveOptions) {
  const artUrl = card?.card_art_url?.trim() ?? "";
  const thumbUrl = card?.card_thumb_url?.trim() ?? "";
  const primaryDbImage = options?.preferThumb
    ? thumbUrl || artUrl
    : artUrl || thumbUrl;

  return primaryDbImage || getPaniniCardImagePath(card) || getGenericCardImagePath(card);
}

export function resolveNextPlayerCardImage(
  card: PlayerCardImageData | null | undefined,
  failedSrc: string,
  options?: ResolveOptions,
) {
  const normalizedFailed = failedSrc.trim();
  const candidates = [
    options?.preferThumb
      ? card?.card_thumb_url?.trim() || card?.card_art_url?.trim()
      : card?.card_art_url?.trim() || card?.card_thumb_url?.trim(),
    getPaniniCardImagePath(card),
    getGenericCardImagePath(card),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => candidate !== normalizedFailed) ?? "";
}
