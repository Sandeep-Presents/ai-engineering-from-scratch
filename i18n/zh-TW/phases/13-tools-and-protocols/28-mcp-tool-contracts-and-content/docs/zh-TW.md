# MCP 工具契約與內容格式

> 一項工具唯有在服務發現、參數、執行結果、分頁機制與傳輸層後設資料全數達成嚴格一致的契約時，方能安全地交由自動化系統調用。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 使用 JSON Schema 2020-12 定義工具的輸入參數與輸出結果契約。
- 校驗結構化結果，絕不預設其必為 JSON 物件字典。
- 在純文字、圖片、音訊、資源連結（Resource Links）與內嵌資源（Embedded Resources）之間做出正確選型。
- 在工具描述元暴露給模型之前，果斷拒絕不安全的 `x-mcp-header` 定義。
- 對參數標頭數值進行精確編碼，並強制校驗標頭與主體（Header-to-body）的絕對一致性。
- 正確遍歷游標分頁（Cursor Pagination），絕不主觀解讀或假設游標數值。
- 為 `completion/complete` 自動補全建議建立嚴密的安全授權與頻率限制邊界。

## The Problem｜問題

呼叫本地 Python 函式輕而易舉；但透過 AI 宿主環境調用遠端分散式能力，則是一場嚴峻的系統契約考驗。

伺服器對外發布工具描述元（Descriptor）。用戶端將該描述元轉換為模型可見的上下文脈絡與使用者互動介面。模型生成呼叫參數。網關或負載平衡器可能依據同步對映的 HTTP 標頭進行流量路由。伺服器實質執行工具。隨後，用戶端必須精確判定回傳的結果是否足夠安全合規，方能交還給模型繼續推論。

整條呼叫鏈條中只要存在一道脆弱的邊界，全域信任體系便會瞬間瓦解。

試觀察五種典型的毀滅性失效場景：

- 工具描述元宣稱回傳 JSON 物件，伺服器實質上卻回傳了 JSON 陣列。
- 用戶端在遇到 `nextCursor` 為空字串時，錯誤判定分頁結束而提早中止。
- 敏感的 Token 或密鑰參數被同步對映至 HTTP 標頭中，導致其暴露給中繼代理伺服器與日誌系統。
- 含有 Unicode 字元的路由參數被作為原始 HTTP 標頭直接發送，導致網關與後端解析出完全不同的位元組序列。
- 自動補全端點將正式環境的機密名稱，洩漏給了完全無權存取該環境的普通呼叫者。

這些問題絕無法透過修改 prompt 來修復。它們需要堅若磐石的協定層與應用層雙向契約約束。

## The Contract Pipeline｜契約處理管線

將每一次工具呼叫視為五道依序把守的嚴格關卡：

1. **探索（Discover）**：讀取具備確定性排序、支援分頁的工具清單。
2. **准入（Admit）**：校驗每個工具描述元，並強制套用本地安全審核策略。
3. **調用（Invoke）**：校驗模型生成的輸入參數，並建置傳輸層後設資料。
4. **執行（Execute）**：運行實體業務處理常式，並精準分類執行異常與協定錯誤。
5. **消費（Consume）**：在將內容交付模型前，完整校驗內容區塊與結構化輸出。

```figure
mcp-contract-pipeline
```

宿主系統全權掌控准入審查與消費驗收這兩大核心關卡。伺服器完全無法強迫用戶端盲目信任其提供的任何標註宣告、Schema 或執行產物。

## JSON Schema Is a Runtime Boundary｜JSON Schema 作為執行時期防護邊界

在 MCP `2026-07-28` 規範修訂版中，`inputSchema` 與 `outputSchema` 採用 JSON Schema 標準。當省略 `$schema` 宣告時，系統預設採用 2020-12 規範方言。

輸入 Schema 必須是一個 Schema 物件。即便某項工具完全不接收任何參數，也應當嚴格明確宣告：

```json
{
  "type": "object",
  "additionalProperties": false
}
```

這遠比模糊的 `{ "type": "object" }` 更加嚴謹，後者在語義上會寬容接收任意未定義的未知屬性。

