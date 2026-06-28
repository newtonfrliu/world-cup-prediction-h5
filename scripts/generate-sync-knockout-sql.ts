import { writeFileSync } from "node:fs";
import path from "node:path";

import { THIRD_PLACE_ADVANCEMENT_MAP } from "../lib/world-cup-2026-third-place-map.ts";
import { WORLD_CUP_2026_GROUPS } from "../lib/world-cup-2026-round-of-32.ts";

const outputPath = path.join(process.cwd(), "supabase_sync_knockout_teams_apply.sql");

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

const thirdMapRows = Object.entries(THIRD_PLACE_ADVANCEMENT_MAP)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(
    ([key, value]) =>
      `    (${[
        key,
        value.T1,
        value.T2,
        value.T3,
        value.T4,
        value.T5,
        value.T6,
        value.T7,
        value.T8,
      ]
        .map(sqlString)
        .join(", ")})`,
  )
  .join(",\n");

const groupTeamRows = Object.entries(WORLD_CUP_2026_GROUPS)
  .flatMap(([group, teams]) => teams.map((team) => `    (${sqlString(group)}, ${sqlString(team)})`))
  .join(",\n");

const updateRows = [
  [73, "Group A runners-up", "Group B runners-up", "second:A", "second:B"],
  [74, "Group E winners", "Group A/B/C/D/F third place", "first:E", "third:T1"],
  [75, "Group F winners", "Group C runners-up", "first:F", "second:C"],
  [76, "Group C winners", "Group F runners-up", "first:C", "second:F"],
  [77, "Group I winners", "Group C/D/F/G/H third place", "first:I", "third:T2"],
  [78, "Group E runners-up", "Group I runners-up", "second:E", "second:I"],
  [79, "Group A winners", "Group C/E/F/H/I third place", "first:A", "third:T3"],
  [80, "Group L winners", "Group E/H/I/J/K third place", "first:L", "third:T4"],
  [81, "Group D winners", "Group B/E/F/I/J third place", "first:D", "third:T5"],
  [82, "Group G winners", "Group A/E/H/I/J third place", "first:G", "third:T6"],
  [83, "Group K runners-up", "Group L runners-up", "second:K", "second:L"],
  [84, "Group H winners", "Group J runners-up", "first:H", "second:J"],
  [85, "Group B winners", "Group E/F/G/I/J third place", "first:B", "third:T7"],
  [86, "Group J winners", "Group H runners-up", "first:J", "second:H"],
  [87, "Group K winners", "Group D/E/I/J/L third place", "first:K", "third:T8"],
  [88, "Group D runners-up", "Group G runners-up", "second:D", "second:G"],
] as const;

function resolveExpression(token: string) {
  const [kind, key] = token.split(":");

  if (kind === "third") {
    return `(select team from third_slot_teams where slot = ${sqlString(key)})`;
  }

  const column = kind === "first" ? "first_team" : "second_team";

  return `(select ${column} from group_top where group_name = ${sqlString(key)})`;
}

const updateSelects = updateRows
  .map(
    ([matchNumber, placeholderHome, placeholderAway, homeToken, awayToken]) =>
      `  select ${matchNumber} as match_number, ${sqlString(placeholderHome)} as placeholder_home, ${sqlString(
        placeholderAway,
      )} as placeholder_away, ${resolveExpression(homeToken)} as home_team, ${resolveExpression(
        awayToken,
      )} as away_team`,
  )
  .join("\n  union all\n");

