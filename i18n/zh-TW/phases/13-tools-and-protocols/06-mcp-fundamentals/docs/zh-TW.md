# MCP 基礎核心：無狀態請求與 JSON-RPC（MCP Fundamentals: Stateless Requests and JSON-RPC）

> 現代 MCP（Model Context Protocol）既無初始交握（Handshake），亦無協定層級的連線工作階段（Protocol Session）。每一個單一請求本身，都必須攜帶足夠豐富的後設資料（Metadata），使其能夠被獨立理解、鑑權、路由並在出錯時安全重試。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 01 through 05
**Time:** ~55 minutes

## Learning Objectives｜學習目標

- 嚴格辨析 MCP 的伺服器端核心原語與用戶端特性的權責邊界。
- 針對 MCP `2026-07-28` 規範，建構合法合規的 JSON-RPC 2.0 請求與回應封裝。
- 為每一個送出的獨立請求，精確附加協定版本、用戶端能力宣告與用戶端識別資訊。
- 調用 `server/discover` 服務發現介面，並在完全無需初始交握的架構下優雅處理 `UnsupportedProtocolVersionError`。
- 端到端完整追蹤一個獨立請求從前置校驗到產出完整成果的全流程生命週期。

## The Problem｜問題

在現代微服務與無伺服器架構中，同一個行程或 HTTP 背景工作程式（Worker），隨時可能連續接收來自不同用戶端、具備相異能力宣告的相繼請求。若伺服器錯誤地記住了前一個請求宣告的狀態或權限，便可能對後續請求誤用錯誤的權限等級，或回傳錯誤的資料結構。

MCP `2026-07-28` 徹底根除了這項架構隱患。協定的核心原則是「絕對無狀態（Stateless）」。伺服器在決策如何處理當前請求時，必須完全且唯一地依賴「當前請求本身所攜帶的上下文資訊」，嚴禁依賴任何既有的連線歷史記憶。

這徹底重構了傳統的心智模型。舊有的協定時序是：建立連線 → 執行交握對齊 → 展開實體操作。現代 MCP 的架構則大幅簡化為清晰的四步驟：

1. 用戶端發送自我說明的獨立請求。
2. 伺服器校驗該請求攜帶的協定版本與能力宣告。
3. 伺服器執行相應的方法邏輯。
4. 伺服器回傳具型別定義的成果或標準 JSON-RPC 錯誤碼。

下一個請求到來時，從零重複上述完全相同的獨立決策流程。

## The Concept｜核心概念

### 伺服器核心原語

MCP 伺服器對外公開三大核心原語：

1. **工具（Tools）**：由大模型自主決策呼叫的實體動作，透過 `tools/list` 探測發現，透過 `tools/call` 發起執行。
2. **資源（Resources）**：以 URI 唯一定位的唯讀資料資產，透過 `resources/list` 探測發現，透過 `resources/read` 檢索讀取。
3. **Prompt 範本（Prompts）**：可重複使用的結構化提示範本，透過 `prompts/list` 探測發現，透過 `prompts/get` 進行實例化彩現。

請注意：根目錄宣告（Roots）、取樣（Sampling）與日誌記錄（Logging）在 `2026-07-28` 規範中雖為相容性而暫時保留，但已被正式標記為即將廢棄。新系統在架構設計時，應將根目錄作為顯式的工具或資源引數傳入、直接調用模型提供商的原生 API 進行文字取樣，並透過 stderr 或 OpenTelemetry 實施全鏈路日誌追蹤。至於引導式互動（Elicitation），則全面轉向多輪往返請求（Multi Round-Trip Requests）機制：由伺服器回傳輸入請求，並由用戶端重試最初的操作。現代伺服器絕不可自主發起獨立的逆向 JSON-RPC 請求。

### JSON-RPC 封裝信封

MCP 嚴格遵循標準的 JSON-RPC 2.0 規範：

- 請求（Request）：`{jsonrpc, id, method, params}`
- 回應（Response）：`{jsonrpc, id, result}` 或 `{jsonrpc, id, error}`
- 單向通知（Notification）：不帶 `id` 的 `{jsonrpc, method, params}`

請求中攜帶的 `id` 純粹用於將單次回應精準關聯至發起端，絕不代表在伺服器端建立了任何持久的協定連線階段。

### 必填的請求後設資料

現代規範要求每一個發起的請求，皆必須在 `params` 內部攜帶 `_meta` 物件：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
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

