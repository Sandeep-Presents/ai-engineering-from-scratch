# MCP 傳輸層：stdio 與無狀態 Streamable HTTP（MCP Transports: stdio and Stateless Streamable HTTP）

> 傳輸層僅負責承載傳遞 MCP 訊息，它絕不負責提供缺漏的協定狀態。在 `2026-07-28` 規範中，本地的 stdio 與遠端的 Streamable HTTP 兩者皆百分之百承載著自包含上下文的獨立請求。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## Learning Objectives｜學習目標

- 針對本地子行程優先選用 stdio 傳輸層，針對分散式網路服務選用 Streamable HTTP。
- 完整實作現代「單一端點、僅限 POST（POST-only）」的 Streamable HTTP 協定契約。
- 在 HTTP 標頭中同步宣告 MCP 協定版本、呼叫方法與目標名稱，並對照 JSON-RPC 內文進行交叉嚴格校驗。
- 正確交付綁定於單一請求範疇的 SSE 串流，以及長期存活的 `subscriptions/listen` 訂閱串流。
- 平滑遷移舊有基於連線階段的傳統 HTTP+SSE 部署，杜絕將歷史廢棄行為誤當作現代規範對外暴露。

## The Problem｜問題

早期版本的 Streamable HTTP 將協定層級的能力協商，與實體傳輸連線以及協定連線階段（Session）強行綁定在一起。伺服器端會自行簽發 `Mcp-Session-Id`、開放獨立的 GET 事件串流、接收 DELETE 請求以銷毀連線階段，並透過 `Last-Event-ID` 支援 SSE 斷點續傳。

MCP `2026-07-28` 規範已將上述機制從現代網路通訊中徹底移除。現在，每一個進來的獨立請求皆能被任意轉發至任何健康的後端背景工作程式（Worker），因為該請求所需的協定版本與用戶端能力宣告，皆百分之百封裝在 Request Body 內文中。HTTP 標頭雖會同步映射部分欄位以利負載平衡與路由策略，但伺服器在執行前必須嚴格校驗標頭與內文是否完全吻合。

這使得系統更易於水平擴展，且在架構分析上更為清晰透明。這同時意味著：若一套教材依然將 2025 年代的連線階段式傳輸當作最新規範講授，它所傳遞的本質上是錯誤的安全邊界與失效復原模型。

## The Concept｜核心概念

### stdio 傳輸機制

stdio 綁定專為用戶端在本機啟動的子行程通訊而設計：

- 用戶端向 stdin 寫入以換行分隔的 UTF-8 JSON-RPC 訊息。
- 伺服器向 stdout 寫入以換行分隔的 UTF-8 JSON-RPC 訊息。
- 伺服器向 stderr 輸出內部診斷與排查日誌。
- 當 stdin 遭遇 EOF 結尾時，伺服器必須迅速正常退出。
- 每個現代請求皆必須在 `params._meta` 中獨立攜帶協定版本與能力宣告。

雖然該子行程在作業系統層面可能持續存活並處理多次呼叫，但它絕不代表存在現代 MCP 協定層級的連線階段。若行程意外崩潰，所有正在執行中的非同步請求皆會遺失。正確的應對是：重啟行程、重新探測服務、重新拉取工具清單、重新建立訂閱串流，並使用全新請求 ID 安全重試冪等操作。

### 2026-07-28 規範下的 Streamable HTTP

現代 MCP 伺服器僅對外暴露單一入口端點（例如 `/mcp`），且**僅接收 POST 請求**。

每一個 JSON-RPC 請求或單向通知，皆是一次全新的 HTTP POST 請求。Request Body 內含單一 JSON-RPC 訊息。用戶端絕不可主動向伺服器發送 JSON-RPC 回應。

針對一個請求，伺服器回傳以下兩者之一：

- `Content-Type: application/json`：直接封裝單一 JSON-RPC 回應；或
- `Content-Type: text/event-stream`：先推送與該請求相關的即時進度通知，最後輸出最終的 JSON-RPC 回應。

針對收到且被接受的單向通知，伺服器直接回傳狀態碼 `202 Accepted`，且不帶任何 Body 內文。

