# Multi-Market Bets Audit

Generated at: 2026-07-02T15:40:13.230Z

## Summary

- predictions total: 392
- predictions missing market_key: 0
- predictions missing selection_key: 0
- h2h_90 legacy-compatible rows: 392
- active market duplicate option keys: 0
- advance markets outside knockout: 0
- totals_90 active rows without line: 0
- incomplete totals Over/Under pairs: 0
- totals_90 predictions without line: 0
- totals_90 settlement math issues: 0
- void payout/points issues: 0
- hardcoded 2.5 source hits: 0
- quarter-line filter risk source hits: 1

## Source Scan

### Hardcoded 2.5

- none

### Potential .25 / .75 Filter Risks

- lib\player-stats.ts:49: return Math.round(((won + halfWon * 0.5) / settledTotal) * 100);

## Leaderboard Check

Leaderboard is expected to be a view over `sum(predictions.points)` and must not be updated directly.
- local grouped player count from predictions: 12
- leaderboard rows returned: 21
