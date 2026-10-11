# 多 Agent 原語模型（The Multi-Agent Primitive Model）

> 四個核心原語，僅此而已——Agent、交接（Handoff）、共享狀態（Shared state）以及編排器（Orchestrator）——共同張開了一個四維的設計空間，而 2026 年市場上所有主流的多 agent 框架（AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、微軟 Agent Framework）皆只不過是該空間中的特定座標點。本課將從零開始親手建構這四大原語，在由四者組成的玩具系統上實際運作，隨後將各大主流框架精準映射至這些座標軸上，讓你在未來面對任何新發布的框架時，皆能在一頁段落內看穿其本質。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problem｜問題

每隔六個月，業界就會誕生一套全新的多 agent 框架。2023 年是 AutoGen。2024 年是 CrewAI。隨後是 LangGraph 與 OpenAI Swarm。2025 年 4 月 Google 釋出 ADK。2026 年 2 月微軟發布 Agent Framework RC。每一份官方新聞稿皆高調宣稱自己找到了「唯一正確的抽象層」。

如果你試圖逐一單獨學習它們，你很快就會陷入筋疲力竭的認知過載。它們的 API 介面看似大相逕庭。官方文件對「何謂 Agent」的定義彼此矛盾。有的框架將其共享記憶體稱為「黑板（blackboard）」，另一個稱之為「訊息池（message pool）」，第三個則稱其為「StateGraph」。你甚至開始懷疑整個人工智慧領域是否僅是在毫無意義地徒勞空轉。

事實並非如此。在天花亂墜的行銷包裝之下，底層的四大原語歷久彌新、極其穩定。只要一次性徹底搞懂它們，未來任何新框架你都能在一分鐘內看清底牌。

## Concept｜核心概念

### 四大核心原語

1. **Agent**——由一段系統 prompt 加上一份工具清單所構成。本質上是完全無狀態的；每一次執行皆嚴格始於其系統 prompt 與當前的訊息歷史。
2. **交接（Handoff）**——控制權從一個 agent 轉移至另一個 agent 的結構化轉移過程。在底層機制上，表現為回傳新 agent 的工具呼叫，或是依據特定條件跳轉的圖邊（graph edge）。
3. **共享狀態（Shared state）**——任何可供多個 agent 讀取（有時允許寫入）的資料結構。例如訊息池、黑板、鍵值儲存（KV store）或向量記憶體。
4. **編排器（Orchestrator）**——決定下一步由誰發言的仲裁實體。常見選項包括：顯式宣告的執行圖（確定性）、由 LLM 充當發言選取器（軟性決策）、依賴上一位發言者的交接工具呼叫（如 OpenAI Swarm），或是依據佇列進行調度的排程器（群體架構）。

這就是整個多 agent 架構的完整設計空間。各大框架僅僅是針對各個座標軸選取了不同的預設值；其餘的一切皆屬表面語法糖。

### 2026 年主流框架如何映射至該模型

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

表面上的語法差異看似天差地別。但在引擎蓋之下：調校的永遠是相同的四個旋鈕。

### 為什麼這至關重要

一旦你看穿了這四大原語，評估新舊框架的優劣將簡化為一份精煉的自檢清單：

- 編排器是盲目信任 LLM 自行決定路由（Swarm），還是將路由邏輯用程式碼硬性固定（LangGraph）？
- 共享狀態是粗暴包含完整歷史（GroupChat），還是經過投影剪裁的精簡視圖（StateGraph reducer）？
- 各 agent 是否具備動態改寫彼此 prompt 的權限（CrewAI manager），抑或僅被允許執行單純的任務交接（Swarm）？

這三個問題足以回答 80% 的技術選型適配性。你再也不需要在市場上盲目尋找「最好的多 agent 框架」，而是能夠直奔主題，專注針對你真正在意的核心維度進行理性架構設計。

### 無狀態性的深刻洞察

