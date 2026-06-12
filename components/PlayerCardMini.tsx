"use client";

import { useEffect, useMemo, useState } from "react";

import { getCanonicalTeamName, getCountryTheme, resolveCountry } from "@/lib/countries";

export type PlayerCardMiniData = {
  id?: string;
  team: string;
  player_name: string;
  player_name_en?: string | null;
  position?: string | null;
  shirt_number?: number | null;
  rarity?: string | null;
  price?: number | null;
  star_level?: number | null;
  card_art_url?: string | null;
  card_thumb_url?: string | null;
  card_theme?: string | null;
  card_number?: string | null;
  card_image?: string | null;
};

type PlayerCardMiniProps = {
  card?: PlayerCardMiniData | null;
  country?: string | null;
  size?: "small" | "medium" | "large";
  equipped?: boolean;
  locked?: boolean;
  className?: string;
};

type RarityStyle = {
  frame: string;
  inner: string;
  shine: string;
  label: string;
  labelText: string;
  glow: string;
  badge: string;
  badgeText: string;
  particles: string;
};

const sizeClass = {
  small: "h-[84px] w-14 rounded-xl p-1",
  medium: "h-44 w-32 rounded-2xl p-2",
  large: "h-64 w-44 rounded-[22px] p-3",
};

const headerTextClass = {
  small: "text-[8px]",
  medium: "text-[10px]",
  large: "text-xs",
};

const nameTextClass = {
  small: "text-[8px]",
  medium: "text-xs",
  large: "text-base",
};

const rarityStyles: Record<string, RarityStyle> = {
  common: {
    frame: "linear-gradient(135deg, #FFFFFF 0%, #94A3B8 32%, #F8FAFC 62%, #CBD5E1 100%)",
    inner: "linear-gradient(160deg, rgba(248,250,252,0.96), rgba(203,213,225,0.72))",
    shine: "rgba(255,255,255,0.34)",
    label: "#E5E7EB",
    labelText: "#071B3A",
    glow: "0 10px 22px rgba(15,23,42,0.16)",
    badge: "#F8FAFC",
    badgeText: "#334155",
    particles: "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.7) 0 2px, transparent 3px)",
  },
  rare: {
    frame: "linear-gradient(135deg, #DBEAFE 0%, #2563EB 30%, #0F3B8F 62%, #93C5FD 100%)",
    inner: "linear-gradient(160deg, rgba(15,59,143,0.92), rgba(37,99,235,0.72), rgba(219,234,254,0.72))",
    shine: "rgba(96,165,250,0.46)",
    label: "#2563EB",
    labelText: "#EFF6FF",
    glow: "0 16px 36px rgba(37,99,235,0.36)",
    badge: "#2563EB",
    badgeText: "#EFF6FF",
    particles: "radial-gradient(circle at 20% 20%, rgba(147,197,253,0.75) 0 2px, transparent 3px), radial-gradient(circle at 78% 34%, rgba(191,219,254,0.6) 0 1.5px, transparent 3px)",
  },
  epic: {
    frame: "linear-gradient(135deg, #2E1065 0%, #A855F7 28%, #F6C84C 55%, #581C87 100%)",
    inner: "linear-gradient(160deg, rgba(46,16,101,0.96), rgba(126,34,206,0.78), rgba(246,200,76,0.32))",
    shine: "rgba(168,85,247,0.54)",
    label: "#F6C84C",
    labelText: "#271033",
    glow: "0 18px 46px rgba(168,85,247,0.46), 0 0 18px rgba(246,200,76,0.2)",
    badge: "#7E22CE",
    badgeText: "#FDF4FF",
    particles: "radial-gradient(circle at 16% 26%, rgba(216,180,254,0.9) 0 2px, transparent 3px), radial-gradient(circle at 82% 18%, rgba(246,200,76,0.7) 0 2px, transparent 3px), radial-gradient(circle at 68% 62%, rgba(233,213,255,0.65) 0 1.5px, transparent 3px)",
  },
  legend: {
    frame: "linear-gradient(135deg, #020202 0%, #2B1A02 18%, #F6C84C 38%, #FFF2A6 50%, #9A6500 64%, #050505 100%)",
    inner: "radial-gradient(circle at 50% 18%, rgba(255,242,166,0.26), transparent 34%), linear-gradient(160deg, rgba(0,0,0,0.98), rgba(45,27,2,0.92), rgba(122,77,0,0.72))",
    shine: "rgba(246,200,76,0.72)",
    label: "#111111",
    labelText: "#F6C84C",
    glow: "0 24px 62px rgba(246,200,76,0.62), 0 0 24px rgba(255,242,166,0.42)",
    badge: "#050505",
    badgeText: "#F6C84C",
    particles: "radial-gradient(circle at 14% 20%, rgba(255,242,166,0.95) 0 2px, transparent 3px), radial-gradient(circle at 82% 16%, rgba(246,200,76,0.9) 0 2.5px, transparent 4px), radial-gradient(circle at 72% 48%, rgba(255,255,255,0.86) 0 1.5px, transparent 3px), radial-gradient(circle at 24% 72%, rgba(246,200,76,0.78) 0 2px, transparent 4px)",
  },
};

