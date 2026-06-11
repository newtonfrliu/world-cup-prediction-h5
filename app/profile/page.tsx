"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";

import { AvatarFigure } from "@/components/AvatarFigure";
import { CountryDisplay } from "@/components/CountryDisplay";
import { getAvatar } from "@/lib/avatar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getCountryByNameEn, getCountryTheme } from "@/lib/countries";
import { getTeamDisplayName } from "@/lib/teamMeta";
import type { Database } from "@/types/database";

type Player = Database["public"]["Tables"]["players"]["Row"];
type Prediction = Pick<
  Database["public"]["Tables"]["predictions"]["Row"],
  "id" | "points" | "stake" | "payout" | "status"
>;
type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

type ProfileStats = {
  totalPoints: number;
  globalRank: number | null;
  regionRank: number | null;
  predictionCount: number;
  hitCount: number;
  hitRate: number;
  totalStake: number;
  activeStake: number;
  totalPayout: number;
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
    totalStake: 0,
    activeStake: 0,
    totalPayout: 0,
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
  const [rewardStatus, setRewardStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const playerCountry = player ? getCountryByNameEn(player.country) : null;
  const playerTheme = getCountryTheme(player?.country);
  const playerAvatar = getAvatar(player?.avatar_id);

  useEffect(() => {
    async function awardDailyLoginReward(
      currentPlayer: Player,
    ): Promise<Player> {
      const today = new Date().toISOString().slice(0, 10);
      const currentCoins = currentPlayer.coins ?? 1000;

      if (currentPlayer.last_login_reward_date === today) {
        setRewardStatus("今日已领取");
        return { ...currentPlayer, coins: currentCoins };
      }

      const nextCoins = currentCoins + 200;
      const { error: rewardError } = await supabase
        .from("players")
        .update({
          coins: nextCoins,
          last_login_reward_date: today,
        })
        .eq("id", currentPlayer.id);

      if (rewardError) {
        setRewardStatus("今日奖励领取失败");
        return { ...currentPlayer, coins: currentCoins };
      }

      setRewardStatus("今日登录奖励 +200 金币");
      return {
        ...currentPlayer,
        coins: nextCoins,
        last_login_reward_date: today,
      };
    }

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
        .select(
          "id, nickname, country, region, coins, last_login_reward_date, avatar_id, created_at",
        )
        .eq("id", storedPlayerId)
        .single();

      if (playerError) {
        setError(playerError.message);
        setLoading(false);
        return;
      }

      const currentPlayer = await awardDailyLoginReward(playerData as Player);
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
          .select("id, points, stake, payout, status")
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
      const predictions = ((predictionData ?? []) as Prediction[]).filter(
        (prediction) => (prediction.status ?? "active") !== "cancelled",
      );
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
      const totalStake = predictions.reduce(
        (sum, prediction) => sum + prediction.stake,
        0,
      );
      const activeStake = predictions
        .filter((prediction) => (prediction.status ?? "active") === "active")
        .reduce((sum, prediction) => sum + prediction.stake, 0);
      const totalPayout = predictions.reduce(
        (sum, prediction) => sum + prediction.payout,
        0,
      );

      setStats({
        totalPoints: playerLeaderboardRow?.total_points ?? 0,
        globalRank: playerRowIndex >= 0 ? playerRowIndex + 1 : null,
        regionRank: regionRowIndex >= 0 ? regionRowIndex + 1 : null,
        predictionCount,
        hitCount,
        hitRate: predictionCount > 0 ? hitCount / predictionCount : 0,
        totalStake,
        activeStake,
        totalPayout,
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
    const posterNode = posterRef.current;

    if (!playerId || !posterNode) {
      setPosterMessage("请长按海报截图保存");
      return;
    }

    try {
      const exportWidth = posterNode.scrollWidth;
      const exportHeight = posterNode.scrollHeight;
      const dataUrl = await toPng(posterNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#102a43",
        width: exportWidth,
        height: exportHeight,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
        },
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
          <article
            className="overflow-hidden rounded-2xl border border-[#f6c84c]/50 bg-[#071b3a] text-white shadow-[0_18px_44px_rgba(7,27,58,0.28)]"
            style={{
              background: playerTheme.cardGradient,
              borderTopColor: playerTheme.accent,
              borderTopWidth: 8,
              boxShadow: playerTheme.glow,
            }}
          >
            <div className="p-5">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#25c7b7]">
                Player Card
              </p>
              <div className="mt-4 flex items-center gap-4">
                <AvatarFigure
                  avatarId={player?.avatar_id}
                  theme={playerTheme}
                  className="h-28 w-24 shrink-0"
                />
                {playerCountry ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playerCountry.flag}
                    alt={`${playerCountry.nameZh} flag`}
                    className="h-16 w-24 rounded-xl border-2 border-white/70 object-cover shadow-lg"
                  />
                ) : null}
                <div className="min-w-0">
                  <h2 className="truncate text-3xl font-black">
                    {player?.nickname ?? "-"}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[#f6c84c]">
                    {player ? <CountryDisplay team={player.country} /> : "-"}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[11px] font-black text-[#25c7b7]">
                    地区
                  </p>
                  <p className="mt-1 truncate text-sm font-black">
                    {player?.region ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f6c84c] p-3 text-[#071b3a]">
                  <p className="text-[11px] font-black">积分</p>
                  <p className="mt-1 text-xl font-black">
                    {Math.round(stats.totalPoints)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[11px] font-black text-[#25c7b7]">
                    全球
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {formatRank(stats.globalRank)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[11px] font-black text-[#25c7b7]">
                    金币
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {player?.coins ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="wc-card p-4">
            <h2 className="text-lg font-black text-[#102a43]">战绩数据</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-[#f6c84c] p-3 text-[#071b3a]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase">Total Points</p>
                  <p className="text-2xl font-black">
                    {Math.round(stats.totalPoints)}
                  </p>
                </div>
              </div>
              {[
                ["全球排名", formatRank(stats.globalRank)],
                ["地区排名", formatRank(stats.regionRank)],
                ["已预测场数", `${stats.predictionCount}`],
                ["命中场数", `${stats.hitCount}`],
                ["命中率", `${(stats.hitRate * 100).toFixed(0)}%`],
                ["总下注", `${stats.totalStake} 金币`],
                ["当前有效下注", `${stats.activeStake} 金币`],
                ["总返还", `${stats.totalPayout} 金币`],
                ["今日登录奖励", rewardStatus || "今日已检查"],
                ["当前 Avatar", playerAvatar.name],
                ["当前主队主题", playerCountry?.nameZh ?? "世界杯默认"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#071b3a]/10 bg-[#f6f1e7] p-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-black text-[#627d98]">
                      {label}
                    </p>
                    <p className="text-lg font-black text-[#071b3a]">
                      {value}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[#e63535]"
                      style={{
                        width:
                          label === "命中率"
                            ? `${Math.min(stats.hitRate * 100, 100)}%`
                            : "68%",
                      }}
                    />
                  </div>
                </div>
              ))}
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
              className="relative mx-auto mt-4 w-[360px] max-w-full rounded-[22px] border-4 border-[#f6c84c] bg-[#071b3a] p-5 text-white shadow-lg print:shadow-none"
              style={{
                background: playerTheme.cardGradient,
                borderColor: playerTheme.accent,
              }}
            >
              {playerCountry ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playerCountry.flag}
                  alt={`${playerCountry.nameZh} flag`}
                  className="pointer-events-none absolute -right-10 top-20 h-36 w-52 rotate-[-10deg] rounded-2xl object-cover opacity-15"
                />
              ) : null}
              <div className="relative rounded-2xl border border-[#f6c84c]/50 bg-[#0b254a] p-4 text-center shadow-inner">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#25c7b7]">
                  WORLD CUP CHALLENGE
                </p>
                <p className="mt-2 text-sm font-black text-[#e63535]">
                  {playerCountry?.nameZh ?? "世界杯"} 阵营战报
                </p>
                <h3 className="mt-1 text-4xl font-black leading-tight text-white">
                  美加墨大乱斗
                </h3>
              </div>

              <div className="relative mt-4 rounded-2xl border-2 border-[#f6c84c] bg-white p-4 text-center text-[#071b3a]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e63535]">
                  Player Identity Card
                </p>
                <AvatarFigure
                  avatarId={player?.avatar_id}
                  theme={playerTheme}
                  className="mx-auto mt-3 h-28 w-24 bg-[#071b3a]"
                />
                {playerCountry ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playerCountry.flag}
                    alt={`${playerCountry.nameZh} flag`}
                    className="mx-auto mt-3 h-14 w-20 rounded-xl border border-[#071b3a]/10 object-cover shadow-md"
                  />
                ) : null}
                <p className="mt-3 truncate text-3xl font-black">
                  {player?.nickname ?? "-"}
                </p>
                <p className="mt-1 text-sm font-black text-[#627d98]">
                  {player ? getTeamDisplayName(player.country) : "-"} ·{" "}
                  {player?.region ?? "-"}
                </p>
                <p className="mt-4 text-xs font-black text-[#627d98]">
                  邀请码：
                </p>
                <p className="text-2xl font-black tracking-[0.14em] text-[#e63535]">
                  {playerId ? getInviteCode(playerId) : "------"}
                </p>
              </div>

              <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#f6c84c] p-3 text-[#071b3a]">
                  <p className="text-[11px] font-bold">总积分</p>
                  <p className="mt-1 text-xl font-black">
                    {Math.round(stats.totalPoints)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 text-[#071b3a]">
                  <p className="text-[11px] font-bold text-[#627d98]">
                    全球排名
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatRank(stats.globalRank)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 text-[#071b3a]">
                  <p className="text-[11px] font-bold text-[#627d98]">
                    地区排名
                  </p>
                  <p className="mt-1 text-base font-black">
                    {formatRank(stats.regionRank)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 text-[#071b3a]">
                  <p className="text-[11px] font-bold text-[#627d98]">
                    金币余额
                  </p>
                  <p className="mt-1 text-base font-black">
                    {player?.coins ?? 0}
                  </p>
                </div>
              </div>

              <div className="relative mt-3 rounded-2xl border border-[#f6c84c]/60 bg-white/10 p-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f6c84c]">
                  Champion Pick
                </p>
                <div className="mt-2 flex items-center justify-center text-2xl font-black">
                  {championPrediction ? (
                    <CountryDisplay team={championPrediction} />
                  ) : (
                    "待锁定"
                  )}
                </div>
              </div>

              <div className="relative mt-6 mb-16 rounded-2xl bg-white p-8 text-center text-[#071b3a]">
                <div className="mx-auto inline-block rounded-2xl border border-[#071b3a]/10 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shareLink ? buildQrCodeUrl(shareLink) : ""}
                  alt="邀请链接二维码"
                  className="h-44 w-44 rounded-md bg-white"
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
                  扫码挑战我的世界杯预测
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
              点击保存海报后会生成图片预览，在微信里长按即可保存到相册。
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