除了「共享狀態」之外，其餘三個原語在數學本質上皆是完全無狀態的。Agent 是 (prompt, tools) 的純函式映射。交接本質上是一次函式呼叫。編排器則是一個任務排程器。**整個多 Agent 系統中唯一擁有狀態的實體，正是共享狀態。** 這正是所有耐人尋味的複雜 bug 潛伏的真正溫床：記憶體污染（第 15 課）、訊息時序錯亂、版本漂移以及寫入並行競爭。

刻意隱藏共享狀態的框架（例如 Swarm）只不過是將這個燙手山芋粗暴踢給了外層呼叫者。而將共享狀態集中管理的框架（例如 LangGraph 檢查點、AutoGen 訊息池）雖然具備極佳的可觀測性，卻將沉重的狀態同步開銷轉嫁給了底層的共享狀態實作。

### 單一原語的解剖學

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

自身不具備任何記憶，不具備任何內部狀態。兩個擁有完全相同系統 prompt 與工具清單的 agent 是完全等價且可任意互換的。任何表面上看像是屬於個別 agent 的私有狀態，本質上皆存放於共享狀態或交接協定之中。

#### Handoff（交接）

```
Handoff = (from_agent, to_agent, reason, payload)
```

當前由三種主流實作模式所統治：

- **函式回傳值（Function return）**——工具執行完畢後直接回傳下一個目標 agent。這正是 OpenAI Swarm 的標準模式。各 agent 在自身的工具 Schema 中自行攜帶路由邏輯。
- **圖邊（Graph edge）**——LangGraph 模式。邊的定義是宣告式的。LLM 產出一個決策值；底層條件分流自動決定跳轉至哪一個目標節點。
- **發言人選取（Speaker selection）**——AutoGen GroupChat 模式。由一個專門的選取器函式（有時本身就是一次獨立的 LLM 呼叫）通讀共享池並指派下一位發言者。

#### Shared state（共享狀態）

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最精簡的形式僅是一組訊息清單。但在實務中往往包含更多豐富結構：例如強型別工件（CrewAI 的 Task 輸出）、受管制的型別上下文（LangGraph reducers）以及外部記憶體系統（MCP、向量資料庫）。

常見的兩大拓撲結構：**完整池（full pool）**（每個 agent 皆能看見每一則訊息）與**投影視圖（projected）**（每個 agent 僅能看見依其角色剪裁後的特定視圖）。完整池實作最為簡便，但擴展性極差。投影視圖具備優異的擴展性，但要求在架構初期進行嚴謹的 Schema 設計。

#### Orchestrator（編排器）

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

當前存在四種典型風格：

- **靜態編排（Static）**——執行圖在建置時期便已被硬性固定（LangGraph 確定性圖、CrewAI 循序流程 Sequential）。
- **LLM 動態選取（LLM-selected）**——由 LLM 通讀訊息池並動態挑選下一位發言者（AutoGen、CrewAI 階層式流程 Hierarchical）。
- **交接驅動（Handoff-driven）**——由當前執行的 agent 透過直接呼叫交接工具來決定下一棒（Swarm）。
- **佇列驅動（Queue-driven）**——所有工作者自發從共享佇列中拉取任務；不存在顯式的「下一位發言者」（群體架構、Matrix 網路）。

### 框架之間的實質差異

一旦這四大原語被清晰界定，剩餘的架構設計決策將完全聚焦於：

- **記憶體持久化策略**——暫態記憶 vs 具備持久化能力的檢查點機制（例如 LangGraph checkpointer）。
- **安全防護邊界**——誰擁有核准任務交接的最終決定權（人在迴圈中 HITL）。
- **成本會計核算**——為每個 agent 配置獨立的 token 與財務預算。
- **系統可觀測性**——追蹤交接軌跡、持久化狀態以支援確定性重播。

上述所有高級特性，皆能完全建構於這四大底層原語之上。它們無一構成任何全新的第五種原語。

```figure
a5-primitive-radar
```

## Build It｜動手實作

`code/main.py` 透過約 150 行 Python 標準函式庫實現了這四大核心原語。完全不依賴真實的外部 LLM——每個 agent 皆採用固定的腳本化原則（scripted policy），以確保我們的注意力能完全聚焦於協調協同架構本身。

