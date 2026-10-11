# 前沿安全框架——RSP、PF 與 FSF（Frontier Safety Frameworks — RSP, PF, FSF）

> 全球三大頂尖實驗室的安全治理框架，共同定義了 2026 年前沿大模型能力的產業治理規範。Anthropic《負責任擴展政策 v3.0》（RSP，2026 年 2 月）借鑑生物安全等級標準，引入了分級的 AI 安全等級體系（ASL-1 至 ASL-5+），其中針對涉及 CBRN（化學、生物、放射性、核子）危險能力的 ASL-3 已於 2025 年 5 月正式觸發啟動。OpenAI《防備框架 v2》（Preparedness Framework, PF，2025 年 4 月）確立了納入重點追蹤能力的五大嚴苛準則，並在治理層面嚴格分離「能力報告」與「防護措施報告」。Google DeepMind《前沿安全框架 v3.0》（FSF，2025 年 9 月）劃定了各領域的臨界能力等級（CCL），並在 v3.0 中全新增設了「有害操縱（Harmful Manipulation）」CCL。三大實驗室如今皆已正式引入了「競爭對手調整條款（Competitor-adjustment clauses）」，允許在同行未實施對等防護便冒進發布時彈性順延自身的安全約束。跨實驗室的治理共識在架構上高度一致，僅在名詞術語上略有差異：Anthropic 的「能力閾值（Capability Thresholds）」、OpenAI 的「高能力閾值（High Capability thresholds）」以及 DeepMind 的「臨界能力等級（Critical Capability Levels）」實質指向完全同構的物理構造。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 Anthropic 的 ASL 分級階梯結構，以及觸發啟動 ASL-3 安全防護的具體條件。
- 列出 OpenAI《防備框架 v2》中判定一項危險能力是否納入重點追蹤的五大關鍵準則。
- 掌握 DeepMind 的臨界能力等級（CCL）架構，並闡明 v3.0 全新增設的「有害操縱」CCL 的實質內涵。
- 深刻剖析各框架中引入的「競爭對手調整條款」，並評估其對全球 AI 軍備競賽博弈產生的深遠影響。
- 定義安全論證（Safety case），並掌握其三大支柱結構（即時監控、不可行性、能力剝奪）。

## The Problem｜問題

第 07 至 17 節的研究確立了一系列嚴峻現實：大模型具備欺騙與謀劃潛力、軍民兩用致命能力正在快速逼近臨界點，且外部安全評測存在顯著的盲區與極限。一個手握前沿頂尖模型權重的大型實驗室，迫切需要一套制度化的內部安全治理框架，用以明確界定：
- 在何種具體能力閾值被觸發時，系統必須強制掛載全新的實體防護機制？
- 在推進下一代模型巨額算力擴展之前，必須強制完成哪些獨立安全評測？
- 一份「安全論證（Safety Case）」應當包含哪些要素？
- 當面臨殘酷的商業競爭博弈時（若競爭對手完全不顧安全紅線冒進發布，我們該如何自處？），治理體系該如何應對？

三大前沿框架代表了 2025 至 2026 年產業界最頂尖的治理智慧——它們固然不完美、處於持續演進之中，但在各大實驗室之間已達成高度默契。當前全球監管的核心爭端，早已不再是「要不要建立安全框架」，而是「現有的框架是否足以抵禦即將到來的未知風險」。

## The Concept｜核心概念

### Anthropic《負責任擴展政策 v3.0》（2026 年 2 月）（Anthropic Responsible Scaling Policy v3.0 (February 2026)）

ASL（AI Safety Level）階梯架構：
- **ASL-1**：非前沿模型（能力弱於公認的基準前沿模型，無顯著宏觀危害）。
- **ASL-2**：當前前沿基礎線；遵循常規安全流程即可交付發布。
- **ASL-3**：引發災難性濫用的風險顯著攀升；具備實質性的 CBRN 賦能能力。已於 2025 年 5 月正式宣告觸發啟動。
- **ASL-4**：跨越「AI R&D-2」能力閾值；模型具備自動化執行初階 AI 演算法研發的能力。
- **ASL-5+**：高階 AI 自主研發；模型能顯著加速自身的有效尺度擴展與演化迭代。

