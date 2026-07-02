# Knockout 90-Minute Settlement Audit

This report is a dry-run only. It does not change predictions, coins, points, matches, or leaderboard data.

Betting settlement must use `matches.betting_result`, which is derived only from 90-minute regular-time score.
`matches.advancement_winner` is only for knockout progression and must not be used to settle 1X2 predictions.

## Summary

- Knockout matches audited: 32
- Needs manual review: 22
- Possible final-result settlement risk: 10
- Total non-ok rows: 32

## Matches

| Match | Stage | Teams | Legacy score/result | Regular score/betting_result | Final score/advancement | Settled | Won | Lost | Risk |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
2054e1fe-7f91-4a63-9761-227380f8a5ea | round_of_16 | Match 74 winners vs Match 77 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
4eccc4f6-131b-48a7-8005-39310d8efb85 | round_of_16 | Match 73 winners vs Match 75 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
67a864a8-0ac6-4840-a2ff-4b8ea3ec81d4 | round_of_16 | Match 76 winners vs Match 78 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
f31f2e54-a395-4f31-90ef-64c1e2ac3de3 | round_of_16 | Match 79 winners vs Match 80 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
c88fb3bd-dae1-4cc3-bd27-50d1606351ee | round_of_16 | Match 83 winners vs Match 84 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
86ccd611-145c-4308-a2e9-b416ff25fca9 | round_of_16 | Match 81 winners vs Match 82 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
c0b1adc5-7250-4ac8-a043-616595aab816 | round_of_16 | Match 86 winners vs Match 88 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
cc97dc59-1746-491b-a587-f28ead263aa1 | round_of_16 | Match 85 winners vs Match 87 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
51f37ce6-6906-4299-83dd-cad2ab1f5809 | quarter_final | Match 89 winners vs Match 90 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
f8c02a9a-fd96-4874-b57c-2e7673a939ed | quarter_final | Match 93 winners vs Match 94 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
0238387a-1fc0-4841-8749-e097ffe4a94c | quarter_final | Match 91 winners vs Match 92 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
cd5b3046-4108-436d-997e-4f5ccca3aa4a | quarter_final | Match 95 winners vs Match 96 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
32783de0-ff72-4353-91bc-cbbccef886db | round_of_32 | Mexico vs Ecuador | 2-0 / home_win | --- / - | --- / - | 3 | 0 | 3 | possible_final_result_settlement
570c424d-f9d8-40bf-894b-120ab17aac4d | round_of_32 | Portugal vs Croatia | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
a6bcaa8f-3b57-42a5-a941-194a49137b5f | round_of_32 | Spain vs Austria | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
081598f7-185f-4dd0-bba0-c11c77593abf | round_of_32 | Switzerland vs Algeria | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
d7124c25-68b8-4677-ae84-fdac2ca0b974 | round_of_32 | Argentina vs Cape Verde | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
616142ad-f647-47dc-a388-11d13c881eb8 | round_of_32 | Colombia vs Ghana | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
50867847-f0e7-44b0-918c-44014b87df9b | round_of_32 | Australia vs Egypt | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
f24f9606-39b2-4596-a5e9-7fbfc45295c4 | round_of_32 | USA vs Bosnia & Herzegovina | 2-0 / home_win | --- / - | --- / - | 6 | 4 | 2 | possible_final_result_settlement
9af2efa0-eb0b-46da-9943-53cb9a514fd1 | round_of_32 | Belgium vs Senegal | 3-2 / home_win | --- / - | --- / - | 7 | 3 | 4 | possible_final_result_settlement
b9707448-7c91-427a-a618-3bfece7b937b | round_of_32 | Ivory Coast vs Norway | 1-2 / away_win | --- / - | --- / - | 7 | 2 | 5 | possible_final_result_settlement
3099b134-fdbf-4d06-9c20-f3b0be823381 | round_of_32 | England vs DR Congo | 2-1 / home_win | --- / - | --- / - | 5 | 5 | 0 | possible_final_result_settlement
79860cd6-de2c-44d0-afba-0713dfbe08ce | round_of_32 | Netherlands vs Morocco | 1-1 / draw | --- / - | --- / - | 7 | 1 | 6 | possible_final_result_settlement
eacaa75d-8cff-46e9-818a-dd40490d2b2b | round_of_32 | Brazil vs Japan | 2-1 / home_win | --- / - | --- / - | 8 | 4 | 4 | possible_final_result_settlement
ec0b3f7d-1f25-4609-8cc4-2e481f43bef4 | round_of_32 | France vs Sweden | 3-0 / home_win | --- / - | --- / - | 7 | 7 | 0 | possible_final_result_settlement
9f177b04-a73a-4fac-af96-caa4f82fbb2f | round_of_32 | Germany vs Paraguay | 1-1 / draw | --- / - | --- / - | 7 | 2 | 5 | possible_final_result_settlement
4139a712-2b9f-4f05-8987-100c1ffdff57 | round_of_32 | South Africa vs Canada | 0-1 / away_win | --- / - | --- / - | 5 | 4 | 1 | possible_final_result_settlement
2474044a-5167-4eca-bc01-b1e094e22903 | semi_final | Match 97 winners vs Match 98 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
dba3ab85-fd75-4cd4-90f7-935dbe6bddf7 | semi_final | Match 99 winners vs Match 100 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
4ef73d23-047e-48d7-9b6d-8e91506793db | third_place | Match 101 losers vs Match 102 losers | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review
e0109118-9248-4f65-9fe4-6d88f724e022 | final | Match 101 winners vs Match 102 winners | --- / - | --- / - | --- / - | 0 | 0 | 0 | needs_manual_review

## Dry-Run Repair Plan

No automatic coin or points correction is produced unless a reliable 90-minute `betting_result` exists.
For rows marked `needs_manual_review`, first enter regular-time scores and advancement winner in the admin page.
After manual confirmation, run a separate dry-run to compare old prediction statuses with the corrected `betting_result` before applying any coin or points changes.
