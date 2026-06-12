"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CountryDisplay } from "@/components/CountryDisplay";
import { getStoredPlayerId } from "@/lib/playerSession";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getCountryTheme } from "@/lib/countries";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
type MatchState = "not_started" | "in_progress" | "finished";
type PredictionChoice =
  Database["public"]["Tables"]["predictions"]["Insert"]["prediction"];
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
> & {
  matches: Pick<
    Match,
    "home_team" | "away_team" | "start_time" | "status" | "result"
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

const matchResultLabels: Record<PredictionChoice, string> = predictionLabels;

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

function formatOddsSyncTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}`;
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
  const [predictedMatchIds, setPredictedMatchIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Pick<
    Player,
    "id" | "country" | "coins"
  > | null>(null);
  const [myPredictions, setMyPredictions] = useState<MyPrediction[]>([]);
  const [showMyPredictions, setShowMyPredictions] = useState(false);
  const [bettingMatch, setBettingMatch] = useState<Match | null>(null);
  const [bettingOption, setBettingOption] = useState<
    (typeof predictionOptions)[number] | null
  >(null);
  const [stakeInput, setStakeInput] = useState("50");
  const [lastOddsSync, setLastOddsSync] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [betError, setBetError] = useState("");
  const [toast, setToast] = useState("");

  const hasMatches = matches.length > 0;
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const playerTheme = getCountryTheme(player?.country);
  const selectedBetTextColor =
    playerTheme.accent.toLowerCase() === "#071b3a" ? "#ffffff" : "#071b3a";
  const predictionsByMatchId = useMemo(() => {
    return new Map(
      myPredictions.map((prediction) => [prediction.match_id, prediction]),
    );
  }, [myPredictions]);
  const bettingExistingPrediction = bettingMatch
    ? predictionsByMatchId.get(bettingMatch.id)
    : undefined;
  const bettingAvailableCoins =
    (player?.coins ?? 0) + (bettingExistingPrediction?.stake ?? 0);

  async function loadMyPredictions(currentPlayerId: string) {
    const queryWithStatus = supabase
      .from("predictions")
      .select(
        "id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, matches(home_team, away_team, start_time, status, result)",
      )
      .eq("player_id", currentPlayerId)
      .or("status.is.null,status.eq.active");
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
          "id, match_id, prediction, odds_at_prediction, stake, payout, points, matches(home_team, away_team, start_time, status, result)",
        )
        .eq("player_id", currentPlayerId);

      if (fallbackError) {
        console.error("loadMyPredictions fallback failed", {
          playerId: currentPlayerId,
          error: fallbackError,
        });
        throw fallbackError;
      }

      const fallbackPredictions = ((fallbackData ?? []) as Omit<
        MyPrediction,
        "status" | "settled_at"
      >[]).map((prediction) => ({
        ...prediction,
        status: "active",
        settled_at: null,
      })) as MyPrediction[];

      setMyPredictions(fallbackPredictions);
      setPredictedMatchIds(
        new Set(fallbackPredictions.map((item) => item.match_id)),
      );
      return;
    }

    const predictions = ((data ?? []) as MyPrediction[]).map((prediction) => ({
      ...prediction,
      status: prediction.status ?? "active",
    }));

    setMyPredictions(predictions);
    setPredictedMatchIds(new Set(predictions.map((item) => item.match_id)));
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
        "id, home_team, away_team, start_time, odds_home, odds_draw, odds_away, stage, venue, result, status, created_at",
      )
      .order("start_time", { ascending: true });

    if (matchError) {
      console.error("refreshMatches failed", { error: matchError });
      throw matchError;
    }

    setMatches(data ?? []);
  }

  async function refreshPredictionState(currentPlayerId: string) {
    await Promise.all([
      refreshPlayer(currentPlayerId),
      loadMyPredictions(currentPlayerId),
      refreshMatches(),
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
          "id, home_team, away_team, start_time, odds_home, odds_draw, odds_away, stage, venue, result, status, created_at",
        )
        .order("start_time", { ascending: true });

      if (matchError) {
        setError(matchError.message);
        setLoading(false);
        return;
      }

      setMatches(matchData ?? []);

      const { data: settingData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "last_odds_sync")
        .maybeSingle();

      setLastOddsSync(settingData?.value ?? "");

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

  function openBetPanel(match: Match, option: (typeof predictionOptions)[number]) {
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

  async function insertPredictionWithFallback({
    match,
    selectedOption,
    stake,
  }: {
    match: Match;
    selectedOption: (typeof predictionOptions)[number];
    stake: number;
  }) {
    const payload = {
      player_id: playerId as string,
      match_id: match.id,
      prediction: selectedOption.value,
      odds_at_prediction: match[selectedOption.oddsKey],
      stake,
      payout: 0,
      status: "active",
    };
    const { error: insertError } = await supabase
      .from("predictions")
      .insert(payload);

    if (!insertError) {
      return;
    }

    if (!isMissingPredictionStatusError(insertError)) {
      console.error("prediction insert failed", { payload, error: insertError });
      throw new Error(`预测保存失败：${insertError.message}`);
    }

    console.error("prediction insert fallback without status", {
      payload,
      error: insertError,
    });

    const fallbackPayload: Omit<typeof payload, "status"> = {
      player_id: payload.player_id,
      match_id: payload.match_id,
      prediction: payload.prediction,
      odds_at_prediction: payload.odds_at_prediction,
      stake: payload.stake,
      payout: payload.payout,
    };
    const { error: fallbackError } = await supabase
      .from("predictions")
      .insert(fallbackPayload);

    if (fallbackError) {
      console.error("prediction insert fallback failed", {
        payload: fallbackPayload,
        error: fallbackError,
      });
      throw new Error(`预测保存失败：${fallbackError.message}`);
    }
  }

  async function cancelPredictionRecord(prediction: MyPrediction) {
    const { error: cancelError } = await supabase
      .from("predictions")
      .update({ status: "cancelled" })
      .eq("id", prediction.id);

    if (!cancelError) {
      return;
    }

    if (!isMissingPredictionStatusError(cancelError)) {
      console.error("prediction cancel failed", {
        prediction,
        error: cancelError,
      });
      throw new Error(`撤单失败：${cancelError.message}`);
    }

    console.error("prediction cancel fallback delete", {
      prediction,
      error: cancelError,
    });

    const { error: deleteError } = await supabase
      .from("predictions")
      .delete()
      .eq("id", prediction.id);

    if (deleteError) {
      console.error("prediction cancel fallback delete failed", {
        prediction,
        error: deleteError,
      });
      throw new Error(`撤单失败：${deleteError.message}`);
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

    const existingPrediction = predictionsByMatchId.get(match.id);
    const availableCoins = player.coins + (existingPrediction?.stake ?? 0);

    if (stake > availableCoins) {
      setBetError("金币不足。");
      return;
    }

    setSubmittingMatchId(match.id);
    setError("");
    setBetError("");
    setToast("");

    try {
      await insertPredictionWithFallback({ match, selectedOption, stake });

      if (existingPrediction) {
        await cancelPredictionRecord(existingPrediction);
      }

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
          stake * match[selectedOption.oddsKey],
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

        <div
          className="mb-5 rounded-full border bg-white px-4 py-3 text-sm font-black text-readable shadow-sm"
          style={{
            borderColor: playerTheme.accent,
            boxShadow: playerTheme.glow,
          }}
        >
          <span className="text-[#e63535]">ODDS TICKER</span> ·
          赔率更新时间：
          {lastOddsSync ? formatOddsSyncTime(lastOddsSync) : "暂无同步记录"}
        </div>
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

              return (
                <article
                  key={prediction.id}
                  className="wc-card p-4 text-sm"
                >
                  <h2 className="text-base font-black text-[#102a43]">
                    {match ? (
                      <span className="flex items-center gap-2">
                        <CountryDisplay team={match.home_team} />
                        <span className="text-[#e63535]">VS</span>
                        <CountryDisplay team={match.away_team} />
                      </span>
                    ) : (
                      "未知比赛"
                    )}
                  </h2>
                  <p className="mt-2 text-[#627d98]">
                    开赛时间：
                    {match ? formatMatchTime(match.start_time) : "-"}
                  </p>
                  <p className="mt-1 text-[#627d98]">
                    我的选择：{predictionLabels[prediction.prediction]}
                  </p>
                  <p className="mt-1 text-[#627d98]">
                    预测时赔率：{prediction.odds_at_prediction}
                  </p>
                  <p className="mt-1 text-[#627d98]">
                    下注金币：{prediction.stake}
                  </p>
                  <p className="mt-1 text-[#627d98]">
                    返还金币：{prediction.payout}
                  </p>
                  <p className="mt-1 text-[#627d98]">
                    比赛状态：{match?.status ?? "-"}
                  </p>
                  <p className="mt-1 text-[#102a43]">
                    当前得分：{prediction.points ?? 0}
                  </p>
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

        <div className="space-y-4">
          {matches.map((match) => {
            const isPredicted = predictedMatchIds.has(match.id);
            const isSubmitting = submittingMatchId === match.id;
            const selectedPrediction = predictionsByMatchId.get(match.id);
            const selectedPredictionValue = selectedPrediction?.prediction;
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

            return (
              <article
                key={match.id}
                className={`overflow-hidden rounded-2xl border border-[#071b3a]/15 bg-white shadow-[0_14px_30px_rgba(7,27,58,0.1)] ${
                  isBettingClosed ? "opacity-85" : ""
                }`}
              >
                <div className="bg-[#071b3a] p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#d9e2ec]">
                      Match Card / {match.stage ?? "小组赛"}
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
                  {isPredicted ? (
                    <span className="shrink-0 rounded-full bg-[#f6c84c] px-3 py-1 text-xs font-black text-[#071b3a]">
                      已预测：
                      {selectedPrediction
                        ? predictionLabels[selectedPrediction.prediction]
                        : ""}
                    </span>
                  ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 p-4 text-center text-sm">
                  <div className="min-w-0 rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">主胜</p>
                    <p className="mt-1 text-xl font-black text-[#071b3a] sm:text-2xl">{match.odds_home}</p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">平局</p>
                    <p className="mt-1 text-xl font-black text-[#071b3a] sm:text-2xl">{match.odds_draw}</p>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">客胜</p>
                    <p className="mt-1 text-xl font-black text-[#071b3a] sm:text-2xl">{match.odds_away}</p>
                  </div>
                </div>

                {isBettingClosed ? (
                  <div className="mx-4 mt-4 rounded-[14px] bg-[#edf1f5] px-4 py-[14px] text-sm font-black text-[#334e68]">
                    {isFinished ? (
                      <>
                        <p>赛果状态：已结算</p>
                        <p className="mt-1">
                          最终结果：
                          {match.result
                            ? matchResultLabels[match.result]
                            : "待公布"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base text-[#071b3a]">
                          {isInProgress ? "比赛进行中" : "投注已关闭"}
                        </p>
                        <p className="mt-1 text-[#52606d]">
                          投注已冻结，无法再下注
                        </p>
                      </>
                    )}
                  </div>
                ) : null}

                {selectedPrediction ? (
                  <div className="mx-4 mt-4 rounded-xl border border-[#f6c84c]/60 bg-[#fff8db] p-3 text-sm font-black text-[#071b3a]">
                    <p>
                      你已下注：
                      {predictionLabels[selectedPrediction.prediction]}{" "}
                      {selectedPrediction.stake} 金币
                    </p>
                    <p className="mt-1">
                      预计返还：
                      {Math.round(
                        selectedPrediction.stake *
                          selectedPrediction.odds_at_prediction,
                      )}{" "}
                      金币
                    </p>
                    {!isBettingClosed ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => cancelPrediction(match, selectedPrediction)}
                          disabled={isSubmitting}
                          className="h-10 rounded-xl border border-[#e63535] bg-white text-sm font-black text-[#e63535]"
                        >
                          撤回投注
                        </button>
                        <button
                          type="button"
                          onClick={() => openBetPanel(match, predictionOptions[0])}
                          disabled={isSubmitting}
                          className="h-10 rounded-xl bg-[#071b3a] text-sm font-black text-white"
                        >
                          重新下注
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!isBettingClosed ? (
                  <div className="grid grid-cols-3 gap-3 px-4 pb-4 pt-4">
                    {predictionOptions.map((option) => {
                      const isSelected = selectedPredictionValue === option.value;
                      const hasNoCoins = (player?.coins ?? 0) <= 0 && !selectedPrediction;
                      const buttonClass = isPredicted
                        ? isSelected
                          ? "ring-2 ring-[#071b3a]"
                          : "bg-[#e4e7eb] text-[#829ab1]"
                        : hasNoCoins
                          ? "bg-[#e4e7eb] text-[#829ab1]"
                          : "bg-[#e63535] text-white hover:bg-[#ba2525]";

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!playerId || isSubmitting || hasNoCoins}
                          onClick={() => openBetPanel(match, option)}
                          className={`min-h-11 rounded-xl px-2 py-2 text-sm font-black leading-tight transition disabled:cursor-not-allowed ${buttonClass}`}
                          style={
                            isPredicted && isSelected
                              ? {
                                  background: playerTheme.accent,
                                  color: selectedBetTextColor,
                                }
                              : undefined
                          }
                        >
                          {isSubmitting
                            ? "提交中"
                            : isPredicted
                              ? isSelected
                                ? option.label
                                : `改押${option.label}`
                              : `押${option.label}`}
                        </button>
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
                选择：{predictionLabels[bettingOption.value]} · 赔率：
                {bettingMatch[bettingOption.oddsKey]}
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
              {Math.round(
                (Number(stakeInput) || 0) * bettingMatch[bettingOption.oddsKey],
              )}{" "}
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
