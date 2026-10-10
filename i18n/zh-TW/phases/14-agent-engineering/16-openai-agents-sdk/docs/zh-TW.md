# OpenAI Agents SDK：委派移交、安全護欄與鏈路追蹤

> OpenAI Agents SDK 是建構於 Responses API 之上的輕量級多 Agent 框架。五大核心原語：Agent、Handoff（委派移交）、Guardrail（安全護欄）、Session（階段作業）與 Tracing（鏈路追蹤）。Handoff 在模型視角中被抽象為名為 `transfer_to_<agent>` 的專用工具；Guardrail 能在輸入或輸出端精準觸發警報；Tracing 預設全面開啟。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 指出 OpenAI Agents SDK 的五大核心原語。
- 深入闡明 Handoffs 委派機制：為何將其建模為工具、模型眼中的工具名稱形態，以及對話脈絡如何安全轉移。
- 嚴格區分輸入護欄（Input guardrails）、輸出護欄（Output guardrails）與工具護欄（Tool guardrails）；解釋 `run_in_parallel` 平行模式與 Blocking 阻塞模式的本質差異。
- 以純 Python 標準函式庫實作一套具備委派移交、安全護欄與 Span 風格鏈路追蹤的執行時期環境。

## The Problem｜問題

若 Agent 無法俐落地向下委派，最終必然退化為將所有複雜邏輯硬塞入單一臃腫的 prompt 中。若 Agent 缺乏安全護欄，則極易外洩個人隱私資料（PII）、輸出違反企業安全政策的內容，甚至陷入無限死迴圈。OpenAI 官方推出的 Agents SDK，將這三大使多 Agent 協同真正具備工程可行性的核心原語進行了標準化規範。

## The Concept｜核心概念

### 五大核心原語

1. **Agent**：包含 LLM + 指令指引 + 工具集 + 委派移交清單（handoffs）。
2. **Handoff（委派移交）**：向另一個 Agent 委派工作。在模型眼中被呈現為名為 `transfer_to_<agent_name>` 的專屬工具。
3. **Guardrail（安全護欄）**：在輸入端（僅限第一個 Agent）、輸出端（僅限最後一個 Agent）或工具調用時（針對每個函式工具）執行的合規校驗器。
4. **Session（階段作業）**：自動跨多個對話回合持久化維護對話歷史。
5. **Tracing（鏈路追蹤）**：原生內建針對 LLM 生成、工具呼叫、委派移交與安全護欄的 Span 追蹤。

### 將 Handoff 建模為工具呼叫

大模型在自身的可用工具清單中能看見 `transfer_to_billing_agent`。當模型決定呼叫該工具時，會向執行時期環境發送信號：

1. 複製當前的對話上下文脈絡（或透過 `nest_handoff_history` 實驗性特徵將其提煉折疊）；
2. 啟動目標 Agent 並載入其專屬指令指引；
3. 由目標 Agent 接管並繼續推進執行。

這正是監督者模式（第 13 課 / 第 28 課）的官方產品化實踐。

### Guardrails｜三類安全護欄

包含三種形態：

- **輸入護欄（Input guardrails）**：在第一個 Agent 接收輸入時執行。在調用任何 LLM 之前，果斷拒絕不安全或超出職責範疇的惡意請求。
- **輸出護欄（Output guardrails）**：在最後一個 Agent 產生輸出時執行。攔截 PII 敏感資料外洩、違規內容或格式畸形的回應。
- **工具護欄（Tool guardrails）**：針對每個函式工具單獨執行。嚴格校驗輸入參數、審查呼叫權限，並審計執行過程。

執行模式：

- **平行模式（Parallel，預設）**：護欄模型與主 LLM 同步並發執行。顯著降低尾端響應延遲；但若觸發護欄警報，主 LLM 已生成的運算將被直接捨棄（產生一定的 Token 浪費）。
- **阻塞模式（Blocking，`run_in_parallel=False`）**：護欄模型優先執行。若觸發警報，直接中斷流程，主 LLM 完全不發起呼叫，絕不浪費多餘 Token。

護欄警報會拋出 `InputGuardrailTripwireTriggered` 或 `OutputGuardrailTripwireTriggered` 例外。

### 內建鏈路追蹤（Tracing）

預設全面開啟。每次 LLM 生成、工具呼叫、委派移交與護欄檢驗皆會自動發射 Span。可透過設定環境變數 `OPENAI_AGENTS_DISABLE_TRACING=1` 關閉。亦可透過 `add_trace_processor(processor)` 將 Spans 同步分流推播至你自己的後端觀測平台。

