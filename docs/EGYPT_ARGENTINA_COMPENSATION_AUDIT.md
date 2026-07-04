# Egypt / Argentina Knockout Compensation Audit

This is a dry-run report. No database changes were applied.

## Final Status

This P0 compensation has been completed.

- Australia vs Egypt: Egypt advance bets have been settled correctly.
- Argentina vs Cape Verde: 90-minute draw bets have been settled correctly.
- Argentina vs Cape Verde: `totals_90` has been settled correctly using 90-minute total goals = 2.
- Latest `audit:egypt-argentina-compensation` result:
  - affected predictions = 0
  - friendly top-up = 0
  - points delta = 0
- `npm.cmd run build` passed.
- Do not execute the generated compensation SQL again, to avoid duplicate compensation.

## Confirmed Settlement Rules

- Australia vs Egypt: 90 minutes 1-1, penalty winner Egypt. `advance` settles by `advancement_winner = away`.
- Argentina vs Cape Verde: 90 minutes 1-1, extra-time final 3-2. `h2h_90` settles by `betting_result = draw`.
- Argentina vs Cape Verde: `totals_90` settles by 90-minute total goals only: 1 + 1 = 2.
- Extra-time goals must not be included in `totals_90`.

## Match Field Audit

### Australia vs Egypt

| Field | Current | Correct | Status |
| --- | --- | --- | --- |
| status | finished | finished | ok |
| regular_home_score | 1 | 1 | ok |
| regular_away_score | 1 | 1 | ok |
| betting_result | draw | draw | ok |
| final_home_score | 1 | 1 | ok |
| final_away_score | 1 | 1 | ok |
| advancement_winner | away | away | ok |

- match_id: `50867847-f0e7-44b0-918c-44014b87df9b`
- legacy score/result: 1-1 / draw
- needs field fix: no

### Argentina vs Cape Verde

| Field | Current | Correct | Status |
| --- | --- | --- | --- |
| status | finished | finished | ok |
| regular_home_score | 1 | 1 | ok |
| regular_away_score | 1 | 1 | ok |
| betting_result | draw | draw | ok |
| final_home_score | 3 | 3 | ok |
| final_away_score | 2 | 2 | ok |
| advancement_winner | home | home | ok |

- match_id: `d7124c25-68b8-4677-ae84-fdac2ca0b974`
- legacy score/result: 3-2 / home_win
- needs field fix: no

## Australia vs Egypt advance Audit

- Match: Australia vs Egypt
- Market: `advance`
- Rule: Egypt advanced on penalties, so away_advance = won and home_advance = lost.
- Total predictions in market: 2
- Audited non-cancelled predictions: 2
- Affected predictions: 0
- Selection distribution: away_advance: 2
- Old status distribution: won: 2
- New status distribution: won: 2

| Nickname | Player ID | Prediction ID | Selection | Line | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
卖教辅的 | `0e7caa36-5ac4-426e-b0d4-1967edb41d9c` | `761d9b32-be3e-4f9f-9696-2d64c8a2e914` | 埃及 晋级 | 0 | 1000 | 1.65 | won | won | 1650 | 1650 | 0 | 165 | 165 | 0
沙漏 | `7c02f0ee-5914-4567-bd99-9ceb4d4c48e7` | `945ee1d0-14a5-4f61-8406-4491f731e856` | 埃及 晋级 | 0 | 307700 | 1.65 | won | won | 507705 | 507705 | 0 | 165 | 165 | 0

## Argentina vs Cape Verde h2h_90 Audit

- Match: Argentina vs Cape Verde
- Market: `h2h_90`
- Rule: 90-minute score was 1-1, so draw = won and home_win / away_win = lost.
- Total predictions in market: 4
- Audited non-cancelled predictions: 4
- Affected predictions: 0
- Selection distribution: draw: 2, home_win: 2
- Old status distribution: won: 2, lost: 2
- New status distribution: won: 2, lost: 2

| Nickname | Player ID | Prediction ID | Selection | Line | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
卖教辅的 | `0e7caa36-5ac4-426e-b0d4-1967edb41d9c` | `5a939c48-d03b-4b10-99af-31ab8b1fe138` | 平局 | 0 | 2000 | 8.5 | won | won | 17000 | 17000 | 0 | 850 | 850 | 0
夏天 | `f18d7084-198c-49b2-9a09-62b7cdc17f4c` | `a06b9b79-d9c9-4dab-9a28-c113c9ef49d0` | 主胜 | 0 | 50 | 1.11 | lost | lost | 0 | 0 | 0 | 0 | 0 | 0
盐田大益 | `441faf57-18c8-494e-957f-8bb5a7adfd71` | `330ea019-58b9-484b-89e4-512d55a4e734` | 主胜 | 0 | 5000 | 1.11 | lost | lost | 0 | 0 | 0 | 0 | 0 | 0
mr | `69535203-2b0d-49bd-bc4e-da285793efbc` | `489ebed3-fc83-4249-a64d-60d7ad320f6d` | 平 | 0 | 500 | 8 | won | won | 4000 | 4000 | 0 | 800 | 800 | 0

## Argentina vs Cape Verde totals_90 Audit

- Match: Argentina vs Cape Verde
- Market: `totals_90`
- Rule: 90-minute total goals = 2; extra-time goals are excluded.
- Total predictions in market: 1
- Audited non-cancelled predictions: 1
- Affected predictions: 0
- Selection distribution: under: 1
- Old status distribution: won: 1
- New status distribution: won: 1

| Nickname | Player ID | Prediction ID | Selection | Line | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
卖教辅的 | `0e7caa36-5ac4-426e-b0d4-1967edb41d9c` | `a5bd48de-3bff-42e2-8851-3c9f981957f5` | 小 2.5 | 2.5 | 100 | 2.3 | won | won | 230 | 230 | 0 | 230 | 230 | 0

## Summary

- affected predictions: 0
- affected users: 0
- total coin_delta strict: 0
- total friendly compensation amount: 0
- total points_delta: 0
- strict negative coin risk users: 0

## Generated SQL

- Match field SQL: `supabase_fix_egypt_argentina_match_fields.sql`
- Friendly compensation SQL: `supabase_fix_egypt_argentina_compensation_friendly.sql`

Neither SQL file was executed by this script.

## Notes

- Friendly SQL corrects `predictions.status`, `payout`, and `points` for affected prediction IDs.
- Friendly SQL tops up only positive `coin_delta` and does not deduct overpaid coins.
- `coin_transactions` uses `type = 'knockout_rule_compensation'` and `related_id = prediction_id` for idempotency.
- `public.leaderboard` is a view and is not updated directly.
