# Belgium vs Senegal 90-Minute Compensation Audit

This is a dry-run report. No database changes were applied.

## Confirmed Scope

- Affected match: Belgium vs Senegal only.
- Correct 90-minute score: Belgium 2-2 Senegal.
- Correct betting_result: `draw`.
- Final score after extra time: Belgium 3-2 Senegal.
- advancement_winner: `home`.
- Netherlands vs Morocco: 90 minutes 1-1, 120 minutes 1-1, penalty winner differs; if current result is draw, 1X2 settlement is correct. No compensation generated.
- Germany vs Paraguay: 90 minutes 1-1, 120 minutes 1-1, penalty winner differs; if current result is draw, 1X2 settlement is correct. No compensation generated.

## Current Match Data

- match_id: `9af2efa0-eb0b-46da-9943-53cb9a514fd1`
- stage: round_of_32
- home_team: Belgium
- away_team: Senegal
- legacy home_score / away_score: 3-2
- legacy result: home_win
- current regular score: ---
- current betting_result: -
- current final score: ---
- current advancement_winner: -
- current result is home: yes

## Prediction Summary

- total predictions: 7
- prediction choice distribution: draw: 3, home_win: 3, away_win: 1
- old status distribution: lost: 4, won: 3
- new status distribution: won: 3, lost: 4

## User-Level Delta

| Nickname | Player ID | Prediction | Stake | Odds | Old Status | New Status | Old Payout | New Payout | Coin Delta | Old Points | New Points | Points Delta | Current Coins | Strict Coins After |
| --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
mr | `69535203-2b0d-49bd-bc4e-da285793efbc` | draw | 500 | 3.3 | lost | won | 0 | 1650 | 1650 | 0 | 330 | 330 | 8709 | 10359
盐田大益 | `441faf57-18c8-494e-957f-8bb5a7adfd71` | home_win | 5000 | 2.15 | won | lost | 10750 | 0 | -10750 | 215 | 0 | -215 | 16220 | 5470
Newton | `74043801-79ab-40ef-8fb8-d3f004506d5b` | away_win | 1880 | 3.4 | lost | lost | 0 | 0 | 0 | 0 | 0 | 0 | 77500 | 77500
卖教辅的 | `0e7caa36-5ac4-426e-b0d4-1967edb41d9c` | draw | 2000 | 3.4 | lost | won | 0 | 6800 | 6800 | 0 | 340 | 340 | 3302 | 10102
华尔街只狼 | `9ef17228-064c-4585-9f89-1df84ed94130` | home_win | 2000 | 2.15 | won | lost | 4300 | 0 | -4300 | 215 | 0 | -215 | 6990 | 2690
桐人 | `d8747bea-2e58-46f7-872c-64c6a14d5785` | draw | 1000 | 3.3 | lost | won | 0 | 3300 | 3300 | 0 | 330 | 330 | 19705 | 23005
夏天 | `f18d7084-198c-49b2-9a09-62b7cdc17f4c` | home_win | 50 | 2.15 | won | lost | 108 | 0 | -108 | 215 | 0 | -215 | 6164 | 6056

## Strategy A: Strict Correction

- Update prediction.status / payout / points to the corrected values.
- Apply `players.coins += coin_delta`, including negative deltas.
- Total coin_delta: -3408
- Total points_delta: 355
- Users whose coins would become negative: 0

## Strategy B: Friendly Compensation

- Update prediction.status / payout / points to the corrected values.
- Only top up `coin_delta > 0`.
- Do not deduct coins for users who were overpaid by the old settlement.
- Insert `coin_transactions` rows with `related_id = prediction_id` to prevent duplicate top-ups.
- Total top-up coins: 11750
- Total points_delta: 355

## Generated SQL

- Strict SQL: `supabase_fix_belgium_senegal_90min_strict.sql`
- Friendly SQL: `supabase_fix_belgium_senegal_90min_friendly.sql`

Neither SQL file was executed by this script.
