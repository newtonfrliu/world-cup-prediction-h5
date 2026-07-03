# Multi-Market Betting

Status: completed

## Supported Markets

The betting system now supports three market types:

| Market Key | Name | Settlement Basis |
| --- | --- | --- |
| `h2h_90` | 90分钟胜平负 | 90分钟常规时间结果 |
| `advance` | 晋级球队 | 淘汰赛最终晋级方 |
| `totals_90` | 90分钟大小球 | 90分钟常规时间总进球 |

## Core Rules

- `h2h_90` and `totals_90` are settled by the 90-minute regular-time result.
- `advance` is settled by `matches.advancement_winner`.
- `totals_90` uses the real `line` returned by The Odds API.
- The system does not hardcode a default total such as `2.5`.
- Asian totals are supported:
  - `won`
  - `lost`
  - `void`
  - `half_win`
  - `half_lost`

## Data Model

`public.predictions` now includes market-specific fields:

- `market_key`
- `market_label`
- `selection_key`
- `selection_label`
- `line`

Legacy 90-minute win/draw/loss predictions are represented as:

- `market_key = 'h2h_90'`
- `selection_key = prediction`
- `line = 0`

A new table stores available betting options:

- `public.match_betting_markets`

It stores:

- `match_id`
- `market_key`
- `selection_key`
- `selection_label`
- `odds`
- `line`
- `source`
- `bookmaker`
- `is_active`

The prediction uniqueness rule is now:

```sql
unique(player_id, match_id, market_key)
```

This allows one player to place separate bets on different markets for the same match.

## UI

`/predict` has been updated to use grouped multi-market betting cards:

1. `90分钟胜平负`
2. `90分钟大小球`
3. `晋级球队`

The old duplicate win/draw/loss odds area has been removed.

All market options now use the same card-style UI:

- light card background
- option label
- large odds number
- selected state
- disabled state

`/profile` now displays:

- market name
- selected option
- settlement status

## Audit And Build

Audit command:

```bash
npm.cmd run audit:multi-market-bets
```

Latest audit result:

- passed
- no missing `market_key`
- no missing `selection_key`
- no hardcoded `2.5`
- no totals settlement math issues

Build status:

```bash
npm.cmd run build
```

Latest build result:

- passed
