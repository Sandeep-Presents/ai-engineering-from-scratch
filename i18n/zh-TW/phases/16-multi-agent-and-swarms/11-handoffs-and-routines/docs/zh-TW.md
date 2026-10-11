# 交接與例行程式——無狀態編排架構（Handoffs and Routines — Stateless Orchestration）

> OpenAI 於 2024 年 10 月發布的 Swarm 將多 Agent 編排體系高度提煉為兩大核心原語：**例行程式（Routines）**（以系統 prompt 封裝的指令集與可用工具）以及**交接（Handoffs）**（一個回傳另一個 Agent 物件的專屬工具）。沒有複雜的狀態機，沒有繁瑣的條件判定 DSL——底層 LLM 僅僅透過呼叫正確的交接工具來自行完成路由跳轉。OpenAI Agents SDK（2025 年 3 月發布）是其工業級正式環境繼承者。然而 Swarm 本身依然是業界最為乾淨純粹的概念參照——其全部核心原始碼僅有寥寥數百行。這套模式之所以能迅速風靡全網，在於其 API 介面極度精煉：「Agent = Prompt + 工具；交接 = 回傳 Agent 的函式」。客觀局限性：本質上完全無狀態，因此記憶體的跨輪次維護完全成為外層呼叫者的責任。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problem｜問題

市場上的每一個多 Agent 框架都在強迫你學習其專屬的領域特定語言（DSL）：LangGraph 的節點（Node）與圖邊（Edge）、CrewAI 的專案團隊（Crew）與任務（Task）、AutoGen 的群組對話（GroupChat）與管理者（Manager）。這些 DSL 固然是嚴肅的抽象層，但它們往往讓原本直觀的問題變得比想像中龐雜厚重。

Swarm 則採取了截然相反的極簡路線：直接複用大型語言模型原生早已具備的工具呼叫能力。任務交接直接表現為一次標準的工具呼叫。而全系統的編排器，純粹就是當前正持有對話話語權的那個 Agent。原本複雜的狀態機，直接隱式蘊含在各 Agent 的系統 prompt 之中。

## Concept｜核心概念

### 兩大核心原語

**例行程式（Routine）。** 一段精準界定 Agent 角色邊界與可用工具的系統 prompt。可以將其視為一組受限的專屬指令集：「你是一名分流總機 Agent；若使用者詢問退款事宜，請將對話交接給退款專門 Agent。」

**交接（Handoff）。** 一個由 Agent 自主呼叫、且執行後會直接回傳一個全新 Agent 物件的專屬工具。Swarm 執行環境一旦偵測到函式回傳了 Agent 物件，便會在下一輪對話中自動將當前活躍的 Agent 切換為該新物件。

這就是整套抽象架構的全部精髓。

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

分流總機 Agent 的系統 prompt 會引導其依據使用者的自然語言輸入，自主挑選正確的交接工具發起呼叫。底層 LLM 的工具呼叫機制承擔了全部的動態路由職責。

### 為什麼它能風靡全網

- **API 介面極致精巧。** 僅需學習理解兩個基本概念。
- **完全複用模型原生已成熟的能力。** 工具呼叫在主流各大模型供應商端皆已達到工業級就緒水準。
- **徹底告別狀態機的認知負擔。** 你再也不需要用程式碼硬性繪製複雜的執行圖；各 Agent 自身的 prompt 清楚指明了它們各自該把皮球踢給誰。

### 無狀態架構的取捨代價

Swarm 在單次對話執行之間被刻意設計為完全無狀態的。雖然框架會在單次對話內部保留訊息歷史，但它絕不會自動落盤持久化任何狀態。長期記憶、跨會話連續性、跨數小時的長任務——這一切全都是外層呼叫者必須自行承擔的課題。

在正式環境等級的演進中（OpenAI Agents SDK，2025 年 3 月發布），這項局限性成為首要被補齊的維度：該 SDK 在完整保留交接原語的同時，全面追加了內建的會話管理、安全護欄以及鏈路追蹤能力。

### 何時交接模式最為契合

- **分流導向模式（Triage patterns）。** 由第一線總機 Agent 迅速將使用者分發給特定專家。
- **基於專長技能的交接。** 「若任務需要撰寫程式碼，交接給工程師；若需要查閱官方文件，交接給調研員。」
- **短暫、邊界明確的有限對話。** 客服諮詢、FAQ 轉工單、單純的工作流程轉發。

### 何時交接模式陷入掙扎

- **依賴共享記憶體的長時間複雜會話。** 每次交接皆會將對話狀態重新切換至新 Agent 的專屬 prompt 加上歷史脈絡。若缺乏呼叫者端主動維護的記憶體，Agent 之間完全不存在持久化共享狀態。
- **平行大規模運作。** 交接在底層機制上是一次單線程的接力棒傳遞——活躍的 Agent 始終只有一個。若需要平行加速，呼叫者必須手動在外部編排多個並行的 Swarm 實例。
- **稽核與確定性重播。** 無狀態的執行難以被百分之百確定性重播；LLM 的交接決策天生帶有機率隨機性。

