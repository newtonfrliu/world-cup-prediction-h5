"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type MatchResult = NonNullable<Match["result"]>;

const resultOptions: Array<{ label: string; value: MatchResult }> = [
  { label: "主胜", value: "home_win" },
  { label: "平局", value: "draw" },
  { label: "客胜", value: "away_win" },
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

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settlingMatchId, setSettlingMatchId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  async function loadMatches() {
    if (!canUseSupabase) {
      setError("请先配置 Supabase 环境变量。");
      setLoading(false);
      return;
    }

    const { data, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, home_team, away_team, start_time, odds_home, odds_draw, odds_away, result, status, created_at",
      )
      .order("start_time", { ascending: true });

    if (matchError) {
      setError(matchError.message);
      setLoading(false);
      return;
    }

    setMatches(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setIsVerified(localStorage.getItem("admin_verified") === "true");
  }, []);

  useEffect(() => {
    if (!isVerified) {
      return;
    }

    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseSupabase, isVerified]);

  function verifyAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === adminPassword) {
      localStorage.setItem("admin_verified", "true");
      setIsVerified(true);
      setPasswordError("");
      return;
    }

    setPasswordError("密码错误");
  }

  async function settleMatch(match: Match, result: MatchResult) {
    if (settlingMatchId) {
      return;
    }

    setSettlingMatchId(match.id);
    setError("");
    setMessage("");

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        result,
        status: "finished",
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      setError(matchUpdateError.message);
      setSettlingMatchId(null);
      return;
    }

    const { data: predictions, error: predictionLoadError } = await supabase
      .from("predictions")
      .select("id, player_id, match_id, prediction, odds_at_prediction, points, created_at")
      .eq("match_id", match.id);

    if (predictionLoadError) {
      setError(predictionLoadError.message);
      setSettlingMatchId(null);
      return;
    }

    const updates = ((predictions ?? []) as Prediction[]).map((prediction) =>
      supabase
        .from("predictions")
        .update({
          points:
            prediction.prediction === result
              ? prediction.odds_at_prediction
              : 0,
        })
        .eq("id", prediction.id),
    );

    const updateResults = await Promise.all(updates);
    const failedUpdate = updateResults.find((item) => item.error);

    if (failedUpdate?.error) {
      setError(failedUpdate.error.message);
      setSettlingMatchId(null);
      return;
    }

    setMatches((current) =>
      current.map((item) =>
        item.id === match.id ? { ...item, result, status: "finished" } : item,
      ),
    );
    setMessage("结算完成，排行榜积分会自动更新。");
    setSettlingMatchId(null);
  }

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-xl">
        {!isVerified ? (
          <div className="flex min-h-[calc(100vh-3rem)] flex-col justify-center">
            <h1 className="text-3xl font-black text-[#102a43]">管理员验证</h1>
            <form onSubmit={verifyAdmin} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-[#334e68]">
                  请输入管理员密码
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="mt-2 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-4 text-base outline-none transition focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
                  placeholder="请输入管理员密码"
                />
              </label>

              {passwordError ? (
                <p className="rounded-md bg-[#fde8e8] px-3 py-2 text-sm text-[#9b1c1c]">
                  {passwordError}
                </p>
              ) : null}

              <button
                type="submit"
                className="h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525]"
              >
                进入后台
              </button>
            </form>
          </div>
        ) : (
          <>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              比赛结算
            </h1>
          </div>
          <Link
            href="/leaderboard"
            className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
          >
            排行榜
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mb-5 rounded-lg border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm text-[#0f7b3f]">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
            加载比赛中...
          </div>
        ) : null}

        {!loading && matches.length === 0 ? (
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
            暂无比赛。
          </div>
        ) : null}

        <div className="space-y-4">
          {matches.map((match) => {
            const isSettling = settlingMatchId === match.id;
            const isFinished = match.status === "finished";

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
                  {isFinished ? (
                    <span className="shrink-0 rounded-md bg-[#e3f9e5] px-2 py-1 text-xs font-bold text-[#0f7b3f]">
                      已结束
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {resultOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={Boolean(settlingMatchId)}
                      onClick={() => settleMatch(match, option.value)}
                      className="h-11 rounded-md bg-[#d64545] px-2 text-sm font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
                    >
                      {isSettling ? "结算中" : option.label}
                    </button>
                  ))}
                </div>

                {match.result ? (
                  <p className="mt-3 text-sm text-[#627d98]">
                    当前结果：
                    {
                      resultOptions.find((option) => option.value === match.result)
                        ?.label
                    }
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
          </>
        )}
      </section>
    </main>
  );
}
