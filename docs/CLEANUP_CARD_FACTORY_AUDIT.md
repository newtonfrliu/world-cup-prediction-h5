# 球星卡自动化工厂清理审计

生成时间：2026-06-20

本报告只做审计，不删除文件，不修改 `package.json`，不修改业务代码。

## 扫描范围

关键词：

- `comfy`
- `flux`
- `card-image-prompts`
- `fetch-player-photos`
- `generate-card-images`
- `generate-template-cards`
- `card-style-samples`
- `sample-legend`
- `sample-epic`
- `sample-rare`
- `sample-common`
- `player_photos`
- `card_templates`
- `workflow`
- `prompt`
- `ai image`

额外检查：

- `package.json` scripts
- `app/` 页面引用
- `scripts/` 内部引用
- `.gitignore`
- `source_images/`、`processed/` 临时目录是否存在

## 审计结论

可以清理的内容主要集中在两条已经放弃的路线：

1. Wikimedia / Wikipedia / 搜索 API 头像抓取路线。
2. Phase 7 Flux / ComfyUI / rembg / sharp 自动制卡工厂 POC 路线。

需要保留的内容主要是：

1. FIFA 官方名单导入与中文名映射。
2. 9 国 card production package。
3. 稀有度与价格 migration。
4. Supabase migration。
5. 现有 `public/cards/` 下已经被线上卡册引用的正式卡图。
6. `assets/card_templates/` 下 4 张模板图，当前仍被 Phase 8 制卡规范作为模板参考。

当前工程根目录未发现 `source_images/` 或 `processed/` 目录。

---

## A. 建议删除

以下文件或目录只属于废弃自动化工厂实验，不被当前 `app/` 页面引用。

### 1. `scripts/card-factory/card-factory.config.ts`

- 创建目的：Phase 7 真实头像制卡 POC 的球员、路径、模板配置。
- 为什么现在可删除：Flux / ComfyUI / 自动化制卡工厂方案已放弃，当前 45 张精品单卡方案不再使用该 POC 配置。
- 是否被 `package.json` scripts 引用：间接引用；`cards:poc:*` 脚本会加载 `scripts/card-factory/*`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：被 `scripts/card-factory/compose-player-cards.ts`、`download-player-source-images.ts`、`process-player-portraits.ts` 引用。

### 2. `scripts/card-factory/compose-player-cards.ts`

- 创建目的：使用 `sharp` 将透明人物层合成到模板卡上，输出 POC 单卡。
- 为什么现在可删除：自动合成单卡 POC 已废弃；当前路线是高质量单卡制作，不再批量合成。
- 是否被 `package.json` scripts 引用：是，`cards:poc:compose`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 3. `scripts/card-factory/download-player-source-images.ts`

- 创建目的：从手工 manifest 下载 POC 球员 source image。
- 为什么现在可删除：手工 source_url 和自动下载真实头像路线已废弃。
- 是否被 `package.json` scripts 引用：是，`cards:poc:download`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 4. `scripts/card-factory/fetch-player-images.ts`

- 创建目的：通过 Bing / SerpAPI / Wikipedia / Wikimedia 自动搜索并下载球员候选头像。
- 为什么现在可删除：用户已明确停止 SerpAPI / Wikimedia 球员头像抓取方案。
- 是否被 `package.json` scripts 引用：是，`cards:poc:fetch-images`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 5. `scripts/card-factory/load-env.ts`

- 创建目的：为 card factory 脚本加载 `.env.local`。
- 为什么现在可删除：只服务于 `scripts/card-factory/*`，删除该 POC 管线后无独立价值。
- 是否被 `package.json` scripts 引用：间接引用。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：被 `scripts/card-factory/fetch-player-images.ts` 引用。

### 6. `scripts/card-factory/process-player-portraits.ts`

- 创建目的：用 sharp / rembg 处理头像，输出透明 PNG 人物层。
- 为什么现在可删除：自动抠图制卡方案已放弃。
- 是否被 `package.json` scripts 引用：是，`cards:poc:matting`、`cards:poc:process`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 7. `scripts/card-factory/rembg-remove.py`

- 创建目的：为 POC 管线调用 rembg 抠图。
- 为什么现在可删除：rembg 自动抠图链路已废弃。
- 是否被 `package.json` scripts 引用：间接引用。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：被 `scripts/card-factory/process-player-portraits.ts` 调用。

### 8. `scripts/card-factory/source-images-manifest.json`

- 创建目的：手工配置 POC 球员 source image URL。
- 为什么现在可删除：手工图片源下载方案已废弃。
- 是否被 `package.json` scripts 引用：间接引用。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：被 `scripts/card-factory/download-player-source-images.ts` 读取。

### 9. `scripts/fetch-player-photos.ts`

