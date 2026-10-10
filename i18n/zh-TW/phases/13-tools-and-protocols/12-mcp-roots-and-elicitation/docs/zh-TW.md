# 明確範圍界定與無狀態引導問答（Explicit Scope and Stateless Elicitation）

> Roots 機制在 MCP 2026-07-28 規範中已被正式廢棄，且它從來不是安全沙盒。請將操作範圍顯式宣告於可見的工具引數或資源 URI 中，由伺服器端實施嚴格鑑權，並在工具確實需要使用者輸入時採用無狀態 MRTR 模式。使用者能清晰看見審核決策，模型能明確取得操作識別代號，且叢集中的任何伺服器實例皆能順暢處理後續重試。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 以顯式工作區參數、資源 URI 或伺服器靜態設定，徹底取代已被廢棄的 Roots 機制。
- 嚴格區分「範圍提示（Scope Hints）」與實體「授權鑑權」、「路徑邊界限制」以及「作業系統層級沙盒防護」的本質差異。
- 透過 MRTR 的 `input_required` 回應結果，交付表單模式（Form-mode）的 `elicitation/create` 引導式輸入。
- 在逐請求的用戶端能力宣告中宣告 Elicitation 支援，並堅決拒絕不被支援的模式。
- 正確校驗並區分 `accept`（接受）、`decline`（拒絕）與 `cancel`（取消）三種截然不同的決策狀態。
- 將具破壞性動作的確認狀態，嚴密綁定至已認證主體、原始引數、候選目標集合以及硬性過期時間。

## Two Problems That Look Similar｜看似相似的兩大本質問題

設想一個筆記管理工具接收到以下操作請求：「刪除舊的 TPS 報告。」

伺服器在此必須獨立回答兩個本質迥異的問題：

1. 本次操作允許存取觸碰哪一個工作區目錄？
2. 在匹配到的三篇同名筆記中，使用者具體指的是哪一篇？

第一個問題屬於「範圍邊界（Scope）與授權鑑權」範疇；第二個問題則屬於「互動式消除歧義」範疇。將兩者混為一談極易引發災難性安全漏洞——例如誤將用戶端傳入的資料夾路徑，當作「呼叫者已被授權刪除該目錄下所有檔案」的荒謬憑證。

## Roots Are a Migration Surface｜Roots 僅是向下相容的過渡表面

在早期的 MCP 修訂版中，用戶端可以向伺服器宣告 Roots 清單，並在清單變更時推送通知。Roots 從誕生之初就僅純屬提示性參考指南：它既不約束伺服器行程實際能夠讀取的底層路徑，也不對呼叫端進行身分授權，更無法建立作業系統層級的安全沙盒。

MCP 2026-07-28 規範針對新系統正式廢棄了 `roots/list` 與 `notifications/roots/list_changed`。強烈建議改採以下顯式替代方案：

- 當操作範圍隨呼叫動態變化時，宣告顯式的 `workspaceUri` 或 `directory` 工具引數。
- 當操作本身即針對特定資源時，直接使用資源 URI 定址。
- 當單一伺服器部署僅專屬綁定單一固定工作區時，透過伺服器組態設定檔硬性鎖定。
- 當必須在物理層面徹底杜絕程式碼越權逃逸時，採用作業系統行程沙盒或 Jailed 檔案系統隔離。

若現有系統在過渡期內依然依賴 `roots/list`，伺服器必須將其封裝進 MRTR 的 `inputRequests` 中，絕不可直接發起即時的逆向請求。這純屬向下相容過渡橋樑；全新實作應全面轉向顯式宣告。

顯式的資源或工作區識別碼，模型能夠清晰看見、記憶並在後續呼叫中精確重現；而隱藏於傳輸層連線階段中的黑箱範圍，則極難被人類審計、除錯重播、安全審查以及進行負載路由。

### 三層防禦原則（The Three-Layer Rule）

一個顯式宣告的 URI 本身絕不能直接充當授權依據。必須嚴格落實三重縱深防禦：

1. **授權鑑權（Authorization）**：當前已認證的使用者主體，是否具備存取該工作區的合法權限？
2. **路徑限制（Containment）**：規範化還原後的目標 URI，是否嚴格受限於授權工作區的物理邊界之內？
3. **作業系統沙盒（Sandbox）**：即使伺服器程式碼遭到漏洞攻破，作業系統層級的沙盒機制能否阻止其逃逸至未授權目錄？

一個健全的伺服器必須維護授權工作區的白名單、將 URL 百分比編碼的路徑進行標準化解碼還原、嚴格比對真實的路徑元件邊界，並在執行實體刪除的前一刻再次進行邊界覆核。