其中協定版本字串與用戶端能力字典為絕對必填項。用戶端身份識別（clientInfo）則為強烈建議填寫項，它僅作為展示除錯與審計排查之用，絕不可作為替代安全憑證的依據。

伺服器嚴禁從稍早接收過的歷史請求、stdio 行程、底層 HTTP 連線、或僅憑傳輸層標頭（Headers）來私自推斷這些核心參數。

### 完整結果與伺服器識別資訊

所有成功的現代回應皆必須包含 `resultType` 鑑別欄位。常規的終態回應設定為 `"complete"`。此外，伺服器應當在回應的後設資料中標註自身身分：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "tools": [],
    "ttlMs": 30000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "notes-server",
        "version": "1.0.0"
      }
    }
  }
}
```

`tools/list`、`resources/list`、`prompts/list`、`resources/templates/list`、`resources/read` 以及 `server/discover` 皆屬於可被快取的冪等操作，其回應中必須包含 `ttlMs`（存活毫秒數）與 `cacheScope`（快取作用域）。保守的預設安全設定為 `ttlMs: 0` 搭配 `cacheScope: "private"`。清單中的各項條目應保持確定性的排序，確保等價的回應能夠產出絕對穩定的快取鍵值與模型上下文。

### 無需交握的動態服務發現

現代 MCP 伺服器必須強制實作 `server/discover` 介面。用戶端可在呼叫具體業務方法前先行呼叫此端點，以探測：

- 伺服器支援的協定版本清單（`supportedVersions`）。
- 伺服器具備的能力特徵（`capabilities`）。
- 選用的自然語言操作指南（`instructions`）。
- 回應 `_meta` 中的伺服器身份識別。
- 快取策略建議。

服務發現是極佳的輔助手段，但**絕非**前置卡點。用戶端完全可以直接發起 `tools/list` 請求，因為該請求本身就已完整攜帶了其運行的協定版本與能力宣告。

若用戶端請求的協定版本不被支援，伺服器必須回傳標準的 JSON-RPC 錯誤碼 `-32022`，並附帶具體資料：

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

用戶端據此挑選雙方共同相容的現代版本，並使用全新的 JSON-RPC 請求 ID 重新發起請求。

### 單一請求的完整生命週期

追蹤一個現代 MCP 請求時，必須嚴格依循以下時序：

1. 解析單一 JSON-RPC 封裝信封。
2. 嚴格確認 `jsonrpc` 欄位值為 `"2.0"`、存在有效 `id`、`method` 為合法字串，且 `params` 為物件。
3. 檢查 `params._meta` 中是否包含必填的版本字串與能力物件；格式畸形或缺漏則立刻拋出 `-32602`。
4. 在 HTTP 邊界層，比對 HTTP 標頭宣告的版本、方法與名稱是否與 Request Body 中的內容完全一致。若出現矛盾衝突，即使其中一方使用了不支援的版本，亦必須一律拋出 `-32020`。
5. 在確認標頭與內容完全吻合後，若該協定版本不被本伺服器支援，拋出 `-32022`。
6. 檢查用戶端是否具備該方法所需的必備能力宣告，隨後依據 `method` 進行內部路由，並嚴格校驗各方法特定的引數結構。
7. 在實體業務處理常式正式執行前，實施精準的認證與授權防護。
8. 回傳包含伺服器識別資訊的完整成果物件。
9. 徹底遺忘該請求所屬的協定層級後設資料，不留任何連線記憶。

嚴格遵守上述順序，能杜絕多個元件對同一個呼叫產生語義理解歧義（例如閘道器誤對 `Mcp-Name: notes.read` 進行了授權，而底層服務卻實際執行了 `params.name: notes.delete`）。它同時確保了畸形輸入、標頭混淆、版本協商、能力不足、權限鑑權與業務錯誤在日誌中具備涇渭分明的審計證據。

關閉 stdin 或結束 HTTP 回應僅代表傳輸層活動的終止。它絕不代表協定連線階段的銷毀，因為現代 MCP 根本不存在連線階段。

### 明確的向後相容過渡設計

在 `2025-11-25` 及更早的版本中，協定深度依賴 `initialize`、`notifications/initialized`、綁定於連線的全局能力宣告，以及可串流 HTTP 中的可選協定連線階段。當現代雙版本相容用戶端與舊版傳統伺服器通訊時，這些機制依然具備現實意義。

務必將這兩個歷史時代在架構上嚴格隔離：現代請求藉由每個請求自帶的必備後設資料進行精準辨識；而傳統連線則僅能透過有文獻記載的降級回退路徑按需觸發。面對 `2026-07-28` 伺服器時，絕不可預設發送過時的 `initialize` 請求。

因此，「無狀態」在不同時代具備不同的具體含義：在 `2026-07-28` 中，它是不可動搖的協定不變量——每個常規請求皆可被獨立解讀，且絕不存在任何 MCP 協定層級的連線階段；而在 `2025-11-25` 以前的版本中，初始化與能力協商屬於實體連線，相容適配層可局部保留該連線狀態。一個優雅的雙時代相容架構，絕非一個將所有邏輯混雜的寬容狀態機，而是在無狀態的現代核心旁，掛載一個嚴格隔離的舊版適配層，並在解析器啟動前做出明確的時代路由決策。

這兩種含義皆完全不排斥業務層面的持久化狀態。一個真實的業務工作流、長程任務或草稿，完全可以作為不透明的識別碼（Handle）儲存於共享資料庫中。用戶端在請求中將該識別碼作為普通輸入參數傳遞，由每個伺服器複本獨立實施認證與鑑權。協定上下文絕不可被偷偷寫入該資料庫，去充當被協定正式廢棄的連線階段的劣質替代品。

```figure
mcp-tool-call
```

## Use It｜實際應用

`code/main.py` 在完全不依賴任何外部重型框架的前提下，完整實作了現代 MCP 訊息的建構、校驗、追蹤與分發。執行方式：

```bash
python3 code/main.py
python3 -m unittest discover code/tests -v
```

在輸出日誌中親身驗證三大核心不變量：

- 每一個送出的獨立請求，皆嚴格重複攜帶自身的 `_meta` 欄位。
- 每一筆成功的回應，皆明確標註 `resultType: "complete"` 並附帶伺服器識別資訊。
- 清單查詢結果遵循確定性的排序規則，並附帶顯式的快取控制建議。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-handshake-tracer.md`。雖然歷史檔案名稱維持穩定相容，但該工具如今已全面升級為現代無狀態請求追蹤器。它能對每條通訊訊息進行獨立審計，且僅在真實捕獲到傳統流量時才標註舊版交握痕跡。

