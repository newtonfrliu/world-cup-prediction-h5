"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
type MatchResult = NonNullable<Match["result"]>;

type MatchForm = {
  home_team: string;
  away_team: string;
  start_time: string;
  odds_home: string;
  odds_draw: string;
  odds_away: string;
  stage: string;
  venue: string;
};

type SyncOddsResponse = {
  updated: number;
  skipped: Array<{
    home_team: string;
    away_team: string;
  }>;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
  lastSyncAt: string;
  error?: string;
};

type StoredSyncResult = {
  updated: number;
  skipped: number;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
  lastSyncAt: string;
};

const emptyForm: MatchForm = {
  home_team: "",
  away_team: "",
  start_time: "",
  odds_home: "",
  odds_draw: "",
  odds_away: "",
  stage: "",
  venue: "",
};

const resultOptions: Array<{ label: string; value: MatchResult }> = [
  { label: "主胜", value: "home_win" },
  { label: "平局", value: "draw" },
  { label: "客胜", value: "away_win" },
];

const oddsSyncCooldownMs = 10 * 60 * 1000;

function formatMatchTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatSyncTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formFromMatch(match: Match): MatchForm {
  return {
    home_team: match.home_team,
    away_team: match.away_team,
    start_time: toDatetimeLocal(match.start_time),
    odds_home: String(match.odds_home),
    odds_draw: String(match.odds_draw),
    odds_away: String(match.odds_away),
    stage: match.stage ?? "",
    venue: match.venue ?? "",
  };
}

