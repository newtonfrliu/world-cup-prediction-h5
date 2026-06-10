"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { getTeamDisplayName } from "@/lib/teamMeta";

type GroupKey =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

type GroupSelection = {
  first: string;
  second: string;
  third: string;
};

type QualifiedTeam = {
  team: string;
  group: GroupKey;
  rank: 1 | 2 | 3;
};

type KnockoutMatch = {
  id: string;
  teams: [QualifiedTeam, QualifiedTeam];
  winner?: QualifiedTeam;
};

type KnockoutRound = {
  name: string;
  matches: KnockoutMatch[];
};

const groupTeams: Record<GroupKey, string[]> = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Bosnia & Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["USA", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const groupKeys = Object.keys(groupTeams) as GroupKey[];
const emptySelections = groupKeys.reduce(
  (result, group) => ({
    ...result,
    [group]: {
      first: "",
      second: "",
      third: "",
    },
  }),
  {} as Record<GroupKey, GroupSelection>,
);
const knockoutRoundNames = ["32强", "16强", "8强", "4强", "决赛"];

export default function BracketPage() {
  const [selections, setSelections] =
    useState<Record<GroupKey, GroupSelection>>(emptySelections);
  const [bestThirdTeams, setBestThirdTeams] = useState<string[]>([]);
  const [stage, setStage] = useState<"groups" | "knockout">("groups");
  const [knockoutRounds, setKnockoutRounds] = useState<KnockoutRound[]>([]);

  const thirdTeams = useMemo(
    () =>
      groupKeys
        .map((group) => ({
          group,
          team: selections[group].third,
        }))
        .filter((item) => item.team),
    [selections],
  );
  const selectedTopTwoCount = groupKeys.reduce((count, group) => {
    const selection = selections[group];
    return count + Number(Boolean(selection.first)) + Number(Boolean(selection.second));
  }, 0);
  const selectedThirdCount = thirdTeams.length;
  const canEnterKnockout =
    selectedTopTwoCount === 24 &&
    selectedThirdCount === 12 &&
    bestThirdTeams.length === 8;

  function updateGroupSelection(
    group: GroupKey,
    field: keyof GroupSelection,
    team: string,
  ) {
    setSelections((current) => {
      const nextSelection = {
        ...current[group],
        [field]: team,
      };

      for (const key of ["first", "second", "third"] as const) {
        if (key !== field && team && nextSelection[key] === team) {
          nextSelection[key] = "";
        }
      }

      return {
        ...current,
        [group]: nextSelection,
      };
    });

    if (field === "third") {
      setBestThirdTeams((current) => current.filter((item) => item !== team));
    }
  }

  function toggleBestThird(team: string) {
    setBestThirdTeams((current) => {
      if (current.includes(team)) {
        return current.filter((item) => item !== team);
      }

      if (current.length >= 8) {
        return current;
      }

      return [...current, team];
    });
  }

  function buildQualifiedTeams() {
    const groupWinners: QualifiedTeam[] = [];
    const groupRunnersUp: QualifiedTeam[] = [];
    const selectedThirds: QualifiedTeam[] = [];

    for (const group of groupKeys) {
      const selection = selections[group];
      groupWinners.push({ team: selection.first, group, rank: 1 });
      groupRunnersUp.push({ team: selection.second, group, rank: 2 });

      if (bestThirdTeams.includes(selection.third)) {
        selectedThirds.push({ team: selection.third, group, rank: 3 });
      }
    }

    return {
      groupWinners,
      groupRunnersUp,
      selectedThirds,
    };
  }

  function pairFirstsWithThirds(
    firsts: QualifiedTeam[],
    thirds: QualifiedTeam[],
  ) {
    const remainingFirsts = [...firsts];
    const remainingThirds = [...thirds];
    const matches: KnockoutMatch[] = [];

    while (remainingThirds.length > 0 && remainingFirsts.length > 0) {
      const first = remainingFirsts.shift() as QualifiedTeam;
      const thirdIndex = remainingThirds.findIndex(
        (third) => third.group !== first.group,
      );
      const pickedIndex = thirdIndex === -1 ? 0 : thirdIndex;
      const third = remainingThirds.splice(pickedIndex, 1)[0];

      matches.push({
        id: `r32-${matches.length + 1}`,
        teams: [first, third],
      });
    }

    return {
      matches,
      remainingFirsts,
    };
  }

  function pairSequentially(
    teams: QualifiedTeam[],
    idPrefix: string,
    startIndex: number,
  ) {
    const matches: KnockoutMatch[] = [];

    for (let index = 0; index < teams.length; index += 2) {
      matches.push({
        id: `${idPrefix}-${startIndex + matches.length + 1}`,
        teams: [teams[index], teams[index + 1]],
      });
    }

    return matches;
  }

  function enterKnockout() {
    const { groupWinners, groupRunnersUp, selectedThirds } =
      buildQualifiedTeams();
    const { matches: firstVsThirdMatches, remainingFirsts } =
      pairFirstsWithThirds(groupWinners, selectedThirds);
    const secondVsSecondMatches = pairSequentially(
      groupRunnersUp,
      "r32",
      firstVsThirdMatches.length,
    );
    const firstVsFirstMatches = pairSequentially(
      remainingFirsts,
      "r32",
      firstVsThirdMatches.length + secondVsSecondMatches.length,
    );

    setKnockoutRounds([
      {
        name: "32强",
        matches: [
          ...firstVsThirdMatches,
          ...secondVsSecondMatches,
          ...firstVsFirstMatches,
        ],
      },
    ]);
    setStage("knockout");
  }

  function chooseWinner(roundIndex: number, matchIndex: number, winner: QualifiedTeam) {
    setKnockoutRounds((current) => {
      const next = current.slice(0, roundIndex + 1).map((round, index) =>
        index === roundIndex
          ? {
              ...round,
              matches: round.matches.map((match, innerIndex) =>
                innerIndex === matchIndex ? { ...match, winner } : match,
              ),
            }
          : round,
      );
      const currentRound = next[roundIndex];
      const winners = currentRound.matches
        .map((match) => match.winner)
        .filter(Boolean) as QualifiedTeam[];

      if (
        winners.length === currentRound.matches.length &&
        roundIndex < knockoutRoundNames.length - 1
      ) {
        next.push({
          name: knockoutRoundNames[roundIndex + 1],
          matches: pairSequentially(
            winners,
            `r${roundIndex + 1}`,
            0,
          ),
        });
      }

      return next;
    });
  }

  function resetToGroups() {
    setStage("groups");
    setKnockoutRounds([]);
  }

  const champion =
    knockoutRounds.at(-1)?.name === "决赛"
      ? knockoutRounds.at(-1)?.matches[0]?.winner
      : undefined;

  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-6 text-[#1f2933]">
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#d64545]">
              Road To Final
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#102a43]">
              世界杯晋级之路
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#cbd2d9] bg-white px-3 py-2 text-sm font-semibold text-[#334e68]"
          >
            首页
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 text-center text-sm font-bold">
          <div
            className={`rounded-lg px-3 py-3 ${
              stage === "groups"
                ? "bg-[#102a43] text-white"
                : "border border-[#cbd2d9] bg-white text-[#52606d]"
            }`}
          >
            阶段一：小组晋级预测
          </div>
          <div
            className={`rounded-lg px-3 py-3 ${
              stage === "knockout"
                ? "bg-[#102a43] text-white"
                : "border border-[#cbd2d9] bg-white text-[#52606d]"
            }`}
          >
            阶段二：淘汰赛预测
          </div>
        </div>

        {stage === "groups" ? (
          <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupKeys.map((group) => {
            const selectedTeams = Object.values(selections[group]).filter(Boolean);

            return (
              <article
                key={group}
                className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm"
              >
                <h2 className="text-xl font-black text-[#102a43]">
                  {group}组
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#334e68]">
                  {groupTeams[group].map((team) => (
                    <div key={team} className="rounded-md bg-[#f0f4f8] px-3 py-2">
                      {getTeamDisplayName(team)}
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ["first", "第1名"],
                    ["second", "第2名"],
                    ["third", "第3名"],
                  ].map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="text-sm font-semibold text-[#334e68]">
                        {label}
                      </span>
                      <select
                        value={selections[group][field as keyof GroupSelection]}
                        onChange={(event) =>
                          updateGroupSelection(
                            group,
                            field as keyof GroupSelection,
                            event.target.value,
                          )
                        }
                        className="mt-1 h-11 w-full rounded-md border border-[#cbd2d9] bg-white px-3 text-sm outline-none focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15"
                      >
                        <option value="">请选择</option>
                        {groupTeams[group].map((team) => (
                          <option
                            key={team}
                            value={team}
                            disabled={
                              selectedTeams.includes(team) &&
                              selections[group][field as keyof GroupSelection] !== team
                            }
                          >
                            {getTeamDisplayName(team)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-6 rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black text-[#102a43]">最佳第三名</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {thirdTeams.length === 0 ? (
              <p className="text-sm text-[#627d98]">请先选择各组第3名。</p>
            ) : null}

            {thirdTeams.map(({ group, team }) => {
              const checked = bestThirdTeams.includes(team);
              const disabled = !checked && bestThirdTeams.length >= 8;

              return (
                <label
                  key={`${group}-${team}`}
                  className="flex items-center gap-2 rounded-md border border-[#d9e2ec] px-3 py-2 text-sm text-[#334e68]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleBestThird(team)}
                  />
                  <span>
                    {group}组第3：{getTeamDisplayName(team)}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="mt-6 rounded-lg border border-[#d9e2ec] bg-white p-4 text-sm text-[#334e68] shadow-sm">
          <p>已选择小组前二：{selectedTopTwoCount} / 24</p>
          <p className="mt-1">已选择第三名：{selectedThirdCount} / 12</p>
          <p className="mt-1">已选择最佳第三名：{bestThirdTeams.length} / 8</p>
        </div>

        <button
          type="button"
          disabled={!canEnterKnockout}
          onClick={enterKnockout}
          className="mt-4 h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
        >
          进入淘汰赛预测
        </button>
          </>
        ) : (
          <>
            <div className="overflow-x-auto pb-4">
              <div className="grid min-w-[980px] grid-cols-5 gap-4">
                {knockoutRounds.map((round, roundIndex) => (
                  <section key={round.name}>
                    <h2 className="mb-3 text-center text-sm font-black text-[#102a43]">
                      {round.name}
                    </h2>
                    <div className="flex min-h-[560px] flex-col justify-around gap-4">
                      {round.matches.map((match, matchIndex) => (
                        <article
                          key={match.id}
                          className="rounded-lg border border-[#d9e2ec] bg-white p-3 shadow-sm"
                        >
                          {match.teams.map((team) => {
                            const selected = match.winner?.team === team.team;

                            return (
                              <button
                                key={`${match.id}-${team.team}`}
                                type="button"
                                onClick={() =>
                                  chooseWinner(roundIndex, matchIndex, team)
                                }
                                className={`flex h-10 w-full items-center border-b border-[#edf2f7] text-left text-sm font-semibold last:border-b-0 ${
                                  selected
                                    ? "text-[#0f7b3f]"
                                    : "text-[#102a43]"
                                }`}
                              >
                                {getTeamDisplayName(team.team)}
                              </button>
                            );
                          })}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}

                <section>
                  <h2 className="mb-3 text-center text-sm font-black text-[#102a43]">
                    冠军
                  </h2>
                  <div className="flex min-h-[560px] items-center">
                    <div className="w-full rounded-lg border border-[#d9e2ec] bg-white p-4 text-center shadow-sm">
                      {champion ? (
                        <p className="text-xl font-black text-[#102a43]">
                          冠军：{getTeamDisplayName(champion.team)}
                        </p>
                      ) : (
                        <p className="text-sm text-[#627d98]">等待决赛选择</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <button
              type="button"
              onClick={resetToGroups}
              className="mt-4 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-5 text-base font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545]"
            >
              重新选择小组晋级
            </button>
          </>
        )}
      </section>
    </main>
  );
}
