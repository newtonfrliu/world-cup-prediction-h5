import { NextRequest, NextResponse } from "next/server";

import { syncWorldCupScores } from "@/lib/syncScores";

function buildErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack =
    process.env.NODE_ENV === "development" && error instanceof Error
      ? error.stack
      : undefined;

  return {
    success: false,
    error: message,
    stack,
  };
}

async function handleSyncScores(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!oddsApiKey || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, error: "Missing server environment variables." },
      { status: 500 },
    );
  }

  try {
    const result = await syncWorldCupScores({
      oddsApiKey,
      supabaseUrl,
      supabaseAnonKey,
    });

    return NextResponse.json({
      success: true,
      finished: result.finished,
      settled: result.settled,
      skipped: result.skipped.length,
    });
  } catch (error) {
    return NextResponse.json(buildErrorResponse(error), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleSyncScores(request);
}

export async function POST(request: NextRequest) {
  return handleSyncScores(request);
}
