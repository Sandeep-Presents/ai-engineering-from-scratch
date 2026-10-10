# OpenTelemetry GenAI — 端到端工具呼叫分散式追蹤

> 當一個 agent 呼叫了五個工具、三台 MCP 伺服器與兩個子 agent 時，你需要一條貫穿全鏈路的完整追蹤鏈（trace）。OpenTelemetry GenAI 語意約定（v1.37 以上的穩定屬性規範）是 2026 年的業界標準，獲 Datadog、Langfuse、Arize Phoenix、OpenLLMetry 與 AgentOps 原生支援。本課將定義各項必備屬性、梳理 span 的階層體系（agent → LLM → tool），並以 Python 標準函式庫交付一套可無縫接入任何 OTel 匯出器的 span 發射器。

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 指出 LLM span 與工具執行 span 所需的必備 OTel GenAI 屬性名稱。
- 建構涵蓋 agent 迴圈、LLM 呼叫、工具呼叫與 MCP 用戶端轉發的完整階層式追蹤架構。
- 制定內容擷取決策：明確區分主動選擇性記錄（opt-in）與預設抹除防護（redaction）。
- 在不重寫任何工具業務程式碼的前提下，將 spans 發送至本地收集器（如 Jaeger、Langfuse）。

## The Problem｜問題

這是一起發生在 2026 年 2 月的真實除錯案例：使用者回報「我的 agent 有時需要 30 秒才回應，但有時只要 3 秒」。系統完全缺乏分散式追蹤鏈。應用日誌中雖然記錄了 LLM 呼叫，卻完全找不到工具轉發、MCP 伺服器往返網路延遲或子 agent 的執行軌跡。工程師只能憑空猜測。經過漫長的排查，最終才發現：其中一台 MCP 伺服器偶爾會在冷啟動時發生長時間卡頓。

若沒有端到端的分散式追蹤（End-to-End Tracing），你根本無法定位這類問題。OTel GenAI 正是為此而生。

該語意規範於 2025–2026 年間在 OpenTelemetry 語意約定工作小組（Semantic-Conventions Group）下正式定案。它定義了穩定的標準屬性名稱，使得 Datadog、Langfuse、Phoenix、OpenLLMetry 與 AgentOps 能以完全相同的結構解析所有 spans。只需埋點一次，即可自由匯出至任何後端觀測平台。

## The Concept｜核心概念

### Span 階層體系

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

整個呼叫過程皆巢狀掛載於同一個 trace ID 之下。各個 span 透過 span ID 串聯起父子層級關係。

### 必備屬性

依據 2025–2026 年的語意約定（semconv）規範：

