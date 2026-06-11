const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_CODE_LENGTH = 6;
const MISSING_INVITE_CODE_MESSAGE =
  "Missing database column players.invite_code. Please run phase_invite_code_migration.sql in Supabase SQL Editor.";

type SupabaseInviteClient = {
  from: (table: "players") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{
          data: { id?: string; invite_code?: string | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (values: { invite_code: string }) => {
      eq: (column: string, value: string) => PromiseLike<{
        error: { message: string } | null;
      }>;
    };
  };
};

export function normalizeInviteCode(value: string) {
  return value
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, INVITE_CODE_LENGTH);
}

export function isUuidInviteRef(value: string) {
  return UUID_PATTERN.test(value.trim());
}

export function isMissingInviteCodeColumnError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error ?? "");
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("invite_code") &&
    (lowerMessage.includes("does not exist") ||
      lowerMessage.includes("schema cache") ||
      lowerMessage.includes("could not find"))
  );
}

export function getInviteCodeColumnErrorMessage() {
  return MISSING_INVITE_CODE_MESSAGE;
}

export function sanitizeInviteParam(value: string | null) {
  const rawValue = value?.trim() ?? "";

  if (
    !rawValue ||
    rawValue.startsWith("{") ||
    rawValue.startsWith("[") ||
    rawValue.includes(":") ||
    rawValue.toLowerCase().includes("localstorage") ||
    isUuidInviteRef(rawValue)
  ) {
    return "";
  }

  const normalized = normalizeInviteCode(rawValue);

  return normalized.length === INVITE_CODE_LENGTH ? normalized : "";
}

export function generateInviteCode() {
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }

  return code;
}

export async function generateUniqueInviteCode(
  supabase: unknown,
) {
  const client = supabase as SupabaseInviteClient;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateInviteCode();
    const { data, error } = await client
      .from("players")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();

    if (error) {
      if (isMissingInviteCodeColumnError(error)) {
        throw new Error(MISSING_INVITE_CODE_MESSAGE);
      }

      throw new Error(error.message);
    }

    if (!data) {
      return code;
    }
  }

  throw new Error("邀请码生成失败，请重试");
}

export async function ensurePlayerInviteCode(
  supabase: unknown,
  player: { id: string; invite_code?: string | null },
) {
  const client = supabase as SupabaseInviteClient;

  if (player.invite_code) {
    return player.invite_code;
  }

  const inviteCode = await generateUniqueInviteCode(client);
  const { error } = await client
    .from("players")
    .update({ invite_code: inviteCode })
    .eq("id", player.id);

  if (error) {
    if (isMissingInviteCodeColumnError(error)) {
      throw new Error(MISSING_INVITE_CODE_MESSAGE);
    }

    throw new Error(error.message);
  }

  return inviteCode;
}
