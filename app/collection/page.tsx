"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import {
  getCountryByNameEn,
  getCountryTheme,
  getCountryDisplayName,
} from "@/lib/countries";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Player = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "nickname" | "country" | "coins"
>;
type PlayerCard = Database["public"]["Tables"]["player_cards"]["Row"];
type UserCard = Pick<
  Database["public"]["Tables"]["user_cards"]["Row"],
  "card_id"
>;

function getRarityLabel(rarity: string) {
  const labels: Record<string, string> = {
    common: "普通",
    rare: "稀有",
    epic: "史诗",
    legend: "传奇",
  };

  return labels[rarity] ?? rarity;
}

function getRarityClass(rarity: string) {
  if (rarity === "legend") {
    return "border-[#f6c84c] bg-[#fff8db] text-[#071b3a]";
  }

  if (rarity === "epic") {
    return "border-[#25c7b7] bg-[#e6fffb] text-[#071b3a]";
  }

  if (rarity === "rare") {
    return "border-[#e63535] bg-[#fde8e8] text-[#071b3a]";
  }

  return "border-[#d9e2ec] bg-white text-[#071b3a]";
}

function formatCoins(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return typeof error === "string" ? error : JSON.stringify(error);
}

function StarCard({
  card,
  owned,
  coins,
  exchangingCardId,
  onExchange,
}: {
  card: PlayerCard;
  owned: boolean;
  coins: number;
  exchangingCardId: string;
  onExchange: (card: PlayerCard) => void;
}) {
  const country = getCountryByNameEn(card.team);
  const theme = getCountryTheme(card.team);
  const price = card.price ?? 5000;
  const starLevel = card.star_level ?? 1;
  const canExchange = !owned && coins >= price && exchangingCardId === "";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border-2 p-3 shadow-sm ${
        owned ? getRarityClass(card.rarity) : "border-[#d9e2ec] bg-[#e4e7eb]"
      }`}
    >
      <div
        className="relative h-40 overflow-hidden rounded-xl text-white"
        style={{ background: theme.cardGradient }}
      >
        <p className="absolute left-3 top-3 text-[10px] font-black uppercase tracking-[0.16em]">
          2026 Card
        </p>
        <p className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-black text-[#071b3a] shadow-sm">
          #{card.shirt_number ?? "-"}
        </p>
        {country ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={country.flag}
            alt={`${country.nameZh} flag`}
            className="absolute -right-6 bottom-4 h-20 w-28 rotate-[-10deg] rounded-xl object-cover opacity-20"
          />
        ) : null}
        <svg
          viewBox="0 0 160 160"
          className="absolute bottom-0 left-1/2 h-32 w-32 -translate-x-1/2"
          aria-hidden="true"
        >
          <circle cx="80" cy="42" r="28" fill="rgba(255,255,255,0.9)" />
          <path
            d="M36 142c5-48 83-48 88 0H36Z"
            fill="rgba(255,255,255,0.92)"
          />
          <path
            d="M52 90c16 16 40 16 56 0"
            fill="none"
            stroke={theme.accent}
            strokeWidth="10"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="mt-3 rounded-xl bg-white/90 p-3">
        <h2 className="truncate text-lg font-black">
          {card.player_name}
        </h2>
        <p className="mt-1 text-xs font-bold text-[#627d98]">
          {card.position ?? "-"} · {getCountryDisplayName(card.team)}
        </p>
        <p className="mt-2 text-xs font-black text-[#e63535]">
          {"★".repeat(starLevel)}
          <span className="text-[#9fb3c8]">{"★".repeat(5 - starLevel)}</span>
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="rounded-full bg-[#f6c84c] px-2 py-1 text-[11px] font-black text-[#071b3a]">
            {getRarityLabel(card.rarity)}
          </span>
          {country ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={country.flag}
              alt={`${country.nameZh} flag`}
              className="wc-flag"
            />
          ) : null}
        </div>
        <p className="mt-3 text-sm font-black text-[#071b3a]">
          价格：{formatCoins(price)} 金币
        </p>
        <button
          type="button"
          onClick={() => onExchange(card)}
          disabled={!canExchange}
          className={`mt-3 h-10 w-full rounded-xl text-sm font-black ${
            owned
              ? "bg-[#e3f9e5] text-[#0f7b3f]"
              : canExchange
                ? "bg-[#e63535] text-white"
                : "bg-[#e4e7eb] text-[#829ab1]"
          }`}
        >
          {owned
            ? "已拥有"
            : exchangingCardId === card.id
              ? "兑换中..."
              : "兑换"}
        </button>
      </div>
    </article>
  );
}

export default function CollectionPage() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [exchangingCardId, setExchangingCardId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const theme = getCountryTheme(player?.country);
  const country = player ? getCountryByNameEn(player.country) : null;
  const ownedCount = ownedCardIds.size;
  const totalCount = cards.length;

  async function loadCollection(currentPlayerId: string) {
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("id, nickname, country, coins")
      .eq("id", currentPlayerId)
      .single();

    if (playerError) {
      console.error("collection player query failed", {
        playerId: currentPlayerId,
        error: playerError,
      });
      throw playerError;
    }

    setPlayer(playerData);

    const { data: cardData, error: cardError } = await supabase
      .from("player_cards")
      .select(
        "id, team, player_name, player_name_en, position, shirt_number, rarity, price, star_level, card_image, created_at",
      )
      .eq("team", playerData.country)
      .order("shirt_number", { ascending: true });

    if (cardError) {
      console.error("collection player_cards query failed", {
        team: playerData.country,
        error: cardError,
      });
      throw cardError;
    }

    if ((cardData ?? []).length === 0) {
      setCards([]);
      setOwnedCardIds(new Set());
      return;
    }

    const { data: userCardData, error: userCardError } = await supabase
      .from("user_cards")
      .select("card_id")
      .eq("player_id", currentPlayerId);

    if (userCardError) {
      console.error("collection user_cards query failed", {
        playerId: currentPlayerId,
        error: userCardError,
      });
      throw userCardError;
    }

    setCards(cardData ?? []);
    setOwnedCardIds(
      new Set(((userCardData ?? []) as UserCard[]).map((item) => item.card_id)),
    );
  }

  useEffect(() => {
    async function load() {
      const storedPlayerId = localStorage.getItem("player_id");
      setPlayerId(storedPlayerId);

      if (!storedPlayerId) {
        setLoading(false);
        return;
      }

      if (!canUseSupabase) {
        setError("请先配置 Supabase 环境变量。");
        setLoading(false);
        return;
      }

      try {
        await loadCollection(storedPlayerId);
      } catch (loadError) {
        console.error("collection load failed", {
          playerId: storedPlayerId,
          error: loadError,
        });
        setError(getErrorMessage(loadError));
      }

      setLoading(false);
    }

    load();
  }, [canUseSupabase]);

  async function exchangeCard(card: PlayerCard) {
    if (!playerId || !player || exchangingCardId) {
      return;
    }

    if (ownedCardIds.has(card.id)) {
      setMessage("你已拥有这张球星卡");
      return;
    }

    const price = card.price ?? 5000;

    if (player.coins < price) {
      setError(`金币不足，还差 ${formatCoins(price - player.coins)} 金币`);
      return;
    }

    setExchangingCardId(card.id);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase.from("user_cards").insert({
      player_id: playerId,
      card_id: card.id,
    });

    if (insertError) {
      console.error("collection user_cards insert failed", {
        playerId,
        card,
        error: insertError,
      });
      setError(insertError.message);
      setExchangingCardId("");
      return;
    }

    const nextCoins = player.coins - price;
    const { error: coinError } = await supabase
      .from("players")
      .update({ coins: nextCoins })
      .eq("id", playerId);

    if (coinError) {
      console.error("collection coins update failed", {
        playerId,
        card,
        nextCoins,
        error: coinError,
      });
      await supabase.from("user_cards").delete().match({
        player_id: playerId,
        card_id: card.id,
      });
      setError(coinError.message);
      setExchangingCardId("");
      return;
    }

    await supabase.from("coin_transactions").insert({
      player_id: playerId,
      amount: -price,
      type: "card_exchange",
      related_id: card.id,
    });

    setPlayer({ ...player, coins: nextCoins });
    setOwnedCardIds((current) => new Set(current).add(card.id));
    setMessage(`成功兑换 ${card.player_name} 球星卡`);
    setExchangingCardId("");
  }

  if (loading) {
    return (
      <main className="wc-page px-4 py-6">
        <section className="wc-shell wc-card p-5 text-sm text-[#627d98]">
          加载卡册中...
        </section>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="wc-page px-4 py-6">
        <section className="wc-shell wc-card p-5">
          <h1 className="text-2xl font-black text-[#071b3a]">球星收藏馆</h1>
          <p className="mt-3 text-sm text-[#627d98]">
            请先返回首页创建玩家。
          </p>
          <Link href="/" className="wc-button mt-5">
            返回首页
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="wc-page px-4 py-6">
      <section className="wc-shell">
        <div
          className="relative overflow-hidden rounded-2xl bg-[#071b3a] p-5 text-white"
          style={{ boxShadow: theme.glow }}
        >
          <div
            className="absolute inset-0 opacity-80"
            style={{ background: theme.cardGradient }}
          />
          <div className="absolute inset-0 bg-[#071b3a]/72" />
          {country ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={country.flag}
              alt={`${country.nameZh} flag`}
              className="absolute -right-10 -top-4 h-32 w-44 rotate-[-8deg] rounded-2xl object-cover opacity-[0.1]"
            />
          ) : null}
          <p className="relative text-xs font-black uppercase tracking-[0.18em] text-[#f6c84c] drop-shadow">
            Collection Album
          </p>
          <h1 className="relative mt-2 text-3xl font-black text-[#f6c84c] drop-shadow">
            我的国家队卡册
          </h1>
          <p className="relative mt-3 text-sm font-black text-white drop-shadow">
            {player ? <CountryDisplay team={player.country} /> : "-"} 国家队卡册
          </p>
          <p className="relative mt-4 text-2xl font-black text-white drop-shadow">
            已收集 {ownedCount} / {totalCount}
          </p>
          <p className="relative mt-2 text-sm font-black text-white drop-shadow">
            金币余额：{formatCoins(player?.coins ?? 0)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/" className="wc-button-secondary">
            首页
          </Link>
          <Link href="/profile" className="wc-button-secondary">
            我的战绩
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm font-bold text-[#9b1c1c]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-xl border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm font-bold text-[#0f7b3f]">
            {message}
          </div>
        ) : null}

        <section className="wc-card mt-5 p-4">
          <h2 className="text-xl font-black text-[#071b3a]">可兑换卡册</h2>
          <p className="mt-2 text-sm font-bold text-[#627d98]">
            点击具体球星卡兑换。价格由星级决定，最低 5000 金币。
          </p>
          {totalCount === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f6f1e7] p-4 text-sm font-bold text-[#627d98]">
              当前主队暂无球星卡数据，请先执行 Phase 3 SQL migration 或等待后续球员名单更新。
            </p>
          ) : null}
          {totalCount > 0 && ownedCount === totalCount ? (
            <p className="mt-4 rounded-xl bg-[#e3f9e5] p-4 text-sm font-bold text-[#0f7b3f]">
              你已集齐该国家队卡册
            </p>
          ) : null}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <StarCard
              key={card.id}
              card={card}
              owned={ownedCardIds.has(card.id)}
              coins={player?.coins ?? 0}
              exchangingCardId={exchangingCardId}
              onExchange={exchangeCard}
            />
          ))}
        </section>
      </section>
    </main>
  );
}
