# 無狀態協定上的 MCP Apps（MCP Apps on the Stateless Protocol）

> 互動式視覺化結果本質上依然是標準的 MCP 工具與資源交換。2026-07-28 核心規範使該交換過程完全自包含獨立，而 Apps 擴充功能則在此之上引入了受沙盒保護的瀏覽器彩現介面。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 透過 `server/discover` 與逐請求的擴充能力宣告，標準宣告對 MCP Apps 的支援。
- 在工具被正式呼叫之前，於工具定義中預先宣告其綁定的 `ui://` 資源。
- 在 2026-07-28 無狀態傳輸通訊上，回傳完整的工具呼叫與資源讀取成果。
- 嚴格區分 Apps 內部的 `ui/initialize` 橋接訊息，與已從 MCP 核心規範中徹底除名的舊版初始化交握。
- 落實 Origin 來源校驗、iframe 沙盒化、CSP 內容安全策略與最小權限原則。

## The Problem｜問題

純文字的回傳結果可以描述一條時間軸；但它無法為使用者呈現一個能夠自由篩選、放大檢視或直接點選操作的動態時間軸。

MCP Apps 透過選用的擴充功能優雅解決了呈現難題。工具定義指向一個專屬的 `ui://` 資源。宿主環境能夠在工具正式執行前預先抓取並審查該資源、在受沙盒嚴密保護的 iframe 內部將其彩現，並透過安全的 JSON-RPC 雙向橋接層代理轉發該應用程式的所有後續操作。

MCP 核心協定在 2026-07-28 規範中發生了重大變革。絕不要將現代 App 嵌套進過時的傳統連線生命週期中：

- 核心協定中完全不存在 `initialize` 請求或 `notifications/initialized` 通知；
- 完全不存在 `Mcp-Session-Id` 標頭；
- 每一個請求皆在 `params._meta` 中獨立攜帶協定版本與用戶端能力宣告；
- 伺服器必須實作 `server/discover`，以供用戶端檢視版本、核心能力與擴充功能；
- 每個成功的回應皆標註有 `resultType` 鑑別欄位；
- Streamable HTTP 規範下每個請求皆是一次獨立的 POST；傳統的 GET 與 DELETE 入口端點皆堅決回傳 405。

Apps 橋接層內部雖然依然存在名為 `ui/initialize` 的方法，但它純屬 iframe 與宿主外框之間的 postMessage 本機方言，絕非在協定層面重建了 MCP 核心連線階段。

## The Concept｜核心概念

### 兩套協定，一項功能

請在架構層面保持邊界清晰：

1. MCP 核心協定負責傳輸 `server/discover`、`tools/list`、`tools/call`、`resources/list` 與 `resources/read`。
2. MCP Apps 擴充功能負責宣告 UI 視圖，並規範 iframe 與宿主之間的通訊橋樑。
3. 瀏覽器沙盒規則強制約束該 UI 所能存取的實體邊界。

該擴充功能的官方識別碼為 `io.modelcontextprotocol/ui`。通訊雙方皆需顯式宣告支援。用戶端在發起的每一次請求中，皆於能力物件內部宣告對該擴充功能的相容支援：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo` 僅供前端診斷除錯之用，純屬用戶端自我宣告，絕非授權身分憑證。

### 彩現前必須先進行服務發現

伺服器的服務發現成果中，應當明確宣告該擴充功能：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

伺服器必須強制支援服務發現。但用戶端並非必須在每次操作前強行調用服務發現，因為每個實體動作本身就已攜帶了完整的自包含能力宣告。

### 在工具宣告中綁定 UI 資源

現代 Apps 協定在 `tools/list` 中將 UI 視圖與具體工具進行顯式綁定：

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

這是刻意設計的「呼叫前（Pre-call）」後設資料。宿主環境因此能夠在工具成果真正要求顯示之前，預先下載、快取並對該 HTML 範本進行安全程式碼審計。舊版的扁平後設資料鍵值雖為相容性而可被寬容接受，但全新伺服器應當一律輸出規範的巢狀 `_meta.ui.resourceUri` 格式。

`tools/list` 在現代核心規範中屬於可快取操作。必須包含確定性排序、`ttlMs` 與 `cacheScope`。若可見工具清單隨使用者或 Token 而變動，請標註為 `private`。

### 回傳資料，交由宿主綁定視圖

工具呼叫回傳常規的文字內容外加結構化業務資料：

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

宿主在此之前就已精確知曉該工具綁定哪一個 UI 視圖。避免為了重複宣告同一個 URI，而憑空發明非標準的自訂內容區塊。

### 將應用程式作為資源對外提供

伺服器在服務發現中宣告了 `resources` 能力，因此它亦必須實作必備的 `resources/list` 操作。其確定性清單項目包含標準 URI、穩定名稱、描述說明以及 MIME 型別。清單回傳結果包含 `resultType`、伺服器識別後設資料、`ttlMs` 與 `cacheScope`。

宿主發送 `resources/read` 請求。在 Streamable HTTP 規範下，該請求結構如下：

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

HTTP 標頭數值必須與 JSON-RPC Request Body 內容完全相符。任何衝突矛盾皆屬於協定錯誤 `-32020`。

回傳結果包含實體 HTML 資源與相應的快取控制建議：

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### 將 UI 資源作為可執行內容進行快取

App 資源絕不能與一般的靜態文字混為一談。其快取條目能夠在前端執行橋接程式碼、彩現工具資料，並請求宿主代理執行高特權操作。因此，其快取鍵值必須完整包含：規範的 `ui://` URI、經准入核准的伺服器識別資訊與版本、資源內文特徵雜湊（Digest），以及當 `cacheScope` 為 private 時的具體授權安全上下文。絕不能跨不同的使用者主體共享私有的 App 資源，因為即便 URI 完全相同，其內部的 HTML 程式碼或安全策略後設資料亦可能存在顯著差異。

