# Agent 可觀測性：Langfuse、Phoenix 與 Opik

> 三大開源平台主導了 2026 年的 Agent 可觀測性領域：Langfuse（MIT 授權）——每月 600 萬以上安裝量，涵蓋全鏈路追蹤 + Prompt 管理 + 自動化評測 + 階段作業重播；Arize Phoenix（Elastic 2.0 授權）——專精於 Agent 特化評測、RAG 相關性分析與 OpenInference 自動埋點；Comet Opik（Apache 2.0 授權）——主打自動化 Prompt 最佳化、安全護欄與基於大模型裁判的幻覺檢測。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 指出三大頂級開源 Agent 可觀測性平台及其各自採用的開源授權協議。
- 區分各平台的殺手級優勢：Langfuse（Prompt 版本管理 + 階段作業重播）、Phoenix（RAG 深度評測 + 自動埋點）、Opik（自動化實驗最佳化 + 安全護欄）。
- 深入解釋為何截至 2026 年高達 89% 的企業組織宣告已導入 Agent 可觀測性架構。
- 以純 Python 標準函式庫實作一套具備大模型裁判（LLM-as-judge）自動評估的追蹤鏈儀表板管線。

## The Problem｜問題

OTel GenAI（第 23 課）規範了統一的資料 Schema。然而，你依然需要一個實體平台來攝取 Spans、運行自動化評測、管理 Prompt 版本，並在模型行為發生回歸劣化時即時發出警報。這三大競品各自側重於生命週期的不同關鍵環節。

## The Concept｜核心概念

### Langfuse（MIT 授權）

- 每月 SDK 安裝量超 600 萬次，GitHub 19k+ Stars。
- 核心功能：全鏈路追蹤、具備版本控管與 Playground 實驗場的 Prompt 管理、自動化評測（LLM-as-judge、使用者反饋、自訂指標）、完整階段作業重播（Session replays）。
- 2025 年 6 月：將原先的商業付費模組（LLM-as-a-judge、人工標註佇列、Prompt 實驗對比、Playground）全數轉為 MIT 協議完全開源。
- 最大優勢：端到端一站式可觀測性，兼具業界最緊湊流暢的 Prompt 迭代管理閉環。

### Arize Phoenix（Elastic License 2.0 授權）

- 更深度的 Agent 專屬評測：追蹤鏈分群（Trace clustering）、異常行為檢測、針對 RAG 的檢索相關性深度分析。
- 原生內建 OpenInference 自動埋點。
- 可與雲端代管的 Arize AX 無縫橋接進入正式環境。
- 未內建 Prompt 版本管理——定位為與其他通用平台並存的「行為漂移與回歸分析專用利器」。
- 最大優勢：RAG 檢索相關性、行為漂移檢測、異常模式識別。

### Comet Opik（Apache 2.0 授權）

- 透過 A/B 實驗實現自動化 Prompt 最佳化。
- 安全護欄（PII 敏感資料抹除、主題合規約束）。
- 基於 LLM 裁判的幻覺自動檢測。
- Comet 官方實測指標宣稱：Opik 記錄 + 評測耗時 23.44 秒，而 Langfuse 為 327.15 秒（約 14 倍差距）——廠商自測結果僅供方向性參考。
- 最大優勢：自動化實驗最佳化閉環、護欄策略強制執行。

### 業界實況調查結果

依據 Maxim 於 2026 年發布的產業調研報告：89% 的企業組織表示已上線 Agent 可觀測性系統；而「產出品質與可靠性問題」則是邁向正式環境的最大路障（高達 32% 的受訪者將其列為頭號阻礙）。

### 技術選型矩陣

| 核心業務需求 | 推薦選型 |
|---|---|
| 需要整合 Prompt 版本管理的一站式全能平台 | Langfuse |
| 深度 RAG 檢索評測 + 行為漂移分析 | Phoenix |
| 自動化實驗最佳化 + 實體安全護欄 | Opik |
| 嚴格要求純開源授權（無 ELv2 限制） | Langfuse（MIT）或 Opik（Apache 2.0） |
| 與現有 Datadog / New Relic 基礎設施整合 | 任何一家皆可——三者皆支援標準 OTel 匯出 |

### 典型架構失效模式

