"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import { PlayerCardMini } from "@/components/PlayerCardMini";
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
import { getTeamDisplayName, worldCupTeams } from "@/lib/teamMeta";

type HomePlayer = {
  id: string;
  nickname: string;
  country: string;
  region: string;
  coins: number;
  last_login_reward_date: string | null;
  equipped_card_id: string | null;
};
type PlayerCard = {
  id: string;
  team: string;
  player_name: string;
  player_name_en: string | null;
  position: string | null;
  shirt_number: number | null;
  rarity: string | null;
  price: number | null;
  star_level: number | null;
  card_art_url: string | null;
  card_thumb_url: string | null;
  card_theme: string | null;
  card_number: string | null;
  card_image: string | null;
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

  const trimmedNickname = nickname.trim();
  const isNicknameEmpty = trimmedNickname.length === 0;
  const selectedCountry = getCountryByNameEn(country);
  const selectedTheme = getCountryTheme(country);
  const selectedAccentText =
    selectedTheme.textOnTheme === "dark" ? "#AA151B" : selectedTheme.accent;

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");

    if (ref) {
      localStorage.setItem("referrer_id", ref);
      localStorage.setItem("wc_referrer_id", ref);
      localStorage.setItem("wc_invite_code", ref);
      setReferrerId(ref);
      setInviteCode(ref);
    }
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
    const { data: cardData } = await supabase
      .from("player_cards")
      .select("id, team, player_name, player_name_en, position, shirt_number, rarity, price, star_level, card_art_url, card_thumb_url, card_theme, card_number, card_image")
      .eq("id", cardId)
      .maybeSingle();

    setEquippedCard(cardData);
  }

  async function loadPlayer(
    playerId: string,
    options: { awardDaily?: boolean } = {},
  ) {
      const { data } = await supabase
        .from("players")
        .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id")
        .eq("id", playerId)
        .maybeSingle();

      if (!data) {
        return;
      }

      const canonicalTeamName = getCanonicalTeamName(data.country);
      savePlayerSession(data);
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
      setCurrentPlayer({ ...data, coins: nextCoins });
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
    const normalized = code.trim();

    if (!normalized) {
      return null;
    }

    const { data } = await supabase
      .from("players")
      .select("id, coins")
      .eq("id", normalized)
      .maybeSingle();

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

    const { data: existingPlayers, error: lookupError } = await supabase
      .from("players")
      .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id")
      .eq("nickname", trimmedNickname)
      .order("created_at", { ascending: true });

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

    const inviter = await resolveInviter(inviteCode);

    const { data: createdPlayer, error: insertError } = await supabase
      .from("players")
      .insert({
        nickname: trimmedNickname,
        country,
        region,
        coins: 1000,
        avatar_id: "default-manager",
        referred_by: inviter?.id ?? null,
      })
      .select("id, nickname, country, region, coins, last_login_reward_date, equipped_card_id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    savePlayerSession(createdPlayer);
    if (inviteCode.trim()) {
      localStorage.setItem("wc_invite_code", inviteCode.trim());
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
          <div className="relative z-10 pr-28">
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
          <div className="absolute bottom-4 right-4 z-10 flex w-28 flex-col items-center rounded-2xl border border-white/20 bg-[#071b3a]/35 p-2 backdrop-blur">
            {equippedCard ? (
              <PlayerCardMini
                card={equippedCard}
                country={currentPlayer?.country ?? country}
                size="small"
                equipped
              />
            ) : selectedCountry ? (
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
              <div className="rounded-xl border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm font-black text-[#0f7b3f]">
                <p>{notice}</p>
                <p className="mt-2 text-[#071b3a]">请选择下一步：</p>
              </div>
            ) : null}
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
            <Link href="/leaderboard" className="wc-button-secondary w-full">
              球王榜
            </Link>
            <Link href="/bracket" className="wc-button-secondary w-full">
              世界杯晋级之路
            </Link>
            <button
              type="button"
              onClick={switchAccount}
              className="h-11 w-full rounded-xl border border-[#071b3a]/15 bg-white px-4 text-sm font-black text-[#071b3a]"
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
              onChange={(event) => setInviteCode(event.target.value)}
              className="wc-input mt-2"
              placeholder="可粘贴好友分享链接中的 ref"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-[#fde8e8] px-3 py-2 text-sm text-[#9b1c1c]">
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
            <p className="rounded-md bg-[#e3f9e5] px-3 py-2 text-sm font-semibold text-[#0f7b3f]">
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
            href="/leaderboard"
            className="wc-button-secondary w-full"
          >
            球王榜
          </Link>

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
            href="/bracket"
            className="wc-button-secondary w-full"
          >
            世界杯晋级之路
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
