# OpenTelemetry GenAI 語意約定

> OpenTelemetry 的 GenAI 特殊興趣小組（SIG，於 2024 年 4 月成立）定義了 Agent 可觀測性遙測資料的標準 Schema。Span 名稱、屬性鍵值與內容擷取規則在各廠商間達成統一收斂，使同一份 Agent 追蹤鏈在 Datadog、Grafana、Jaeger 與 Honeycomb 中具備完全相同的標準語義。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 掌握 GenAI Span 的三大分類體系：模型／用戶端 Span、Agent Span、工具 Span。
- 嚴格區分 `invoke_agent` 的 CLIENT 跨網路邊界類型與 INTERNAL 行程內部類型，並明確其適用時機。
- 列舉頂層的核心 GenAI 標準屬性：供應商名稱、請求模型名稱、資料來源 ID。
- 深入闡述內容擷取契約（Content-capture contract）：選擇性開啟（Opt-in）、`OTEL_SEMCONV_STABILITY_OPT_IN` 設定，以及外部引用儲存最佳實踐。

## The Problem｜問題

每家廠商過去各自發明私有的 Span 名稱。維運團隊被迫為每個上層框架分別搭建專屬儀表板。OpenTelemetry 的 GenAI 特殊興趣小組（SIG）終結了此混亂局面，為整個可觀測性生態樹立了單一開放的通用技術標準。

## The Concept｜核心概念

### Span 三大分類體系

1. **模型／用戶端 Span（Model / client spans）**：涵蓋對大模型的原始 API 呼叫。由模型供應商 SDK（Anthropic、OpenAI、Bedrock）或框架的模型轉接層負責發射。
2. **Agent Span**：包含 `create_agent`（Agent 建構初始化）與 `invoke_agent`（實體調用執行）。
3. **工具 Span（Tool spans）**：每次工具實體調用獨立發射一個 Span；透過父子層級關係清晰掛載於所屬的 Agent Span 之下。

### Agent Span 命名標準

- Span 名稱：若具備明確名稱則命名為 `invoke_agent {gen_ai.agent.name}`；若無則保底命名為 `invoke_agent`。
- Span 類型（Span Kind）：
  - **CLIENT**：用於存取遠端託管的 Agent 服務（例如 OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL**：用於在同一本機行程內運行的 Agent 框架（例如 LangChain、CrewAI、本地 ReAct 迴圈）。

### 核心標準屬性

- `gen_ai.provider.name`：模型供應商名稱，如 `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model`：請求的大模型 ID。
- `gen_ai.response.model`：實際提供服務的大模型 ID（由於存在路由分流，可能與請求模型不同）。
- `gen_ai.agent.name`：Agent 識別碼。
- `gen_ai.operation.name`：操作名稱，如 `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id`：專用於 RAG 檢索——標註檢索存取了哪個實體資料庫或語料庫。

此外，針對 Anthropic、Azure AI Inference、AWS Bedrock 與 OpenAI，規範亦定義了各供應商專屬的特化約定。

### 內容擷取策略（Content Capture）

核心預設原則：**埋點程式庫在預設情況下絕不應當擷取輸入或輸出對話文字！**文字內容擷取必須採自主選擇性開啟（Opt-in）：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

正式環境推薦架構：將原始對話內容安全存放在外部儲存庫（如 S3 或內部日誌庫），而在 Spans 內部僅記錄指標參照（存取 ID，而非散文文字）。這正是將第 27 課所講述的防範記憶投毒機制深度整合進可觀測性體系的具體實踐。

### 規範穩定性（Stability）

截至 2026 年 3 月，絕大多數語意約定仍處於實驗性階段。透過配置以下環境變數，顯式啟用穩定預覽版：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 原生將這些 GenAI 屬性映射進其專屬的 LLM Observability 儀表板中。其他開源後端（Grafana、Honeycomb、Jaeger）則直接支援原生檢視這些屬性。

### 典型架構失效模式

