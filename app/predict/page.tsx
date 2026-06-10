"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTeamDisplayName } from "@/lib/teamMeta";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type PredictionChoice =
  Database["public"]["Tables"]["predictions"]["Insert"]["prediction"];
type MyPrediction = Pick<
  Prediction,
  "id" | "match_id" | "prediction" | "odds_at_prediction" | "points"
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

export default function PredictPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictedMatchIds, setPredictedMatchIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [myPredictions, setMyPredictions] = useState<MyPrediction[]>([]);
  const [showMyPredictions, setShowMyPredictions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");

  const hasMatches = matches.length > 0;
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
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
        "id, match_id, prediction, odds_at_prediction, points, matches(home_team, away_team, start_time, status, result)",
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

      if (storedPlayerId) {
        await loadMyPredictions(storedPlayerId);
      }

      setLoading(false);
    }

    loadMatches();
  }, [canUseSupabase]);

  async function submitPrediction(match: Match, option: PredictionChoice) {
    if (!playerId) {
      setError("请先在首页创建玩家。");
      return;
    }

    if (predictedMatchIds.has(match.id) || submittingMatchId) {
      return;
    }

    const selectedOption = predictionOptions.find(
      (item) => item.value === option,
    );

    if (!selectedOption) {
      return;
    }

    setSubmittingMatchId(match.id);
    setError("");

    const { error: insertError } = await supabase.from("predictions").insert({
      player_id: playerId,
      match_id: match.id,
      prediction: option,
      odds_at_prediction: match[selectedOption.oddsKey],
    });

    if (insertError) {
      setError(insertError.message);
      setSubmittingMatchId(null);
      return;
    }

    setPredictedMatchIds((current) => new Set(current).add(match.id));
    setSubmittingMatchId(null);
    await loadMyPredictions(playerId);
  }

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Match List
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              预测比赛
            </h1>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/"
              className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-center text-sm font-semibold text-[#334e68]"
            >
              首页
            </Link>
            <Link
              href="/profile"
              className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-center text-sm font-semibold text-[#334e68]"
            >
              我的战绩
            </Link>
          </div>
        </div>

        {!playerId ? (
          <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            请先返回首页创建玩家，再进行预测。
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowMyPredictions((current) => !current)}
          className="mb-5 h-11 w-full rounded-md border border-[#cbd2d9] bg-white px-4 text-sm font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
        >
          我的预测
        </button>

        {showMyPredictions ? (
          <div className="mb-5 space-y-3">
            {myPredictions.length === 0 ? (
              <div className="rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm text-[#52606d]">
                暂无预测记录。
              </div>
            ) : null}

            {myPredictions.map((prediction) => {
              const match = prediction.matches;

              return (
                <article
                  key={prediction.id}
                  className="rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm shadow-sm"
                >
                  <h2 className="text-base font-black text-[#102a43]">
                    {match
                      ? `${getTeamDisplayName(match.home_team)} VS ${getTeamDisplayName(match.away_team)}`
                      : "未知比赛"}
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
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
            加载比赛中...
          </div>
        ) : null}

        {!loading && !hasMatches ? (
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
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
                className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#102a43]">
                      {getTeamDisplayName(match.home_team)} VS{" "}
                      {getTeamDisplayName(match.away_team)}
                    </h2>
                    <p className="mt-2 text-sm text-[#627d98]">
                      {formatMatchTime(match.start_time)}
                    </p>
                  </div>
                  {isPredicted ? (
                    <span className="shrink-0 rounded-md bg-[#d64545] px-2 py-1 text-xs font-bold text-white">
                      已预测：
                      {selectedPrediction
                        ? predictionLabels[selectedPrediction]
                        : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-[#f0f4f8] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">主胜</p>
                    <p className="mt-1 text-[#102a43]">{match.odds_home}</p>
                  </div>
                  <div className="rounded-md bg-[#f0f4f8] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">平局</p>
                    <p className="mt-1 text-[#102a43]">{match.odds_draw}</p>
                  </div>
                  <div className="rounded-md bg-[#f0f4f8] px-2 py-3">
                    <p className="font-semibold text-[#334e68]">客胜</p>
                    <p className="mt-1 text-[#102a43]">{match.odds_away}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {predictionOptions.map((option) => {
                    const isSelected = selectedPrediction === option.value;
                    const buttonClass = isPredicted
                      ? isSelected
                        ? "bg-[#102a43] text-white ring-2 ring-[#d64545]"
                        : "bg-[#e4e7eb] text-[#829ab1]"
                      : "bg-[#d64545] text-white hover:bg-[#ba2525]";

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!playerId || isPredicted || isSubmitting}
                        onClick={() => submitPrediction(match, option.value)}
                        className={`h-11 rounded-md px-2 text-sm font-bold transition disabled:cursor-not-allowed ${buttonClass}`}
                      >
                        {isSubmitting ? "提交中" : option.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
