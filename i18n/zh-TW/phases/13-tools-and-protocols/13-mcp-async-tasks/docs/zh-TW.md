# MCP Tasks 擴充功能：無狀態核心上的持久化非同步任務（MCP Tasks Extension: Durable Work on a Stateless Core）

> 無狀態的 MCP 絕不意味著每一項操作都必須在單一請求中草草結束。官方的 Tasks 擴充功能為耗時長程的非同步工作，賦予了顯式且持久化的唯一識別碼（Handle）。伺服器能在 `tools/call` 中直接回傳該識別碼，叢集中的任何實例皆能獨立回應 `tasks/get`，而用戶端補充的輸入資料則透過 `tasks/update` 傳遞，全程無需復活任何協定層級的連線階段。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 嚴格辨析無狀態協定傳輸層，與業務應用層持久化任務狀態之間的清晰界線。
- 在逐請求的用戶端能力宣告與 `server/discover` 服務發現中，標準協商 `io.modelcontextprotocol/tasks` 擴充功能。
- 在確保資料已成功持久化寫入後，向外回傳標註有 `resultType: "task"` 的伺服器主導 `CreateTaskResult`。
- 透過 `tasks/get` 輪詢最新狀態、透過 `tasks/update` 滿足中間輸入需求，並透過 `tasks/cancel` 發起協同式取消。
- 徹底移除過時的 `tasks/status`、`tasks/result` 與 `tasks/list` 歷史殘留假設。
- 透過長回應 POST SSE 串流上的 `subscriptions/listen`，安全訂閱選用的任務即時狀態變更通知。
- 正確建模任務過期銷毀、重啟恢復、輸入鍵值去重與非同步執行錯誤的容錯語義。

## Why Tasks Are an Extension｜為何 Tasks 被設計為獨立擴充功能

Tasks 最早以實驗性核心特性的姿態出現在 2025-11-25 規範中。2026 年 7 月的架構大重構將其正式移出核心，轉為官方標準的 `io.modelcontextprotocol/tasks` 擴充功能，使需要長程任務的用戶端與伺服器能按需引入，而不至於使全生態所有輕量實作者皆被迫承擔複雜的狀態管理負擔。

該擴充功能規範目前處於官方草案階段，但它已是管理非同步長程任務的唯一標準歸宿。請務必鎖定 SDK 支援的具體擴充版本、嚴格通過一致性整合測試，並將底層傳輸轉接層與業務工作行程及持久化儲存層進行實體解耦隔離。

在以下業務情境下，果斷引入 Tasks 機制：

- 該操作在耗時上極可能超出一般的 HTTP 請求逾時門檻；
- 該工作本質上已由背景佇列或外部工作排程系統非同步驅動；
- 用戶端需要具備在自身意外重啟後，依然能夠重新連線並接續追蹤的能力；
- 操作在執行中途，需要主動暫停以等待人類使用者或大模型提供補充輸入；
- 任務取消與持久化結果隨時檢索，屬於產品的硬性業務需求。

面對廉價、快速且確定性的常規查詢，絕不要濫用 Tasks。派發識別碼、持久化寫入、輪詢開銷、過期清理與取消機制皆代表實質的系統複雜度。

## Stateless Core, Stateful Application｜無狀態協定核心 vs 有狀態業務應用

MCP 2026-07-28 規範徹底移除了 `initialize`、`notifications/initialized`、協定連線階段以及 `Mcp-Session-Id`。這完全不限制應用程式自身維護有狀態的業務實體。

一個任務 ID（taskId）是純粹顯式的業務層狀態：

- 伺服器在向外派發該 ID 之前，已將其持久化寫入底層儲存；
- 用戶端能在本機保存該 ID，並在用戶端重啟後重新發起輪詢；
- 該 ID 能夠被負載平衡器任意分發至任何掛載同一共享儲存的健康伺服器複本；
- 每一次調用任務方法時，皆會重新實施嚴格的主體權限校驗；
- 任務的過期銷毀與保留期限由業務欄位決定，而非由實體網路連線的壽命決定。

這與暗中綁定在某一條 TCP 連線上的黑箱連線階段狀態，在架構維運上有著本質的雲泥之別。

請嚴格劃分四種不同的生命週期：

| 狀態層級 | 生命週期範疇 | 物理歸屬位置 |
|---|---|---|
| 協定後設資料 | 單一獨立請求 | 封裝於 `params._meta` 中，每次呼叫皆重新獨立校驗 |
| 傳輸層任務 | 單一 stdio 請求或 HTTP 回應 | 具備硬性逾時邊界的記憶體並發協調器 |
| MRTR 延續狀態 | 單一多輪重試序列 | 具備防篡改簽名的 `requestState`，必要時掛載防重放儲存 |
| 持久化任務實體 | 跨請求、跨節點複本、跨行程重啟與斷線重連 | 由具備鑑權校驗的 `taskId` 定址的後端共享資料庫 |

