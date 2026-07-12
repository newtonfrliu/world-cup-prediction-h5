# Knockout Team Sync Audit

Generated at: 2026-07-12T08:58:09.027Z
Mode: apply

## Summary

- update plans: 14
- updated: 2
- missing advancement_winner: 2
- remaining placeholders after plan: 0

## Semifinal Pairing Correction

- Previous wrong semifinal pairing: M101 France vs Argentina, M102 England vs Spain.
- The Odds API / real fixture candidates: M101 France vs Spain, M102 England vs Argentina.
- Corrected 8-team bracket mapping: M101 = winner(M97) vs winner(M100), M102 = winner(M99) vs winner(M98).
- This sync updates only matches.home_team and matches.away_team for unlocked target matches.

## Round Of 32 Winners

| match | home | away | status | score | advancement_winner | winner_team |
| --- | --- | --- | --- | --- | --- | --- |
| M73 | South Africa | Canada | finished | 0:1 | away | Canada |
| M74 | Germany | Paraguay | finished | 1:1 | away | Paraguay |
| M75 | Netherlands | Morocco | finished | 1:1 | away | Morocco |
| M76 | Brazil | Japan | finished | 2:1 | home | Brazil |
| M77 | France | Sweden | finished | 3:0 | home | France |
| M78 | Ivory Coast | Norway | finished | 1:2 | away | Norway |
| M79 | Mexico | Ecuador | finished | 2:0 | home | Mexico |
| M80 | England | DR Congo | finished | 2:1 | home | England |
| M81 | Argentina | Cape Verde | finished | 3:2 | home | Argentina |
| M82 | Australia | Egypt | finished | 1:1 | away | Egypt |
| M83 | Switzerland | Algeria | finished | 2:0 | home | Switzerland |
| M84 | Colombia | Ghana | finished | 1:0 | home | Colombia |
| M85 | Belgium | Senegal | finished | 3:2 | home | Belgium |
| M86 | USA | Bosnia & Herzegovina | finished | 2:0 | home | USA |
| M87 | Portugal | Croatia | finished | 2:1 | home | Portugal |
| M88 | Spain | Austria | finished | 3:0 | home | Spain |

### Missing Round Of 32 Advancement Winner

- none

## Round Of 16 Winners

| match | home | away | status | score | advancement_winner | winner_team |
| --- | --- | --- | --- | --- | --- | --- |
| M89 | Paraguay | France | finished | 0:1 | away | France |
| M90 | Canada | Morocco | finished | 0:3 | away | Morocco |
| M91 | Brazil | Norway | finished | 1:2 | away | Norway |
| M92 | Mexico | England | finished | 2:3 | away | England |
| M93 | Argentina | Egypt | finished | 3:2 | home | Argentina |
| M94 | Switzerland | Colombia | finished | 0:0 | home | Switzerland |
| M95 | Portugal | Spain | finished | 0:1 | away | Spain |
| M96 | USA | Belgium | finished | 1:4 | away | Belgium |

### Missing Round Of 16 Advancement Winner

- none

## Quarter Finals Winners

| match | home | away | status | score | advancement_winner | winner_team |
| --- | --- | --- | --- | --- | --- | --- |
| M97 | France | Morocco | finished | 2:0 | home | France |
| M98 | Argentina | Switzerland | finished | 3:1 | home | Argentina |
| M99 | Norway | England | finished | 1:2 | away | England |
| M100 | Spain | Belgium | finished | 2:1 | home | Spain |

### Missing Quarter Finals Advancement Winner

- none

## Semi Finals Winners

| match | home | away | status | score | advancement_winner | winner_team |
| --- | --- | --- | --- | --- | --- | --- |
| M101 | France | Spain | scheduled | -:- | - | - |
| M102 | England | Argentina | scheduled | -:- | - | - |

### Missing Semi Finals Advancement Winner

- M101: France vs Spain (scheduled)
- M102: England vs Argentina (scheduled)

## Knockout Round Updates

| match | old home | old away | new home | new away | updated | reason |
| --- | --- | --- | --- | --- | --- | --- |
| M89 | Paraguay | France | Paraguay | France | no | skipped because status=finished |
| M90 | Canada | Morocco | Canada | Morocco | no | skipped because status=finished |
| M91 | Brazil | Norway | Brazil | Norway | no | skipped because status=finished |
| M92 | Mexico | England | Mexico | England | no | skipped because status=finished |
| M93 | Argentina | Egypt | Argentina | Egypt | no | skipped because status=finished |
| M94 | Switzerland | Colombia | Switzerland | Colombia | no | skipped because status=finished |
| M95 | Portugal | Spain | Portugal | Spain | no | skipped because status=finished |
| M96 | USA | Belgium | USA | Belgium | no | skipped because status=finished |
| M97 | France | Morocco | France | Morocco | no | skipped because status=finished |
| M98 | Argentina | Switzerland | Argentina | Switzerland | no | skipped because status=finished |
| M99 | Norway | England | Norway | England | no | skipped because status=finished |
| M100 | Spain | Belgium | Spain | Belgium | no | skipped because status=finished |
| M101 | France | Argentina | France | Spain | yes | updated |
| M102 | England | Spain | England | Argentina | yes | updated |

## Semifinal Safety And Odds Sync

- Existing semifinal predictions before correction: 0.
- Existing semifinal betting markets before correction: 0.
- No cleanup SQL was needed for wrong semifinal markets.
- `supabase_fix_semifinal_pairing.sql` was generated as a reviewable SQL fallback, but the correction was applied through `npm.cmd run sync:knockout-winners -- --apply`.
- `npm.cmd run sync:odds` was rerun after the pairing correction.
- Odds sync result: updated 2 matches; skipped only the current third-place placeholder `Match 101 losers vs Match 102 losers`.

## Placeholder Check

- no placeholders found in synced target rounds