當發生以下情況時，必須立刻使快取條目失效：`ttlMs` 存活期滿、工具的 `_meta.ui.resourceUri` 綁定關係變更、伺服器版本或描述符鎖定變動，或是收到標明該 URI 的資源變更訂閱通知。在重新掛載視圖前，必須重新拉取並重新實施嚴格的 CSP 與權限審查。過期的 iframe 絕不能僅因為新版資源尚未載入完成，就繼續保留原先寬鬆的高特權。

### 在執行功能策略前先排除傳輸歧義

校驗邏輯有著嚴密的先後順序：首先校驗 JSON-RPC 封裝結構，要求字串型別的協定後設資料與物件型別的能力宣告對映；隨後比對 HTTP 路由標頭與 Request Body 內文是否完全吻合；只有在此之後，才正式判定該協定版本是否被本伺服器支援。該順序能防止代理閘道器與後端服務對同一個請求產生歧義解讀。

| 觸發條件 | HTTP 狀態碼 | JSON-RPC 錯誤碼 |
|---|---|---|
| 標頭與 Body 中的版本、方法或名稱出現衝突 | 400 | `-32020` |
| 標頭與 Body 一致同意了一個不受支援的協定版本 | 400 | `-32022`，`data` 嚴格為 `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| 調用 `resources/read` 但缺少 Apps 擴充能力宣告 | 400 | `-32021`，附帶 `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| 請求的方法不存在 | 404 | `-32601` |

JSON-RPC 單向通知不帶 `id`，伺服器絕不可為其回傳 JSON-RPC 回應。接收合法的 HTTP 單向通知時回傳空內文的 202。業務錯誤可以改變 HTTP 狀態碼，但依然絕不能憑空為通知構造 JSON-RPC 錯誤內文。

### 沙盒是防禦邊界，而非信任審查判決

宿主環境全權控制 iframe 的執行邊界。App 絕無法直接讀取宿主的 Cookie、Local Storage 或外層 DOM 結構。所有跨邊界特權操作，皆必須嚴格經過橋接層調度。

請恪守以下安全預設：

- 將所有 CSP 網域白名單預設置空，僅在 App 明確需要時按需加入特定來源。使用 `connectDomains` 控管 Fetch、XHR 與 WebSocket；使用 `resourceDomains` 控管外部 Scripts、Styles、圖片與字型。
- 在條件允許時，盡可能將程式碼與資源打包為單一自包含檔案。
- 除非有明確可見的功能需求，否則絕不索求攝影機、麥克風或地理位置權限。
- 將 `postMessage` 嚴密鎖定於精確的通訊對等來源，堅決拒絕來自任何其他 Origin 的事件。
- 將工具引數、工具成果、資源文本與橋接訊息，一律視為不可信的外部輸入。
- 使用者授權確認的控制權必須牢牢留在宿主環境手中。iframe 絕不能自我核准自身的實體破壞性動作。

絕不要從網路教學中盲目複製固定的 `sandbox` 屬性。宿主必須依據 App 的 Origin 模型與自身的安全隔離架構，量身配置最適標記。