輸出 Schema 為選填項。然而，一旦伺服器對外發布了輸出 Schema，便代表其承諾在每一次完成的工具結果中，皆必須回傳符合該 Schema 的 `structuredContent`，包含 `isError: true` 的失敗結果亦不例外。錯誤旗標僅負責標註業務執行成敗，絕不賦予伺服器擅自違反已發布輸出契約的豁免權。用戶端必須對回傳結果實施嚴格校驗，而非盲目信任描述元。

### 結構化內容可為任意合法的 JSON 數值

切勿將 `structuredContent` 死板地硬編碼為 Python 字典。它可以是：

- 一個物件（Object）；
- 一個陣列（Array）；
- 一個字串（String）；
- 一個數值（Number）；
- 一個布林值（Boolean）；
- `null`。

以下工具明確宣告回傳字串陣列：

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

其成功執行的合法回傳範例：

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

為了向下相容，結構化結果應同時在 text 內容區塊中附帶序列化後的 JSON 字串。但該純文字字串絕非結構校驗的依據，真正的校驗基準始終是 `structuredContent` 本體。

### 輕量校驗器足以闡明防護邊界

本課實作了一套刻意精簡的 JSON Schema 子集校驗器，完全立足於 Python 標準函式庫，以確保機制完全透明。它覆蓋了範例工具所涉及的核心機制：

- 物件、陣列、字串、整數、浮點數、布林值與 null 等型別校驗；
- 必填屬性檢查；
- `additionalProperties: false` 封閉屬性約束；
- 陣列元素項目型別約束；
- enum 列舉值檢查；
- 字串最小長度限制。

這絕非用以取代正式環境中功能完備的生產級校驗器。本課旨在傳授「校驗應當發生的具體位置」：服務發現後針對描述元校驗、執行前針對參數校驗，以及消費前針對結構化產物校驗。

## Content Blocks Carry Different Costs｜各類內容區塊承載不同的架構代價

`content` 陣列支援組合多種異質內容型別：

| 內容型別 | 最佳適用情境 | 關鍵安全與架構邊界 |
|---|---|---|
| `text` | 供人類與模型閱讀的摘要或對話文字 | 將其視為不可信的外部產物對待 |
| `image` | 以 Base64 編碼封裝的視覺觀測證據 | 嚴格校驗 MIME 媒體型別與位元組大小 |
| `audio` | 以 Base64 編碼封裝的語音或音訊記錄 | 嚴格限制媒體型別與音訊長度上限 |
| `resource_link` | 提供給用戶端供日後按需讀取的資源 URI | 在後續實質讀取時必須重新進行獨立鑑權 |
| `resource` | 直接內嵌於結果中的結構化或二進位資料 | 於當前請求中強制套用容量與型別配額 |

資源連結並不保證該資源必然會出現在 `resources/list` 清單中。它僅代表該次工具呼叫所產出的一項動態參照。當用戶端跟隨該 URI 存取時，必須完整重新套用資源存取策略。

內嵌資源能免去額外的網路來回往返，但會顯著增加當前單次 HTTP 回應的容量負擔。對於龐大或獨立動態變化的產物，應優先採用連結；對於必須與結果具備原子綁定的小型核心證據，方可採用內嵌資源。

本課的 `evidence_bundle` 實作完整展示了全部五種內容區塊的處理邏輯，用戶端在接受結果前會逐一校驗每個區塊。

## `x-mcp-header` 是傳輸路由後設資料

`inputSchema` 內部的屬性可顯式宣告 `x-mcp-header`。在 Streamable HTTP 傳輸模式下，用戶端會將該參數同步對映至 `Mcp-Param-{name}` 請求標頭中：

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

當傳入 `region: "eu-west"` 時，傳輸層會發出以下標頭：

```http
Mcp-Param-Region: eu-west
```

此標註的存在，是為了讓負載平衡器、反向代理網關或策略引擎能在無需解析龐大 JSON 主體的情況下，直接基於標頭實施快速分流。它**絕非存放敏感憑證金鑰的地方**。

協定對此標註制定了嚴格約束：

- 標頭名稱不得為空，且必須符合 HTTP 標頭欄位 Token 語法規範；
- 標頭名稱不分大小寫必須全域唯一；
- 宣告屬性型別嚴格僅限 string、integer 或 boolean；
- **嚴禁使用** `number` 浮點數型別；
- 該標註僅允許出現在 `inputSchema.properties` 的頂層直屬成員上；
- 整數數值必須嚴格維持在 `-9007199254740991` 至 `9007199254740991` 的 JavaScript 安全整數範圍內。