用戶端在請求時宣告同時相容這兩種回應形態：

```http
Accept: application/json, text/event-stream
```

### 僅限 POST（POST-only）的嚴格定義

現代 Streamable HTTP 規範徹底廢棄了獨立的 GET 串流端點與 DELETE 連線銷毀端點：

- 呼叫 `GET /mcp` 必須一律回傳狀態碼 `405 Method Not Allowed`。
- 呼叫 `DELETE /mcp` 必須一律回傳狀態碼 `405 Method Not Allowed`。
- 傳入的 `Mcp-Session-Id` 標頭會被完全忽略，伺服器絕不簽發亦不回傳該標頭。
- 傳入的 `Last-Event-ID` 會被直接忽略，因為現代串流不再支援斷點續傳。

若一個綁定於請求範疇的串流在產出最終回應前異常中斷，意味著該次請求已在傳輸途中遺失。若該操作具備冪等安全性，用戶端應派發全新的 JSON-RPC 請求 ID 發起重試，絕不可嘗試發起串流續傳。

### Origin 來源校驗防禦

伺服器必須對進來的連線嚴格校驗 `Origin` 標頭，以全面防禦 DNS 重綁定（DNS Rebinding）攻擊。若標頭存在且未明確列入白名單中，必須一律回傳 `403 Forbidden`。非瀏覽器環境的用戶端可以省略 `Origin` 標頭，這完全符合官方傳輸層規範。

本地運行的伺服器應明確綁定至 `127.0.0.1` 本機迴路位址，嚴禁綁定至所有網路介面（0.0.0.0）。對外開放的網路服務依然必須對每一個請求實施真實的身份驗證與授權。Origin 校驗僅是防禦手段，絕不能取代真實鑑權。

在白名單匹配時，必須實施完全相等的字串比對。類似 `origin.startswith("https://trusted.example")` 的前綴比對是極具漏洞的危險做法，它會輕易放行攻擊者偽造的後綴網域。

### 必備的 HTTP 後設資料標頭

每一個發起的現代 POST 請求皆必須附帶以下標頭：

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

標頭防護規則：

- `MCP-Protocol-Version` 為必填項，其數值必須與 `params._meta.io.modelcontextprotocol/protocolVersion` 嚴格完全相等。
- `Mcp-Method` 為必填項，其數值必須與 JSON-RPC 的 `method` 完全相等。
- 呼叫 `tools/call`、`resources/read` 與 `prompts/get` 時，`Mcp-Name` 為必填項。
- `Mcp-Name` 對應 `params.name`，而在 `resources/read` 中則對應 `params.uri`。
- 標頭名稱雖然大小寫不敏感，但標頭**數值**是大小寫嚴格敏感的。

若 `Mcp-Name` 中包含非 ASCII 字元或特殊符號，必須採用嚴格的 UTF-8 Base64 哨兵封裝格式：

```text
=?base64?{Base64EncodedValue}?=
```

伺服器在對照 Body 內文進行比對之前，必須先將該哨兵值還原解碼。

若同步對映標頭缺漏、格式畸形或與 Body 內容不符，伺服器必須回傳 HTTP `400` 搭配 JSON-RPC 錯誤碼 `-32020`。若標頭與內文一致同意了一個本伺服器不支援的版本，回傳 HTTP `400` 搭配 `-32022` 與精確的錯誤資料（例如 `{"supported":["2026-07-28"],"requested":"2027-01-01"}`）。

呼叫不存在的未知方法時，回傳 HTTP `404` 搭配 JSON-RPC `-32601`。回傳標準 JSON-RPC 內文至關重要，因為雙版本相容的用戶端需藉此區分這是現代語義的正常錯誤，還是存取了錯誤的傳統端點。

### 請求範疇的 SSE 事件串流

針對長耗時的操作請求，伺服器可選擇以 SSE 串流形式回傳回應：

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

伺服器絕不可在此串流上發起獨立的逆向 JSON-RPC 請求。所有涉及取樣、引導問答或根目錄的互動，一律透過多輪往返請求（MRTR）達成。關閉該回應串流，便直接等同於取消該次請求。