export const priorityCardImagePlayers = {
  Portugal: ["Cristiano Ronaldo", "Bruno Fernandes", "Rafael Leao", "Ruben Dias"],
  France: ["Kylian Mbappe", "Antoine Griezmann", "Ousmane Dembele", "Aurelien Tchouameni"],
  Brazil: ["Vinicius Junior", "Rodrygo", "Casemiro", "Marquinhos"],
  Argentina: ["Lionel Messi", "Lautaro Martinez", "Julian Alvarez", "Emiliano Martinez"],
  England: ["Jude Bellingham", "Harry Kane", "Phil Foden", "Bukayo Saka"],
  Germany: ["Jamal Musiala", "Florian Wirtz", "Joshua Kimmich"],
  Spain: ["Lamine Yamal", "Rodri", "Pedri", "Nico Williams"],
  Netherlands: ["Virgil van Dijk", "Frenkie de Jong", "Cody Gakpo"],
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

export function getCardImagePath(card?: PlayerCardMiniData | null) {
  if (!card?.team || !card.player_name_en) {
    return "";
  }

  const team = resolveCountry(card.team);
  const teamSlug = slugify(team?.nameEn ?? getCanonicalTeamName(card.team));
  const playerSlug = slugify(card.player_name_en);

  if (!teamSlug || !playerSlug) {
    return "";
  }

  return `/cards/${teamSlug}/${playerSlug}.png`;
}

function formatCoins(value?: number | null) {
  return new Intl.NumberFormat("zh-CN").format(value ?? 0);
}

function getRarityLabel(rarity: string) {
  const labels: Record<string, string> = {
    common: "COMMON",
    rare: "RARE",
    epic: "EPIC",
    legend: "LEGEND",
  };

  return labels[rarity] ?? rarity.toUpperCase();
}

function PlayerSilhouette({
  accent,
  compact,
}: {
  accent: string;
  compact: boolean;
}) {
  return (
    <svg
      viewBox="0 0 180 220"
      className={`absolute left-1/2 z-10 -translate-x-1/2 ${
        compact ? "top-[24px] h-[70px] w-[70px]" : "top-[52px] h-[132px] w-[118px]"
      }`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kitGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#d9e2ec" stopOpacity="0.94" />
        </linearGradient>
      </defs>
      <path
        d="M77 63c-8-5-13-14-13-25 0-18 12-31 27-31 16 0 28 13 28 31 0 11-5 20-13 25l15 10 26 9c12 4 20 14 20 27v88H13v-88c0-13 8-23 20-27l28-9 16-10Z"
        fill="rgba(7,27,58,0.28)"
      />
      <path
        d="M74 69h34l17 14-12 53H69L57 83l17-14Z"
        fill="url(#kitGradient)"
      />
      <path
        d="M57 83 32 94c-8 3-13 11-13 20v73h50l-12-104Z"
        fill="rgba(255,255,255,0.86)"
      />
      <path
        d="m125 83 25 11c8 3 13 11 13 20v73h-50l12-104Z"
        fill="rgba(255,255,255,0.86)"
      />
      <path
        d="M68 139h46l-4 48H72l-4-48Z"
        fill="rgba(255,255,255,0.96)"
      />
      <path
        d="M72 77c8 11 30 11 38 0"
        fill="none"
        stroke={accent}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M52 98c20 18 58 18 78 0"
        fill="none"
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="91" cy="39" r="25" fill="rgba(255,255,255,0.96)" />
      <path
        d="M66 34c5-19 21-28 38-20 13 6 18 18 14 34-11-12-29-18-52-14Z"
        fill="#071B3A"
      />
    </svg>
  );
}

export function PlayerCardMini({
  card,
  country,
  size = "medium",
  equipped = false,
  locked = false,
  className = "",
}: PlayerCardMiniProps) {
  const team = card?.team ?? country ?? "";
  const countryResource = resolveCountry(team);
  const theme = getCountryTheme(team);
  const rarity = card?.card_theme ?? card?.rarity ?? "common";
  const rarityStyle = rarityStyles[rarity] ?? rarityStyles.common;
  const isLegend = rarity === "legend";
  const isEpic = rarity === "epic";
  const starLevel = card?.star_level ?? 1;
  const number = card?.shirt_number ?? "-";
  const cardNumber = card?.card_number ?? "";
  const name = card?.player_name ?? "未装备";
  const englishName = card?.player_name_en ?? countryResource?.nameEn ?? "World Cup";
  const position = card?.position ?? "国家队";
  const compact = size === "small";
  const artCandidate = useMemo(
    () =>
      (size === "small"
        ? card?.card_thumb_url?.trim() || card?.card_art_url?.trim()
        : card?.card_art_url?.trim() || card?.card_thumb_url?.trim()) || "",
    [card, size],
  );
  const imageCandidate = useMemo(
    () => card?.card_image?.trim() || getCardImagePath(card),
    [card],
  );
  const [artSrc, setArtSrc] = useState(artCandidate);
  const [imageSrc, setImageSrc] = useState(imageCandidate);

  useEffect(() => {
    setArtSrc(artCandidate);
    setImageSrc(imageCandidate);
  }, [artCandidate, imageCandidate]);

  return (
    <div
      className={`relative shrink-0 overflow-hidden border-[3px] bg-[#071b3a] shadow-sm ${sizeClass[size]} ${
        locked ? "grayscale" : ""
      } ${className}`}
      style={{
        borderColor: "transparent",
        backgroundImage: rarityStyle.frame,
        boxShadow: equipped ? `${theme.glow}, ${rarityStyle.glow}` : rarityStyle.glow,
      }}
    >
      {artSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artSrc}
            alt={name}
            onError={() => setArtSrc("")}
            className="absolute inset-[3px] z-10 h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-[inherit] object-cover"
          />
          {locked ? (
            <div className="absolute inset-0 z-30 rounded-[inherit] bg-[#071b3a]/54" />
          ) : null}
        </>
      ) : null}
      <div
        className={`absolute inset-[3px] overflow-hidden rounded-[inherit] bg-[#071b3a] ${
          artSrc ? "hidden" : ""
        }`}
      >
        <div
          className="absolute inset-0"
          style={{ background: `${rarityStyle.inner}, ${theme.cardGradient}` }}
        />
        <div className="absolute inset-0 bg-[#071b3a]/28" />
        <div
          className="absolute inset-0 opacity-90"
          style={{ backgroundImage: rarityStyle.particles }}
        />
        <div
          className="absolute -left-8 top-8 h-28 w-28 rounded-full blur-2xl"
          style={{ background: rarityStyle.shine }}
        />
        {(isLegend || isEpic) && !compact ? (
          <div
            className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
            style={{
              background: isLegend
                ? "rgba(246,200,76,0.55)"
                : "rgba(168,85,247,0.52)",
            }}
          />
        ) : null}
        <p
          className={`absolute -left-2 top-4 font-black leading-none text-white/18 ${
            compact ? "text-5xl" : size === "medium" ? "text-7xl" : "text-8xl"
          }`}
        >
          26
        </p>
        <p
          className={`absolute left-2 top-2 z-20 font-black uppercase tracking-[0.14em] text-white ${headerTextClass[size]}`}
        >
          FIFA 26
        </p>
        <p
          className={`absolute right-2 top-2 z-20 rounded-full bg-white/92 px-1.5 py-0.5 font-black text-[#071b3a] ${headerTextClass[size]}`}
        >
          #{number}
        </p>
        {cardNumber && !compact ? (
          <p className="absolute right-2 top-9 z-20 rounded-full bg-[#071b3a]/72 px-1.5 py-0.5 text-[9px] font-black text-white">
            {cardNumber}
          </p>
        ) : null}
        {countryResource ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={countryResource.flag}
            alt={`${countryResource.nameZh} flag`}
            className={`absolute z-20 rounded-md border border-white/60 object-cover shadow-sm ${
              compact
                ? "left-2 top-5 h-3.5 w-5"
                : "left-3 top-7 h-5 w-8"
            }`}
          />
        ) : null}

        <div className="absolute inset-x-2 top-[26%] z-10 h-[46%] rounded-[999px] bg-white/10 blur-xl" />

        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={name}
            onError={() => setImageSrc("")}
            className="absolute inset-x-0 top-[18%] z-10 mx-auto h-[58%] w-[86%] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.36)]"
          />
        ) : (
          <PlayerSilhouette accent={theme.accent} compact={compact} />
        )}

        <div
          className={`absolute inset-x-1.5 bottom-1.5 z-20 rounded-xl bg-white/94 text-[#071b3a] shadow-sm ${
            compact ? "px-1 py-1" : "px-2 py-2"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <p className={`min-w-0 truncate font-black ${nameTextClass[size]}`}>
              {name}
            </p>
            {!compact ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                style={{
                  background: rarityStyle.label,
                  color: rarityStyle.labelText,
                }}
              >
                {getRarityLabel(rarity)}
              </span>
            ) : null}
          </div>
          {!compact ? (
            <>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.04em] text-[#627d98]">
                {englishName}
              </p>
              <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-black">
                <span className="truncate text-[#071b3a]">{position}</span>
                <span className="text-[#e63535]">
                  {"★".repeat(starLevel)}
                  <span className="text-[#cbd2d9]">
                    {"★".repeat(Math.max(0, 5 - starLevel))}
                  </span>
                </span>
              </div>
              {size === "large" ? (
                <p className="mt-1 flex items-center justify-between gap-2 rounded-md bg-[#f6f1e7] px-1.5 py-0.5 text-[10px] font-black text-[#071b3a]">
                  <span>价格 {formatCoins(card?.price)} 金币</span>
                  {cardNumber ? <span>{cardNumber}</span> : null}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {locked ? <div className="absolute inset-0 z-30 bg-[#071b3a]/54" /> : null}
      </div>
    </div>
  );
}
