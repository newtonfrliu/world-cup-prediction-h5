# 2026 32强分区与第三名映射审计

## 审计结论

本次按用户提供的正确分区参考图复核并修复了当前规则。

问题根因不是 `THIRD_PLACE_ADVANCEMENT_MAP` 覆盖不足，而是淘汰赛下一轮路径曾经按 M73-M88 顺序简单两两配对，导致：

- M75: F1 vs C2
- M76: C1 vs F2
- M75 胜者 vs M76 胜者进入同一场 16强

这会让 `F1` 与 `F2` 在 16强直接相遇，违反参考图分区。

已修复为参考图分区路径。

## 当前 THIRD_PLACE_ADVANCEMENT_MAP 来源

文件：

- `lib/world-cup-2026-third-place-map.ts`

当前 `THIRD_PLACE_ADVANCEMENT_MAP`：

- 不是 FIFA Annex C 官方表手工录入。
- 不是 FIFA 原始数据导入。
- 不是 AI 生成。
- 是程序推导生成。

生成方式：

1. 枚举 A-L 中任选 8 个晋级第三名小组，共 `C(12, 8) = 495` 种。
2. 对每个组合，按 T1-T8 候选范围做回溯匹配。
3. 每个 T 槽位只使用其候选范围内的小组。
4. 每个第三名小组只使用一次。

因此，当前映射可以证明：

- 覆盖 495 种组合。
- 没有缺失组合。
- 没有重复使用同一个第三名。
- 每个第三名都落在该 T 槽允许的候选范围内。

但它不能证明：

- 与 FIFA Annex C 官方 495 行矩阵逐行一致。

## 第三名槽位候选

| Slot | 32强比赛 | 候选第三名 |
|---|---:|---|
| T1 | M74 | A/B/C/D/F |
| T2 | M77 | C/D/F/G/H |
| T3 | M79 | C/E/F/H/I |
| T4 | M80 | E/H/I/J/K |
| T5 | M81 | B/E/F/I/J |
| T6 | M82 | A/E/H/I/J |
| T7 | M85 | E/F/G/I/J |
| T8 | M87 | D/E/I/J/L |

## 参考图分区修复

文件：

- `lib/world-cup-2026-round-of-32.ts`
- `app/round-of-32-calculator/page.tsx`

### 修复前

下一轮曾按 M73-M88 顺序两两配对：

```txt
M89 = M73 vs M74
M90 = M75 vs M76
...
```

这导致：

```txt
M90 = winner(M75: F1/C2) vs winner(M76: C1/F2)
```

于是 C1/C2、F1/F2 都可能在 16强直接相遇。

### 修复后

按参考图显式配置路径：

```txt
M89 = winner M74 vs winner M77
M90 = winner M73 vs winner M75
M91 = winner M83 vs winner M84
M92 = winner M81 vs winner M82

M93 = winner M76 vs winner M78
M94 = winner M79 vs winner M80
M95 = winner M86 vs winner M88
M96 = winner M85 vs winner M87

M97  = winner M89 vs winner M90
M98  = winner M91 vs winner M92
M99  = winner M93 vs winner M94
M100 = winner M95 vs winner M96

M101 = winner M97 vs winner M98
M102 = winner M99 vs winner M100

M104 = winner M101 vs winner M102
```

页面左右分区显示顺序也按参考图调整：

```txt
左半区 32强：
M74, M77, M73, M75, M83, M84, M81, M82

右半区 32强：
M76, M78, M79, M80, M86, M88, M85, M87
```

## 修复后违规检查

独立枚举全部 495 种第三名组合后检查：

| 检查项 | 违规数量 |
|---|---:|
| 同组第一和第二在16强直接相遇 | 0 |
| 同组第一和第二在8强前相遇 | 0 |
| 同组第一和第三在32强第一轮相遇 | 0 |
| 同一小组任意两支晋级球队在16强直接相遇 | 0 |

校验输出：

```txt
mapCount: 495
missing: 0
firstSecondR16Count: 0
anySameGroupR16Count: 0
firstThirdR32Count: 0
```

## FIFA 规则引用与待确认点

可核对来源：

- FIFA World Cup 26 Match Schedule
- FIFA World Cup 2026 Regulations, Annex C
- 公开资料页：`https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage`

仍需注意：

当前代码已按参考图修复分区路径，但 `THIRD_PLACE_ADVANCEMENT_MAP` 仍是程序推导版本，不是 FIFA Annex C 官方 495 行手工录入版本。

若后续取得官方 Annex C 完整矩阵，应替换当前程序推导映射，并保留本审计中的冲突检查作为回归测试。

