# 球星卡样板阶段

数据来源：

- `docs/CARD_PRODUCTION_PACKAGES.md`
- `data/card-production-packages.json`

本阶段只制作 4 张葡萄牙样板卡，用于确认 Legend / Epic / Rare / Common 的视觉差异。  
不批量生成 234 张，不修改数据库，不写入 `card_art_url`，不覆盖现有图片。

## 统一卡片原则

- 类型：世界杯收藏图鉴卡
- 禁止：能力值数值、总评数值、攻击/防守/速度等战斗属性
- 禁止：FUT 数值卡风格
- 禁止：真实球员照片、俱乐部 Logo、商业品牌 Logo
- 允许：原创插画半身像、国家队主题色、稀有度边框、收藏册质感

## 样板总览

| 稀有度 | 球员 | 位置 | 号码 | 文件路径 |
| --- | --- | --- | --- | --- |
| Legend | 克里斯蒂亚诺·罗纳尔多 / CRISTIANO RONALDO | FW | 7 | `public/cards/portugal/sample-legend-ronaldo.png` |
| Epic | 布鲁诺·费尔南德斯 / BRUNO FERNANDES | MF | 8 | `public/cards/portugal/sample-epic-bruno.png` |
| Rare | 迪奥戈·科斯塔 / DIOGO COSTA | GK | 1 | `public/cards/portugal/sample-rare-diogo-costa.png` |
| Common | 内尔松·塞梅多 / NELSON SEMEDO | DF | 2 | `public/cards/portugal/sample-common-nelson-semedo.png` |

## Legend 样板

| 字段 | 内容 |
| --- | --- |
| 球员中文名 | 克里斯蒂亚诺·罗纳尔多 |
| 球员英文名 | CRISTIANO RONALDO |
| 国家 | Portugal |
| 位置 | FW |
| 稀有度 | Legend |
| 球衣号 | 7 |
| 称号 | 永恒队长 |
| 短文案 | 以国家荣耀为名，把每一次登场都变成时代记忆。 |
| 卡面图片路径 | `public/cards/portugal/sample-legend-ronaldo.png` |
| 文件名建议 | `sample-legend-ronaldo.png` |
| Supabase Match | `team=Portugal; player_name_en=CRISTIANO RONALDO; roster_source=fifa_official_squad` |

视觉方向：

黑金主视觉，国家荣耀，史诗电影海报感，强光效，最高稀有度。

最终 AI 生图 Prompt：

```text
Create a vertical World Cup collectible player card illustration, 2:3 ratio, premium black and gold Legend rarity. Player: Cristiano Ronaldo, Portuguese football icon, original illustrated heroic half-body portrait inspired by a veteran Portugal captain, not a real photo, no club logos, no brand logos. Card text areas must include Chinese name 克里斯蒂亚诺·罗纳尔多, English name CRISTIANO RONALDO, country Portugal, position FW, rarity Legend, shirt number 7, title 永恒队长, short copy 以国家荣耀为名，把每一次登场都变成时代记忆。 Visual style: cinematic national glory poster, black lacquer background, metallic gold frame, Portugal red and green light accents, strong rim light, subtle stadium light beams, premium foil texture, elegant collectible album card, no ability ratings, no attack defense speed numbers, no FUT-style overall number.
```

## Epic 样板

| 字段 | 内容 |
| --- | --- |
| 球员中文名 | 布鲁诺·费尔南德斯 |
| 球员英文名 | BRUNO FERNANDES |
| 国家 | Portugal |
| 位置 | MF |
| 稀有度 | Epic |
| 球衣号 | 8 |
| 称号 | 中场引擎 |
| 短文案 | 在节奏与灵感之间，为葡萄牙点亮下一次进攻。 |
| 卡面图片路径 | `public/cards/portugal/sample-epic-bruno.png` |
| 文件名建议 | `sample-epic-bruno.png` |
| Supabase Match | `team=Portugal; player_name_en=BRUNO FERNANDES; roster_source=fifa_official_squad` |

视觉方向：

