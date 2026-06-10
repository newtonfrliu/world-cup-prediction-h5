"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Leaderboard
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              排行榜
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
          >
            首页
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
            加载排行榜中...
          </div>
        ) : null}

        {!loading && rows.length === 0 ? (
          <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
            暂无排行数据。
          </div>
        ) : null}

        <div className="space-y-3">
          {rows.map((row, index) => (
            <article
              key={`${row.nickname}-${row.country}-${row.region}-${index}`}
              className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d64545] text-base font-black text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-[#102a43]">
                      {row.nickname}
                    </h2>
                    <p className="mt-1 text-sm text-[#627d98]">
                      {row.country} · {row.region}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-[#627d98]">总积分</p>
                  <p className="mt-1 text-2xl font-black text-[#102a43]">
                    {Math.round(row.total_points)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
