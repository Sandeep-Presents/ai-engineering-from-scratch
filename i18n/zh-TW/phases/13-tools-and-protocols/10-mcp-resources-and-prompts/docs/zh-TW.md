# MCP 資源與 Prompt 範本：無狀態伺服器的可定址上下文（MCP Resources and Prompts: Addressable Context for Stateless Servers）

> 工具負責執行具體操作。資源負責對外暴露可定址內容。Prompt 則負責封裝由使用者手動選取的對話訊息範本。一個優秀的 MCP 伺服器，會將這三種契約清晰劃分、維持高度可預期性。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 從調用者的真實意圖出發，在工具、資源與 Prompt 三者之間做出精確架構選擇。
- 透過強制必備的 `server/discover` 介面，規範宣告伺服器的資源與 Prompt 能力範圍。
- 打造具備絕對確定性排序的 `resources/list` 與 `prompts/list` 回傳結果。
- 正確配置 `ttlMs` 存活時間與 `cacheScope` 快取作用域，杜絕特定使用者的隱私資料跨權限外洩。
- 針對格式無效或不存在的未知資源 URI，精準回傳 JSON-RPC 錯誤碼 `-32602`。
- 開啟 `subscriptions/listen` POST 長回應串流，並透過訂閱 ID 精確關聯所有推送的事件。
- 嚴格將資源本體內容與 Prompt 範本視為不可信的外部資料，做好安全隔離防禦。

## Start With the Consumer｜從調用者意圖出發

在設計 MCP 系統時，最容易犯下的工程錯誤就是直接從後端實作程式碼出發：因為熟悉函式，就將資料庫查詢寫成工具；因為剛好存在檔案中，就把可重複使用的業務工作流寫成資源；因為宿主能夠注入系統提示，就將 Prompt 變成了隱藏的黑箱安全策略。

正確的做法是：始終從「誰負責挑選」以及「調用者預期獲得什麼」出發。

| 原語名稱 | 核心意圖 | 挑選與觸發的主體 | 典型的產出成果 |
|---|---|---|---|
| 工具（Tool） | 執行實體業務操作 | 大模型或自動化應用程式 | 結構化的操作結果 |
| 資源（Resource） | 依 URI 讀取具體內容 | 宿主環境、應用程式或使用者 | 純文字或二進位資料內容 |
| Prompt 範本 | 啟動可重複使用的訊息工作流程 | 使用者透過宿主 UI 手動選取 | 一條或多條預先編排的對話訊息 |

儲存於 `notes://note-1` 的這則筆記，本質上是資源，因為它是可定址的內容；`delete_note` 是工具，因為它實質變更了外部狀態；`review_note` 是 Prompt，因為它是使用者手動點選的一套預製審查對話流程。

絕不要僅僅為了讓 API 介面「看起來琳瑯滿目」，就將同一項操作同時暴露為工具、資源與 Prompt。每一個額外的暴露端點，都需要額外承擔服務發現、授權鑑權、快取管理、錯誤處理、自動化測試以及文件維護的長期工程負債。

## The 2026-07-28 Stateless Envelope｜2026-07-28 無狀態協定信封

本課針對 MCP 協定最新修訂版 `2026-07-28` 規範展開建置。在此規範設定下，完全不存在任何初始化交握（Handshake）或協定層級的連線工作階段（Protocol Session）。每一個獨立發起的請求，皆必須在保留的 `_meta` 欄位中攜帶自身的協定版本與用戶端能力宣告。

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

伺服器必須強制實作 `server/discover`。其回傳成果對外公開該伺服器支援的協定版本清單、資源與 Prompt 能力、實作識別資訊以及快取控制建議。用戶端完全可以直接呼叫具體業務方法，但服務發現能在建構前端 UI 之前，為用戶端提供一份穩定清晰的宏觀能力快照。

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

一個常規的成功回應，其最外層必須宣告 `"resultType": "complete"`。回應的 `_meta` 透過 `io.modelcontextprotocol/serverInfo` 標註提供服務的實作身分。該資訊僅作為診斷與除錯排查之用，絕不可作為替代安全認證的憑證。若請求攜帶了不支援的協定版本，伺服器必須回傳 `-32022` 錯誤，並同時包含請求版本與支援版本清單。