v3.0 版本的重大突破：
- 引入「前沿安全路線圖（Frontier Safety Roadmaps）」（以脫敏形式向全球公眾發布）。
- 發布每季度風險報告（Risk Reports，部分章節引入獨立第三方專家同行評審）。
- 將 AI 研發能力細緻解耦為「AI R&D-2」與「AI R&D-4」兩個獨立里程碑。
- 一旦模型能力跨越「AI R&D-4」紅線，發布前必須強制提出具備肯定性證明的**主動安全論證（Affirmative safety case）**，明確識別並封堵模型自主追求非對齊偏離目標的潛在失控風險。

### OpenAI《防備框架 v2》（2025 年 4 月 15 日）（OpenAI Preparedness Framework v2 (April 15, 2025)）

納入重點追蹤危險能力的五大審核準則：
- **具備合理可行性（Plausible）**：存在邏輯自洽且符合物理規律的威脅建模路徑。
- **具備可測量性（Measurable）**：能透過客觀的實證基準進行量化測量。
- **危害後果嚴重（Severe）**：潛在的實體傷害規模極其巨大。
- **屬於全新增量（Net-new）**：絕非既有常規風險的單純規模放大，而是全新維度的未知威脅。
- **具備瞬間爆發性或不可逆性（Instantaneous-or-irremediable）**：危害爆發極其迅猛，或一旦發生便在物理與法律層面永遠無法挽回。

唯有同時滿足這五大準則的能力，才會被正式納入追蹤清單。其餘平淡風險則由常規產品安全團隊接管。

PF v2 版本的其他核心治理架構：
- 在組織結構上將「能力報告（Capabilities Reports，評估模型能做到什麼）」與「防護措施報告（Safeguards Reports，評估部署了何種實體控制項）」徹底分離。
- 設立獨立的安全諮詢小組（Safety Advisory Group）負責專業審查。
- 最終由公司領導層批准發布，並由董事會下設的「安全與防護委員會」履行最高監督權。
- **「競爭調整條款（Adjustment clause）」**：若市場上其他主要同業實驗室在缺乏對等防護的前提下冒進發布了同等級別的模型，OpenAI 明確保留動態調低自身安全約制門檻的權利。

### Google DeepMind《前沿安全框架 v3.0》（2025 年 9 月）（DeepMind Frontier Safety Framework v3.0 (September 2025)）

依據垂直領域劃定的臨界能力等級（Critical Capability Levels, CCLs）：
- 生物武器賦能臨界線（Bioweapon Uplift CCL）
- 網路攻擊賦能臨界線（Cyber Uplift CCL）
- 機器學習自主研發加速臨界線（ML R&D Acceleration CCL）
- **有害操縱臨界線（Harmful Manipulation CCL，v3.0 全新增設）**：專門涵蓋那些能在高風險政治、金融或司法情境下，深層扭曲並操控人類群體核心信念與決策行為的高智力模型。

2025 年 2 月發布的 v2.0 版本已先行引入了欺騙性對齊專章，並為 ML R&D 臨界等級配置了最高規格的實體物理安全防護隔離。

### 跨實驗室架構對齊與術語收斂（Cross-lab alignment）

- Anthropic 稱之為「能力閾值（Capability Thresholds）」。
- DeepMind 稱之為「臨界能力等級（Critical Capability Levels, CCLs）」。
- OpenAI 稱之為「高能力閾值（High Capability thresholds）」。

產業界尚未統一文字名稱。然而在架構層面，三者已達成高度收斂：皆劃分出三大前沿階梯，皆發布了透明的量化評測指標，且自 2025 年起，三者皆無一例外地在法務條款中內嵌了競爭對手調整條款。

### 安全論證架構（Safety cases）

安全論證是一份書面論證，用以說明某款大模型在最壞情況假設下，部署仍具可接受的安全性。標準的現代安全論證必須立足於三大支柱：

- **即時監控支柱（Monitoring）**：能否偵測到發生的不良行為？
- **不可行性支柱（Illegibility / Infeasibility）**：在給定的 Token 步長與運算預算內，模型是否在物理上根本缺乏策劃並執行一套連貫陰謀的能力？
- **能力剝奪支柱（Incapability）**：透過預訓練過濾或機器遺忘技術，模型是否不具備引發該特定災難的能力？

不同類型的風險分別主攻不同的支柱。對於 ASL-3 等級的 CBRN 生化威脅，能力剝奪（以機器遺忘作為主要手段）是第一核心支柱；對於欺騙性對齊，全鏈路監控與不可行性論證是主攻方向；而對於網路攻擊威脅，三大支柱必須同時鼎立。

### 競賽博弈困境與競爭對手調整條款（The race-dynamic problem）