- 创建目的：批量抓取 Wikimedia / Wikipedia 球员头像到 `assets/player_photos/`。
- 为什么现在可删除：Wikimedia 球员头像抓取方案已明确停止，素材质量不达标。
- 是否被 `package.json` scripts 引用：是，`fetch:player-photos`。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 10. `scripts/generate-card-image-prompts.ts`

- 创建目的：生成 234 人完整球星卡 AI 生图 prompt 包。
- 为什么现在可删除：当前已经放弃 234 人 / 完整卡 prompt 批量生成路线，改为 9 国每队 5 张精品单卡。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 11. `scripts/generate-card-portrait-prompts.ts`

- 创建目的：生成 234 人人物层透明背景 portrait prompt 文档。
- 为什么现在可删除：portrait prompt 批量路线已停止，不再生成 234 人头像层。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 12. `docs/CARD_IMAGE_PROMPTS.md`

- 创建目的：234 人完整卡 AI prompt Markdown 包。
- 为什么现在可删除：完整卡 prompt 包已被 Phase 8 精品单卡路线取代。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/generate-card-image-prompts.ts` 生成。

### 13. `docs/CARD_PORTRAIT_PROMPTS.md`

- 创建目的：234 人人物层 prompt Markdown 包。
- 为什么现在可删除：人物层批量 prompt 路线已废弃。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/generate-card-portrait-prompts.ts` 生成。

### 14. `docs/CARD_STYLE_SAMPLES.md`

- 创建目的：早期 4 张样板卡 prompt 与样式说明。
- 为什么现在可删除：当前可保留实际模板图 `assets/card_templates/*` 和 Phase 8 规范文档；该样板 prompt 文档包含已废弃的称号 / 短文案方向。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 15. `data/card-style-samples.json`

- 创建目的：早期 4 张样板卡 prompt 的结构化数据。
- 为什么现在可删除：已被实际模板图与 Phase 8 规范取代，且包含废弃称号 / 短文案。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：否。

### 16. `data/card-image-prompts.json`

- 创建目的：234 人完整球星卡 prompt JSON。
- 为什么现在可删除：批量完整卡 prompt 方案已废弃。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/generate-card-image-prompts.ts` 生成。

### 17. `data/card-image-prompts.csv`

- 创建目的：234 人完整球星卡 prompt CSV。
- 为什么现在可删除：批量完整卡 prompt 方案已废弃。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/generate-card-image-prompts.ts` 生成。

### 18. `data/player-image-sources.json`

