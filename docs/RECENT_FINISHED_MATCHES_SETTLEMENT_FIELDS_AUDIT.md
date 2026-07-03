# Recent Finished Matches Settlement Fields Audit

Generated at: 2026-07-03T13:16:33.846Z

## Summary

- audited matches: 0
- safe_to_auto_backfill: 0
- needs_manual_review: 0
- sql output: supabase_backfill_recent_finished_match_fields.sql

## Matches

| start_time | stage | match | score | regular | betting_result | final | advancement | active | settled | markets | safe | manual | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |

## Notes

- `safe_to_auto_backfill = yes` rows are written to `supabase_backfill_recent_finished_match_fields.sql`.
- The generated SQL only updates `public.matches` settlement fields.
- It intentionally does not update `predictions`, `players`, `coins`, `points`, `payout`, or the `leaderboard` view.
