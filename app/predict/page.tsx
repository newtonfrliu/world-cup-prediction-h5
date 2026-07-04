"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CountryDisplay } from "@/components/CountryDisplay";
import { getStoredPlayerId } from "@/lib/playerSession";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type MatchWithOptionalScore = Match & {
  home_score?: number | null;
  away_score?: number | null;
  home_goals?: number | null;
  away_goals?: number | null;
  score_home?: number | null;
  score_away?: number | null;
  final_result?: string | null;
};
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
type MatchState = "not_started" | "in_progress" | "finished";
type MatchTabKey = "upcoming" | "in_progress" | "finished";
type PredictionChoice =
  Database["public"]["Tables"]["predictions"]["Insert"]["prediction"];
type BettingMarket = Database["public"]["Tables"]["match_betting_markets"]["Row"];
type BetOption = {
  marketKey: string;
  marketLabel: string;
  selectionKey: PredictionChoice | "home_advance" | "away_advance" | "over" | "under";
  selectionLabel: string;
  odds: number;
  line: number;
};
type MyPrediction = Pick<
  Prediction,
  | "id"
  | "match_id"
  | "prediction"
  | "odds_at_prediction"
  | "stake"
  | "payout"
  | "status"
  | "settled_at"
  | "points"
  | "market_key"
  | "market_label"
  | "selection_key"
  | "selection_label"
  | "line"
> & {
  matches: Pick<
    Match,
    | "home_team"
    | "away_team"
    | "start_time"
    | "status"
    | "result"
    | "betting_result"
    | "home_score"
    | "away_score"
  > | null;
};

const predictionOptions: Array<{
  label: string;
  value: PredictionChoice;
  oddsKey: "odds_home" | "odds_draw" | "odds_away";
}> = [
  { label: "主胜", value: "home_win", oddsKey: "odds_home" },
  { label: "平局", value: "draw", oddsKey: "odds_draw" },
  { label: "客胜", value: "away_win", oddsKey: "odds_away" },
];

const predictionLabels: Record<PredictionChoice, string> = {
  home_win: "主胜",
  draw: "平局",
  away_win: "客胜",
};

const predictionSummaryOrder = ["h2h_90", "advance", "totals_90"];

function getPredictionSummaryPrefix(marketKey: string | null) {
  if (marketKey === "advance") return "晋级";
  if (marketKey === "totals_90") return "大小";
  return "胜平";
}

function getPredictionSummarySelection(prediction: MyPrediction) {
  const marketKey = prediction.market_key ?? "h2h_90";
  const fallbackLabel = prediction.prediction
    ? predictionLabels[prediction.prediction]
    : undefined;
  const label =
    prediction.selection_label ??
    fallbackLabel ??
    prediction.selection_key ??
    "";

  if (marketKey === "advance") {
    return label.replace(/\s*晋级\s*$/, "");
  }

  return label === "平" ? "平局" : label;
}

function getPredictionSummaryBadges(predictions: MyPrediction[]) {
  const byMarket = new Map<string, MyPrediction>();

  for (const prediction of predictions) {
    const marketKey = prediction.market_key ?? "h2h_90";
    if (!byMarket.has(marketKey)) {
      byMarket.set(marketKey, prediction);
    }
  }

  return Array.from(byMarket.entries())
    .sort(
      ([a], [b]) =>
        predictionSummaryOrder.indexOf(a) - predictionSummaryOrder.indexOf(b),
    )
    .map(([marketKey, prediction]) => ({
      marketKey,
      label: `${getPredictionSummaryPrefix(marketKey)}：${getPredictionSummarySelection(
        prediction,
      )}`,
    }))
    .filter((item) => item.label.trim() !== `${getPredictionSummaryPrefix(item.marketKey)}：`);
}

const settlementStatusLabels: Record<string, string> = {
  won: "成功",
  lost: "失败",
  active: "未结算",
  cancelled: "已撤回",
  refunded: "已退还",
  settled: "已结算",
  void: "走水",
  half_win: "半赢",
  half_lost: "半输",
};

const matchResultLabels: Record<string, string> = {
  home: "主胜",
  home_win: "主胜",
  draw: "平局",
  away: "客胜",
  away_win: "客胜",
};

function isPlaceholderTeamName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return (
    /^match\s+\d+\s+winners?$/.test(normalized) ||
    /^winner of\s+match\s+\d+$/.test(normalized) ||
    normalized === "tbd"
  );
}

function hasUsableH2hOdds(match: Match) {
  const odds = [match.odds_home, match.odds_draw, match.odds_away];

  return (
    odds.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    !odds.every((value) => value === 1)
  );
}

function normalizeMatchStage(stage: string | null | undefined) {
  return (stage ?? "group").trim().toLowerCase();
}

function getMatchStageLabel(stage: string | null | undefined) {
  const normalized = normalizeMatchStage(stage);

  if (normalized === "round_of_32") {
    return "🏆 FIFA WORLD CUP 2026 / 32强";
  }

  if (normalized === "round_of_16") {
    return "🏆 FIFA WORLD CUP 2026 / 16强";
  }

  if (normalized === "quarter_final" || normalized === "quarterfinal") {
    return "🏆 FIFA WORLD CUP 2026 / 8强";
  }

  if (normalized === "semi_final" || normalized === "semifinal") {
    return "🏆 FIFA WORLD CUP 2026 / 半决赛";
  }

  if (normalized === "third_place") {
    return "🏆 FIFA WORLD CUP 2026 / 季军赛";
  }

  if (normalized === "final") {
    return "🏆 FIFA WORLD CUP 2026 / 决赛";
  }

  return "MATCH CARD / GROUP STAGE";
}

function isKnockoutStage(stage: string | null | undefined) {
  const normalized = normalizeMatchStage(stage);

  return [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "quarterfinal",
    "semi_final",
    "semifinal",
    "third_place",
    "final",
    "knockout",
  ].includes(normalized);
}

