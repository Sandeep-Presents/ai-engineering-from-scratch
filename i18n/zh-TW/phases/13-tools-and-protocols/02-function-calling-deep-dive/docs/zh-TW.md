# 函式呼叫深度剖析——OpenAI、Anthropic 與 Gemini（Function Calling Deep Dive — OpenAI, Anthropic, Gemini）

> 三大前沿模型提供商在 2024 年殊途同歸地收斂至相同的工具呼叫核心迴圈，卻在所有實作細節上分道揚鑣。OpenAI 採用 `tools` 與 `tool_calls`；Anthropic 採用 `tool_use` 與 `tool_result` 區塊；Gemini 則採用 `functionDeclarations` 與唯一 ID 關聯機制。本課將三大廠商的協定細節並排對比，確保在某一提供商上順利上線的程式碼，在無縫移植到其他平台時絕不翻車。

**Type:** Build
**Languages:** Python (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 精準指認 OpenAI、Anthropic 與 Gemini 在函式呼叫酬載（宣告、呼叫、結果）上的三大形態結構差異。
- 在三大提供商格式之間自由雙向轉譯單一工具宣告，並預測各家嚴格模式（Strict Mode）約束條件的不同之處。
- 靈活運用各平台的 `tool_choice` 參數，實現強制呼叫、禁止呼叫或由模型自主挑選工具。
- 掌握各廠商在正式環境中的硬性配額上限（工具總數、Schema 巢狀深度、引數長度限制），以及踩線違規時各自拋出的典型錯誤代號。

## The Problem｜問題

函式呼叫的請求與回應格式，因提供商不同而存在細微卻致命的差異。來自 2026 年商業正式環境的三個具體實例：

**OpenAI Chat Completions / Responses API**：傳入 `tools: [{type: "function", function: {name, description, parameters, strict}}]`。模型回傳的回應包含 `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`，其中 `arguments` 是一個你必須自行手動解析的字串化 JSON。嚴格模式（`strict: true`）透過語法受限解碼強制確保引數絕對符合 Schema 規範。

**Anthropic Messages API**：傳入 `tools: [{name, description, input_schema}]`。模型回傳的結果封裝為 `content: [{type: "text"}, {type: "tool_use", id, name, input}]`。注意其 `input` 已經由官方 SDK 解析為現成物件（而非未解析的純字串）。你必須以一條全新的 `user` 訊息回覆，內部包裹 `{type: "tool_result", tool_use_id, content}` 專屬區塊。

**Google Gemini API**：傳入 `tools: [{functionDeclarations: [{name, description, parameters}]}]`（深層巢狀於 `functionDeclarations` 清單中）。模型回應包裝於 `candidates[0].content.parts: [{functionCall: {name, args, id}}]` 中，在 Gemini 3 以上版本中此 `id` 具備全域唯一性以支援並行呼叫關聯。你必須回傳 `{functionResponse: {name, id, response}}` 物件。

底層是完全相同的四步迴圈；外表卻是截然不同的欄位名稱、相異的巢狀深度、字串 vs 物件的處理慣例、以及相異的關聯追蹤機制。一個在 OpenAI 上跑通的天氣 Agent，若想移植至 Anthropic 與 Gemini，團隊往往必須為單純的格式適配耗費數天工時。

本課將建構一套標準轉譯器，將這三種異質格式統一抽象為單一標準工具宣告，並在邊緣端實現動態路由適配。Phase 13 · 17 將進一步將此模式升級為工業級 LLM 閘道器。

## The Concept｜核心概念

### 共通的底層核心骨架

無論哪家提供商，皆必然需要五大核心要素：

1. **工具清單（Tool list）**：每個工具的名稱、說明指南以及輸入參數的 JSON Schema。
2. **工具選擇策略（Tool choice）**：強制指定某工具、全面禁用工具、或交由模型自主決策。
3. **呼叫發起（Call emission）**：包含目標工具名稱與實體引數的結構化輸出。
4. **呼叫關聯 ID（Call id）**：將後續回傳的執行成果，精確綁定至對應的發起呼叫上（多工具並行時至關重要）。
5. **成果注入（Result injection）**：以專屬的訊息角色或區塊，將執行成果注入上下文回傳給模型。

### 欄位與結構差異全方位比對

| 比較維度 | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| 宣告外層包裹 | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| 引數結構欄位名 | `parameters` | `input_schema` | `parameters` |
| 回應容器路徑 | 助理訊息中的 `tool_calls[]` | 類型為 `tool_use` 的 `content[]` 內容清單 | `parts[]` 清單中類型為 `functionCall` 的物件 |
| 引數輸出型別 | 字串化 JSON（stringified JSON） | 已解析完成的結構化物件（parsed object） | 已解析完成的結構化物件（parsed object） |
| 呼叫 ID 格式 | `call_...`（OpenAI 端自發生成） | `toolu_...`（Anthropic 專屬前綴） | UUID 格式（自 Gemini 3 起支援） |
| 結果注入區塊 | 角色為 `tool`，欄位為 `tool_call_id` | 角色為 `user`，區塊為 `tool_result`，欄位為 `tool_use_id` | `functionResponse` 物件，帶有相應的 `id` |
| 強制呼叫特定工具 | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| 全面禁用所有工具 | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| 嚴格 Schema 約束 | `strict: true` | 原生即視為契約（始終高度嚴格遵循） | 在請求最外層配置 `responseSchema` |

### 真實正式環境中必撞的硬性上限

- **OpenAI**：單次請求至多宣告 128 個工具。Schema 巢狀深度上限為 5 層。單一引數序列化字串長度 ≤ 8192 位元組。嚴格模式（Strict Mode）嚴格禁用 `$ref`，且不允許屬性相互重疊的 `oneOf`/`anyOf`/`allOf`，且 properties 中定義的每一個欄位皆必須顯式列入 `required` 清單。
- **Anthropic**：單次請求至多宣告 64 個工具。Schema 深度理論上無硬性上限，但實務建議深度 ≤ 10。無顯式的 strict 模式開關；Schema 本身即被視為嚴肅契約，模型遵循率極高。
- **Gemini**：單次請求至多宣告 64 個函式。Schema 型別系統基於 OpenAPI 3.0 子集（與標準 JSON Schema 2020-12 存在細微方言語義差異）。自 Gemini 3 起支援具備唯一 ID 的並行呼叫。

### `tool_choice` 調度行為

各大廠商皆支援三種基本模式（名稱各異）：

- **Auto（自動）**：模型自發決定該直接回答文字還是呼叫工具。預設模式。
- **Required / Any（必選）**：模型被強制要求在當前輪次中，必須至少發起一次工具呼叫。
- **None（禁用）**：強制禁止模型呼叫任何工具，一律輸出純文字。

外加各廠商特有的專屬模式：

- **OpenAI**：允許直接透過名稱強制鎖定單一特定工具。
- **Anthropic**：允許直接透過名稱強制鎖定工具；並透過 `disable_parallel_tool_use` 旗標精確控制單呼叫 vs 多並行呼叫。
- **Gemini**：提供 `mode: "VALIDATED"` 模式，無論模型原始意圖為何，皆將每一次輸出強制通過 Schema 校驗器。

### 多工具並行呼叫

OpenAI 預設開啟 `parallel_tool_calls: true`，會在單一 assistant 訊息中同時發起多個呼叫。你必須並行執行所有工具，並以批次形式回傳多條帶有相應 `tool_call_id` 的 tool 角色訊息。Anthropic 早期僅支援單呼叫；自 Claude 3.5 起預設開啟 `disable_parallel_tool_use: false` 以支援多並行。Gemini 2 雖然允許並行，但未提供穩定的追蹤 ID；Gemini 3 則全面導入標準 UUID，確保異步回傳的結果能精準對齊。

### 串流傳輸模式

三大提供商皆原生支援串流模式下的工具呼叫，但底層協定格式大相逕庭：

- **OpenAI**：以增量碎片（Delta chunks）形式持續吐出 `tool_calls[i].function.arguments`。前端必須逐步累加字串，直至接收到 `finish_reason: "tool_calls"` 標記。
- **Anthropic**：基於事件流（Event-stream）機制，依序發送 Block-start、Block-delta 與 Block-stop 事件。透過 `input_json_delta` 增量事件傳輸局部 JSON 碎片。
- **Gemini**：自 Gemini 3 起引入 `streamFunctionCallArguments` 事件流，每個增量碎片皆標記有 `functionCallId`，即使多個並行呼叫的引數碎片交錯混雜到達，亦能精確重組。

Phase 13 · 03 將深度剖析並行與串流引數的重組還原技術。本課重點聚焦於靜態宣告與單呼叫結構。

### 錯誤回報與容錯修復機制

當傳入無效引數時，各廠商的表現型態截然不同：

- **OpenAI（非嚴格模式）**：模型偶發輸出殘缺的 `arguments: "{bad json}"`，你的 JSON 解析器拋出例外，你必須將錯誤訊息包裝為錯誤提示重新請求模型。
- **OpenAI（嚴格模式）**：校驗發生於模型底層解碼階段；從數學上杜絕了語法錯誤的 JSON，但在模型無法遵循時可能會回傳 `refusal` 拒絕區塊。
- **Anthropic**：輸出的 `input` 可能包含 Schema 之外的未知欄位；其 Schema 偏向建議性質，伺服器端必須自行二次嚴格校驗。
- **Gemini**：受限於 OpenAPI 3.0 的歷史包袱，物件欄位上的 `enum` 列舉值有時會被底層默默忽略，應用層必須手動實施二次防禦校驗。

### 統一轉譯器模式（Translator Pattern）

在自研架構中，標準的通用工具宣告如下（可自由封裝為 Dataclass）：

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

透過三個小巧的純函式，即可將其無損轉換為三大廠商的專屬宣告格式。教學程式碼 `code/main.py` 正是展示了這套模式，並模擬將各家廠商的回應格式逆向解析還原為統一的標準呼叫物件。完全無需發起真實網路連線——本課的核心主旨是精通其幾何結構，而非網路通訊。

在成熟的生產框架中，此轉譯邏輯通常被封裝於 `AbstractToolset`（Pydantic AI）、`UniversalToolNode`（LangGraph）或 `BaseTool`（LlamaIndex）之中。Phase 13 · 17 更將以此為基石，打造相容於 OpenAI 介面規範的通用轉譯閘道器。

```figure
function-call-args
```

## Use It｜實際應用

`code/main.py` 定義了統一的標準 `Tool` 資料類別（Dataclass），並實作了三套轉譯器，分別輸出符合 OpenAI、Anthropic 與 Gemini 規範的宣告 JSON。隨後，它將人工構造的三家廠商典型回應資料，精準逆向解析為同一個標準呼叫物件，雄辯地證明了三者在底層語義上的完全等價性。運行該程式碼，並排檢視三種格式的細微差異。

核心閱讀重點：

- 三大廠商的宣告區塊，本質差異僅在於外層包裹外殼（Envelope）與特定欄位命名。
- 三大廠商的回應區塊，差異在於工具呼叫存放的路徑層級（最外層 `tool_calls` 清單、`content[]` 內容區塊、或 `parts[]` 元素）。
- 單一 `canonical_call()` 核心轉譯函式，能將這三種異質結構毫無破綻地統一解構為標準的 `{id, name, args}`。

## Ship It｜交付成果

本課產出 `outputs/skill-provider-portability-audit.md`。給定針對某一特定廠商撰寫的函式呼叫整合程式碼，該技能將產出一份嚴謹的可移植性審查報告：精確指出該程式碼依賴了哪些特定廠商的特有配額、哪些欄位在移植時需要重新命名，以及當遷移至其他廠商時可能引發的潛在崩潰點。

## Exercises｜練習

1. 運行 `code/main.py`，確認三家提供商的宣告 JSON 皆能精確序列化同一個底層 `Tool` 物件。為標準工具新增一個列舉型別（Enum）引數，並驗證為何僅有 Gemini 轉譯器需要針對 OpenAPI 3.0 的特定相容性進行特殊處理。

2. 為每家提供商實作一個 `ListToolsResponse` 工具列表解析器，用以解析大模型在收到 `list_tools` 或工具探測請求時所回傳的清單。注意：OpenAI 原生並未提供類似的反射探測協定，思考此非對稱性帶來的影響。

3. 實作 `tool_choice` 策略轉譯函式：將標準的 `ToolChoice(mode="force", tool_name="x")` 轉換為三大提供商的對應參數形態。隨後繼續擴充實作 `mode="any"` 與 `mode="none"` 的情境，並對照本課的差異對照表進行核驗。

4. 挑選三大廠商之一，從頭到尾精讀其官方函式呼叫指南。找出其 Schema 規範中存在、但其餘兩家完全不支援的某一專屬欄位（例如 OpenAI 的 `strict`、Anthropic 的 `disable_parallel_tool_use`、Gemini 的 `function_calling_config.allowed_function_names`）。

5. 撰寫一組測試向量：構造一個引數型別故意違反 Schema 宣告的無效工具呼叫。將其傳入各提供商的校驗邏輯中（可借鑑第 01 課的標準函式庫校驗器作為代理），記錄拋出的具體錯誤形態。並據此論證：在商業正式環境中，若追求極致的強型別安全性，你會優先選用哪一家提供商？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Function calling | 「原生工具使用」 | 模型提供商在 API 底層直接支援輸出結構化工具呼叫的原生機制 |
| Tool declaration | 「工具宣告規範」 | 由工具名稱、描述說明以及 JSON Schema 輸入規格構成的宣告酬載 |
| `tool_choice` | 「工具調度策略」 | 控制模型在當前輪次該自動（Auto）、必選（Required）、禁用（None）或強制特定工具的參數 |
| Strict mode | 「強制合法約束模式」 | OpenAI 特有的旗標，透過語法受限解碼強制模型輸出百分之百符合 Schema |
| `tool_use` block | 「Claude 呼叫區塊」 | Anthropic 在內容串流中輸出的專屬區塊，帶有唯一 ID、名稱與解析後的輸入引數 |
| `functionCall` part | 「Gemini 呼叫元件」 | Gemini 在 `parts[]` 串流中吐出的專屬物件，包含名稱、引數與唯一追蹤 ID |
| Arguments-as-string | 「字串化 JSON」 | OpenAI 傳回的引數為未經解析的原始 JSON 字串，而非已解析物件 |
| Parallel tool calls | 「單輪扇出並行呼叫」 | 模型在單一思考輪次中同時輸出多個獨立的工具呼叫物件 |
| Refusal | 「模型安全拒答」 | 在嚴格模式下，模型在無法合法發起呼叫時輸出的具型別拒絕執行區塊 |
| OpenAPI 3.0 subset | 「Gemini 方言語法」 | Gemini 在參數校驗上採用的類 JSON Schema 方言，在特定進階關鍵字上存在細微語義差異 |

## Further Reading｜延伸閱讀

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) ——包含嚴格模式與並行呼叫在內的 OpenAI 官方標準手冊
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) ——Claude 體系的 `tool_use` 與 `tool_result` 區塊語義規範
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) ——Gemini 並行呼叫、唯一 ID 與 OpenAPI 子集官方手冊
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) ——Gemini 在企業級 Google Cloud 上的介面參考
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) ——嚴格模式語法受限解碼的底層實現細節
