# Canada vs Morocco Score Sync Debug

Generated at: 2026-07-04T20:39:19.450Z

## Admin Sync Path

`app/admin/page.tsx` -> `app/api/admin/sync-scores/route.ts` -> `lib/syncScores.ts` -> The Odds API scores endpoint -> Supabase `matches` update -> active prediction settlement.

## Request Config

- sport_key: soccer_fifa_world_cup
- endpoint: https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores
- daysFrom: 3
- dateFormat: iso
- server_time: 2026-07-04T20:39:19.451Z
- api_key: exists, not printed

## Local Match Rows

```json
{
  "id": "4eccc4f6-131b-48a7-8005-39310d8efb85",
  "match_number": null,
  "home_team": "Canada",
  "away_team": "Morocco",
  "start_time": "2026-07-04T17:00:00+00:00",
  "status": "scheduled",
  "stage": "round_of_16",
  "result": null,
  "home_score": null,
  "away_score": null,
  "regular_home_score": null,
  "regular_away_score": null,
  "betting_result": null,
  "final_home_score": null,
  "final_away_score": null,
  "advancement_winner": null
}
```
Local selected by current sync query: yes

## Raw Related API Events

- total API events returned: 15
- related events for Canada/Morocco: 1

```json
{
  "id": "9c7073ae2c29ee4881bb695f92168c68",
  "sport_key": "soccer_fifa_world_cup",
  "sport_title": "FIFA World Cup",
  "commence_time": "2026-07-04T17:00:00Z",
  "completed": false,
  "home_team": "Canada",
  "away_team": "Morocco",
  "scores": [
    {
      "name": "Canada",
      "score": "0"
    },
    {
      "name": "Morocco",
      "score": "0"
    }
  ],
  "last_update": "2026-07-04T20:39:03Z"
}
```

## Matching Diagnostics

### Canada vs Morocco

- matched by current sync: no
- matched scores: -

Candidates:
```json
[
  {
    "apiHome": "Canada",
    "apiAway": "Morocco",
    "normalizedApiHome": "canada",
    "normalizedApiAway": "morocco",
    "commenceTime": "2026-07-04T17:00:00Z",
    "completed": false,
    "sameOrder": true,
    "reversedOrder": false,
    "includesHomeTeam": true,
    "includesAwayTeam": true,
    "timeDiffHours": 0,
    "withinTimeWindow": true,
    "hasHomeScore": true,
    "hasAwayScore": true,
    "selectedByCurrentSync": false,
    "notSelectedReason": "API event matched by teams/time but completed=false/status is not finished"
  }
]
```

Per related event diagnostics:
```json
[
  {
    "apiHome": "Canada",
    "apiAway": "Morocco",
    "normalizedApiHome": "canada",
    "normalizedApiAway": "morocco",
    "commenceTime": "2026-07-04T17:00:00Z",
    "completed": false,
    "sameOrder": true,
    "reversedOrder": false,
    "includesHomeTeam": true,
    "includesAwayTeam": true,
    "timeDiffHours": 0,
    "withinTimeWindow": true,
    "hasHomeScore": true,
    "hasAwayScore": true,
    "selectedByCurrentSync": false,
    "notSelectedReason": "API event matched by teams/time but completed=false/status is not finished"
  }
]
```

## Final Judgement

Canada vs Morocco: API event matches local teams/time, but The Odds API still reports completed=false/status not finished. Current sync intentionally does not mark the match finished or settle bets until the API finalizes the event.

## Fix Points

- Admin sync now receives detailed skipped match reasons instead of only a count.
- Score sync report includes request config, updated matches, skipped diagnostics, and unmatched API events.
- The Odds API scores endpoint currently accepts `daysFrom=3`; a trial with `daysFrom=7` returned `INVALID_SCORES_DAYS_FROM`, so this project keeps the maximum accepted 3-day window.
- This debug run is read-only and does not update matches, predictions, coins, payouts, or points.
