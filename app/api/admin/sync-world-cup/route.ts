import { NextResponse } from "next/server";

import { syncKnockoutTeams } from "@/lib/syncKnockoutTeams";
import { syncWorldCupOdds } from "@/lib/syncOdds";
import { syncWorldCupScores } from "@/lib/syncScores";

type StepStatus = "pending" | "success" | "skipped" | "failed";

type StepLog = {
  step: "scores" | "knockout" | "odds";
  status: StepStatus;
  message: string;
  result?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}

function getRequiredEnv() {
  const oddsApiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!oddsApiKey) {
    throw new Error("Missing ODDS_API_KEY");
  }

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    oddsApiKey,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export async function POST() {
  const logs: StepLog[] = [];

  try {
    const { oddsApiKey, supabaseUrl, supabaseAnonKey } = getRequiredEnv();

    try {
      const scores = await syncWorldCupScores({
        oddsApiKey,
        supabaseUrl,
        supabaseAnonKey,
      });
      logs.push({
        step: "scores",
        status: "success",
        message: `同步赛果并结算完成：Finished ${scores.finished} matches, Settled ${scores.settled} predictions, Skipped ${scores.skipped.length} matches`,
        result: scores,
      });
    } catch (error) {
      logs.push({
        step: "scores",
        status: "failed",
        message: getErrorMessage(error),
      });

      return NextResponse.json(
        {
          success: false,
          message: "一键更新世界杯已停止：同步赛果并结算失败。",
          scores: null,
          knockout: null,
          odds: null,
          logs,
        },
        { status: 500 },
      );
    }

    let knockoutResult: Awaited<ReturnType<typeof syncKnockoutTeams>>;

    try {
      knockoutResult = await syncKnockoutTeams({
        supabaseUrl,
        supabaseAnonKey,
        apply: true,
      });
      logs.push({
        step: "knockout",
        status: knockoutResult.skipped ? "skipped" : "success",
        message: knockoutResult.skipped
          ? knockoutResult.message
          : `淘汰赛落位完成：Updated ${knockoutResult.updated} matches, Annex C ${knockoutResult.combinationKey}`,
        result: {
          updated: knockoutResult.updated,
          skipped: knockoutResult.skipped,
          combinationKey: knockoutResult.combinationKey,
          updates: knockoutResult.updates,
        },
      });
    } catch (error) {
      logs.push({
        step: "knockout",
        status: "failed",
        message: getErrorMessage(error),
      });

      return NextResponse.json(
        {
          success: false,
          message: "一键更新世界杯已停止：同步淘汰赛落位失败。",
          scores: logs.find((log) => log.step === "scores")?.result ?? null,
          knockout: null,
          odds: null,
          logs,
        },
        { status: 500 },
      );
    }

    if (knockoutResult.skipped) {
      return NextResponse.json({
        success: true,
        message: "一键更新世界杯已停止：小组赛未全部结束，淘汰赛落位已跳过。",
        scores: logs.find((log) => log.step === "scores")?.result ?? null,
        knockout: logs.find((log) => log.step === "knockout")?.result ?? null,
        odds: null,
        logs,
      });
    }

    try {
      const odds = await syncWorldCupOdds({
        oddsApiKey,
        supabaseUrl,
        supabaseAnonKey,
      });
      logs.push({
        step: "odds",
        status: "success",
        message: `同步赔率完成：Updated ${odds.updated} matches, Skipped ${odds.skipped.length} matches, Credits used: ${odds.creditsUsed ?? "-"}`,
        result: odds,
      });
    } catch (error) {
      logs.push({
        step: "odds",
        status: "failed",
        message: getErrorMessage(error),
      });

      return NextResponse.json(
        {
          success: false,
          message: "一键更新世界杯已停止：同步赔率失败。",
          scores: logs.find((log) => log.step === "scores")?.result ?? null,
          knockout: logs.find((log) => log.step === "knockout")?.result ?? null,
          odds: null,
          logs,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "一键更新世界杯完成。",
      scores: logs.find((log) => log.step === "scores")?.result ?? null,
      knockout: logs.find((log) => log.step === "knockout")?.result ?? null,
      odds: logs.find((log) => log.step === "odds")?.result ?? null,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error),
        scores: null,
        knockout: null,
        odds: null,
        logs,
      },
      { status: 500 },
    );
  }
}
