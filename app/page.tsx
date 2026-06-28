"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  getCanonicalTeamName,
  getCountryByNameEn,
  getCountryTheme,
} from "@/lib/countries";
import {
  clearPlayerSession,
  getStoredPlayerId,
  savePlayerSession,
} from "@/lib/playerSession";
import { resolvePlayerCardImage } from "@/lib/playerCardImages";
import {
  ensurePlayerInviteCode,
  generateUniqueInviteCode,
  getInviteCodeColumnErrorMessage,
  isUuidInviteRef,
  isMissingInviteCodeColumnError,
  normalizeInviteCode,
  sanitizeInviteParam,
} from "@/lib/inviteCode";
import { getTeamDisplayName, worldCupTeams } from "@/lib/teamMeta";
import { buttonStyles, cardStyles, statusStyles } from "@/lib/ui-styles";

type HomePlayer = {
  id: string;
  nickname: string;
  country: string;
  region: string;
  coins: number;
  last_login_reward_date: string | null;
  equipped_card_id: string | null;
  invite_code: string | null;
};
type PlayerCard = {
  id: string;
  team: string;
  player_name: string;
  player_name_en: string | null;
  shirt_number: number | null;
  rarity: string | null;
  card_art_url: string | null;
  card_thumb_url: string | null;
  roster_source: string | null;
};
type HomeOpsStatus = {
  predictable: number | null;
  inProgress: number | null;
  finished: number | null;
  globalRank: number | null;
};

const popularTeams = [
  "Argentina",
  "France",
  "Brazil",
  "Portugal",
  "England",
  "Germany",
  "Spain",
  "Netherlands",
];
const orderedTeams = [
  ...popularTeams,
  ...worldCupTeams.filter((team) => !popularTeams.includes(team)),
];
const countries = orderedTeams.map((team) => ({
  label: getTeamDisplayName(team),
  value: team,
}));

