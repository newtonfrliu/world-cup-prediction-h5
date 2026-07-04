import Link from "next/link";

import {
  fetchKnockoutMatches,
  formatTeamDisplayName,
  getKnockoutWinner,
  getWinnerTeam,
  groupKnockoutMatches,
  knockoutStageLabels,
  type KnockoutMatch,
  type KnockoutStageKey,
} from "@/lib/knockout-bracket";

export const dynamic = "force-dynamic";

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

function getStatusLabel(match: KnockoutMatch) {
  if (match.status === "finished") return "已结束";

  const startTime = match.start_time ? new Date(match.start_time).getTime() : Number.NaN;

  if (Number.isFinite(startTime) && Date.now() >= startTime) {
    return "进行中";
  }

  return "未开始";
}

function getScore(match: KnockoutMatch) {
  const finalHome = match.final_home_score;
  const finalAway = match.final_away_score;

  if (typeof finalHome === "number" && typeof finalAway === "number") {
    return `${finalHome} : ${finalAway}`;
  }

  if (typeof match.home_score === "number" && typeof match.away_score === "number") {
    return `${match.home_score} : ${match.away_score}`;
  }

  return "- : -";
}

function getRegularScore(match: KnockoutMatch) {
  if (
    typeof match.regular_home_score === "number" &&
    typeof match.regular_away_score === "number"
  ) {
    return `90分钟 ${match.regular_home_score}:${match.regular_away_score}`;
  }

  return null;
}

