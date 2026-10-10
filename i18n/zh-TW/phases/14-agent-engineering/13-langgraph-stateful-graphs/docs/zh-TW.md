# 具備狀態的圖編排——持久化執行與檢查點機制

> Agent 本質上是一台狀態機；節點是純函式；邊代表狀態轉移；狀態在每個節點執行後自動保存檢查點（Checkpoint）。遭遇任何異常時，隨時自最後一個成功的檢查點精準復原。LangGraph 是 2026 年低階具狀態編排架構的權威參考標竿。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 LangGraph 的核心心智模型：具備強型別狀態、純函式節點、條件邊（Conditional edges）以及節點後自動檢查點的狀態機體系。
- 指出官方文件所強調的四大核心能力：持久化執行（Durable execution）、即時串流（Streaming）、人在迴圈中（Human-in-the-loop）與全方位記憶體（Comprehensive memory）。
- 闡明 LangGraph 支援的三大編排拓撲結構：監督者模式（Supervisor）、對等群集模式（Swarm / P2P）與階層式巢狀子圖模式（Hierarchical）。
- 以純 Python 標準函式庫實作具備強型別狀態、條件邊與「檢查點儲存／復原執行」生命週期的狀態圖（State Graph）。

## The Problem｜問題

無論是 Agent 還是複雜的工作流程，皆面臨一個共同的殘酷現實：當一場耗費 40 個步驟的複雜任務在第 38 步遭遇網路中斷崩潰時，你期望的是自第 38 步平滑復原，而非被迫從第 1 步重頭再來。次等的無狀態架構迫使維運工程師在一個預設「每次皆全新運行」的函式庫周圍，手動編寫極其脆弱且醜陋的重試包裝程式碼。

LangGraph 的架構解答：**將狀態提升為一等公民的強型別物件，所有狀態變更皆顯式宣告，且在每個節點執行完成後自動持久化寫入檢查點。**復原僅需一次簡單的 `load_state(session_id)` 呼叫即可搞定。

## The Concept｜核心概念

### 圖的基礎構成

一張標準的狀態圖由以下要素定義：

- **狀態型別（State type）**：一個強型別字典（或 Pydantic 模型），每個節點皆能讀取並修改它。
- **節點（Nodes）**：純函式 `(state) -> state_update`。回傳的更新內容在函式結束後自動合併回全域狀態中。
- **邊（Edges）**：節點之間的直接轉移連線，或依狀態動態判斷的條件邊。
- **進入與離開**：`START` 與 `END` 哨兵節點明確標定圖的邊界。

範例：一個包含 `classify`、`refund`、`bug`、`sales`、`done` 等節點的 agent——本質上正是以狀態圖形式表達的動態意圖路由工作流程。

### 持久化執行（Durable Execution）

在每個節點回傳後，執行時期環境會即時序列化當前狀態，並將其寫入檢查點儲存器（Checkpointer，支援 SQLite、Postgres、Redis 或自訂儲存）。若在第 N 步發生故障，系統能透過 `resume(session_id)` 載入精確狀態，並自第 N+1 步無縫接續執行。

LangGraph 官方文件特別指出了高度仰賴該能力的代表性企業用戶：Klarna、Uber、J.P. Morgan。其核心價值並非單純的圖狀結構，而是**圖狀結構結合自動檢查點機制，使分散式故障復原成本大幅降低至接近於零**。

### 即時串流（Streaming）

每個節點皆能即時產出局部增量輸出。狀態圖會向呼叫端即時推播逐節點的增量（Delta）事件，使前端 UI 能隨圖的執行即時流暢更新。

### 人在迴圈中（Human-in-the-Loop）

在節點之間檢查並修改狀態。具體實作：在關鍵高危險節點前暫停流程、向人類使用者呈現當前狀態、接收使用者的手動修改，隨後平滑恢復執行。檢查點儲存器使此機制變得極其簡單，因為狀態在底層早已被完美序列化。

### 雙層記憶體體系

短期記憶（單次運行內部——存在於狀態中的對話歷史）與長期記憶（跨多次運行——透過檢查點結合獨立的長效儲存庫持久化）。LangGraph 支援透過工具介面與外部專業記憶體系統（如 Mem0 或自建系統）深度整合。

### 三大編排拓撲結構

