"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  formatTeamDisplayName,
  getKnockoutWinner,
  getWinnerTeam,
  groupKnockoutMatches,
  inferKnockoutMatchNumber,
  isPlaceholderTeamName,
  knockoutStageLabels,
  type KnockoutMatch,
  type KnockoutStageKey,
} from "@/lib/knockout-bracket";

type StoredPick = {
  winner: string;
  loser: string;
  updatedAt: string;
};

type PickMap = Record<string, StoredPick>;

type BracketSlot = {
  number: number;
  stage: KnockoutStageKey;
  match: KnockoutMatch | null;
  homeTeam: string | null;
  awayTeam: string | null;
  winner: string | null;
  loser: string | null;
  source: "real" | "user" | null;
};

const storageKey = "knockoutBracketPredictionV1";
const round32Numbers = Array.from({ length: 16 }, (_, index) => 73 + index);
const round16Numbers = Array.from({ length: 8 }, (_, index) => 89 + index);
const quarterNumbers = [97, 98, 99, 100];
const semiNumbers = [101, 102];
const finalNumber = 104;
const thirdPlaceNumber = 103;

const nextRoundSources: Record<number, [number, number]> = {
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 100],
  102: [99, 98],
  104: [101, 102],
};

const thirdPlaceSources: [number, number] = [101, 102];

function formatMatchTime(value?: string | null) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待定";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(match?: KnockoutMatch | null, locked?: boolean) {
  if (!match) return "待生成";
  if (match.status === "finished") return "已结束";
  if (locked) return "已锁定";
  return "可预测";
}

function getScore(match?: KnockoutMatch | null) {
  if (!match) return "- : -";

  if (
    typeof match.final_home_score === "number" &&
    typeof match.final_away_score === "number"
  ) {
    return `${match.final_home_score} : ${match.final_away_score}`;
  }

  if (
    typeof match.home_score === "number" &&
    typeof match.away_score === "number"
  ) {
    return `${match.home_score} : ${match.away_score}`;
  }

  return "- : -";
}

function getRegularScore(match?: KnockoutMatch | null) {
  if (
    match &&
    typeof match.regular_home_score === "number" &&
    typeof match.regular_away_score === "number"
  ) {
    return `90分钟 ${match.regular_home_score}:${match.regular_away_score}`;
  }

  return null;
}

function isStartedOrLocked(match?: KnockoutMatch | null) {
  if (!match) return false;
  const status = (match.status ?? "").toLowerCase();

  if (status === "finished" || status === "in_progress" || status === "live") {
    return true;
  }

  const startTime = match.start_time ? new Date(match.start_time).getTime() : Number.NaN;

  return Number.isFinite(startTime) && startTime <= Date.now();
}

function isSelectableTeam(team?: string | null) {
  return Boolean(team && !isPendingTeamName(team));
}

function isPendingTeamName(team?: string | null) {
  const raw = (team ?? "").trim();

  return (
    !raw ||
    raw === "-" ||
    raw === "待定" ||
    /^tbd$/i.test(raw) ||
    /^m\d+\s*(胜者|负者)$/i.test(raw) ||
    isPlaceholderTeamName(raw)
  );
}

function validStoredPick(slot: BracketSlot, pick?: StoredPick) {
  if (!pick || !slot.homeTeam || !slot.awayTeam) return null;
  if (isPendingTeamName(pick.winner) || isPendingTeamName(pick.loser)) {
    return null;
  }

  const teams = [slot.homeTeam, slot.awayTeam];

  if (!teams.includes(pick.winner) || !teams.includes(pick.loser)) {
    return null;
  }

  return pick;
}

function loadStoredPicks(): PickMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}");

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as PickMap;
  } catch {
    return {};
  }
}

function splitHalf<T>(items: T[]) {
  const middle = Math.ceil(items.length / 2);
  return [items.slice(0, middle), items.slice(middle)] as const;
}

