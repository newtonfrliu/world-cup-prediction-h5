"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  settlePredictionMarket,
} from "@/lib/predictionSettlement";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTeamDisplayName } from "@/lib/teamMeta";
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

type KnockoutSettlementInput = {
  regularHomeScore: string;
  regularAwayScore: string;
  finalHomeScore: string;
  finalAwayScore: string;
  advancementWinner: "home" | "away" | "";
};

type AdvanceOddsInput = {
  homeAdvanceOdds: string;
  awayAdvanceOdds: string;
};

type SyncOddsResponse = {
  success?: boolean;
  updated: number;
  skipped: Array<{
    home_team: string;
    away_team: string;
    reason?: string;
  }>;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
  lastSyncAt: string;
  error?: unknown;
  settingsWarning?: string;
};

type StoredSyncResult = {
  updated: number;
  skipped: number;
  creditsUsed: string | null;
  creditsRemaining: string | null;
  creditsTotalUsed: string | null;
  lastSyncAt: string;
};

type SyncScoresResponse = {
  finished: number;
  settled: number;
  skipped: Array<{
    home_team: string;
    away_team: string;
    reason: string;
  }>;
  error?: string;
};

type WorldCupSyncLog = {
  step: "scores" | "knockout" | "odds";
  status: "pending" | "success" | "skipped" | "failed";
  message: string;
};

type WorldCupSyncResponse = {
  success: boolean;
  message: string;
  logs: WorldCupSyncLog[];
  scores?: unknown;
  knockout?: unknown;
  odds?: unknown;
  error?: unknown;
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

const emptyKnockoutSettlementInput: KnockoutSettlementInput = {
  regularHomeScore: "",
  regularAwayScore: "",
  finalHomeScore: "",
  finalAwayScore: "",
  advancementWinner: "",
};

const emptyAdvanceOddsInput: AdvanceOddsInput = {
  homeAdvanceOdds: "",
  awayAdvanceOdds: "",
};

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

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}

function isMissingPredictionStatusError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();

  return (
    message.includes("'status' column of 'predictions'") ||
    message.includes("predictions.status") ||
    message.includes("settled_at") ||
    message.includes("schema cache")
  );
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

function legacyResultToBettingResult(result: MatchResult) {
  if (result === "home_win") return "home";
  if (result === "away_win") return "away";
  return "draw";
}

