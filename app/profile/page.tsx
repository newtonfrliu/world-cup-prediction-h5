"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";

import { CountryDisplay } from "@/components/CountryDisplay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getCountryByNameEn } from "@/lib/countries";
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

const officialSiteUrl = "https://www.2026wc.fun";

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

function buildShareLink(playerId: string) {
  return `${officialSiteUrl}?ref=${playerId}`;
}

function buildQrCodeUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=8&data=${encodeURIComponent(value)}`;
}

function getInviteCode(playerId: string) {
  return playerId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export default function ProfilePage() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<ProfileStats>(() => buildEmptyStats());
  const [shareLink, setShareLink] = useState("");
  const [championPrediction, setChampionPrediction] = useState("");
  const [copied, setCopied] = useState(false);
  const [posterMessage, setPosterMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const playerCountry = player ? getCountryByNameEn(player.country) : null;

  useEffect(() => {
    async function loadProfile() {
      const storedPlayerId = localStorage.getItem("player_id");
      setPlayerId(storedPlayerId);

      if (!storedPlayerId) {
        setLoading(false);
        return;
      }

      setShareLink(buildShareLink(storedPlayerId));

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

  async function savePoster() {
    if (!playerId || !posterRef.current) {
      setPosterMessage("请长按海报截图保存");
      return;
    }

    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#102a43",
      });
      setPreviewImageUrl(dataUrl);
      setPosterMessage("");
    } catch {
      setPosterMessage("生成图片失败，请截图保存");
    }
  }

  function downloadPreviewImage() {
    if (!previewImageUrl || !playerId) {
      return;
    }

    const link = document.createElement("a");
    link.href = previewImageUrl;
    link.download = `worldcup-share-${playerId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    <main className="wc-page px-4 py-6">
      <section className="wc-shell">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="wc-kicker">
              Player Card
            </p>
            <h1 className="wc-title mt-2">
              我的战绩
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#071b3a]/15 bg-white px-3 py-2 text-sm font-bold text-[#071b3a]"
          >
            首页
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <article className="wc-dark-card p-5">
            <p className="text-sm font-black text-[#25c7b7]">MY PLAYER CARD</p>
            <h2 className="mt-2 text-3xl font-black text-white">
              {player?.nickname ?? "-"}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#f6c84c]">昵称</dt>
                <dd className="font-bold text-white">
                  {player?.nickname ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#f6c84c]">主队国家</dt>
                <dd className="font-bold text-white">
                  {player ? <CountryDisplay team={player.country} /> : "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#f6c84c]">地区</dt>
                <dd className="font-bold text-white">
                  {player?.region ?? "-"}
                </dd>
              </div>
            </dl>
          </article>

          <article className="wc-card p-4">
            <h2 className="text-lg font-black text-[#102a43]">战绩数据</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f6c84c] p-3 text-[#071b3a]">
                <p className="text-xs font-semibold text-[#627d98]">总积分</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {Math.round(stats.totalPoints)}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f1e7] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  全球排名
                </p>
                <p className="mt-1 text-lg font-black text-[#102a43]">
                  {formatRank(stats.globalRank)}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f1e7] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  地区排名
                </p>
                <p className="mt-1 text-lg font-black text-[#102a43]">
                  {formatRank(stats.regionRank)}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f1e7] p-3">
                <p className="text-xs font-semibold text-[#627d98]">
                  已预测场数
                </p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {stats.predictionCount}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f1e7] p-3">
                <p className="text-xs font-semibold text-[#627d98]">命中场数</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {stats.hitCount}
                </p>
              </div>
              <div className="rounded-xl bg-[#f6f1e7] p-3">
                <p className="text-xs font-semibold text-[#627d98]">命中率</p>
                <p className="mt-1 text-2xl font-black text-[#102a43]">
                  {(stats.hitRate * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </article>

          <article className="wc-card p-4">
            <h2 className="text-lg font-black text-[#102a43]">
              分享我的战绩
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#d64545]">
              生成一张适合微信截图分享的战绩海报
            </p>

            <div
              id="profile-poster"
              ref={posterRef}
              className="mx-auto mt-4 flex h-[640px] w-[360px] max-w-full flex-col overflow-hidden rounded-lg bg-[#102a43] p-5 text-white shadow-lg print:shadow-none"
            >
              <div className="rounded-lg border border-[#f7c948]/40 bg-[#0b1f33] p-4 text-center">
                <p className="text-sm font-black text-[#d64545]">
                  2026足球世界杯
                </p>
                <h3 className="mt-2 text-4xl font-black leading-tight text-white">
                  美加墨大乱斗
                </h3>
                <p className="mt-3 text-base font-bold leading-6 text-[#f7c948]">
                  预测世界杯
                  <br />
                  挑战好友排行榜
                </p>
              </div>

              <div className="mt-4 rounded-lg bg-white p-4 text-center text-[#102a43]">
                <p className="text-xs font-black text-[#d64545]">我的身份</p>
                {playerCountry ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playerCountry.flag}
                    alt={`${playerCountry.nameZh} flag`}
                    className="mx-auto mt-2 h-8 w-11 rounded-md object-cover shadow-sm"
                  />
                ) : null}
                <p className="mt-2 truncate text-2xl font-black">
                  {player
                    ? `${getTeamDisplayName(player.country)}·${player.nickname}`
                    : "-"}
                </p>
                <p className="mt-2 text-sm font-bold text-[#627d98]">
                  邀请码：
                </p>
                <p className="text-2xl font-black tracking-[0.12em] text-[#d64545]">
                  {playerId ? getInviteCode(playerId) : "------"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#f7c948] p-2 text-[#102a43]">
                  <p className="text-[11px] font-bold">总积分</p>
                  <p className="mt-1 text-xl font-black">
                    {Math.round(stats.totalPoints)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2 text-[#102a43]">
                  <p className="text-[11px] font-bold text-[#627d98]">
                    全球排名
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatRank(stats.globalRank)}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2 text-[#102a43]">
                  <p className="text-[11px] font-bold text-[#627d98]">
                    地区排名
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatRank(stats.regionRank)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-white/15 bg-white/10 p-3 text-center">
                <p className="text-sm font-bold text-[#f7c948]">
                  {championPrediction ? "🏆 我的冠军预测：" : "🏆 我的冠军预测："}
                </p>
                <p className="mt-1 text-2xl font-black">
                  {championPrediction
                    ? getTeamDisplayName(championPrediction)
                    : "待锁定"}
                </p>
              </div>

              <div className="mt-auto rounded-lg bg-white p-4 text-center text-[#102a43]">
                <div className="mx-auto inline-block rounded-xl bg-white p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shareLink ? buildQrCodeUrl(shareLink) : ""}
                  alt="邀请链接二维码"
                  className="h-28 w-28 rounded-md bg-white"
                />
                </div>
                <p className="mt-2 break-all text-[11px] font-semibold text-[#627d98]">
                  {shareLink}
                </p>
                <p className="mt-2 text-sm font-black leading-5 text-[#d64545]">
                  美加墨大乱斗
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#334e68]">
                  www.2026wc.fun
                </p>
                <p className="mt-1 text-sm font-black text-[#102a43]">
                  扫码参与世界杯预测挑战
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
                邀请链接已复制，快发给好友挑战吧！
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

      {previewImageUrl ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 px-4 py-5 text-white">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold">长按图片保存到手机相册</p>
            <button
              type="button"
              onClick={() => setPreviewImageUrl("")}
              className="rounded-md bg-white px-3 py-2 text-sm font-black text-[#102a43]"
            >
              关闭
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="分享海报预览"
              className="mx-auto max-h-[82vh] max-w-[92vw] rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={downloadPreviewImage}
            className="mt-4 h-11 rounded-md border border-white/40 px-4 text-sm font-bold text-white"
          >
            下载图片
          </button>
        </div>
      ) : null}
    </main>
  );
}
