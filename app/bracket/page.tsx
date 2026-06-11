"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";

import { CountryDisplay } from "@/components/CountryDisplay";
import {
  type BracketMatch,
  type GroupLetter,
  type QualifiedTeam,
  generateOfficialRoundOf32,
} from "@/lib/bracketRules";
import { getCountryTheme } from "@/lib/countries";
import {
  ensurePlayerInviteCode,
  isMissingInviteCodeColumnError,
} from "@/lib/inviteCode";
import { getStoredPlayerId } from "@/lib/playerSession";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getTeamDisplayName } from "@/lib/teamMeta";

type Stage = "groups" | "knockout" | "final";
type Side = "upper" | "lower";
type GroupSelection = {
  first: string;
  second: string;
  third: string;
};
type KnockoutRound = {
  name: string;
  matches: BracketMatch[];
};
type FinalStage = {
  finalWinner?: QualifiedTeam;
  thirdWinner?: QualifiedTeam;
};
type StoredBracketPrediction = {
  playerId: string;
  locked: true;
  lockedAt: string;
  groupSelections: Record<GroupLetter, GroupSelection>;
  bestThirdGroups: GroupLetter[];
  roundOf32: BracketMatch[];
  upperBracket: KnockoutRound[];
  lowerBracket: KnockoutRound[];
  finalStage: FinalStage;
  champion?: string;
  runnerUp?: string;
  thirdPlace?: string;
  fourthPlace?: string;
};

