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

type StoredBracketPrediction = {
  locked?: boolean;
  champion?: string;
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
  const [championPrediction, setChampionPrediction] = useState("");
  const [copied, setCopied] = useState(false);
  const [posterMessage, setPosterMessage] = useState("");
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

      const storedBracket = localStorage.getItem(
        `bracket_prediction_${storedPlayerId}`,
      );

      if (storedBracket) {
        try {
          const parsed = JSON.parse(storedBracket) as StoredBracketPrediction;

          if (parsed.locked && parsed.champion) {
            setChampionPrediction(parsed.champion);
          }
        } catch {
          setChampionPrediction("");
        }
      }

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
    setPosterMessage("");
  }

  function savePoster() {
    setPosterMessage("请长按海报或截图保存分享。");
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
            <h2 className="text-lg font-black text-[#102a43]">
              分享我的战绩
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#d64545]">
              生成一张适合微信截图分享的战绩海报
            </p>

            <div
              id="profile-poster"
              className="mt-4 mx-auto flex min-h-[640px] w-full max-w-[360px] flex-col overflow-hidden rounded-lg bg-[#102a43] p-5 text-white shadow-lg print:shadow-none"
            >
              <div className="rounded-lg border border-[#f7c948]/40 bg-[#0b1f33] p-4">
                <p className="text-sm font-black text-[#d64545]">
                  美加墨大乱斗
                </p>
                <h3 className="mt-2 text-3xl font-black leading-tight">
                  2026 足球世界杯预测
                </h3>
                <p className="mt-3 text-sm text-[#bcccdc]">
                  我的世界杯预测战绩海报
                </p>
              </div>

              <div className="mt-5 rounded-lg bg-white p-4 text-[#102a43]">
                <p className="text-xs font-bold text-[#d64545]">玩家</p>
                <p className="mt-1 text-2xl font-black">
                  {player?.nickname ?? "-"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#627d98]">主队国家</p>
                    <p className="mt-1 font-black">
                      {player ? getTeamDisplayName(player.country) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#627d98]">地区</p>
                    <p className="mt-1 font-black">{player?.region ?? "-"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#f7c948] p-3 text-[#102a43]">
                  <p className="text-xs font-bold">总积分</p>
                  <p className="mt-1 text-3xl font-black">
                    {Math.round(stats.totalPoints)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 text-[#102a43]">
                  <p className="text-xs font-bold text-[#627d98]">命中率</p>
                  <p className="mt-1 text-3xl font-black">
                    {(stats.hitRate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 text-[#102a43]">
                  <p className="text-xs font-bold text-[#627d98]">全球排名</p>
                  <p className="mt-1 text-lg font-black">
                    {formatRank(stats.globalRank)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 text-[#102a43]">
                  <p className="text-xs font-bold text-[#627d98]">地区排名</p>
                  <p className="mt-1 text-lg font-black">
                    {formatRank(stats.regionRank)}
                  </p>
                </div>
              </div>

              {championPrediction ? (
                <div className="mt-4 rounded-lg border border-[#f7c948] bg-[#f7c948] p-4 text-[#102a43]">
                  <p className="text-sm font-black">🏆 冠军预测</p>
                  <p className="mt-1 text-2xl font-black">
                    {getTeamDisplayName(championPrediction)}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-white/15 bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#f7c948]">
                      已预测场数
                    </p>
                    <p className="mt-1 text-3xl font-black">
                      {stats.predictionCount}
                    </p>
                  </div>
                  <div className="rounded-full border border-[#f7c948] px-4 py-2 text-sm font-black text-[#f7c948]">
                    冠军挑战
                  </div>
                </div>
              </div>

              <div className="mt-auto rounded-lg bg-white p-4 text-center text-[#102a43]">
                <p className="mt-3 break-all text-xs font-semibold text-[#627d98]">
                  {shareLink}
                </p>
                <p className="mt-3 text-sm font-black text-[#d64545]">
                  长按识别/复制链接，来挑战我的世界杯预测
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyShareLink}
                className="h-11 rounded-md bg-[#d64545] px-4 text-sm font-bold text-white transition hover:bg-[#ba2525]"
              >
                复制分享链接
              </button>
              <button
                type="button"
                onClick={savePoster}
                className="h-11 rounded-md border border-[#cbd2d9] bg-white px-4 text-sm font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
              >
                保存海报
              </button>
            </div>
            {copied ? (
              <p className="mt-3 text-sm font-bold text-[#0f7b3f]">
                分享链接已复制
              </p>
            ) : null}
            {posterMessage ? (
              <p className="mt-3 text-sm font-bold text-[#334e68]">
                {posterMessage}
              </p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-[#627d98]">
              第一版海报适合手机截图分享，后续可升级为一键保存图片。
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
