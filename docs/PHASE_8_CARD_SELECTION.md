# Phase 8 精简球星卡生产方案

本阶段放弃 234 人 / 1248 人真实头像自动制卡路线，回到高质量单卡方案。

目标：9 支国家队，每队 5 张专属球星卡，总计 45 张。

名单来源：当前工程内已导入的 FIFA 官方 2026 名单与 `data/card-production-packages.json` 中的现有 rarity / priority 分级。不得选择名单外球员。

## 一、最终 45 人制作名单

### Spain

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Spain | 拉明·亚马尔 | YAMAL Lamine | FW | 19 | Legend | 西班牙新一代门面，辨识度和收藏价值最高，适合作为国家队核心传奇卡。 | yamal-lamine.png |
| Spain | 罗德里 | RODRI | MF | 16 | Epic | 世界级中场核心，代表西班牙控制力与冠军气质。 | rodri.png |
| Spain | 佩德里 | PEDRI | MF | 20 | Epic | 高人气技术型中场，视觉和收藏辨识度强。 | pedri.png |
| Spain | 尼科·威廉姆斯 | WILLIAMS Nico | FW | 17 | Epic | 边路进攻明星，速度感和卡面表现力强。 | williams-nico.png |
| Spain | 达尼·奥尔莫 | OLMO Dani | FW | 10 | Epic | 前场多面手，补足西班牙进攻核心组合。 | olmo-dani.png |

### Argentina

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Argentina | 莱昂内尔·梅西 | MESSI Lionel | FW | 10 | Legend | 阿根廷绝对门面与历史级球星，收藏卡首批核心。 | messi-lionel.png |
| Argentina | 劳塔罗·马丁内斯 | MARTINEZ Lautaro | FW | 22 | Epic | 国家队锋线核心，进球属性和用户认知度高。 | lautaro.png |
| Argentina | 胡利安·阿尔瓦雷斯 | ALVAREZ Julian | FW | 9 | Epic | 高人气前场明星，适合进攻主题卡面。 | alvarez.png |
| Argentina | 亚历克西斯·麦卡利斯特 | MAC ALLISTER Alexis | MF | 20 | Epic | 中场核心，能代表阿根廷中场组织和硬度。 | mac-allister-alexis.png |
| Argentina | 埃米利亚诺·马丁内斯 | MARTINEZ Emiliano | GK | 23 | Epic | 顶级门将，国家队代表性强，适合作为门神型收藏卡。 | martinez-emiliano.png |

### Germany

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Germany | 曼努埃尔·诺伊尔 | NEUER Manuel | GK | 1 | Legend | 德国队历史级门将，国家队门面之一，适合 Legend。 | neuer-manuel.png |
| Germany | 贾马尔·穆西亚拉 | MUSIALA Jamal | MF | 10 | Epic | 新一代进攻核心，用户辨识度高，卡面冲击力强。 | musiala.png |
| Germany | 弗洛里安·维尔茨 | WIRTZ Florian | MF | 17 | Epic | 创造型中场明星，代表德国未来核心。 | wirtz.png |
| Germany | 约书亚·基米希 | KIMMICH Joshua | DF | 6 | Epic | 中后场核心，国家队稳定性和代表性强。 | kimmich.png |
| Germany | 凯·哈弗茨 | HAVERTZ Kai | FW | 7 | Epic | 前场明星，补足德国进攻端收藏价值。 | havertz.png |

### England

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| England | 哈里·凯恩 | KANE Harry | FW | 9 | Legend | 英格兰队长级锋线门面，收藏价值最高。 | kane.png |
| England | 裘德·贝林厄姆 | BELLINGHAM Jude | MF | 10 | Epic | 世界级中场明星，视觉辨识度和人气极高。 | bellingham.png |
| England | 布卡约·萨卡 | SAKA Bukayo | FW | 7 | Epic | 边路进攻核心，适合高冲击力卡面。 | saka.png |
| England | 德克兰·赖斯 | RICE Declan | MF | 4 | Epic | 中场屏障，代表英格兰中后场核心。 | rice.png |
| England | 乔丹·皮克福德 | PICKFORD Jordan | GK | 1 | Rare | 国家队稳定主力门将，补足位置覆盖和门将收藏线。 | pickford-jordan.png |