無狀態契約從根本上重塑了你的系統設計思維：清單查詢結果絕不能依賴同一條實體連線上的歷史呼叫記憶。使用者的權限憑證是隨每一次請求即時傳入的輸入引數，可據此動態過濾可見集合；但實體連線歷史絕不可作為判斷依據。

## Resources Are Stable URI Contracts｜資源是穩定的 URI 契約

資源是由 URI 唯一定位的資料內容。在著手撰寫處理函式之前，務必先精準設計其 URI 命名規範。

優秀 URI 具備的關鍵特性：

- 具備足夠的穩定性，適合被加為書籤或跨請求傳遞。
- 具備明確綁定至伺服器業務網域的命名空間。
- 完全獨立於作業系統行程 ID 或底層網路連線。
- 在存取底層持久化儲存之前，必須實施嚴格的語法格式校驗。
- 在每一次讀取時，皆必須重新實施權限鑑權。

使用 `notes://note-1` 明顯優於模糊的 `note-1`，因為其命名空間界限分明。一個檔案伺服器可以使用 `file://` URI，但在解析符號連結（Symlink）與相對路徑之後，依然必須嚴格檢驗其是否超出配置的安全目錄邊界。

`resources/list` 回傳當前對呼叫者可見的所有資源清單。必須依據穩定鍵值（例如 URI 字串）進行確定性排序。確定性的輸出順序能防止不必要的快取失效抖動、避免產生隨機漂移的快照，並防止宿主前端 UI 在每次重新整理時發生項目跳動。

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read` 回傳一個或多個具體內容項目。面對不存在的未知 URI，絕不能當作成功的空白內容回傳。現行的資源協定規範將無效或未知的資源 URI，嚴格歸類為 JSON-RPC 無效參數錯誤，錯誤碼為 `-32602`。

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

這項區分讓用戶端能夠精準辨識「資源真實不存在」與「資源存在但內容恰好為空」的本質差異，並徹底杜絕了誤回退至寬泛全局查詢的連鎖事故。

### 資源範本（Resource Templates）

資源範本描述了一組帶有參數化變數的 URI 家族。當具體資源數量極其龐大甚至無窮無盡時，應當採用範本宣告，而非試圖在清單中全量枚舉。例如 `notes://projects/{project}/decisions/{decision}` 明確告知了用戶端該如何組合出合法的目標位址，而無需在啟動時預先回傳所有決策紀錄。

範本絕不會削弱安全校驗。解析變數、實施權限檢查、強制約束長度與合法字元集，並使用強型別參數建構資料庫查詢。嚴禁直接將未經校驗的任意 URI 片段直接拼接進檔案系統路徑或 SQL 查詢語句中。

### 內容並非可信指令

資源文本中極可能潛藏提示注入攻擊（Prompt Injection）、機密資訊、誤導性指令或惡意畸形標記。宿主環境必須忠實保留資料來源出處，並始終將資源內容嚴格視為不可執行的純資料。伺服器端則應嚴格限制內容大小、標註精確的 MIME 媒體型別、過濾呼叫者無權存取的敏感欄位，並避免夾帶無關的旁路紀錄。

## Prompts Are User-Controlled Templates｜Prompt 是使用者控制的範本

MCP 的 Prompt 專為「使用者顯式主動選取」而量身設計。宿主環境可將其彩現為斜線指令（Slash Commands）、選單操作項或工作流快捷按鈕。協定本身並不強加任何單一 UI 展現形式。