1. **監督者模式（Supervisor）**：中央路由器 LLM 動態分派任務給各專業領域子 agent。在 `langgraph-supervisor` 中封裝為 `create_supervisor()`（不過 LangChain 團隊在 2026 年建議直接透過工具呼叫來實作，以獲得更高的上下文控制精準度）。
2. **群集／對等模式（Swarm / P2P）**：Agent 之間透過共享的工具介面直接進行控制權交接（Handoff），不存在任何中央調度中心。
3. **階層式模式（Hierarchical）**：監督者底下管理次級監督者，在架構上表現為多層巢狀子圖（Nested Subgraphs）。

### 典型架構失效模式

- **檢查點儲存粒度過小**：若僅對對話回合保存檢查點，工具呼叫狀態與記憶體寫入依然無法復原。必須將完整全域狀態進行序列化。
- **節點具備非確定性**：復原機制預設相同的節點輸入必產出相同的狀態更新。隨機數種子、實體掛鐘時間與外部 API 必須妥善記錄。
- **過度濫用條件邊**：若圖上的每條連線皆是複雜的條件邊，該狀態機將變得極度混沌無法推理。優先採用線性主幹，僅在關鍵決策點引入條件分流。

```figure
langgraph-state
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套具態圖引擎：

- `State`：強型別字典，包含 `messages`、`step`、`route`、`output` 與 `human_approval`。
- `Node`：接收 state 並回傳更新字典的可呼叫常式。
- `StateGraph`：封裝節點、邊、條件邊、執行（run）與復原（resume）。
- `SQLiteCheckpointer`（記憶體虛擬實作）：在每個節點後序列化狀態；`load(session_id)` 負責精確復原。
- 演示圖結構：分類（classify）-> 條件分流（refund / bug / sales）-> 人工審核關卡（human gate）-> 發送（send）。

運行實驗：

```
python3 code/main.py
```

日誌會清晰展示：初次運行在人工審核關卡處暫停並完成持久化存檔，隨後透過 resume 復原執行並成功產出最終結果。

## Use It｜實際應用

- **LangGraph**：生產就緒的權威實作。可使用 `create_react_agent`、`create_supervisor`，或手動組裝專屬圖結構。
- **AutoGen v0.4**（第 14 課）：高並發場景下的 Actor 模型替代方案。
- **Claude Agent SDK**（第 17 課）：內建階段作業儲存庫的全託管控端架構。
- **自建狀態機**：適合需要對狀態資料結構或檢查點儲存後端實施極致精細控管的團隊。

## Ship It｜交付成果

`outputs/skill-state-graph.md` 能為任何目標環境產出 LangGraph 風格的狀態圖鷹架，內建檢查點自動儲存與斷點復原機制。

## Exercises｜練習

1. 為 `classify` 節點新增條件邊：當分類置信度低於閾值時直接轉移至 `end`。在人工手動介入設定 `route` 後平滑復原執行。
2. 將記憶體模擬替換為真實的本地 SQLite 檔案檢查點儲存器。實測每個步驟的序列化儲存延遲開銷。
3. 實作平行邊（Parallel edges）：兩個節點並發同時運行，隨後由自訂的 Reducer 負責狀態合併。深入思考不可變狀態在此處帶來了何種架構優勢？
4. 研讀 `langgraph-supervisor` 官方參考文檔。將此教學玩具改寫為 `create_supervisor` 架構，並對比日誌結構差異。
5. 新增即時串流機制：每個節點在運行期間逐步輸出增量狀態。在接收端即時印出增量內容。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| State graph | 「狀態圖」 | 強型別狀態 + 節點純函式 + 邊 + Reducers 所構成的狀態機體系 |
| Checkpointer | 「檢查點儲存器」 | 在每個節點執行後自動序列化狀態的持久化後端；實現中斷復原的核心 |
| Reducer | 「狀態合併器」 | 定義如何將節點回傳的增量更新與現有全域狀態相合併的純函式 |
| Conditional edge | 「條件轉移邊」 | 依據當前狀態數值動態計算跳轉目標的條件轉移邊 |
| Subgraph | 「巢狀子圖」 | 作為另一個外部圖之內部節點運行的完整獨立狀態圖 |
| Durable execution | 「持久化執行」 | 在遭遇故障崩潰後，能精準自最後一個成功節點原樣復原執行 |
| Supervisor | 「中央調度者」 | 負責指揮各領域專業子 agent 的中央路由器 LLM |
| Swarm | 「對等群集架構」 | Agent 之間透過共享工具介面直接交接控制權；無中央調度中心 |

## Further Reading｜延伸閱讀

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——官方核心架構文檔
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) ——監督者模式官方 API 指南
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) ——微軟 Actor 模型替代架構解析
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) ——階段作業儲存庫與子 agent 官方指南
