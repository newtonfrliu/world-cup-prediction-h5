import { NextRequest, NextResponse } from "next/server";

import { syncWorldCupOdds } from "@/lib/syncOdds";

type CronStep =
  | "validate_auth"
  | "read_env"
  | "call_sync_odds"
  | "update_supabase"
  | "done";

function buildErrorResponse(error: unknown, step: CronStep) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return {
    success: false,
    error: message,
    step,
  };
}

async function handleSyncOdds(request: NextRequest) {
  let step: CronStep = "validate_auth";

  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", step },
        { status: 401 },
      );
    }

    step = "read_env";
    const oddsApiKey = process.env.ODDS_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!oddsApiKey) {
      throw new Error("Missing environment variable: ODDS_API_KEY");
    }

    if (!supabaseUrl) {
      throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
    }

    if (!supabaseAnonKey) {
      throw new Error(
        "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    }

    step = "call_sync_odds";
    const result = await syncWorldCupOdds({
      oddsApiKey,
      supabaseUrl,
      supabaseAnonKey,
      onStep: (nextStep) => {
        step = nextStep;
      },
    });

    step = "done";
    return NextResponse.json({
      success: true,
      step,
      updated: result.updated,
      skipped: result.skipped.length,
      creditsUsed: result.creditsUsed,
      remainingCredits: result.creditsRemaining,
    });
  } catch (error) {
    return NextResponse.json(buildErrorResponse(error, step), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleSyncOdds(request);
}

export async function POST(request: NextRequest) {
  return handleSyncOdds(request);
}