### Netherlands

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Netherlands | 维吉尔·范戴克 | VAN DIJK Virgil | DF | 4 | Legend | 荷兰队防线门面，世界级中卫，适合 Legend。 | vandijk.png |
| Netherlands | 科迪·加克波 | GAKPO Cody | FW | 11 | Epic | 前场核心，具备进攻表现力和收藏辨识度。 | gakpo.png |
| Netherlands | 弗伦基·德容 | DE JONG Frenkie | MF | 21 | Epic | 中场代表人物，技术型核心，适合高质量单卡。 | de-jong-frenkie.png |
| Netherlands | 孟菲斯·德佩 | DEPAY Memphis | FW | 10 | Rare | 国家队攻击线高辨识度球员，适合补充前场收藏。 | depay-memphis.png |
| Netherlands | 登泽尔·邓弗里斯 | DUMFRIES Denzel | DF | 22 | Rare | 边翼卫代表，补足中后场与力量型视觉。 | dumfries-denzel.png |

### Portugal

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Portugal | 克里斯蒂亚诺·罗纳尔多 | CRISTIANO RONALDO | FW | 7 | Legend | 葡萄牙绝对门面，最高收藏价值，首批 Legend 核心。 | ronaldo.png |
| Portugal | 布鲁诺·费尔南德斯 | BRUNO FERNANDES | MF | 8 | Epic | 中场核心与高人气球星，适合作为紫金 Epic 样板延展。 | bruno.png |
| Portugal | 拉斐尔·莱奥 | RAFAEL LEAO | FW | 17 | Epic | 边路进攻明星，速度与爆发力适合卡面表达。 | leao.png |
| Portugal | 鲁本·迪亚斯 | RUBEN DIAS | DF | 3 | Epic | 后防核心，国家队中后场代表。 | rubendias.png |
| Portugal | 贝尔纳多·席尔瓦 | BERNARDO SILVA | MF | 10 | Epic | 技术型中场明星，补足葡萄牙核心群。 | bernardo-silva.png |

### France

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| France | 基利安·姆巴佩 | MBAPPE Kylian | FW | 10 | Legend | 法国队绝对门面，世界级顶流，必做 Legend。 | mbappe-kylian.png |
| France | 奥斯曼·登贝莱 | DEMBELE Ousmane | FW | 7 | Epic | 进攻明星，动态视觉表现力强。 | dembele-ousmane.png |
| France | 奥雷利安·楚阿梅尼 | TCHOUAMENI Aurelien | MF | 8 | Epic | 中场核心，代表法国中轴线力量。 | tchouameni-aurelien.png |
| France | 威廉·萨利巴 | SALIBA William | DF | 17 | Epic | 后防核心，具备高辨识度和收藏价值。 | saliba-william.png |
| France | 特奥·埃尔南德斯 | HERNANDEZ Theo | DF | 19 | Epic | 进攻型边后卫，视觉冲击和位置覆盖兼具。 | hernandez-theo.png |

### Brazil

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Brazil | 内马尔 | NEYMAR JR | FW | 10 | Legend | 巴西 Legends 核心，用户辨识度与收藏价值最高。 | neymar.png |
| Brazil | 维尼修斯 | VINICIUS JUNIOR | FW | 7 | Epic | 现役顶级攻击手，适合高冲击力卡面。 | vinicius.png |
| Brazil | 拉菲尼亚 | RAPHINHA | FW | 11 | Epic | 进攻明星，补足巴西边路视觉。 | raphinha.png |
| Brazil | 卡塞米罗 | CASEMIRO | MF | 5 | Epic | 中场核心，巴西中轴线代表。 | casemiro.png |
| Brazil | 阿利松 | ALISSON | GK | 1 | Epic | 顶级门将，国家队代表性强，适合作为门神卡。 | alison.png |

### Japan

| Country | 中文名 | English | Position | Shirt No. | Suggested Rarity | Reason | Output Filename |
|---|---|---|---|---:|---|---|---|
| Japan | 久保建英 | KUBO Takefusa | MF | 8 | Legend | 日本队最高辨识度进攻核心，适合作为国家门面卡。 | kubo-takefusa.png |
| Japan | 堂安律 | DOAN Ritsu | MF | 10 | Epic | 高人气进攻中场，国家队代表性强。 | doan-ritsu.png |
| Japan | 镰田大地 | KAMADA Daichi | MF | 15 | Epic | 中场组织核心，适合技术型卡面。 | kamada-daichi.png |
| Japan | 富安健洋 | TOMIYASU Takehiro | DF | 22 | Epic | 后防核心，国际辨识度高，补足中后场。 | tomiyasu-takehiro.png |
| Japan | 铃木彩艳 | SUZUKI Zion | GK | 1 | Rare | 门将线代表，视觉差异明显，补足位置覆盖。 | suzuki-zion.png |