- **缺乏評測策略**：僅有全鏈路追蹤卻無任何 Evals 評測，無異於在昂貴地堆積普通日誌。
- **自建缺乏事實錨定的 LLM 裁判**：第 5 課的 CRITIC 原則在此同樣適用——評判模型在驗證客觀事實時必須接入外部實體工具，否則裁判本身亦會產生幻覺。
- **Prompt 版本未與 Trace 嚴密綁定**：當線上發生回歸退步時，維運團隊根本無法回溯二分法定位究竟是哪次 Prompt 改版惹的禍。

```figure
wb-trace-ingest
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套追蹤收集器 + LLM 裁判評估器：

- 攝取符合 GenAI 規範的標準 Spans；
- 依階段作業分組，自動標記失敗運行（觸發護欄警報、低置信度評測）；
- 腳本化的 LLM 裁判：依據標準評分規則（Rubric）為 Agent 回應評分；
- 儀表板匯總報表：失敗率統計、頭號失敗根因分析、評測分數分佈長條圖。

運行實驗：

```
python3 code/main.py
```

輸出會展示逐階段作業的評測得分與失效分類，真實重現了 Langfuse、Phoenix 或 Opik 前端看板所呈現的核心圖景。

## Use It｜實際應用

- **Langfuse**：自建私有部署或雲端平台；透過 OTel 或其官方 SDK 接入。
- **Arize Phoenix**：自建私有部署；透過 OpenInference 實現零侵入式自動埋點。
- **Comet Opik**：自建私有部署或雲端平台；專注於自動化最佳化閉環。
- **Datadog LLM Observability**：適合現有基礎設施已深度綁定 Datadog 的大型混編維運團隊。

## Ship It｜交付成果

`outputs/skill-obs-platform-wiring.md` 能為現有 Agent 快速接入選定的可觀測性平台，自動配置追蹤鏈收集、Evals 自動評測與 Prompt 版本關聯管線。

## Exercises｜練習

1. 將一週的本地 OTel 追蹤日誌匯出至 Langfuse 雲端免費版。哪些階段作業發生了故障？根本原因為何？
2. 為你自己的業務領域撰寫一份專屬的 LLM 裁判評分規則（事實正確性、語氣專業度、邊界遵守度），並在 50 條真實 Trace 上完成驗證。
3. 橫向對比 Langfuse 的 Prompt 版本管理與 Phoenix 的追蹤鏈分群（Trace clustering）。在面對線上突發故障時，哪種功能能更快幫你定位問題？
4. 研讀 Opik 的安全護欄文檔。為你的 Agent 運行配置一組 PII 敏感資料抹除護欄。
5. 在你的自有語料庫上對三款工具進行橫向基準實測。無視廠商宣傳文宣，以你自己的實測結果為準。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Tracing | 「Spans 追蹤收集器」 | 攝取 OTel 或 SDK 發射的 Spans，並依對話階段作業建立索引 |
| Prompt management | 「Prompt 內容管理系統」 | 與實體 Trace 深度綁定、具備版本控管與比較測試的 Prompt 倉庫 |
| LLM-as-judge | 「大模型自動裁判」 | 引入獨立的大模型，依據預定義評分標準對 Agent 輸出進行打分 |
| Session replay | 「執行歷程重播」 | 依時間軸步進回溯過往完整執行步驟，用於深度故障排查 |
| RAG relevancy | 「檢索相關性評測」 | 量化評估檢索召回的上下文脈絡與使用者原始查詢是否精準匹配 |
| Trace clustering | 「行為分群分析」 | 對相似的執行軌跡進行機器學習分群，用以即時捕捉行為漂移 |
| Guardrail enforcement | 「日誌端策略執行」 | 於日誌記錄當下實施 PII 抹除、毒性內容過濾與範疇合規性檢查 |

## Further Reading｜延伸閱讀

- [Langfuse docs](https://langfuse.com/) ——追蹤、評測與 Prompt 管理官方指南
- [Arize Phoenix docs](https://docs.arize.com/phoenix) ——自動埋點與行為漂移分析手冊
- [Comet Opik](https://www.comet.com/site/products/opik/) ——自動化最佳化與安全護欄平台
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) ——三者共同遵循的底層標準 Schema