function getMatchStageCardClass(stage: string | null | undefined) {
  const normalized = normalizeMatchStage(stage);

  if (normalized === "round_of_32") {
    return "border-[#f6c84c]/70 shadow-[0_18px_38px_rgba(246,200,76,0.18)]";
  }

  if (normalized === "round_of_16") {
    return "border-[#25c7b7]/70 shadow-[0_18px_38px_rgba(37,199,183,0.16)]";
  }

  if (normalized === "quarter_final" || normalized === "quarterfinal") {
    return "border-[#7c3aed]/70 shadow-[0_18px_38px_rgba(124,58,237,0.18)]";
  }

  if (normalized === "semi_final" || normalized === "semifinal") {
    return "border-[#e63535]/70 shadow-[0_18px_38px_rgba(230,53,53,0.18)]";
  }

  if (normalized === "third_place") {
    return "border-[#c9782f]/70 shadow-[0_18px_38px_rgba(201,120,47,0.18)]";
  }

  if (normalized === "final") {
    return "border-[#f6c84c] shadow-[0_22px_46px_rgba(7,27,58,0.28)]";
  }

  return "border-[#071b3a]/15 shadow-[0_14px_30px_rgba(7,27,58,0.1)]";
}

function getMatchStageHeaderClass(stage: string | null | undefined) {
  const normalized = normalizeMatchStage(stage);

  if (normalized === "round_of_16") {
    return "bg-gradient-to-br from-[#063f33] to-[#071b3a]";
  }

  if (normalized === "quarter_final" || normalized === "quarterfinal") {
    return "bg-gradient-to-br from-[#2f1b63] to-[#071b3a]";
  }

  if (normalized === "semi_final" || normalized === "semifinal") {
    return "bg-gradient-to-br from-[#7f1d1d] to-[#071b3a]";
  }

  if (normalized === "third_place") {
    return "bg-gradient-to-br from-[#8a4b18] to-[#071b3a]";
  }

  if (normalized === "final") {
    return "bg-gradient-to-br from-[#050505] via-[#071b3a] to-[#3b2a06]";
  }

  return "bg-[#071b3a]";
}

function getMatchStageBadgeClass(stage: string | null | undefined) {
  const normalized = normalizeMatchStage(stage);

  if (normalized === "round_of_16") {
    return "text-[#25c7b7]";
  }

  if (normalized === "quarter_final" || normalized === "quarterfinal") {
    return "text-[#c4b5fd]";
  }

  if (normalized === "semi_final" || normalized === "semifinal") {
    return "text-[#fecaca]";
  }

  if (normalized === "third_place") {
    return "text-[#fed7aa]";
  }

  if (normalized === "final") {
    return "text-[#f6c84c]";
  }

  if (normalized === "round_of_32") {
    return "text-[#f6c84c]";
  }

  return "text-[#d9e2ec]";
}

function getScoreValue(match: MatchWithOptionalScore, side: "home" | "away") {
  const candidates =
    side === "home"
      ? [match.home_score, match.home_goals, match.score_home]
      : [match.away_score, match.away_goals, match.score_away];
  const score = candidates.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  return score ?? null;
}

function getMatchResult(match: MatchWithOptionalScore) {
  return match.betting_result ?? match.result ?? match.final_result ?? null;
}

function normalizeMatchResult(result: string | null) {
  if (result === "home" || result === "home_win") {
    return "home_win";
  }

  if (result === "away" || result === "away_win") {
    return "away_win";
  }

  if (result === "draw") {
    return "draw";
  }

  return null;
}

function normalizePredictionStatus(status: string | null | undefined) {
  return (status ?? "active").trim().toLowerCase();
}

function isCancelledPrediction(prediction: Pick<Prediction, "status">) {
  return normalizePredictionStatus(prediction.status) === "cancelled";
}

function isActivePrediction(prediction: Pick<Prediction, "status">) {
  const status = normalizePredictionStatus(prediction.status);
  return status === "active";
}

function isDisplayablePrediction(prediction: Pick<Prediction, "status">) {
  return !isCancelledPrediction(prediction);
}

function getPredictionResultInfo(
  prediction: Pick<Prediction, "status" | "settled_at" | "payout" | "points">,
) {
  const status = normalizePredictionStatus(prediction.status);

  if (status === "won") {
    return {
      label: "成功",
      badgeClass: "bg-[#e3f9e5] text-[#0f7b3f] border-[#9ae6b4]",
      cardClass: "border-[#9ae6b4] bg-[#f0fff4]",
    };
  }

  if (status === "lost") {
    return {
      label: "失败",
      badgeClass: "bg-[#fde8e8] text-[#9b1c1c] border-[#f7c6c7]",
      cardClass: "border-[#f7c6c7] bg-[#fff5f5]",
    };
  }

  if (status === "void") {
    return {
      label: "走水",
      badgeClass: "bg-[#edf1f5] text-[#334e68] border-[#cbd2d9]",
      cardClass: "border-[#cbd2d9] bg-[#f5f7fa]",
    };
  }

  if (status === "half_win") {
    return {
      label: "半赢",
      badgeClass: "bg-[#fff8db] text-[#7c5e10] border-[#f6c84c]",
      cardClass: "border-[#f6c84c] bg-[#fffbea]",
    };
  }

  if (status === "half_lost") {
    return {
      label: "半输",
      badgeClass: "bg-[#ffedd5] text-[#9a3412] border-[#fdba74]",
      cardClass: "border-[#fdba74] bg-[#fff7ed]",
    };
  }

  if (status === "cancelled") {
    return {
      label: "已撤回",
      badgeClass: "bg-[#edf1f5] text-[#52606d] border-[#cbd2d9]",
      cardClass: "border-[#d9e2ec] bg-[#f5f7fa]",
    };
  }

  if (status === "settled" || prediction.settled_at) {
    const won = (prediction.payout ?? 0) > 0 || (prediction.points ?? 0) > 0;
    return won
      ? {
          label: "成功",
          badgeClass: "bg-[#e3f9e5] text-[#0f7b3f] border-[#9ae6b4]",
          cardClass: "border-[#9ae6b4] bg-[#f0fff4]",
        }
      : {
          label: "失败",
          badgeClass: "bg-[#fde8e8] text-[#9b1c1c] border-[#f7c6c7]",
          cardClass: "border-[#f7c6c7] bg-[#fff5f5]",
        };
  }

  return {
    label: "未结算",
    badgeClass: "bg-[#fff8db] text-[#8d6b00] border-[#f6c84c]",
    cardClass: "border-[#f6c84c]/60 bg-[#fffdf0]",
  };
}