function formToPayload(form: MatchForm): MatchInsert {
  return {
    home_team: form.home_team.trim(),
    away_team: form.away_team.trim(),
    start_time: new Date(form.start_time).toISOString(),
    odds_home: Number(form.odds_home),
    odds_draw: Number(form.odds_draw),
    odds_away: Number(form.odds_away),
    stage: form.stage.trim() || null,
    venue: form.venue.trim() || null,
    status: "scheduled",
    result: null,
  };
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settlingMatchId, setSettlingMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchForm, setMatchForm] = useState<MatchForm>(emptyForm);
  const [editForm, setEditForm] = useState<MatchForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncingOdds, setSyncingOdds] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncResult, setLastSyncResult] =
    useState<StoredSyncResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canUseSupabase = useMemo(() => isSupabaseConfigured, []);
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  async function loadMatches() {
    if (!canUseSupabase) {
      setError("请先配置 Supabase 环境变量。");
      setLoading(false);
      return;
    }

    const { data, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, home_team, away_team, start_time, odds_home, odds_draw, odds_away, stage, venue, result, status, created_at",
      )
      .order("start_time", { ascending: true });

    if (matchError) {
      setError(matchError.message);
      setLoading(false);
      return;
    }

    setMatches(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setIsVerified(localStorage.getItem("admin_verified") === "true");
    const storedSyncResult = localStorage.getItem("odds_last_sync_result");

    if (storedSyncResult) {
      setLastSyncResult(JSON.parse(storedSyncResult) as StoredSyncResult);
    }
  }, []);

  useEffect(() => {
    if (!isVerified) {
      return;
    }

    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseSupabase, isVerified]);

  function verifyAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === adminPassword) {
      localStorage.setItem("admin_verified", "true");
      setIsVerified(true);
      setPasswordError("");
      return;
    }

    setPasswordError("密码错误");
  }

  function updateMatchForm(field: keyof MatchForm, value: string) {
    setMatchForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field: keyof MatchForm, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase
      .from("matches")
      .insert(formToPayload(matchForm));

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setMatchForm(emptyForm);
    setMessage("比赛已新增。");
    setSaving(false);
    await loadMatches();
  }

  async function syncOdds() {
    const lastSyncAt = localStorage.getItem("odds_last_sync_at");

    if (
      lastSyncAt &&
      Date.now() - new Date(lastSyncAt).getTime() < oddsSyncCooldownMs
    ) {
      setSyncMessage("距离上次同步不足10分钟，请稍后再试。");
      return;
    }

    setSyncingOdds(true);
    setSyncMessage("同步中...");
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/sync-odds", {
      method: "POST",
    });
    const result = (await response.json()) as SyncOddsResponse;

    if (!response.ok) {
      setError(result.error ?? "同步赔率失败。");
      setSyncMessage("");
      setSyncingOdds(false);
      return;
    }

    const storedResult: StoredSyncResult = {
      updated: result.updated,
      skipped: result.skipped.length,
      creditsUsed: result.creditsUsed,
      creditsRemaining: result.creditsRemaining,
      creditsTotalUsed: result.creditsTotalUsed,
      lastSyncAt: result.lastSyncAt,
    };

    localStorage.setItem("odds_last_sync_at", result.lastSyncAt);
    localStorage.setItem("odds_last_sync_result", JSON.stringify(storedResult));
    setLastSyncResult(storedResult);
    setSyncMessage(
      `同步完成：Updated ${result.updated} matches, Skipped ${result.skipped.length} matches, Credits used: ${result.creditsUsed ?? "-"}`,
    );
    setSyncingOdds(false);
    await loadMatches();
  }

  function startEdit(match: Match) {
    setEditingMatchId(match.id);
    setEditForm(formFromMatch(match));
    setError("");
    setMessage("");
  }

  async function saveEdit(matchId: string) {
    setSaving(true);
    setError("");
    setMessage("");

    const payload = formToPayload(editForm);
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        home_team: payload.home_team,
        away_team: payload.away_team,
        start_time: payload.start_time,
        odds_home: payload.odds_home,
        odds_draw: payload.odds_draw,
        odds_away: payload.odds_away,
        stage: payload.stage,
        venue: payload.venue,
      })
      .eq("id", matchId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setEditingMatchId(null);
    setMessage("比赛已更新。");
    setSaving(false);
    await loadMatches();
  }

  async function deleteMatch(match: Match) {
    if (match.status === "finished") {
      setError("已结束比赛不能删除。");
      return;
    }

    if (!window.confirm(`确认删除 ${match.home_team} VS ${match.away_team}？`)) {
      return;
    }

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("id", match.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("比赛已删除。");
    setMatches((current) => current.filter((item) => item.id !== match.id));
  }

  async function settleMatch(match: Match, result: MatchResult) {
    if (settlingMatchId) {
      return;
    }

    setSettlingMatchId(match.id);
    setError("");
    setMessage("");

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        result,
        status: "finished",
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      setError(matchUpdateError.message);
      setSettlingMatchId(null);
      return;
    }

    const { data: predictions, error: predictionLoadError } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, odds_at_prediction, points, created_at",
      )
      .eq("match_id", match.id);

    if (predictionLoadError) {
      setError(predictionLoadError.message);
      setSettlingMatchId(null);
      return;
    }

    const updates = ((predictions ?? []) as Prediction[]).map((prediction) =>
      supabase
        .from("predictions")
        .update({
          points:
            prediction.prediction === result
              ? Math.round(prediction.odds_at_prediction * 100)
              : 0,
        })
        .eq("id", prediction.id),
    );

    const updateResults = await Promise.all(updates);
    const failedUpdate = updateResults.find((item) => item.error);

    if (failedUpdate?.error) {
      setError(failedUpdate.error.message);
      setSettlingMatchId(null);
      return;
    }

    setMatches((current) =>
      current.map((item) =>
        item.id === match.id ? { ...item, result, status: "finished" } : item,
      ),
    );
    setMessage("结算完成，排行榜积分会自动更新。");
    setSettlingMatchId(null);
  }

  const renderMatchFields = (
    form: MatchForm,
    onChange: (field: keyof MatchForm, value: string) => void,
  ) => (
    <div className="grid gap-3">
      <input
        value={form.home_team}
        onChange={(event) => onChange("home_team", event.target.value)}
        className="h-11 rounded-md border border-[#cbd2d9] px-3"
        placeholder="主队"
        required
      />
      <input
        value={form.away_team}
        onChange={(event) => onChange("away_team", event.target.value)}
        className="h-11 rounded-md border border-[#cbd2d9] px-3"
        placeholder="客队"
        required
      />
      <input
        value={form.start_time}
        onChange={(event) => onChange("start_time", event.target.value)}
        className="h-11 rounded-md border border-[#cbd2d9] px-3"
        type="datetime-local"
        required
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          value={form.odds_home}
          onChange={(event) => onChange("odds_home", event.target.value)}
          className="h-11 min-w-0 rounded-md border border-[#cbd2d9] px-3"
          min="0"
          step="0.01"
          type="number"
          placeholder="主胜"
          required
        />
        <input
          value={form.odds_draw}
          onChange={(event) => onChange("odds_draw", event.target.value)}
          className="h-11 min-w-0 rounded-md border border-[#cbd2d9] px-3"
          min="0"
          step="0.01"
          type="number"
          placeholder="平局"
          required
        />
        <input
          value={form.odds_away}
          onChange={(event) => onChange("odds_away", event.target.value)}
          className="h-11 min-w-0 rounded-md border border-[#cbd2d9] px-3"
          min="0"
          step="0.01"
          type="number"
          placeholder="客胜"
          required
        />
      </div>
      <input
        value={form.stage}
        onChange={(event) => onChange("stage", event.target.value)}
        className="h-11 rounded-md border border-[#cbd2d9] px-3"
        placeholder="stage"
      />
      <input
        value={form.venue}
        onChange={(event) => onChange("venue", event.target.value)}
        className="h-11 rounded-md border border-[#cbd2d9] px-3"
        placeholder="venue"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-xl">
        {!isVerified ? (
          <div className="flex min-h-[calc(100vh-3rem)] flex-col justify-center">
            <h1 className="text-3xl font-black text-[#102a43]">管理员验证</h1>
            <form onSubmit={verifyAdmin} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-[#334e68]">
                  请输入管理员密码
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="mt-2 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-4 text-base outline-none transition focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
                  placeholder="请输入管理员密码"
                />
              </label>

              {passwordError ? (
                <p className="rounded-md bg-[#fde8e8] px-3 py-2 text-sm text-[#9b1c1c]">
                  {passwordError}
                </p>
              ) : null}

              <button
                type="submit"
                className="h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525]"
              >
                进入后台
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase text-[#d64545]">
                  Admin
                </p>
                <h1 className="mt-2 text-3xl font-black text-[#102a43]">
                  比赛后台
                </h1>
              </div>
              <Link
                href="/leaderboard"
                className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
              >
                排行榜
              </Link>
            </div>

            {error ? (
              <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="mb-5 rounded-lg border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm text-[#0f7b3f]">
                {message}
              </div>
            ) : null}

            {syncMessage ? (
              <div className="mb-5 rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm text-[#334e68]">
                {syncMessage}
              </div>
            ) : null}

            {lastSyncResult ? (
              <div className="mb-5 rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm text-[#334e68]">
                <p>上次同步：{formatSyncTime(lastSyncResult.lastSyncAt)}</p>
                <p>更新比赛：{lastSyncResult.updated}</p>
                <p>跳过比赛：{lastSyncResult.skipped}</p>
                <p>本次消耗：{lastSyncResult.creditsUsed ?? "-"} credits</p>
                <p>
                  剩余额度：{lastSyncResult.creditsRemaining ?? "-"} credits
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={syncingOdds}
              onClick={syncOdds}
              className="mb-6 h-11 w-full rounded-md bg-[#102a43] px-4 text-sm font-bold text-white transition hover:bg-[#243b53] disabled:bg-[#9fb3c8]"
            >
              {syncingOdds ? "同步中..." : "同步赔率"}
            </button>

            <form
              onSubmit={createMatch}
              className="mb-6 rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
            >
              <h2 className="mb-4 text-xl font-black text-[#102a43]">
                新增比赛
              </h2>
              {renderMatchFields(matchForm, updateMatchForm)}
              <button
                type="submit"
                disabled={saving}
                className="mt-4 h-11 w-full rounded-md bg-[#d64545] px-4 text-sm font-bold text-white transition hover:bg-[#ba2525] disabled:bg-[#9fb3c8]"
              >
                保存比赛
              </button>
            </form>

            <h2 className="mb-4 text-xl font-black text-[#102a43]">
              比赛列表
            </h2>

            {loading ? (
              <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
                加载比赛中...
              </div>
            ) : null}

            {!loading && matches.length === 0 ? (
              <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 text-sm text-[#52606d]">
                暂无比赛。
              </div>
            ) : null}

            <div className="space-y-4">
              {matches.map((match) => {
                const isSettling = settlingMatchId === match.id;
                const isFinished = match.status === "finished";
                const isEditing = editingMatchId === match.id;

                return (
                  <article
                    key={match.id}
                    className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
                  >
                    {isEditing ? (
                      <div>
                        {renderMatchFields(editForm, updateEditForm)}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveEdit(match.id)}
                            className="h-10 rounded-md bg-[#d64545] text-sm font-bold text-white disabled:bg-[#9fb3c8]"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMatchId(null)}
                            className="h-10 rounded-md border border-[#cbd2d9] bg-white text-sm font-bold text-[#334e68]"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-black text-[#102a43]">
                              {match.home_team} VS {match.away_team}
                            </h3>
                            <p className="mt-2 text-sm text-[#627d98]">
                              {formatMatchTime(match.start_time)}
                            </p>
                            <p className="mt-2 text-sm text-[#627d98]">
                              status: {match.status ?? "-"} · result:{" "}
                              {match.result ?? "-"}
                            </p>
                            <p className="mt-1 text-sm text-[#627d98]">
                              {match.stage ?? "-"} · {match.venue ?? "-"}
                            </p>
                          </div>
                          {isFinished ? (
                            <span className="shrink-0 rounded-md bg-[#e3f9e5] px-2 py-1 text-xs font-bold text-[#0f7b3f]">
                              已结束
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-md bg-[#f0f4f8] px-2 py-2">
                            主胜 {match.odds_home}
                          </div>
                          <div className="rounded-md bg-[#f0f4f8] px-2 py-2">
                            平局 {match.odds_draw}
                          </div>
                          <div className="rounded-md bg-[#f0f4f8] px-2 py-2">
                            客胜 {match.odds_away}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {resultOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              disabled={Boolean(settlingMatchId)}
                              onClick={() => settleMatch(match, option.value)}
                              className="h-10 rounded-md bg-[#d64545] px-2 text-sm font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
                            >
                              {isSettling ? "结算中" : option.label}
                            </button>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(match)}
                            className="h-10 rounded-md border border-[#cbd2d9] bg-white text-sm font-bold text-[#334e68]"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            disabled={isFinished}
                            onClick={() => deleteMatch(match)}
                            className="h-10 rounded-md border border-[#f7c6c7] bg-white text-sm font-bold text-[#9b1c1c] disabled:cursor-not-allowed disabled:border-[#d9e2ec] disabled:text-[#9fb3c8]"
                          >
                            删除
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