列入白名單的網域依然存在資料外洩（Exfiltration）的潛在風險。宣告 `connectDomains: ["https://api.example.com"]` 意味著在 App 內部執行的任何腳本，皆有能力向該位址發送已獲准的資料。精確的 Origin 匹配能防止目標混淆，但它無法判定傳輸的負載內容是否合規。預設將連線權限置空、避免在 iframe 中安放 Bearer Token、在條件允許時透過宿主進行細粒度代理、嚴格限制請求與回應的位元組大小，並嚴密審計每一次對外網路請求是由哪一項具體使用者操作所觸發。嚴格將 `resourceDomains` 與 `connectDomains` 拆分管理；下載字型或腳本的權限，絕不應賦予隨意上傳機密資料的通道。

### Apps 橋接層具備獨立的通訊生命週期

Apps 橋接層本質上是運作於 `postMessage` 之上的 JSON-RPC 方言。它負責交換 `ui/initialize` 與 `ui/*` 系列通知，並可代理轉發類似 `tools/call` 的核心操作。

視圖（View）發送攜帶 `appInfo` 與 `appCapabilities` 物件的 `ui/initialize`。宿主回傳自身的能力宣告與上下文環境。唯有在收到該回應後，視圖方可發送 `ui/notifications/initialized`。宿主必須在收到該 Apps 通知後，才被允許向視圖發送後續業務訊息。

這次本機交握純粹是單一 iframe 與宿主外框之間的局部連線建立。它絕不協商 MCP 核心協定版本、不建立伺服器全域狀態，亦不簽發任何傳輸層連線階段。請特別注意命名空間前綴：核心協定中的 `notifications/initialized` 已被徹底廢除，而專屬於 Apps 的 `ui/notifications/initialized` 則合法保留。由橋接工具呼叫所產生的任何核心請求，皆是一次全新的獨立請求，帶有全新的 JSON-RPC ID 與完整的自包含後設資料。

### 宿主上下文、動作執行與權限撤銷

在橋接層完成初始化後，宿主依然是最終的權威仲裁者。視圖僅能透過宿主預先宣告開放的能力，請求發起工具動作、網頁跳轉、剪貼簿存取或執行其他特權效果。宿主嚴格校驗請求型別、當前使用者、目標物件與引數內容，實施授權策略，並有權隨時予以拒絕。按鈕點選與合法的橋接訊息僅代表使用者的發起意圖；兩者皆不能直接轉化為執行權限。

將主題佈景、視窗尺寸與無障礙特性視為動態變化的宿主上下文，而非單次彩現的靜態輸入：

- 套用宿主提供的色彩與排版 Token，並在使用者切換明暗主題或對比度偏好時即時響應。
- 允許視圖回報其期望的幾何尺寸，但宿主有權對 iframe 實施硬性尺寸約束與裁切，防止內容逃逸破壞外層版面或製造欺騙性的重疊浮層。
- 在 iframe 內部完好維持鍵盤導航順序、可見焦點指示器、無障礙名稱、螢幕閱讀器狀態、充足的色彩對比度、縮放比例與減弱動畫偏好。
- 在視窗重設尺寸或重新彩現後，嚴格重新測試宿主控制項與視圖控制項之間的焦點切換流暢度。

在 App 處於開啟狀態期間，權限隨時可能因使用者切換帳號、安全策略變更、伺服器被隔離審查或宿主收窄授權而遭到動態撤銷。必須在「實施動作的當下」即時覆核能力與授權，而非僅在 `ui/initialize` 時檢查一次。一旦權限遭到撤銷，應當立刻拒絕正在等待執行的特權呼叫、中斷不再符合策略的網路活動、清除已彩現的敏感狀態資料，並在 UI 資源本身不再被准入時直接卸載重置或平滑降級為純文字展示。視圖必須將宿主的拒絕執行視為常規的業務結果，絕不能死皮賴臉地反覆重試直至宿主崩潰。

### 純文字降級回退是協定契約的一部分

具備 Apps 能力的伺服器，依然必須優雅相容未宣告 UI 擴充功能的普通宿主環境：

- 在 `tools/list` 中回傳不帶 `_meta.ui` 的同名工具；
- 為 `tools/call` 保留高價值且可讀性強的純文字回傳結果；
- 當此類宿主試圖存取 `resources/read` 讀取 UI 資源時，回傳缺少能力的合法錯誤；
- 在判定工具是否執行成功時，絕不可假設存在實體 iframe 視圖。

```figure
t3-ui-sandbox
```

## Build It｜動手實作