- `gen_ai.operation.name` ——`"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` ——`"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` ——請求的模型名稱字串（例如 `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` ——後端實際提供服務的模型名稱。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` ——供應商回傳的回應識別碼，用於跨系統關聯。

針對工具 span：

- `gen_ai.tool.name` ——工具識別碼。
- `gen_ai.tool.call.id` ——該次具體呼叫的專屬 ID。
- `gen_ai.tool.description` ——工具功能描述（選填）。

針對 Agent span：

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span 類型（Span Kinds）

- `SpanKind.CLIENT`：跨越行程或網路邊界的連線呼叫（例如呼叫遠端 LLM 供應商、請求 MCP 伺服器）。
- `SpanKind.INTERNAL`：agent 自身內部的迴圈步驟與本地工具執行。

### 選擇性內容擷取（Opt-in Content Capture）

在預設情況下，spans 僅會記錄效能指標與時間延遲數值——絕不會記錄 prompt 或 completion 的原始對話文字。龐大的訊息酬載與個人敏感資訊（PII）預設一律排除。需透過設定環境變數 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 以及專屬的內容擷取旗標方可啟用文字記錄。在正式環境開啟前必須經過嚴格的資安合規審查。

### Span 事件（Events on Spans）

Token 層級的細部事件可作為事件附掛至 span 上：

- `gen_ai.content.prompt` ——輸入訊息內容。
- `gen_ai.content.completion` ——輸出訊息內容。
- `gen_ai.content.tool_call` ——記錄下來的具體工具呼叫。

所有事件在 span 內部皆嚴格依時間戳記排序，利於日後的高精度重播復原。

### 匯出器生態系（Exporters）

OTel spans 可直接匯出至：

- **Jaeger / Tempo**：開源社群方案，適合私有部署。
- **Langfuse**：專注於 LLM 可觀測性，具備強大的 Token 消耗視覺化看板。
- **Arize Phoenix**：結合評測（Evals）與鏈路追蹤的綜合分析平台。
- **Datadog**：主流商用平台，原生支援解析 `gen_ai.*` 屬性。
- **Honeycomb**：基於欄位式儲存，支援高維度快速查詢。

所有後端皆統一採用 OTLP 線路傳輸格式。你的業務程式碼完全無需改動。

### 跨 MCP 追蹤脈絡傳播

當 MCP 用戶端呼叫伺服器時，必須將 W3C 的 traceparent 標頭注入請求中。Streamable HTTP 傳輸層原生支援標準 HTTP 標頭。而在 stdio 傳輸模式下，由於缺乏原生 HTTP 標頭支援，規範的 2026 發展藍圖規劃在 JSON-RPC 呼叫中新增 `_meta.traceparent` 欄位。

在該規格正式定案前：最佳實務是在每個請求的 `_meta` 字典中手動注入 traceparent。伺服器隨後在本地日誌中印出該 trace ID 進行關聯。

### 觀測指標（Metrics）

除了 spans 之外，GenAI 語意約定亦定義了配套的效能指標：

- `gen_ai.client.token.usage` ——直方圖（Histogram）。
- `gen_ai.client.operation.duration` ——直方圖。
- `gen_ai.tool.execution.duration` ——直方圖。

當儀表板僅需掌握全域趨勢而無需單次呼叫的深入細節時，應優先使用這些指標。

### AgentOps 整合層

AgentOps（創立於 2024 年）專注於 GenAI 領域的可觀測性。它封裝了主流框架（LangGraph、Pydantic AI、CrewAI），能自動為其注入 OTel spans。若你的技術堆疊剛好使用受支援的框架，接入極為便捷；否則應採用手動埋點方式。

```figure
t3-span-waterfall
```

## Use It｜實際應用

`code/main.py` 模擬了一個完整的 agent 流程：呼叫一次 LLM、轉發兩個工具，並發起一次 MCP 遠端往返，隨後將 OTel 格式的 spans 以標準 OTLP-JSON 形式印出至標準輸出。無需啟動外部匯出器——本課重點在於掌握 span 結構與屬性設定。你可以直接將輸出文字貼入相容 OTLP 的視覺化檢視工具中，亦可直接閱讀。

核心觀察重點：

- 所有關聯的 spans 共享同一個全域 trace ID。
- 父子階層鏈路透過 `parentSpanId` 嚴格編碼。
- 必填的 `gen_ai.*` 語意屬性皆正確填入。
- 內容文字擷取預設為關閉；並示範如何透過環境變數啟用。

## Ship It｜交付成果

本課產出 `outputs/skill-otel-genai-instrumentation.md`。給定任何 agent 專案程式碼庫，該技能可自動產出完整的可觀測性埋點計畫：明確標註應在何處新增 spans、應填充哪些標準屬性，以及推薦接入的目標匯出器。

## Exercises｜練習

1. 運行 `code/main.py`。計算產生的總 span 數量，並逐一分辨哪些屬於 CLIENT、哪些屬於 INTERNAL。

2. 透過設定環境變數開啟內容擷取功能，確認 `gen_ai.content.prompt` 與 `gen_ai.content.completion` 事件是否順利出現。深入思考這對個人隱私資料（PII）防護帶來的潛在衝擊。

3. 新增工具執行指標 `gen_ai.tool.execution.duration`，並在每次工具調用時將其實作為直方圖取樣樣本對外發送。

4. 將父層 agent span 的 traceparent 注入 MCP 請求的 `_meta.traceparent` 欄位中。驗證 MCP 伺服器端能否讀取並輸出完全一致的 trace ID。

5. 研讀 OTel GenAI 語意約定官方規範。找出規範中列出但本課程式碼尚未發射的一項屬性，並動手為其補齊埋點。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|---------|-------------|
| OTel | 「OpenTelemetry」 | 涵蓋追蹤、指標與日誌的開源可觀測性標準 |
| GenAI semconv | 「GenAI 語意約定」 | 針對 LLM、工具與 agent span 定義的業界通用屬性規範 |
| `gen_ai.*` | 「屬性命名空間」 | 所有 GenAI 專屬屬性共享的標準前綴 |
| Span | 「單次耗時操作」 | 包含開始時間、結束時間與鍵值屬性的最小工作單元 |
| Trace | 「跨 span 呼叫鏈」 | 共享相同 trace ID 的樹狀 span 階層體系 |
| SpanKind | 「CLIENT / SERVER / INTERNAL」 | 標註 span 邊界方向性的類型列舉 |
| OTLP | 「OpenTelemetry 傳輸協定」 | 面向各大匯出器後端的標準線路傳輸格式 |
| Opt-in content | 「選擇性內容擷取」 | 對話原始內容預設不記錄，需顯式傳入環境變數開啟 |
| traceparent | 「W3C 追蹤標頭」 | 負責跨分散式服務邊界傳播 trace 脈絡的標準標頭 |
| Exporter | 「專屬後端發送器」 | 負責將本地 spans 傳輸至 Jaeger、Datadog 等後端的元件 |

## Further Reading｜延伸閱讀

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) ——GenAI spans、metrics 與 events 的權威語意規範
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) ——LLM 與工具執行 span 的完整屬性清單
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) ——agent 層級 `invoke_agent` span 規範
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) ——GitHub 官方維護的權威原始定義來源
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) ——正式環境實戰整合指引