幼稚的字串前綴比對存在致命漏洞：

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

上述兩條惡意路徑皆以表面合法的字串開頭。必須先進行標準化路徑解析，隨後逐級比對目錄路徑元件。正式環境的檔案伺服器還必須嚴密防範符號連結（Symlink）競爭條件攻擊與平台特定的路徑方言語義漏洞。

## Elicitation Still Exists, but Delivery Changed｜Elicitation 依然存在，但傳輸方向徹底翻轉

Elicitation 是當前規範中，在執行 `tools/call`、`prompts/get` 或 `resources/read` 期間向人類使用者採集即時輸入的合法特性。其方法名稱依然維持 `elicitation/create`；發生翻天覆地質變的是其底層通訊的發起方向。

2026-07-28 伺服器絕不允許發起逆向的 JSON-RPC 請求。它改為向外回傳標準的 `InputRequiredResult`：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "note_id": {
                "type": "string",
                "enum": ["note-3", "note-7", "note-14"]
              },
              "confirm": {"type": "boolean"}
            },
            "required": ["note_id", "confirm"]
          }
        }
      }
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

宿主環境將上述結構彩現為使用者互動表單。人類使用者可以選擇確認送出、明確拒絕、或直接關閉對話框。隨後，用戶端以全新派發的請求 ID 重新發起原始的 `tools/call`：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

這兩次呼叫之間不存在任何協定層級的連線工作階段記憶。伺服器校驗傳回的狀態簽名、校驗回應內容是否符合預期 Schema、確認被選取的筆記 ID 嚴格包含在最初簽名授權的候選名單內、重新校驗工作區授權、重新覆核路徑邊界，最後才正式通電執行實體刪除。

## Capability Negotiation Is Per Request｜能力協商嚴格綁定於單次請求

支援表單模式 Elicitation 的用戶端，必須在請求中明確宣告：

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

為了向下相容，宣告空白的引導能力字典 `"elicitation": {}` 依然等價於僅支援表單模式。顯式宣告 `"elicitation": {"form": {}}` 亦代表支援表單模式；而僅宣告 URL 模式的 `"elicitation": {"url": {}}` 則**不**支援表單模式。伺服器絕不可在回傳中要求當前請求未宣告的能力模式，即使該用戶端在稍早的歷史請求中曾經聲明過亦然。

每個請求亦必須攜帶 `io.modelcontextprotocol/protocolVersion`。版本缺漏或非字串回傳 `-32602`；版本不支援回傳 `-32022` 搭配精準的 `supported` 與 `requested` 規格。若缺少表單模式支援，回傳 `-32021` 搭配 `data.requiredCapabilities` 設定為 `{"elicitation":{"form":{}}}`。

不帶 JSON-RPC `id` 的信封代表單向通知。一律默默處理，絕不回傳 JSON-RPC 回應。在 Streamable HTTP 傳輸層上，接收合法的單向通知時回傳空內文的 `202 Accepted`。

`clientInfo` 僅供前端診斷之用，純屬用戶端自我宣告，絕不可作為授權主體的判斷依據。

伺服器強制實作 `server/discover` 並回傳 `supportedVersions`、能力宣告、`ttlMs` 與 `cacheScope`，最外層標註 `resultType: "complete"`。在該現代架構中，服務發現絕不會宣告已廢棄的 Roots 能力。由於宣告了工具支援，伺服器亦必須實作必備的 `tools/list`，回傳確定性排序的 `notes_delete` 描述符、合法的物件型別 `inputSchema`、伺服器識別後設資料與公開快取提示。

## Form Mode｜表單模式（Form Mode）

表單模式採用專為彈出對話框量身打造的受限 JSON Schema 子集。其根節點必須是物件，內部屬性必須是扁平的原始型別欄位或受支援的枚舉陣列。深層巢狀物件與複雜文件 Schema 嚴禁出現在確認對話框中。

表單模式的最佳適用情境：

- 在多個候選結果中挑選唯一目標；
- 確認一項不可逆的實體破壞性操作；
- 採集非敏感的使用者偏好設定；
- 採集必須由人類親自裁決、大模型絕不可代勞的少量關鍵數值。

嚴禁將表單模式用於採集密碼、API 金鑰、存取憑證（Token）或支付卡號！這些高敏感機密一旦通過 MCP 用戶端，極易洩漏至系統日誌或大模型的上下文環境中。

伺服器在接收到回傳內容時，必須重新展開完整的嚴格校驗。用戶端前端的表單驗證僅能提升使用者體驗，絕不能直接轉化為安全信任憑證。

