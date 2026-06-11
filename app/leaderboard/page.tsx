"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);

  useEffect(() => {
    async function loadLeaderboard() {
      if (!canUseSupabase) {
        setError("请先配置 Supabase 环境变量。");
        setLoading(false);
        return;
      }

      const { data, error: leaderboardError } = await supabase
        .from("leaderboard")
        .select("nickname, country, region, total_points")
        .order("total_points", { ascending: false });

      if (leaderboardError) {
        setError(leaderboardError.message);
        setLoading(false);
        return;
      }

      setRows(data ?? []);
      setLoading(false);
    }

    loadLeaderboard();
  }, [canUseSupabase]);

  return (
    <main className="wc-page px-4 py-6">
      <section className="wc-shell">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="wc-kicker">
              King Ranking
            </p>
            <h1 className="wc-title mt-2">
              球王榜
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

        {error ? (
          <div className="mb-5 rounded-xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="wc-card p-5 text-sm text-[#52606d]">
            加载排行榜中...
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <div className="wc-card p-5 text-sm text-[#52606d]">
            暂无排行数据。
          </div>
        ) : null}

        <div className="space-y-3">
          {rows.map((row, index) => {
            const rankStyle =
              index === 0
                ? "bg-[#f6c84c] text-[#071b3a]"
                : index === 1
                  ? "bg-[#d7dde8] text-[#071b3a]"
                  : index === 2
                    ? "bg-[#c58b58] text-white"
                    : "bg-[#071b3a] text-white";

            return (
            <article
              key={`${row.nickname}-${row.country}-${row.region}-${index}`}
              className={`rounded-2xl border p-4 shadow-sm ${
                index < 3
                  ? "border-[#f6c84c]/60 bg-[#071b3a] text-white"
                  : "border-[#071b3a]/10 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black ${rankStyle}`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h2 className={`truncate text-lg font-black ${index < 3 ? "text-white" : "text-[#071b3a]"}`}>
                      {row.nickname}
                    </h2>
                    <p className={`mt-1 text-sm font-bold ${index < 3 ? "text-[#f6c84c]" : "text-[#627d98]"}`}>
                      <CountryDisplay team={row.country} />
                      <span className="ml-2">· {row.region}</span>
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-bold ${index < 3 ? "text-[#25c7b7]" : "text-[#627d98]"}`}>总积分</p>
                  <p className={`mt-1 text-2xl font-black ${index < 3 ? "text-white" : "text-[#071b3a]"}`}>
                    {Math.round(row.total_points)}
                  </p>
                </div>
              </div>
            </article>
          )})}
        </div>
      </section>
    </main>
  );
}
