# 基於角色的 Agent 團隊——角色、任務與執行流程

> 四大核心原語：Agent、Task、Crew、Process。兩大頂層形態：Crews（自主、基於角色的協同團隊）與 Flows（事件驅動、程式碼掌控的確定性工作流程）。CrewAI 是 2026 年該領域的權威參考實作，其官方文件直言不諱地指出：「對於任何生產就緒的正式環境應用，請始終從 Flow 開始搭建。」

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 指出 CrewAI 的四大核心原語（Agent、Task、Crew、Process）及其各自的職責歸屬。
- 深入區分循序模式（Sequential）、階層模式（Hierarchical）與正規劃中的共識模式（Consensus），並能為特定業務負載做出正確選型。
- 區分 Crews（自主的角色協同）與 Flows（事件驅動的確定性工作流程），並闡明官方文件推薦以 Flow 作為生產基準的根本原因。
- 透過 `@tool` 裝飾器與 `BaseTool` 子類別接入工具，並在強型別結構化輸出與自由文字之間權衡取捨。
- 掌握 CrewAI 的四種記憶體型別（短期、長期、實體、脈絡）及其各自的投資報酬時機。
- 以純 Python 標準函式庫實作三 Agent 團隊（研究員、撰寫者、編輯審稿），協同產出一份調研簡報。
- 識別 CrewAI 的三大典型失效模式：Prompt 膨脹、經理模型 Token 稅，以及脆弱的輸出交接。

## The Problem｜問題

許多導入多 Agent 框架的工程團隊皆曾撞上同一堵高牆：「自主協同作業」在簡報展示中看似無比驚艷；然而一旦客戶回報線上 Bug，你卻發現系統根本無法進行確定性的重播復原；或者財務部門拿著帳單質問為何大模型自由調度的團隊單次執行成本如此高昂；抑或是值班工程師在凌晨三點根本無法查清究竟是哪個 Agent 陷入了卡死。

由大模型完全自由調度的動態團隊，根本無法乾淨俐落地回答上述任何問題。而純粹寫死的有向無環圖（DAG）雖然能完美解答，卻喪失了頭腦風暴與發散探索所需的主動性。

CrewAI 的架構切分對此做出了坦誠的權衡：以 Crews 專門負責探索性、基於角色協同的開放性工作；以 Flows 負責事件驅動、由工程師程式碼掌控、完全可審計的正式環境生產系統。同一套框架、兩種截然不同的形態，依據具體的業務邊界各取所需。

## The Concept｜核心概念

### 四大核心原語

CrewAI 的對外介面非常精簡。掌握以下四個概念，其餘皆屬於具體配置細節：

- **Agent**：`role + goal + backstory + tools + (optional) llm`。其中背景故事（Backstory）扮演著決定性角色：它塑造了模型的語氣風格、價值判斷標準以及何時該停止執行。工具是 Agent 獲准調用的具體函式。
- **Task（任務）**：`description + expected_output + agent + (optional) context + (optional) output_pydantic`。一項可重複利用的工作單元。`expected_output` 是任務的核心契約；`context` 列舉了上游任務的產出以作為輸入；`output_pydantic` 則強制約束其回傳強型別物件。
- **Crew（團隊）**：頂層容器。統籌 `agents` 清單、`tasks` 清單、執行的 `process`，以及選填的 `memory`、`verbose` 與 `manager_llm` 配置。
- **Process（流程）**：實體執行策略。包含 Sequential（循序）、Hierarchical（階層）與 Consensus（規劃中）。決定了整場任務的具體推進形態。

Agent 之間並非直接彼此感知。任務引用具體的 Agent；團隊依序編排任務；而 Process 則決定究竟由誰來挑選下一個執行的任務。這正是其整套心智模型。