## 二、稀有度统计

| Rarity | Count |
|---|---:|
| Legend | 9 |
| Epic | 32 |
| Rare | 4 |
| Total | 45 |

## 三、制作顺序

### 1. Legend first

| Priority | Country | 中文名 | English | Output Filename |
|---:|---|---|---|---|
| 1 | Portugal | 克里斯蒂亚诺·罗纳尔多 | CRISTIANO RONALDO | ronaldo.png |
| 2 | Argentina | 莱昂内尔·梅西 | MESSI Lionel | messi-lionel.png |
| 3 | Brazil | 内马尔 | NEYMAR JR | neymar.png |
| 4 | France | 基利安·姆巴佩 | MBAPPE Kylian | mbappe-kylian.png |
| 5 | England | 哈里·凯恩 | KANE Harry | kane.png |
| 6 | Spain | 拉明·亚马尔 | YAMAL Lamine | yamal-lamine.png |
| 7 | Netherlands | 维吉尔·范戴克 | VAN DIJK Virgil | vandijk.png |
| 8 | Germany | 曼努埃尔·诺伊尔 | NEUER Manuel | neuer-manuel.png |
| 9 | Japan | 久保建英 | KUBO Takefusa | kubo-takefusa.png |

### 2. Epic second

| Country | 中文名 | English | Output Filename |
|---|---|---|---|
| Spain | 罗德里 | RODRI | rodri.png |
| Spain | 佩德里 | PEDRI | pedri.png |
| Spain | 尼科·威廉姆斯 | WILLIAMS Nico | williams-nico.png |
| Spain | 达尼·奥尔莫 | OLMO Dani | olmo-dani.png |
| Argentina | 劳塔罗·马丁内斯 | MARTINEZ Lautaro | lautaro.png |
| Argentina | 胡利安·阿尔瓦雷斯 | ALVAREZ Julian | alvarez.png |
| Argentina | 亚历克西斯·麦卡利斯特 | MAC ALLISTER Alexis | mac-allister-alexis.png |
| Argentina | 埃米利亚诺·马丁内斯 | MARTINEZ Emiliano | martinez-emiliano.png |
| Germany | 贾马尔·穆西亚拉 | MUSIALA Jamal | musiala.png |
| Germany | 弗洛里安·维尔茨 | WIRTZ Florian | wirtz.png |
| Germany | 约书亚·基米希 | KIMMICH Joshua | kimmich.png |
| Germany | 凯·哈弗茨 | HAVERTZ Kai | havertz.png |
| England | 裘德·贝林厄姆 | BELLINGHAM Jude | bellingham.png |
| England | 布卡约·萨卡 | SAKA Bukayo | saka.png |
| England | 德克兰·赖斯 | RICE Declan | rice.png |
| Netherlands | 科迪·加克波 | GAKPO Cody | gakpo.png |
| Netherlands | 弗伦基·德容 | DE JONG Frenkie | de-jong-frenkie.png |
| Portugal | 布鲁诺·费尔南德斯 | BRUNO FERNANDES | bruno.png |
| Portugal | 拉斐尔·莱奥 | RAFAEL LEAO | leao.png |
| Portugal | 鲁本·迪亚斯 | RUBEN DIAS | rubendias.png |
| Portugal | 贝尔纳多·席尔瓦 | BERNARDO SILVA | bernardo-silva.png |
| France | 奥斯曼·登贝莱 | DEMBELE Ousmane | dembele-ousmane.png |
| France | 奥雷利安·楚阿梅尼 | TCHOUAMENI Aurelien | tchouameni-aurelien.png |
| France | 威廉·萨利巴 | SALIBA William | saliba-william.png |
| France | 特奥·埃尔南德斯 | HERNANDEZ Theo | hernandez-theo.png |
| Brazil | 维尼修斯 | VINICIUS JUNIOR | vinicius.png |
| Brazil | 拉菲尼亚 | RAPHINHA | raphinha.png |
| Brazil | 卡塞米罗 | CASEMIRO | casemiro.png |
| Brazil | 阿利松 | ALISSON | alison.png |
| Japan | 堂安律 | DOAN Ritsu | doan-ritsu.png |
| Japan | 镰田大地 | KAMADA Daichi | kamada-daichi.png |
| Japan | 富安健洋 | TOMIYASU Takehiro | tomiyasu-takehiro.png |

