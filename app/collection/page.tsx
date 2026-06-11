"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CountryDisplay } from "@/components/CountryDisplay";
import { PlayerCardMini } from "@/components/PlayerCardMini";
import {
  getCanonicalTeamName,
  getCountryByNameEn,
  getCountryTheme,
  getCountryDisplayName,
} from "@/lib/countries";
import { getStoredPlayerId } from "@/lib/playerSession";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Player = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "id" | "nickname" | "country" | "coins" | "equipped_card_id"
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
  equippedCardId,
  onExchange,
  onEquip,
}: {
  card: PlayerCard;
  owned: boolean;
  coins: number;
  exchangingCardId: string;
  equippedCardId?: string | null;
  onExchange: (card: PlayerCard) => void;
  onEquip: (card: PlayerCard) => void;
}) {
  const country = getCountryByNameEn(card.team);
  const price = card.price ?? 5000;
  const starLevel = card.star_level ?? 1;
  const canExchange = !owned && coins >= price && exchangingCardId === "";
  const isEquipped = equippedCardId === card.id;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border-2 p-3 shadow-sm ${
        owned ? getRarityClass(card.rarity) : "border-[#d9e2ec] bg-[#e4e7eb]"
      }`}
    >
      <div className="flex justify-center">
        <PlayerCardMini
          card={card}
          country={card.team}
          size="large"
          equipped={isEquipped}
          locked={!owned}
        />
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
        {owned ? (
          <button
            type="button"
            onClick={() => onEquip(card)}
            disabled={isEquipped}
            className={`mt-2 h-10 w-full rounded-xl text-sm font-black ${
              isEquipped
                ? "bg-[#f6c84c] text-[#071b3a]"
                : "bg-[#071b3a] text-white"
            }`}
          >
            {isEquipped ? "已装备" : "装备"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function CollectionPage() {
  const router = useRouter();
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
  const country = player ? getCountryByNameEn(getCanonicalTeamName(player.country)) : null;
  const themeAccentText =
    theme.textOnTheme === "dark" ? "#AA151B" : theme.accent;
  const ownedCount = ownedCardIds.size;
  const totalCount = cards.length;

  async function loadCollection(currentPlayerId: string) {
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("id, nickname, country, coins, equipped_card_id")
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
    console.log("PLAYER_COUNTRY", playerData.country);

    const canonicalTeamName = getCanonicalTeamName(playerData.country);
    console.log("PLAYER_COUNTRY", player?.country);
    console.log("CANONICAL_TEAM", canonicalTeamName);
    console.log("PLAYER_CARD_QUERY_TEAM", canonicalTeamName);

    const { count } = await supabase
      .from("player_cards")
      .select("*", { count: "exact", head: true });

    console.log("PLAYER_CARD_TOTAL_COUNT", count);

    const { data: sampleCards } = await supabase
      .from("player_cards")
      .select("team, player_name")
      .limit(5);

    console.log("PLAYER_CARD_SAMPLE", sampleCards);

    const { data: cardData, error: cardError } = await supabase
      .from("player_cards")
      .select("*")
      .eq("team", canonicalTeamName)
      .order("shirt_number", { ascending: true });
    console.log("CARDS_RETURNED", cardData?.length);
    console.log("FIRST_CARD", cardData?.[0]);

    if (cardError) {
      console.error("collection player_cards query failed", {
        rawTeam: playerData.country,
        canonicalTeamName,
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
      console.log("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
      const storedPlayerId = getStoredPlayerId();
      setPlayerId(storedPlayerId);

      if (!storedPlayerId) {
        router.replace("/");
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
  }, [canUseSupabase, router]);

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

  async function equipCard(card: PlayerCard) {
    if (!playerId || !player || !ownedCardIds.has(card.id)) {
      return;
    }

    setError("");
    setMessage("");

    const { error: equipError } = await supabase
      .from("players")
      .update({ equipped_card_id: card.id })
      .eq("id", playerId);

    if (equipError) {
      console.error("collection equip card failed", {
        playerId,
        card,
        error: equipError,
      });
      setError(equipError.message);
      return;
    }

    setPlayer({ ...player, equipped_card_id: card.id });
    setMessage(`已装备 ${card.player_name} 球星卡`);
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
          className="relative overflow-hidden rounded-2xl bg-[#071b3a] p-5"
          style={{ boxShadow: theme.glow, color: theme.foreground }}
        >
          <div
            className="absolute inset-0 opacity-80"
            style={{ background: theme.cardGradient }}
          />
          <div
            className="absolute inset-0"
            style={{ background: theme.overlay }}
          />
          {country ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={country.flag}
              alt={`${country.nameZh} flag`}
              className="absolute -right-10 -top-4 h-32 w-44 rotate-[-8deg] rounded-2xl object-cover opacity-[0.1]"
            />
          ) : null}
          <p
            className="relative text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: themeAccentText }}
          >
            Collection Album
          </p>
          <h1
            className="relative mt-2 text-3xl font-black"
            style={{ color: theme.foreground }}
          >
            我的国家队卡册
          </h1>
          <p
            className="relative mt-3 text-sm font-black"
            style={{ color: theme.foreground }}
          >
            {player ? <CountryDisplay team={player.country} /> : "-"} 国家队卡册
          </p>
          <p
            className="relative mt-4 text-2xl font-black"
            style={{ color: theme.foreground }}
          >
            {totalCount > 0 ? `已收集 ${ownedCount} / ${totalCount}` : "卡册整理中"}
          </p>
          <p
            className="relative mt-2 text-sm font-black"
            style={{ color: theme.mutedForeground }}
          >
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
            收集你的国家队球星卡，打造专属世界杯卡册。
          </p>
          {totalCount === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f6f1e7] p-4 text-sm font-bold text-[#627d98]">
              卡册整理中，请稍后再来。
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
              equippedCardId={player?.equipped_card_id}
              onExchange={exchangeCard}
              onEquip={equipCard}
            />
          ))}
        </section>
      </section>
    </main>
  );
}
