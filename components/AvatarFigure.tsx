import { getAvatar, getAvatarPalette } from "@/lib/avatar";
import type { CountryTheme } from "@/lib/countries";

type AvatarFigureProps = {
  avatarId?: string | null;
  theme: CountryTheme;
  className?: string;
};

export function AvatarFigure({
  avatarId,
  theme,
  className = "",
}: AvatarFigureProps) {
  const avatar = getAvatar(avatarId);
  const palette = getAvatarPalette(theme);
  const isGoalkeeper = avatar.id === "goalkeeper";
  const isCaptain = avatar.id === "captain";
  const isStriker = avatar.id === "striker";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 ${className}`}
      aria-label={avatar.name}
      title={avatar.name}
    >
      <svg
        viewBox="0 0 180 220"
        role="img"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="180" height="220" rx="24" fill="rgba(255,255,255,0.08)" />
        <circle cx="90" cy="64" r="33" fill="#F1C7A3" />
        <path
          d="M56 62c6-28 58-30 68 0-16-12-48-12-68 0Z"
          fill={palette.shadow}
          opacity="0.92"
        />
        <path
          d="M48 136c5-35 79-35 84 0l9 67H39l9-67Z"
          fill={palette.shirt}
        />
        <path
          d="M66 111h48l-24 30-24-30Z"
          fill="white"
          opacity="0.9"
        />
        <path
          d="M48 139c20 13 65 13 84 0l4 24c-23 16-69 16-92 0l4-24Z"
          fill={palette.trim}
          opacity="0.92"
        />
        <circle cx="78" cy="66" r="3" fill="#071B3A" />
        <circle cx="102" cy="66" r="3" fill="#071B3A" />
        <path
          d="M78 84c8 7 17 7 25 0"
          stroke="#071B3A"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {isCaptain ? (
          <rect x="117" y="143" width="20" height="10" rx="5" fill={palette.accent} />
        ) : null}
        {isGoalkeeper ? (
          <>
            <circle cx="38" cy="142" r="14" fill={palette.accent} />
            <circle cx="142" cy="142" r="14" fill={palette.accent} />
          </>
        ) : null}
        {isStriker ? (
          <circle
            cx="137"
            cy="188"
            r="18"
            fill="white"
            stroke={palette.accent}
            strokeWidth="6"
          />
        ) : null}
        {avatar.id === "default-manager" ? (
          <rect
            x="118"
            y="162"
            width="28"
            height="36"
            rx="5"
            fill="white"
            opacity="0.9"
          />
        ) : null}
        <text
          x="90"
          y="209"
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill={palette.accent}
        >
          {avatar.role}
        </text>
      </svg>
    </div>
  );
}
