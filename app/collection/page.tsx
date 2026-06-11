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

const exchangeCost = 100;

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

function StarCard({
  card,
  owned,
}: {
  card: PlayerCard;
  owned: boolean;
}) {
  const country = getCountryByNameEn(card.team);
  const theme = getCountryTheme(card.team);

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
        <p className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-black text-[#071b3a]">
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
          {owned ? card.player_name : "未收集"}
        </h2>
        <p className="mt-1 text-xs font-bold text-[#627d98]">
          {card.position ?? "-"} · {getCountryDisplayName(card.team)}
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
  const [exchanging, setExchanging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const theme = getCountryTheme(player?.country);
  const country = player ? getCountryByNameEn(player.country) : null;
  const ownedCount = ownedCardIds.size;
  const totalCount = cards.length;
  const unownedCards = cards.filter((card) => !ownedCardIds.has(card.id));

  async function loadCollection(currentPlayerId: string) {
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("id, nickname, country, coins")
      .eq("id", currentPlayerId)
      .single();

    if (playerError) {
      throw playerError;
    }

    setPlayer(playerData);

    const { data: cardData, error: cardError } = await supabase
      .from("player_cards")
      .select(
        "id, team, player_name, player_name_en, position, shirt_number, rarity, card_image, created_at",
      )
      .eq("team", playerData.country)
      .order("shirt_number", { ascending: true });

    if (cardError) {
      throw cardError;
    }

    const { data: userCardData, error: userCardError } = await supabase
      .from("user_cards")
      .select("card_id")
      .eq("player_id", currentPlayerId);

    if (userCardError) {
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "卡册加载失败，请确认已执行 Phase 3 SQL migration。",
        );
      }

      setLoading(false);
    }

    load();
  }, [canUseSupabase]);

  async function exchangeCard() {
    if (!playerId || !player || exchanging) {
      return;
    }

    if (player.coins < exchangeCost) {
      setError("金币不足，无法兑换。");
      return;
    }

    if (unownedCards.length === 0) {
      setMessage("你已集齐该国家队卡册");
      return;
    }

    setExchanging(true);
    setError("");
    setMessage("");

    const selectedCard =
      unownedCards[Math.floor(Math.random() * unownedCards.length)];
    const { error: insertError } = await supabase.from("user_cards").insert({
      player_id: playerId,
      card_id: selectedCard.id,
    });

    if (insertError) {
      setError(insertError.message);
      setExchanging(false);
      return;
    }

    const nextCoins = player.coins - exchangeCost;
    const { error: coinError } = await supabase
      .from("players")
      .update({ coins: nextCoins })
      .eq("id", playerId);

    if (coinError) {
      await supabase.from("user_cards").delete().match({
        player_id: playerId,
        card_id: selectedCard.id,
      });
      setError(coinError.message);
      setExchanging(false);
      return;
    }

    await supabase.from("coin_transactions").insert({
      player_id: playerId,
      amount: -exchangeCost,
      type: "card_exchange",
      related_id: selectedCard.id,
    });

    setPlayer({ ...player, coins: nextCoins });
    setOwnedCardIds((current) => new Set(current).add(selectedCard.id));
    setMessage(`兑换成功：${selectedCard.player_name}`);
    setExchanging(false);
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
          className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: theme.cardGradient, boxShadow: theme.glow }}
        >
          {country ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={country.flag}
              alt={`${country.nameZh} flag`}
              className="absolute -right-10 -top-4 h-32 w-44 rotate-[-8deg] rounded-2xl object-cover opacity-20"
            />
          ) : null}
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f6c84c]">
            Collection Album
          </p>
          <h1 className="mt-2 text-3xl font-black">我的国家队卡册</h1>
          <p className="mt-3 text-sm font-bold">
            {player ? <CountryDisplay team={player.country} /> : "-"} 国家队卡册
          </p>
          <p className="mt-4 text-2xl font-black">
            已收集 {ownedCount} / {totalCount}
          </p>
          <p className="mt-2 text-sm font-bold text-white/80">
            金币余额：{player?.coins ?? 0}
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
          <h2 className="text-xl font-black text-[#071b3a]">金币兑换</h2>
          <p className="mt-2 text-sm font-bold text-[#627d98]">
            每次消耗 100 金币，随机获得一张未拥有的主队球星卡。
          </p>
          <button
            type="button"
            onClick={exchangeCard}
            disabled={
              exchanging ||
              !player ||
              player.coins < exchangeCost ||
              unownedCards.length === 0
            }
            className="wc-button mt-4 w-full"
          >
            {unownedCards.length === 0
              ? "你已集齐该国家队卡册"
              : exchanging
                ? "兑换中..."
                : "兑换一张球星卡"}
          </button>
          {player && player.coins < exchangeCost ? (
            <p className="mt-3 text-sm font-bold text-[#e63535]">
              金币不足 100，无法兑换。
            </p>
          ) : null}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <StarCard
              key={card.id}
              card={card}
              owned={ownedCardIds.has(card.id)}
            />
          ))}
        </section>
      </section>
    </main>
  );
}