function getBettingResultFromRegularScore(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

function isKnockoutStage(stage: string | null | undefined) {
  const normalized = (stage ?? "").trim().toLowerCase();

  return [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
    "knockout",
  ].includes(normalized);
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
  const [knockoutSettlementInputs, setKnockoutSettlementInputs] = useState<
    Record<string, KnockoutSettlementInput>
  >({});
  const [advanceOddsInputs, setAdvanceOddsInputs] = useState<
    Record<string, AdvanceOddsInput>
  >({});
  const [saving, setSaving] = useState(false);
  const [syncingWorldCup, setSyncingWorldCup] = useState(false);
  const [syncingOdds, setSyncingOdds] = useState(false);
  const [syncingScores, setSyncingScores] = useState(false);
  const [worldCupSyncMessage, setWorldCupSyncMessage] = useState("");
  const [worldCupSyncLogs, setWorldCupSyncLogs] = useState<WorldCupSyncLog[]>([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [scoreSyncMessage, setScoreSyncMessage] = useState("");
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
        "id, match_number, group_name, home_team, away_team, start_time, odds_home, odds_draw, odds_away, home_score, away_score, regular_home_score, regular_away_score, betting_result, final_home_score, final_away_score, advancement_winner, stage, venue, result, status, created_at",
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

    let result: SyncOddsResponse;

    try {
      const response = await fetch("/api/admin/sync-odds", {
        method: "POST",
      });

      result = (await response.json()) as SyncOddsResponse;

      if (!response.ok) {
        setError(formatErrorMessage(result.error ?? result));
        setSyncMessage("");
        setSyncingOdds(false);
        return;
      }
    } catch (fetchError) {
      setError(formatErrorMessage(fetchError));
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

    if (result.settingsWarning) {
      setError(result.settingsWarning);
    }

    setSyncingOdds(false);
    await loadMatches();
  }

  async function syncScores() {
    setSyncingScores(true);
    setScoreSyncMessage("同步赛果中...");
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/sync-scores", {
      method: "POST",
    });
    const result = (await response.json()) as SyncScoresResponse;

    if (!response.ok) {
      setError(result.error ?? "同步赛果失败。");
      setScoreSyncMessage("");
      setSyncingScores(false);
      return;
    }

    setScoreSyncMessage(
      `同步完成：Finished ${result.finished} matches, Settled ${result.settled} predictions, Skipped ${result.skipped.length} matches`,
    );
    setSyncingScores(false);
    await loadMatches();
  }

  async function syncWorldCup() {
    setSyncingWorldCup(true);
    setWorldCupSyncMessage("一键更新世界杯执行中...");
    setWorldCupSyncLogs([
      { step: "scores", status: "pending", message: "等待同步赛果并结算" },
      { step: "knockout", status: "pending", message: "等待同步淘汰赛落位" },
      { step: "odds", status: "pending", message: "等待同步赔率" },
    ]);
    setError("");
    setMessage("");
    setSyncMessage("");
    setScoreSyncMessage("");

    try {
      const response = await fetch("/api/admin/sync-world-cup", {
        method: "POST",
      });
      const result = (await response.json()) as WorldCupSyncResponse;

      setWorldCupSyncLogs(result.logs ?? []);
      setWorldCupSyncMessage(result.message);

      if (!response.ok || !result.success) {
        setError(result.message || formatErrorMessage(result.error));
      } else {
        setMessage(result.message);
      }
    } catch (syncError) {
      setError(formatErrorMessage(syncError));
      setWorldCupSyncMessage("一键更新世界杯失败。");
    } finally {
      setSyncingWorldCup(false);
      await loadMatches();
    }
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

    if (
      !window.confirm(
        `确认删除 ${getTeamDisplayName(match.home_team)} VS ${getTeamDisplayName(match.away_team)}？`,
      )
    ) {
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

    if (match.status === "finished") {
      setError("比赛已结束，不能重复结算。");
      return;
    }

    setSettlingMatchId(match.id);
    setError("");
    setMessage("");

    const bettingResult = legacyResultToBettingResult(result);
    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        result,
        betting_result: bettingResult,
        status: "finished",
      })
      .eq("id", match.id);

    if (matchUpdateError) {
      setError(matchUpdateError.message);
      setSettlingMatchId(null);
      return;
    }

    let hasSettlementColumns = true;
    let { data: predictions, error: predictionLoadError } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, market_key, market_label, selection_key, selection_label, line, created_at",
      )
      .eq("match_id", match.id)
      .or("status.is.null,status.eq.active");

    if (predictionLoadError) {
      if (!isMissingPredictionStatusError(predictionLoadError)) {
        setError(predictionLoadError.message);
        setSettlingMatchId(null);
        return;
      }

      hasSettlementColumns = false;
      console.error("admin settle fallback without prediction status", {
        matchId: match.id,
        error: predictionLoadError,
      });
      const fallbackResult = await supabase
        .from("predictions")
        .select(
          "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, points, market_key, market_label, selection_key, selection_label, line, created_at",
        )
        .eq("match_id", match.id);

      predictions = fallbackResult.data as typeof predictions;
      predictionLoadError = fallbackResult.error;

      if (predictionLoadError) {
        setError(predictionLoadError.message);
        setSettlingMatchId(null);
        return;
      }
    }

    for (const prediction of (predictions ?? []) as Prediction[]) {
      if (hasSettlementColumns && prediction.settled_at) {
        continue;
      }

      const settlement = settlePredictionMarket(prediction, {
        betting_result: bettingResult,
        result,
        home_score: match.home_score,
        away_score: match.away_score,
        regular_home_score: match.regular_home_score,
        regular_away_score: match.regular_away_score,
        advancement_winner: match.advancement_winner,
      });

      if (!settlement) {
        continue;
      }

      const { points, payout, status } = settlement;

      const { error: predictionUpdateError } = await supabase
        .from("predictions")
        .update(
          hasSettlementColumns
            ? { points, payout, status, settled_at: new Date().toISOString() }
            : { points, payout },
        )
        .eq("id", prediction.id);

      if (predictionUpdateError) {
        setError(predictionUpdateError.message);
        setSettlingMatchId(null);
        return;
      }

      if (payout > 0 && (prediction.payout ?? 0) === 0) {
        const { data: player, error: playerLoadError } = await supabase
          .from("players")
          .select("coins")
          .eq("id", prediction.player_id)
          .single();

        if (playerLoadError) {
          setError(playerLoadError.message);
          setSettlingMatchId(null);
          return;
        }

        const { error: playerUpdateError } = await supabase
          .from("players")
          .update({ coins: player.coins + payout })
          .eq("id", prediction.player_id);

        if (playerUpdateError) {
          setError(playerUpdateError.message);
          setSettlingMatchId(null);
          return;
        }
      }
    }

    setMatches((current) =>
      current.map((item) =>
        item.id === match.id
          ? { ...item, result, betting_result: bettingResult, status: "finished" }
          : item,
      ),
    );
    setMessage("结算完成，排行榜积分和中奖金币会自动更新。");
    setSettlingMatchId(null);
  }

  function updateKnockoutSettlementInput(
    matchId: string,
    field: keyof KnockoutSettlementInput,
    value: string,
  ) {
    setKnockoutSettlementInputs((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? emptyKnockoutSettlementInput),
        [field]: value,
      },
    }));
  }

  function updateAdvanceOddsInput(
    matchId: string,
    field: keyof AdvanceOddsInput,
    value: string,
  ) {
    setAdvanceOddsInputs((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? emptyAdvanceOddsInput),
        [field]: value,
      },
    }));
  }

  async function saveAdvanceOdds(match: Match) {
    const input = advanceOddsInputs[match.id] ?? emptyAdvanceOddsInput;
    const homeOdds = Number(input.homeAdvanceOdds);
    const awayOdds = Number(input.awayAdvanceOdds);

    if (!Number.isFinite(homeOdds) || !Number.isFinite(awayOdds) || homeOdds <= 0 || awayOdds <= 0) {
      setError("请填写有效的主队/客队晋级赔率。");
      return;
    }

    setError("");
    setMessage("");

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("match_betting_markets")
      .upsert(
        [
          {
            match_id: match.id,
            market_key: "advance",
            selection_key: "home_advance",
            selection_label: `${getTeamDisplayName(match.home_team)} 晋级`,
            odds: homeOdds,
            line: 0,
            source: "manual",
            bookmaker: null,
            is_active: true,
            updated_at: now,
          },
          {
            match_id: match.id,
            market_key: "advance",
            selection_key: "away_advance",
            selection_label: `${getTeamDisplayName(match.away_team)} 晋级`,
            odds: awayOdds,
            line: 0,
            source: "manual",
            bookmaker: null,
            is_active: true,
            updated_at: now,
          },
        ],
        { onConflict: "match_id,market_key,selection_key,line" },
      );

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setMessage("晋级投注赔率已保存。");
  }

  async function settleKnockoutMatch(match: Match) {
    if (settlingMatchId) {
      return;
    }

    if (match.status === "finished") {
      setError("比赛已结束，不能重复结算。");
      return;
    }

    const input =
      knockoutSettlementInputs[match.id] ?? emptyKnockoutSettlementInput;
    const regularHomeScore = Number(input.regularHomeScore);
    const regularAwayScore = Number(input.regularAwayScore);
    const finalHomeScore =
      input.finalHomeScore.trim() === "" ? null : Number(input.finalHomeScore);
    const finalAwayScore =
      input.finalAwayScore.trim() === "" ? null : Number(input.finalAwayScore);

    if (
      !Number.isInteger(regularHomeScore) ||
      !Number.isInteger(regularAwayScore) ||
      regularHomeScore < 0 ||
      regularAwayScore < 0
    ) {
      setError("请填写有效的90分钟比分。");
      return;
    }

    if (
      (finalHomeScore !== null &&
        (!Number.isInteger(finalHomeScore) || finalHomeScore < 0)) ||
      (finalAwayScore !== null &&
        (!Number.isInteger(finalAwayScore) || finalAwayScore < 0))
    ) {
      setError("请填写有效的最终比分，或留空。");
      return;
    }

    if (input.advancementWinner !== "home" && input.advancementWinner !== "away") {
      setError("请选择淘汰赛晋级方。");
      return;
    }
    const advancementWinner: "home" | "away" = input.advancementWinner;

    setSettlingMatchId(match.id);
    setError("");
    setMessage("");

    const bettingResult = getBettingResultFromRegularScore(
      regularHomeScore,
      regularAwayScore,
    );
    const legacyResult =
      bettingResult === "home"
        ? "home_win"
        : bettingResult === "away"
          ? "away_win"
          : "draw";
    const displayHomeScore = finalHomeScore ?? regularHomeScore;
    const displayAwayScore = finalAwayScore ?? regularAwayScore;

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        regular_home_score: regularHomeScore,
        regular_away_score: regularAwayScore,
        betting_result: bettingResult,
        final_home_score: displayHomeScore,
        final_away_score: displayAwayScore,
        advancement_winner: advancementWinner,
        home_score: displayHomeScore,
        away_score: displayAwayScore,
        result: legacyResult,
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
        "id, player_id, match_id, prediction, odds_at_prediction, stake, payout, status, settled_at, points, market_key, market_label, selection_key, selection_label, line, created_at",
      )
      .eq("match_id", match.id)
      .or("status.is.null,status.eq.active");

    if (predictionLoadError) {
      setError(predictionLoadError.message);
      setSettlingMatchId(null);
      return;
    }

    for (const prediction of (predictions ?? []) as Prediction[]) {
      if (prediction.settled_at) {
        continue;
      }

      const settlement = settlePredictionMarket(prediction, {
        betting_result: bettingResult,
        result: legacyResult,
        regular_home_score: regularHomeScore,
        regular_away_score: regularAwayScore,
        home_score: displayHomeScore,
        away_score: displayAwayScore,
        advancement_winner: advancementWinner,
      });

      if (!settlement) {
        continue;
      }

      const { points, payout, status } = settlement;

      const { error: predictionUpdateError } = await supabase
        .from("predictions")
        .update({ points, payout, status, settled_at: new Date().toISOString() })
        .eq("id", prediction.id);

      if (predictionUpdateError) {
        setError(predictionUpdateError.message);
        setSettlingMatchId(null);
        return;
      }

      if (payout > 0 && (prediction.payout ?? 0) === 0) {
        const { data: player, error: playerLoadError } = await supabase
          .from("players")
          .select("coins")
          .eq("id", prediction.player_id)
          .single();

        if (playerLoadError) {
          setError(playerLoadError.message);
          setSettlingMatchId(null);
          return;
        }

        const { error: playerUpdateError } = await supabase
          .from("players")
          .update({ coins: player.coins + payout })
          .eq("id", prediction.player_id);

        if (playerUpdateError) {
          setError(playerUpdateError.message);
          setSettlingMatchId(null);
          return;
        }
      }
    }

    setMatches((current) =>
      current.map((item) =>
        item.id === match.id
          ? {
              ...item,
              regular_home_score: regularHomeScore,
              regular_away_score: regularAwayScore,
              betting_result: bettingResult,
              final_home_score: displayHomeScore,
              final_away_score: displayAwayScore,
              advancement_winner: advancementWinner,
              home_score: displayHomeScore,
              away_score: displayAwayScore,
              result: legacyResult,
              status: "finished",
            }
          : item,
      ),
    );
    setMessage("淘汰赛90分钟竞猜结果已结算，晋级方已单独记录。");
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
    <main className="wc-page px-4 py-6 text-[#1f2933]">
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
                className="h-12 w-full rounded-lg bg-[#e63535] px-5 text-base font-bold text-white transition hover:bg-[#ba2525]"
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

            {scoreSyncMessage ? (
              <div className="mb-5 rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm text-[#334e68]">
                {scoreSyncMessage}
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

            <div className="mb-6 rounded-lg border border-[#f6c84c] bg-[#fff8dc] p-4 shadow-sm">
              <button
                type="button"
                disabled={syncingWorldCup || syncingScores || syncingOdds}
                onClick={syncWorldCup}
                className="h-12 w-full rounded-md bg-[#071b3a] px-4 text-sm font-black text-[#f6c84c] transition hover:bg-[#102a43] disabled:bg-[#9fb3c8] disabled:text-white"
              >
                {syncingWorldCup ? "一键更新中..." : "一键更新世界杯"}
              </button>

              {worldCupSyncMessage ? (
                <p className="mt-3 text-sm font-semibold text-[#102a43]">
                  {worldCupSyncMessage}
                </p>
              ) : null}

              {worldCupSyncLogs.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {worldCupSyncLogs.map((log) => {
                    const statusClass =
                      log.status === "success"
                        ? "border-[#bae6bd] bg-[#e3f9e5] text-[#0f7b3f]"
                        : log.status === "failed"
                          ? "border-[#f7c6c7] bg-[#fde8e8] text-[#9b1c1c]"
                          : log.status === "skipped"
                            ? "border-[#f6c84c] bg-[#fffbea] text-[#8d5f00]"
                            : "border-[#d9e2ec] bg-white text-[#52606d]";
                    const stepLabel =
                      log.step === "scores"
                        ? "赛果结算"
                        : log.step === "knockout"
                          ? "淘汰赛落位"
                          : "赔率同步";

                    return (
                      <div
                        key={log.step}
                        className={`rounded-md border px-3 py-2 text-xs font-semibold ${statusClass}`}
                      >
                        {stepLabel}：{log.message}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={syncingOdds}
              onClick={syncOdds}
              className="mb-6 h-11 w-full rounded-md bg-[#071b3a] px-4 text-sm font-bold text-white transition hover:bg-[#102a43] disabled:bg-[#9fb3c8]"
            >
              {syncingOdds ? "同步中..." : "同步赔率"}
            </button>

            <button
              type="button"
              disabled={syncingScores}
              onClick={syncScores}
              className="mb-6 h-11 w-full rounded-md bg-[#e63535] px-4 text-sm font-bold text-white transition hover:bg-[#ba2525] disabled:bg-[#9fb3c8]"
            >
              {syncingScores ? "同步赛果中..." : "同步赛果并结算"}
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
                              {getTeamDisplayName(match.home_team)} VS{" "}
                              {getTeamDisplayName(match.away_team)}
                            </h3>
                            <p className="mt-2 text-sm text-[#627d98]">
                              {formatMatchTime(match.start_time)}
                            </p>
                            <p className="mt-2 text-sm text-[#627d98]">
                              status: {match.status ?? "-"} · result:{" "}
                              {match.result ?? "-"}
                            </p>
                            <p className="mt-1 text-sm text-[#627d98]">
                              betting_result: {match.betting_result ?? "-"} ·
                              advancement_winner:{" "}
                              {match.advancement_winner ?? "-"}
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

                        {isKnockoutStage(match.stage) ? (
                          <div className="mt-4 rounded-lg border border-[#d8b4fe] bg-[#faf5ff] p-3">
                            <p className="text-sm font-black text-[#581c87]">
                              晋级投注赔率
                            </p>
                            <p className="mt-1 text-xs text-[#6b21a8]">
                              仅淘汰赛显示；结算只看最终晋级方。
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input
                                value={
                                  advanceOddsInputs[match.id]?.homeAdvanceOdds ??
                                  ""
                                }
                                onChange={(event) =>
                                  updateAdvanceOddsInput(
                                    match.id,
                                    "homeAdvanceOdds",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#d8b4fe] px-3 text-sm"
                                inputMode="decimal"
                                placeholder={`${getTeamDisplayName(match.home_team)} 晋级赔率`}
                              />
                              <input
                                value={
                                  advanceOddsInputs[match.id]?.awayAdvanceOdds ??
                                  ""
                                }
                                onChange={(event) =>
                                  updateAdvanceOddsInput(
                                    match.id,
                                    "awayAdvanceOdds",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#d8b4fe] px-3 text-sm"
                                inputMode="decimal"
                                placeholder={`${getTeamDisplayName(match.away_team)} 晋级赔率`}
                              />
                              <button
                                type="button"
                                onClick={() => saveAdvanceOdds(match)}
                                className="h-10 rounded-md bg-[#7e22ce] px-4 text-sm font-bold text-white transition hover:bg-[#6b21a8]"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {isKnockoutStage(match.stage) ? (
                          <div className="mt-4 rounded-lg border border-[#f7d070] bg-[#fffbea] p-3">
                            <p className="text-sm font-black text-[#7c5e10]">
                              淘汰赛90分钟结算
                            </p>
                            <p className="mt-1 text-xs text-[#8d6f1b]">
                              竞猜只按90分钟比分结算；最终比分和晋级方只用于晋级路径。
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <input
                                value={
                                  knockoutSettlementInputs[match.id]
                                    ?.regularHomeScore ?? ""
                                }
                                onChange={(event) =>
                                  updateKnockoutSettlementInput(
                                    match.id,
                                    "regularHomeScore",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#f7d070] px-3 text-sm"
                                inputMode="numeric"
                                placeholder="90分钟主队比分"
                              />
                              <input
                                value={
                                  knockoutSettlementInputs[match.id]
                                    ?.regularAwayScore ?? ""
                                }
                                onChange={(event) =>
                                  updateKnockoutSettlementInput(
                                    match.id,
                                    "regularAwayScore",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#f7d070] px-3 text-sm"
                                inputMode="numeric"
                                placeholder="90分钟客队比分"
                              />
                              <input
                                value={
                                  knockoutSettlementInputs[match.id]
                                    ?.finalHomeScore ?? ""
                                }
                                onChange={(event) =>
                                  updateKnockoutSettlementInput(
                                    match.id,
                                    "finalHomeScore",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#f7d070] px-3 text-sm"
                                inputMode="numeric"
                                placeholder="最终主队比分"
                              />
                              <input
                                value={
                                  knockoutSettlementInputs[match.id]
                                    ?.finalAwayScore ?? ""
                                }
                                onChange={(event) =>
                                  updateKnockoutSettlementInput(
                                    match.id,
                                    "finalAwayScore",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#f7d070] px-3 text-sm"
                                inputMode="numeric"
                                placeholder="最终客队比分"
                              />
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                              <select
                                value={
                                  knockoutSettlementInputs[match.id]
                                    ?.advancementWinner ?? ""
                                }
                                onChange={(event) =>
                                  updateKnockoutSettlementInput(
                                    match.id,
                                    "advancementWinner",
                                    event.target.value,
                                  )
                                }
                                className="h-10 rounded-md border border-[#f7d070] px-3 text-sm"
                              >
                                <option value="">选择晋级方</option>
                                <option value="home">
                                  {getTeamDisplayName(match.home_team)} 晋级
                                </option>
                                <option value="away">
                                  {getTeamDisplayName(match.away_team)} 晋级
                                </option>
                              </select>
                              <button
                                type="button"
                                disabled={Boolean(settlingMatchId)}
                                onClick={() => settleKnockoutMatch(match)}
                                className="h-10 rounded-md bg-[#7c5e10] px-4 text-sm font-bold text-white transition hover:bg-[#5f4608] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
                              >
                                {isSettling ? "结算中" : "按90分钟结算"}
                              </button>
                            </div>
                          </div>
                        ) : null}

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