## Exercises｜練習

1. 將某個請求中的協定版本刻意修改為 `2027-01-01`。確認伺服器拋出的錯誤代號嚴格為 `-32022`，且錯誤資料中完整宣告了本伺服器實際支援的合法版本。
2. 從第二個請求中刻意移除 `io.modelcontextprotocol/clientCapabilities`。確認伺服器絕不會私自復用第一個請求中宣告過的能力。
3. 將記憶體中的工具註冊表清單進行逆序排列。確認 `tools/list` 依然嚴格回傳完全一致的確定性排序輸出。
4. 將回應中的 `cacheScope` 由 `public` 修改為 `private`。深入分析這兩種設定在不同授權情境下，對下游各層級快取復用的具體影響。
5. 撰寫一組選填 `clientInfo` 省略測試。驗證請求依然能夠順暢通過校驗，證明用戶端識別資訊純屬建議性質，絕非硬性阻擋門檻。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| Stateless protocol | 無狀態協定；每個請求皆自包含解讀該請求所需的全部上下文後設資料 |
| Request metadata | 請求後設資料；封裝於 `params._meta` 內部的協定版本、用戶端能力與建議識別資訊 |
| `server/discover` | 伺服器必備標準方法；用於宣告支援版本、能力清單、操作指南與伺服器識別資訊 |
| `resultType` | 標註於每個現代成功回應最外層的鑑別欄位（正常終態為 "complete"） |
| Cacheable result | 包含必備 `ttlMs` 存活時間與 `cacheScope` 快取作用域提示的可快取結果 |
| Protocol era | 協定歷史時代；劃分為「現代單請求自包含後設資料」與「傳統連線級初始化交握」 |
| Transport lifetime | 傳輸層實體生命週期；僅代表行程、TCP 連線或串流持續時間，非協定連線階段 |
| `-32022` | 不支援的協定版本標準錯誤代號；回傳酬載包含請求版本與實際支援版本清單 |

## Further Reading｜延伸閱讀

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture) ——現代 MCP 官方無狀態架構設計手冊
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic) ——JSON-RPC 2.0 基礎協定與後設資料規格手冊
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) ——動態服務發現與版本協商官方規格書
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) ——全面移除交握與連線階段的歷史架構變更日誌