function matchByNumber(matches: KnockoutMatch[]) {
  const map = new Map<number, KnockoutMatch>();
  const unresolvedSemifinals: KnockoutMatch[] = [];
  const unresolvedFinals: KnockoutMatch[] = [];
  const unresolvedThirdPlace: KnockoutMatch[] = [];

  for (const match of matches) {
    const number = inferKnockoutMatchNumber(match);

    if (number) {
      map.set(number, match);
      continue;
    }

    const normalizedStage = (match.stage ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (normalizedStage === "semi_final" || normalizedStage === "semi_finals") {
      unresolvedSemifinals.push(match);
    } else if (normalizedStage === "final") {
      unresolvedFinals.push(match);
    } else if (normalizedStage === "third_place") {
      unresolvedThirdPlace.push(match);
    }
  }

  const byStartTime = (left: KnockoutMatch, right: KnockoutMatch) =>
    new Date(left.start_time ?? "").getTime() -
    new Date(right.start_time ?? "").getTime();

  unresolvedSemifinals.sort(byStartTime).forEach((match, index) => {
    if (index < 2 && !map.has(101 + index)) {
      map.set(101 + index, match);
    }
  });

  unresolvedThirdPlace.sort(byStartTime).forEach((match) => {
    if (!map.has(thirdPlaceNumber)) {
      map.set(thirdPlaceNumber, match);
    }
  });

  unresolvedFinals.sort(byStartTime).forEach((match) => {
    if (!map.has(finalNumber)) {
      map.set(finalNumber, match);
    }
  });

  return map;
}

function buildBracketSlots(matches: KnockoutMatch[], picks: PickMap) {
  const byNumber = matchByNumber(matches);
  const slots = new Map<number, BracketSlot>();

  function getRealWinner(match: KnockoutMatch | null) {
    if (!match || match.status !== "finished") return null;
    const winner = getWinnerTeam(match);
    const side = getKnockoutWinner(match);
    const loser =
      side === "home"
        ? match.away_team
        : side === "away"
          ? match.home_team
          : null;

    return winner && loser ? { winner, loser } : null;
  }

  function resolveSlot(number: number, stage: KnockoutStageKey): BracketSlot {
    const existing = slots.get(number);
    if (existing) return existing;

    const match = byNumber.get(number) ?? null;
    let homeTeam = match?.home_team ?? null;
    let awayTeam = match?.away_team ?? null;

    const shouldDeriveTeamsFromSources =
      !match ||
      isPlaceholderTeamName(match.home_team) ||
      isPlaceholderTeamName(match.away_team);

    if (nextRoundSources[number] && shouldDeriveTeamsFromSources) {
      const [homeSource, awaySource] = nextRoundSources[number];
      homeTeam = resolveSlot(
        homeSource,
        homeSource >= 101 ? "semiFinals" : homeSource >= 97 ? "quarterFinals" : "roundOf16",
      ).winner;
      awayTeam = resolveSlot(
        awaySource,
        awaySource >= 101 ? "semiFinals" : awaySource >= 97 ? "quarterFinals" : "roundOf16",
      ).winner;
    } else if (number === thirdPlaceNumber && shouldDeriveTeamsFromSources) {
      const [leftSemi, rightSemi] = thirdPlaceSources;
      homeTeam = resolveSlot(leftSemi, "semiFinals").loser;
      awayTeam = resolveSlot(rightSemi, "semiFinals").loser;
    }

    let winner: string | null = null;
    let loser: string | null = null;
    let source: BracketSlot["source"] = null;
    const realResult = getRealWinner(match);

    if (realResult) {
      winner = realResult.winner;
      loser = realResult.loser;
      source = "real";
    } else if (homeTeam && awayTeam) {
      const pick = validStoredPick(
        { number, stage, match, homeTeam, awayTeam, winner: null, loser: null, source: null },
        picks[String(number)],
      );

      if (pick) {
        winner = pick.winner;
        loser = pick.loser;
        source = "user";
      }
    }

    const slot = { number, stage, match, homeTeam, awayTeam, winner, loser, source };
    slots.set(number, slot);
    return slot;
  }

  for (const number of round32Numbers) resolveSlot(number, "roundOf32");
  for (const number of round16Numbers) resolveSlot(number, "roundOf16");
  for (const number of quarterNumbers) resolveSlot(number, "quarterFinals");
  for (const number of semiNumbers) resolveSlot(number, "semiFinals");
  resolveSlot(finalNumber, "final");
  resolveSlot(thirdPlaceNumber, "thirdPlace");

  return slots;
}

function TeamRow({
  slot,
  side,
  onSelect,
}: {
  slot: BracketSlot;
  side: "home" | "away";
  onSelect: (team: string) => void;
}) {
  const team = side === "home" ? slot.homeTeam : slot.awayTeam;
  const display = formatTeamDisplayName(team);
  const isWinner = Boolean(slot.winner) && !isPendingTeamName(slot.winner) && slot.winner === team;
  const isLoser = Boolean(slot.loser) && !isPendingTeamName(slot.loser) && slot.loser === team;
  const isLocked = slot.stage === "roundOf32" || isStartedOrLocked(slot.match);
  const canSelect =
    slot.stage !== "roundOf32" &&
    !isLocked &&
    isSelectableTeam(team) &&
    isSelectableTeam(slot.homeTeam) &&
    isSelectableTeam(slot.awayTeam);

  return (
    <button
      type="button"
      disabled={!canSelect}
      onClick={() => team && onSelect(team)}
      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
        slot.source === "real" && isWinner
          ? "border-[#f6c84c] bg-[#f6c84c]/24 text-[#fff4bf] shadow-[0_0_20px_rgba(246,200,76,0.22)]"
          : isWinner
            ? "border-[#f6c84c]/80 bg-[#f6c84c]/16 text-[#fff4bf]"
            : isLoser
              ? "border-white/5 bg-black/18 text-white/42"
              : "border-white/10 bg-white/[0.055] text-white"
      } ${canSelect ? "cursor-pointer hover:border-[#f6c84c]/70 hover:bg-[#f6c84c]/12" : "cursor-default"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {display.flag ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.flag}
            alt={`${display.label} flag`}
            className="h-5 w-7 shrink-0 rounded-[4px] object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-5 w-7 shrink-0 items-center justify-center rounded-[4px] border border-white/10 bg-white/8 text-[10px] text-white/45">
            -
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-black">
          {display.label}
        </span>
      </span>
      {isWinner ? (
        <span className="shrink-0 rounded-full bg-[#f6c84c] px-2 py-0.5 text-[10px] font-black text-[#071b3a]">
          {slot.source === "real" ? "晋级" : "已选"}
        </span>
      ) : null}
    </button>
  );
}

function MatchCard({
  slot,
  compact = false,
  onSelect,
}: {
  slot: BracketSlot;
  compact?: boolean;
  onSelect: (slot: BracketSlot, team: string) => void;
}) {
  const regularScore = getRegularScore(slot.match);
  const locked = slot.stage === "roundOf32" || isStartedOrLocked(slot.match);
  const canSelect =
    slot.stage !== "roundOf32" &&
    !locked &&
    isSelectableTeam(slot.homeTeam) &&
    isSelectableTeam(slot.awayTeam);

  return (
    <article
      className={`relative rounded-2xl border border-[#2f70d8]/36 bg-[linear-gradient(145deg,rgba(18,35,91,0.94),rgba(5,12,34,0.95))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.32)] transition ${
        canSelect ? "hover:border-[#f6c84c]/45" : ""
      } ${compact ? "min-h-[132px]" : "min-h-[154px]"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#f6c84c]/80">
        <span>M{slot.number}</span>
        <span className="rounded-full border border-white/10 bg-white/7 px-2 py-0.5 text-white/56">
          {getStatusLabel(slot.match, locked)}
        </span>
      </div>
      <div className="space-y-2">
        <TeamRow slot={slot} side="home" onSelect={(team) => onSelect(slot, team)} />
        <TeamRow slot={slot} side="away" onSelect={(team) => onSelect(slot, team)} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0 text-[11px] font-bold text-white/45">
          <p>{formatMatchTime(slot.match?.start_time)}</p>
          {regularScore ? <p className="mt-0.5">{regularScore}</p> : null}
          {locked && slot.stage !== "roundOf32" && slot.source !== "real" ? (
            <p className="mt-0.5 text-[#f6c84c]/70">比赛已开始，无法修改</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{getScore(slot.match)}</p>
          {slot.source === "real" ? (
            <p className="mt-0.5 text-[11px] font-black text-[#f6c84c]">
              已按真实赛果更新
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RoundColumn({
  title,
  slots,
  compact,
  onSelect,
}: {
  title: string;
  slots: BracketSlot[];
  compact?: boolean;
  onSelect: (slot: BracketSlot, team: string) => void;
}) {
  return (
    <section className="w-[250px] shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black tracking-[0.2em] text-[#fff4bf]">
          {title}
        </h2>
        <span className="ml-3 h-px flex-1 bg-[#f6c84c]/24" />
      </div>
      <div className="space-y-4">
        {slots.map((slot) => (
          <MatchCard
            key={slot.number}
            slot={slot}
            compact={compact}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function ChampionPanel({ finalSlot }: { finalSlot: BracketSlot }) {
  const championDisplay = finalSlot.winner
    ? formatTeamDisplayName(finalSlot.winner)
    : null;

  return (
    <section className="w-[260px] shrink-0 self-center rounded-[28px] border border-[#f6c84c]/50 bg-[radial-gradient(circle_at_top,rgba(246,200,76,0.28),rgba(0,0,0,0.38)_44%,rgba(6,15,44,0.92))] p-5 text-center shadow-[0_0_42px_rgba(246,200,76,0.18)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6c84c]">
        World Champion
      </p>
      <div className="mx-auto my-4 flex h-24 w-24 items-center justify-center rounded-full border border-[#f6c84c]/44 bg-black/30 text-5xl shadow-[0_0_32px_rgba(246,200,76,0.25)]">
        🏆
      </div>
      {championDisplay ? (
        <div className="flex flex-col items-center gap-2">
          {championDisplay.flag ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={championDisplay.flag}
              alt={`${championDisplay.label} flag`}
              className="h-9 w-14 rounded-lg object-cover"
            />
          ) : null}
          <h2 className="text-2xl font-black text-[#fff4bf]">
            {championDisplay.label}
          </h2>
          <p className="text-xs font-black text-white/50">
            {finalSlot.source === "real" ? "真实冠军" : "我的预测冠军"}
          </p>
        </div>
      ) : (
        <h2 className="text-2xl font-black text-white/52">冠军待定</h2>
      )}
    </section>
  );
}

function ThirdPlacePanel({
  slot,
  onSelect,
}: {
  slot: BracketSlot;
  onSelect: (slot: BracketSlot, team: string) => void;
}) {
  return (
    <section className="w-full rounded-[24px] border border-[#cd7f32]/44 bg-[linear-gradient(135deg,rgba(205,127,50,0.18),rgba(5,12,34,0.94))] p-3 shadow-[0_18px_44px_rgba(205,127,50,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.18em] text-[#ffbd7a]">
          季军赛
        </h2>
        <span className="text-[11px] font-bold text-white/46">
          {formatMatchTime(slot.match?.start_time)}
        </span>
      </div>
      <MatchCard slot={slot} compact onSelect={onSelect} />
    </section>
  );
}

function FinalMatchPanel({
  slot,
  onSelect,
}: {
  slot: BracketSlot;
  onSelect: (slot: BracketSlot, team: string) => void;
}) {
  return (
    <section className="w-full rounded-[24px] border border-[#f6c84c]/44 bg-[linear-gradient(135deg,rgba(246,200,76,0.16),rgba(5,12,34,0.96))] p-3 shadow-[0_18px_44px_rgba(246,200,76,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.18em] text-[#fff4bf]">
          决赛
        </h2>
        <span className="text-[11px] font-bold text-white/46">
          {formatMatchTime(slot.match?.start_time)}
        </span>
      </div>
      <MatchCard slot={slot} compact onSelect={onSelect} />
    </section>
  );
}

function StageSummary({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
      <p className="text-xs font-bold text-white/45">{label}</p>
      <p className="mt-1 text-xl font-black text-[#f6c84c]">{count}</p>
    </div>
  );
}

export function KnockoutBracketClient({ matches }: { matches: KnockoutMatch[] }) {
  const grouped = useMemo(() => groupKnockoutMatches(matches), [matches]);
  const [picks, setPicks] = useState<PickMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPicks(loadStoredPicks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(picks));
  }, [loaded, picks]);

  const slots = useMemo(() => buildBracketSlots(matches, picks), [matches, picks]);
  const getSlot = (number: number) => slots.get(number)!;
  const [round32Left, round32Right] = splitHalf(
    round32Numbers.map(getSlot),
  );
  const [round16Left, round16Right] = splitHalf(
    round16Numbers.map(getSlot),
  );
  const [quarterLeft, quarterRight] = splitHalf(
    quarterNumbers.map(getSlot),
  );
  const [semiLeft, semiRight] = splitHalf(semiNumbers.map(getSlot));
  const finalSlot = getSlot(finalNumber);
  const thirdPlaceSlot = getSlot(thirdPlaceNumber);
  const stageCounts: Array<[KnockoutStageKey, number]> = [
    ["roundOf32", grouped.roundOf32.length],
    ["roundOf16", grouped.roundOf16.length],
    ["quarterFinals", grouped.quarterFinals.length],
    ["semiFinals", grouped.semiFinals.length],
    ["final", grouped.final.length],
    ["thirdPlace", grouped.thirdPlace.length],
  ];

  function handleSelect(slot: BracketSlot, winner: string) {
    if (
      slot.stage === "roundOf32" ||
      isStartedOrLocked(slot.match) ||
      !slot.homeTeam ||
      !slot.awayTeam ||
      !isSelectableTeam(slot.homeTeam) ||
      !isSelectableTeam(slot.awayTeam)
    ) {
      return;
    }

    const loser = winner === slot.homeTeam ? slot.awayTeam : slot.homeTeam;

    setPicks((current) => ({
      ...current,
      [slot.number]: {
        winner,
        loser,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function resetPicks() {
    localStorage.removeItem(storageKey);
    setPicks({});
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#020814] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,112,216,0.22),transparent_34rem),radial-gradient(circle_at_top_right,rgba(246,200,76,0.14),transparent_28rem),linear-gradient(180deg,#020814,#061128_48%,#020814)]" />
      <section className="relative mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-[#f6c84c]/26 bg-black/24 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f6c84c]">
              FIFA WORLD CUP 2026
            </p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">
              淘汰赛晋级图
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold text-white/56">
              点击未开赛比赛中的球队，预测你的冠军路径。比赛开始后自动锁定，真实赛果公布后将覆盖预测路径。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/70"
            >
              返回首页
            </Link>
            <button
              type="button"
              onClick={resetPicks}
              className="rounded-2xl border border-[#f6c84c]/40 bg-[#f6c84c] px-4 py-3 text-sm font-black text-[#071b3a]"
            >
              重置我的预测
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stageCounts.map(([key, count]) => (
            <StageSummary
              key={key}
              label={knockoutStageLabels[key]}
              count={count}
            />
          ))}
        </div>

        <div className="overflow-x-auto rounded-[30px] border border-[#2f70d8]/28 bg-[#061128]/74 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="relative min-w-[2600px]">
            <div className="pointer-events-none absolute inset-x-14 top-1/2 h-px bg-[#2f70d8]/28" />
            <div className="grid grid-cols-[250px_250px_250px_250px_300px_250px_250px_250px_250px] items-start gap-8">
              <RoundColumn title="32强 · 上半区" slots={round32Left} compact onSelect={handleSelect} />
              <RoundColumn title="16强 · 上半区" slots={round16Left} onSelect={handleSelect} />
              <RoundColumn title="8强 · 上半区" slots={quarterLeft} onSelect={handleSelect} />
              <RoundColumn title="半决赛" slots={semiLeft} onSelect={handleSelect} />
              <div className="flex w-[300px] shrink-0 flex-col items-center gap-5 self-center">
                <ChampionPanel finalSlot={finalSlot} />
                <FinalMatchPanel slot={finalSlot} onSelect={handleSelect} />
                <ThirdPlacePanel slot={thirdPlaceSlot} onSelect={handleSelect} />
              </div>
              <RoundColumn title="半决赛" slots={semiRight} onSelect={handleSelect} />
              <RoundColumn title="8强 · 下半区" slots={quarterRight} onSelect={handleSelect} />
              <RoundColumn title="16强 · 下半区" slots={round16Right} onSelect={handleSelect} />
              <RoundColumn title="32强 · 下半区" slots={round32Right} compact onSelect={handleSelect} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
