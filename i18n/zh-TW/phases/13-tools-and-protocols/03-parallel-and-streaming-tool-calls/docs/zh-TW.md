# 多工具並行呼叫與串流工具呼叫（Parallel Tool Calls and Streaming with Tools）

> 三個互相獨立的天氣查詢若依序串列執行，需要耗費整整三輪往返。若改為並行發起，端到端總耗時將驟降至取決於最慢的那一次單一呼叫。如今每一家前沿提供商皆原生支援在單一輪次中同時輸出多個工具呼叫。效能紅利顯而易見；底層管線實作卻暗藏玄機。本課將深入拆解兩大關鍵環節：並行扇出執行（Parallel Fan-Out）與串流引數重組拼裝，重點突破最容易踩坑的 ID 關聯陷阱。

**Type:** Build
**Languages:** Python (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 解釋為何各大平台皆支援 `parallel_tool_calls: true`，並明確指出在何種業務約束下必須主動將其停用。
- 在多工具並行扇出期間，將網路封包中交錯到達的串流引數碎片，精準關聯至各自對應的工具呼叫 ID。
- 安全重組局部的 `arguments` 字串為完整合法的 JSON，杜絕「過早解析（Parse-early）」引發的例外崩潰。
- 運行三座城市天氣查詢的實測基準，直觀量化串列循序 vs 並行發起的實際延遲差距。

## The Problem｜問題

若不支援並行呼叫，當使用者詢問「班加羅爾、東京與蘇黎世現在天氣如何」時，Agent 必須痛苦地串列等待：

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

整整三次 LLM 來回往返，且每次皆需額外疊加執行器的實體網路延遲。端到端總耗時大約是理想狀態下的 4 倍。

而在並行呼叫機制下：

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

僅需一次 LLM 往返。執行器的總耗時取決於三者中的最大值（Max），而非三者總和（Sum）。在 OpenAI、Anthropic 與 Gemini 上的實測結果表明，在扇出型工作負載下，端到端牆上時鐘耗時（Wall-clock Time）可大幅縮減 60% 至 70%。

其代價是關聯機制的複雜性。當三個呼叫在執行器端由於耗時不同而發生「亂序完成」時，回傳的結果必須嚴格帶有相應的 `tool_call_id`，模型方能將答案正確對號入座。而在串流傳輸模式下，你更必須在記憶體中妥善暫存並拼裝局部的引數碎片，確保在整段 JSON 完全接收前絕不冒進解析。Gemini 3 專門導入全域唯一 UUID，正是為了解決過去同一輪中兩次呼叫同名函式時無法區分的歷史缺陷。

## The Concept｜核心概念

### 啟用並行呼叫機制

- **OpenAI**：預設啟用 `parallel_tool_calls: true`。若需強制串列循序執行，可設為 `false`。
- **Anthropic**：透過 `disable_parallel_tool_use: false` 支援並行（自 Claude 3.5 起為預設值）。若需串列執行，設為 `true`。
- **Gemini**：原生具備並行能力；設定 `tool_config.function_calling_config.mode = "AUTO"` 即可交由模型自主決定是否並行。

必須主動關閉並行的情境：當工具之間存在強烈的時序依賴時（如先執行 `create_file` 再執行 `write_file`）、當後一個呼叫的輸入依賴前一個呼叫的輸出時，或是當下游第三方 API 的頻率限制（Rate Limit）無法承受高並發衝擊時。

### ID 關聯追蹤機制

模型發起的每一個呼叫皆具備唯一的 `id`。宿主在回傳結果時，必須原封不動地附帶相同的 ID。否則多個結果將陷入語義歧義。

- **OpenAI**：在每條 tool 角色訊息中顯式指定 `tool_call_id`。
- **Anthropic**：在每個 `tool_result` 區塊中指定 `tool_use_id`。
- **Gemini**：在每個 `functionResponse` 物件中指定 `id`（自 Gemini 3 起支援；Gemini 2 僅依名稱匹配，在同名並行呼叫時會引發混淆）。

### 真正並行執行呼叫

宿主環境通常在獨立的執行緒、非同步協程（Coroutine）或遠端背景工作行程（Worker）中並行驅動各個呼叫的執行器。最簡單的封裝是使用執行緒池（Thread Pool）；正式環境則普遍採用基於 asyncio 的 `asyncio.gather` 或結構化並行機制。各任務完成的先後順序往往不可預期——而 ID 正是重新串接因果關係的唯一錨點。

常見的工程 Bug：強制按照呼叫清單的原始先後順序回傳結果，而非按照實際完成的先後順序。雖然多數模型能依據 `tool_call_id` 自動重組，但一旦某個呼叫遭遇異常遺失或重試，人為強加的順序會大幅增加除錯難度。推薦一律以帶有明確 ID 的實際完成順序回傳結果。

### 串流工具呼叫的接收與累積

當模型以串流模式輸出時，`arguments` 引數會以碎片形式分批到達。若單一輪次中同時發起了三個並行呼叫，這三條引數串流在網路上是交錯混雜傳輸的。此時必須為每個呼叫 ID 在記憶體中維護獨立的累加器（Accumulator）。

各廠商的串流細節：

- **OpenAI**：每個碎片為 `choices[0].delta.tool_calls[i].function.arguments`（局部字串片段）。碎片中標註有 `index`（在當前呼叫清單中的位置）。你必須依 index 進行累加，在 `id` 首次出現時記錄它，並在收到 `finish_reason = "tool_calls"` 結束標記時才正式解析 JSON。
- **Anthropic**：事件流標準為先收到 `message_start`，隨後為每個區塊觸發帶有類型 `tool_use` 的 `content_block_start`（包含 id 與名稱）。隨後由 `content_block_delta` 事件持續攜帶 `input_json_delta` 碎片，最後由 `content_block_stop` 宣告區塊封頂。
- **Gemini**：自 Gemini 3 起引入 `streamFunctionCallArguments` 事件，每個碎片皆自帶 `functionCallId`，確保多個並行呼叫的引數碎片即使交錯到達也能精準還原。在 Gemini 3 之前，串流模式只能單次輸出一個完整呼叫。

### 局部不完整 JSON 與提前解析陷阱

在 `arguments` 引數完全傳輸完畢之前，絕對不可貿然嘗試解析。類似 `{"city": "Beng` 這樣的殘缺片段不是合法 JSON，強行解析必然拋出語法例外。唯一可靠的門控標記是廠商給出的「呼叫完成」事件：OpenAI 的 `finish_reason = "tool_calls"`、Anthropic 的 `content_block_stop`、或 Gemini 的串流結束事件。只有在收到該訊號後，方可發起 `json.loads`。更進階的做法是引入增量 JSON 解析器（Incremental JSON Parser），在結構逐步補齊時即時觸發下游事件；OpenAI 官方指南推薦此做法以在前端呈現即時的「思考中」視覺動畫。切勿依賴簡單的括號計數來判定完整性（字串內部包含大括號或跳脫符號時極易引發誤判），括號計數至多只能作為非正式的內部除錯啟發式參考。

### 亂序完成時的處理協定

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

宿主回傳的批次結果必須忠實附帶對應的呼叫 ID：

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

在 OpenAI 與 Anthropic 協定中，回傳訊息陣列內部的物理排列順序完全不影響正確性。Gemini 亦然，只要各項目帶有的 ID 與原始呼叫精確吻合即可。

### 效能實測：串列 vs 並行

教學程式碼 `code/main.py` 模擬了耗時分別為 400、600 與 800 毫秒的三個執行器。串列循序執行總耗時高達 1800 毫秒；而並行執行總耗時僅為 max(400, 600, 800) = 800 毫秒。效能提升是階躍性的，工具數量越多，省下的時間越驚人。

正式環境的現實警訊：並行呼叫會瞬間對下游 API 造成陡增的並發壓力。若一口氣向一個有速率限制的下游服務發起 10 路並行扇出，極可能引發大量的 429 錯誤。Phase 13 · 17 將專門探討閘道器層級的背壓（Backpressure）與流控機制。

### 串流扇出下的極限實時時鐘耗時

若大模型本體以串流模式輸出，更極致的工程最佳化是：一旦某一個呼叫的引數宣告完全閉合，便不必等待其他呼叫收尾，立刻在後台搶先啟動該呼叫的實體執行器。這是 OpenAI 官方文檔推薦的極限效能設計。本課的教學程式碼便實作了這項技術：只要模擬串流產出了某個呼叫的完整引數，宿主便立刻並行發起該呼叫。

```figure
tp-parallel-fanout
```

## Use It｜實際應用

`code/main.py` 包含兩大核心部分。前半部分利用 `concurrent.futures.ThreadPoolExecutor` 對比三個模擬天氣呼叫在「串列」與「並行」下的端到端耗時差距。後半部分則模擬了一條真實的串流回應——三個並行呼叫的 `arguments` 引數碎片交錯混雜抵達，利用 `StreamAccumulator` 類別依據 ID 進行即時分離累加與安全重組。無依賴外部大模型、無網路請求，純粹以標準函式庫精準展示重組拼裝機制。

核心閱讀重點：

- 串列計時器顯示耗時約 1.8 秒，而並行計時器在相同的模擬延遲下精確壓低至 0.8 秒。
- 累加器能穩健應對交錯混雜抵達的引數碎片，依 ID 分流緩衝，且僅在收到完整 JSON 時才觸發解析。
- 執行器在單個 ID 的引數完成閉合時立刻搶先啟動，完全無需等待全體串流徹底結束。

## Ship It｜交付成果

本課產出 `outputs/skill-parallel-call-safety-check.md`。給定一份工具註冊表清單，該技能將全面審查各工具是否具備並行安全性、是否存在隱式前後依賴、是否可能擊穿下游 API 的頻率限制——並輸出一份標註有每項工具 `parallel_safe` 旗標的安全調度加固版註冊表。

## Exercises｜練習

1. 運行 `code/main.py` 並自由調整各模擬工具的耗時數值。驗證並行與串列的理論耗時比例是否高度吻合 `max/sum`（在真實執行中，受限於執行緒調度、序列化開銷與執行期環境負擔，數值會略微偏離理想值）。在何種極端的延遲分佈下，並行呼叫帶來的收益會變得微不足道？

2. 擴充累加器以處理「串流中途遭遇取消」的異常情境：丟棄對應 ID 的緩衝區並拋出 `cancelled` 事件。深入比對 Anthropic 的 `content_block_stop` 語義與 OpenAI 遇到 `finish_reason: "length"` 時的具體邊界行為。

3. 將教學程式碼中的執行緒池改寫為基於 `asyncio.gather` 的非同步實作。對比兩者的性能差異，並解釋為何只有在執行器涉及真正的非同步 I/O 時，async 才能展現出相較於多執行緒的微幅優勢。

4. 挑選兩款絕不能並行發起的工具（例如先執行 `create_file` 再執行 `write_file`）。在工具註冊表中加入 `ordering_dependency` 相依性圖譜定義，並在並行扇出調度器中加入相依性防護閘門。這正是後續 Agent 工程學中依賴感知排程的最小核心原型。

5. 精讀 OpenAI 的並行函式呼叫手冊與 Anthropic 的 `disable_parallel_tool_use` 文檔。指出 Anthropic 官方強烈建議關閉並行呼叫的一種典型真實場景（提示：針對同一外部資源進行連續的破壞性寫入操作）。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Parallel tool calls | 「單輪多工具並行」 | 大模型在單一輪次的 assistant 訊息中同時發起多個獨立的工具呼叫 |
| `parallel_tool_calls` | 「OpenAI 並行旗標」 | 控制模型在當前請求中是否允許同時輸出多個呼叫的布林開關 |
| `disable_parallel_tool_use` | 「Anthropic 逆向旗標」 | Anthropic 採用的反向排除旗標；預設為允許並行，設為 true 則強制串列 |
| Tool call id | 「呼叫關聯憑據」 | 賦予每個工具呼叫的唯一 ID，回傳結果訊息必須原樣附帶此 ID 方能關聯 |
| Accumulator | 「串流分流累加器」 | 依呼叫 ID 分流建立的字串緩衝區，專門在記憶體中拼接長片段的局部 `arguments` 碎片 |
| Out-of-order completion | 「非同步亂序完成」 | 並行發起的各工具由於網路與運算耗時不同，其執行結束的順序往往不可預期 |
| Dependency graph | 「時序依賴圖」 | 明確標註某些工具的輸入強依賴其他工具輸出的約束結構；存在依賴時嚴禁並行 |
| Parse-early trap | 「過早解析語法炸彈」 | 在串流 `arguments` 引數尚未完全接收閉合前貿然嘗試解析 JSON 所引發的語法錯誤崩潰 |
| `streamFunctionCallArguments` | 「Gemini 3 串流新特性」 | 允許交錯傳輸帶有唯一呼叫 ID 的引數碎片，使多工具並行串流能夠精準還原 |
| Completion-order reply | 「完成即回傳原則」 | 以工具實際執行完畢的先後順序組裝回傳負載，並依賴 ID 精確綁定 |

## Further Reading｜延伸閱讀

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) ——OpenAI 並行呼叫標準指南與開關參數規範
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) ——`disable_parallel_tool_use` 旗標與多結果批次注入機制
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) ——Gemini 3 基於 UUID 的並行呼叫官方手冊
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) ——針對串流工具呼叫的增量碎片重組官方實作指南
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) ——`content_block_delta` 與 `input_json_delta` 串流事件流生命週期手冊