const sharedCtes = `
group_teams(group_name, team) as (
  values
${groupTeamRows}
),
third_map(combination_key, t1, t2, t3, t4, t5, t6, t7, t8) as (
  values
${thirdMapRows}
),
group_matches as (
  select
    m.*,
    coalesce(m.group_name, gt_home.group_name) as inferred_group
  from public.matches m
  left join group_teams gt_home
    on gt_home.team = m.home_team
  left join group_teams gt_away
    on gt_away.team = m.away_team
   and gt_away.group_name = gt_home.group_name
  where m.stage = 'group'
    and gt_away.group_name is not null
),
readiness as (
  select
    count(*) as group_match_count,
    count(*) filter (
      where status = 'finished'
        and home_score is not null
        and away_score is not null
    ) as finished_with_scores
  from group_matches
),
team_rows as (
  select
    inferred_group as group_name,
    home_team as team,
    case when home_score > away_score then 3 when home_score = away_score then 1 else 0 end as points,
    home_score as goals_for,
    away_score as goals_against
  from group_matches
  where status = 'finished'
    and home_score is not null
    and away_score is not null
  union all
  select
    inferred_group as group_name,
    away_team as team,
    case when away_score > home_score then 3 when away_score = home_score then 1 else 0 end as points,
    away_score as goals_for,
    home_score as goals_against
  from group_matches
  where status = 'finished'
    and home_score is not null
    and away_score is not null
),
standings as (
  select
    group_name,
    team,
    count(*) as played,
    sum(points) as points,
    sum(goals_for) as goals_for,
    sum(goals_against) as goals_against,
    sum(goals_for) - sum(goals_against) as goal_difference
  from team_rows
  group by group_name, team
),
ranked as (
  select
    *,
    row_number() over (
      partition by group_name
      order by points desc, goal_difference desc, goals_for desc, team asc
    ) as group_rank
  from standings
),
group_top as (
  select
    group_name,
    max(team) filter (where group_rank = 1) as first_team,
    max(team) filter (where group_rank = 2) as second_team,
    max(team) filter (where group_rank = 3) as third_team
  from ranked
  group by group_name
),
best_thirds as (
  select *
  from ranked
  where group_rank = 3
  order by points desc, goal_difference desc, goals_for desc, team asc
  limit 8
),
best_key as (
  select string_agg(group_name, '' order by group_name) as combination_key
  from best_thirds
),
matched_third_map as (
  select third_map.*
  from third_map
  join best_key using (combination_key)
),
third_assignment(slot, group_name) as (
  select 'T1', t1 from matched_third_map union all
  select 'T2', t2 from matched_third_map union all
  select 'T3', t3 from matched_third_map union all
  select 'T4', t4 from matched_third_map union all
  select 'T5', t5 from matched_third_map union all
  select 'T6', t6 from matched_third_map union all
  select 'T7', t7 from matched_third_map union all
  select 'T8', t8 from matched_third_map
),
third_slot_teams as (
  select
    third_assignment.slot,
    ranked.team
  from third_assignment
  join ranked
    on ranked.group_name = third_assignment.group_name
   and ranked.group_rank = 3
),
updates as (
${updateSelects}
),
targets as (
  select
    m.id,
    updates.match_number,
    updates.home_team,
    updates.away_team,
    m.home_team as previous_home_team,
    m.away_team as previous_away_team
  from public.matches m
  join updates
    on (
      m.match_number = updates.match_number
      or (
        m.match_number is null
        and lower(trim(m.home_team)) = lower(trim(updates.placeholder_home))
        and lower(trim(m.away_team)) = lower(trim(updates.placeholder_away))
      )
    )
  where m.stage = 'round_of_32'
)
`;

const sql = `-- Sync 2026 World Cup round-of-32 real teams from finished group standings.
-- Generated by scripts/generate-sync-knockout-sql.ts.
-- This SQL does not modify predictions, odds, scores, or later knockout rounds.
-- It updates only public.matches.home_team / away_team for M73-M88.
-- Safety: update only runs when all 72 group matches are finished and have scores.

with
${sharedCtes}
select
  readiness.group_match_count,
  readiness.finished_with_scores,
  (select combination_key from best_key) as best_third_combination,
  (select count(*) from targets) as target_rows
from readiness;

with
${sharedCtes}
update public.matches m
set
  home_team = targets.home_team,
  away_team = targets.away_team
from targets, readiness
where m.id = targets.id
  and readiness.group_match_count = 72
  and readiness.finished_with_scores = 72
  and m.home_score is null
  and m.away_score is null
returning
  targets.match_number,
  targets.previous_home_team,
  targets.previous_away_team,
  m.home_team,
  m.away_team;
`;

writeFileSync(outputPath, sql, "utf8");
console.log(`Wrote ${outputPath}`);
