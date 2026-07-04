# Recent Finished Matches Settlement Dry Run

Generated at: 2026-07-04T20:54:11.365Z
Mode: apply

## Summary

- predictions to settle: 8
- match/market groups: 3
- total payout: 69563

## Match Market Summary

| match_id | match | market_key | active_count | won | lost | void | half_win | half_lost | total_payout | affected_players |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4eccc4f6-131b-48a7-8005-39310d8efb85 | Canada vs Morocco | totals_90 | 3 | 2 | 1 | 0 | 0 | 0 | 1188 | 3 |
| 4eccc4f6-131b-48a7-8005-39310d8efb85 | Canada vs Morocco | h2h_90 | 4 | 1 | 3 | 0 | 0 | 0 | 875 | 4 |
| 4eccc4f6-131b-48a7-8005-39310d8efb85 | Canada vs Morocco | advance | 1 | 1 | 0 | 0 | 0 | 0 | 67500 | 1 |

## Notes

- Only `status = active` predictions are included.
- `h2h_90` uses `betting_result`.
- `totals_90` uses `regular_home_score + regular_away_score`.
- `advance` uses `advancement_winner`; rows with missing `advancement_winner` are skipped.
- This script does not update the `leaderboard` view.
