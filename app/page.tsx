"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const countries = [
  { label: "美国", value: "USA" },
  { label: "加拿大", value: "Canada" },
  { label: "墨西哥", value: "Mexico" },
];

const regions = [
  "华北",
  "华东",
  "华南",
  "华中",
  "西南",
  "西北",
  "东北",
  "港澳台",
  "海外",
];

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState(countries[0].value);
  const [region, setRegion] = useState(regions[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trimmedNickname = nickname.trim();
  const isNicknameEmpty = trimmedNickname.length === 0;

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
    setError("");

    const { data, error: insertError } = await supabase
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

    localStorage.setItem("player_id", data.id);
    router.push("/predict");
  }

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-5 py-8 text-[#1f2933]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-[#d64545]">
          2026 Battle
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-[#102a43]">
          美加墨大乱斗
        </h1>
        <p className="mt-4 text-base leading-7 text-[#52606d]">
          选好主队，留下昵称，进入你的世界杯预测战场。
        </p>

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
        </form>
      </section>
    </main>
  );
}