## URL Mode｜URL 模式（URL Mode）

URL 模式透過發送安全的 Web 網址，將使用者引導至帶外（Out-of-band）的獨立網頁流程：

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

當高敏感資訊必須直接輸入至伺服器完全受控的外部網頁時（例如第三方 OAuth 授權流程），選用此模式。用戶端在開啟網址前，應向使用者完整展示目標位址並取得明確同意，且嚴禁預先偷偷發起網頁預先載入（Prefetch）。

收到使用者的 `accept` 回應，僅代表使用者同意開啟了該網址，**絕不**代表外部網頁流程已經順利授權完畢。在重試時，伺服器必須重新檢驗自身的內部狀態，隨後決定是正式執行完成，還是回傳下一個 `input_required` 繼續等待。

URL 引導機制絕不能替代 MCP 用戶端與伺服器之間的實體連線鑑權。它是為了滿足伺服器代表使用者執行外部互動的專項手段。伺服器必須將瀏覽器中的 Web 使用者，精準綁定至當初發起 MCP 操作的同一個認證主體之上。

## Response Branches｜回應處置策略路徑

必須將使用者的操作視為清晰的業務決策，而非混為一談的同義詞：

| 使用者動作 | 實際業務意義 | 伺服器端的安全處置準則 |
|---|---|---|
| `accept` | 使用者已審核並正式送出表單 | 校驗表單內容合法性，繼續推進後續流程 |
| `decline` | 使用者主動明確拒絕授權 | 回傳非錯誤狀態的合規終態拒絕成果（Refusal） |
| `cancel` | 使用者關閉視窗或未完成操作 | 安全中斷當前操作，並允許使用者日後重新發起重試 |

絕不可將缺漏的內容誤判為使用者同意。絕不可在使用者明確選擇 decline 拒絕後，陷入無限重複彈窗的流氓死循環。

## Protecting Destructive MRTR State｜保護具破壞性動作的 MRTR 狀態

候選名單絕不能僅僅記錄在 Prompt 範本或未簽名的 Base64 字串中。呼叫端能輕易竄改其發送回來的任何內容。

教學程式碼對狀態酬載實施了嚴密的 HMAC 數位簽名，包含：

- 通過身分認證的真實主體名稱；
- 最初發起調用的方法名稱；
- `workspaceUri` 與 `title` 原始引數的特徵摘要；
- 呈現在表單上的合法筆記 ID 授權候選集合；
- 當前所處的具體操作階段；
- 短暫的硬性過期時間戳記。

在正式實施破壞性操作前，伺服器還必須即時覆核記憶體或資料庫中的真實筆記紀錄。這能精準攔截並發競爭條件，並防止目標在對話框彈出後被惡意移出工作區邊界。

針對一次性的金融交易或不可逆的破壞性操作，僅憑 HMAC 簽名依然無法防止合法狀態在有效期限內被惡意重放（Replay Attack）。必須在叢集共享的重放儲存層中，嚴格對 Nonce 隨機數實施「一次性消費」驗證。教學程式碼注入了一個具備容量約束與 TTL 定期修剪的重放儲存庫，在執行記憶體刪除的瞬間原子化鎖定該 Nonce。在正式環境中，應將 Nonce 消費與實體業務資料變更綁定在同一個資料庫交易（Transaction）或條件寫入邊界之內。

在核銷 Nonce 之前，必須先校驗使用者回傳內容的合法性。格式畸形的回應或 `cancel` 取消操作不應執行任何資料變更，且該狀態在過期前允許被重新重試。而一旦使用者明確點選 `decline` 拒絕，則代表終態終止，此時應核銷 Nonce 且不執行任何刪除。

```figure
t3-roots-boundary
```

## Build It｜動手實作

`code/main.py` 完整展示了現代 `notes_delete` 刪除工具的工程典範：

- `tools/list` 回傳具備確定性排序、可快取且帶有工作區與標題驗證 Schema 的描述符。
- 操作範圍被明確定義為顯式的 `workspaceUri` 引數。
- 伺服器內部組態將該工作區合法授權給當前教學主體。
- URI 標準化路徑解析精準攔截前綴混淆與編碼目錄穿越攻擊。
- 每一筆破壞性刪除操作皆強制觸發表單模式的 Elicitation。
- 引導請求封裝於 `resultType: "input_required"` 中回傳。
- 帶簽名的 `requestState` 深度綁定候選清單與原始引數。
- 注入的重放儲存庫杜絕已確認或已拒絕的狀態在多個伺服器實例間被重複消費。
- 重試呼叫採用全新請求 ID，並最終回傳 `resultType: "complete"`。