將任務實體僅僅保存在某個伺服器行程的記憶體中，絕不等於「實現了有狀態的 MCP」，它只會讓系統變得極度脆弱不可靠。協定本身維持無狀態，但後續轉發至其他節點的 `tasks/get` 請求，必須能夠在共享儲存庫中精確還原這筆紀錄。在派發識別碼之前先行完成持久化寫入，並在每一次呼叫時嚴格覆核租戶與主體權限。

## Capability Negotiation｜能力宣告與協商

用戶端必須在每一次涉及 Tasks 的合法請求中宣告能力支援：

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

伺服器在 `server/discover` 回傳成果中宣告精確的 `supportedVersions`、能力聲明、`ttlMs` 與 `cacheScope`，並在 capabilities.extensions 下聲明對應的 Tasks 擴充支援。由於宣告了工具支援，伺服器亦必須實作必備的 `tools/list`。其回傳的 `generate_report` 描述資訊中，必須包含合法的物件型別 `inputSchema`、`resultType: "complete"`、伺服器識別資訊後設資料，以及公開的快取建議。

若未宣告擴充支援的用戶端調用了任務方法，伺服器必須拋出 `-32021`（缺少必備用戶端能力），並將 `data.requiredCapabilities` 明確設定為 `{"extensions":{"io.modelcontextprotocol/tasks":{}}}`。協定版本不支援回傳 `-32022` 搭配精準的 `supported` 與 `requested` 資料；版本缺漏回傳 `-32602`。

不帶 JSON-RPC `id` 的信封代表單向通知。接收端可以處理它，但絕不回傳任何回應。在 Streamable HTTP 傳輸層上，接收合法的單向通知時回傳空內文的 `202 Accepted`。

目前規範下，僅有 `tools/call` 支援以非同步任務模式執行。請在架構設計上保留擴展彈性，避免日後擴充新方法時被迫推翻儲存模型。

## Server-Directed Task Creation｜伺服器主導的任務建立機制

舊版中由用戶端強行指定的標記 `params._meta.task.required` 已被正式廢棄。現代標準流程為：用戶端宣告自己支援 Tasks 擴充功能，隨後由伺服器在處理特定的 `tools/call` 時，自發裁決是否將其轉化為長程非同步任務。

請求：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

回應：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

伺服器在 `tasks/get` 能夠成功解析該 ID 之前，**絕不可**提前向用戶端交出此識別碼。在最終一致性儲存中，必須等待寫入落盤確認後方可發送回應。否則用戶端一拿到 ID 立刻發起輪詢，便會直接撞上「任務不存在」的尷尬空窗。

這是一次回應層面由伺服器主導的升級，但它絕非未經協商的突襲：因為當前請求本身就已白紙黑字聲明了對擴充功能的相容支援。

## The Task Shape｜標準任務資料結構

每一個任務實體皆必須完整包含以下核心欄位：

- `taskId`：伺服器生成的穩定唯一字串識別碼；
- `status`：`working`、`input_required`、`completed`、`cancelled` 或 `failed`；
- `createdAt` 與 `lastUpdatedAt`：標準 ISO 8601 時間戳記；
- `ttlMs`：自建立起算的過期銷毀毫秒數，設為 `null` 則代表無預設上限；
- 選填的 `pollIntervalMs`：伺服器向呼叫端建議的最小輪詢間隔；
- 選填的 `statusMessage`：面向人類或大模型的即時進度說明。

特定狀態下的專屬欄位：

- `input_required` 狀態下必須附帶 `inputRequests` 待辦輸入請求；
- `completed` 狀態下必須內聯原始調用的終態 `result` 物件；
- `failed` 狀態下必須內聯標準的 JSON-RPC `error` 錯誤物件。

用戶端應當自覺恪守 `pollIntervalMs` 建議頻率。伺服器有權對過於激進的高頻輪詢實施限流，並可在任務推進過程中動態調整該建議間隔。

## Poll with `tasks/get`｜狀態輪詢機制

用戶端發送請求查詢任務當前的最新快照：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

由於 `tasks/get` 本身這次 RPC 調用已經圓滿執行結束，因此其最外層的回應始終標註 `resultType: "complete"`！而內部巢狀包裹的任務實體，其自身的狀態則依然可以是 `status: "working"` 或 `status: "input_required"`。

