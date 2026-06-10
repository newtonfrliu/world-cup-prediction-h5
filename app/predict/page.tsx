"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type PredictionChoice =
  Database["public"]["Tables"]["predictions"]["Insert"]["prediction"];

const predictionOptions: Array<{
  label: string;
  value: PredictionChoice;
  oddsKey: "odds_home" | "odds_draw" | "odds_away";
}> = [
  { label: "主胜", value: "home_win", oddsKey: "odds_home" },
  { label: "平局", value: "draw", oddsKey: "odds_draw" },
  { label: "客胜", value: "away_win", oddsKey: "odds_away" },
];

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
  const [loading, setLoading] = useState(true);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");

  const hasMatches = matches.length > 0;
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);

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
        const { data: predictionData, error: predictionError } = await supabase
          .from("predictions")
          .select("match_id")
          .eq("player_id", storedPlayerId);

        if (predictionError) {
          setError(predictionError.message);
          setLoading(false);
          return;
        }

        setPredictedMatchIds(
          new Set((predictionData ?? []).map((item) => item.match_id)),
        );
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
          <Link
            href="/"
            className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
          >
            首页
          </Link>
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

            return (
              <article
                key={match.id}
                className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#102a43]">
                      {match.home_team} VS {match.away_team}
                    </h2>
                    <p className="mt-2 text-sm text-[#627d98]">
                      {formatMatchTime(match.start_time)}
                    </p>
                  </div>
                  {isPredicted ? (
                    <span className="shrink-0 rounded-md bg-[#e3f9e5] px-2 py-1 text-xs font-bold text-[#0f7b3f]">
                      已预测
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
                  {predictionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!playerId || isPredicted || isSubmitting}
                      onClick={() => submitPrediction(match, option.value)}
                      className="h-11 rounded-md bg-[#d64545] px-2 text-sm font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
                    >
                      {isSubmitting ? "提交中" : option.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