絕不要為重播目的附加 SSE 事件 ID。`Last-Event-ID` 斷點續傳在現代規範中已被徹底除名。

### 長期變更推送全面採用 subscriptions/listen

變更通知必須透過用戶端主動發起的專屬長連線請求進行監聽，而非獨立的 GET 端點：

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

該 POST 請求的回應為長期存活的 SSE 串流。其輸出的第一條協定訊息嚴格為 `notifications/subscriptions/acknowledged`。該確認訊息、後續的所有變更通知以及最終終態結果，其 `_meta` 中皆必須附帶 `io.modelcontextprotocol/subscriptionId`，其數值嚴格等於最初監聽請求的 ID。伺服器可定期發送 SSE 註解作為心跳保活封包（Keepalive）。一旦串流意外中斷，用戶端必須指派全新請求 ID 重新發起 `subscriptions/listen`，並主動拉取受影響的清單資料。

傳統的 `resources/subscribe` 與 `resources/unsubscribe` 屬於舊版時代，嚴禁在現代連線上調用。

### 顯式業務狀態設計

廢除協定連線階段，絕不意味著禁止業務工作流維護狀態。伺服器可以生成不透明的業務狀態識別碼（Handle），並作為常規工具調用成果回傳給用戶端。用戶端在後續的呼叫中，將該識別碼作為顯式引數傳回。

將狀態識別碼與通過驗證的主體進行身分綁定、使用不可被猜測的隨機數、配置合理過期時間，並在每一次呼叫時實施鑑權審查。這讓狀態在業務應用層清晰透明地流轉，而非暗藏於底層網路的節點親和性（Affinity）黑箱中。

隱式節點記憶在水平擴展中引發的典型系統崩潰流程：

1. 請求 A 抵達節點 1，並在該行程的記憶體內部建立了一份草稿。
2. 回應未回傳任何草稿識別碼，因為該實作傲慢地假設實體 TCP 連線本身就能標識該草稿。
3. 請求 B 作為一次全新的 HTTP POST，被負載平衡器分發至節點 2。
4. 節點 2 雖然接收到了合法的協定後設資料，卻完全無法找到該草稿，導致工作流直接崩潰或誤讀了錯誤的本機物件。
5. 開發者往往試圖透過黏性路由（Sticky Routing）治標不治本，直到遇到節點重啟、滾動發布或容災切換時再度徹底故障。

標準的工程架構劃分為兩大部分：協定上下文留在每一個獨立請求中；持久化的業務狀態儲存於後端共享資料庫中，並由伺服器派發的不透明識別碼進行定址。下一次呼叫攜帶該識別碼，任何一個節點皆能加載同一筆資料，且鑑權邏輯會驗證當前請求主體是否具備存取權限。節點記憶體可作為快取加速，但絕不能是保障系統正確性的唯一依賴。

依據生命週期挑選合適的狀態保存形式：請求區域變數服務於單次呼叫；短期的多輪往返可使用具備完整性防篡改保護的 `requestState`；而長期草稿或耗時工作，則必須仰賴顯式識別碼加上共享持久化儲存、過期銷毀、並發控制與冪等保護。所有這些物件，皆絕非 MCP 協定層級的連線階段。

### HTTP 雙時代相容策略

同時支援現代與傳統伺服器的用戶端，在連線時會優先嘗試現代 POST 請求。若收到 HTTP `400`、`404` 或 `405`，它會仔細審查 Body 內文：

- 若回傳的是已知的現代 JSON-RPC 錯誤碼，確鑿證明該伺服器為現代規範。用戶端應當修正請求或協商支援的版本，絕不要進行向下降級。
- 若 Body 為空白或回傳未知的回應，代表可能遇到了舊版 HTTP+SSE 伺服器。唯有此時，方可嘗試存取舊有的 GET 端點並期待其發送傳統的 `endpoint` 事件。

在系統遷移過渡期，伺服器若需同時相容新舊用戶端，可將攜帶現代後設資料的請求路由至全新的僅限 POST 實作，同時為舊用戶端保留完全獨立的傳統歷史端點。絕不要將傳統的 GET、DELETE、Session ID 或重播行為描繪為 `2026-07-28` 規範的一部分。