該位置規則屬於語法層級的強制安全防禦（Fail-closed）。必須完整遍歷整個 Schema 樹狀結構，而非僅檢查校驗器碰巧支援的頂層屬性。若標註出現在巢狀物件的 `properties`、`oneOf` 路徑、`items` 內部、由 `$ref` 引用的定義中，或任何輸出 Schema 內，必須堅決拒絕該描述元。解析參照（Resolving a reference）絕不代表該被參照節點自動成為頂層直屬屬性。

本課進一步引入了生產部署安全策略：果斷拒絕任何企圖同步對映 `password`、`secret`、`token`、`api_key` 或 `authorization` 等敏感名稱的描述元。官方規範強烈建議伺服器作者切勿同步對映敏感參數；用戶端應當將該項建議直接升級為強制的准入安全紅線。

審計日誌中僅應記錄標頭名稱，嚴禁記錄其參數實體數值。範例程式碼僅會記錄 `Mcp-Param-Region`，而絕不將 `eu-west` 寫入審計事件中。

### 建置 HTTP 標頭前必須嚴格編碼

唯有當參數數值是由 `!` 至 `~` 的可見 ASCII 字元所組成的非空字串、且外觀絕不包含編碼哨兵標記時，方允許以明文直接傳輸。其餘所有情況皆必須嚴格採用以下標準格式：

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8` 是針對精確 UTF-8 位元組序列所進行的標準 Base64 編碼。在編碼前絕不可擅自修剪（trim）、正規化或替換原始數值。Unicode 字元、空字串、空格、Tab、控制字元、CR/LF 換行，以及任何開頭為 `=?base64?` 的字串，全數強制執行此編碼。對開頭類似哨兵的文字進行二次編碼，正是讓接收端能忠實還原原始字面文字、而不將其誤判為傳輸語法的關鍵保證。

布林值一律格式化為全小寫的 `true` 或 `false`。整數一律以十進位表示，且必須嚴格位於 JavaScript 安全整數範圍內。超出該範圍的數值必須果斷拒絕，防止中繼代理在解析時發生精度四捨五入截斷。

### 伺服器端強制核驗對映一致性

標頭的生成僅是用戶端的一半責任。在 Streamable HTTP 邊界處，伺服器必須：

1. 不分大小寫精準檢索所有已識別的 `Mcp-Param-*` 標頭名稱；
2. 當遇到標準 Base64 哨兵格式時精確解碼；
3. 將解碼後的文字與 JSON 請求主體中的對應參數逐字進行嚴格比對；
4. 在轉發工具執行前，果斷拒絕任何缺漏、重複、未預期、
   格式損壞或數值不一致的標頭。

若出現任何不符，伺服器必須回傳 HTTP `400` 狀態碼，並附帶 JSON-RPC `-32020` 錯誤代號。原始的主體參數數值與編碼後的標頭資料皆嚴禁出現在審計記錄中；僅記錄識別出的標頭名稱與拒絕類別。

`code/main.py` 直接演示了此邊界防禦。[第 09 課](../../09-mcp-transports/)進一步涵蓋了更廣泛的 Streamable HTTP 校驗順序（包含 HTTP 方法與協定版本一致性）。

## Pagination Cursors Are Opaque｜分頁游標屬於完全不透明的黑箱

MCP 清單查詢操作全面採用游標分頁（Cursor Pagination）。伺服器全權決定分頁大小與游標內部格式。用戶端僅需做出單一決策：

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

切勿寫成以下危險程式碼：

```python
if not result.get("nextCursor"):
    break