儲存庫採用記憶體字典以便於透視協定行為。當升級為持久化資料庫時，上述安全原則完全一致。

## Use It｜實際應用

在儲存庫根目錄下執行：

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
python3 -m unittest discover tests -v
```

日誌軌跡重點檢驗清單：

- 服務發現宣告工具支援，且完全不包含已廢棄的 Roots。
- 工具探測回傳 `notes_delete` 描述符，包含 `resultType`、伺服器身分與快取提示。
- 請求 ID `1` 在 `inputRequests.delete_choice` 中成功回傳表單。
- 請求 ID `2` 正確回傳簽名狀態並順利完成實體刪除。
- 前綴偽造路徑與百分比編碼目錄穿越路徑，皆精準觸發路徑限制攔截失敗。
- 篡改後的標題無法非法復用原有的確認狀態。
- 使用者拒絕（Decline）時筆記內容毫髮無傷。
- 共享狀態的兩個伺服器實例無法重複執行同一次授權確認。
- 空白與顯式表單宣告皆能順暢運作，而僅支援 URL 的請求則精準回傳 `-32021` 錯誤。
- 版本不支援錯誤嚴格遵循 `-32022` 規範格式。
- 單向通知絕不回傳任何 JSON-RPC 回應。

## Ship It｜交付成果

本課產出 `outputs/skill-elicitation-form-designer.md`。它能規劃顯式範圍邊界、授權校驗邏輯、MRTR 互動表單、使用者決策分流策略以及狀態防篡改簽名。嚴禁將已廢棄的 Roots 當作安全沙盒，亦嚴禁透過表單模式採集機密金鑰。

## Exercises｜練習

1. 將記憶體中的重放儲存庫替換為 SQLite。利用單一資料庫交易原子化核銷 Nonce 並刪除目標筆記，證明兩個並發行程絕無可能同時確認成功。
2. 擴充支援 `url` 能力協商與帶外授權流程。確保第三方服務的真實憑證絕不會洩漏進 `inputResponses` 之中。
3. 將記憶體筆記映射表替換為暫存 SQLite 資料庫。在資料變更交易內部，實施二次授權與路徑邊界覆核。
4. 為真實檔案系統實作新增符號連結（Symlink）防護策略。深入解釋為何單純依賴 URI 字面詞法分析，完全無法阻止符號連結逃逸攻擊。
5. 設計一個相容於 2025-11-25 舊版協定的適配器，將現代 MRTR 輸出轉換為傳統伺服器主動發起的 Elicitation。將該適配邏輯與現代處理常式進行嚴格的物理隔離。

## Key Terms｜關鍵術語

| 術語 | 2026-07-28 規範下的實際意義 |
|------|------------------------|
| Roots | 已廢棄的提示性工作區指引，絕非安全鑑權或沙盒隔離機制 |
| Explicit scope | 顯式範圍；在請求引數中清晰可見的工作區、目錄路徑或資源識別碼 |
| Containment | 路徑限制；透過標準化路徑元件比對，確保目標嚴格受限於授權邊界內部 |
| Elicitation | 引導式問答；在 MCP 操作期間向人類使用者採集即時輸入的專屬特性 |
| Form mode | 表單模式；利用受限的扁平 JSON Schema 在通訊內發起的結構化使用者互動 |
| URL mode | 網址模式；將使用者引導至帶外安全網頁處理敏感機密或第三方授權的互動模式 |
| MRTR | 多輪往返請求；由 input_required 成果與全新請求 ID 重試構成的無狀態協定模式 |
| `requestState` | 由伺服器簽發並校驗、由用戶端原樣回傳的不透明防篡改狀態識別碼 |
| Decline | 明確拒絕；使用者主動拒絕執行當前操作的確定性終態意圖 |
| Cancel | 取消操作；使用者未經批准而關閉對話框或中斷互動的中立狀態 |

## Legacy Compatibility｜傳統歷史相容性

面對鎖定於 2025-11-25 舊版本的傳統端點，`roots/list`、`notifications/roots/list_changed` 以及傳統伺服器主動發起的 `elicitation/create` 依然可能存在。請將該轉接邏輯嚴格標註為舊版相容層。絕不允許舊版 Root 清單繞過伺服器端的實體授權檢查，亦絕不可將連線階段式的架構假設引入現代處理常式中。

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) ——引導問答官方規格手冊
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) ——MRTR 無狀態重試模式手冊
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots) ——Roots 廢棄與顯式範圍遷移提案
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) ——動態服務發現官方規範手冊