- 创建目的：记录 Phase 7C 自动头像搜索候选图、下载路径与来源。
- 为什么现在可删除：搜索 API / 真实头像候选路线已废弃；其中路径指向当前不存在的 `source_images/`。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/card-factory/fetch-player-images.ts` 生成。

### 19. `data/missing_players.json`

- 创建目的：记录 Phase 7C 自动头像搜索失败球员。
- 为什么现在可删除：自动头像搜索路线已废弃。
- 是否被 `package.json` scripts 引用：否。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：由 `scripts/card-factory/fetch-player-images.ts` 生成。

### 20. `assets/player_photos/**`

- 创建目的：Wikimedia / Wikipedia 抓取的人物照片缓存。
- 当前数量：46 个文件，包括 `assets/player_photos/manifest.json` 与各国家目录下 `.png` 文件。
- 为什么现在可删除：Wikimedia 球员头像抓取方案已停止，当前线上卡册读取的是 `public/cards/**` 与数据库 `card_art_url`，不是 `assets/player_photos/**`。
- 是否被 `package.json` scripts 引用：由 `fetch:player-photos` 对应脚本写入，但不被运行时读取。
- 是否被 `app/` 页面引用：否。
- 是否被其他 scripts 引用：只由 `scripts/fetch-player-photos.ts` 生成 / 管理。

---

## B. 建议保留

以下内容仍服务于当前线上功能、FIFA 官方名单、卡册、稀有度价格系统或正式卡图。

### 1. FIFA 官方名单与中文名

- `data/fifa-2026-squads.json`
- `data/player-name-zh-map.json`
- `scripts/import-fifa-squads.ts`
- `supabase_fifa_squads_migration.sql`

保留原因：官方名单、中文名、Supabase 官方名单 migration 的核心来源。

### 2. 9 国制作包与 Phase 8 选择文档

- `data/card-production-packages.json`
- `docs/CARD_PRODUCTION_PACKAGES.md`
- `docs/PHASE_8_CARD_SELECTION.md`

保留原因：当前精品单卡方案仍以 9 国 production package 和 Phase 8 45 人名单为依据。

### 3. 稀有度与价格系统

- `data/player-rarity-overrides.json`
- `data/unmatched-rarity-candidates.json`
- `supabase_player_rarity_and_price_migration.sql`

保留原因：当前数据库稀有度、价格、星级调整的真源与 migration。

### 4. Supabase 与卡册相关脚本

- `scripts/check-card-assets.ts`
- `scripts/generate-card-production-packages.ts`
- `scripts/generate-rarity-price-migration.ts`
- `scripts/importSchedule.ts`
- `scripts/syncOdds.ts`
- `scripts/syncScores.ts`
- `scripts/checkTeams.ts`

保留原因：这些脚本分别服务于卡图校验、production package、价格 migration、赛程导入、赔率同步、赛果结算与队名检查，不属于废弃制卡工厂。

### 5. `assets/card_templates/**`

- `assets/card_templates/sample-legend-ronaldo.png`
- `assets/card_templates/sample-epic-bruno.png`
- `assets/card_templates/sample-rare-diogo-costa.png`
- `assets/card_templates/sample-common-nelson-semedo.png`

保留原因：虽然文件名含 `sample-*`，但它们当前是 Phase 8 新 Thread 制卡 Prompt 的模板参考，不是废弃运行时代码。`docs/PHASE_8_CARD_SELECTION.md` 明确引用这 4 张模板。

### 6. 现有正式卡图

- `public/cards/**`

保留原因：线上卡册通过数据库 `player_cards.card_art_url` / `card_thumb_url` 指向 `public/cards/**`。例如当前 `public/cards/portugal/ronaldo.png`、`public/cards/portugal/bruno.png` 属于正式卡图资产，应保留。

### 7. 业务页面

- `app/collection/page.tsx`
- `app/profile/page.tsx`
- `app/predict/page.tsx`
- 以及现有 `app/leaderboard`、`app/bracket`、`app/admin` 等业务页面

保留原因：这些是当前线上功能页面，不属于废弃制卡工厂。

---

## C. 需要人工确认

### 1. `assets/card_templates/**` 是否长期保留

当前建议保留，因为 Phase 8 仍把它们作为设计语言参考。但如果后续 45 张正式卡全部完成，并且设计规范文档已经替代这些模板图，可以再评估是否转移到设计归档目录。

### 2. `docs/PHASE_8_CARD_SELECTION.md`

当前建议保留。文档中包含 “不要调用 ComfyUI / Flux” 等约束文字，这不是废弃工厂内容，而是当前新路线的边界说明。如果后续 Phase 8 完成，可归档。

### 3. `dotenv` 与 `sharp` 依赖

`dotenv` 曾用于 card factory 脚本环境变量加载，`sharp` 曾用于制卡 POC 合成；但是否仍被其他脚本或未来工具使用，需要在删除脚本后再单独检查依赖使用情况。本次不建议直接移除依赖。

---

## package.json 可清理 scripts

以下 npm script 只服务于已废弃制卡工厂或头像抓取路线，后续确认删除文件时可同步删除：

```json
"fetch:player-photos": "node scripts/fetch-player-photos.ts",
"cards:poc:fetch-images": "node scripts/card-factory/fetch-player-images.ts",
"cards:poc:download": "node scripts/card-factory/download-player-source-images.ts",
"cards:poc:matting": "node scripts/card-factory/process-player-portraits.ts",
"cards:poc:process": "node scripts/card-factory/process-player-portraits.ts",
"cards:poc:compose": "node scripts/card-factory/compose-player-cards.ts",
"cards:poc": "npm run cards:poc:download && npm run cards:poc:process && npm run cards:poc:compose"
```

本次未修改 `package.json`。

建议保留的 scripts：

```json
"import:schedule": "node scripts/importSchedule.ts",
"import:fifa-squads": "node scripts/import-fifa-squads.ts",
"check:card-assets": "node scripts/check-card-assets.ts",
"check:teams": "node scripts/checkTeams.ts",
"sync:odds": "node scripts/syncOdds.ts",
"sync:scores": "node scripts/syncScores.ts"
```

---

## .gitignore 检查

当前 `.gitignore` 没有发现 ComfyUI、Flux、大模型目录、临时图片目录或自动头像缓存目录相关规则。

当前没有编辑 `.gitignore`。后续如果继续做实验性素材流程，建议加入以下规则，避免大文件误提交：

```gitignore
/source_images/
/processed/
/assets/player_photos/
/ComfyUI/
/models/
/outputs/
```

注意：`/public/cards/` 不建议加入忽略规则，因为它保存线上正式卡图。

---

## 当前未发现的目录

审计时未发现以下目录存在：

- `source_images/`
- `processed/`

因此本轮没有将它们列入实际文件删除清单；仅在 `.gitignore` 建议中保留为未来实验防护。

---

## 建议清理顺序

如果确认执行清理，建议分两步做：

1. 删除 A 类文件与目录，并同步移除对应 `package.json` scripts。
2. 再运行：

```bash
npm run build
rg -n "card-factory|fetch-player-photos|CARD_IMAGE_PROMPTS|CARD_PORTRAIT_PROMPTS|assets/player_photos"
```

确认没有遗留引用后再提交。
