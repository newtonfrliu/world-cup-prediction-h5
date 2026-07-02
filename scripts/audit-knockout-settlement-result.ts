import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

type MatchRow = {
  id: string;
  match_number: number | null;
  stage: string | null;
  home_team: string | null;
  away_team: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  regular_home_score: number | null;
  regular_away_score: number | null;
  betting_result: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  advancement_winner: string | null;
};

type PredictionRow = {
  id: string;
  player_id: string;
  match_id: string;
  prediction: string | null;
  stake: number | null;
  payout: number | null;
  points: number | null;
  status: string | null;
};

type MatchAuditRow = {
  match: MatchRow;
  settledPredictions: number;
  wonCount: number;
  lostCount: number;
  risk: "ok" | "needs_manual_review" | "possible_final_result_settlement";
};

const reportPath = path.join(
  process.cwd(),
  "docs",
  "KNOCKOUT_90MIN_SETTLEMENT_AUDIT.md",
);

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");

    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function isKnockoutStage(stage: string | null | undefined) {
  const normalized = (stage ?? "").trim().toLowerCase();

  return [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
    "knockout",
  ].includes(normalized);
}

function normalizeResult(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "home_win" || normalized === "home") return "home";
  if (normalized === "away_win" || normalized === "away") return "away";
  if (normalized === "draw") return "draw";
  return "";
}

function predictionMatchesBettingResult(
  prediction: string | null,
  bettingResult: string | null,
) {
  return (
    Boolean(normalizeResult(prediction)) &&
    normalizeResult(prediction) === normalizeResult(bettingResult)
  );
}

function getRisk(
  match: MatchRow,
  predictions: PredictionRow[],
): MatchAuditRow["risk"] {
  const settled = predictions.filter((prediction) =>
    ["won", "lost", "settled"].includes((prediction.status ?? "").toLowerCase()),
  );

  if (!match.betting_result || match.regular_home_score === null || match.regular_away_score === null) {
    return settled.length > 0
      ? "possible_final_result_settlement"
      : "needs_manual_review";
  }

  const hasMismatch = settled.some((prediction) => {
    if (prediction.status === "settled") return false;

    const shouldBeWon = predictionMatchesBettingResult(
      prediction.prediction,
      match.betting_result,
    );

    return (
      (shouldBeWon && prediction.status !== "won") ||
      (!shouldBeWon && prediction.status !== "lost")
    );
  });

  return hasMismatch ? "possible_final_result_settlement" : "ok";
}

function buildReport(rows: MatchAuditRow[]) {
  const riskCount = rows.filter((row) => row.risk !== "ok").length;
  const manualReviewCount = rows.filter(
    (row) => row.risk === "needs_manual_review",
  ).length;
  const possibleWrongSettlementCount = rows.filter(
    (row) => row.risk === "possible_final_result_settlement",
  ).length;

  const lines = [
    "# Knockout 90-Minute Settlement Audit",
    "",
    "This report is a dry-run only. It does not change predictions, coins, points, matches, or leaderboard data.",
    "",
    "Betting settlement must use `matches.betting_result`, which is derived only from 90-minute regular-time score.",
    "`matches.advancement_winner` is only for knockout progression and must not be used to settle 1X2 predictions.",
    "",
    "## Summary",
    "",
    `- Knockout matches audited: ${rows.length}`,
    `- Needs manual review: ${manualReviewCount}`,
    `- Possible final-result settlement risk: ${possibleWrongSettlementCount}`,
    `- Total non-ok rows: ${riskCount}`,
    "",
    "## Matches",
    "",
    "| Match | Stage | Teams | Legacy score/result | Regular score/betting_result | Final score/advancement | Settled | Won | Lost | Risk |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |",
  ];

  for (const row of rows) {
    const match = row.match;
    lines.push(
      [
        match.match_number ? `M${match.match_number}` : match.id,
        match.stage ?? "-",
        `${match.home_team ?? "-"} vs ${match.away_team ?? "-"}`,
        `${match.home_score ?? "-"}-${match.away_score ?? "-"} / ${match.result ?? "-"}`,
        `${match.regular_home_score ?? "-"}-${match.regular_away_score ?? "-"} / ${match.betting_result ?? "-"}`,
        `${match.final_home_score ?? "-"}-${match.final_away_score ?? "-"} / ${match.advancement_winner ?? "-"}`,
        String(row.settledPredictions),
        String(row.wonCount),
        String(row.lostCount),
        row.risk,
      ].join(" | "),
    );
  }

  lines.push(
    "",
    "## Dry-Run Repair Plan",
    "",
    "No automatic coin or points correction is produced unless a reliable 90-minute `betting_result` exists.",
    "For rows marked `needs_manual_review`, first enter regular-time scores and advancement winner in the admin page.",
    "After manual confirmation, run a separate dry-run to compare old prediction statuses with the corrected `betting_result` before applying any coin or points changes.",
    "",
  );

  return lines.join("\n");
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key. No audit was run.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, match_number, stage, home_team, away_team, status, home_score, away_score, result, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner",
    )
    .order("match_number", { ascending: true });

  if (matchError) {
    throw new Error(`Failed to load matches: ${matchError.message}`);
  }

  const knockoutMatches = ((matches ?? []) as MatchRow[]).filter((match) =>
    isKnockoutStage(match.stage),
  );
  const matchIds = knockoutMatches.map((match) => match.id);
  const { data: predictions, error: predictionError } = await supabase
    .from("predictions")
    .select("id, player_id, match_id, prediction, stake, payout, points, status")
    .in("match_id", matchIds);

  if (predictionError) {
    throw new Error(`Failed to load predictions: ${predictionError.message}`);
  }

  const predictionsByMatch = new Map<string, PredictionRow[]>();

  for (const prediction of (predictions ?? []) as PredictionRow[]) {
    const list = predictionsByMatch.get(prediction.match_id) ?? [];
    list.push(prediction);
    predictionsByMatch.set(prediction.match_id, list);
  }

  const rows = knockoutMatches.map((match) => {
    const matchPredictions = predictionsByMatch.get(match.id) ?? [];
    const wonCount = matchPredictions.filter(
      (prediction) => prediction.status === "won",
    ).length;
    const lostCount = matchPredictions.filter(
      (prediction) => prediction.status === "lost",
    ).length;

    return {
      match,
      settledPredictions: matchPredictions.filter((prediction) =>
        ["won", "lost", "settled"].includes(
          (prediction.status ?? "").toLowerCase(),
        ),
      ).length,
      wonCount,
      lostCount,
      risk: getRisk(match, matchPredictions),
    };
  });

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, buildReport(rows), "utf8");

  console.log(`Audited ${rows.length} knockout matches.`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
