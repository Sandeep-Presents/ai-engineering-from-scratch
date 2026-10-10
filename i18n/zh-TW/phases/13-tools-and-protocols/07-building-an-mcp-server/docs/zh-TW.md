# 打造 MCP 伺服器：無狀態 Python 與 TypeScript 實作（Building an MCP Server: Stateless Python and TypeScript）

> 現代 MCP 伺服器絕不記憶交握狀態。它在每次請求時獨立校驗後設資料、執行單一處理常式，並回傳單一具型別定義的成果。

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 06
**Time:** ~85 minutes

## Learning Objectives｜學習目標

- 為 MCP `2026-07-28` 規範實作強制必備的 `server/discover` 動態服務發現端點。
- 在每一次進來的獨立請求中，嚴格校驗協定版本與用戶端能力宣告。
- 對外公開工具、資源與 Prompt 範本，並保證回傳清單具備絕對確定性的排序。
- 為相應的查詢成果精確附加 `resultType`、伺服器識別資訊以及快取控制建議。
- 分別以 Python 與 TypeScript 標準函式庫實作完全相同的無狀態契約，並透過基於換行分隔的 stdio 傳輸層對外提供服務。

## The Problem｜問題

一個在接收到首個訊息後便在記憶體中快取用戶端能力的伺服器，寫起來雖然看似直覺，但在正式維運中卻極具隱患。同一個行程隨時可能需要為相繼抵達的不同用戶端提供服務；一個遠端請求亦可能被分發至不同的背景工作程式（Worker）。任何殘留的過期能力宣告，皆可能在不同的授權邊界之間引發嚴重的權限洩漏或行為錯位。

MCP `2026-07-28` 徹底解決了協定層面的該項難題：強制規定每一個請求皆必須自包含完整的上下文說明。你的應用程式當然依然可以維護持久化的筆記、背景工作或明確的狀態識別碼；但它絕不能維護任何會改變後續請求解碼行為的隱式協定連線狀態。

本課將親手實作兩套完整的筆記服務（Notes Server）。Python 與 TypeScript 版本皆僅使用語言標準函式庫實作協定核心，兩者對外公開完全一致的方法，並嚴格履行完全同構的網路傳輸契約。

## The Concept｜核心概念

### 現代分發迴圈

```text
read one JSON-RPC line
parse the envelope
if it is a notification, do not respond
validate params._meta for this request
route by method
wrap success with resultType and serverInfo
write one JSON-RPC response line
forget request-scoped metadata
```

在基於 stdio 的通訊傳輸中，有三條鐵律必須嚴格恪守：

- 僅向 stdout 寫入合法的 JSON-RPC 訊息。所有除錯與診斷資訊必須一律輸出至 stderr。
- 每條訊息皆以標準換行符號結尾，且每一次輸出回應後必須立刻強制排空緩衝區（Flush）。
- 當 stdin 讀取到 EOF 結尾標記時，行程必須果斷乾脆地終止退出。

行程本身的存活週期純粹是實體傳輸層的生命週期，它絕不代表存在任何現代 MCP 協定層級的連線階段。

### 請求後設資料校驗

每一個進來的請求皆必須具備合法的結構：

```json
{
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "notes-client",
        "version": "1.0.0"
      }
    }
  }
}
```

前兩個欄位（協定版本與用戶端能力）為絕對必填項。`clientInfo` 用戶端身份為建議選填項。伺服器應當校驗其資料結構的合法性，但絕不可將其視為可信的安全認證憑證。

若請求的版本不受支援，伺服器必須回傳錯誤碼 `-32022` 並附帶 `requested`（請求版本）與 `supported`（支援版本清單）。若缺少必備的請求後設資料，則回傳無效引數錯誤碼 `-32602`。嚴禁從先前的歷史呼叫中自動挪用缺漏的欄位進行私自填補。

### 強制實作的服務發現（server/discover）

現代 MCP 伺服器必須強制提供 `server/discover` 介面。一份完整合規的服務發現成果，應當包含支援的現代版本清單、能力聲明、選用的操作說明、快取建議，並在結果的 `_meta` 中標明伺服器身分：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": false},
    "resources": {"listChanged": false, "subscribe": false},
    "prompts": {"listChanged": false}
  },
  "ttlMs": 3600000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

服務發現的目的不是作為存取閘門。用戶端完全可以直接發起 `tools/list` 請求，因為 `tools/list` 本身就已經攜帶了完全相同的請求後設資料。

### 工具（Tools）

`tools/list` 回傳具備確定性排序的工具描述清單。穩定的排序規則能大幅提升中繼快取命中率，並維持模型上下文的高度一致性。該成果物件中同樣必須包含 `ttlMs` 與 `cacheScope`。

`tools/call` 執行工具並回傳內容區塊清單以及 `isError` 布林值。當協定封裝信封格式錯誤或方法引數不合法時，拋出標準 JSON-RPC 協定錯誤；而當呼叫本身合法、但工具內部業務邏輯執行失敗時，則回傳 `isError: true` 成果。

工具註解欄位純屬輔助提示，絕非強制安全執行保證：

- `readOnlyHint`
- `destructiveHint`
- `idempotentHint`
- `openWorldHint`

宿主環境可利用這些提示向使用者呈現確認對話框或調整 UI；但伺服器自身依然必須實施嚴格真實的實體權限鑑權。

### 資源（Resources）

`resources/list` 回傳穩定的資源 URI 描述符清單。`resources/read` 回傳具備型別定義的資源本體內容。兩者在 `2026-07-28` 規範中皆屬可快取操作，因此皆必須附帶 `ttlMs` 與 `cacheScope`。