紫金或队色能量，明星特写，冲击力强，但低于 Legend。

最终 AI 生图 Prompt：

```text
Create a vertical World Cup collectible player card illustration, 2:3 ratio, Epic rarity. Player: Bruno Fernandes, Portugal midfield star, original illustrated energetic half-body portrait, not a real photo, no club logos, no brand logos. Card text areas must include Chinese name 布鲁诺·费尔南德斯, English name BRUNO FERNANDES, country Portugal, position MF, rarity Epic, shirt number 8, title 中场引擎, short copy 在节奏与灵感之间，为葡萄牙点亮下一次进攻。 Visual style: purple and gold energy with Portugal red and green team accents, dynamic diagonal light streaks, star-player spotlight, polished foil border, powerful but clearly below Legend tier, collectible World Cup album card, no ability ratings, no attack defense speed numbers, no FUT-style overall number.
```

## Rare 样板

| 字段 | 内容 |
| --- | --- |
| 球员中文名 | 迪奥戈·科斯塔 |
| 球员英文名 | DIOGO COSTA |
| 国家 | Portugal |
| 位置 | GK |
| 稀有度 | Rare |
| 球衣号 | 1 |
| 称号 | 门前屏障 |
| 短文案 | 冷静守住最后一线，让每一次扑救都成为信心。 |
| 卡面图片路径 | `public/cards/portugal/sample-rare-diogo-costa.png` |
| 文件名建议 | `sample-rare-diogo-costa.png` |
| Supabase Match | `team=Portugal; player_name_en=DIOGO COSTA; roster_source=fifa_official_squad` |

视觉方向：

银蓝或国家队色边框，正式球员图鉴感，清晰、稳定、收藏感。

最终 AI 生图 Prompt：

```text
Create a vertical World Cup collectible player card illustration, 2:3 ratio, Rare rarity. Player: Diogo Costa, Portugal goalkeeper, original illustrated composed half-body portrait in goalkeeper pose, not a real photo, no club logos, no brand logos. Card text areas must include Chinese name 迪奥戈·科斯塔, English name DIOGO COSTA, country Portugal, position GK, rarity Rare, shirt number 1, title 门前屏障, short copy 冷静守住最后一线，让每一次扑救都成为信心。 Visual style: silver and deep blue frame with restrained Portugal red and green accents, clean official squad album feeling, crisp lighting, stable collectible card layout, subtle metallic border, clear portrait area, no ability ratings, no attack defense speed numbers, no FUT-style overall number.
```

## Common 样板

| 字段 | 内容 |
| --- | --- |
| 球员中文名 | 内尔松·塞梅多 |
| 球员英文名 | NELSON SEMEDO |
| 国家 | Portugal |
| 位置 | DF |
| 稀有度 | Common |
| 球衣号 | 2 |
| 称号 | 边路守卫 |
| 短文案 | 稳健覆盖边线，把每一次防守做成球队的底色。 |
| 卡面图片路径 | `public/cards/portugal/sample-common-nelson-semedo.png` |
| 文件名建议 | `sample-common-nelson-semedo.png` |
| Supabase Match | `team=Portugal; player_name_en=NELSON SEMEDO; roster_source=fifa_official_squad` |

视觉方向：

简洁国家队图鉴风，干净、轻量、可批量生产。

最终 AI 生图 Prompt：

```text
Create a vertical World Cup collectible player card illustration, 2:3 ratio, Common rarity. Player: Nelson Semedo, Portugal defender, original illustrated clean half-body portrait, not a real photo, no club logos, no brand logos. Card text areas must include Chinese name 内尔松·塞梅多, English name NELSON SEMEDO, country Portugal, position DF, rarity Common, shirt number 2, title 边路守卫, short copy 稳健覆盖边线，把每一次防守做成球队的底色。 Visual style: simple national team album card, clean white and light silver frame, Portugal red and green small accents, lightweight production-friendly layout, clear typography, neat portrait window, minimal foil, no ability ratings, no attack defense speed numbers, no FUT-style overall number.
```
