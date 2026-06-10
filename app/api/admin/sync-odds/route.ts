import { NextResponse } from "next/server";

import { syncWorldCupOdds } from "@/lib/syncOdds";

const cooldownMs = 10 * 60 * 1000;
let lastSyncAt = 0;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}

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

  if (!oddsApiKey) {
    return NextResponse.json(
      { success: false, error: "Missing ODDS_API_KEY" },
      { status: 500 },
    );
  }

  if (!supabaseUrl) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase URL" },
      { status: 500 },
    );
  }

  if (!supabaseAnonKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase anon key" },
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
      success: true,
      ...result,
      lastSyncAt: new Date(lastSyncAt).toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
