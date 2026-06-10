import { NextResponse } from "next/server";

import { syncWorldCupOdds } from "@/lib/syncOdds";

const cooldownMs = 10 * 60 * 1000;
let lastSyncAt = 0;

export async function POST() {
  const now = Date.now();

  if (lastSyncAt && now - lastSyncAt < cooldownMs) {
    return NextResponse.json(
      {
        error: "距离上次同步不足10分钟，请稍后再试。",
        lastSyncAt: new Date(lastSyncAt).toISOString(),
      },
      { status: 429 },
    );
  }

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
    const result = await syncWorldCupOdds({
      oddsApiKey,
      supabaseUrl,
      supabaseAnonKey,
    });
    lastSyncAt = Date.now();

    return NextResponse.json({
      ...result,
      lastSyncAt: new Date(lastSyncAt).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