在面對相同的請求授權時，`prompts/list` 的回傳結果應當保持確定性排序。每個 Prompt 皆需要穩定的唯一名稱、詳盡的使用說明，以及明確的引數宣告，以便宿主在正式調用 `prompts/get` 之前能夠向使用者採集必備輸入。

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get` 負責將使用者傳入的引數解析並彩現為具體的對話訊息清單。它絕不能覆蓋或替換宿主自身的系統指令（System Instructions）。宿主全權決定回傳的訊息該如何編排進大模型的上下文視窗中，並始終讓自身的內部信任策略享有最高優先權。

必須在伺服器邊界處對 Prompt 引數進行嚴格校驗。Prompt 中引用的資源 URI，必須通過與直接執行資源讀取完全相同的授權檢查。絕不能讓 Prompt 淪為繞過資源存取權限控制的旁路後門。

## Cache Hints Are Part of Correctness｜快取提示是系統正確性的一部分

`ttlMs` 告知用戶端該成果在多少毫秒內可被安全復用。`cacheScope` 則定義了該快取成果允許被誰共享。

| 作用域標記 | 實際意義 | 典型應用場景 |
|---|---|---|
| `public` | 在權限允許的前提下，可在不同使用者之間共享復用 | 全域公開的 Prompt 範本目錄 |
| `private` | 嚴格綁定於發起請求的特定使用者或憑證上下文 | 使用者個人擁有的私有筆記內容 |

應依據資料的實際變更頻率以及資料過期帶來的業務風險，科學設定 TTL。五分鐘適合公開穩定的 Prompt 目錄；而私有筆記的讀取則宜設定為一分鐘甚至更短。

MCP 規範僅定義了 `public` 與 `private` 兩種合法的 `cacheScope` 數值。對於包含高敏感機密或變動極其頻繁的結果，應回傳 `cacheScope: "private"` 搭配 `ttlMs: 0`，隨後由宿主快取策略執行嚴格的禁止儲存（No-store）規則。`no-store` 本身並非 MCP 協定層級的合法 `cacheScope` 枚舉值。

快取提示絕不能替代實體權限鑑權。快取鍵值（Cache Key）必須完整包含所有會改變資料可見性的請求維度——包含租戶 ID、使用者身分、授權範圍、語言區域以及分頁游標。若共享快取層無法安全表達這些維度，請一律設定為 `private` 搭配 0 存活時間，並在宿主層強制啟用不落地策略。

## Subscriptions Use a Client-Opened Response Stream｜訂閱機制採用用戶端發起的長回應串流

現代事件訂閱機制徹底取代了舊有的 `resources/subscribe` RPC 呼叫以及歷史上的 HTTP GET 事件端點。

用戶端以標準的 JSON-RPC 請求發起 `subscriptions/listen`。在 Streamable HTTP 傳輸層上，這是一次 POST 請求，其 HTTP 回應保持開啟，轉化為一條長期的 SSE 串流。請求中的 `notifications` 物件本質上是一份白名單；伺服器**絕不允許**推送任何未被用戶端顯式勾選訂閱的事件類型。

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

該請求的 ID 即代表本次連線的訂閱 ID（Subscription ID）。在推送任何被訂閱的實體事件之前，伺服器必須先發送 `notifications/subscriptions/acknowledged` 確認通知。其內部回傳的過濾規則，僅包含伺服器實際核准接受的子集。

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

後續在該串流上推送的每一個實體事件，其後設資料中皆必須原樣攜帶相同的訂閱 ID。

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

通知訊息僅代表「目標資源發生了變更」。用戶端必須重新透過 `resources/read` 主動發起讀取，並在當前權限下接受完整鑑權。用戶端絕不能預設通知事件本身就包含更新後的最新文件。

多個獨立的訂閱可以共享同一個 stdio 傳輸通道。訂閱 ID 讓用戶端能夠在前端安全地解多工分流。在 HTTP 環境下，關閉回應串流即直接等同於取消訂閱。若伺服器優雅地正常結束串流，必須回傳一個與原始請求 ID 精確關聯的終態 `resultType: "complete"` 回應。

絕不要將訂閱串流誤當作協定層級的連線工作階段。後續發起的任何資源讀取，依然是一次獨立完整的常規請求，能夠被安全轉發至叢集中的任何健康伺服器實例。

```figure
t3-primitive-sort
```

## Interactive Lab｜互動實驗室

利用架構圖為專案管理追蹤系統的五項核心能力進行精準歸類：查看 Issue 詳情、建立新 Issue、Sprint 審查範本、專案規範方針、以及關閉 Issue。隨後決策哪些清單允許被公開快取、哪些讀取必須保持私有，以及哪些資源值得配置即時更新通知。

在進行每一次架構分類時，請大聲指出其「決策主體」是誰：若是大模型自主發起的動作，宣告為工具；若是宿主環境讀取以 URI 定址的內容，宣告為資源；若是使用者手動啟動一套預製的對話流程，宣告為 Prompt。

## Practice Lab｜動手實踐實驗室

在儲存庫根目錄下執行模擬器常式：

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

依照以下嚴謹順序逐一檢視日誌軌跡：

1. 確認 `server/discover` 正確宣告了當前最新規範版本與雙重能力支援。
2. 確認兩個清單查詢結果皆具備確定性排序，且皆使用 `resultType: "complete"`。
3. 確認清單與讀取結果皆精確攜帶了合規的快取控制建議。
4. 將讀取 URI 刻意改為 `notes://missing`，親眼觀察標準錯誤碼 `-32602` 的拋出。
5. 確認訂閱確認通知（Acknowledged）嚴格發生在實體資源變更事件之前。
6. 確認推送的事件與優雅關閉訊息，皆正確攜帶了相應的訂閱 ID `5`。

