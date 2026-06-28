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
import {
  calculatePlayerWinRate,
  calculatePlayerWinStreak,
} from "@/lib/player-stats";
import { gameStyles, statusStyles } from "@/lib/ui-styles";

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
  winRate: number | null;
  winStreak: number;
};
type HomeScheduleMatch = {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  stage: string | null;
  status: string | null;
};
type HomeLeaderboardRow = {
  nickname: string;
  country: string;
  region: string;
  total_points: number;
  equippedCard?: {
    id: string;
    player_name: string;
    card_art_url: string | null;
    card_thumb_url: string | null;
  } | null;
};
type HomePrediction = {
  id: string;
  player_id: string;
  match_id: string;
  prediction: string | null;
  status: string | null;
  points: number | null;
  payout: number | null;
  stake: number | null;
  settled_at: string | null;
  created_at: string | null;
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
    winRate: null,
    winStreak: 0,
  });
  const [todayMatches, setTodayMatches] = useState<HomeScheduleMatch[]>([]);
  const [leaderboardTop, setLeaderboardTop] = useState<HomeLeaderboardRow[]>([]);

  const trimmedNickname = nickname.trim();
  const isNicknameEmpty = trimmedNickname.length === 0;
  const selectedCountry = getCountryByNameEn(country);
  const selectedTheme = getCountryTheme(country);
  const equippedCardImageSrc =
    resolvePlayerCardImage(equippedCard);
  const equippedRarity = (equippedCard?.rarity ?? "").toLowerCase();

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

  function formatHomeMatchTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "时间待定";
    }

    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getHomeStageLabel(stage: string | null) {
    const normalized = (stage ?? "group").toLowerCase();

    if (normalized === "round_of_32") return "32强";
    if (normalized === "round_of_16") return "16强";
    if (normalized === "quarter_final") return "8强";
    if (normalized === "semi_final") return "半决赛";
    if (normalized === "third_place") return "季军赛";
    if (normalized === "final") return "决赛";
    return "小组赛";
  }

  function getHomeMatchStatusLabel(match: HomeScheduleMatch) {
    const state = getHomeMatchState(match);

    if (state === "in_progress") return "进行中";
    if (state === "finished") return "已结束";
    return "去预测";
  }

  function getRarityLabel(rarity: string | null | undefined) {
    const labels: Record<string, string> = {
      legend: "传奇",
      epic: "史诗",
      rare: "稀有",
      common: "普通",
    };

    return labels[(rarity ?? "").toLowerCase()] ?? "球星卡";
  }

  function getRarityStars(rarity: string | null | undefined) {
    const starCount: Record<string, number> = {
      legend: 5,
      epic: 4,
      rare: 3,
      common: 1,
    };

    return "★".repeat(starCount[(rarity ?? "").toLowerCase()] ?? 0);
  }

  function getPlayerNameTextClass(name: string) {
    const length = Array.from(name).length;

    if (length <= 4) return "text-4xl sm:text-5xl";
    if (length <= 8) return "text-3xl sm:text-4xl";
    if (length <= 12) return "text-2xl sm:text-3xl";
    return "text-xl sm:text-2xl";
  }

  async function enrichLeaderboardWithEquippedCards(
    rows: HomeLeaderboardRow[],
  ) {
    if (rows.length === 0) {
      return rows;
    }

    const nicknames = Array.from(new Set(rows.map((row) => row.nickname)));
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("nickname, country, region, equipped_card_id")
      .in("nickname", nicknames);

    if (playersError || !players) {
      return rows;
    }

    const playerByKey = new Map(
      players.map((player) => [
        `${player.nickname}|${player.country}|${player.region}`,
        player,
      ]),
    );
    const equippedIds = Array.from(
      new Set(
        players
          .map((player) => player.equipped_card_id)
          .filter((cardId): cardId is string => Boolean(cardId)),
      ),
    );

    if (equippedIds.length === 0) {
      return rows.map((row) => ({ ...row, equippedCard: null }));
    }

    const { data: cards, error: cardsError } = await supabase
      .from("player_cards")
      .select("id, player_name, card_art_url, card_thumb_url")
      .in("id", equippedIds);

    if (cardsError || !cards) {
      return rows.map((row) => ({ ...row, equippedCard: null }));
    }

    const cardById = new Map(cards.map((card) => [card.id, card]));

    return rows.map((row) => {
      const player = playerByKey.get(
        `${row.nickname}|${row.country}|${row.region}`,
      );
      const equippedCard = player?.equipped_card_id
        ? cardById.get(player.equipped_card_id) ?? null
        : null;

      return { ...row, equippedCard };
    });
  }

  async function loadHomeOpsStatus(player: HomePlayer, coins: number) {
    const nextStatus: HomeOpsStatus = {
      predictable: null,
      inProgress: null,
      finished: null,
      globalRank: null,
      winRate: null,
      winStreak: 0,
    };

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id, home_team, away_team, start_time, stage, status")
      .order("start_time", { ascending: true });

    if (!matchesError) {
      const states = (matches ?? []).map(getHomeMatchState);
      nextStatus.predictable = states.filter((state) => state === "not_started").length;
      nextStatus.inProgress = states.filter((state) => state === "in_progress").length;
      nextStatus.finished = states.filter((state) => state === "finished").length;
      const prioritizedMatches = [...(matches ?? [])].sort((left, right) => {
        const statePriority: Record<string, number> = {
          in_progress: 0,
          not_started: 1,
          finished: 2,
        };
        const leftState = getHomeMatchState(left);
        const rightState = getHomeMatchState(right);
        const priorityDiff = statePriority[leftState] - statePriority[rightState];

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
      });
      setTodayMatches(prioritizedMatches.slice(0, 3));
    }

    const { data: leaderboard, error: leaderboardError } = await supabase
      .from("leaderboard")
      .select("nickname, country, region, total_points")
      .order("total_points", { ascending: false });

    if (!leaderboardError) {
      const topRows = (leaderboard ?? []).slice(0, 3) as HomeLeaderboardRow[];
      setLeaderboardTop(await enrichLeaderboardWithEquippedCards(topRows));
      const playerIndex = (leaderboard ?? []).findIndex(
        (row) =>
          row.nickname === player.nickname &&
          row.country === player.country &&
          row.region === player.region,
      );
      nextStatus.globalRank = playerIndex >= 0 ? playerIndex + 1 : null;
    }

    const { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select("id, player_id, match_id, prediction, status, points, payout, stake, settled_at, created_at")
      .eq("player_id", player.id)
      .limit(1000);

    if (!predictionsError) {
      const rows = (predictions ?? []) as unknown as HomePrediction[];
      nextStatus.winRate = calculatePlayerWinRate(rows);
      nextStatus.winStreak = calculatePlayerWinStreak(rows);
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
      winRate: null,
      winStreak: 0,
    });
    setTodayMatches([]);
    setLeaderboardTop([]);
  }

  return (
    <main className={gameStyles.page}>
      <section className={gameStyles.shell}>
        <div className="relative overflow-hidden rounded-[28px] border border-[#f6c84c]/18 bg-[radial-gradient(circle_at_50%_32%,rgba(246,200,76,0.18),transparent_14rem),linear-gradient(180deg,rgba(6,13,24,0.92),rgba(3,8,16,0.96))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-6 lg:p-7">
          <div className="absolute inset-x-[-20%] top-14 h-24 rounded-full border-t border-[#f6c84c]/18 opacity-70" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(11,68,44,0.45))]" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-white">
                {currentPlayer ? currentPlayer.nickname : "美加墨大乱斗"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                {selectedCountry ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedCountry.flag}
                    alt={`${selectedCountry.nameZh} flag`}
                    className="h-8 w-12 rounded-md object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                  />
                ) : null}
                <div>
                  <h1 className="text-2xl font-black leading-none text-[#fff4bf]">
                    {selectedCountry?.nameZh ?? "世界杯"}
                  </h1>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                    {selectedCountry?.nameEn ?? "WORLD CUP 2026"}
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-[#f6c84c]/34 bg-black/38 px-4 py-3 text-right shadow-inner">
              <p className="text-xs font-black text-white/70">预测胜率</p>
              <p className="mt-1 text-2xl font-black text-[#f6c84c]">
                {homeOpsStatus.winRate === null
                  ? "暂无"
                  : `${homeOpsStatus.winRate}%`}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-7 grid grid-cols-1 items-end gap-5 min-[520px]:grid-cols-[minmax(0,0.95fr)_minmax(180px,1.05fr)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.95fr)] lg:gap-8">
            <div className="min-w-0 space-y-3 pb-4">
              <p className="text-xs font-black tracking-[0.12em] text-[#f6c84c]">
                当前装备球星卡
              </p>
              <div className="min-w-0">
                <h2
                  className={`max-w-[22rem] whitespace-normal break-keep font-black leading-[1.08] text-[#fff4bf] ${getPlayerNameTextClass(
                    equippedCard?.player_name ?? "尚未装备球星卡",
                  )}`}
                >
                  {equippedCard?.player_name ?? "尚未装备球星卡"}
                </h2>
                {equippedCard ? (
                  <p className="mt-1 max-w-[20rem] truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white/42">
                    {equippedCard.player_name_en ?? equippedCard.team}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-white/62">
                    去卡册选择你的国家队身份卡
                  </p>
                )}
              </div>
              {equippedCard ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#f6c84c] px-3 py-1 text-sm font-black text-[#071b3a]">
                    {getRarityLabel(equippedCard.rarity)}
                  </span>
                  <span className="text-xl tracking-[0.12em] text-[#f6c84c]">
                    {getRarityStars(equippedCard.rarity)}
                  </span>
                </div>
              ) : null}
              <Link
                href="/collection"
                className="inline-flex h-11 max-w-full items-center justify-center whitespace-nowrap rounded-2xl bg-[#f6c84c] px-5 text-sm font-black text-[#071b3a] shadow-[0_0_22px_rgba(246,200,76,0.42)] transition hover:bg-[#ffe08a]"
              >
                {equippedCard ? "更换球星卡" : "去装备球星卡"}
              </Link>
            </div>

            <div className="relative flex min-h-[260px] items-end justify-center min-[520px]:min-h-[320px] lg:min-h-[380px]">
              <div className="absolute bottom-3 h-28 w-56 rounded-full bg-[#f6c84c]/28 blur-3xl" />
              {equippedCard && equippedCardImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={equippedCardImageSrc}
                  alt={`${equippedCard.player_name} equipped card`}
                  className={`relative max-h-[300px] max-w-full object-contain min-[520px]:max-h-[360px] lg:max-h-[420px] ${
                    equippedRarity === "legend"
                      ? gameStyles.rarityGlowLegend
                      : equippedRarity === "epic"
                        ? gameStyles.rarityGlowEpic
                        : "drop-shadow-[0_22px_42px_rgba(0,0,0,0.5)]"
                  }`}
                />
              ) : selectedCountry ? (
                <div className="flex h-56 w-40 flex-col items-center justify-center rounded-[26px] border border-[#f6c84c]/28 bg-black/34 p-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedCountry.flag}
                    alt={`${selectedCountry.nameZh} flag`}
                    className="h-20 w-28 rounded-xl object-cover"
                  />
                  <p className="mt-4 text-lg font-black text-[#f6c84c]">
                    {selectedCountry.nameZh}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {referrerId && !currentPlayer ? (
          <p className="mt-5 rounded-xl border border-[#f6c84c]/50 bg-white px-4 py-3 text-sm font-bold text-[#071b3a] shadow-sm">
            你是通过好友邀请进入的，创建玩家后即可参与预测。
          </p>
        ) : null}

        {currentPlayer ? (
          <section className="mt-5 space-y-5">
            {notice ? (
              <div className="rounded-2xl border border-[#f6c84c]/36 bg-[#f6c84c]/12 p-4 text-sm font-black text-[#fff4bf]">
                <p>{notice}</p>
              </div>
            ) : null}

            <div className={`${gameStyles.panel} grid grid-cols-1 overflow-hidden min-[520px]:grid-cols-3`}>
              <div className="border-r border-white/10 p-4">
                <p className="text-xs font-bold text-white/55">我的金币</p>
                <p className="mt-1 text-xl font-black text-[#f6c84c]">
                  {currentPlayer.coins.toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="border-r border-white/10 p-4">
                <p className="text-xs font-bold text-white/55">全球排名</p>
                <p className="mt-1 text-xl font-black text-[#f6c84c]">
                  {homeOpsStatus.globalRank ? `No. ${homeOpsStatus.globalRank}` : "暂无"}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold text-white/55">连胜场次</p>
                <p className="mt-1 text-xl font-black text-[#8ef078]">
                  {homeOpsStatus.winStreak} 场
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
              <Link href="/predict" className={`${gameStyles.actionRed} min-h-[148px] lg:min-h-[168px]`}>
                <div className="absolute bottom-1 right-[-0.2rem] h-24 w-24 drop-shadow-[0_0_24px_rgba(255,210,120,0.58)] sm:h-28 sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/ui/football-ball.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="relative z-10 whitespace-nowrap text-2xl font-black text-white">预测比赛</p>
                <div className="absolute bottom-4 left-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/16 text-xl">
                  ›
                </div>
              </Link>
              <Link href="/collection" className={`${gameStyles.actionPurple} min-h-[148px] lg:min-h-[168px]`}>
                <div className="game-card-stack" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="relative z-10 whitespace-nowrap text-2xl font-black text-white">球星卡商城</p>
                <div className="absolute bottom-4 left-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/16 text-xl">
                  ›
                </div>
              </Link>
            </div>

            <section className={`${gameStyles.panel} p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_18px_48px_rgba(0,0,0,0.28)]`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">今日赛程</h2>
                <Link href="/predict" className="text-sm font-black text-white/55">
                  全部赛程 ›
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {todayMatches.length > 0 ? (
                  todayMatches.map((match) => {
                    const status = getHomeMatchStatusLabel(match);
                    return (
                      <div key={match.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-2xl border border-white/5 bg-black/18 px-3 py-3">
                        <div className="text-xs font-bold text-white/72">
                          <p>{formatHomeMatchTime(match.start_time)}</p>
                          <p className="mt-1 text-white/42">
                            {getHomeStageLabel(match.stage)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <CountryDisplay team={match.home_team} className="min-w-0 text-sm font-black text-white" />
                            <span className="shrink-0 text-xs font-black text-white/45">VS</span>
                            <CountryDisplay team={match.away_team} className="min-w-0 justify-end text-sm font-black text-white" />
                          </div>
                        </div>
                        <Link
                          href="/predict"
                          className={`rounded-xl px-3 py-2 text-xs font-black ${
                            status === "去预测"
                              ? "bg-[#e63535] text-white"
                              : status === "进行中"
                                ? "bg-[#fff4bf] text-[#071b3a]"
                                : "bg-white/12 text-white/70"
                          }`}
                        >
                          {status}
                        </Link>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-sm font-bold text-white/48">
                    暂无赛程数据
                  </p>
                )}
              </div>
            </section>

            <section className={`${gameStyles.goldPanel} overflow-hidden p-4`}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black text-[#fff4bf]">全球球王榜</h2>
                <Link
                  href="/leaderboard"
                  className="rounded-xl bg-[#f6c84c] px-4 py-2 text-sm font-black text-[#071b3a]"
                >
                  查看完整榜单 ›
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
                {leaderboardTop.length > 0 ? (
                  leaderboardTop.map((row, index) => (
                    <div key={`${row.nickname}-${row.region}`} className="rounded-2xl border border-[#f6c84c]/24 bg-[linear-gradient(180deg,rgba(246,200,76,0.12),rgba(0,0,0,0.24))] p-3 text-center shadow-inner">
                      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-[#071b3a] ${
                        index === 0
                          ? "bg-[#f6c84c]"
                          : index === 1
                            ? "bg-[#d9e2ec]"
                            : "bg-[#f4a261]"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="mx-auto mt-2 flex h-[74px] w-[52px] items-center justify-center overflow-hidden rounded-xl border border-[#f6c84c]/24 bg-black/28">
                        {row.equippedCard?.card_thumb_url || row.equippedCard?.card_art_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.equippedCard.card_thumb_url ?? row.equippedCard.card_art_url ?? ""}
                            alt={`${row.nickname} equipped card`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-lg text-[#f6c84c]/48">◇</span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-black text-white">
                        {row.nickname}
                      </p>
                      <p className="mt-1 text-sm font-black text-[#f6c84c]">
                        {row.total_points.toLocaleString("zh-CN")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="col-span-3 py-6 text-center text-sm font-bold text-white/48">
                    暂无排行榜数据
                  </p>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
              <Link href="/profile" className="rounded-3xl border border-[#25c7b7]/35 bg-[#063f33]/72 p-4 shadow-[0_12px_28px_rgba(37,199,183,0.12)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-black text-white">我的战绩</p>
                  <span className="text-lg font-black text-[#25c7b7]">›</span>
                </div>
                <p className="mt-2 text-xs font-bold text-white/55">查看预测记录</p>
              </Link>
              <Link href="/bracket" className="rounded-3xl border border-[#6176ff]/35 bg-[#172554]/78 p-4 shadow-[0_12px_28px_rgba(97,118,255,0.14)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-black text-white">晋级之路</p>
                  <span className="text-lg font-black text-[#92a3ff]">›</span>
                </div>
                <p className="mt-2 text-xs font-bold text-white/55">查看晋级历程</p>
              </Link>
              <Link href="/round-of-32-calculator" className="rounded-3xl border border-[#f6c84c]/35 bg-[#4a2f05]/72 p-4 shadow-[0_12px_28px_rgba(246,200,76,0.14)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-black text-white">32强对阵</p>
                  <span className="text-lg font-black text-[#f6c84c]">›</span>
                </div>
                <p className="mt-2 text-xs font-bold text-white/55">实时对阵图</p>
              </Link>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="min-w-0 truncate text-sm font-bold text-white/60">
                当前账号：<span className="text-white">{currentPlayer.nickname}</span>
                {rewardStatus ? (
                  <span className="ml-2 hidden text-[#f6c84c] sm:inline">
                    {rewardStatus}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={switchAccount}
                className="shrink-0 text-sm font-black text-white/70"
              >
                切换账号 / 退出登录 ›
              </button>
            </div>
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

        {currentPlayer ? (
          <nav className={gameStyles.nav}>
            <Link href="/" className="text-[#f6c84c]">
              <span className="block text-lg">◆</span>
              首页
            </Link>
            <Link href="/predict">
              <span className="block text-lg">▣</span>
              赛程
            </Link>
            <Link href="/profile">
              <span className="block text-lg">⬟</span>
              战绩
            </Link>
            <Link href="/collection">
              <span className="block text-lg">▰</span>
              卡册
            </Link>
            <Link href="/profile">
              <span className="block text-lg">●</span>
              我的
            </Link>
          </nav>
        ) : null}

        <div className="mt-8 text-center text-xs font-bold text-white/38">
          <p>官网：</p>
          <a
            href="https://2026wc.fun"
            className="text-[#f6c84c] underline underline-offset-4"
          >
            https://2026wc.fun
          </a>
        </div>
      </section>
    </main>
  );
}