### OpenAI Agents SDK（2025 年 3 月）

作為 Swarm 的正式環境工業級繼承者，該 SDK 追加了以下企業級特性：

- **會話狀態持久化（Session state）。** 支援跨越多輪執行的持久化執行緒。
- **安全護欄（Guardrails）。** 提供輸入與輸出層面的即時驗證勾子。
- **全鏈路追蹤（Tracing）。** 詳盡記錄每一次工具呼叫與交接跳轉。
- **交接過濾器（Handoff filters）。** 精準控制在交接瞬間究竟有哪些上下文被允許傳遞給下一棒。

交接核心原語絲毫未變；外圍全面包覆了工業級所需的維運防護網。

### Swarm vs GroupChat

兩者皆採用由 LLM 驅動的動態路由，但核心分歧在於**究竟是由誰來挑選下一棒**：

- GroupChat：由外部的選取器（決策函式或獨立 LLM）俯瞰全域並挑選下一位發言者。
- Swarm：由當前正處於活躍狀態的 Agent 透過直接呼叫交接工具，親自指定自己的繼承者。

Swarm 是「當前 Agent 自主決定下一步」；GroupChat 則是「會議主持人統一決定下一步」。Swarm 的決策權深植於活躍 Agent 的工具呼叫中；而 GroupChat 的決策權則完全收攏於 `GroupChatManager` 手中。

```figure
sw-handoff-routing
```

## Build It｜動手實作

`code/main.py` 透過純 Python 標準函式庫從零實現了一個精簡的 Swarm 核心：包含一個 Agent 資料類別、一套交接機制（工具回傳 Agent 物件），以及一個能即時感知 Agent 身分切換的運作迴圈。

展示情境：一個分流總機 Agent 能自主將使用者請求精準分流至退款、業務或技術支援三位專門專家。每位專家皆配備了自身的專屬工具。執行迴圈會在終端機中清晰列印出每一次交接跳轉的詳細軌跡。

執行指令：

```
python3 code/main.py
```

## Use It｜實際應用

`outputs/skill-handoff-designer.md` 能為一項給定的業務任務量身設計交接拓撲架構：明確界定需要哪些 Agent、各自能呼叫哪些交接工具，以及在交接瞬間有哪些上下文資料需要被傳遞。

## Ship It｜交付成果

交接模式推向正式環境前的必備檢查清單：

- **交接全鏈路日誌記錄。** 每一次交接跳轉皆必須寫入追蹤事件，記錄發起 Agent、目標 Agent 以及當前上下文快照。
- **嚴謹的上下文傳遞規則。** 明確約定在交接瞬間傳遞何種資訊：是完整歷史（代價高昂）、最近 N 則訊息，抑或高度濃縮的文字摘要。
- **交接防禦護欄。** 當交接至具備不同高危工具權限的專家 Agent 時，必須進行身分認證審查——堅決防範惡意 prompt 注入透過誘騙交接來取得非法權限。
- **交接死迴圈偵測。** 兩個 Agent 彼此互相踢皮球是極其常見的失效；透過維護一個滑動歷史視窗即可輕鬆偵測並掐死該循環。
- **兜底降級 Agent。** 一旦交接的目標 Agent 宣告不存在或故障，系統必須能優雅回退至安全的預設處理常式。

## Exercises｜練習

1. 執行 `code/main.py`，觸發分流至退款 Agent 的情境。確認在第二輪對話中，系統的活躍 Agent 是否已順利變更為退款專家。
2. 加入死迴圈偵測規則：若完全相同的兩個 Agent 連續相互交接了 3 次，強制終止對話。設計一套優雅的兜底降級策略。
3. 閱讀 OpenAI Agents SDK 官方文件中關於交接過濾器的說明。實作一套「交接即摘要」機制：在轉交話語權之前，由即將退場的 Agent 將上下文壓縮為條列式摘要後，再傳遞給接棒的 Agent。
4. 橫向對比 Swarm 的交接模式與 GroupChatManager 的選取器模式。哪一種模式更容易放大 prompt 注入攻擊的破壞力？背後的深層原因為何？
5. 閱讀 Swarm 實戰手冊 (https://developers.openai.com/cookbook/examples/orchestrating_agents)。指出一項 Swarm 刻意堅持、但在 OpenAI Agents SDK 中被全面改造或保留的明確架構決策。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Further Reading｜延伸閱讀

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 對例行程式與交接原語最為透徹權威的奠基論述。
- [OpenAI Swarm repo](https://github.com/openai/swarm) — 原始開源專案，作為業界最極簡的概念參照基準。
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — 配備會話管理與鏈路追蹤的工業級正式環境繼承者。
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) — 深入探討 Claude Code 的子 agent 如何透過 `Task` 實作類似交接的架構模式。