const regions = [
  "海外",
  "北京",
  "天津",
  "上海",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
  "台湾",
];

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState(countries[0].value);
  const [region, setRegion] = useState(regions[0]);
  const [referrerId, setReferrerId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState<HomePlayer | null>(null);
  const [equippedCard, setEquippedCard] = useState<PlayerCard | null>(null);
  const [rewardStatus, setRewardStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [recoveryPlayer, setRecoveryPlayer] = useState<HomePlayer | null>(null);
  const [homeOpsStatus, setHomeOpsStatus] = useState<HomeOpsStatus>({
    predictable: null,
    inProgress: null,
    finished: null,
    globalRank: null,
  });

  const trimmedNickname = nickname.trim();
  const isNicknameEmpty = trimmedNickname.length === 0;
  const selectedCountry = getCountryByNameEn(country);
  const selectedTheme = getCountryTheme(country);
  const selectedAccentText =
    selectedTheme.textOnTheme === "dark" ? "#AA151B" : selectedTheme.accent;
  const equippedCardImageSrc =
    resolvePlayerCardImage(equippedCard);

  useEffect(() => {
    async function hydrateRef() {
      const params = new URLSearchParams(window.location.search);
      const ref =
        params.get("invite") ?? params.get("ref") ?? params.get("code");

      if (!ref) {
        return;
      }

      let nextInviteCode = sanitizeInviteParam(ref);

      if (isUuidInviteRef(ref) && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from("players")
          .select("id, invite_code")
          .eq("id", ref)
          .maybeSingle();

        if (isMissingInviteCodeColumnError(error)) {
          console.error("invite_code column is missing while hydrating ref", {
            error,
          });
          return;
        }

        if (data) {
          try {
            nextInviteCode = await ensurePlayerInviteCode(supabase, data);
          } catch (error) {
            console.error("failed to ensure invite code from uuid ref", {
              ref,
              error,
            });
            return;
          }
        }
      }

      if (!nextInviteCode) {
        return;
      }

      localStorage.setItem("referrer_id", nextInviteCode);
      localStorage.setItem("wc_referrer_id", nextInviteCode);
      localStorage.setItem("wc_invite_code", nextInviteCode);
      setReferrerId(nextInviteCode);
      setInviteCode(nextInviteCode);
    }

    hydrateRef();
  }, []);

  useEffect(() => {
    async function loadStoredPlayer() {
      const storedPlayerId = getStoredPlayerId();

      if (!storedPlayerId || !isSupabaseConfigured) {
        return;
      }

      await loadPlayer(storedPlayerId);
    }

    loadStoredPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEquippedCard(cardId: string) {
    const { data: cardData, error: cardError } = await supabase
      .from("player_cards")
      .select("id, team, player_name, player_name_en, shirt_number, rarity, card_art_url, card_thumb_url, roster_source")
      .eq("id", cardId)
      .maybeSingle();

    if (cardError) {
      console.error("failed to load home equipped card", {
        cardId,
        error: cardError,
      });
      return;
    }

    setEquippedCard(cardData);
  }

  function getHomeMatchState(match: { start_time: string; status: string | null }) {
    if (match.status === "finished") {
      return "finished";
    }

    const startTime = new Date(match.start_time).getTime();

    if (!Number.isFinite(startTime)) {
      return "not_started";
    }

    return Date.now() >= startTime ? "in_progress" : "not_started";
  }

  async function loadHomeOpsStatus(player: HomePlayer, coins: number) {
    const nextStatus: HomeOpsStatus = {
      predictable: null,
      inProgress: null,
      finished: null,
      globalRank: null,
    };

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("start_time, status");

    if (!matchesError) {
      const states = (matches ?? []).map(getHomeMatchState);
      nextStatus.predictable = states.filter((state) => state === "not_started").length;
      nextStatus.inProgress = states.filter((state) => state === "in_progress").length;
      nextStatus.finished = states.filter((state) => state === "finished").length;
    }

    const { data: leaderboard, error: leaderboardError } = await supabase
      .from("leaderboard")
      .select("nickname, country, region, total_points")
      .order("total_points", { ascending: false });

    if (!leaderboardError) {
      const playerIndex = (leaderboard ?? []).findIndex(
        (row) =>
          row.nickname === player.nickname &&
          row.country === player.country &&
          row.region === player.region,
      );
      nextStatus.globalRank = playerIndex >= 0 ? playerIndex + 1 : null;
    }

    setCoinBalance(coins);
    setHomeOpsStatus(nextStatus);
  }

  async function loadPlayer(
    playerId: string,
    options: { awardDaily?: boolean } = {},
  ) {
      let { data, error: playerError } = await supabase
        .from("players")
        .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id, invite_code")
        .eq("id", playerId)
        .maybeSingle();

      if (isMissingInviteCodeColumnError(playerError)) {
        console.error("players.invite_code column is missing while loading player", {
          playerId,
          error: playerError,
        });
        const fallback = await supabase
          .from("players")
          .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id")
          .eq("id", playerId)
          .maybeSingle();
        data = fallback.data
          ? { ...fallback.data, invite_code: null }
          : null;
        playerError = fallback.error;
      }

      if (playerError) {
        setError(playerError.message);
        return;
      }

      if (!data) {
        return;
      }

      const canonicalTeamName = getCanonicalTeamName(data.country);
      let inviteCode = data.invite_code ?? "";

      try {
        inviteCode = await ensurePlayerInviteCode(supabase, data);
      } catch (error) {
        if (isMissingInviteCodeColumnError(error)) {
          setError(getInviteCodeColumnErrorMessage());
        } else {
          console.error("failed to ensure player invite code", {
            playerId,
            error,
          });
        }
      }

      savePlayerSession({ ...data, invite_code: inviteCode });
      setCountry(canonicalTeamName);
      setCurrentPlayer(data);
      setCoinBalance(data.coins ?? 1000);
      setRecoveryPlayer(null);
      if (data.equipped_card_id) {
        await loadEquippedCard(data.equipped_card_id);
      } else {
        setEquippedCard(null);
      }
      const shouldAwardDaily = options.awardDaily ?? true;
      const nextCoins = shouldAwardDaily
        ? await awardDailyLoginReward(
            playerId,
            data.coins ?? 1000,
            data.last_login_reward_date,
          )
        : data.coins ?? 1000;
      const nextPlayer = { ...data, coins: nextCoins };
      setCurrentPlayer(nextPlayer);
      await loadHomeOpsStatus(nextPlayer, nextCoins);
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  async function awardDailyLoginReward(
    playerId: string,
    currentCoins: number,
    lastRewardDate: string | null,
  ) {
    const today = getTodayKey();

    if (lastRewardDate === today) {
      setRewardStatus("✅ 今日200金币已领取");
      return currentCoins;
    }

    const nextCoins = currentCoins + 200;
    const { error: rewardError } = await supabase
      .from("players")
      .update({
        coins: nextCoins,
        last_login_reward_date: today,
      })
      .eq("id", playerId);

    if (!rewardError) {
      setCoinBalance(nextCoins);
      setNotice("今日登录奖励 +200 金币");
      setRewardStatus("✅ 今日200金币已领取");
    } else {
      setRewardStatus("🪙 今日登录奖励：可领取 200 金币");
    }

    return rewardError ? currentCoins : nextCoins;
  }

  async function resolveInviter(code: string) {
    const normalized = normalizeInviteCode(code);

    if (normalized.length !== 6) {
      return null;
    }

    const { data, error } = await supabase
      .from("players")
      .select("id, coins")
      .eq("invite_code", normalized)
      .maybeSingle();

    if (error) {
      if (isMissingInviteCodeColumnError(error)) {
        throw new Error(getInviteCodeColumnErrorMessage());
      }

      console.error("failed to resolve inviter by invite_code", {
        inviteCode: normalized,
        error,
      });
      return null;
    }

    return data;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isNicknameEmpty || isSubmitting) {
      return;
    }

    if (!isSupabaseConfigured) {
      setError("请先配置 Supabase 环境变量。");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    setError("");
    setRecoveryPlayer(null);

    let { data: existingPlayers, error: lookupError } = await supabase
      .from("players")
      .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id, invite_code")
      .eq("nickname", trimmedNickname)
      .order("created_at", { ascending: true });

    if (isMissingInviteCodeColumnError(lookupError)) {
      console.error("players.invite_code column is missing during account lookup", {
        nickname: trimmedNickname,
        error: lookupError,
      });
      const fallback = await supabase
        .from("players")
        .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id")
        .eq("nickname", trimmedNickname)
        .order("created_at", { ascending: true });
      existingPlayers = fallback.data
        ? fallback.data.map((player) => ({ ...player, invite_code: null }))
        : null;
      lookupError = fallback.error;
    }

    if (lookupError) {
      setError(lookupError.message);
      setIsSubmitting(false);
      return;
    }

    const existingPlayer = existingPlayers?.[0];

    if (existingPlayer) {
      setRecoveryPlayer(existingPlayer as HomePlayer);
      setError("发现已有账号，请点击“恢复我的账号”继续。");
      setIsSubmitting(false);
      return;
    }

    let inviter = null;
    let newInviteCode = "";

    try {
      inviter = await resolveInviter(inviteCode);
      newInviteCode = await generateUniqueInviteCode(supabase);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false);
      return;
    }

    const { data: createdPlayer, error: insertError } = await supabase
      .from("players")
      .insert({
        nickname: trimmedNickname,
        country,
        region,
        coins: 1000,
        avatar_id: "default-manager",
        referred_by: inviter?.id ?? null,
        invite_code: newInviteCode,
      })
      .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id, invite_code")
      .single();

    if (insertError) {
      setError(
        isMissingInviteCodeColumnError(insertError)
          ? getInviteCodeColumnErrorMessage()
          : insertError.message,
      );
      setIsSubmitting(false);
      return;
    }

    savePlayerSession(createdPlayer);
    const storedInviteCode = sanitizeInviteParam(inviteCode);
    if (storedInviteCode) {
      localStorage.setItem("wc_invite_code", storedInviteCode);
    }
    setCoinBalance(createdPlayer.coins);

    if (inviter && inviter.id !== createdPlayer.id) {
      const inviterCoins = (inviter.coins ?? 1000) + 1000;
      await supabase.from("players").update({ coins: inviterCoins }).eq("id", inviter.id);
      await supabase.from("coin_transactions").insert({
        player_id: inviter.id,
        amount: 1000,
        type: "referral_bonus",
        related_player_id: createdPlayer.id,
      });
      setNotice(`欢迎加入 ${getTeamDisplayName(country)} 阵营，获得奖励：🪙 1000金币。邀请人获得 1000 金币。`);
    } else if (inviteCode.trim()) {
      setNotice(`欢迎加入 ${getTeamDisplayName(country)} 阵营，获得奖励：🪙 1000金币。邀请码无效，已跳过邀请奖励。`);
    } else {
      setNotice(`欢迎加入 ${getTeamDisplayName(country)} 阵营，获得奖励：🪙 1000金币。`);
    }

    await loadPlayer(createdPlayer.id, { awardDaily: false });
    setIsSubmitting(false);
  }

  async function recoverAccount() {
    if (!recoveryPlayer) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    await loadPlayer(recoveryPlayer.id);
    setNotice(`欢迎回来，${recoveryPlayer.nickname}`);
    setIsSubmitting(false);
  }

  function switchAccount() {
    clearPlayerSession();
    setCurrentPlayer(null);
    setCoinBalance(null);
    setEquippedCard(null);
    setRecoveryPlayer(null);
    setRewardStatus("");
    setNotice("");
    setError("");
    setHomeOpsStatus({
      predictable: null,
      inProgress: null,
      finished: null,
      globalRank: null,
    });
  }

  return (
    <main className="wc-page px-5 py-8">
      <section className="wc-shell flex min-h-[calc(100vh-4rem)] flex-col justify-center">
        <div
          className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/20 p-5"
          style={{
            background: selectedTheme.cardGradient,
            boxShadow: selectedTheme.glow,
            color: selectedTheme.foreground,
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: selectedTheme.overlay }}
          />
          {selectedCountry ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedCountry.flag}
              alt={`${selectedCountry.nameZh} flag`}
              className="absolute -right-8 -top-4 h-32 w-44 rotate-[-8deg] rounded-2xl object-cover opacity-20"
            />
          ) : null}
          <div className="relative z-10 max-w-[62%] pr-2 sm:max-w-[58%] md:max-w-[52%]">
            <p
              className="text-sm font-black"
              style={{ color: selectedTheme.mutedForeground }}
            >
              2026足球世界杯
            </p>
            <h1
              className="mt-3 text-5xl font-black leading-none"
              style={{ color: selectedTheme.foreground }}
            >
              美加墨
              <br />
              大乱斗
            </h1>
            <p
              className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
              style={{
                borderColor: selectedAccentText,
                color: selectedAccentText,
                background:
                  selectedTheme.textOnTheme === "dark"
                    ? "rgba(255,255,255,0.62)"
                    : "rgba(7,27,58,0.22)",
              }}
            >
              世界杯收藏竞猜游戏
            </p>
            <p
              className="mt-4 text-base font-bold leading-7"
              style={{ color: selectedAccentText }}
            >
              预测世界杯 / 挑战好友 / 争夺全球第一
            </p>
            <p
              className="mt-4 text-sm font-black"
              style={{ color: selectedTheme.foreground }}
            >
              加入 {selectedCountry?.nameZh ?? "世界杯"} 阵营
            </p>
          </div>
          {equippedCard && equippedCardImageSrc ? (
            <div className="absolute bottom-5 right-[8.5rem] z-20 hidden h-[150px] w-[104px] items-end justify-center sm:flex sm:right-36 sm:h-[170px] sm:w-[118px] md:bottom-6 md:right-44 md:h-[220px] md:w-[152px]">
              <div className="absolute inset-3 rounded-[28px] bg-[#f6c84c]/28 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={equippedCardImageSrc}
                alt={`${equippedCard.player_name} equipped card`}
                className="relative max-h-full max-w-full translate-y-1 object-contain drop-shadow-[0_24px_42px_rgba(7,27,58,0.42)]"
              />
            </div>
          ) : null}
          <div className="absolute bottom-4 right-4 z-10 flex w-28 flex-col items-center rounded-2xl border border-white/20 bg-[#071b3a]/35 p-2 backdrop-blur">
            {selectedCountry ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCountry.flag}
                  alt={`${selectedCountry.nameZh} flag`}
                  className="h-16 w-24 rounded-xl object-cover shadow-lg"
                />
                <p
                  className="mt-2 text-center text-xs font-black"
                  style={{ color: selectedAccentText }}
                >
                  {selectedCountry.nameZh}
                </p>
              </>
            ) : null}
          </div>
        </div>

        {referrerId && !currentPlayer ? (
          <p className="mt-5 rounded-xl border border-[#f6c84c]/50 bg-white px-4 py-3 text-sm font-bold text-[#071b3a] shadow-sm">
            你是通过好友邀请进入的，创建玩家后即可参与预测。
          </p>
        ) : null}

        {currentPlayer ? (
          <section className="wc-card mt-5 space-y-4 p-5">
            <p className="wc-kicker">Your Fan Card</p>
            <h2 className="text-2xl font-black text-[#071b3a]">
              {currentPlayer.nickname}
            </h2>
            <div className="rounded-2xl bg-[#f6f1e7] p-4 text-sm font-black text-[#071b3a]">
              <p className="flex items-center gap-2">
                主队：<CountryDisplay team={currentPlayer.country} />
              </p>
              <p className="mt-2">地区：{currentPlayer.region}</p>
            <p className="mt-2">金币余额：{currentPlayer.coins}</p>
            <p className="mt-2">
              {rewardStatus || "🪙 今日登录奖励：可领取 200 金币"}
            </p>
          </div>
            {notice ? (
              <div className={statusStyles.success}>
                <p>{notice}</p>
                <p className="mt-2 text-[#071b3a]">请选择下一步：</p>
              </div>
            ) : null}

            <div className={cardStyles.stat}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e63535]">
                Today Status
              </p>
              <h3 className="mt-1 text-lg font-black text-[#071b3a]">
                今日运营状态
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black text-[#071b3a] sm:grid-cols-3">
                {homeOpsStatus.predictable !== null ? (
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[#627d98]">可预测</p>
                    <p className="text-xl">{homeOpsStatus.predictable}</p>
                  </div>
                ) : null}
                {homeOpsStatus.inProgress !== null ? (
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[#627d98]">进行中</p>
                    <p className="text-xl">{homeOpsStatus.inProgress}</p>
                  </div>
                ) : null}
                {homeOpsStatus.finished !== null ? (
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[#627d98]">已结束</p>
                    <p className="text-xl">{homeOpsStatus.finished}</p>
                  </div>
                ) : null}
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-[#627d98]">我的金币</p>
                  <p className="text-xl">{currentPlayer.coins}</p>
                </div>
                {homeOpsStatus.globalRank !== null ? (
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[#627d98]">全球排名</p>
                    <p className="text-xl">#{homeOpsStatus.globalRank}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[#071b3a]/10 bg-white p-4 text-sm font-black text-[#071b3a] shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#e63535]">
                Equipped Card
              </p>
              <p className="mt-2">
                当前装备：
                {equippedCard ? (
                  <span>
                    {equippedCard.player_name}
                    {equippedCard.rarity ? ` / ${equippedCard.rarity.toUpperCase()}` : ""}
                  </span>
                ) : (
                  <span className="text-[#627d98]">尚未装备球星卡</span>
                )}
              </p>
            </div>

            <Link href="/predict" className="wc-button w-full">
              预测比赛
            </Link>
            <Link href="/profile" className="wc-button-secondary w-full">
              我的战绩
            </Link>
            <Link href="/collection" className="wc-button-secondary w-full">
              球星收藏馆
              <span className="ml-2 text-xs font-bold text-[#e63535]">
                用金币兑换你的主队球星卡
              </span>
            </Link>
            <Link href="/round-of-32-calculator" className="wc-button-gold w-full">
              32强实时对阵
            </Link>
            <Link href="/bracket" className="wc-button-green w-full">
              世界杯晋级之路
            </Link>
            <Link href="/leaderboard" className="wc-button-secondary w-full">
              球王榜
            </Link>
            <button
              type="button"
              onClick={switchAccount}
              className={buttonStyles.muted}
            >
              切换账号 / 重新登录
            </button>
          </section>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="wc-card mt-5 space-y-5 p-5"
          style={{ borderColor: selectedTheme.accent }}
        >
          <div>
            <p className="wc-kicker">Entry Card</p>
            <h2 className="mt-1 text-2xl font-black text-[#071b3a]">
              领取你的球迷入场卡
            </h2>
            <p className="mt-2 rounded-xl bg-[#f6c84c] px-3 py-2 text-sm font-black text-[#071b3a]">
              注册即送 1000 金币
            </p>
            {coinBalance !== null ? (
              <p className="mt-2 inline-flex rounded-full bg-[#f6c84c] px-3 py-1 text-sm font-black text-[#071b3a]">
                当前金币：{coinBalance}
              </p>
            ) : null}
          </div>
          <label className="block">
            <span className="wc-label">昵称</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="wc-input mt-2"
              placeholder="输入你的昵称"
              maxLength={24}
            />
          </label>

          <label className="block">
            <span className="wc-label">主队国家</span>
            <div className="mt-2 rounded-xl border border-[#071b3a]/10 bg-[#f6f1e7] px-3 py-2 text-sm font-black text-[#071b3a]">
              <CountryDisplay team={country} />
            </div>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="wc-input mt-2"
            >
              {countries.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="wc-label">地区</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="wc-input mt-2"
            >
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="wc-label">邀请码（选填）</span>
            <input
              value={inviteCode}
              onChange={(event) => {
                const value = event.target.value;
                const safeInviteCode = sanitizeInviteParam(value);
                setInviteCode(
                  safeInviteCode || (value.length <= 6
                    ? normalizeInviteCode(value)
                    : ""),
                );
              }}
              className="wc-input mt-2"
              placeholder="例如 CF9FDB"
            />
          </label>

          {error ? (
            <p className={statusStyles.error}>
              {error}
            </p>
          ) : null}

          {recoveryPlayer ? (
            <button
              type="button"
              onClick={recoverAccount}
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-[#071b3a] px-4 text-sm font-black text-white disabled:bg-[#9fb3c8]"
            >
              {isSubmitting ? "恢复中..." : "恢复我的账号"}
            </button>
          ) : null}

          {notice ? (
            <p className={statusStyles.success}>
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isNicknameEmpty || isSubmitting}
            className="wc-button w-full"
          >
            {isSubmitting ? "提交中..." : "领取我的球迷卡"}
          </button>

          <Link
            href="/profile"
            className="wc-button-secondary w-full"
          >
            我的战绩
          </Link>

          <Link
            href="/collection"
            className="wc-button-secondary w-full"
          >
            球星收藏馆
          </Link>

          <Link
            href="/round-of-32-calculator"
            className="wc-button-gold w-full"
          >
            32强实时对阵
          </Link>

          <Link
            href="/bracket"
            className="wc-button-green w-full"
          >
            世界杯晋级之路
          </Link>

          <Link
            href="/leaderboard"
            className="wc-button-secondary w-full"
          >
            球王榜
          </Link>
        </form>
        )}

        <div className="mt-8 text-center text-sm font-bold text-[#627d98]">
          <p>官网：</p>
          <a
            href="https://2026wc.fun"
            className="text-[#d64545] underline underline-offset-4"
          >
            https://2026wc.fun
          </a>
        </div>
      </section>
    </main>
  );
}