針對專屬於特定使用者的私有筆記資料，必須設定 `cacheScope: "private"`。共享快取層嚴禁跨授權邊界復用標註為私有的快取回應。

現代架構中的變更推送已不再依賴 `resources/subscribe`。用戶端改為建立 `subscriptions/listen` 串流，並按需訂閱 `resourceSubscriptions` 或特定類別的清單變更事件。第 10 課將深入建構此工作流程。

### Prompt 範本（Prompts）

`prompts/list` 屬於可快取且具備確定性排序的查詢操作。`prompts/get` 則接收引數並彩現輸出具名的 Prompt 內容。彩現後的 Prompt 成果雖然是終態成果，但它並不屬於需要標註快取控制建議的清單類或唯讀類結果。

### 每一筆成功回應皆具備明確型別

在教學實作中，所有成功回應皆由同一個統一包裝函式產出：

```python
def complete(payload):
    return {
        "resultType": "complete",
        **payload,
        "_meta": {SERVER_INFO_KEY: SERVER_INFO},
    }
```

針對清單查詢、資源讀取與服務發現常式，在此基礎上額外追加 `ttlMs` 與 `cacheScope`。集中封裝此邏輯，能有效杜絕個別處理常式意外遺漏現代協定必備欄位的低階疏失。

### 嚴禁伺服器主動發起逆向請求

現代伺服器可以發送與特定用戶端請求直接關聯的通知，亦可在用戶端開啟的 `subscriptions/listen` 串流上推送變更通知。但伺服器**絕不允許**自發發起獨立的逆向 JSON-RPC 請求。

當處理常式需要進行大模型取樣、發起引導式詢問（Elicitation）或存取系統根目錄時，它會向用戶端回傳一個 `input_required` 成果。用戶端在本地完成對應的輸入採集後，使用全新的請求 ID 重新調用最初的方法。第 11 課將深入剖析這套多輪往返請求（Multi Round-Trip Request）模式。

### 明確的傳統版本相容設計

支援雙歷史版本的相容型伺服器，可在完全隔離的傳統相容路徑上實作 `2025-11-25` 的舊版交握邏輯。當進來的請求攜帶必備的現代 `_meta` 欄位時走現代無狀態路徑；當接收到過時的 `initialize` 請求時則切換至傳統相容路徑。

絕不要將 `2026-07-28` 的現代請求導流至傳統交握流程中，亦絕不可將現代專屬的 `resultType` 欄位強行塞入傳統初始化的回傳結果中。本課的實作程式碼刻意維持純粹的「僅現代規範」，以確保核心不變量一目了然。

```figure
t3-dispatch-loop
```

## Use It｜實際應用

執行 Python 伺服器的有限狀態展示與自動化單元測試：

```bash
cd code
python3 main.py --demo
python3 -m unittest discover tests -v
```

利用 TypeScript 執行期執行對等的 TypeScript 移植版本：

```bash
npx tsx main.ts --demo
```

展示常式將依序發送 `server/discover` 探測、列舉各項原語清單、發起實體工具呼叫，並觸發不支援版本時的標準錯誤處理。在日誌中確認：每一個現代請求皆重複攜帶後設資料，且每一個成功回應皆完整包含伺服器識別資訊。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-server-scaffolder.md`。它能產生現代 MCP 伺服器的標準工程規劃書：涵蓋服務發現契約、逐請求後設資料校驗、確定性可快取清單設計，以及選用的隔離式舊版相容適配層。

## Exercises｜練習

1. 從某個請求中刻意移除能力宣告字典。驗證伺服器絕不會私自挪用前一個請求中宣告過的能力。
2. 逆轉程式碼中 `TOOLS`、`PROMPTS` 以及筆記資料的原始宣告順序。驗證所有清單查詢結果依然保持絕對穩定的確定性排序輸出。
3. 新增一個具備破壞性的 `notes_delete` 刪除工具，並在執行器內部實施強制授權校驗。保持 `destructiveHint` 僅作為純前端提示之用。
4. 實作 `resources/templates/list` 端點，並正確配置 `ttlMs`、`cacheScope` 以及確定性排序輸出。
5. 針對 `2025-11-25` 規範建構一個完全隔離的傳統適配層。編寫測試案例，證明現代請求絕不會誤入該傳統處理常式。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| Stateless server | 無狀態伺服器；完全依據單一請求自身的後設資料進行處理，不保留協定連線記憶 |
| `server/discover` | 強制必備的現代方法；宣告伺服器支援的協定版本、能力清單、指南與識別資訊 |
| Complete result | 標註有 `resultType: "complete"` 的現代成功終態回應 |
| Cacheable result | 包含必備 `ttlMs` 存活時間與 `cacheScope` 快取作用域提示的查詢或讀取結果 |
| Deterministic list | 確定性排序清單；相同的邏輯註冊表在多次調用中保證產出絕對一致的條目排列順序 |
| Server identity | 建議封裝於回應 `_meta` 中的 `io.modelcontextprotocol/serverInfo` 伺服器識別資訊 |
| Tool error | 合法發起但工具自身業務執行失敗時回傳的成果，標註有 `isError: true` |
| Protocol error | 協定格式畸形或請求非法時，直接透過 JSON-RPC `error` 欄位拋出的錯誤 |

## Further Reading｜延伸閱讀

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/) ——MCP 官方最新無狀態協定規範
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) ——動態服務發現官方規範手冊
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) ——工具定義與執行生命週期手冊
- [MCP Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) ——資源探測與讀取官方規格
- [MCP Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts) ——Prompt 範本定義與彩現指南
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio) ——標準輸入輸出傳輸層規範