```

空字串是一個完全合法的有效游標數值。若採用 Python 的真假值隱式判斷，會導致分頁在空字串處提前異常中斷。

用戶端絕不可擅自解碼游標、對其進行數值遞增、將其與先前游標比較大小以推斷順序，或試圖猜測當前頁碼。伺服器可能會對游標進行數位簽名、將其與目錄版本鎖定，或對映至伺服器私有狀態。這些全數屬於伺服器的私有內部實作細節。

範例伺服器在第一頁之後刻意回傳 `""` 作為游標。用戶端必須在第二次請求中原封不動地傳回該空字串數值：

```text
<first request with no cursor>
<second request with cursor "">
```

傳入非法的無效游標會觸發 JSON-RPC 無效參數錯誤（`-32602`）。

## Completion Is an Authorization Surface｜自動補全是一道關鍵授權防線

`completion/complete` 端點專門為 Prompt 參數與資源範本參數提供即時輸入建議。它極利於打造互動式表單，但若缺乏保護，它極易成為攻擊者窺探受保護實體名稱的越權漏洞。

補全請求明確指定目標參照與正在編輯的參數名稱：

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

回傳結果至多包含 100 筆建議，並可附帶 `total` 與 `hasMore` 旗標。

必須強制套用與目標 Prompt 或資源完全相同的授權邊界。在範例中，分析師角色僅能收到 `development` 與 `staging` 建議；唯有運維工程師才有權取得 `production` 選項。

生產級補全機制亦需要：

- 嚴格的輸入格式校驗；
- 感知呼叫者身分的過濾機制；
- 用戶端實施請求防抖（Debouncing）；
- 伺服器端實施嚴密的頻率限制（Rate Limiting）；
- 嚴格限制回傳總筆數上限；
- 審計日誌中絕不洩漏敏感的候選建議數值。

自動補全本質上是輔助輸入工具，絕不可成為繞過服務發現權限控制的後門。

## Two Error Layers｜嚴格區分兩大錯誤層級

必須將底層協定錯誤與工具業務執行錯誤清晰分離。

當 MCP 請求本身無法被正確分派時，使用 JSON-RPC 錯誤碼：

- 未知的工具名稱；
- 請求資料結構畸形損壞；
- 缺失必要的請求後設資料；
- 傳入非法無效的游標。

當請求已順利抵達工具、且工具在執行過程中回報了具備可操作性的業務失敗時，使用帶有 `isError: true` 的常規工具結果：

- 報告來源資料暫時無法連線；
- 傳入的日期超出了系統支援範圍；
- 業務規則拒絕了發起的操作。

大語言模型通常具備自我修正業務執行錯誤的能力；但若伺服器擅自違反了自身承諾的輸出 Schema，模型將無能為力。

若工具宣告了輸出 Schema，必須在該 Schema 內部完整建模可操作的失敗結構。範例中的 `route_report` 失敗時，會在其 Schema 內部將要求的區域回傳為 `accepted: false`，同時附帶人類可讀的錯誤描述文字與 `isError: true` 旗標。

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫完整實作了邊界兩側的全部機制。

伺服器端實作：

- 逐請求的 MCP 後設資料校驗；
- 具備 tools 與 completions 能力宣告的 `server/discover` 端點；
- 具備確定性排序的 `tools/list` 游標分頁；
- 四個工具描述元（包含一個必須被安全拒絕的測試項目）；
- 陣列型結構化輸出；
- 全數五種最新的工具內容區塊型別；
- Streamable HTTP 一致性防禦關卡（精準解碼參數標頭，
  並在不符時回傳 HTTP `400` 與 JSON-RPC `-32020`）；
- 具備身分授權與頻率限制的自動補全端點。

用戶端實作：

- 描述元准入安全審查；
- 完整的 Schema 樹狀遍歷、`x-mcp-header` 位置校驗與敏感欄位攔截策略；
- 精確的可見 ASCII 或 Base64 UTF-8 標頭數值編碼；
- 能正確跟隨空字串游標的不透明分頁迴圈；
- 參數與輸出結果的嚴格雙向校驗；
- 內容區塊結構校驗；
- 僅記錄標頭名稱而不記錄實體數值的審計日誌。

刻意設計的不安全描述元屬於教學測試資料，確鑿證明了單一工具被拒絕准入，絕不會影響其他合法工具的正常載入與執行。

## Use It｜實際應用

自儲存庫根目錄執行：

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
python3 -m unittest discover tests -v
```

演示程式會依序印出：獲准准入的工具清單、被成功攔截的危險描述元、兩次分頁請求的呼叫軌跡、結構化陣列內容、五種內容區塊型別、同步對映的標頭名稱、數值是否觸發 Base64 編碼、HTTP 標頭主體一致性驗證狀態，以及經身分過濾後的自動補全建議清單。

## Interactive Lab｜互動實驗

開啟 `code/main.py` 並找到 `TOOLS` 定義：

