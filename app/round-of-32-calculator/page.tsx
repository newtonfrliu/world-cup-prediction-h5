"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CountryDisplay } from "@/components/CountryDisplay";
import { getCountryDisplayName } from "@/lib/countries";
import {
  buildRoundOf32,
  createEmptyRankings,
  createExampleRankings,
  GroupRanking,
  KnockoutMatch,
  RoundOf32Team,
  SelectedKnockoutWinners,
  resolveKnockoutBracket,
  ROUND_OF_32_LAYOUT,
  WORLD_CUP_2026_GROUPS,
} from "@/lib/world-cup-2026-round-of-32";
import {
  GROUP_LETTERS,
  GroupLetter,
  validateThirdPlaceMap,
} from "@/lib/world-cup-2026-third-place-map";

const STORAGE_KEY = "roundOf32CalculatorStateV1";

type StoredState = {
  rankings: Record<GroupLetter, GroupRanking>;
  selectedKnockoutWinners?: SelectedKnockoutWinners;
};

const mapValidation = validateThirdPlaceMap();

function orderMatchesByNumber<T extends KnockoutMatch>(
  matches: T[],
  matchNumbers: number[],
) {
  const matchByNumber = new Map(matches.map((match) => [match.matchNumber, match]));

  return matchNumbers
    .map((matchNumber) => matchByNumber.get(matchNumber))
    .filter((match): match is T => Boolean(match));
}

function normalizeStoredRankings(value: unknown): Record<GroupLetter, GroupRanking> {
  const empty = createEmptyRankings();

  if (!value || typeof value !== "object" || !("rankings" in value)) {
    return empty;
  }

  const rankings = (value as StoredState).rankings;

  return Object.fromEntries(
    GROUP_LETTERS.map((group) => {
      const ranking = rankings?.[group] ?? empty[group];

      return [
        group,
        {
          first: ranking.first ?? "",
          second: ranking.second ?? "",
          third: ranking.third ?? "",
          bestThird: Boolean(ranking.bestThird && ranking.third),
        },
      ];
    }),
  ) as Record<GroupLetter, GroupRanking>;
}

function getDuplicateRanks(ranking: GroupRanking) {
  const picked = [ranking.first, ranking.second, ranking.third].filter(Boolean);

  return picked.filter((team, index) => picked.indexOf(team) !== index);
}

function isTeamUsedInOtherRank(
  ranking: GroupRanking,
  rank: keyof Pick<GroupRanking, "first" | "second" | "third">,
  team: string,
) {
  return Boolean(
    team &&
      (rank !== "first" && ranking.first === team ||
        rank !== "second" && ranking.second === team ||
        rank !== "third" && ranking.third === team),
  );
}

function TeamDisplayChip({ team }: { team: string }) {
  if (!team) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white/35">
        待定
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[#f6c84c]/20 bg-white/[0.06] px-3 py-2 text-sm font-black text-white">
      <CountryDisplay team={team} flagClassName="h-4 w-6 rounded-[3px]" />
    </div>
  );
}

function normalizeStoredKnockoutWinners(value: unknown): SelectedKnockoutWinners {
  if (!value || typeof value !== "object" || !("selectedKnockoutWinners" in value)) {
    return {};
  }

  const selectedKnockoutWinners = (value as StoredState).selectedKnockoutWinners;

  if (!selectedKnockoutWinners || typeof selectedKnockoutWinners !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(selectedKnockoutWinners).filter(
      ([matchKey, team]) =>
        /^M\d+$/.test(matchKey) && typeof team === "string" && team.length > 0,
    ),
  );
}