### 3. Rare third

| Country | 中文名 | English | Output Filename |
|---|---|---|---|
| England | 乔丹·皮克福德 | PICKFORD Jordan | pickford-jordan.png |
| Netherlands | 孟菲斯·德佩 | DEPAY Memphis | depay-memphis.png |
| Netherlands | 登泽尔·邓弗里斯 | DUMFRIES Denzel | dumfries-denzel.png |
| Japan | 铃木彩艳 | SUZUKI Zion | suzuki-zion.png |

## 四、新 Thread 制卡启动 Prompt

复制以下 Prompt 到新的制卡 Thread 使用：

```text
项目：美加墨大乱斗 - 球星卡制作

任务目标：
为 2026 World Cup collectible card / 世界杯收藏卡册制作高质量球星卡图片。

卡牌定位：
- 这是世界杯收藏卡册，不是 FUT。
- 不是足球经理。
- 不使用能力值。
- 不使用攻防速数值。
- 不使用养成体系。
- 不出现金币、战力、评分、等级成长等玩法信息。

模板体系：
- Legend
- Epic
- Rare
- Common

设计强度：
- Legend = 100%
- Epic = 80%
- Rare = 60%
- Common = 40%

现有模板参考：
- assets/card_templates/sample-legend-ronaldo.png
- assets/card_templates/sample-epic-bruno.png
- assets/card_templates/sample-rare-diogo-costa.png
- assets/card_templates/sample-common-nelson-semedo.png

统一视觉规则：
- 保持统一世界杯收藏卡风格。
- 使用 FIFA 26 / 2026 World Cup / CAN MEX USA 2026 视觉体系。
- 不出现 UEFA EURO。
- 不出现 EURO 2024。
- 不出现 Qatar 2022。
- 不出现 World Cup 2022。
- 不出现能力值。
- 不出现攻击、防守、速度等属性。
- 不出现称号。
- 不出现短文案。
- 球员姓名使用中文名 + 英文名。
- 保留国家、号码、位置、稀有度。
- 卡面不要出现金币、编号、能力值。
- 人物形象允许 AI 生成，但必须尽可能接近该球员公众认知形象。
- 如果无法稳定像本人，优先保证高质量卡面与国家队辨识度。
- 每张卡都必须像同一个世界杯收藏卡体系下的不同稀有度版本，而不是不同产品。

图层与安全区：
- 固定三层结构：
  1. 背景与边框
  2. 球员主体
  3. UI 信息层
- UI 信息层不得遮挡球员脸部和核心身体识别区域。
- 顶部赛事条不得压到球员头部。
- 底部信息框只放：
  - 中文名
  - 英文名
  - 国家
  - 位置
  - 球衣号
  - 稀有度
- 底部信息框必须干净，不露出旧文字或多余文案。

输出要求：
- 单卡 PNG。
- 使用对应国家队球衣和国家队视觉色。
- 文件名使用制作名单里的 Output Filename。
- 不修改数据库。
- 不修改竞猜系统。
- 不生成 234 人。
- 不生成 1248 人。
- 不创建新玩法。

不要做的事：
- 不要调用 ComfyUI。
- 不要调用 Flux。
- 不要抓取真实头像。
- 不要改数据库。
- 不要改前端业务逻辑。
- 不要处理完整 234 人或 1248 人名单。
- 不要生成 Common 专属卡，除非后续另行指定。

制作名单来源：
使用 docs/PHASE_8_CARD_SELECTION.md 中的最终 45 人名单。
严格按名单的 Country / 中文名 / English / Position / Shirt No. / Suggested Rarity / Output Filename 制作。
```

## 五、不要做的事

- 不要生成图片。
- 不要调用 ComfyUI。
- 不要调用 Flux。
- 不要抓取真实头像。
- 不要修改数据库。
- 不要修改竞猜系统。
- 不要处理 234 人。
- 不要处理 1248 人。
- 不要创建新玩法。