Python 模擬程式碼並未建立真實的實體 HTTP 連線，它精準呈現的是 SDK 必須在請求範疇長回應串流中安放的合法訊息結構。在正式環境中，請務必採用官方 SDK 處理底層傳輸與封裝。

## Shipped Artifact｜交付成品

本課產出 `outputs/skill-primitive-splitter.md`。這是一份專用於 MCP 原語架構選型的專業設計審查工具。它能自動檢驗確定性服務發現、快取作用域宣告、無效 URI 邊界處理以及現代長連線訂閱過濾規則。

本課同時交付 `assets/primitive-split.svg`，作為線下研讀原語劃分與訂閱邊界的靜態架構手冊。

## Verify It｜驗證成果

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

預期結果：主程式印出結構化 JSON 日誌，且單元測試指令回報至少 12 項測試全數順利通過（PASS）。

## Capstone Connection｜專題連結

當你的 Capstone 專題伺服器在提供操作動作的同時、亦需暴露可定址的知識資產時，請嚴格恪守此契約。成果中應包含一份確定性目錄快照、一次通過授權審查的資源讀取、一次 Prompt 範本解析、一個無效 URI 的標準錯誤處理案例，以及一份完整的事件訂閱日誌。

你的交付驗收證據應當確鑿證明：任何清單查詢絕不依賴實體連線歷史記憶，且訂閱事件的推送絕不能直接賦予對底層資源實體的免鑑權存取權限。

## Exercises｜練習

1. 新增一個 `notes://projects/{project}/notes/{id}` 資源範本，並在處理器中對這兩個路徑變數實施雙重合法性校驗。
2. 為 `resources/list` 端點擴充安全分頁機制，並證明在分頁檢索下依然完好保持確定性排序。
3. 將某一項敏感資源修改為 `cacheScope: "private"` 搭配 `ttlMs: 0`，並配置宿主層級的禁止儲存策略；詳盡論證支撐這兩重防禦管制的安全威脅模型。
4. 新增一條針對 Prompt 清單變更的訂閱規則；證明當過濾條件未包含 `promptsListChanged` 時，伺服器絕不會錯誤推送相應事件。
5. 同時建立兩條平行的獨立訂閱串流，證明在並發推送時，每個事件皆精準攜帶了各自正確的請求 ID。
6. 在資源讀取處理常式中加入授權主體檢查，證明同一份快取條目絕不可跨越不同的安全主體邊界被非法挪用。

## Key Terms｜關鍵術語

- **Resource（資源）**：由 MCP 伺服器對外公開、具備唯一 URI 定址能力的內容資料資產。
- **Prompt（Prompt 範本）**：由 MCP 伺服器對外公開、由使用者顯式手動觸發的對話訊息範本。
- **Deterministic list（確定性清單）**：在相同請求輸入下，保證回傳項目成員與物理排列順序絕對穩定的探測結果。
- **`ttlMs`**：快取新鮮度存活時間，以毫秒為計量單位。
- **`cacheScope`**：快取成果的共享邊界約束。
- **`subscriptions/listen`**：長期存活的長回應請求，其串流僅定向推送通過顯式白名單過濾的變更通知。
- **Subscription ID（訂閱 ID）**：最初發起監聽的請求 ID，在後續推送的所有通知後設資料中原樣重複攜帶。
- **Invalid parameters（無效參數錯誤）**：標準 JSON-RPC 錯誤碼 `-32602`，在此專門用於回報無效或不存在的未知資源 URI。
- **Unsupported protocol version（不支援的協定版本）**：標準 JSON-RPC 錯誤碼 `-32022`，包含 `supported` 與 `requested` 版本修訂清單。
- **`server/discover`（服務發現）**：強制必備的現代伺服器方法，宣告支援版本、能力、識別資訊與快取建議。

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) ——官方資源規範手冊
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts) ——官方 Prompt 範本規範手冊
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) ——長連線事件訂閱模式手冊
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching) ——快取控制建議與安全邊界手冊
