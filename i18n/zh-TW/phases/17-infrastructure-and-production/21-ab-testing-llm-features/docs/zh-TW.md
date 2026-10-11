# LLM 功能的 A/B 測試——GrowthBook、Statsig 與「憑感覺上線」的終結（A/B Testing LLM Features — GrowthBook, Statsig, and the Vibes Problem）

> 傳統的 A/B 測試框架並非為具備隨機非確定性（Non-deterministic）的 LLM 量身打造。兩者存在本質分工邊界：離線評測（Evals）回答「模型是否有能力勝任該任務？」線上 A/B 測試則回答「真實使用者究竟在不在意這項改變？」兩者皆屬不可或缺的硬性要求；純憑個人主觀感覺（Vibe checks）拍板發布的草莽時代已經終結。2026 年核心測試三大維度：Prompt 工程（措辭修飾）、模型選型（GPT-4 vs GPT-3.5 vs 開源模型；精度 vs 成本 vs 延遲的三角權衡），以及生成參數（Temperature、Top-p）。真實經典實戰成效：某對話機器人採用獎勵模型調校變體後，平均對話輪數激增 +70%、使用者留存率提升 +30%；Nextdoor 在精修獎勵函數後點閱率（CTR）實現了 +1% 的淨增長；可汗學院（Khan Academy）的 Khanmigo 助手則在延遲與數學精確度之間找到了最佳平衡點。平台雙雄格局：**Statsig**（於 2025 年 9 月被 OpenAI 以 11 億美元強勢收購）——原生整合循序檢定（Sequential testing）、CUPED 變異數縮減與全端一體化控制台。**GrowthBook**——採 MIT 授權開源，原生生長於雲端資料倉儲之上，提供貝氏、頻率學派與循序檢定三大引擎，完整實裝 CUPED、SRM 樣本失配校驗，以及 Benjamini-Hochberg 與 Bonferroni 多重比較校正。選型取決於企業對資料倉儲 SQL 的偏好，以及貴公司是否介意採用「已被 OpenAI 納入麾下」的商業軟體。