`code/main.py` 在完全不依賴任何外部重型 SDK 的前提下，實作了小巧精悍的協定模型。它嚴格校驗當前請求信封與 Streamable HTTP 路由標頭、透過 `server/discover` 宣告 Apps 支援、列舉工具與資源清單、執行實體工具，並對外提供自包含的 HTML 視圖資源。

該實作模型接收已解析完成的 Body 內文與路由標頭。它並非全功能的完整 HTTP 伺服器，因此不對 `Content-Type` 與 `Accept` 進行底層字串解析。請參考第 09 課取得嚴格要求 `Content-Type: application/json` 以及包含 `application/json` 與 `text/event-stream` 之 `Accept` 標頭數值的完整 Streamable HTTP 轉接層實作。

執行方式：

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
python3 -m unittest discover code/tests -v
```

在輸出日誌中重點檢驗五大不變量：

1. 每一次方法調用皆完全自包含且互相獨立。
2. 每個請求皆在 `_meta` 中完整攜帶能力宣告。
3. 在讀取任何實體資源前，`resources/list` 能回傳穩定的描述符。
4. 每個成功回應皆標明 `resultType` 並附帶伺服器識別後設資料。
5. 全流程完全不存在任何核心協定連線階段識別碼。

## Use It｜實際應用

首先調用 `server/discover`。確認 `io.modelcontextprotocol/ui` 順利出現在伺服器的擴充能力映射表中。隨後調用兩次 `tools/list`：一次攜帶 Apps 能力宣告，另一次則不宣告。第一次回應應當成功宣告綁定的資源；第二次回應則維持為完全可用的純文字工具。

發起讀取 `ui://notes/timeline.html`。在回傳的 HTML 程式碼中檢索 `hostOrigin` 以及 `event.origin` 安全防護守衛。這兩行程式碼是證明橋接層絕未使用萬用字元（Wildcard）目標的最小可見安全證據。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-apps-spec.md`。在著手編寫具體框架程式碼前，請隨時使用該工具審查 App 協定契約。它強制設計者清晰定義現代核心信封結構、擴充協商機制、降級回退方案、UI 資源定址、快取策略、CSP 網域白名單、特權宣告、橋接方法定義以及使用者授權邊界。

## Exercises｜練習

1. 將用戶端能力修改為空的擴充字典。確認 `tools/list` 依然保留該工具，但主動剝離了 UI 資源綁定後設資料。
2. 發送帶有 `Mcp-Name: ui://notes/other.html` 的 POST 請求，但 Body 內文請求讀取 timeline。確認伺服器精準回傳 `-32020` 標頭不符錯誤。
3. 將該資源的快取宣告修改為 `cacheScope: private`。詳細闡述足以支撐此項決策的使用者特定私有業務情境。
4. 將 HTML 內部的腳本移出至外部靜態服務 `https://static.example.com/app.js`。將該來源加入 `resourceDomains` 白名單，並深度分析此舉引入的全新軟體供應鏈安全風險。
5. 新增一個 `notes_open` 開啟工具，並將按鈕點選事件透過宿主環境進行代理轉發。確保使用者確認授權的控制權嚴格保留在宿主層。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| MCP Apps | 選用擴充功能；由 MCP 宿主環境在沙盒中彩現互動式 HTML 應用程式 |
| `io.modelcontextprotocol/ui` | 通訊雙方在能力宣告中共同聲明的官方擴充功能唯一識別碼 |
| `ui://` | 專屬於 MCP App UI 範本資源的標準 URI 協定架構 |
| `text/html;profile=mcp-app` | 標明該 HTML 為標準 MCP App 視圖的專屬 MIME 媒體型別 |
| `server/discover` | 現代標準 RPC 方法；用於動態探測協定版本與各層級擴充能力 |
| `resources/list` | 當伺服器宣告支援資源時，強制必須實作的資源清單列舉端點 |
| `resultType` | 現代所有成功成果最外層強制必備的鑑別欄位 |
| `ui/initialize` | 運作於 iframe 橋接層的首條初始化請求，與核心協定已廢除的交握完全無關 |
| `ui/notifications/initialized` | 視圖在接收到宿主初始化回應後發送的就緒通知；宿主需等待此通知方可通訊 |
| CSP | 內容安全策略；瀏覽器層級用於嚴格限制腳本、樣式、影像與網路連線來源的防禦機制 |
| Text fallback | 純文字降級回退；針對未宣告支援 Apps 的普通宿主環境所保留的標準工具能力 |

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic) ——最新基礎協定標準手冊
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview) ——MCP Apps 架構官方綜述
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build) ——建置互動式 UI 應用程式實戰指南
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix) ——各大主流用戶端對擴充功能支援度清單