const groupTeams: Record<GroupLetter, string[]> = {
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
const groupKeys = Object.keys(groupTeams) as GroupLetter[];
const officialSiteUrl = "https://2026wc.fun/";
const emptySelections = groupKeys.reduce(
  (result, group) => ({
    ...result,
    [group]: { first: "", second: "", third: "" },
  }),
  {} as Record<GroupLetter, GroupSelection>,
);

function pairSequentially(teams: QualifiedTeam[], prefix: string): BracketMatch[] {
  const matches: BracketMatch[] = [];

  for (let index = 0; index < teams.length; index += 2) {
    matches.push({
      id: `${prefix}-${matches.length + 1}`,
      label: `${prefix.toUpperCase()} ${matches.length + 1}`,
      teams: [teams[index], teams[index + 1]],
    });
  }

  return matches;
}

function formatLockTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function buildShareLink(inviteCode: string) {
  return `${officialSiteUrl}?ref=${inviteCode}`;
}

function buildQrCodeUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=8&data=${encodeURIComponent(value)}`;
}

export default function BracketPage() {
  const router = useRouter();
  const bracketImageRef = useRef<HTMLDivElement>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [playerCountry, setPlayerCountry] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("groups");
  const [activeSide, setActiveSide] = useState<Side>("upper");
  const [groupSelections, setGroupSelections] =
    useState<Record<GroupLetter, GroupSelection>>(emptySelections);
  const [bestThirdGroups, setBestThirdGroups] = useState<GroupLetter[]>([]);
  const [roundOf32, setRoundOf32] = useState<BracketMatch[]>([]);
  const [upperBracket, setUpperBracket] = useState<KnockoutRound[]>([]);
  const [lowerBracket, setLowerBracket] = useState<KnockoutRound[]>([]);
  const [finalStage, setFinalStage] = useState<FinalStage>({});
  const [mappingError, setMappingError] = useState("");
  const [lockedAt, setLockedAt] = useState("");
  const [playerBracketLocked, setPlayerBracketLocked] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const isLocked = Boolean(lockedAt || playerBracketLocked);
  const storageKey = playerId ? `bracket_prediction_${playerId}` : "";
  const thirdTeams = useMemo(
    () =>
      groupKeys
        .map((group) => ({ group, team: groupSelections[group].third }))
        .filter((item) => item.team),
    [groupSelections],
  );
  const topTwoCount = groupKeys.reduce((count, group) => {
    const selection = groupSelections[group];
    return count + Number(Boolean(selection.first)) + Number(Boolean(selection.second));
  }, 0);
  const thirdsCount = thirdTeams.length;
  const groupsComplete =
    topTwoCount === 24 && thirdsCount === 12 && bestThirdGroups.length === 8;
  const upperChampion = upperBracket[3]?.matches[0]?.winner;
  const lowerChampion = lowerBracket[3]?.matches[0]?.winner;
  const upperSemiLoser = getMatchLoser(upperBracket[3]?.matches[0]);
  const lowerSemiLoser = getMatchLoser(lowerBracket[3]?.matches[0]);
  const champion = finalStage.finalWinner;
  const runnerUp = getFinalLoser(upperChampion, lowerChampion, finalStage.finalWinner);
  const thirdPlace = finalStage.thirdWinner;
  const fourthPlace = getFinalLoser(upperSemiLoser, lowerSemiLoser, finalStage.thirdWinner);
  const finalComplete = Boolean(champion && runnerUp && thirdPlace && fourthPlace);
  const upperProgress = getSideProgress(upperBracket);
  const lowerProgress = getSideProgress(lowerBracket);
  const playerTheme = getCountryTheme(playerCountry);
  const bracketAccentText =
    playerTheme.textOnTheme === "dark" ? "#AA151B" : "#E63535";

  useEffect(() => {
    const storedPlayerId = getStoredPlayerId();
    setPlayerId(storedPlayerId);

    if (!storedPlayerId) {
      router.replace("/");
      return;
    }

    async function loadPlayerCountry() {
      if (!isSupabaseConfigured || !storedPlayerId) {
        return;
      }

      const { data, error } = await supabase
        .from("players")
        .select("id, country, bracket_locked, invite_code")
        .eq("id", storedPlayerId)
        .maybeSingle();

      if (error) {
        if (isMissingInviteCodeColumnError(error)) {
          console.error("players.invite_code column is missing on bracket", {
            playerId: storedPlayerId,
            error,
          });
        }

        const { data: fallbackData } = await supabase
          .from("players")
          .select("country")
          .eq("id", storedPlayerId)
          .maybeSingle();

        setPlayerCountry(fallbackData?.country ?? null);
        return;
      }

      setPlayerCountry(data?.country ?? null);
      setPlayerBracketLocked(Boolean(data?.bracket_locked));
      if (data) {
        try {
          const ensuredInviteCode = await ensurePlayerInviteCode(supabase, data);
          setInviteCode(ensuredInviteCode);
        } catch (error) {
          console.error("failed to ensure bracket invite code", {
            playerId: storedPlayerId,
            error,
          });
        }
      }
    }

    loadPlayerCountry();

    const stored = localStorage.getItem(`bracket_prediction_${storedPlayerId}`);

    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as StoredBracketPrediction;

    if (parsed.locked) {
      setGroupSelections(parsed.groupSelections);
      setBestThirdGroups(parsed.bestThirdGroups);
      setRoundOf32(parsed.roundOf32);
      setUpperBracket(parsed.upperBracket);
      setLowerBracket(parsed.lowerBracket);
      setFinalStage(parsed.finalStage);
      setLockedAt(parsed.lockedAt);
      setStage("final");
    }
  }, [router]);

  function getMatchLoser(match?: BracketMatch) {
    if (!match?.winner) {
      return undefined;
    }

    return match.teams.find((team) => team.team !== match.winner?.team);
  }

  function getFinalLoser(
    first?: QualifiedTeam,
    second?: QualifiedTeam,
    winner?: QualifiedTeam,
  ) {
    if (!first || !second || !winner) {
      return undefined;
    }

    return first.team === winner.team ? second : first;
  }

  function getSideProgress(rounds: KnockoutRound[]) {
    const selected = rounds.reduce(
      (count, round) =>
        count + round.matches.filter((match) => match.winner).length,
      0,
    );
    const total = 15;

    return Math.round((selected / total) * 100);
  }

  function updateGroupSelection(
    group: GroupLetter,
    field: keyof GroupSelection,
    team: string,
  ) {
    if (isLocked) {
      return;
    }

    setGroupSelections((current) => {
      const nextSelection = { ...current[group], [field]: team };

      for (const key of ["first", "second", "third"] as const) {
        if (key !== field && team && nextSelection[key] === team) {
          nextSelection[key] = "";
        }
      }

      return { ...current, [group]: nextSelection };
    });

    if (field === "third") {
      setBestThirdGroups((current) => current.filter((item) => item !== group));
    }
  }

  function toggleBestThird(group: GroupLetter) {
    if (isLocked) {
      return;
    }

    setBestThirdGroups((current) => {
      if (current.includes(group)) {
        return current.filter((item) => item !== group);
      }

      if (current.length >= 8) {
        return current;
      }

      return [...current, group];
    });
  }

  function enterKnockout() {
    const groupWinners: Partial<Record<GroupLetter, QualifiedTeam>> = {};
    const groupRunnersUp: Partial<Record<GroupLetter, QualifiedTeam>> = {};
    const groupThirds: Partial<Record<GroupLetter, QualifiedTeam>> = {};

    for (const group of groupKeys) {
      const selection = groupSelections[group];
      groupWinners[group] = { key: `${group}1`, team: selection.first, group, rank: 1 };
      groupRunnersUp[group] = { key: `${group}2`, team: selection.second, group, rank: 2 };
      groupThirds[group] = { key: `${group}3`, team: selection.third, group, rank: 3 };
    }

    const result = generateOfficialRoundOf32({
      groupWinners,
      groupRunnersUp,
      groupThirds,
      selectedBestThirdGroups: bestThirdGroups,
    });

    if (!result.ok) {
      setMappingError(result.error);
      return;
    }

    setMappingError("");
    setRoundOf32(result.matches);
    setUpperBracket([{ name: "32强", matches: result.matches.slice(0, 8) }]);
    setLowerBracket([{ name: "32强", matches: result.matches.slice(8, 16) }]);
    setStage("knockout");
  }

  function chooseSideWinner(
    side: Side,
    roundIndex: number,
    matchIndex: number,
    winner: QualifiedTeam,
  ) {
    if (isLocked) {
      return;
    }

    const setter = side === "upper" ? setUpperBracket : setLowerBracket;
    const roundNames = ["32强", "16强", "8强", "半区决赛"];

    setter((current) => {
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

      if (winners.length === currentRound.matches.length && roundIndex < 3) {
        next[roundIndex + 1] = {
          name: roundNames[roundIndex + 1],
          matches: pairSequentially(winners, `${side}-${roundIndex + 1}`),
        };
      }

      return next;
    });

    setFinalStage({});
  }

  function enterFinalStage() {
    setStage("final");
  }

  async function lockPrediction() {
    if (!playerId || !storageKey || !finalComplete) {
      setSaveMessage("请完成最终排名预测。");
      return;
    }

    if (isSupabaseConfigured) {
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("bracket_locked")
        .eq("id", playerId)
        .maybeSingle();

      if (!playerError && playerData?.bracket_locked) {
        setPlayerBracketLocked(true);
        setSaveMessage("你的世界杯晋级预测已锁定，不能再次修改。");
        return;
      }
    }

    if (
      !window.confirm(
        "锁定后将不能再修改你的世界杯晋级之路。确认锁定吗？",
      )
    ) {
      return;
    }

    const lockedTime = new Date().toISOString();
    const payload: StoredBracketPrediction = {
      playerId,
      locked: true,
      lockedAt: lockedTime,
      groupSelections,
      bestThirdGroups,
      roundOf32,
      upperBracket,
      lowerBracket,
      finalStage,
      champion: champion?.team,
      runnerUp: runnerUp?.team,
      thirdPlace: thirdPlace?.team,
      fourthPlace: fourthPlace?.team,
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    if (isSupabaseConfigured) {
      const { error: lockError } = await supabase
        .from("players")
        .update({ bracket_locked: true })
        .eq("id", playerId);

      if (lockError) {
        setSaveMessage(lockError.message);
        return;
      }
    }

    setPlayerBracketLocked(true);
    setLockedAt(lockedTime);
  }

  async function copyShareLink() {
    const shareLink = inviteCode ? buildShareLink(inviteCode) : "";

    if (!shareLink) {
      setCopyMessage("分享链接生成中，请稍后再试");
      return;
    }

    await navigator.clipboard.writeText(shareLink);
    setCopyMessage("分享链接已复制");
  }

  async function saveBracketImage() {
    const imageNode = bracketImageRef.current;

    if (!playerId || !imageNode) {
      setSaveMessage("请长按晋级图截图保存");
      return;
    }

    try {
      const exportWidth = imageNode.scrollWidth;
      const exportHeight = imageNode.scrollHeight;
      const dataUrl = await toPng(imageNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#102a43",
        width: exportWidth,
        height: exportHeight,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
        },
      });
      setPreviewImageUrl(dataUrl);
      setSaveMessage("");
    } catch {
      setSaveMessage("生成图片失败，请截图保存");
    }
  }

  function downloadPreviewImage() {
    if (!previewImageUrl || !playerId) {
      return;
    }

    const link = document.createElement("a");
    link.href = previewImageUrl;
    link.download = `bracket-${playerId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function renderGroupStage() {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupKeys.map((group) => {
            const selectedTeams = Object.values(groupSelections[group]).filter(Boolean);

            return (
              <article
                key={group}
                className="overflow-hidden rounded-2xl border border-[#071b3a]/12 bg-white shadow-[0_12px_30px_rgba(7,27,58,0.08)]"
              >
                <div className="bg-[#071b3a] px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d9e2ec]">
                    Album Group
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {group}组收藏页
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 text-sm text-[#334e68]">
                  {groupTeams[group].map((team) => (
                    <div key={team} className="rounded-xl border border-[#071b3a]/10 bg-[#f6f1e7] px-3 py-2 font-black">
                      <CountryDisplay team={team} />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 px-4 pb-4">
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
                        value={groupSelections[group][field as keyof GroupSelection]}
                        disabled={isLocked}
                        onChange={(event) =>
                          updateGroupSelection(
                            group,
                            field as keyof GroupSelection,
                            event.target.value,
                          )
                        }
                        className="mt-1 h-11 w-full rounded-md border border-[#cbd2d9] bg-white px-3 text-sm outline-none focus:border-[#d64545] focus:ring-4 focus:ring-[#d64545]/15 disabled:bg-[#f0f4f8]"
                      >
                        <option value="">请选择</option>
                        {groupTeams[group].map((team) => (
                          <option
                            key={team}
                            value={team}
                            disabled={
                              selectedTeams.includes(team) &&
                              groupSelections[group][field as keyof GroupSelection] !== team
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

        <section className="wc-card mt-6 p-4">
          <h2 className="text-xl font-black text-[#102a43]">最佳第三名</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {thirdTeams.length === 0 ? (
              <p className="text-sm text-[#627d98]">请先选择各组第3名。</p>
            ) : null}

            {thirdTeams.map(({ group, team }) => {
              const checked = bestThirdGroups.includes(group);
              const disabled = isLocked || (!checked && bestThirdGroups.length >= 8);

              return (
                <label
                  key={`${group}-${team}`}
                  className="flex items-center gap-2 rounded-md border border-[#d9e2ec] px-3 py-2 text-sm text-[#334e68]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleBestThird(group)}
                  />
                  <span className="inline-flex items-center gap-2">
                    {group}组第3：<CountryDisplay team={team} />
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="wc-card mt-6 p-4 text-sm font-bold text-[#334e68]">
          <p>已选择小组前二：{topTwoCount} / 24</p>
          <p className="mt-1">已选择第三名：{thirdsCount} / 12</p>
          <p className="mt-1">已选择最佳第三名：{bestThirdGroups.length} / 8</p>
        </div>

        {mappingError ? (
          <div className="mt-4 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            {mappingError}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!groupsComplete || isLocked}
          onClick={enterKnockout}
          className="mt-4 h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
        >
          进入淘汰赛预测
        </button>
      </>
    );
  }

  function renderSide(side: Side) {
    const rounds = side === "upper" ? upperBracket : lowerBracket;
    const title = side === "upper" ? "上半区" : "下半区";
    const champion = rounds[3]?.matches[0]?.winner;

    return (
      <div>
        <h2 className="text-2xl font-black text-[#102a43]">{title}</h2>
        {["32强", "16强", "8强", "半区决赛"].map((name, roundIndex) => {
          const round = rounds[roundIndex];

          return (
            <section key={`${side}-${name}`} className="mt-5">
              <h3 className="text-lg font-black text-[#102a43]">{name}</h3>
              {!round ? (
                <div className="wc-card mt-3 p-4 text-sm text-[#627d98]">
                  等待上一轮完成
                </div>
              ) : null}

              <div className="mt-3 space-y-3">
                {round?.matches.map((match, matchIndex) => (
                  <article
                    key={match.id}
                    className="wc-card p-3"
                  >
                    {match.teams.map((team) => {
                      const selected = match.winner?.team === team.team;

                      return (
                        <button
                          key={`${match.id}-${team.team}`}
                          type="button"
                          disabled={isLocked}
                          onClick={() =>
                            chooseSideWinner(side, roundIndex, matchIndex, team)
                          }
                          className={`flex h-10 w-full items-center border-b border-[#edf2f7] text-left text-sm font-semibold last:border-b-0 disabled:cursor-not-allowed ${
                            selected ? "text-[#0f7b3f]" : "text-[#102a43]"
                          }`}
                        >
                          <CountryDisplay team={team.team} />
                        </button>
                      );
                    })}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <div className="wc-card mt-5 p-4 text-sm font-bold text-[#334e68]">
          {title}冠军：
          {champion ? <CountryDisplay team={champion.team} className="ml-2" /> : "等待半区决赛选择完成"}
        </div>
      </div>
    );
  }

  function renderKnockoutStage() {
    const canEnterFinal = Boolean(upperChampion && lowerChampion);

    return (
      <>
        <div className="wc-card p-4 text-sm font-bold text-[#334e68]">
          <p>上半区进度 {upperProgress}%</p>
          <p className="mt-1">下半区进度 {lowerProgress}%</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["upper", "lower"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setActiveSide(side)}
              className={`h-11 rounded-md text-sm font-bold ${
                activeSide === side
                  ? "bg-[#102a43] text-white"
                  : "border border-[#cbd2d9] bg-white text-[#334e68]"
              }`}
            >
              {side === "upper" ? "上半区" : "下半区"}
            </button>
          ))}
        </div>

        <div className="mt-5">{renderSide(activeSide)}</div>

        <button
          type="button"
          disabled={!canEnterFinal}
          onClick={enterFinalStage}
          className="mt-6 h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
        >
          进入最终排名预测
        </button>
      </>
    );
  }

  function renderFinalMatch(
    title: string,
    teams: Array<QualifiedTeam | undefined>,
    selectedWinner: QualifiedTeam | undefined,
    onSelect: (team: QualifiedTeam) => void,
  ) {
    return (
      <section className="wc-card p-4">
        <h2 className="text-xl font-black text-[#102a43]">{title}</h2>
        <div className="mt-4 space-y-2">
          {teams.every(Boolean) ? (
            (teams as QualifiedTeam[]).map((team) => {
              const selected = selectedWinner?.team === team.team;

              return (
                <button
                  key={`${title}-${team.team}`}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onSelect(team)}
                  className={`h-11 w-full rounded-md border px-3 text-left text-sm font-bold disabled:cursor-not-allowed ${
                    selected
                      ? "border-[#0f7b3f] bg-[#e3f9e5] text-[#0f7b3f]"
                      : "border-[#d9e2ec] bg-white text-[#102a43]"
                  }`}
                >
                  <CountryDisplay team={team.team} />
                </button>
              );
            })
          ) : (
            <p className="text-sm text-[#627d98]">等待上一阶段完成</p>
          )}
        </div>
      </section>
    );
  }

  function renderBracketPoster() {
    const shareLink = inviteCode ? buildShareLink(inviteCode) : "";

    return (
      <>
        <section
          ref={bracketImageRef}
          className="mt-5 rounded-[22px] border-4 border-[#f6c84c] bg-white p-5 text-readable shadow-sm"
          style={{
            borderColor: playerTheme.accent,
            boxShadow: playerTheme.glow,
          }}
        >
          <div
            className="rounded-2xl border p-4 text-center"
            style={{
              borderColor: playerTheme.accent,
              background:
                "linear-gradient(135deg, rgba(246,241,231,0.98), rgba(255,255,255,0.94))",
            }}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-readable">
              Bracket Album
            </p>
            <p
              className="mt-2 text-sm font-black"
              style={{ color: bracketAccentText }}
            >
              2026足球世界杯
            </p>
            <h2 className="mt-1 text-3xl font-black text-readable">
              美加墨大乱斗
            </h2>
            <p className="mt-2 text-sm font-bold text-muted-readable">
              我的世界杯晋级之路
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 text-[#071b3a]">
              <h3 className="text-base font-black text-[#e63535]">上半区路线</h3>
              <div className="mt-3 space-y-2 text-sm font-semibold">
                {upperBracket.map((round) => (
                  <p key={`upper-${round.name}`}>
                    {round.name}：
                    {round.matches
                      .map((match) =>
                        match.winner
                          ? getTeamDisplayName(match.winner.team)
                          : "-",
                      )
                      .join(" / ")}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 text-[#071b3a]">
              <h3 className="text-base font-black text-[#e63535]">下半区路线</h3>
              <div className="mt-3 space-y-2 text-sm font-semibold">
                {lowerBracket.map((round) => (
                  <p key={`lower-${round.name}`}>
                    {round.name}：
                    {round.matches
                      .map((match) =>
                        match.winner
                          ? getTeamDisplayName(match.winner.team)
                          : "-",
                      )
                      .join(" / ")}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div
            className="mt-4 rounded-2xl border-2 bg-white p-4 text-[#071b3a]"
            style={{ borderColor: playerTheme.accent }}
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e63535]">
              Champion Card
            </p>
            <h2 className="mt-1 text-xl font-black text-[#071b3a]">最终结果</h2>
            <div className="mt-4 space-y-2 text-sm font-bold text-[#334e68]">
              <p className="flex items-center gap-2">🏆 冠军：{champion ? <CountryDisplay team={champion.team} /> : "-"}</p>
              <p className="flex items-center gap-2">🥈 亚军：{runnerUp ? <CountryDisplay team={runnerUp.team} /> : "-"}</p>
              <p className="flex items-center gap-2">🥉 季军：{thirdPlace ? <CountryDisplay team={thirdPlace.team} /> : "-"}</p>
              <p className="flex items-center gap-2">
                第四名：
                {fourthPlace ? <CountryDisplay team={fourthPlace.team} /> : "-"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-8 text-center text-[#071b3a]">
            {shareLink ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buildQrCodeUrl(shareLink)}
                  alt="晋级图邀请二维码"
                  className="mx-auto h-28 w-28 rounded-md bg-white"
                />
                <p className="mt-2 break-all text-xs font-semibold text-[#627d98]">
                  {shareLink}
                </p>
              </>
            ) : null}
            <p className="mt-2 text-sm font-black text-[#d64545]">
              美加墨大乱斗
            </p>
            <p className="mt-1 text-xs font-bold text-[#334e68]">
              www.2026wc.fun
            </p>
            <p className="mt-1 text-sm font-black text-[#102a43]">
              扫码参与世界杯预测挑战
            </p>
          </div>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!playerId}
          onClick={saveBracketImage}
          className="mt-5 h-12 w-full rounded-lg border border-[#cbd2d9] bg-white px-5 text-base font-bold text-[#334e68] transition hover:border-[#d64545] hover:text-[#d64545] disabled:cursor-not-allowed disabled:bg-[#9fb3c8] disabled:text-white"
        >
          保存晋级海报
        </button>
          <button
            type="button"
            disabled={!shareLink}
            onClick={copyShareLink}
            className="mt-5 h-12 w-full rounded-lg bg-[#071b3a] px-5 text-base font-bold text-white transition hover:bg-[#102a43] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
          >
            复制分享链接
          </button>
        </div>
        {saveMessage ? (
          <p className="mt-3 text-sm font-bold text-[#334e68]">{saveMessage}</p>
        ) : null}
        {copyMessage ? (
          <p className="mt-3 text-sm font-bold text-[#0f7b3f]">{copyMessage}</p>
        ) : null}
      </>
    );
  }

  function renderFinalStage() {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2">
          {renderFinalMatch(
            "冠军赛",
            [upperChampion, lowerChampion],
            finalStage.finalWinner,
            (team) => setFinalStage((current) => ({ ...current, finalWinner: team })),
          )}
          {renderFinalMatch(
            "季军赛",
            [upperSemiLoser, lowerSemiLoser],
            finalStage.thirdWinner,
            (team) => setFinalStage((current) => ({ ...current, thirdWinner: team })),
          )}
        </div>

        <section className="wc-card mt-5 p-4">
          <h2 className="text-xl font-black text-[#071b3a]">最终排名预测</h2>
          <div className="mt-4 space-y-2 text-sm font-bold text-[#334e68]">
            <p className="flex items-center gap-2">冠军：{champion ? <CountryDisplay team={champion.team} /> : "待选择"}</p>
            <p className="flex items-center gap-2">亚军：{runnerUp ? <CountryDisplay team={runnerUp.team} /> : "待选择冠军赛"}</p>
            <p className="flex items-center gap-2">季军：{thirdPlace ? <CountryDisplay team={thirdPlace.team} /> : "待选择"}</p>
            <p className="flex items-center gap-2">第四名：{fourthPlace ? <CountryDisplay team={fourthPlace.team} /> : "待选择季军赛"}</p>
          </div>
          {!finalComplete ? (
            <p className="mt-4 rounded-xl bg-[#fff8db] p-3 text-sm font-black text-[#9f580a]">
              请完成最终排名预测。
            </p>
          ) : null}
        </section>

        <button
          type="button"
          disabled={!finalComplete || !playerId || isLocked}
          onClick={lockPrediction}
          className="mt-5 h-12 w-full rounded-lg bg-[#d64545] px-5 text-base font-bold text-white transition hover:bg-[#ba2525] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]"
        >
          {isLocked ? "已锁定，无法修改" : "提交并锁定预测"}
        </button>
        {saveMessage ? (
          <p className="mt-3 text-sm font-bold text-[#334e68]">{saveMessage}</p>
        ) : null}
      </>
    );
  }

  return (
    <main className="wc-page px-4 py-6">
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="wc-kicker">
              Road To Final
            </p>
            <h1 className="wc-title mt-2">
              世界杯晋级之路
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-[#071b3a]/15 bg-white px-3 py-2 text-sm font-bold text-[#071b3a]"
          >
            首页
          </Link>
        </div>

        {!playerId ? (
          <div className="mb-5 rounded-lg border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm text-[#9b1c1c]">
            请先返回首页创建玩家，再进行晋级预测。
          </div>
        ) : null}

        {isLocked ? (
          <div className="mb-5 rounded-lg border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm text-[#0f7b3f]">
            已锁定：{lockedAt ? formatLockTime(lockedAt) : "数据库已锁定"}
          </div>
        ) : null}

        {isLocked ? (
          finalComplete ? (
            <>
              <div className="wc-card mb-5 p-4 text-sm font-black text-[#071b3a]">
                <p>你的世界杯晋级预测已锁定</p>
                <p className="mt-1 text-[#e63535]">该预测不可修改</p>
              </div>
              {renderBracketPoster()}
            </>
          ) : (
            <section className="wc-card p-5">
              <p className="wc-kicker">Locked Bracket</p>
              <h2 className="mt-2 text-2xl font-black text-[#071b3a]">
                你的世界杯晋级预测已锁定
              </h2>
              <p className="mt-4 text-sm font-bold text-[#627d98]">
                当前设备未找到完整晋级海报数据，请使用提交预测时的浏览器打开。
              </p>
            </section>
          )
        ) : (
        <>
        <div className="mb-5 grid gap-2 text-center text-sm font-bold sm:grid-cols-3">
          {[
            ["groups", "阶段一：小组晋级预测", true],
            ["knockout", "阶段二：淘汰赛预测", groupsComplete],
            ["final", "阶段三：最终排名预测", Boolean(upperChampion && lowerChampion)],
          ].map(([value, label, enabled]) => (
            <button
              key={value as string}
              type="button"
              disabled={!enabled}
              onClick={() => setStage(value as Stage)}
              className={`rounded-lg px-3 py-3 disabled:cursor-not-allowed disabled:bg-[#9fb3c8] disabled:text-white ${
                stage === value
                  ? "bg-[#102a43] text-white"
                  : "border border-[#cbd2d9] bg-white text-[#52606d]"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>

        {stage === "groups" ? renderGroupStage() : null}
        {stage === "knockout" ? renderKnockoutStage() : null}
        {stage === "final" ? renderFinalStage() : null}
        </>
        )}
      </section>

      {previewImageUrl ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 px-4 py-5 text-white">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold">长按图片保存到手机相册</p>
            <button
              type="button"
              onClick={() => setPreviewImageUrl("")}
              className="rounded-md bg-white px-3 py-2 text-sm font-black text-[#102a43]"
            >
              关闭
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="晋级图预览"
              className="mx-auto max-h-[82vh] max-w-[92vw] rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={downloadPreviewImage}
            className="mt-4 h-11 rounded-md border border-white/40 px-4 text-sm font-bold text-white"
          >
            下载图片
          </button>
        </div>
      ) : null}
    </main>
  );
}
