import type { CountryTheme } from "@/lib/countries";

export type AvatarId =
  | "default-manager"
  | "striker"
  | "captain"
  | "goalkeeper";

export type AvatarResource = {
  id: AvatarId;
  name: string;
  role: string;
  outfit?: string;
  jersey?: string;
  accessory?: string;
};

export const avatars: Record<AvatarId, AvatarResource> = {
  "default-manager": {
    id: "default-manager",
    name: "战术经理",
    role: "Manager",
    outfit: "touchline-coat",
    jersey: "",
    accessory: "clipboard",
  },
  striker: {
    id: "striker",
    name: "锋线杀手",
    role: "Striker",
    outfit: "home-kit",
    jersey: "",
    accessory: "boots",
  },
  captain: {
    id: "captain",
    name: "队长核心",
    role: "Captain",
    outfit: "captain-kit",
    jersey: "",
    accessory: "armband",
  },
  goalkeeper: {
    id: "goalkeeper",
    name: "门线守护者",
    role: "Goalkeeper",
    outfit: "keeper-kit",
    jersey: "",
    accessory: "gloves",
  },
};

export function getAvatar(id?: string | null) {
  return avatars[(id as AvatarId) || "default-manager"] ?? avatars["default-manager"];
}

export function getAvatarPalette(theme: CountryTheme) {
  return {
    shirt: theme.primary,
    trim: theme.secondary,
    accent: theme.accent,
    shadow: theme.primary === "#FFFFFF" ? "#071B3A" : theme.primary,
  };
}
