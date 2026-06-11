const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
}

export function isUuidInviteRef(value: string) {
  return UUID_PATTERN.test(value.trim());
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
    throw new Error(error.message);
  }

  return inviteCode;
}