**Type:** Learn
**Languages:** Python (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格界定離線評測 Evals（「模型能不能做」）與線上 A/B 測試（「使用者喜不喜歡」）的架構職責邊界。
- 梳理三大可測試維度（Prompt 模板、模型版本、推論取樣參數），並為每一項維度精準選定核心評估指標。
- 深入解釋 CUPED 變異數縮減演算法、循序檢定（Sequential testing）以及 Benjamini-Hochberg 多重比較校正背後的統計數學機理。
- 依據內部資料治理規範與對雲端收購事件的商業立場，在 Statsig 與 GrowthBook 之間做出理性決策。

## The Problem｜問題

你手動調校了一段新的系統 Prompt。你讀起來覺得語氣舒服多了。你直接將其全量發布至正式環境。隨後產品的轉化率在統計噪聲區間內微幅震盪。你把責任推給指標不靈敏。或者你發布了一款新模型，而轉化率紋絲不動——究竟是模型發生了隱微的退化，還是這項改動本身太過微小根本無法被偵測？你完全無法得出客觀結論，因為你從未經過嚴密的 A/B 雙盲實驗。

離線 Evals 只能驗證模型在已標註的固定資料集上是否具備特定任務能力。它絲毫無法回答真實使用者是否真心偏好這項輸出。唯有在線上對真實使用者展開受控的隨機分流實驗才能給出確鑿答案——且前提是該實驗具備足夠的統計檢定力（Power）、妥善控制了 LLM 的底層非確定性，並嚴格實施了多重假設檢定校正。

## The Concept｜核心概念

### 離線評測（Evals）vs 線上 A/B 測試（A/B tests）

**離線評測（Evals）**——離線執行、依賴已標註測試集、由評估器評判（評分量表 Rubric、LLM-as-a-judge 或人工審查）。回答的核心問題：「在當前這份固定資料分佈下，模型的輸出是否足夠正確、有幫助且安全？」

**線上 A/B 測試（A/B test）**——即時線上、面向真實活躍使用者、嚴格隨機雙盲分流。回答的核心問題：「這個候選新版本是否真正推動了業務層面最核心的使用者指標？」

兩者缺一不可。Evals 在模型接觸真實使用者前攔截回歸缺陷；A/B 測試則在發布後實時確認對產品業務的實質影響。

### 究竟該測試什麼維度（What to test）

1. **Prompt 工程設計**——文字措辭、系統 Prompt 結構、Few-shot 範例選擇。度量指標：任務成功率、使用者留存率、單次請求成本。
2. **底層模型選型**——GPT-4 vs GPT-3.5-Turbo vs 開源 Llama 變體。度量指標：任務準確率 + 單請求成本 + P99 延遲。典型多目標聯合最佳化。
3. **生成採樣超參數**——Temperature 溫度、Top-p、Max_tokens。度量指標：依據具體任務而定（輸出多樣性 vs 嚴格確定性）。

### CUPED——變異數縮減神技（CUPED — variance reduction）

Controlled-experiments Using Pre-Experiment Data（基於實驗前資料的受控實驗技術）。核心在於利用實驗前該使用者群體的歷史基準資料，透過線性迴歸將天然存在的個體差異變異數剔除。實測典型變異數縮減幅度：30% 至 70%。等價於在不拉長實驗週期的前提下，憑空將有效統計樣本量放大了數倍。

工業實裝：Statsig 與 GrowthBook 皆已原生內建該演算法。

### 循序檢定（Sequential testing）

傳統經典的 A/B 測試嚴格依賴固定樣本量，中途偷看資料會嚴重虛胖顯著性。循序檢定（Sequential testing，允許「邊看邊做決策」）在多次連續觀測下嚴格將偽陽性（False-positive）機率控制在預設 α 門檻之內。永真循序檢定程序（如 mSPRT、Howard 信賴序列）允許你在實驗取得壓倒性勝利或慘敗時，果斷提前終止實驗，極大節省線上試錯成本。

### 多重比較校正（Multiple-comparison corrections）

若你在 95% 信賴水準下同時平行運作 20 個 A/B 測試，純粹依靠隨機碰巧就會產生 1 個偽陽性虛假繁榮。Bonferroni 校正透過將 α 除以測試數量進行硬性收緊；而 Benjamini-Hochberg 則精細控制錯誤發現率（False Discovery Rate, FDR）。GrowthBook 原生完整實裝了這兩大校正器。

### SRM——樣本比例失配檢驗（SRM — sample ratio mismatch）

分流演算法負責將使用者嚴格隨機劃分進對照組與實驗組。若設定為 50/50 的分流最終產出了 47/53 的實體樣本分佈，說明底層基礎設施必然存在嚴重暗病（如某個版本的 Pod 頻繁閃退丟棄使用者）——SRM 統計檢驗能及時報警。兩大商業平台皆提供開箱即用的 SRM 哨兵。

### Statsig vs GrowthBook

**Statsig**：
- 於 2025 年 9 月被 OpenAI 以 11 億美元正式收購。採雲端託管 SaaS 模式。
- 原生深度支援循序檢定、CUPED 變異數縮減，提供長期的封存母體對照。
- 一體化完整技術堆疊：功能開關（Feature Flags） + 線上實驗平台 + 基礎可觀測性。
- 最優適配：期望採購一體化成熟開箱方案、且完全不在意其已被 OpenAI 控股的企業。

**GrowthBook**：
- 全面遵循 MIT 開源協議；採資料倉儲原生（Warehouse-native）架構（直接查詢 Snowflake、BigQuery、Redshift 等底層資料庫）。
- 內建三大統計推論引擎：貝氏統計、頻率學派與循序檢定。
- 完整支援 CUPED、SRM、Bonferroni 與 Benjamini-Hochberg 多重校正。
- 支援私有化自建或採購託管雲端版。
- 最優適配：以資料倉儲 SQL 為核心資產、資料團隊嚴格把控指標計算層、堅定擁抱純開源生態的企業。

### 非確定性使得統計檢定力計算更加棘手（Non-determinism complicates power）

完全相同的 Prompt 在多次呼叫中會隨機產生不同的文字輸出。傳統的樣本量檢定力公式嚴格基於獨立同分佈（IID）假設。在 LLM 的非確定性干擾下，實體的有效樣本量低於表面標稱值。在進行 A/B 實驗樣本量規劃時，必須強制將理論所需樣本數乘以約 1.3 至 1.5 倍作為安全緩衝區。

### 工業級真實案例實效（Real case outcomes）

- 某對話機器人透過獎勵模型調校版本：平均單次 Session 對話長度提升 +70%，使用者次月留存率提升 +30%。
- Nextdoor 社交平台 AI 郵件主旨行實驗：在經過精細化獎勵函數迭代後，郵件點閱率（CTR）取得 +1% 淨增長。
- 可汗學院 Khanmigo 教育助手：在推論延遲與高難度數學解題精確度之間找到了最優的帕累托平衡點。

### 致命反模式：憑個人感覺拍板發布（The anti-pattern: shipping on vibes）

任何一位資深工程師都能隨口舉出數個因為某位主管「覺得語氣變好聽了」而未經 A/B 盲目發布的災難案例。絕大多數此類功能在無聲無息中重創了核心業務轉化指標，團隊往往耗費數月才猛然發現。嚴謹的 A/B 線上實驗是阻止團隊盲目自信的唯一硬性約束。

### 務必銘記的核心數字指標（Numbers you should remember）

- Statsig 併購案：2025 年 9 月被 OpenAI 以 11 億美元收購。
- GrowthBook：遵循 MIT 開源協議；集齊貝氏、頻率學派與循序檢定三大引擎。
- CUPED 變異數縮減成效：實測可消減 30% 至 70% 的統計噪聲。
- 大模型非確定性緩衝係數：實驗樣本量需額外增加 30% 至 50%。

```figure
mx-sequential-test
```

## Use It｜實際應用

`code/main.py` 模擬了一套在傳統固定樣本檢定與現代循序檢定（Sequential testing）邊界下的 A/B 實驗對抗。直觀展示循序檢定如何允許你在出現顯著優勢或劣勢時合法提前終止實驗，大幅節省時間與試錯成本。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ab-plan.md`。輸入欲變更的具體模型功能、流量特徵曲線與基準轉化率，該 Skill 將自動為你推導出最佳實驗平台選型、核心防護指標設定以及包含非確定性緩衝的精確樣本量規劃。

## Exercises｜練習

1. 執行 `code/main.py`。針對預期帶來 5% 提升、基準轉化率為 3% 的業務場景，若要達到 80% 的統計檢定力（Power），所需的最小樣本量是多少？
2. 針對一間受嚴苛醫療隱私法規監管、且要求所有系統必須本地私有化自建的醫院客戶，在 Statsig 與 GrowthBook 之間給出選型結論與論證。
3. 設計一套橫向比對 GPT-4 與 GPT-3.5 解決客訴問題成本效益的 A/B 實驗方案。分別給出第一核心指標（Primary metric）、護欄指標（Guardrail metric）與輔助次要指標（Secondary metric）。
4. 你的金絲雀發布順利通關，但後續的 A/B 雙盲測試卻顯示轉化率淨下跌了 1.2%。你究竟該不該發布該版本？撰寫標準的決策升級與裁決準則。
5. 將 CUPED 演算法應用於一段歷史變異數佔比達 60% 的前置基準資料上。精確計算其為實驗帶來的有效樣本量等價擴增倍數。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## Further Reading｜延伸閱讀

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/) — AI 功能 A/B 測試實戰指南。
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation) — 基於資料驅動的大模型最佳化實踐。
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools) — 兩大主流實驗平台深度橫向對比。
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf) — 微軟團隊提出 CUPED 演算法的原創經典論文。
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240) — 永真循序檢定數學理論原著。
