# 生產級 Agent 執行時期——極速實例化與強型別工作流程

> 生產級 Agent 執行時期著重最佳化那些原型驗證框架所忽略的關鍵維度：實例化開銷、強型別工作流程介面，以及生產就緒的高並發後端。2026 年的前沿雙雄：Agno（Python）追求微秒級的極速實例化與無狀態 FastAPI 後端；Mastra 則在 Vercel AI SDK 基底上，為 TypeScript 生態交付整合了 Agents、Tools、Workflows、統一模型路由與複合式儲存的一站式架構。

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 13 (LangGraph)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 指出 Agno 的極致效能指標及其真正發揮價值的業務場景。
- 掌握 Mastra 的三大核心原語——Agents、Tools、Workflows，以及其支援的主流伺服器適配器。
- 深入解釋為何「無狀態階段作業範疇（Stateless session-scoped）的 FastAPI 後端」是 Agno 官方推薦的正式環境實踐路徑。
- 依據團隊現有技術堆疊（Python 為核心 vs TypeScript 為核心），在 Agno 與 Mastra 之間做出精準架構選型。

## The Problem｜問題

LangGraph、AutoGen 與 CrewAI 皆屬於功能龐雜厚重的上層框架。當工程團隊期望「在我現有的執行時期中，以極致效能運行純粹的 Agent 迴圈」時，往往會轉向 Agno（Python）或 Mastra（TypeScript）。兩者皆主動放棄了部分由框架包辦的封閉原語，換取了純粹的執行速度以及與現有技術堆疊更深度的整合性。

## The Concept｜核心概念

### Agno

- 原生 Python 執行時期（前身為 Phi-data）。
- 「不搞複雜的圖、鏈或繁複抽象——只有純粹的 Python。」
- 官方文件宣告的極致效能指標：約 2μs（微秒）極速 Agent 實例化、單個 Agent 僅佔用約 3.75 KiB 記憶體、原生支援 23 家以上模型供應商。
- 官方生產路徑：無狀態、階段作業範疇的 FastAPI 後端。每個進來的 HTTP 請求皆啟動一個全新乾淨的 agent 實例；階段作業狀態持久化於外部資料庫中。
- 原生支援多模態（文字、圖片、音訊、影片、檔案）與 Agentic RAG。

微秒級的實例化速度在「每秒需衍生數千個短生命週期 Agent」（例如聊天訊息高並發分流、大規模批次評測管線）時扮演著決定性角色。而當單一 Agent 本身就需要持續運行 10 分鐘時，該優勢則相對不顯著。

### Mastra

- 原生 TypeScript 框架，建構於 Vercel AI SDK 基石之上。
- 三大核心原語：**Agents**、**Tools**（基於 Zod 強型別約束）、**Workflows**。
- 統一模型路由器（Unified Model Router）：跨 94 家供應商統一抽象接入 3,300+ 款大模型（截至 2026 年 3 月）。
- 複合式儲存（Composite storage）：記憶體、工作流程與可觀測性資料分別路由至不同的後端儲存；在大規模生產場景下強烈推薦以 ClickHouse 承載可觀測性資料。
- 授權模式：核心採 Apache 2.0 開源協議；`ee/` 目錄則採用原始碼可用（Source-available）的商業企業授權。
- 提供 Express、Hono、Fastify、Koa 等伺服器適配器；與 Next.js 及 Astro 原生深度整合。
- 開箱即用內建 Mastra Studio（localhost:4111）互動除錯儀表板。
- 於 1.0 正式版（2026 年 1 月）達成 GitHub 22k+ Stars 與每週 300k+ npm 下載量。

### 架構定位對比

兩者皆非試圖成為另一個 LangGraph。它們的競爭維度在於：

- **語言契合度**：Python 為核心的團隊選 Agno；TypeScript 為核心的團隊選 Mastra。
- **執行時期人體工學**：Agno 追求接近零開銷的純粹極致；Mastra 則與 Vercel 生態系深度整合。
- **全鏈路可觀測性**：兩者皆原生對接 Langfuse / Phoenix / Opik（第 24 課），但 Mastra Studio 提供了官方第一方互動介面。

### 何時挑選何者