function TeamSlot({
  team,
  selected,
  disabled,
  onSelect,
}: {
  team: RoundOf32Team | null;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  if (!team?.team) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/45">
        待定
      </div>
    );
  }

  const className = selected
    ? "border-[#f6c84c] bg-[#f6c84c] text-[#071b3a] shadow-[0_0_24px_rgba(246,200,76,0.35)]"
    : "border-[#f6c84c]/30 bg-[#071b3a]/80 text-white shadow-inner hover:border-[#f6c84c]/70 hover:bg-[#102a43]";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black transition ${className} disabled:cursor-not-allowed disabled:opacity-55`}
    >
      <CountryDisplay
        team={team.team}
        className="min-w-0"
        flagClassName="h-4 w-6 rounded-[3px]"
      />
      <span className="shrink-0 rounded-full bg-[#f6c84c] px-2 py-0.5 text-[10px] text-[#071b3a]">
        {team.slot}
      </span>
    </button>
  );
}

function MatchCard({
  match,
  selectedWinner,
  onSelectWinner,
}: {
  match: KnockoutMatch;
  selectedWinner?: string;
  onSelectWinner: (matchNumber: number, team: string) => void;
}) {
  const canPickHome = Boolean(match.home?.team && match.away?.team);
  const canPickAway = canPickHome;

  return (
    <div className="rounded-xl border border-[#f6c84c]/25 bg-[#0b2a45]/90 p-3 shadow-[0_14px_30px_rgba(0,0,0,0.22)]">
      <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[#f6c84c]">
        <span>M{match.matchNumber}</span>
        <span>{selectedWinner ? "Winner Picked" : "Pick Winner"}</span>
      </div>
      <div className="space-y-2">
        <TeamSlot
          team={match.home}
          selected={Boolean(match.home?.team && selectedWinner === match.home.team)}
          disabled={!canPickHome}
          onSelect={
            match.home?.team
              ? () => onSelectWinner(match.matchNumber, match.home?.team ?? "")
              : undefined
          }
        />
        <TeamSlot
          team={match.away}
          selected={Boolean(match.away?.team && selectedWinner === match.away.team)}
          disabled={!canPickAway}
          onSelect={
            match.away?.team
              ? () => onSelectWinner(match.matchNumber, match.away?.team ?? "")
              : undefined
          }
        />
      </div>
    </div>
  );
}

function MatchRound({
  title,
  matches,
  selectedKnockoutWinners,
  onSelectWinner,
}: {
  title: string;
  matches: KnockoutMatch[];
  selectedKnockoutWinners: SelectedKnockoutWinners;
  onSelectWinner: (matchNumber: number, team: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-center text-sm font-black text-[#f6c84c]">{title}</h3>
      {matches.map((match) => (
        <MatchCard
          key={match.matchNumber}
          match={match}
          selectedWinner={selectedKnockoutWinners[`M${match.matchNumber}`]}
          onSelectWinner={onSelectWinner}
        />
      ))}
    </div>
  );
}

function BracketHalf({
  title,
  matches,
  roundOf16,
  quarterFinals,
  semiFinals,
  selectedKnockoutWinners,
  onSelectWinner,
}: {
  title: string;
  matches: KnockoutMatch[];
  roundOf16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  selectedKnockoutWinners: SelectedKnockoutWinners;
  onSelectWinner: (matchNumber: number, team: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#f6c84c]/20 bg-[#071b3a]/80 p-4">
      <h2 className="mb-4 text-lg font-black text-white">{title}</h2>
      <div className="grid min-w-[760px] grid-cols-[1.35fr_1fr_0.9fr_0.8fr] gap-4">
        <MatchRound
          title="32强"
          matches={matches}
          selectedKnockoutWinners={selectedKnockoutWinners}
          onSelectWinner={onSelectWinner}
        />
        <MatchRound
          title="16强"
          matches={roundOf16}
          selectedKnockoutWinners={selectedKnockoutWinners}
          onSelectWinner={onSelectWinner}
        />
        <MatchRound
          title="8强"
          matches={quarterFinals}
          selectedKnockoutWinners={selectedKnockoutWinners}
          onSelectWinner={onSelectWinner}
        />
        <MatchRound
          title="半决赛"
          matches={semiFinals}
          selectedKnockoutWinners={selectedKnockoutWinners}
          onSelectWinner={onSelectWinner}
        />
      </div>
    </section>
  );
}

export default function RoundOf32CalculatorPage() {
  const [rankings, setRankings] =
    useState<Record<GroupLetter, GroupRanking>>(createEmptyRankings);
  const [selectedKnockoutWinners, setSelectedKnockoutWinners] =
    useState<SelectedKnockoutWinners>({});
  const [copyNotice, setCopyNotice] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setRankings(normalizeStoredRankings(parsed));
      setSelectedKnockoutWinners(normalizeStoredKnockoutWinners(parsed));
    } catch (error) {
      console.error("failed to restore round of 32 calculator state", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rankings, selectedKnockoutWinners }),
    );
  }, [rankings, selectedKnockoutWinners]);

  const roundOf32 = useMemo(() => buildRoundOf32(rankings), [rankings]);
  const knockoutBracket = useMemo(
    () => resolveKnockoutBracket(roundOf32.matches, selectedKnockoutWinners),
    [roundOf32.matches, selectedKnockoutWinners],
  );
  const leftMatches = orderMatchesByNumber(
    knockoutBracket.roundOf32,
    ROUND_OF_32_LAYOUT.left,
  );
  const rightMatches = orderMatchesByNumber(
    knockoutBracket.roundOf32,
    ROUND_OF_32_LAYOUT.right,
  );
  const leftRoundOf16 = knockoutBracket.roundOf16.slice(0, 4);
  const rightRoundOf16 = knockoutBracket.roundOf16.slice(4);
  const leftQuarterFinals = knockoutBracket.quarterFinals.slice(0, 2);
  const rightQuarterFinals = knockoutBracket.quarterFinals.slice(2);
  const leftSemiFinals = knockoutBracket.semiFinals.slice(0, 1);
  const rightSemiFinals = knockoutBracket.semiFinals.slice(1);
  const selectedThirdCount = roundOf32.selectedBestThirdGroups.length;
  const remainingThirdCount = Math.max(0, 8 - selectedThirdCount);

  function updateRanking(
    group: GroupLetter,
    field: keyof GroupRanking,
    value: string | boolean,
  ) {
    setRankings((current) => {
      const nextRanking = {
        ...current[group],
        [field]: value,
      };

      if (field === "third" && !value) {
        nextRanking.bestThird = false;
      }

      return {
        ...current,
        [group]: nextRanking,
      };
    });
  }

  function resetAll() {
    setRankings(createEmptyRankings());
    setSelectedKnockoutWinners({});
    setCopyNotice("");
  }

  function fillExample() {
    setRankings(createExampleRankings());
    setSelectedKnockoutWinners({});
    setCopyNotice("");
  }

  function resetKnockoutWinners() {
    setSelectedKnockoutWinners({});
    setCopyNotice("");
  }

  function selectWinner(matchNumber: number, team: string) {
    setSelectedKnockoutWinners((current) => ({
      ...current,
      [`M${matchNumber}`]: team,
    }));
  }

  async function copyMatches() {
    const rounds = [
      ...knockoutBracket.roundOf32,
      ...knockoutBracket.roundOf16,
      ...knockoutBracket.quarterFinals,
      ...knockoutBracket.semiFinals,
      knockoutBracket.final,
    ];
    const text = rounds
      .map((match) => {
        const home = match.home?.team
          ? `${getCountryDisplayName(match.home.team)}（${match.home.slot}）`
          : "待定";
        const away = match.away?.team
          ? `${getCountryDisplayName(match.away.team)}（${match.away.slot}）`
          : "待定";
        return `M${match.matchNumber}: ${home} vs ${away}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice("32强对阵已复制");
    } catch {
      setCopyNotice("复制失败，请手动选择文本复制");
    }
  }

  return (
    <main className="min-h-screen bg-[#03131f] px-5 py-8 text-white">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-[#f6c84c]/25 bg-[#071b3a] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_15%,rgba(37,199,183,0.28),transparent_28rem),radial-gradient(circle_at_85%_20%,rgba(230,53,53,0.24),transparent_24rem),linear-gradient(135deg,rgba(7,27,58,1),rgba(3,50,43,0.92))]" />
          <div className="absolute inset-x-0 bottom-0 h-28 opacity-25 [background:repeating-linear-gradient(90deg,transparent_0,transparent_68px,rgba(255,255,255,0.16)_69px,transparent_70px)]" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white/80"
              >
                返回首页
              </Link>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.22em] text-[#f6c84c]">
                Round of 32 Live Calculator
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">
                2026美加墨世界杯
                <br />
                32强实时对阵图
              </h1>
              <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-[#d9e2ec]">
                填写小组排名，实时生成32强淘汰赛路径。A-L 组前二直接晋级，12个小组第三中选择8个最佳第三进入对阵槽位。
              </p>
            </div>
            <div className="rounded-2xl border border-[#f6c84c]/35 bg-black/25 p-4 text-sm font-black text-[#f6c84c]">
              <p className="text-white/70">数据更新时间卡片</p>
              <p className="mt-2 text-2xl text-white">本地模拟</p>
              <p className="mt-1 text-[#25c7b7]">实时编辑</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[#062235]/75 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#25c7b7]">
                Group Ranking Editor
              </p>
              <h2 className="mt-1 text-2xl font-black">A-L 组排名卡片</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fillExample}
                className="rounded-xl bg-[#f6c84c] px-4 py-2 text-sm font-black text-[#071b3a]"
              >
                一键填入当前小组排名示例
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white"
              >
                重置全部
              </button>
              <button
                type="button"
                onClick={copyMatches}
                className="rounded-xl bg-[#e63535] px-4 py-2 text-sm font-black text-white"
              >
                复制当前淘汰赛对阵文本
              </button>
              <button
                type="button"
                onClick={resetKnockoutWinners}
                className="rounded-xl border border-[#f6c84c]/35 bg-[#071b3a] px-4 py-2 text-sm font-black text-[#f6c84c]"
              >
                重置淘汰赛选择
              </button>
            </div>
          </div>

          {copyNotice ? (
            <p className="mb-4 rounded-xl border border-[#25c7b7]/35 bg-[#25c7b7]/10 px-4 py-3 text-sm font-black text-[#8ff5ea]">
              {copyNotice}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {GROUP_LETTERS.map((group) => {
              const ranking = rankings[group];
              const duplicates = getDuplicateRanks(ranking);
              const canCheckBestThird = Boolean(ranking.third);
              const bestThirdDisabled =
                !canCheckBestThird ||
                (!ranking.bestThird && selectedThirdCount >= 8);

              return (
                <article
                  key={group}
                  className="rounded-2xl border border-[#f6c84c]/20 bg-[#071b3a]/85 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-2xl font-black text-[#f6c84c]">{group}组</h3>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                      Ranking
                    </span>
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {WORLD_CUP_2026_GROUPS[group].map((team) => (
                      <div
                        key={team}
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold"
                      >
                        <CountryDisplay
                          team={team}
                          flagClassName="h-4 w-6 rounded-[3px]"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[
                      ["first", "第1名"],
                      ["second", "第2名"],
                      ["third", "第3名"],
                    ].map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="mb-1 block text-xs font-black text-white/65">
                          {label}
                        </span>
                        <select
                          value={ranking[field as keyof Pick<GroupRanking, "first" | "second" | "third">] as string}
                          onChange={(event) =>
                            updateRanking(
                              group,
                              field as keyof GroupRanking,
                              event.target.value,
                            )
                          }
                          className="h-11 w-full rounded-xl border border-white/10 bg-[#03131f] px-3 text-sm font-black text-white outline-none focus:border-[#f6c84c]"
                        >
                          <option value="">待定</option>
                          {WORLD_CUP_2026_GROUPS[group].map((team) => (
                            <option
                              key={team}
                              value={team}
                              disabled={isTeamUsedInOtherRank(
                                ranking,
                                field as keyof Pick<GroupRanking, "first" | "second" | "third">,
                                team,
                              )}
                            >
                              {getCountryDisplayName(team)}
                            </option>
                          ))}
                        </select>
                        <TeamDisplayChip
                          team={
                            ranking[
                              field as keyof Pick<
                                GroupRanking,
                                "first" | "second" | "third"
                              >
                            ] as string
                          }
                        />
                      </label>
                    ))}
                    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-black">
                      <input
                        type="checkbox"
                        checked={ranking.bestThird}
                        disabled={bestThirdDisabled}
                        onChange={(event) =>
                          updateRanking(group, "bestThird", event.target.checked)
                        }
                        className="h-5 w-5 accent-[#f6c84c]"
                      />
                      <span className={bestThirdDisabled ? "text-white/35" : "text-white"}>
                        最佳第三晋级
                      </span>
                    </label>
                    {duplicates.length > 0 ? (
                      <p className="rounded-lg bg-[#e63535]/15 px-3 py-2 text-xs font-black text-[#ffb4b4]">
                        同组排名不能重复选择：
                        {duplicates.map((team) => getCountryDisplayName(team)).join("、")}
                      </p>
                    ) : null}
                    {!canCheckBestThird ? (
                      <p className="text-xs font-bold text-white/45">
                        填写第3名后才能勾选最佳第三。
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-[#f6c84c]/20 bg-[#02101a] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#25c7b7]">
                Knockout Path
              </p>
              <h2 className="text-2xl font-black">32强淘汰赛路径图</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black">
              <p>
                当前已选择最佳第三：
                <span className="text-[#f6c84c]">{selectedThirdCount} / 8</span>
              </p>
              {selectedThirdCount < 8 ? (
                <p className="mt-1 text-white/55">还需选择 {remainingThirdCount} 个</p>
              ) : (
                <p className="mt-1 text-[#25c7b7]">
                  组合 key：{roundOf32.combinationKey || "待定"} ·
                  {roundOf32.error ? " 映射异常" : " 匹配成功"}
                </p>
              )}
            </div>
          </div>

          {!mapValidation.ok ? (
            <div className="mb-5 rounded-2xl border border-[#e63535]/35 bg-[#e63535]/10 p-4 text-sm font-black text-[#ffb4b4]">
              Annex C 映射表未完成：当前覆盖 {mapValidation.count} / 495。
              {mapValidation.errors[0] ? ` ${mapValidation.errors[0]}` : ""}
            </div>
          ) : null}
          {roundOf32.error ? (
            <div className="mb-5 rounded-2xl border border-[#e63535]/35 bg-[#e63535]/10 p-4 text-sm font-black text-[#ffb4b4]">
              {roundOf32.error}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-x-auto">
              <BracketHalf
                title="左半区"
                matches={leftMatches}
                roundOf16={leftRoundOf16}
                quarterFinals={leftQuarterFinals}
                semiFinals={leftSemiFinals}
                selectedKnockoutWinners={selectedKnockoutWinners}
                onSelectWinner={selectWinner}
              />
            </div>
            <div className="overflow-x-auto">
              <BracketHalf
                title="右半区"
                matches={rightMatches}
                roundOf16={rightRoundOf16}
                quarterFinals={rightQuarterFinals}
                semiFinals={rightSemiFinals}
                selectedKnockoutWinners={selectedKnockoutWinners}
                onSelectWinner={selectWinner}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-2xl border border-[#f6c84c]/35 bg-[#071b3a] p-4 shadow-[0_16px_48px_rgba(246,200,76,0.12)]">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f6c84c]">
                Final · M104
              </p>
              <div className="mt-3 max-w-md space-y-2">
                <TeamSlot
                  team={knockoutBracket.final.home}
                  selected={Boolean(
                    knockoutBracket.final.home?.team &&
                      selectedKnockoutWinners.M104 === knockoutBracket.final.home.team,
                  )}
                  disabled={!knockoutBracket.final.home?.team || !knockoutBracket.final.away?.team}
                  onSelect={
                    knockoutBracket.final.home?.team
                      ? () => selectWinner(104, knockoutBracket.final.home?.team ?? "")
                      : undefined
                  }
                />
                <TeamSlot
                  team={knockoutBracket.final.away}
                  selected={Boolean(
                    knockoutBracket.final.away?.team &&
                      selectedKnockoutWinners.M104 === knockoutBracket.final.away.team,
                  )}
                  disabled={!knockoutBracket.final.home?.team || !knockoutBracket.final.away?.team}
                  onSelect={
                    knockoutBracket.final.away?.team
                      ? () => selectWinner(104, knockoutBracket.final.away?.team ?? "")
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="rounded-2xl border border-[#f6c84c]/45 bg-[#f6c84c] px-8 py-6 text-center text-[#071b3a] shadow-[0_20px_56px_rgba(246,200,76,0.24)]">
              <p className="text-sm font-black uppercase tracking-[0.2em]">
                World Champion
              </p>
              <p className="mt-3 text-4xl font-black">🏆 世界冠军</p>
              <div className="mt-4 flex justify-center">
                {knockoutBracket.champion?.team ? (
                  <CountryDisplay
                    team={knockoutBracket.champion.team}
                    className="justify-center text-2xl font-black"
                    flagClassName="h-7 w-10 rounded-md"
                  />
                ) : (
                  <span className="text-2xl font-black text-[#071b3a]/50">
                    待定
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-7 text-white/65">
          <p>
            第三名槽位由当前选择的8个最佳第三小组实时计算；未选满8个时，所有第三名槽位保持“待定”。
          </p>
          <p>
            映射表校验覆盖数量：{mapValidation.count} / 495。
          </p>
        </footer>
      </div>
    </main>
  );
}