競爭對手調整條款引發了全球安全學界的劇烈爭議。批評者指出該條款將直接誘發「逐底競爭（Race to the bottom）」：若所有實驗室皆聲稱只要對手違規自己即可自動跟進放寬限制，全行業的納許均衡將不可避免地滑向全盤背叛與安全失守。辯護者則反駁指出：若堅守單方面防護，一旦市場被完全沒有任何安全意識的惡意對手全面搶佔，帶給人類社會的最終結局將更為悲慘。

英國 AI 安全研究所（UK AISI）、美國 CAISI 以及歐盟 AI 辦公室（第 24 節）正是作為外部第三方監管力量介入該博弈。各大實驗室的自願性框架是基石；而主權國家的硬性立法監管正在加速補位。

### 該研究在第 18 階段中的宏觀座標

第 17 與 18 節共同構成了整座對齊金字塔的頂層治理架構——將底層所有的對抗攻擊、內部欺騙與生化能力評測，正式轉化為企業內部制度化的安全策略規範。隨後的第 19 至 24 節將覆蓋模型福祉、偏見公平、差分隱私、數位浮水印以及全球主權法規體系；第 28 節則將深度梳理支撐這套治理體系運轉的全球外部科研生態網（MATS、Redwood、Apollo、METR）。

```figure
al-asl-ladder
```

## Use It｜實際應用

本課不設具體程式碼。讀者應當端到端精讀三大一手文獻原文：Anthropic RSP v3.0、OpenAI PF v2 與 DeepMind FSF v3.0。動手繪製一張跨實驗室的橫向對照映射表，精確標註出每一家實驗室所定義的、但另外兩家尚未涵蓋的獨特安全閾值。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-framework-diff.md`。輸入任何一份全新的企業前沿安全政策或模型發布說明書，該 Skill 將自動將其各項閾值定義、必備安全評測項目以及安全論證結構，逐項對齊映射至 RSP v3.0、PF v2 與 FSF v3.0 的標準範式，並一針見血指出其中遺漏的跨機構合規盲點。

## Exercises｜練習

1. 精讀 RSP v3.0、PF v2 與 FSF v3.0 原文。整理出一份表格，橫向對比三大實驗室各自對 CBRN 威脅的觸發閾值、對 AI 自主研發加速的認定標準，以及在正式部署前強制要求的具體評測項目。
2. 競爭對手調整條款如今普遍存在於三大框架之中。撰寫一段短文論證支持該條款的合理性；隨後再撰寫一段短文論證其潛在危害。明確指出這兩種針鋒相對的立場各自依賴了何種底層核心假設。
3. 為一款即將跨越 Anthropic「AI R&D-4」紅線的強大模型設計一份安全論證大綱。明確列出其三大支柱（監控、不可行性、能力剝奪）各自所需的實體佐證材料。
4. DeepMind 在 FSF v3.0 中全新增設了「有害操縱（Harmful Manipulation）」臨界能力等級。試提出三項可客觀量化的實證度量指標，用以判定某款前沿模型是否已實質跨越了該項危險紅線。
5. 研讀 METR 聯盟發布的《前沿 AI 安全政策的共通要素》（2025 年）。列出當前全球前沿實驗室在治理體系上達成的三大最強共識，以及分歧最大的兩處核心爭議。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| RSP | 「Anthropic 的框架」 | Responsible Scaling Policy；ASL 分級；2026 年 2 月版 v3.0 |
| PF | 「OpenAI 的框架」 | Preparedness Framework；五項準則；2025 年 4 月版 v2 |
| FSF | 「DeepMind 的框架」 | Frontier Safety Framework；CCL；2025 年 9 月版 v3.0 |
| ASL-3 | 「類似生物安全第 3 級」 | Anthropic 對應 CBRN 相關能力的級別；於 2025 年 5 月啟用 |
| CCL | 「臨界能力等級」 | DeepMind 的閾值概念，依領域劃分 |
| Safety case | 「正式論證」 | 在最壞情況假設下，說明部署安全性可接受的書面論證 |
| Adjustment clause | 「允許因競爭對手變更政策」 | 若競爭對手在未採取可比防護措施下發布模型，框架可據此降低要求 |

## Further Reading｜延伸閱讀

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL 階梯體系、安全路線圖與 AI 研發解耦。
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — 五大追蹤準則與競爭調整條款。
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0 架構與有害操縱紅線。
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨實驗室前沿政策橫向深度評析。