```figure
tp-transport-handshake
```

## Use It｜實際應用

`code/main.py` 以純 Python 標準函式庫實作了一款小巧完整的現代 Streamable HTTP 伺服器。它嚴格實施 Origin 來源校驗與同步標頭比對、忽略被廢棄的連線階段標頭、為常規呼叫回傳標準 JSON，並展示了一條有限生命週期的 `subscriptions/listen` SSE 串流。

```bash
cd code
python3 main.py --probe
python3 -m unittest discover tests -v
```

探測常式將地毯式驗證：

- 非法 Origin 請求被嚴格攔截拒絕；
- 在完全無 Session ID 的前提下，服務發現順暢成功；
- 傳入的 `Mcp-Session-Id` 與 `Last-Event-ID` 被完全忽略；
- 標頭與內文不符時精準回傳 `-32020`；
- 不支援的協定版本回傳 `-32022` 搭配精準的 `supported` 與 `requested` 資料；
- 接收合法的單向通知時回傳空內文的 HTTP `202`；
- 對 GET 與 DELETE 請求堅定回傳 `405`；
- `subscriptions/listen` 是一條標準 POST 回應串流，其確認訊息、變更通知與最終成果皆原樣攜帶相應的訂閱 ID。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-transport-migrator.md`。它能徹底移除現代程式碼中殘留的協定連線階段邏輯、補齊標頭與內文交叉校驗、將舊有的獨立 GET 串流重構為標準的 `subscriptions/listen`，並將所有傳統向下相容橋樑進行清晰的物理隔離。

## Exercises｜練習

1. 從發起的 POST 請求中刻意移除 `Mcp-Method` 標頭。確認 HTTP `400` 與錯誤碼 `-32020`。
2. 在標頭與內文中一致宣告不支援的協定版本 `2027-01-01`。驗證伺服器是否回傳 HTTP `400` 與 `-32022`，並回傳格式完全吻合的 `{"supported":["2026-07-28"],"requested":"2027-01-01"}` 資料。
3. 針對非 ASCII 的資源 URI 構造帶有 Base64 哨兵封裝格式的 `Mcp-Name` 標頭。驗證伺服器是否能正確解碼並與 `params.uri` 展開精確比對。
4. 刻意在最終回應輸出前強制切斷監聽串流。驗證用戶端是否能指派全新 JSON-RPC 請求 ID 重新發起監聽，並主動重新整理相應的工具註冊表。
5. 為 ping 工具新增一個顯式的業務工作流識別碼（Handle）。在完全不使用任何傳輸連線親和性的前提下，將該識別碼與授權主體進行安全綁定。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| stdio | 以換行符號分隔的 JSON-RPC 傳輸協定，運作於用戶端啟動的子行程之上 |
| Streamable HTTP | 單一入口端點協定；每一個現代訊息皆是一次全新的 HTTP POST 請求 |
| Request-scoped SSE | 綁定於單一請求生命週期的 POST 回應事件串流，包含相關進度通知與最終回應 |
| `subscriptions/listen` | 長期存活的 POST 監聽請求，用於接收主動訂閱的清單或資源變更事件推送 |
| Header mismatch | 當 HTTP 同步標頭與 JSON-RPC 內文出現矛盾時回傳的 HTTP `400` 與 `-32020` 錯誤 |
| Origin validation | 針對傳入連線實施的 DNS 重綁定防禦機制；僅是安全過濾，絕不能充當身分認證 |
| Explicit state handle | 在業務層作為常規引數傳遞的不透明業務狀態識別碼，取代黑箱的協定連線階段 |
| Legacy bridge | 為了向下相容既有舊版用戶端而獨立隔離維護的傳統傳輸處理路徑 |

## Further Reading｜延伸閱讀

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports) ——MCP 傳輸架構官方綜述
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio) ——標準輸入輸出傳輸層官方規格書
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) ——無狀態 Streamable HTTP 規範手冊
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) ——長連線事件訂閱模式官方規格
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) ——傳輸層重大變更與連線階段廢止公告
