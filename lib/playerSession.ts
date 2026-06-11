export type PlayerSessionData = {
  id: string;
  nickname?: string | null;
  country?: string | null;
  region?: string | null;
  invite_code?: string | null;
};

const PLAYER_ID_KEYS = ["wc_player_id", "player_id", "playerId"];

export function getStoredPlayerId() {
  for (const key of PLAYER_ID_KEYS) {
    const value = localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}

export function savePlayerSession(player: PlayerSessionData) {
  localStorage.setItem("wc_player_id", player.id);
  localStorage.setItem("player_id", player.id);
  localStorage.setItem("playerId", player.id);

  if (player.nickname) {
    localStorage.setItem("wc_player_name", player.nickname);
  }

  if (player.country) {
    localStorage.setItem("wc_country", player.country);
  }

  if (player.region) {
    localStorage.setItem("wc_region", player.region);
  }

  if (player.invite_code) {
    localStorage.setItem("wc_invite_code", player.invite_code);
  }
}

export function clearPlayerSession() {
  for (const key of [
    "wc_player_id",
    "player_id",
    "playerId",
    "wc_player_name",
    "wc_country",
    "wc_region",
    "wc_invite_code",
    "wc_referrer_id",
    "referrer_id",
  ]) {
    localStorage.removeItem(key);
  }
}