function getPredictionSortGroup(prediction: MyPrediction) {
  const status = normalizePredictionStatus(prediction.status);

  if (status === "active") {
    return 0;
  }

  if (
    status === "won" ||
    status === "lost" ||
    status === "settled" ||
    status === "void" ||
    status === "half_win" ||
    status === "half_lost"
  ) {
    return 1;
  }

  return 2;
}

function sortPredictionsForDisplay(predictions: MyPrediction[]) {
  return [...predictions].sort((left, right) => {
    const groupDiff =
      getPredictionSortGroup(left) - getPredictionSortGroup(right);

    if (groupDiff !== 0) {
      return groupDiff;
    }

    const leftTime = left.matches?.start_time
      ? new Date(left.matches.start_time).getTime()
      : 0;
    const rightTime = right.matches?.start_time
      ? new Date(right.matches.start_time).getTime()
      : 0;

    return rightTime - leftTime;
  });
}

function parseMatchTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatMatchTime(value: string) {
  const date = parseMatchTime(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}

function isMissingPredictionStatusError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("'status' column of 'predictions'") ||
    message.includes("predictions.status") ||
    message.includes("status column") ||
    message.includes("schema cache")
  );
}

export default function PredictPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [bettingMarkets, setBettingMarkets] = useState<BettingMarket[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Pick<
    Player,
    "id" | "country" | "coins"
  > | null>(null);
  const [myPredictions, setMyPredictions] = useState<MyPrediction[]>([]);
  const [showMyPredictions, setShowMyPredictions] = useState(false);
  const [activeMatchTab, setActiveMatchTab] =
    useState<MatchTabKey>("upcoming");
  const [bettingMatch, setBettingMatch] = useState<Match | null>(null);
  const [bettingOption, setBettingOption] = useState<
    BetOption | null
  >(null);
  const [stakeInput, setStakeInput] = useState("50");
  const [loading, setLoading] = useState(true);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [betError, setBetError] = useState("");
  const [toast, setToast] = useState("");
  const [targetMatchId, setTargetMatchId] = useState<string | null>(null);

  const hasMatches = matches.length > 0;
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const predictionsByMatchMarket = useMemo(() => {
    return new Map(
      myPredictions
        .filter(isDisplayablePrediction)
        .map((prediction) => [
          `${prediction.match_id}:${prediction.market_key ?? "h2h_90"}`,
          prediction,
        ]),
    );
  }, [myPredictions]);
  const marketsByMatchId = useMemo(() => {
    const map = new Map<string, BettingMarket[]>();

    for (const market of bettingMarkets) {
      if (market.is_active === false) continue;
      const list = map.get(market.match_id) ?? [];
      list.push(market);
      map.set(market.match_id, list);
    }

    return map;
  }, [bettingMarkets]);
  const bettingAvailableCoins = player?.coins ?? 0;

  useEffect(() => {
    setTargetMatchId(new URLSearchParams(window.location.search).get("matchId"));
  }, []);

  async function loadMyPredictions(currentPlayerId: string) {
    const queryWithStatus = supabase
      .from("predictions")
      .select(
        "id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, market_key, market_label, selection_key, selection_label, line, matches(home_team, away_team, start_time, status, result, betting_result, home_score, away_score)",
      )
      .eq("player_id", currentPlayerId);
    const { data, error: predictionError } = await queryWithStatus;

    if (predictionError) {
      if (!isMissingPredictionStatusError(predictionError)) {
        console.error("loadMyPredictions failed", {
          playerId: currentPlayerId,
          error: predictionError,
        });
        throw predictionError;
      }

      console.error("loadMyPredictions fallback without status", {
        playerId: currentPlayerId,
        error: predictionError,
      });

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("predictions")
        .select(
          "id, match_id, prediction, odds_at_prediction, stake, payout, points, market_key, market_label, selection_key, selection_label, line, matches(home_team, away_team, start_time, status, result, betting_result, home_score, away_score)",
        )
        .eq("player_id", currentPlayerId);

      if (fallbackError) {
        console.error("loadMyPredictions fallback failed", {
          playerId: currentPlayerId,
          error: fallbackError,
        });
        throw fallbackError;
      }

      const fallbackPredictions = sortPredictionsForDisplay(((fallbackData ?? []) as unknown as Omit<
        MyPrediction,
        "status" | "settled_at"
      >[]).map((prediction) => ({
        ...prediction,
        status: "active",
        settled_at: null,
        market_key: prediction.market_key ?? "h2h_90",
        market_label: prediction.market_label ?? "90分钟胜平负",
        selection_key: prediction.selection_key ?? prediction.prediction,
        selection_label:
          prediction.selection_label ??
          predictionLabels[prediction.prediction],
        line: prediction.line ?? 0,
      }))
        .filter(isDisplayablePrediction) as MyPrediction[]);

      setMyPredictions(fallbackPredictions);
      return;
    }

    const predictions = sortPredictionsForDisplay(((data ?? []) as unknown as MyPrediction[])
      .map((prediction) => ({
        ...prediction,
        status: prediction.status ?? "active",
        market_key: prediction.market_key ?? "h2h_90",
        market_label: prediction.market_label ?? "90分钟胜平负",
        selection_key: prediction.selection_key ?? prediction.prediction,
        selection_label:
          prediction.selection_label ??
          predictionLabels[prediction.prediction],
        line: prediction.line ?? 0,
      }))
      .filter(isDisplayablePrediction));

    setMyPredictions(predictions);
  }

  async function refreshPlayer(currentPlayerId: string) {
    const { data, error: playerError } = await supabase
      .from("players")
      .select("id, country, coins")
      .eq("id", currentPlayerId)
      .maybeSingle();

    if (playerError) {
      console.error("refreshPlayer failed", {
        playerId: currentPlayerId,
        error: playerError,
      });
      throw playerError;
    }

    setPlayer(data);
    return data;
  }

  async function refreshMatches() {
    const { data, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, match_number, group_name, home_team, away_team, start_time, odds_home, odds_draw, odds_away, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner, stage, venue, result, status, created_at",
      )
      .order("start_time", { ascending: true });

    if (matchError) {
      console.error("refreshMatches failed", { error: matchError });
      throw matchError;
    }

    setMatches(data ?? []);
  }

  async function refreshBettingMarkets() {
    const { data, error: marketError } = await supabase
      .from("match_betting_markets")
      .select(
        "id, match_id, market_key, selection_key, selection_label, odds, line, source, bookmaker, is_active, updated_at",
      )
      .eq("is_active", true);

    if (marketError) {
      console.error("refreshBettingMarkets failed", { error: marketError });
      throw marketError;
    }

    setBettingMarkets((data ?? []) as BettingMarket[]);
  }

  async function refreshPredictionState(currentPlayerId: string) {
    await Promise.all([
      refreshPlayer(currentPlayerId),
      loadMyPredictions(currentPlayerId),
      refreshMatches(),
      refreshBettingMarkets(),
    ]);
  }

  useEffect(() => {
    async function loadMatches() {
      const storedPlayerId = getStoredPlayerId();
      setPlayerId(storedPlayerId);

      if (!storedPlayerId) {
        router.replace("/");
        setLoading(false);
        return;
      }

      if (!canUseSupabase) {
        setError("请先配置 Supabase 环境变量。");
        setLoading(false);
        return;
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, match_number, group_name, home_team, away_team, start_time, odds_home, odds_draw, odds_away, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner, stage, venue, result, status, created_at",
        )
        .order("start_time", { ascending: true });

      if (matchError) {
        setError(matchError.message);
        setLoading(false);
        return;
      }

      setMatches(matchData ?? []);
      await refreshBettingMarkets();

      if (storedPlayerId) {
        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("id, country, coins")
          .eq("id", storedPlayerId)
          .maybeSingle();

        if (playerError) {
          setError(playerError.message);
          setLoading(false);
          return;
        }

        setPlayer(playerData);
        await loadMyPredictions(storedPlayerId);
      }

      setLoading(false);
    }

    loadMatches();
  }, [canUseSupabase, router]);

  function getMatchState(match: Match): MatchState {
    const normalizedStatus = (match.status ?? "open").toLowerCase();

    if (normalizedStatus === "finished") {
      return "finished";
    }

    if (
      ["live", "in_progress", "in-progress", "started", "playing"].includes(
        normalizedStatus,
      )
    ) {
      return "in_progress";
    }

    const startTime = parseMatchTime(match.start_time);

    if (startTime && startTime.getTime() <= Date.now()) {
      return "in_progress";
    }

    return "not_started";
  }

  function isMatchStarted(match: Match) {
    return getMatchState(match) !== "not_started";
  }

  function isMatchFinished(match: Match) {
    return getMatchState(match) === "finished";
  }

  function openBetPanel(match: Match, option: BetOption) {
    if (isMatchFinished(match)) {
      setError("比赛已结束，不能下注。");
      return;
    }

    if (isMatchStarted(match)) {
      setError("比赛已开始，不能下注。");
      return;
    }

    setBettingMatch(match);
    setBettingOption(option);
    setStakeInput("50");
    setError("");
    setBetError("");
    setToast("");
  }

  async function savePredictionWithFallback({
    match,
    selectedOption,
    stake,
  }: {
    match: Match;
    selectedOption: BetOption;
    stake: number;
  }) {
    const legacyPrediction = (
      selectedOption.marketKey === "h2h_90"
        ? selectedOption.selectionKey
        : selectedOption.selectionKey === "home_advance"
          ? "home_win"
          : selectedOption.selectionKey === "away_advance"
            ? "away_win"
            : selectedOption.selectionKey === "over"
              ? "home_win"
              : "away_win"
    ) as PredictionChoice;
    const payload = {
      player_id: playerId as string,
      match_id: match.id,
      prediction: legacyPrediction,
      odds_at_prediction: selectedOption.odds,
      stake,
      payout: 0,
      status: "active",
      settled_at: null,
      market_key: selectedOption.marketKey,
      market_label: selectedOption.marketLabel,
      selection_key: selectedOption.selectionKey,
      selection_label: selectedOption.selectionLabel,
      line: selectedOption.line,
      created_at: new Date().toISOString(),
    };
    const { error: upsertError } = await supabase
      .from("predictions")
      .upsert(payload, { onConflict: "player_id,match_id,market_key" });

    if (!upsertError) {
      return;
    }

    if (!isMissingPredictionStatusError(upsertError)) {
      console.error("prediction upsert failed", { payload, error: upsertError });
      throw new Error(`预测保存失败：${upsertError.message}`);
    }

    console.error("prediction upsert fallback without status", {
      payload,
      error: upsertError,
    });

    const fallbackPayload: Omit<typeof payload, "status" | "settled_at"> = {
      player_id: payload.player_id,
      match_id: payload.match_id,
      prediction: payload.prediction,
      odds_at_prediction: payload.odds_at_prediction,
      stake: payload.stake,
      payout: payload.payout,
      market_key: payload.market_key,
      market_label: payload.market_label,
      selection_key: payload.selection_key,
      selection_label: payload.selection_label,
      line: payload.line,
      created_at: payload.created_at,
    };
    const { error: fallbackError } = await supabase
      .from("predictions")
      .upsert(fallbackPayload, { onConflict: "player_id,match_id,market_key" });

    if (fallbackError) {
      console.error("prediction upsert fallback failed", {
        payload: fallbackPayload,
        error: fallbackError,
      });
      throw new Error(`预测保存失败：${fallbackError.message}`);
    }
  }

  async function cancelPredictionRecord(prediction: MyPrediction) {
    const { data: cancelledRows, error: cancelError } = await supabase
      .from("predictions")
      .update({
        status: "cancelled",
        stake: 0,
        payout: 0,
        settled_at: null,
      })
      .eq("id", prediction.id)
      .eq("player_id", playerId as string)
      .eq("match_id", prediction.match_id)
      .or("status.eq.active,status.is.null")
      .select("id");

    if (!cancelError) {
      if (!cancelledRows || cancelledRows.length === 0) {
        console.error("prediction cancel skipped because active row was not found", {
          prediction,
          playerId,
        });
        throw new Error("投注不存在或已撤回，金币未重复返还。");
      }
      return;
    }

    if (!isMissingPredictionStatusError(cancelError)) {
      console.error("prediction cancel failed", {
        prediction,
        error: cancelError,
      });
      throw new Error(`撤单失败：${cancelError.message}`);
    }

    console.error("prediction cancel fallback without status", {
      prediction,
      error: cancelError,
    });

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("predictions")
      .update({
        stake: 0,
        payout: 0,
      })
      .eq("id", prediction.id)
      .eq("player_id", playerId as string)
      .eq("match_id", prediction.match_id)
      .select("id");

    if (fallbackError) {
      console.error("prediction cancel fallback failed", {
        prediction,
        error: fallbackError,
      });
      throw new Error(`撤单失败：${fallbackError.message}`);
    }

    if (!fallbackRows || fallbackRows.length === 0) {
      console.error("prediction cancel fallback skipped because row was not found", {
        prediction,
        playerId,
      });
      throw new Error("投注不存在或已撤回，金币未重复返还。");
    }
  }

  async function submitPrediction() {
    const match = bettingMatch;
    const selectedOption = bettingOption;

    if (!match || !selectedOption) {
      return;
    }

    if (!playerId) {
      setBetError("请先在首页创建玩家。");
      return;
    }

    if (!player) {
      setBetError("请先加载玩家金币信息。");
      return;
    }

    if (submittingMatchId) {
      return;
    }

    if (isMatchFinished(match)) {
      setBetError("比赛已结束，不能下注。");
      return;
    }

    if (isMatchStarted(match)) {
      setBetError("比赛已开始。");
      return;
    }

    const stake = Number(stakeInput);

    if (!Number.isInteger(stake) || stake <= 0) {
      setBetError("下注金币必须为大于 0 的整数。");
      return;
    }

    const existingPrediction = predictionsByMatchMarket.get(
      `${match.id}:${selectedOption.marketKey}`,
    );

    if (existingPrediction && isActivePrediction(existingPrediction)) {
      setBetError("你已下注，请先撤回投注后再重新下注。");
      return;
    }

    const availableCoins = player.coins;

    if (stake > availableCoins) {
      setBetError("金币不足。");
      return;
    }

    setSubmittingMatchId(match.id);
    setError("");
    setBetError("");
    setToast("");

    try {
      await savePredictionWithFallback({ match, selectedOption, stake });

      const nextCoins = availableCoins - stake;
      const { error: coinUpdateError } = await supabase
        .from("players")
        .update({ coins: nextCoins })
        .eq("id", playerId);

      if (coinUpdateError) {
        console.error("player coin update failed after bet", {
          playerId,
          matchId: match.id,
          nextCoins,
          error: coinUpdateError,
        });
        throw new Error(`数据库错误：${coinUpdateError.message}`);
      }

      await refreshPredictionState(playerId);
      setBettingMatch(null);
      setBettingOption(null);
      setToast(
        `下注成功：已投注 ${stake} 金币，预计返还 ${Math.round(
          stake * selectedOption.odds,
        )} 金币`,
      );
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      console.error("submitPrediction failed", {
        playerId,
        match,
        selectedOption,
        stake,
        error: submitError,
      });
      setBetError(message || "下注失败，请稍后重试。");
    } finally {
      setSubmittingMatchId(null);
    }
  }

  async function cancelPrediction(match: Match, prediction: MyPrediction) {
    if (!playerId || !player) {
      return;
    }

    if (isMatchStarted(match) || isMatchFinished(match)) {
      setError("比赛已开始，投注已冻结。");
      return;
    }

    setSubmittingMatchId(match.id);
    setError("");
    setBetError("");
    setToast("");

    try {
      await cancelPredictionRecord(prediction);

      const nextCoins = player.coins + prediction.stake;
      const { error: coinError } = await supabase
        .from("players")
        .update({ coins: nextCoins })
        .eq("id", playerId);

      if (coinError) {
        console.error("player coin update failed after cancel", {
          playerId,
          prediction,
          nextCoins,
          error: coinError,
        });
        throw new Error(`数据库错误：${coinError.message}`);
      }

      await refreshPredictionState(playerId);
      setToast("投注已撤回，金币已返还");
    } catch (cancelError) {
      const message = getErrorMessage(cancelError);
      console.error("cancelPrediction failed", {
        playerId,
        match,
        prediction,
        error: cancelError,
      });
      setError(message || "撤单失败，请稍后重试。");
    } finally {
      setSubmittingMatchId(null);
    }
  }

  const sortByStartTimeAsc = (left: Match, right: Match) =>
    new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
  const sortByStartTimeDesc = (left: Match, right: Match) =>
    new Date(right.start_time).getTime() - new Date(left.start_time).getTime();
  const upcomingMatches = matches
    .filter((match) => getMatchState(match) === "not_started")
    .sort(sortByStartTimeAsc);
  const inProgressMatches = matches
    .filter((match) => getMatchState(match) === "in_progress")
    .sort(sortByStartTimeAsc);
  const finishedMatches = matches
    .filter((match) => getMatchState(match) === "finished")
    .sort(sortByStartTimeDesc);
  const matchTabs: Array<{
    key: MatchTabKey;
    label: string;
    matches: Match[];
  }> = [
    {
      key: "upcoming",
      label: "即将开赛",
      matches: upcomingMatches,
    },
    {
      key: "in_progress",
      label: "进行中",
      matches: inProgressMatches,
    },
    {
      key: "finished",
      label: "已结束",
      matches: finishedMatches,
    },
  ];
  const activeMatches =
    matchTabs.find((tab) => tab.key === activeMatchTab)?.matches ?? [];

  useEffect(() => {
    if (loading || !targetMatchId || matches.length === 0) {
      return;
    }

    const targetMatch = matches.find((match) => match.id === targetMatchId);

    if (!targetMatch) {
      return;
    }

    const targetState = getMatchState(targetMatch);
    const targetTab: MatchTabKey =
      targetState === "finished"
        ? "finished"
        : targetState === "in_progress"
          ? "in_progress"
          : "upcoming";

    if (activeMatchTab !== targetTab) {
      setActiveMatchTab(targetTab);
      return;
    }

    window.setTimeout(() => {
      document
        .getElementById(`match-${targetMatchId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [activeMatchTab, loading, matches, targetMatchId]);

  return (
    <main className="wc-page px-4 py-6">
      <section className="wc-shell">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="wc-kicker">
              Match Cards
            </p>
            <h1 className="wc-title mt-2">
              预测比赛
            </h1>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/"
              className="rounded-md border border-[#071b3a]/15 bg-white px-3 py-2 text-center text-sm font-bold text-[#071b3a]"
            >
              首页
            </Link>
            <Link
              href="/profile"
              className="rounded-md border border-[#071b3a]/15 bg-white px-3 py-2 text-center text-sm font-bold text-[#071b3a]"
            >
              我的战绩
            </Link>
          </div>
        </div>

        {!playerId ? (
          <div className="mb-5 rounded-xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            请先返回首页创建玩家，再进行预测。
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div className="mb-5 rounded-xl border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm font-black text-[#0f7b3f]">
            {toast}
          </div>
        ) : null}

        <div className="mb-5 rounded-2xl bg-white p-4 text-sm font-black text-[#071b3a] shadow-sm">
          我的金币：{player?.coins ?? "-"}
          {player?.coins === 0 ? (
            <p className="mt-2 text-[#e63535]">
              金币不足，无法下注。明日登录可领取 200 金币，也可以邀请好友获得金币
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setShowMyPredictions((current) => !current)}
          className="wc-button-secondary mb-5 w-full"
        >
          我的预测
        </button>

        {showMyPredictions ? (
          <div className="mb-5 space-y-3">
            {myPredictions.length === 0 ? (
              <div className="wc-card p-4 text-sm text-[#52606d]">
                暂无预测记录。
              </div>
            ) : null}

            {myPredictions.map((prediction) => {
              const match = prediction.matches;
              const resultInfo = getPredictionResultInfo(prediction);

              return (
                <article
                  key={prediction.id}
                  className={`rounded-2xl border p-4 text-sm shadow-sm ${resultInfo.cardClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-black text-[#102a43]">
                      {match ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <CountryDisplay team={match.home_team} />
                          <span className="text-[#e63535]">VS</span>
                          <CountryDisplay team={match.away_team} />
                        </span>
                      ) : (
                        "未知比赛"
                      )}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${resultInfo.badgeClass}`}
                    >
                      {resultInfo.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[#627d98]">
                    开赛时间：
                    {match ? formatMatchTime(match.start_time) : "-"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      [
                        "玩法",
                        prediction.market_label ?? "90分钟胜平负",
                      ],
                      [
                        "我的选择",
                        prediction.selection_label ??
                          predictionLabels[prediction.prediction],
                      ],
                      ["预测时赔率", `${prediction.odds_at_prediction}`],
                      ["下注金币", `${prediction.stake}`],
                      ["实际获得", `${prediction.payout ?? 0}`],
                      ["本场积分", `${prediction.points ?? 0}`],
                      ["结果", resultInfo.label],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-white/80 px-3 py-2"
                      >
                        <p className="text-[11px] font-black text-[#627d98]">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-black text-[#071b3a]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {loading ? (
          <div className="wc-card p-5 text-sm text-[#52606d]">
            加载比赛中...
          </div>
        ) : null}

        {!loading && !hasMatches ? (
          <div className="wc-card p-5 text-sm text-[#52606d]">
            暂无比赛。
          </div>
        ) : null}

        <div className="sticky top-0 z-20 -mx-4 mb-4 border-y border-[#071b3a]/10 bg-[#f6f1e7]/95 px-4 py-3 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {matchTabs.map((tab) => {
              const isActive = activeMatchTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveMatchTab(tab.key)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                    isActive
                      ? "border-[#e63535] bg-[#e63535] text-white shadow-sm"
                      : "border-[#071b3a]/10 bg-white text-[#071b3a]"
                  }`}
                >
                  {tab.label}({tab.matches.length})
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {activeMatches.map((match) => {
            const isSubmitting = submittingMatchId === match.id;
            const matchState = getMatchState(match);
            const isFinished = matchState === "finished";
            const isInProgress = matchState === "in_progress";
            const isBettingClosed = matchState !== "not_started";
            const matchStatusLabel =
              matchState === "finished"
                ? "已结束"
                : matchState === "in_progress"
                  ? "进行中"
                  : "未开始";
            const matchWithScore = match as MatchWithOptionalScore;
            const homeScore = getScoreValue(matchWithScore, "home");
            const awayScore = getScoreValue(matchWithScore, "away");
            const hasScore = homeScore !== null && awayScore !== null;
            const finalResult = getMatchResult(matchWithScore);
            const hasFinishedSettlementFieldGap =
              isFinished &&
              hasScore &&
              (matchWithScore.regular_home_score === null ||
                matchWithScore.regular_away_score === null ||
                matchWithScore.betting_result === null);
            const normalizedResult = normalizeMatchResult(finalResult);
            const homeIsWinner = normalizedResult === "home_win";
            const awayIsWinner = normalizedResult === "away_win";
            const isDraw = normalizedResult === "draw";
            const stageLabel = getMatchStageLabel(match.stage);
            const stageCardClass = getMatchStageCardClass(match.stage);
            const stageHeaderClass = getMatchStageHeaderClass(match.stage);
            const stageBadgeClass = getMatchStageBadgeClass(match.stage);
            const matchMarkets = marketsByMatchId.get(match.id) ?? [];
            const hasPlaceholderTeam =
              isPlaceholderTeamName(match.home_team) ||
              isPlaceholderTeamName(match.away_team);
            const h2hOptions: BetOption[] =
              hasPlaceholderTeam || !hasUsableH2hOdds(match)
                ? []
                : predictionOptions.map((option) => ({
                    marketKey: "h2h_90",
                    marketLabel: "90分钟胜平负",
                    selectionKey: option.value,
                    selectionLabel: option.label,
                    odds: match[option.oddsKey],
                    line: 0,
                  }));
            const advanceOptions: BetOption[] = matchMarkets
              .filter((market) => market.market_key === "advance")
              .map((market) => ({
                marketKey: "advance",
                marketLabel: "晋级球队",
                selectionKey: market.selection_key as BetOption["selectionKey"],
                selectionLabel: market.selection_label,
                odds: market.odds,
                line: market.line,
              }));
            const totalsOptions: BetOption[] = matchMarkets
              .filter((market) => market.market_key === "totals_90")
              .map((market) => ({
                marketKey: "totals_90",
                marketLabel: "90分钟大小球",
                selectionKey: market.selection_key as BetOption["selectionKey"],
                selectionLabel: market.selection_label,
                odds: market.odds,
                line: market.line,
              }));
            const displayPredictions = myPredictions.filter(
              (prediction) =>
                prediction.match_id === match.id &&
                isDisplayablePrediction(prediction),
            );
            const predictionSummaryBadges =
              getPredictionSummaryBadges(displayPredictions);
            const marketGroups = [
              { key: "h2h_90", label: "90分钟胜平负", options: h2hOptions },
              { key: "totals_90", label: "90分钟大小球", options: totalsOptions },
              {
                key: "advance",
                label: "晋级球队",
                options: isKnockoutStage(match.stage) ? advanceOptions : [],
              },
            ].filter((group) => group.options.length > 0);

            return (
              <article
                id={`match-${match.id}`}
                key={match.id}
                className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-white ${stageCardClass} ${
                  isBettingClosed ? "opacity-85" : ""
                } ${
                  targetMatchId === match.id
                    ? "ring-4 ring-[#f6c84c] ring-offset-4 ring-offset-[#f6f1e7]"
                    : ""
                }`}
              >
                <div className={`${stageHeaderClass} p-4 text-white`}>
                  <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${stageBadgeClass}`}>
                      {stageLabel}
                    </p>
                    <h2 className="text-xl font-black">
                      <span className="flex flex-wrap items-center gap-2">
                        <CountryDisplay team={match.home_team} />
                        <span className="rounded-full bg-[#e63535] px-2 py-1 text-xs">
                          VS
                        </span>
                        <CountryDisplay team={match.away_team} />
                      </span>
                    </h2>
                    <p className="mt-2 text-sm font-bold text-[#d9e2ec]">
                      {formatMatchTime(match.start_time)}
                    </p>
                    <p className="mt-1 text-xs font-black text-white/80">
                      比赛状态：
                      {matchStatusLabel}
                    </p>
                  </div>
                  {predictionSummaryBadges.length > 0 ? (
                    <div className="flex max-w-[44%] shrink-0 flex-col items-end gap-1 sm:max-w-[38%]">
                      {predictionSummaryBadges.map((badge) => (
                        <span
                          key={badge.marketKey}
                          className="max-w-full truncate rounded-full bg-[#f6c84c] px-2.5 py-1 text-[10px] font-black leading-none text-[#071b3a] shadow-sm sm:text-xs"
                          title={badge.label}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  </div>
                </div>

                {isFinished ? (
                  <div className="mx-4 mt-4 rounded-2xl bg-[#071b3a] p-4 text-white shadow-[0_14px_34px_rgba(7,27,58,0.18)]">
                    <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#f6c84c]">
                      Final Score
                    </p>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div
                        className={`rounded-xl p-3 text-center ${
                          homeIsWinner || isDraw
                            ? "bg-[#f6c84c] text-[#071b3a]"
                            : "bg-white/12 text-white"
                        }`}
                      >
                        <p className="truncate text-xs font-black">
                          <CountryDisplay team={match.home_team} />
                        </p>
                        <p className="mt-2 text-4xl font-black">
                          {hasScore ? homeScore : "-"}
                        </p>
                      </div>
                      <div className="text-2xl font-black text-[#f6c84c]">-</div>
                      <div
                        className={`rounded-xl p-3 text-center ${
                          awayIsWinner || isDraw
                            ? "bg-[#f6c84c] text-[#071b3a]"
                            : "bg-white/12 text-white"
                        }`}
                      >
                        <p className="truncate text-xs font-black">
                          <CountryDisplay team={match.away_team} />
                        </p>
                        <p className="mt-2 text-4xl font-black">
                          {hasScore ? awayScore : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#071b3a]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>最终比分：</span>
                        <CountryDisplay team={match.home_team} />
                        <span className="text-lg text-[#e63535]">
                          {hasScore ? `${homeScore}：${awayScore}` : "-：-"}
                        </span>
                        <CountryDisplay team={match.away_team} />
                      </div>
                      <p className="mt-1">
                        最终结果：
                        {finalResult
                          ? (matchResultLabels[finalResult] ?? "待公布")
                          : hasFinishedSettlementFieldGap
                            ? "赛果字段待补齐"
                            : "待公布"}
                      </p>
                      <p className="mt-1">
                        赛果状态：
                        {finalResult
                          ? "已结算"
                          : hasFinishedSettlementFieldGap
                            ? "待补齐90分钟结果"
                            : "待结算"}
                      </p>
                    </div>
                    {hasFinishedSettlementFieldGap ? (
                      <div className="mt-3 rounded-xl border border-[#f6c84c]/70 bg-[#fff8db] px-4 py-3 text-sm font-black text-[#071b3a]">
                        赛果字段待补齐，请管理员录入90分钟结果后结算竞猜。
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isBettingClosed && !isFinished ? (
                  <div className="mx-4 mt-4 rounded-[14px] bg-[#edf1f5] px-4 py-[14px] text-sm font-black text-[#334e68]">
                    <p className="text-base text-[#071b3a]">
                      {isInProgress ? "比赛进行中" : "投注已关闭"}
                    </p>
                    <p className="mt-1 text-[#52606d]">
                      投注已冻结，无法再下注
                    </p>
                  </div>
                ) : null}

                {displayPredictions.length > 0 ? (
                  <div className="mx-4 mt-4 space-y-2">
                    {displayPredictions.map((prediction) => {
                      const statusLabel =
                        settlementStatusLabels[
                          normalizePredictionStatus(prediction.status)
                        ] ?? "已结算";

                      return (
                        <div
                          key={prediction.id}
                          className="rounded-xl border border-[#f6c84c]/60 bg-[#fff8db] p-3 text-sm font-black text-[#071b3a]"
                        >
                          <p>
                            你已下注：
                            {prediction.market_label ?? "90分钟胜平负"} ·{" "}
                            {prediction.selection_label ??
                              predictionLabels[prediction.prediction]}{" "}
                            {prediction.stake} 金币
                          </p>
                          {isFinished ? (
                            <>
                              <p className="mt-1 text-[#0f7b3f]">
                                赛果状态：{statusLabel}
                              </p>
                              <p className="mt-1">
                                实际获得：{prediction.payout ?? 0} 金币
                              </p>
                              <p className="mt-1">
                                本场积分：{prediction.points ?? 0}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1">
                              预计返还：
                              {Math.round(
                                prediction.stake *
                                  prediction.odds_at_prediction,
                              )}{" "}
                              金币
                            </p>
                          )}
                          {!isBettingClosed &&
                          isActivePrediction(prediction) ? (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => cancelPrediction(match, prediction)}
                                disabled={isSubmitting}
                                className="h-10 rounded-xl border border-[#e63535] bg-white px-4 text-sm font-black text-[#e63535]"
                              >
                                撤回投注
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {!isBettingClosed && hasPlaceholderTeam ? (
                  <div className="mx-4 mt-4 rounded-[14px] bg-[#edf1f5] px-4 py-[14px] text-sm font-black text-[#334e68]">
                    <p className="text-base text-[#071b3a]">对阵待确认</p>
                    <p className="mt-1 text-[#52606d]">暂不可下注</p>
                  </div>
                ) : null}

                {!isBettingClosed && !hasPlaceholderTeam ? (
                  <div className="space-y-3 px-4 pb-4 pt-4">
                    {isKnockoutStage(match.stage) ? (
                      <p className="rounded-xl bg-[#071b3a]/8 px-3 py-2 text-xs font-black text-[#334e68]">
                        胜平负和大小球按90分钟结算，晋级投注按最终晋级结算
                      </p>
                    ) : null}
                    {marketGroups.map((group) => {
                      const existingMarketPrediction =
                        predictionsByMatchMarket.get(`${match.id}:${group.key}`);

                      return (
                        <div key={group.key}>
                          <p className="mb-2 text-xs font-black text-[#52606d]">
                            {group.label}
                          </p>
                          <div
                            className={`grid gap-3 ${
                              group.options.length === 2
                                ? "grid-cols-2"
                                : "grid-cols-3"
                            }`}
                          >
                            {group.options.map((option) => {
                              const isSelected =
                                existingMarketPrediction?.selection_key ===
                                  option.selectionKey ||
                                existingMarketPrediction?.prediction ===
                                  option.selectionKey;
                              const hasNoCoins =
                                (player?.coins ?? 0) <= 0 &&
                                !existingMarketPrediction;
                              const buttonClass = existingMarketPrediction
                                ? isSelected
                                  ? "border-[#f6c84c] bg-[#fff3bf] text-[#071b3a] ring-2 ring-[#f6c84c]/70"
                                  : "border-[#d9c8a4] bg-[#f6f1e7] text-[#071b3a] opacity-70"
                                : hasNoCoins
                                  ? "border-[#cbd2d9] bg-[#e4e7eb] text-[#829ab1] opacity-70"
                                  : "border-[#d9c8a4] bg-[#f6f1e7] text-[#071b3a] hover:border-[#f6c84c] hover:bg-[#fff8db] hover:shadow-md";

                              return (
                                <button
                                  key={`${option.marketKey}:${option.selectionKey}:${option.line}`}
                                  type="button"
                                  disabled={!playerId || isSubmitting || hasNoCoins}
                                  onClick={() => openBetPanel(match, option)}
                                  className={`relative min-h-[76px] rounded-2xl border px-2 py-3 text-center leading-tight shadow-sm transition disabled:cursor-not-allowed ${buttonClass}`}
                                >
                                  {isSelected ? (
                                    <span className="absolute right-2 top-2 rounded-full bg-[#0f7b3f] px-2 py-0.5 text-[10px] font-black text-white">
                                      已选
                                    </span>
                                  ) : null}
                                  <span className="block text-sm font-black sm:text-base">
                                    {isSubmitting
                                      ? "提交中"
                                      : option.selectionLabel}
                                  </span>
                                  <span className="mt-2 block text-2xl font-black sm:text-3xl">
                                    {option.odds}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </article>
            );
          })}
        </div>
      </section>

      {bettingMatch && bettingOption ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 px-4 py-5 sm:items-center">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <p className="wc-kicker">Chip Bet</p>
            <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
              下注金币
            </h2>
            <div className="mt-4 rounded-xl bg-[#f6f1e7] p-4 text-sm font-bold text-[#071b3a]">
              <p>
                玩法：{bettingOption.marketLabel}
              </p>
              <p className="mt-1">
                选择：{bettingOption.selectionLabel} · 赔率：
                {bettingOption.odds}
              </p>
              <p className="mt-1">我的金币余额：{player?.coins ?? 0}</p>
              <p className="mt-1">本次可用金币：{bettingAvailableCoins}</p>
            </div>
            <label className="mt-4 block">
              <span className="wc-label">下注金币</span>
              <input
                value={stakeInput}
                onChange={(event) => setStakeInput(event.target.value)}
                type="number"
                min="1"
                max={bettingAvailableCoins}
                className="wc-input mt-2"
              />
            </label>
            <p className="mt-3 text-sm font-bold text-[#334e68]">
              预计收益：
              {Math.round((Number(stakeInput) || 0) * bettingOption.odds)}{" "}
              金币
            </p>
            {betError ? (
              <p className="mt-3 rounded-xl bg-[#fde8e8] px-3 py-2 text-sm font-bold text-[#9b1c1c]">
                {betError}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBettingMatch(null);
                  setBettingOption(null);
                  setBetError("");
                }}
                disabled={Boolean(submittingMatchId)}
                className="wc-button-secondary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitPrediction}
                disabled={Boolean(submittingMatchId)}
                className="wc-button"
              >
                {submittingMatchId ? "下注中..." : "确认下注"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