明確區分這兩個層級，能有效杜絕常見的解析器邏輯錯誤：

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

協定中**完全不存在** `tasks/result` 介面。當任務最終順利完成時，下一次 `tasks/get` 回應會直接在內部的 `result` 欄位中，內聯納入原始工具調用的完整 `CallToolResult` 成果：

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

外層的 `resultType` 表明 `tasks/get` 查詢呼叫結束；內層的 `result.resultType` 則表明最初的實體工具操作已順利交付成果。內層鑑別欄位為必填項。內聯的 `CallToolResult` 亦應攜帶專屬的 `io.modelcontextprotocol/serverInfo`。

協定中**完全不存在** `tasks/list` 介面。無狀態的現代伺服器根本無法安全推斷哪些任務理應暴露給某一條特定的實體連線。若業務應用需要查詢歷史紀錄，應當在業務層對外公開具備嚴格租戶隔離與過濾條件的專屬查詢工具。

## Input During Task Execution｜任務執行期間的動態輸入交互

任務執行中途採集輸入，與核心 MRTR 機制外表相似，但續傳機制存在根本差異。

### 任務建立前所需的輸入

在最初的 `tools/call` 中直接回傳核心協定的 `resultType: "input_required"`。用戶端在本機滿足該輸入後，重新調用該原始呼叫。只有在這些同步的前置 MRTR 互動全數完成後，伺服器才正式為其派發長程非同步任務。

### 任務建立後所需的輸入

將任務狀態變更為 `input_required`。用戶端在 `tasks/get` 輪詢中捕獲尚未處理的 `inputRequests`，隨後透過專屬的 `tasks/update` 介面送出解答。用戶端**絕不要**重複調用最初的 `tools/call`。

狀態快照：

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

更新輸入：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

成功更新後，伺服器回傳空物件並標註 `resultType: "complete"` 作為確認。狀態變更在底層可能是最終一致的，用戶端應繼續保持正常的輪詢或監聽。

在任務的整個生命週期內，每一個 `inputRequests` 鍵值（Key）皆必須具備全域唯一性。多次相繼的 `tasks/get` 輪詢可能會反覆看到相同的待辦金鑰；用戶端前端應做好去重展示，伺服器則必須主動忽略對未知、已過期或已處理完畢之金鑰的重複送出。若用戶端僅送出了部分欄位，任務可維持在 `input_required` 狀態，直至所有必備金鑰全數被滿足。

## Cancellation Is Cooperative｜協同式取消機制

`tasks/cancel` 僅代表向後端發出取消意圖信號，並回傳標註為 complete 的確認訊息。**這絕不保證後端工作行程已立刻終止**。實體任務可能在此之前剛好搶先執行完畢、可能在設計上不可中斷，亦可能在延後數秒後才優雅收尾。

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

請特別注意：針對上述所有三個任務方法，HTTP 標頭 `Mcp-Name` 皆必須精確同步對映 `params.taskId` 的數值，而非重複填寫方法名稱！教學程式碼 `code/main.py` 在 `make_http_request` 函式中嚴格落實了該標準規則。

在教學實作中，模擬背景工作行程會即時響應取消，使反覆調用具備冪等性。但在真實生產用戶端中，絕不能僅憑取消確認訊息就武斷推斷任務已經終態取消，必須始終以協同式的心態等待後續狀態確認。

**嚴禁**使用 `notifications/cancelled` 來取消持久化長任務！該通知屬於請求範疇的傳輸中斷，而非針對持久化 Tasks 的協定操作。

兩者的差異在網路邊界層至關重要：請求取消針對的是一次正在傳輸中的非同步 JSON-RPC 操作或 HTTP 回應；若 `tools/call` 已經向外派發了 `resultType: "task"`，該次請求便已徹底宣告終結，此時關閉 TCP 傳輸層既無法定址亦無法終止背景運行的持久化任務。而 `tasks/cancel` 是一次全新的獨立授權 RPC 請求——它攜帶 `params.taskId`、在 `Mcp-Name` 標頭中對映該 ID、精準路由至任務所屬的後端工作節點、登記協同取消意圖，並回傳確認。

因此，API 閘道器必須在底層為「短暫請求協調」與「長程任務路由」分別維護兩張完全隔離的狀態表。請求表在回應傳輸結束後便可銷毀；而任務路由表則必須持久保存至任務達到終態並過期清理為止。[第 29 課：MCP 可靠性、取消與流量控制](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md) 將專題建置包含競爭條件、逾時、冪等防護、背壓控制與重試防護的完整可靠性體系。

