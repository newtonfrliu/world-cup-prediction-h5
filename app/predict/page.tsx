"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getCountryTheme } from "@/lib/countries";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
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

function formatMatchTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

export default function PredictPage() {
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

  const hasMatches = matches.length > 0;
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const playerTheme = getCountryTheme(player?.country);
  const predictionsByMatchId = useMemo(() => {
    return new Map(
      myPredictions.map((prediction) => [
        prediction.match_id,
        prediction.prediction,
      ]),
    );
  }, [myPredictions]);

  async function loadMyPredictions(currentPlayerId: string) {
    const { data, error: predictionError } = await supabase
      .from("predictions")
      .select(
        "id, match_id, prediction, odds_at_prediction, stake, payout, points, matches(home_team, away_team, start_time, status, result)",
      )
      .eq("player_id", currentPlayerId);

    if (predictionError) {
      throw predictionError;
    }

    const predictions = (data ?? []) as MyPrediction[];

    setMyPredictions(predictions);
    setPredictedMatchIds(new Set(predictions.map((item) => item.match_id)));
  }

  useEffect(() => {
    async function loadMatches() {
      const storedPlayerId = localStorage.getItem("player_id");
      setPlayerId(storedPlayerId);

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
  }, [canUseSupabase]);

  function isMatchStarted(match: Match) {
    return new Date(match.start_time).getTime() <= Date.now();
  }

  function openBetPanel(match: Match, option: (typeof predictionOptions)[number]) {
    if (isMatchStarted(match)) {
      setError("比赛已开始，不能下注。");
      return;
    }

    setBettingMatch(match);
    setBettingOption(option);
    setStakeInput("50");
    setError("");
  }

  async function submitPrediction() {
    const match = bettingMatch;
    const selectedOption = bettingOption;

    if (!match || !selectedOption) {
      return;
    }

    if (!playerId) {
      setError("请先在首页创建玩家。");
      return;
    }

    if (!player) {
      setError("请先加载玩家金币信息。");
      return;
    }

    if (predictedMatchIds.has(match.id) || submittingMatchId) {
      return;
    }

    if (isMatchStarted(match)) {
      setError("比赛已开始，不能下注。");
      return;
    }

    const stake = Number(stakeInput);

    if (!Number.isInteger(stake) || stake <= 0) {
      setError("下注金币必须大于 0。");
      return;
    }

    if (stake > player.coins) {
      setError("金币不足。");
      return;
    }

    setSubmittingMatchId(match.id);
    setError("");

    const { error: insertError } = await supabase.from("predictions").insert({
      player_id: playerId,
      match_id: match.id,
      prediction: selectedOption.value,
      odds_at_prediction: match[selectedOption.oddsKey],
      stake,
      payout: 0,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmittingMatchId(null);
      return;
    }

    const nextCoins = player.coins - stake;
    const { error: coinUpdateError } = await supabase
      .from("players")
      .update({ coins: nextCoins })
      .eq("id", playerId);

    if (coinUpdateError) {
      setError(coinUpdateError.message);
      setSubmittingMatchId(null);
      return;
    }

    setPredictedMatchIds((current) => new Set(current).add(match.id));
    setPlayer({ ...player, coins: nextCoins });
    setSubmittingMatchId(null);
    setBettingMatch(null);
    setBettingOption(null);
    await loadMyPredictions(playerId);
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

        <div
          className="mb-5 rounded-full border px-4 py-3 text-sm font-black text-white shadow-sm"
          style={{
            background: playerTheme.primary,
            borderColor: playerTheme.accent,
            boxShadow: playerTheme.glow,
          }}
        >
          <span style={{ color: playerTheme.accent }}>ODDS TICKER</span> ·
          赔率更新时间：
          {lastOddsSync ? formatOddsSyncTime(lastOddsSync) : "暂无同步记录"}
        </div>
        <div className="mb-5 rounded-2xl bg-white p-4 text-sm font-black text-[#071b3a] shadow-sm">
          我的金币：{player?.coins ?? "-"}
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

            return (
              <article
                key={match.id}
                className="overflow-hidden rounded-2xl border border-[#071b3a]/15 bg-white shadow-[0_14px_30px_rgba(7,27,58,0.1)]"
              >
                <div className="bg-[#071b3a] p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#25c7b7]">
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
                    <p className="mt-2 text-sm font-bold text-[#25c7b7]">
                      {formatMatchTime(match.start_time)}
                    </p>
                  </div>
                  {isPredicted ? (
                    <span className="shrink-0 rounded-full bg-[#f6c84c] px-3 py-1 text-xs font-black text-[#071b3a]">
                      已预测：
                      {selectedPrediction
                        ? predictionLabels[selectedPrediction]
                        : ""}
                    </span>
                  ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
                  <div className="rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">主胜</p>
                    <p className="mt-1 text-2xl font-black text-[#071b3a]">{match.odds_home}</p>
                  </div>
                  <div className="rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">平局</p>
                    <p className="mt-1 text-2xl font-black text-[#071b3a]">{match.odds_draw}</p>
                  </div>
                  <div className="rounded-xl bg-[#f6f1e7] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">客胜</p>
                    <p className="mt-1 text-2xl font-black text-[#071b3a]">{match.odds_away}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {predictionOptions.map((option) => {
                    const isSelected = selectedPrediction === option.value;
                    const hasStarted = isMatchStarted(match);
                    const buttonClass = isPredicted
                      ? isSelected
                        ? "text-white ring-2 ring-[#f6c84c]"
                        : "bg-[#e4e7eb] text-[#829ab1]"
                      : hasStarted
                        ? "bg-[#e4e7eb] text-[#829ab1]"
                        : "bg-[#e63535] text-white hover:bg-[#ba2525]";

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!playerId || isPredicted || isSubmitting || hasStarted}
                        onClick={() => openBetPanel(match, option)}
                        className={`h-11 rounded-xl px-2 text-sm font-black transition disabled:cursor-not-allowed ${buttonClass}`}
                        style={
                          isPredicted && isSelected
                            ? { background: playerTheme.accent }
                            : undefined
                        }
                      >
                        {isSubmitting
                          ? "提交中"
                          : isPredicted
                            ? option.label
                            : `押${option.label}`}
                      </button>
                    );
                  })}
                </div>
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
              <p className="mt-1">我的金币：{player?.coins ?? 0}</p>
            </div>
            <label className="mt-4 block">
              <span className="wc-label">下注金币</span>
              <input
                value={stakeInput}
                onChange={(event) => setStakeInput(event.target.value)}
                type="number"
                min="1"
                max={player?.coins ?? 0}
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
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBettingMatch(null);
                  setBettingOption(null);
                }}
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
                确认下注
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
