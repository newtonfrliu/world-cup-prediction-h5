"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTeamDisplayName } from "@/lib/teamMeta";
import type { Database } from "@/types/database";

type Player = Database["public"]["Tables"]["players"]["Row"];
type Prediction = Pick<
  Database["public"]["Tables"]["predictions"]["Row"],
  "id" | "points"
>;
type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

type ProfileStats = {
  totalPoints: number;
  globalRank: number | null;
  regionRank: number | null;
  predictionCount: number;
  hitCount: number;
  hitRate: number;
};

function buildEmptyStats(): ProfileStats {
  return {
    totalPoints: 0,
    globalRank: null,
    regionRank: null,
    predictionCount: 0,
    hitCount: 0,
    hitRate: 0,
  };
}

function formatRank(value: number | null) {
  return value ? `第 ${value} 名` : "-";
}

export default function ProfilePage() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<ProfileStats>(() => buildEmptyStats());
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);

  useEffect(() => {
    async function loadProfile() {
      const storedPlayerId = localStorage.getItem("player_id");
      setPlayerId(storedPlayerId);

      if (!storedPlayerId) {
        setLoading(false);
        return;
      }

      setShareLink(`${window.location.origin}/?ref=${storedPlayerId}`);

      if (!canUseSupabase) {
        setError("请先配置 Supabase 环境变量。");
        setLoading(false);
        return;
      }

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("id, nickname, country, region, created_at")
        .eq("id", storedPlayerId)
        .single();

      if (playerError) {
        setError(playerError.message);
        setLoading(false);
        return;
      }

      const currentPlayer = playerData as Player;
      setPlayer(currentPlayer);

      const [
        { data: leaderboardData, error: leaderboardError },
        { data: predictionData, error: predictionError },
      ] = await Promise.all([
        supabase
          .from("leaderboard")
          .select("nickname, country, region, total_points")
          .order("total_points", { ascending: false }),
        supabase
          .from("predictions")
          .select("id, points")
          .eq("player_id", storedPlayerId),
      ]);

      if (leaderboardError) {
        setError(leaderboardError.message);
        setLoading(false);
        return;
      }

      if (predictionError) {
        setError(predictionError.message);
        setLoading(false);
        return;
      }

      const leaderboard = (leaderboardData ?? []) as LeaderboardRow[];
      const predictions = (predictionData ?? []) as Prediction[];
      const playerRowIndex = leaderboard.findIndex(
        (row) =>
          row.nickname === currentPlayer.nickname &&
          row.country === currentPlayer.country &&
          row.region === currentPlayer.region,
      );
      const playerLeaderboardRow =
        playerRowIndex >= 0 ? leaderboard[playerRowIndex] : null;
      const regionRows = leaderboard.filter(
        (row) => row.region === currentPlayer.region,
      );
      const regionRowIndex = regionRows.findIndex(
        (row) =>
          row.nickname === currentPlayer.nickname &&
          row.country === currentPlayer.country,
      );
      const predictionCount = predictions.length;
      const hitCount = predictions.filter(
        (prediction) => (prediction.points ?? 0) > 0,
      ).length;

      setStats({
        totalPoints: playerLeaderboardRow?.total_points ?? 0,
        globalRank: playerRowIndex >= 0 ? playerRowIndex + 1 : null,
        regionRank: regionRowIndex >= 0 ? regionRowIndex + 1 : null,
        predictionCount,
        hitCount,
        hitRate: predictionCount > 0 ? hitCount / predictionCount : 0,
      });
      setLoading(false);
    }

    loadProfile();
  }, [canUseSupabase]);

  async function copyShareLink() {
    if (!shareLink) {
      return;
    }

    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
        <section className="mx-auto w-full max-w-xl rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
          加载我的战绩中...
        </section>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
        <section className="mx-auto w-full max-w-xl rounded-lg border border-[#d9e2ec] bg-white p-5">
          <h1 className="text-2xl font-black text-[#102a43]">我的战绩</h1>
          <p className="mt-3 text-sm text-[#52606d]">
            请先返回首页创建玩家。
          </p>
          <Link
            href="/"
            className="mt-5 flex h-11 items-center justify-center rounded-md bg-[#d64545] px-4 text-sm font-bold text-white"
          >
            返回首页
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Profile
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              我的战绩
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

        <div className="space-y-4">
          <article className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#102a43]">玩家信息</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#627d98]">昵称</dt>
                <dd className="font-bold text-[#102a43]">
                  {player?.nickname ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#627d98]">主队国家</dt>
                <dd className="font-bold text-[#102a43]">
                  {player ? getTeamDisplayName(player.country) : "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#627d98]">地区</dt>
                <dd className="font-bold text-[#102a43]">
                  {player?.region ?? "-"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-[#627d98]">player_id</dt>
                <dd className="break-all rounded-md bg-[#f0f4f8] px-3 py-2 text-xs font-semibold text-[#334e68]">
                  {playerId}
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#102a43]">战绩数据</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">总积分</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {Math.round(stats.totalPoints)}
                </p>
              </div>
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  全球排名
                </p>
                <p className="mt-1 text-lg font-black text-[#102a43]">
                  {formatRank(stats.globalRank)}
                </p>
              </div>
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  地区排名
                </p>
                <p className="mt-1 text-lg font-black text-[#102a43]">
                  {formatRank(stats.regionRank)}
                </p>
              </div>
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  已预测场数
                </p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {stats.predictionCount}
                </p>
              </div>
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">命中场数</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {stats.hitCount}
                </p>
              </div>
              <div className="rounded-md bg-[#f0f4f8] p-3">
                <p className="text-xs font-semibold text-[#627d98]">命中率</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {(stats.hitRate * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#102a43]">分享邀请</h2>
            <p className="mt-2 text-sm font-semibold text-[#d64545]">
              邀请好友一起预测世界杯
            </p>
            <p className="mt-3 break-all rounded-md bg-[#f0f4f8] px-3 py-3 text-xs font-semibold text-[#334e68]">
              {shareLink}
            </p>
            <button
              type="button"
              onClick={copyShareLink}
              className="mt-4 h-11 w-full rounded-md bg-[#d64545] px-4 text-sm font-bold text-white transition hover:bg-[#ba2525]"
            >
              复制分享链接
            </button>
            {copied ? (
              <p className="mt-3 text-sm font-bold text-[#0f7b3f]">
                已复制，发给朋友来挑战你！
              </p>
            ) : null}
          </article>
        </div>
      </section>
    </main>
  );
}