1. 將 `tag_catalog.outputSchema.type` 自 `array` 修改為 `object`。
2. 運行演示程式。觀察用戶端如何精準阻斷回傳的陣列結果。
3. 恢復原本合法的 Schema。
4. 維持第一頁的 `nextCursor` 為 `""`，
   並讓最後一頁明確回傳 `nextCursor: None` 而非省略該欄位。
5. 運行測試並比對游標請求軌跡。
6. 為某個字串屬性新增 `x-mcp-header: "Authorization"` 標註。
7. 確認描述元准入審查在工具被呼叫前便將其果斷攔截。
8. 嘗試在 `region` 參數中傳入包含 Unicode、換行字元、前後空格以及
   字面文字 `=?base64?SGVsbG8=?=` 的極端數值。解碼產出的 HTTP 標頭，證明原始數值能被精準還原。
9. 將標註移至 `oneOf`、`items` 或 `$ref` 定義內部。確認
   描述元依然被嚴格拒絕，即使該路徑在當前示範中從未被呼叫。
10. 移除識別出的標頭或篡改其解碼數值。確認 HTTP
    邊界精準回傳 HTTP `400` 與 JSON-RPC 代號 `-32020`。

本實驗的核心目的在於親眼見證每道防護關卡如何在所屬的系統邊界上精準攔截違規。

## Practice Lab｜實戰實驗

為契約實驗擴充一套 `search_evidence` 搜尋證據工具。

具體需求：

1. 輸入 Schema 接收 `query`、`limit` 以及一個安全的 `region` 路由標註欄位。
2. 輸出 Schema 為包含 `uri`、`title` 與 `score` 的物件陣列。
3. 回傳結果針對每個項目同時包含相容文字與對應的資源連結。
4. 參數校驗嚴格拒絕未知屬性。
5. `limit` 數值受應用程式邏輯邊界嚴格限制。
6. 無權存取特定 URI 的呼叫者，在自動補全與工具結果中皆絕不會窺見該 URI。
7. 單元測試覆蓋非法評分、非法標頭標註以及跨兩頁的分頁清單。
8. 標頭數值測試涵蓋可見 ASCII、Unicode、控制字元、
   空格、外觀類似哨兵的文字，以及 JavaScript 兩側安全整數極限邊界。
9. HTTP 測試支援不分大小寫的標頭名稱比對，但在遇到數值缺漏
   或不一致時回傳 HTTP `400` 與代號 `-32020`。

## Shipped Artifact｜交付產物

`outputs/skill-mcp-contract-reviewer.md` 是一套可重複利用的架構審查 skill。傳入工具描述元、回傳結果範例、分頁行為與自動補全策略，它能自動產出准入審查報告、結果校驗規劃、標頭策略分析與具體的測試失敗案例設計。

## Verify It｜成果驗證

當以下條件全數滿足時，代表本課實作圓滿達標：

- `tools/list` 在重複呼叫下始終維持完全一致的邏輯順序。
- 當 `nextCursor` 為 `""` 時，用戶端能順暢發起第二次分頁請求。
- 包含敏感標頭標註的危險描述元被精準剔除，而其他合法工具依然可正常使用。
- 陣列結果順利通過其陣列輸出 Schema 校驗。
- 物件結果在該陣列 Schema 下被精準判定為校驗失敗。
- 失敗結果絕不可省略或違反已公開宣稱的輸出 Schema。
- 純文字、圖片、音訊、資源連結與內嵌資源區塊皆通過結構校驗。
- 標頭審計日誌中僅包含標頭名稱，絕不洩漏實體參數數值。
- 純可見 ASCII 維持明文；Unicode、控制字元、含空格、空值與
  類似哨兵的字串，透過 Base64 UTF-8 編碼精準完成往返還原。
- 超出 JavaScript 安全範圍的整數被果斷拒絕。
- 位於 `oneOf`、`items`、巢狀物件、`$ref` 定義或
  輸出 Schema 內部的標註在准入階段被全數攔截。
- 不分大小寫的標頭名稱唯有在解碼數值與主體完全相符時才獲放行；
  缺失或不符時回傳 HTTP `400` 與 JSON-RPC `-32020`。
- 分析師角色的自動補全請求絕不回傳 `production`。
- 工具業務失敗使用 `isError: true`；格式錯誤的協定呼叫使用 JSON-RPC `error`。

## Production Failure Modes｜正式環境失效模式