> **依據 CrewAI 0.86（2026-05）驗證**。新版本可能會重新命名或整併流程型別；在依賴具體形態前，請務必核對最新 [CrewAI Processes 官方文件](https://docs.crewai.com/concepts/processes)。

### 循序模式 vs 階層模式 vs 共識模式

- **循序模式（Sequential）**：任務嚴格依照宣告順序執行。任務 N 的輸出自動作為 `context` 傳遞給任務 N+1。成本最低、可預測性最高。當工作流程順序固定時為首選。
- **階層模式（Hierarchical）**：由專門的經理 Agent（Manager Agent，獨立的 LLM 呼叫）在各專家之間動態調度。CrewAI 會依據你的 `manager_llm` 配置或預設模型啟動經理角色。經理每輪挑選下一個執行的任務，並有權拒絕成果或要求重新返工。適用於擁有四個以上專家角色、且執行順序確實取決於前次輸出的複雜情境。
- **共識模式（Consensus）**：尚在規劃中，在當前公開 API 中尚未實作。官方文件將該名稱保留給未來的投票表決流程。目前切勿在程式碼中依賴它。

階層模式在每個專家呼叫之外，皆額外疊加了一次經理 LLM 的決策呼叫。在一個 5 步驟的任務中，Token 總開銷可能直接飆升三倍。唯有在真正需要動態意圖路由時，才值得為其買單。

### Crews vs Flows

這是官方文件在 2026 年最核心的主打架構分野：

- **Crew**：由 LLM 主導的自主協同。框架在執行時期動態決定推進行動。最適合：深度調研、頭腦風暴、初稿撰寫等「探索路徑本身就是答案的一部分」的任務。缺點是難以精確重播、單元測試成本高，但極其適合快速驗證原型。
- **Flow**：由工程師程式碼全權掌控的事件驅動圖。`@start` 標註入口節點；`@listen(topic)` 標註在特定主題被發射時觸發的後續步驟。每個步驟皆是純 Python 程式碼（內部可自由調用 Crew）。最適合：正式環境生產系統。完全可觀測、易於單元測試、具備百分之百的確定性。

官方文檔於 2026 年提出的正式環境黃金建議：**一律從 Flow 出發。**唯有在自主協同確實能創造實質價值時，才在 Flow 的具體步驟內部發起 `Crew.kickoff()` 呼叫。Flow 負責捍衛不可妥協的審計邊界，Crew 負責提供靈活的發散探索。兩者是相互組合的搭檔，而非非此即彼的單選題。

### 工具接入途徑

為 Agent 配置工具的三種途徑，始終挑選能滿足需求的最簡方案：

1. **`@tool` 裝飾器**：將純函式直接轉化為工具。函式簽名即 Schema；Docstring 即大模型閱讀的工具功能描述。最適合輕量的一次性輔助函式。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` 子類別**：基於物件導向類別的工具，具備顯式的參數 Schema、非同步支援與重試機制。當工具具備內部狀態（如用戶端連線池、本地快取）或需要複雜結構化參數時使用。

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **內建工具包（Built-in Toolkits）**：CrewAI 開箱即用的官方適配器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`，一行 import 即可無縫接入。

強型別結構化輸出採用 Pydantic。在 Task 上配置 `output_pydantic=MyModel`。CrewAI 會對大模型的回傳進行校驗，並在不符時自動轉型或觸發重試。務必搭配嚴格精準的 `expected_output` 描述字串。自由文字輸出適合初稿草案；而結構化輸出才是下游 Flow 能夠穩定可靠消費的資料契約。

### 記憶體擴充功能

CrewAI 開箱即用支援四種記憶體型別，且彼此可靈活疊加：

> **依據 CrewAI 0.86（2026-05）驗證**。近期版本已逐步透過統一的 `Memory` 系統將這四種儲存封裝收斂。底層心智模型依然成立，但新版公開 API 可能提供單一 `Memory` 入口；請查閱 [CrewAI 記憶體官方文件](https://docs.crewai.com/concepts/memory)。

- **短期記憶（Short-term）**：單次運行內部的對話歷史緩衝區，在運行結束後自動清空。
- **長期記憶（Long-term）**：跨多次運行持久化保留。預設儲存於 Chroma 向量資料庫（可替換），依據與當前任務的語意相似度檢索召回。
- **實體記憶（Entity）**：針對特定實體的事實記憶（例如「客戶 X 目前採用企業版授權方案」）。以實體名稱為索引鍵精準檢索，而非模糊相似度。跨多次運行持久化存續。
- **脈絡記憶（Contextual）**：組裝階段的即時檢索。在 Agent 實質需要資料的當下動態召回相關記憶，而非提前無差別預載。

在 Crew 上設定 `memory=True` 或進行細項配置即可啟用。底層依賴配置的 embedding 供應商（預設為 OpenAI，支援切換為本機模型）。記憶體是 CrewAI 相較於更輕量框架展現巨大優勢的亮點之一；在原生 LangGraph 中，你必須親手為每個環節手動寫程式碼對接。

### 基於角色的團隊最適合的情境

- 包含 3 到 6 個具備明確職責名稱與協同流程的團隊（草案撰寫、程式碼審查、規劃調研、頭腦風暴）。
- 路由決策需要依賴大模型對下一步該做什麼的主觀判斷（階層模式）。
- 開發團隊更習慣閱讀 `role + goal + backstory` 而非死板的圖結構定義。

### 不適合的情境

- 具備嚴格執行順序的確定性 DAG 工作流程：請直接使用 LangGraph（第 13 課），圖結構才是最自然的抽象，強行套用角色範本只會徒增心智負擔。
- 次秒級（Sub-second）極致低延遲任務：階層模式會增加多次網路往返；即使是循序模式，在 prompt 中反覆攜帶長篇背景故事與先前輸出亦會大幅拉長推論耗時。
- 單一 Agent 任務：無需動用上層框架；一個標準的 Agent 迴圈（第 1 課）外加工具註冊表即可在數十行內搞定。

第 17 課（Agent 框架權衡）將此整理為對比矩陣。簡而言之：CrewAI 穩穩佔據了「基於角色的協同團隊」這一象限。

### 相依性結構

完全獨立於 LangChain。支援 Python 3.10 至 3.13。採用 `uv` 套件管理。GitHub Star 數可參閱 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)（截至 2026-05 的快照）。AWS Bedrock 整合有詳盡官方文檔；廠商自測基準報告宣稱在 QA 任務上比 LangGraph 具備顯著的速度優勢，但由於其評測細節（資料集、測試硬體、評估指標）並未完全公開，因此應理性客觀看待廠商行銷數字。

### 典型架構失效模式

- **背景故事引發的 Prompt 膨脹（Prompt-bloat）**：每個 Agent 配置 2000 字的長篇故事，一個 5 人團隊在發起第一次工具呼叫前就已耗盡了大半脈絡預算。請將背景故事控制在 200 字以內；在團隊間共用風格約定，切勿重複囉嗦五次。
- **經理大模型的 Token 稅**：階層模式在每個專家執行前皆額外插入一次經理 LLM 呼叫。在 5 個任務的團隊中會產生 6 次而非 5 次 LLM 呼叫，且經理呼叫必須攜帶完整的任務清單與過往所有產出。除非路由高度取決於輸出，否則請優先回歸循序模式。
- **脆弱的輸出交接**：任務 N 的 `expected_output` 僅寫著「一份大綱」；任務 N+1 作為 `context` 讀取並嘗試解析三個小節，而 LLM 卻隨機產出了四個小節，導致下游 Agent 自由發揮走樣。解法：在任務 N 上嚴格配置 `output_pydantic`，確保任務 N+1 讀取的是強型別物件而非自由文字。
- **將 Crew 直接暴露為生產服務**：在未封裝 Flow 的情況下直接將自由發揮的 Crew 部署至正式環境。輸出變異度極大、無法確定性重播復原、值班人員根本無從排查壞掉的運行究竟與正常運行有何差異。請一律使用 Flow 進行外層包裝。

```figure
ae-crew-vs-flow
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了兩種形態與一個三 Agent 協同團隊。

架構組成：

- 對標 CrewAI 介面的 `Agent` 與 `Task` 資料結構；
- `SequentialCrew.kickoff(inputs)`：依宣告順序執行任務，將輸出自動串接為 `context`；
- `HierarchicalCrew.kickoff(topic)`：由經理 Agent 每輪挑選下一個專家，直到宣告完成；
- `Flow`：具備 `@start` 與 `@listen(topic)` 裝飾器的輕量事件迴圈與追蹤鏈；
- `tool(name)` 裝飾器：對標 CrewAI 的 `@tool` 介面；
- `Memory`：內建 `short_term`、`long_term`、`entity` 儲存庫；
- 確定性的模擬 LLM 回應字串，完全無外部網路相依。

具體演示：由研究員、撰寫者與編輯者組成的團隊，針對「2026 年的 Agent 工程學」產出一份簡報。研究員抓取資料、撰寫者擬定初稿、編輯者潤飾收尾。完全相同的團隊隨後在 Flow 中執行，以展示確定性的生產形態。

運行實驗：

```bash
python3 code/main.py
```

日誌會完整涵蓋：循序團隊透過 `context` 傳遞輸出、階層團隊由經理動態挑選角色（研究員、撰寫者、編輯者隨後宣告 done）、Flow 以顯式主題（`researched`、`drafted`、`edited`）確定性推進三個步驟、工具透過 `@tool` 正確分派，以及長期記憶在兩次 kickoff 呼叫間順利跨越保留。

Crew 的執行是發散動態的（經理在理論上可重新排序）；而 Flow 的軌跡則是完全固定的。體會此種本質差異正是本課的核心目標。

## Use It｜實際應用

- **CrewAI Flow**：正式環境生產系統首選。即使 Flow 內部僅包含一個調用 `Crew.kickoff()` 的步驟，Flow 依然提供了不可或缺的審計防護邊界。
- **CrewAI Crew（循序模式）**：適用於順序明確的角色協同工作，特別是初稿起草與審查迴圈。
- **CrewAI Crew（階層模式）**：當任務路由高度取決於中繼輸出、且擁有四個以上專業角色時使用。
- **LangGraph**（第 13 課）：適用於顯式狀態機、持久化斷點續傳與嚴格拓撲排序。
- **AutoGen v0.4**（第 14 課）：適用於 Actor 模式的高並發通訊與故障隔離。
- **OpenAI Agents SDK**（第 16 課）：以 OpenAI 為核心、依賴 Handoffs 與 Guardrails 的產品。
- **Claude Agent SDK**（第 17 課）：以 Claude 為核心、依賴子 agent 與階段作業儲存庫的產品。

## Ship It｜交付成果

`outputs/skill-crew-or-flow.md` 能為特定任務在 Crew 與 Flow 之間做出權威技術選型，並產出最小化實作鷹架。對「未提供背景故事的 Crew」、「未宣告顯式主題的 Flow」或「少於三個專家卻盲目使用階層模式」的情境實施嚴格拒絕。

## Pitfalls｜容易踩的坑

- **將背景故事當作隨意點綴**：它深度塑造了模型輸出。針對每個 Agent 測試三種版本，固定最強的一個。
- **略過 `expected_output` 契約**：若缺乏任務契約，下游任務只能碰運氣接收 LLM 隨機輸出的任何內容。團隊跑通了，但審計驗收徹底失敗。
- **無節制全開長期記憶**：長期記憶在每次執行時皆會寫入，向量資料庫快速膨脹，檢索雜訊急遽上升。僅將寫入限制於真正需要持久化事實的關鍵任務中。
- **經理 Prompt 語義漂移**：階層模式中經理的系統提示是隱式的。若路由行為變得詭異，在 verbose 詳細模式下印出經理的真實 Prompt 進行審查。
- **在 Crew 工具中引發副作用**：Crew 調用工具的次數可能超出預期。POST 請求、DELETE 刪除或支付扣款等具備破壞性副作用的操作，必須嚴格置於 Flow 步驟中，絕不可作為 Crew 工具暴露。

## Exercises｜練習

1. 將循序模式的 Crew 重構為 Flow 實作。統計輸出變異度下降的具體節點，並分析程式碼可讀性產生了何種變化。
2. 為團隊新增實體記憶（Entity Memory）：跨多次 kickoff 呼叫持久化保存特定客戶的客觀事實。驗證檢索時能否精準召回正確的目標實體。
3. 實作階層模式：經理 Agent 堅決拒絕將任務移交給編輯者，直到撰寫者的輸出至少包含三個段落為止。追蹤重試軌跡。
4. 為模擬的網頁搜尋實作 `BaseTool` 子類別，並對比其追蹤日誌與 `@tool` 裝飾器版本的差異。
5. 在編輯任務上新增 `output_pydantic=Brief` 強型別約束，其中 `Brief` 包含 `title`、`summary`、`sections`。讓撰寫任務人為產出一次畸形 JSON，驗證 CrewAI 的重試自我修復行為。
6. 研讀 CrewAI 官方文檔。將此教學實作移植為使用真實的 `crewai` 庫，分析標準函式庫版本略過了哪些底層保證。
7. 將 AgentOps 或 Langfuse（第 24 課）接入真實運行中，觀察哪些隱性追蹤在本地模擬中曾被忽略。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Agent | 「角色」 | Role（角色）+ Goal（目標）+ Backstory（背景故事）+ Tools（工具） |
| Task | 「任務單元」 | Description（描述）+ Expected Output（預期輸出）+ 指派角色 + 選填結構化契約 |
| Crew | 「Agent 團隊」 | 統籌 Agents + Tasks + Process 的頂層容器 |
| Process | 「執行策略」 | Sequential（循序）/ Hierarchical（階層）/ Consensus（規劃中） |
| Flow | 「確定性工作流程」 | 事件驅動、由工程師程式碼全權掌控、具備完全可測試性的正式環境骨架 |
| Backstory | 「角色設定 Prompt」 | 為 Agent 塑造語氣風格、價值判斷標準與行為邊界的背景設定 |
| `@tool` | 「函式工具裝飾器」 | 將純 Python 函式直接轉換為 Agent 可調用工具的輕量裝飾器 |
| `BaseTool` | 「類別工具基底」 | 具備顯式參數 Schema、非同步支援與重試能力的物件導向工具類別 |
| Entity memory | 「實體專屬記憶」 | 以客戶／帳號／工單等實體名稱為索引鍵精準檢索的事實儲存 |
| Long-term memory | 「跨回合長效記憶」 | 基於向量資料庫、能在多次不同 kickoff 執行間持久化保留的記憶體 |
| Contextual memory | 「即時組裝記憶」 | 在 Agent 實質需要資料的當下即時召回的動態記憶 |
| Manager LLM | 「經理路由器」 | 在階層模式中負責評估進度並動態挑選下一個執行任務的專職大模型 |
| `expected_output` | 「任務交付契約」 | 明確指引 Agent（以及審計系統）預期回傳何種結構與規格的合規字串 |

## Further Reading｜延伸閱讀

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction) ——核心概念與官方推薦的正式環境實踐路徑
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows) ——事件驅動架構、`@start` 與 `@listen` 深度指南
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools) ——`@tool`、`BaseTool` 與內建工具庫參考手冊
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory) ——短期、長期、實體與脈絡記憶體官方解析
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——何時多 Agent 架構真正有用，何時純屬多餘負擔
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——狀態機架構的對照參考