- **在 Spans 中無節制記錄完整 Prompt 文字**：導致 PII 隱私資料、機密金鑰與客戶機密被直接暴露給全體維運人員。解法：強制實施外部儲存。
- **遺漏 `gen_ai.provider.name`**：在多供應商混合架構中，因缺少歸因標註導致成本與延遲分析報表徹底失效。
- **Span 遺失父子關聯邊**：產生了大量孤兒工具 Spans。必須確保脈絡嚴格向下傳播。
- **未設定穩定性 Opt-in 旗標**：在後端升級時，未固化的屬性名稱被自動變更導致既有監控報警失效。

```figure
ae-genai-span-tree
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套符合 GenAI 語意約定的 Span 發射器：

- 封裝 GenAI 標準屬性 Schema 的 `Span`；
- 支援 `start_span` 與巢狀脈絡管理的 `Tracer`；
- 一次完整的 Agent 運行模擬，依序發射：`create_agent`、`invoke_agent`（INTERNAL 類型）、逐工具 Span，以及 LLM 呼叫的 `chat` Span；
- 演示將 Prompt 儲存於外部安全儲存、並在 Span 中僅記錄 ID 參照的內容擷取模式。

運行實驗：

```
python3 code/main.py
```

輸出會展示完整的 Span 呼叫樹（包含所有必備的 GenAI 屬性），以及模擬外部儲存如何妥善保留選擇性開啟的內容指標。

## Use It｜實際應用

- **Datadog LLM Observability**（v1.37+）：原生深度映射該規範屬性。
- **Langfuse / Phoenix / Opik**（第 24 課）：為現代 Agent 生態提供自動化埋點。
- **Jaeger / Honeycomb / Grafana Tempo**：接收原始 OTel Spans，基於 GenAI 屬性自建專業儀表板。
- **企業私有部署**：在內部運行配備 GenAI 專用處理器的 OTel Collector。

## Ship It｜交付成果

`outputs/skill-otel-genai.md` 能為現有 Agent 快速注入合規的 OTel GenAI Spans，內建預設脫敏保護與外部指標引用儲存機制。

## Exercises｜練習

1. 為第 01 課的 ReAct 迴圈注入 `invoke_agent`（INTERNAL 類型）與逐工具 Spans，並將其發送至本地 Jaeger 實例。
2. 實作「僅記錄指標參照」的內容擷取模式：將 Prompt 寫入 SQLite，而在 Span 屬性中僅保留該資料列的唯一 ID。
3. 研讀規範中關於 `gen_ai.data_source.id` 的定義，並將其無縫接入第 09 課的 Mem0 混合檢索中。
4. 設定 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，驗證你的屬性名稱在通過 Collector 時不會被意外重新命名。
5. 打造一個監控看板：單純依賴 GenAI 屬性，分析「特定工具呼叫錯誤究竟與哪款特定大模型高度相關」。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| GenAI SIG | 「OTel 生成式 AI 工作組」 | 負責制定 Agent 與 LLM 遙測資料標準 Schema 的 OTel 工作小組 |
| invoke_agent | 「Agent 執行 Span」 | 代表 Agent 實體運行過程的標準根 Span 名稱 |
| CLIENT span | 「遠端服務呼叫」 | 標註呼叫遠端雲端代管 Agent 服務時所發射的 Span 類型 |
| INTERNAL span | 「本機行程內部調用」 | 標註在本機行程內部運行之開源 Agent 框架時所發射的 Span 類型 |
| gen_ai.provider.name | 「模型供應商標籤」 | 標準鍵名，標註 anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | 「RAG 資料來源 ID」 | 標註檢索操作究竟命中存取了哪個實體語料庫或資料庫 |
| Content capture | 「Prompt 對話記錄」 | 對話內容的選擇性擷取；正式環境推薦採用外部儲存並留存 ID 參照 |
| Stability opt-in | 「穩定性預覽旗標」 | 用於鎖定實驗性約定名稱、防範後端升級名稱漂移的環境變數 |

## Further Reading｜延伸閱讀

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) ——官方語意約定技術規範
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) ——預設發射 GenAI Spans 的官方實踐
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) ——原生內建 OTel Spans 的微軟架構解析
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) ——W3C 分散式追蹤脈絡透明傳播指南