- **Agno**：Python 後端、存在海量短生命週期 agent、極致效能敏感、FastAPI 技術堆疊。
- **Mastra**：TypeScript 後端、部署於 Next.js / Vercel、需要統一跨多供應商模型路由、仰賴 Zod 強型別工具。
- **LangGraph**（第 13 課）：當持久化狀態與顯式圖推理的重要性遠高於純粹執行速度時。
- **OpenAI / Claude Agent SDK**：當期望直接享用大廠產品化的專屬控端形態時（第 16–17 課）。

### 典型架構失效模式

- **為效能而效能的盲目過度最佳化**：單純因為「2μs」聽起來很厲害而挑選 Agno，而實際業務負載是單次請求需要等待 5 秒鐘的緩慢大模型呼叫。此時框架自身的微秒開銷根本不是系統瓶頸。
- **生態系鎖定**：Mastra 與 Vercel 的高度契合在 Vercel 平台上是巨大加分項，但在非 Node / 非 Vercel 環境中則可能成為束縛。
- **企業授權混淆**：Mastra 的 `ee/` 目錄屬於 Source-available 限制性授權，而非純 Apache 2.0。若計畫 Fork 或進行二次商業包裝，務必仔細研讀授權條款。

```figure
wb-runtime-spawn
```

## Build It｜動手實作

本課側重於架構橫向對比——單一程式碼產物無法同時完整展現兩大框架的全貌。參閱 `code/main.py` 提供的並排對比教學玩具：以完全對等的功能兩次實作了極簡的「運行 agent、串流輸出、持久化保存階段作業」流程（一次採 Agno 風格，一次採 Mastra 風格）。

運行實驗：

```
python3 code/main.py
```

輸出會展示兩份結構不同但在功能上完全等價的執行軌跡。

## Use It｜實際應用

- **Agno**：需要極致速度與 FastAPI 形態的 Python 生產後端。
- **Mastra**：需要統一對接海量大模型與工作流程原語的 TypeScript 生產後端。
- 兩者皆內建官方第一方的可觀測性掛鉤，並皆能無縫整合 Langfuse。

## Ship It｜交付成果

`outputs/skill-runtime-picker.md` 能依據現有技術堆疊、延遲預算與維運架構形態，自動在 Agno、Mastra、LangGraph 或廠商專屬 SDK 之間做出客觀技術選型。

## Exercises｜練習

1. 研讀 Agno 官方文件。將第 01 課的純標準函式庫 ReAct 迴圈移植為 Agno 實作。哪些繁複程式碼消失了？哪些核心邏輯被保留了？
2. 研讀 Mastra 官方文件。將完全相同的迴圈移植至 Mastra。工具型別宣告（Zod 對比純文字）產生了何種本質改變？
3. 基準效能實測：在你自己的機器上實測 Agent 實例化耗時。Agno 宣告的 2μs 對你的真實業務負載究竟產生多大影響？
4. 架構遷移設計：若你目前在 Python 中運行 CrewAI，遷移至 Agno 時會遭遇哪些架構破壞？
5. 研讀 Mastra `ee/` 目錄的授權協議條款。哪些具體限制會對開源 Fork 產生實質法律約束？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Agno | 「極速 Python Agent」 | 專注於微秒級實例化、無狀態階段作業範疇的 Python Agent 執行時期 |
| Mastra | 「Vercel 生態的 TS Agent」 | 基於 Vercel AI SDK 打造，整合 Agents + Tools + Workflows 的 TypeScript 框架 |
| Unified Model Router | 「統一模型路由器」 | 單一用戶端統一接入 94 家供應商旗下 3,300+ 款大模型的聚合路由層 |
| Composite storage | 「複合式儲存」 | 將記憶體、工作流程與可觀測性資料分別指派至不同專業後端的架構 |
| Mastra Studio | 「本機視覺化除錯器」 | 於 localhost:4111 運行的官方除錯儀表板 UI |
| Source-available | 「原始碼可用」 | 允許閱讀原始碼、但對商業化二次包裝與分發實施嚴格限制的授權模式 |

## Further Reading｜延伸閱讀

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) ——極致效能指標與 FastAPI 整合指引
- [Mastra docs](https://mastra.ai/docs) ——核心原語、伺服器適配器與 Model Router 官方文件
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——具態圖架構的對照參考
- [Comet Opik](https://www.comet.com/site/products/opik/) ——Mastra 原生整合的可觀測性平台橫向對比