## Optional Notifications｜選用的即時事件推播通知

輪詢是無狀態架構的基本盤。若用戶端渴望獲得即時推播，可向伺服器發送攜帶目標任務 ID 的 `subscriptions/listen` 請求。在 Streamable HTTP 規範下，這是一次 POST 請求，其回應轉化為請求範疇的 SSE 串流。此處完全沒有獨立的 GET 事件端點，亦沒有黑箱的協定連線階段需要維護。

伺服器先以 `notifications/subscriptions/acknowledged` 確認接受該訂閱，隨後即可透過 `notifications/tasks` 事件即時推送完整的任務狀態快照。該確認訊息以及後續的每一條任務通知，其 `_meta` 中皆必須原樣攜帶相同的 `io.modelcontextprotocol/subscriptionId`（數值等於 `subscriptions/listen` 的請求 ID）。除封裝外，每條任務通知的內聯資料與在該時刻呼叫 `tasks/get` 回傳的結構完全同構。

用戶端依然必須在每次通訊中宣告 Tasks 擴充功能。一旦連線中斷，應依據本機持久保存的任務 ID 重新建立連線或發起主動輪詢，絕不要依賴事件重播或過時的 `Last-Event-ID`。

## Failure Semantics｜雙層錯誤語義設計

嚴格區分兩個完全不同的錯誤層級：

### 協定層級錯誤（Protocol error）

方法引數格式畸形、或查詢了不存在的未知任務 ID，回傳標準 JSON-RPC 錯誤，通常為 `-32602`。若用戶端未宣告擴充能力支援便發起調用，回傳 `-32021` 搭配必備能力宣告說明。

### 任務執行層級結果（Task execution outcome）

- 若底層執行的工具回傳了帶有 `isError: true` 的業務報錯，該非同步任務依然標註為 `completed`（已完成）！因為工具呼叫已完整產出了其定義的執行結果。
- 若背景工作行程在延後執行期間遭遇了嚴重的底層系統例外，任務狀態標註為 `failed`，並將該系統錯誤封裝於任務實體的 `error` 欄位中。
- 若因使用者主動拒絕授權而中斷，可標註為 `cancelled`、回傳標註為成功的拒答成果，或依業務定義安全的領域終態。必須在架構文件中明確約定該行為。

## Durability, Expiry, and Ownership｜持久化儲存、過期銷毀與租戶歸屬

伺服器至少必須持久化保存：任務 ID、當前狀態、建立與更新時間戳記、TTL 存活時間、建議輪詢間隔、最初操作的歸屬授權資訊、終態成果或錯誤物件、當前未決的輸入請求，以及所有已發布過的輸入金鑰。

儲存鍵值必須包含或能解析出權威的租戶（Tenant）與使用者主體。單純知曉某個任務 ID，絕不能直接賦予對該任務的存取權限。在每一次執行 `tasks/get`、`tasks/update`、`tasks/cancel` 以及發起訂閱時，皆必須重新實施嚴密的歸屬權鑑權。

`ttlMs` 自任務建立瞬間起算，且在運作期間允許被伺服器動態修正。當任務長時間停止產出任何可觀察的進展時，用戶端可將其作為放棄等待的超時兜底依據。伺服器有權將超期任務判定為失敗並在後續進行物理刪除。絕不可將其誤讀為「承諾在任務完成後依然為其保留成果多少毫秒」。

採用原子寫入或資料庫交易。教學程式碼採用寫入暫存檔案隨後進行原子化更名（Rename）的標準技巧。在多節點複本的高可用叢集中，應使用共享的持久化儲存層並搭配分散式租約（Worker Lease）等並發控制機制。

```figure
tp-task-lifecycle
```

## Build It｜動手實作

`code/main.py` 完整實作了一套高確定性的非同步任務服務：

- `server/discover` 回傳 `supportedVersions`、快取提示與 Tasks 擴充功能宣告。
- `tools/list` 回傳具備確定性排序、可快取且帶有合法輸入 Schema 的 `generate_report` 描述符。
- `tools/call` 在回傳 `resultType: "task"` 之前，已將任務完整持久化寫入檔案系統。
- 全新的服務實例能夠直接重載並接續處理同一個任務，完美演示行程重啟後的自癒恢復能力。
- `tasks/get` 回傳完備的任務快照。
- 背景模擬工作行程平滑自 `working` 推進至 `input_required`。
- `tasks/update` 接收表單確認回應，並回傳空內容的 complete 確認訊息。
- 工作行程封裝帶有自身 `resultType` 與伺服器識別資訊的內聯 `CallToolResult`，並推進至 `completed` 終態。
- `tasks/cancel` 在本實作中具備完全的冪等性。
- HTTP 構造器在調用 `tasks/get`、`tasks/update` 與 `tasks/cancel` 時，自動將 `Mcp-Name` 標頭精確設置為 `params.taskId`。
- 通知模組使用 `notifications/subscriptions/acknowledged` 與 `notifications/tasks`，兩者皆打上相應的監聽請求 ID 標記。
- 不帶 ID 的單向通知絕不回傳任何 JSON-RPC 回應。