該實作匯出了以下核心抽象：

- `Agent`——封裝了名稱、系統 prompt、工具清單與原則函式的 dataclass。
- `Handoff`——能夠回傳全新目標 agent 的轉移函式。
- `SharedState`——一個具備執行緒安全保證的共享訊息池。
- `Orchestrator`——提供了三種典型變體：`StaticOrchestrator`（靜態編排器）、`HandoffOrchestrator`（交接驅動編排器）以及模擬的 `LLMSelectorOrchestrator`（LLM 選取編排器）。

展示程式會將同一個由三位 agent 組成的標準管線（調研 → 編寫 → 審查）分別透過這三種編排器執行一遍，並在最終列印出訊息池的狀態。你將清晰觀察到：各版本的最終輸出差異僅僅在於**究竟是由誰來挑選下一棒**；各 agent 本身與底層共享狀態在不同執行之間保持完全一致。

執行指令：

```
python3 code/main.py
```

預期輸出：三種編排器各自執行一次，每種模式皆會印出最終的訊息池狀態。其中，在交接驅動的模式下，若研究員判定自身任務已提早完工，流程將觸及顯著更少數量的 agent——這正是以微觀程式碼直觀體現「依賴 LLM 動態路由」所伴隨的靈活性與不確定性取捨。

## Use It｜實際應用

`outputs/skill-primitive-mapper.md` 是一項專業 skill，能夠深度閱讀任何多 agent 程式碼庫或框架官方文件，並精準輸出該系統對應的四大原語映射表。在面對任何新發布的框架時，先用它產出一份一頁的架構透視報告，再決定是否值得投入時間精讀文獻。

## Ship It｜交付成果

在團隊決定導入任何全新框架之前，務必先為其撰寫一份四大原語映射清單。若你發現自己無法完成映射，要麼說明該官方文件語焉不詳，要麼代表該框架罕見地發明了第五種原語（極其罕見——通常只是你碰到了未曾見過的某種共享狀態變體）。

將這份原語映射表直接釘選在你們團隊的架構設計文件中。每當有新成員加入團隊時，先將這份映射表交給他，而不是直接丟給他晦澀繁雜的 API 文件。當框架版本升級時，主動比對這四大原語映射的演變，而非盲目通讀瑣碎的 Changelog。

## Exercises｜練習

1. 執行 `code/main.py` 三次，每次配置不同的 agent 行為原則。仔細觀察編排器的選型如何直接改變了最終被喚醒執行的 agent 集合。
2. 實現第四種編排器類型：建構一個由佇列驅動的編排器，讓各 agent 自主從共享狀態中輪詢拉取任務。思考在何種邊界條件下會發生死結，以及你該如何設計偵測機制？
3. 閱讀 LangGraph 快速上手文件 (https://docs.langchain.com/oss/python/langgraph/workflows-agents)，並嘗試將其完整還原為本課的四大原語。指出 LangGraph 的哪些抽象概念與原語是一對一精準對齊的，哪些純粹屬於便利性的包裝層？
4. 閱讀 OpenAI Swarm 實戰手冊 (https://developers.openai.com/cookbook/examples/orchestrating_agents)。指出 Swarm 將四大原語中的哪一項封裝得最為優雅親切，又將哪一項粗暴推給了外層呼叫者自行承擔？
5. 在本課的對比表格中找出一個完全隱藏了共享狀態的框架。深入分析當 agent 需要跨越多輪交接協同運作、且不被允許重新通讀全部歷史時，系統會在哪個環節徹底瓦解？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Further Reading｜延伸閱讀

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 對交接驅動編排模式最為清晰透徹的權威論述。
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) — GroupChat 搭配發言人選取機制是 LLM 動態選取編排架構的經典參考規範。
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 圖邊編排架構與基於 reducer 運作的共享狀態模型。
- [CrewAI introduction](https://docs.crewai.com/en/introduction) — 具備角色、目標與背景故事設定的 agent，及其循序與階層式處理流程。
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) — 在微軟將 v0.4 轉入維護模式後，持續活躍演進的 AutoGen 社群主力 branch。
