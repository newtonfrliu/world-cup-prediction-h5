# Semifinal Pairing Safety Audit

Generated at: 2026-07-12T08:56:32.890Z

## Current Wrong Semifinals

| inferred slot | id | current home | current away | status | start_time | Beijing time |
| --- | --- | --- | --- | --- | --- | --- |
| M101 / earlier semifinal | 2474044a-5167-4eca-bc01-b1e094e22903 | France | Argentina | scheduled | 2026-07-14T19:00:00+00:00 | 07/15 03:00 |
| M102 / later semifinal | dba3ab85-fd75-4cd4-90f7-935dbe6bddf7 | England | Spain | scheduled | 2026-07-15T19:00:00+00:00 | 07/16 03:00 |

## Correct Semifinals

- M101 / earlier semifinal: France vs Spain
- M102 / later semifinal: England vs Argentina

## Why Current Pairing Is Wrong

- Previous mapping used M101 = winner(M97) vs winner(M98), producing France vs Argentina.
- Previous mapping used M102 = winner(M99) vs winner(M100), producing England vs Spain.
- The corrected mapping is M101 = winner(M97) vs winner(M100), M102 = winner(M99) vs winner(M98).
- The Odds API candidate fixtures also indicate France vs Spain and England vs Argentina.

## Existing Semifinal Predictions

- total predictions: 0
- none

## Existing Semifinal Betting Markets

- total markets: 0
- no market cleanup needed

## Generated SQL

- fix SQL: `supabase_fix_semifinal_pairing.sql`
- cleanup SQL: not generated because no semifinal markets exist

## Safety Decision

SAFE TO APPLY: No semifinal predictions exist. Pairing correction can update only matches.home_team / matches.away_team.
