import { NextResponse } from "next/server";

import { syncWorldCupScores } from "@/lib/syncScores";

export async function POST() {
  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!oddsApiKey || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing server environment variables." },
      { status: 500 },
    );
  }

  try {
    const result = await syncWorldCupScores({
      oddsApiKey,
      supabaseUrl,
      supabaseAnonKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
