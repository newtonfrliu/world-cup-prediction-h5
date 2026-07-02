# Knockout 90-Minute Settlement Audit

This file is the audit report target for:

```bash
npm.cmd run audit:knockout-settlement
```

The script is dry-run only. It does not update matches, predictions, coins,
points, or leaderboard data.

## Current Rule

- Betting settlement uses `matches.betting_result`.
- `matches.betting_result` must come only from 90-minute regular-time score.
- Knockout advancement uses `matches.advancement_winner`.
- `matches.advancement_winner` must not be used to settle 1X2 predictions.
- Legacy `matches.result` is only a compatibility fallback for older group-stage
  records.

## Required Setup

Run `supabase_match_betting_result_migration.sql` before running the audit,
otherwise the database will not contain the fields needed by the report:

- `regular_home_score`
- `regular_away_score`
- `betting_result`
- `final_home_score`
- `final_away_score`
- `advancement_winner`

## Dry-Run Output

After the migration is applied, run:

```bash
npm.cmd run audit:knockout-settlement
```

The script will overwrite this file with a match-by-match audit containing:

- match id / match number
- stage
- home team / away team
- legacy score and `result`
- regular-time score and `betting_result`
- final score and `advancement_winner`
- settled prediction count
- won count
- lost count
- risk status

Risk statuses:

- `ok`: settlement statuses match the 90-minute `betting_result`.
- `needs_manual_review`: no reliable 90-minute betting result exists.
- `possible_final_result_settlement`: predictions may have been settled using a
  final / advancement result instead of 90-minute result.

## Historical Repair Policy

Do not automatically deduct coins or rewrite points from this audit alone.
For rows needing review:

1. Confirm the official 90-minute score.
2. Enter `regular_home_score`, `regular_away_score`, `betting_result`,
   `final_home_score`, `final_away_score`, and `advancement_winner`.
3. Generate a separate dry-run comparing old prediction statuses with the
   corrected `betting_result`.
4. Only then apply any coin / points correction.
