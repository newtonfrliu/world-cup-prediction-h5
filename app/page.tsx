"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CountryDisplay } from "@/components/CountryDisplay";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTeamDisplayName, worldCupTeams } from "@/lib/teamMeta";

const countries = worldCupTeams.map((team) => ({
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
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState(countries[0].value);
  const [region, setRegion] = useState(regions[0]);
  const [referrerId, setReferrerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const trimmedNickname = nickname.trim();
  const isNicknameEmpty = trimmedNickname.length === 0;

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");

    if (ref) {
      localStorage.setItem("referrer_id", ref);
      setReferrerId(ref);
    }
  }, []);

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

    const { data: existingPlayers, error: lookupError } = await supabase
      .from("players")
      .select("id, created_at")
      .eq("nickname", trimmedNickname)
      .eq("country", country)
      .eq("region", region)
      .order("created_at", { ascending: true });

    if (lookupError) {
      setError(lookupError.message);
      setIsSubmitting(false);
      return;
    }

    const existingPlayer = existingPlayers?.[0];

    if (existingPlayer) {
      localStorage.setItem("player_id", existingPlayer.id);
      setNotice("欢迎回来");
      router.push("/predict");
      return;
    }

    const { data: createdPlayer, error: insertError } = await supabase
      .from("players")
      .insert({
        nickname: trimmedNickname,
        country,
        region,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    localStorage.setItem("player_id", createdPlayer.id);
    setNotice("创建成功");
    router.push("/predict");
  }

  return (
    <main className="wc-page px-5 py-8">
      <section className="wc-shell flex min-h-[calc(100vh-4rem)] flex-col justify-center">
        <div className="wc-dark-card p-5">
          <p className="text-sm font-black text-[#25c7b7]">2026足球世界杯</p>
          <h1 className="mt-3 text-5xl font-black leading-none text-white">
            美加墨
            <br />
            大乱斗
          </h1>
          <p className="mt-4 text-base font-bold leading-7 text-[#f6c84c]">
            预测世界杯 / 挑战好友 / 争夺全球第一
          </p>
        </div>

        {referrerId ? (
          <p className="mt-5 rounded-xl border border-[#f6c84c]/50 bg-white px-4 py-3 text-sm font-bold text-[#071b3a] shadow-sm">
            你是通过好友邀请进入的，创建玩家后即可参与预测。
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="wc-card mt-5 space-y-5 p-5">
          <div>
            <p className="wc-kicker">Entry Card</p>
            <h2 className="mt-1 text-2xl font-black text-[#071b3a]">
              领取你的球迷入场卡
            </h2>
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

          {error ? (
            <p className="rounded-md bg-[#fde8e8] px-3 py-2 text-sm text-[#9b1c1c]">
              {error}
            </p>
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
            {isSubmitting ? "提交中..." : "开始预测"}
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
            href="/bracket"
            className="wc-button-secondary w-full"
          >
            世界杯晋级之路
          </Link>
        </form>

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