| 失效情境 | 開發者觀察到的表象 | 正確架構處置準則 |
|---|---|---|
| 用戶端預設輸出必為物件 | 合法陣列結果報錯崩潰或被靜默包裝 | 依已發布的 Schema 進行校驗，絕不限制僅支援物件型別 |
| 空字串游標被誤判為 false | 分頁在最後數頁前夕無端消失 | 只要 `nextCursor` 存在且非 null，便堅持繼續請求 |
| 敏感參數數值被同步對映 | 機密金鑰暴露於反向代理、WAF 或鏈路追蹤日誌中 | 果斷拒絕該描述元准入，將機密保留於受保護的請求主體中 |
| 原始 Unicode 或空格直接進入標頭 | 網關與後端解析數值產生分歧或被正規化破壞 | 採用標準 Base64 UTF-8 哨兵編碼，並於解碼後再實施比對 |
| 標註隱藏於 Schema 深度路徑中 | 用戶端在准入審查時漏檢了路由後設資料 | 完整遍歷整個 Schema 樹狀結構，嚴格僅允許頂層直屬成員 |
| 超大整數被同步對映 | JavaScript 中繼代理將路由數值進行四捨五入截斷 | 堅決拒絕超出 JavaScript 安全整數範圍的數值 |
| 標頭數值與主體參數不一致 | 網關分流至 A 目標，而後端實質執行 B 目標 | 於轉發前果斷拒絕，回傳 HTTP `400` 與 JSON-RPC `-32020` |
| 輸出 Schema 被完全無視 | 下游業務程式碼讀取了損壞畸形的資料結構 | 在交付模型或應用程式消費前實施強制結構校驗 |
| 資源連結被盲目自動信任 | 呼叫端越權跟隨並存取了未經授權的敏感 URI | 每次讀取資源時皆必須獨立重新進行鑑權審查 |
| 自動補全共享全域候選清單 | 隱藏的租戶機密名稱遭到非預期洩漏 | 嚴格依呼叫者身分、參照目標與授權範圍實施過濾 |
| 工具標註被誤當作授權策略 | 破壞性操作繞過了人工確認直接執行 | 授權管理與審批卡點必須完全獨立於工具標註之外運行 |
| 單一損壞工具導致服務發現癱瘓 | 整台 MCP 伺服器的所有工具全數無法使用 | 果斷拒絕損壞的描述元，獨立放行其他合規的合法工具 |

## Capstone Connection｜總結專題關聯

Phase 13 總結專題需要一套能安全整併來自多台伺服器之工具的 API 閘道器。本課為該閘道器提供了最核心的准入審查引擎。

善用本課交付的審查產物，對以下四項總結專題關鍵證據進行嚴格驗收：

- 具備確定性且完整的分頁服務發現機制；
- 暴露給模型前的描述元安全准入校驗；
- 經校驗的結構化輸出與容量受控的各類內容區塊；
- 完整捍衛安全授權邊界的自動補全與路由後設資料。

切勿單憑單次成功的 `tools/call` 便宣稱系統相容。必須完整記錄描述元、分頁呼叫日誌、獲准工具集、被拒工具集，以及經過校驗的實體執行產物。

## Key Terms｜關鍵術語

| 術語 | 實際工程意義 |
|---|---|
| `inputSchema` | 定義工具可接收之參數結構的 JSON Schema 物件 |
| `outputSchema` | 定義工具 `structuredContent` 回傳規格的選用性 JSON Schema |
| `structuredContent` | 工具執行完成後所產出的任意合法 JSON 數值 |
| Content block | 包含純文字、圖片、音訊、資源連結或內嵌資源的強型別內容區塊 |
| `x-mcp-header` | 將純量參數同步對映至 Streamable HTTP 傳輸標頭的 Schema 標註 |
| Opaque cursor | 伺服器簽發的隨機分頁 Token，用戶端絕不應對其進行主觀解讀 |
| Completion reference | 正在被自動補全參數的目標 Prompt 名稱或資源 URI/範本標識 |
| Admission | 用戶端決定對外暴露或拒絕特定發現之工具描述元的安全准入決策 |

## Further Reading｜延伸閱讀

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) ——工具定義、呼叫與錯誤處置官方規範
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion) ——參數自動建議與自動補全標準協定
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination) ——不透明游標分頁機制標準指引
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters) ——參數同步對映至自訂 HTTP 標頭規範
