import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: matches, error: loadError } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .eq("stage", "round_of_16")
    .eq("home_team", "Switzerland")
    .eq("away_team", "Colombia");

  if (loadError) {
    throw new Error(`Failed to load Switzerland vs Colombia: ${loadError.message}`);
  }

  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one Switzerland vs Colombia match, found ${matches?.length ?? 0}.`);
  }

  const match = matches[0];
  const payload = {
    status: "finished",
    home_score: 0,
    away_score: 0,
    regular_home_score: 0,
    regular_away_score: 0,
    betting_result: "draw",
    final_home_score: 0,
    final_away_score: 0,
    result: "draw",
    advancement_winner: "home",
  };

  const { error: updateError } = await supabase
    .from("matches")
    .update(payload)
    .eq("id", match.id);

  if (updateError) {
    throw new Error(`Failed to update Switzerland vs Colombia: ${updateError.message}`);
  }

  console.log("Updated Switzerland vs Colombia advancement fields.");
  console.log({
    match_id: match.id,
    match_number: match.match_number,
    old: match,
    new: payload,
    note: "90 minutes 0-0; Switzerland advanced on penalties 4-3. Penalty score is not stored in the current schema.",
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});

export {};