### 階段作業持久化（Sessions）

`Session` 將對話歷史持久化儲存於後端（支援 SQLite、Redis 或自訂儲存）。調用 `Runner.run(agent, input, session=session)` 時會自動載入既有歷史並追加新回合。

### 典型架構失效模式

- **委派乒乓死迴圈（Handoff drift）**：Agent A 委派給 Agent B，而 Agent B 又反手委派回 Agent A。解法：強制加入跳數計數器（Hop counter）限制最大移交次數。
- **護欄防護盲區**：工具護欄僅對一般函式工具生效；內建工具（如檔案讀取、網頁檢索）需要配置獨立的安全策略。
- **追蹤日誌過度記錄**：將敏感機密直接記錄至 Spans 中。務必結合第 23 課的 OTel GenAI 內容擷取規則——在外部安全儲存，於 Trace 中僅保留 ID 參照。

```figure
ae-agent-handoff
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了 SDK 的核心架構：

- `Agent`、`FunctionTool`、`Handoff`（具備移交語義的函式工具）；
- 支援輸入／輸出／工具護欄、委派分派與跳數計數器的 `Runner` 執行器；
- 展示 Span 樹狀結構的輕量追蹤發射器；
- 分流 Agent（Triage Agent）依據使用者問題動態移交至計費（Billing）或支援（Support）Agent；並演示在特定輸入上精準觸發輸入護欄警報。

運行實驗：

```
python3 code/main.py
```

日誌會展示兩次成功的委派移交、一次被成功攔截的輸入護欄警報，以及完全對標真實 SDK 結構的 Span 呼叫樹。

## Use It｜實際應用

- **OpenAI Agents SDK**：以 OpenAI 模型為核心的產品首選。
- **Claude Agent SDK**（第 17 課）：以 Claude 模型為核心的產品首選。
- **LangGraph**（第 13 課）：需要顯式狀態機、持久化檢查點與斷點復原時使用。
- **自建架構**：需要極致精細控管（語音低延遲、跨多供應商混合、聯邦式部署）時使用。

## Ship It｜交付成果

`outputs/skill-agents-sdk-scaffold.md` 能自動產出標準的 Agents SDK 應用程式鷹架，包含分流 Agent、委派移交定義、輸入／輸出／工具安全護欄、階段作業儲存庫與鏈路追蹤處理器。

## Exercises｜練習

1. 為委派移交新增跳數計數器：在超過 N 次移交後果斷拒絕。追蹤其防禦死迴圈的具體行為。
2. 實作 `nest_handoff_history` 選項：在將控制權移交給下一個 Agent 之前，將先前的所有歷史訊息自動提煉折疊為單一摘要。
3. 撰寫一個阻塞式（Blocking）輸出護欄。對比在會觸發警報的 prompt 與正常通過的 prompt 上的端到端延遲差異。
4. 透過 `add_trace_processor` 連接一個 JSON 格式日誌記錄器。觀察每個 Span 所輸出的具體欄位結構。
5. 研讀 Agents SDK 官方文檔。將此教學實作移植為使用真實的 `openai-agents-python` 庫。分析在本地模擬中有哪些細節建模不夠完善？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Agent | 「大模型 + 指引」 | SDK 中的核心 Agent 型別；擁有工具清單與委派移交能力 |
| Handoff | 「控制權移交」 | 大模型獲准調用以將任務全權委派給另一個 Agent 的專屬工具 |
| Guardrail | 「策略合規檢查」 | 針對輸入、輸出或工具調用所執行的可程式化合規校驗器 |
| Tripwire | 「護欄警報」 | 當安全護欄判定請求違規時所拋出的特定中斷例外 |
| Session | 「對話記憶庫」 | 跨多次運行持久化維護對話歷史的儲存容器 |
| Tracing | 「全鏈路追蹤」 | 覆蓋 LLM 生成、工具調用、委派移交與護欄的內建分散式追蹤 |
| Blocking guardrail | 「順序阻塞檢查」 | 護欄優先執行；觸發違規時完全不浪費主 LLM 的 Token |
| Parallel guardrail | 「並發非同步檢查」 | 護欄與主模型並發執行；延遲更低，但在違規時會浪費已生成的 Token |

## Further Reading｜延伸閱讀

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) ——核心原語、委派移交、安全護欄與追蹤官方文檔
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) ——Claude 體系的對應實踐
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——何時真正需要引入委派移交架構
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) ——Agents SDK 追蹤 Spans 所遵循的業界標準
