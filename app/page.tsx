"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen bg-[#f6f3ec] px-5 py-8 text-[#1f2933]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-[#d64545]">
          2026 足球世界杯
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-[#102a43]">
          美加墨大乱斗
        </h1>
        <p className="mt-4 text-base leading-7 text-[#52606d]">
          选好主队，留下昵称，进入你的世界杯预测战场。
        </p>

        {referrerId ? (
          <p className="mt-5 rounded-lg border border-[#fad1d1] bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#9b1c1c]">
            你是通过好友邀请进入的，创建玩家后即可参与预测。
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-[#334e68]">昵称</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-4 text-base outline-none transition focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
              placeholder="输入你的昵称"
              maxLength={24}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#334e68]">
              主队国家
            </span>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-4 text-base outline-none transition focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
            >
              {countries.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#334e68]">地区</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-4 text-base outline-none transition focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
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
            className="h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
          >
            {isSubmitting ? "提交中..." : "开始预测"}
          </button>

          <Link
            href="/leaderboard"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-[#cbd2d9] bg-white px-5 text-base font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
          >
            排行榜
          </Link>

          <Link
            href="/profile"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-[#cbd2d9] bg-white px-5 text-base font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
          >
            我的战绩
          </Link>

          <Link
            href="/bracket"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-[#cbd2d9] bg-white px-5 text-base font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
          >
            世界杯晋级之路
          </Link>
        </form>

        <div className="mt-8 text-center text-sm font-semibold text-[#627d98]">
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
