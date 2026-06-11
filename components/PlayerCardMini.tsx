import { getCountryTheme, resolveCountry } from "@/lib/countries";

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
};

type PlayerCardMiniProps = {
  card?: PlayerCardMiniData | null;
  country?: string | null;
  size?: "small" | "medium" | "large";
  equipped?: boolean;
  locked?: boolean;
  className?: string;
};

const sizeClass = {
  small: "h-[72px] w-12 rounded-lg p-1",
  medium: "h-40 w-28 rounded-xl p-2",
  large: "h-56 w-40 rounded-2xl p-3",
};

const textClass = {
  small: "text-[8px]",
  medium: "text-[11px]",
  large: "text-sm",
};

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
  const starLevel = card?.star_level ?? 1;
  const number = card?.shirt_number ?? "-";
  const name = card?.player_name ?? "未装备";
  const position = card?.position ?? "国家队";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border-2 bg-[#071b3a] shadow-sm ${sizeClass[size]} ${
        equipped ? "border-[#f6c84c]" : "border-white/60"
      } ${locked ? "grayscale" : ""} ${className}`}
      style={{ boxShadow: equipped ? theme.glow : undefined }}
    >
      <div
        className="absolute inset-0 opacity-95"
        style={{ background: theme.cardGradient }}
      />
      <div className="absolute inset-0 bg-[#071b3a]/20" />
      {countryResource ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={countryResource.flag}
          alt={`${countryResource.nameZh} flag`}
          className="absolute -right-3 top-3 h-10 w-14 rotate-[-10deg] rounded-md object-cover opacity-20"
        />
      ) : null}
      <p
        className={`relative z-10 font-black uppercase tracking-[0.12em] text-[#f6c84c] ${textClass[size]}`}
      >
        2026
      </p>
      <p
        className={`absolute right-2 top-2 z-10 rounded-full bg-white/90 px-1.5 py-0.5 font-black text-[#071b3a] ${textClass[size]}`}
      >
        #{number}
      </p>

      <svg
        viewBox="0 0 120 120"
        className="absolute left-1/2 top-[28%] z-10 h-16 w-16 -translate-x-1/2"
        aria-hidden="true"
      >
        <circle cx="60" cy="30" r="20" fill="rgba(255,255,255,0.92)" />
        <path
          d="M28 108c5-38 59-38 64 0H28Z"
          fill="rgba(255,255,255,0.94)"
        />
        <path
          d="M40 70c12 12 28 12 40 0"
          fill="none"
          stroke={theme.accent}
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute inset-x-1 bottom-1 z-10 rounded-md bg-white/92 px-1.5 py-1 text-[#071b3a]">
        <p className={`truncate font-black ${textClass[size]}`}>{name}</p>
        {size !== "small" ? (
          <>
            <p className="mt-0.5 truncate text-[10px] font-bold text-[#627d98]">
              {position}
            </p>
            <p className="mt-0.5 text-[10px] font-black text-[#e63535]">
              {"★".repeat(starLevel)}
              <span className="text-[#cbd2d9]">
                {"★".repeat(Math.max(0, 5 - starLevel))}
              </span>
            </p>
          </>
        ) : null}
      </div>

      {equipped ? (
        <span className="absolute left-1 top-7 z-20 rounded-full bg-[#f6c84c] px-1.5 py-0.5 text-[9px] font-black text-[#071b3a]">
          已装备
        </span>
      ) : null}
      {locked ? <div className="absolute inset-0 z-20 bg-[#071b3a]/45" /> : null}
    </div>
  );
}