function TeamRow({
  match,
  side,
}: {
  match: KnockoutMatch;
  side: "home" | "away";
}) {
  const team = side === "home" ? match.home_team : match.away_team;
  const display = formatTeamDisplayName(team);
  const winner = getKnockoutWinner(match);
  const isWinner = winner === side;
  const isFinished = match.status === "finished";
  const isLoser = isFinished && winner && !isWinner;

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
        isWinner
          ? "border-[#f6c84c]/80 bg-[#f6c84c]/18 text-[#fff4bf] shadow-[0_0_18px_rgba(246,200,76,0.18)]"
          : isLoser
            ? "border-white/5 bg-black/18 text-white/42"
            : "border-white/10 bg-white/[0.055] text-white"
      }`}
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
          晋级
        </span>
      ) : null}
    </div>
  );
}

function MatchCard({
  match,
  compact = false,
}: {
  match: KnockoutMatch;
  compact?: boolean;
}) {
  const winnerTeam = getWinnerTeam(match);
  const winnerDisplay = winnerTeam ? formatTeamDisplayName(winnerTeam) : null;
  const regularScore = getRegularScore(match);

  return (
    <Link
      href={`/predict?matchId=${match.id}`}
      className={`group relative block rounded-2xl border border-[#2f70d8]/36 bg-[linear-gradient(145deg,rgba(18,35,91,0.94),rgba(5,12,34,0.95))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.32)] transition duration-200 hover:-translate-y-1 hover:border-[#f6c84c]/75 hover:shadow-[0_0_24px_rgba(246,200,76,0.2),0_18px_42px_rgba(0,0,0,0.34)] ${
        compact ? "min-h-[132px]" : "min-h-[154px]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#f6c84c]/80">
        <span>{match.match_number ? `M${match.match_number}` : "MATCH"}</span>
        <span className="rounded-full border border-white/10 bg-white/7 px-2 py-0.5 text-white/56">
          {getStatusLabel(match)}
        </span>
      </div>
      <div className="space-y-2">
        <TeamRow match={match} side="home" />
        <TeamRow match={match} side="away" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0 text-[11px] font-bold text-white/45">
          <p>{formatMatchTime(match.start_time)}</p>
          {regularScore ? <p className="mt-0.5">{regularScore}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{getScore(match)}</p>
          {winnerDisplay ? (
            <p className="mt-0.5 max-w-[120px] truncate text-[11px] font-black text-[#f6c84c]">
              {winnerDisplay.label} 晋级
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function RoundColumn({
  title,
  matches,
  compact,
}: {
  title: string;
  matches: KnockoutMatch[];
  compact?: boolean;
}) {
  return (
    <section className="w-[220px] shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black tracking-[0.2em] text-[#fff4bf]">
          {title}
        </h2>
        <span className="h-px flex-1 bg-[#f6c84c]/24 ml-3" />
      </div>
      <div className="space-y-4">
        {matches.length > 0 ? (
          matches.map((match) => (
            <MatchCard key={match.id} match={match} compact={compact} />
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm font-bold text-white/45">
            待定
          </div>
        )}
      </div>
    </section>
  );
}

function ChampionPanel({ finalMatch }: { finalMatch?: KnockoutMatch }) {
  const champion = finalMatch ? getWinnerTeam(finalMatch) : null;
  const championDisplay = champion ? formatTeamDisplayName(champion) : null;

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
        </div>
      ) : (
        <h2 className="text-2xl font-black text-white/52">冠军待定</h2>
      )}
      <p className="mt-4 text-xs font-bold text-white/48">
        晋级方来自决赛的 `advancement_winner`
      </p>
    </section>
  );
}

function ThirdPlacePanel({ match }: { match?: KnockoutMatch }) {
  return (
    <section className="w-full rounded-[24px] border border-[#cd7f32]/44 bg-[linear-gradient(135deg,rgba(205,127,50,0.18),rgba(5,12,34,0.94))] p-3 shadow-[0_18px_44px_rgba(205,127,50,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.18em] text-[#ffbd7a]">
          季军赛
        </h2>
        <span className="text-[11px] font-bold text-white/46">
          {match ? formatMatchTime(match.start_time) : "待定"}
        </span>
      </div>
      {match ? (
        <MatchCard match={match} compact />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/22 p-5 text-center text-sm font-bold text-white/45">
          季军赛对阵待定
        </div>
      )}
    </section>
  );
}

function splitHalf(matches: KnockoutMatch[]) {
  const middle = Math.ceil(matches.length / 2);
  return [matches.slice(0, middle), matches.slice(middle)] as const;
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

export default async function KnockoutBracketPage() {
  const matches = await fetchKnockoutMatches();
  const grouped = groupKnockoutMatches(matches);
  const [round32Left, round32Right] = splitHalf(grouped.roundOf32);
  const [round16Left, round16Right] = splitHalf(grouped.roundOf16);
  const [quarterLeft, quarterRight] = splitHalf(grouped.quarterFinals);
  const [semiLeft, semiRight] = splitHalf(grouped.semiFinals);
  const finalMatch = grouped.final[0];
  const thirdPlaceMatch = grouped.thirdPlace[0];
  const stageCounts: Array<[KnockoutStageKey, number]> = [
    ["roundOf32", grouped.roundOf32.length],
    ["roundOf16", grouped.roundOf16.length],
    ["quarterFinals", grouped.quarterFinals.length],
    ["semiFinals", grouped.semiFinals.length],
    ["final", grouped.final.length],
    ["thirdPlace", grouped.thirdPlace.length],
  ];

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
              淘汰赛对阵图
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-bold text-white/56">
              实时同步当前晋级情况。页面只展示真实比赛数据，不支持编辑、不写入数据库。
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/70"
            >
              返回首页
            </Link>
            <Link
              href="/predict"
              className="rounded-2xl bg-[#f6c84c] px-4 py-3 text-sm font-black text-[#071b3a]"
            >
              查看赛程
            </Link>
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
          <div className="relative min-w-[1440px]">
            <div className="pointer-events-none absolute inset-x-14 top-1/2 h-px bg-[#2f70d8]/28" />
            <div className="grid grid-cols-[220px_220px_220px_170px_260px_170px_220px_220px_220px] items-start gap-5">
              <RoundColumn title="32强 · 上半区" matches={round32Left} compact />
              <RoundColumn title="16强 · 上半区" matches={round16Left} />
              <RoundColumn title="8强 · 上半区" matches={quarterLeft} />
              <RoundColumn title="半决赛" matches={semiLeft} />
              <div className="flex w-[260px] shrink-0 flex-col items-center gap-5 self-center">
                <ChampionPanel finalMatch={finalMatch} />
                <ThirdPlacePanel match={thirdPlaceMatch} />
              </div>
              <RoundColumn title="半决赛" matches={semiRight} />
              <RoundColumn title="8强 · 下半区" matches={quarterRight} />
              <RoundColumn title="16强 · 下半区" matches={round16Right} />
              <RoundColumn title="32强 · 下半区" matches={round32Right} compact />
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