教學程式碼中的背景工作行程採用顯式推進而非在獨立執行緒中非同步 sleep，確保了每一次狀態轉移皆具備百分之百的確定性與完全的可測性。

## Use It｜實際應用

在儲存庫根目錄下執行：

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
python3 -m unittest discover tests -v
```

預期產出的標準呼叫軌跡序列：

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

同時驗證：現代服務面對已被廢除的 `tasks/status`、`tasks/result` 與 `tasks/list` 時，皆必須堅決拋出方法不存在（Method-not-found）錯誤。驗證 `tools/list` 具備確定性排序，且所有 HTTP 任務方法皆在 `Mcp-Name` 中精確對映了其任務 ID。

## Ship It｜交付成果

本課產出 `outputs/skill-task-store-designer.md`。它能產生相容於最新擴充規範的完整架構規劃：涵蓋能力動態協商、先持久化後發放 ID 原則、現代標準方法定義、中間輸入互動流、租戶歸屬權鑑權、過期清理機制、事件訂閱支援，以及從已廢棄實驗性舊方法的平滑遷移路徑。

## Exercises｜練習

1. 在任務中新增第二個未決的輸入金鑰。發送僅填寫單一金鑰的局部 `tasks/update`，證明在兩個金鑰全數被滿足前，任務狀態會穩健維持在 `input_required`。
2. 為儲存層引入嚴格的租戶歸屬鑑權，證明當合法的任務 ID 由錯誤的認證主體發起查詢時，會被果斷攔截拒絕。
3. 為工作行程引入帶有過期時間的分散式租約（Worker Lease），在測試中證明兩個並發服務實例絕無可能同時完成同一個任務。
4. 為 `subscriptions/listen` 實作基於長回應 POST 的 SSE 轉接層。嚴禁引入獨立 GET 端點、`Last-Event-ID` 或任何協定連線階段標頭。
5. 新增過期自動清理機制。證明系統在處理過期任務時，能夠將「任務自然過期」與「傳入畸形無效 ID」進行清晰區分，且絕不向跨租戶攻擊者洩漏任務是否曾經存在的資訊。

## Key Terms｜關鍵術語

| 術語 | 當前擴充規範下的實際意義 |
|------|----------------------------------|
| Tasks extension | 專為長程非同步工作打造的選用 `io.modelcontextprotocol/tasks` 擴充能力 |
| `CreateTaskResult` | 伺服器主導回傳的 `resultType: "task"` 成果物件，宣告任務已成立 |
| `tasks/get` | 輪詢完整的任務最新快照，內含終態成果或未決的輸入請求 |
| `tasks/update` | 向任務當前尚未處理的 `inputRequests` 送出解答資料 |
| `tasks/cancel` | 向伺服器宣告協同式取消意圖的確認回執 |
| `input_required` | 標明任務正處於暫停狀態、正等待呼叫端提供特定輸入的任務狀態 |
| `pollIntervalMs` | 伺服器向呼叫端建議的下一次狀態輪詢最小等待毫秒數 |
| `ttlMs` | 自任務建立瞬間起算的有效過期存活時長 |
| Durable-before-return | 核心鐵律：必須在底層確認持久化寫入成功後，方可向外回傳任務識別碼 |
| `notifications/tasks` | 在已建立的 SSE 訂閱串流上推送的完整任務狀態變更快照 |

## Legacy Compatibility｜傳統歷史相容性

在 2025-11-25 舊版實驗性規範中，存在由用戶端主動發起的任務升級、`tasks/status`、`tasks/result` 以及選用的 `tasks/list`。請將這些舊標識嚴格封裝在專屬的傳統相容轉接層內部。當前現代用戶端應當宣告擴充能力、接收伺服器主導派發的 ID、透過 `tasks/get` 輪詢狀態、透過 `tasks/update` 送出補充輸入，並直接自任務快照內部讀取最終內聯成果。

## Further Reading｜延伸閱讀

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks) ——官方 MCP Tasks 擴充功能最新草案規範
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) ——MRTR 雙向互動模式手冊
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) ——無狀態 HTTP 傳輸層規格書
