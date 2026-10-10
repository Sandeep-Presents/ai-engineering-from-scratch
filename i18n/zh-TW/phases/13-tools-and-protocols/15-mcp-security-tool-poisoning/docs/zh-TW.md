# MCP 安全防護：後設資料投毒、路由欺騙與 MRTR 狀態防護（MCP Security: Poisoned Metadata, Routing, and MRTR State）

> 無狀態絕不等於缺乏信任。它意味著每一個請求皆完整暴露了伺服器與閘道器獨立執行鑑權所需的全部確鑿證據。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 嚴格將工具描述文字、註解標籤、用戶端資訊與伺服器識別資訊視為不可信的外部資料。
- 敏銳偵測後設資料投毒（Metadata Poisoning）、描述符偷換（Descriptor Rug Pull）與跨伺服器名稱搶佔衝突。
- 完整校驗 2026-07-28 規範下的請求後設資料與 Streamable HTTP 路由標頭。
- 嚴密防範 MRTR `requestState` 遭受篡改，並將確認動作與精確的原始引數進行不可分割的加密綁定。
- 將授權鑑權與速率限制嚴格施加於認證主體，絕不依賴已被廢棄的協定連線階段。

## The Problem｜問題

大模型透過閱讀工具描述來決定「呼叫誰」；API 閘道器透過審查工具名稱來決定「路由至何處」；人類使用者則依據標籤文字來決定「是否授權執行」。單一惡意偽造的工具描述符，能夠同時對這三個環節發動精準打擊。

MCP 官方安全指南給出了嚴肅警告：除非工具描述與註解來自絕對受信任的內部伺服器，否則必須一律將其視為不可信資料。即便當前環境受信任，維運信任關係亦隨時可能生變——一次常規的伺服器依賴套件更新、一個遭到供應鏈污染的開源套件、一次註冊表誤操作、或閘道器合併時的名稱碰撞，皆能瞬間改變大模型所看見的世界。

當前協定亦徹底重構了安全邊界。在 2026-07-28 規範中，完全不存在核心交握，亦不存在傳輸連線階段。任何僅依賴 `Mcp-Session-Id` 來實施授權審核、速率限制或審計日誌的安全設計，皆已屬於過時失效的危險架構。

## The Concept｜核心概念

### 值得嚴加防範的七大攻擊面

以具體明確的檢查清單取代模糊的警惕提示：

1. **後設資料投毒（Metadata poisoning）**：描述說明中夾帶了與宣告行為完全無關的隱藏提示注入指令。
2. **描述符偷換（Descriptor rug pull）**：一個先前已通過人工審查核准的工具，其名稱、說明、Schema 或註解被暗中篡改。
3. **跨伺服器名稱搶佔（Cross-server shadowing）**：兩個後端服務宣告了完全相同的未加修飾工具短名，路由層無聲偏向其中一方。
4. **標頭與內文混淆（Header and body confusion）**：HTTP 標頭 `Mcp-Method` 或 `Mcp-Name` 與底層 JSON-RPC Request Body 出現矛盾。
5. **能力越權升級（Capability escalation）**：通訊對等端在能力中聲稱具備某項擴充功能，伺服器誤將該「相容性宣告」當成了「授權憑證」。
6. **MRTR 狀態篡改（MRTR state tampering）**：呼叫端惡意竄改傳回的 `requestState`、偷換回答目標，或將先前的授權確認套用於全新的攻擊引數上。
7. **供應鏈身分混淆（Supply-chain identity confusion）**：誤將常見的展示名稱當作發布者或伺服器具備權威可信度的證明。

這些攻擊面往往交織疊加。雜湊特徵鎖定能防止描述符暗中變更，但無法保證初次核准的描述符本身是否安全；靜態掃描能攔截常見的顯式惡意詞，卻防不住語義精巧的暗中引導；命名空間能防止特定重名衝突，卻防不住自帶命名空間的惡意伺服器。必須落實層層疊加的縱深防禦。

### 現代請求信封純屬證據，絕非身分憑證

每一個遵循 2026-07-28 規範的請求皆包含：

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

在每一次請求中皆必須重新校驗協定版本與能力宣告結構。利用能力宣告挑選相容的回應格式。**絕不可**將 `clientInfo` 當作通過驗證的真實使用者身分，它純屬呼叫端自我宣告的展示字串。

相同的防護準則亦嚴格適用於回應後設資料中的 `io.modelcontextprotocol/serverInfo`。它僅作為日誌排查與展示輔助，絕非數位憑證、註冊表驗證證據或授權決策依據。

### 在執行授權策略前先校驗路由標頭

針對 `tools/call`，Streamable HTTP 請求包含：

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

標頭中的方法必須嚴格等於內文的方法；標頭中的名稱必須嚴格等於 `params.name`。一旦出現矛盾，在挑選後端服務、套用基於角色的存取控制（RBAC）或扣除限流配額之前，必須立刻拋出 `-32020` 拒絕執行！

該防護時序封死了最典型的安全漏洞：避免出現一個安全元件依據 Body 進行授權審查，而底層路由元件卻依照標頭轉發至另一危險服務的非對稱攻擊。

傳輸校驗必須嚴格依循固定順序：校驗 JSON-RPC 與後設資料型別 → 比對標頭數值與 Body 內容 → 判定協定版本是否受支援。標頭不符回傳 HTTP 400 搭配 `-32020`；標頭與內文一致同意了不支援的版本，回傳 HTTP 400 搭配 `-32022` 以及嚴格為 `{"supported":["2026-07-28"],"requested":"<actual>"}` 的 `data` 欄位；未知方法回傳 HTTP 404 搭配 `-32601`。

當協定契約需要結構化恢復資訊時，所有錯誤物件皆可附帶選填的 `data` 欄位。單向通知不帶 `id`，伺服器絕不可為其回傳 JSON-RPC 成功或失敗回應。接收合法的 HTTP 單向通知時回傳空內文的 202。

### 對完整工具描述符實施特徵雜湊鎖定

單純對說明文字計算雜湊，無法捕捉 Schema 欄位與註解標籤的惡意竄改。必須將使用者最初審查核准的完整描述符欄位進行正規化並計算特徵雜湊：

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

將該特徵值與完整命名空間鍵值（如 `notes.export`）、發布者簽章以及核准時間戳記一同固化儲存。

在每一次工具目錄重新整理時：

- 未知鍵值：隔離審查，嚴禁對外暴露；
- 鍵值相同但特徵值不符：作為潛在的「描述符偷換攻擊」立刻強制隔離，直至人工重新審核；
- 發現未經修飾的重名衝突項：強制要求補全確定性命名空間；
- 命中靜態掃描特徵庫：直接阻擋並對完整描述符發起安全審查。

雜湊完全一致僅證明了「狀態未被竄改」，絕不代表「內容本質安全」。若最初核准的描述符本身就已被投毒，那麼它在完美鎖定下依然是一枚毒藥。

### 靜態語法掃描僅是安全絆網

利用簡潔的規則表達式，能夠極速排查角色標籤偽造、指令覆寫、文字隱寫混淆、敏感檔案存取以及被掩蓋的外部網路連線目標。但靜態掃描絕非語義層面的安全證明。一條安全的正常說明，完全可能在合法的警示文字中提及某個被封鎖的關鍵字；而一條蓄意設計的惡意指令，亦能輕易繞開所有已知黑名單詞彙。請始終將掃描結果視為輔助人工審計的警報線索，而非宣判絕對無辜的免檢標章。

其運算開銷極低，極適合部署於擴充套件安裝階段與 CI 自動化閘門。

### 在合併前實施強制命名空間隔離

假設兩台獨立的伺服器皆對外暴露了名為 `search` 的工具。絕不允許由服務發現的先後順序來隨機決定由誰勝出。

```text
notes.search
issues.search
```

帶有命名空間的完整修飾名，才是對外暴露於閘道器前端的唯一合法識別碼。後端實體伺服器的映射關係必須在內部獨立儲存。穩定的標準名稱能確保使用者授權審查、審計追蹤、特徵雜湊鎖定以及 `Mcp-Name` 路由轉發，皆精準鎖定在同一個實體物件之上。

### 能力宣告純屬相容性宣告

逐請求攜帶的 `clientCapabilities` 僅僅向伺服器表明「本用戶端能夠解讀處理哪些協定擴充特性」。它**絕不賦予**用戶端存取特定工具、資料或發起高危動作的權限。

真實權限始終源自通過驗證的主體身分與實體資源授權策略。標準驗證時序如下：

1. 鑑權底層傳輸憑證；
2. 校驗協定版本、路由標頭與請求結構合法性；
3. 比對協定擴充能力的相容性；
4. 針對已認證主體，實施對工具、資源與具體引數的實體授權審查；
5. 通電執行，或向使用者請求進一步確認。

### 保護無狀態 MRTR 確認流程

具備實體副作用的工具往往需要取得人類使用者的明確授權。現代 MCP 全面採用多輪往返請求（MRTR）取代傳統的逆向回呼。

第一輪回應：

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

用戶端在採集到人類確認後，以全新的 JSON-RPC 請求 ID 重新發起原始方法：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

`inputRequests` 中的每一個項目皆是一個自包含的完整嵌附請求，其內部帶有 `method` 與 `params`。其金鑰必須與後續傳回的 `inputResponses` 嚴格一一對應。表單引導要求根節點為物件型別的 `requestedSchema`，且在伺服器發起該請求前，用戶端必須已明確宣告支援表單引導能力。

宣告為 `{"elicitation":{}}` 隱式代表支援表單模式；宣告為 `{"elicitation":{"form":{}}}` 則為顯式支援；而僅宣告為 `{"elicitation":{"url":{}}}` 則**不**支援表單模式，此時伺服器必須回傳 HTTP 400 搭配 `-32021`，並將 `data.requiredCapabilities` 設定為 `{"elicitation":{"form":{}}}`。

必須將傳入的 `requestState` 嚴格視為完全受攻擊者控制的敵意輸入。實施 HMAC 簽名或加密、校驗過期時限，並將其嚴格綁定至方法名稱、目標工具、精確引數數值、操作目的、授權主體，並在需要防重放時引入一次性 Nonce 隨機數。

Nonce 記帳日誌絕不能僅僅保存在單一閘道器行程的本機記憶體中。教學程式碼注入了一個具備容量限制與 TTL 定期清理的共享防重放儲存庫，在原子化核銷 Nonce 的瞬間建立執行邊界：唯有通過校驗的確認（Accept）或明確的終態拒絕（Decline）方可正式消費狀態；畸形回應或 `cancel` 執行無操作，並允許在過期前重試。正式生產叢集必須在後端共享持久化儲存層中實施相同的條件寫入保護。

絕不要將確認上下文暗藏於協定連線階段中。任何一個後端伺服器實例，皆必須具備獨立校驗重試請求的完整能力。

### 高風險呼叫的「二元法則（Rule of Two）」

在三個關鍵維度上審查每一次呼叫：

- 它是否正在吞吐不可信的外部輸入？
- 它是否具備讀取敏感情資的權限？
- 它是否會引發具實體副作用的外部變更？

任何單一的自動化執行步驟，**絕不可同時兼具這三項特徵**！必須主動將其拆解為多個階段、降級其運行權限，或透過 MRTR 機制強制引入人類使用者的顯式授權確認。這是一套經過實戰檢驗的系統架構啟發式原則，而非單純的協定開關。

### 在正式執行前逐級收窄權限

純粹的無狀態並不等同於絕對安全。無狀態消除了隱藏的歷史狀態，但一個結構完整的自包含請求，依然可能要求一個權限過大的處理常式洩漏敏感資料或實施不可逆的重大變更。真正的安全性源自於在每一個系統邊界處「逐級收窄權限（Reducing Authority）」：

1. **強型別動詞（Typed Verb）**：僅對外暴露邊界狹窄的專有動作（如 `archive_note`），絕不提供通用寬泛的 `run` 或 `request` 等可能被濫用擴展的操作。
2. **引數深度校驗（Validated Arguments）**：盡可能採用閉合的 Schema 定義、堅決拒絕未知欄位、統一對識別碼實施單次標準化解析、限制字串長度與資料大小，並在評估安全策略前嚴格驗證目標位置、租戶歸屬與資源所有權。
3. **即時授權覆核（Current Authorization）**：將通過認證的主體，與當前調用的具體動詞、目標資源、運作環境以及標準化引數進行即時綁定。工具註解與用戶端能力宣告絕不能充當此項授權的憑證。
4. **動作強綁定的審核確認（Action-Bound Approval）**：針對具實體副作用的操作，將使用者的授權確認，深度綁定至動詞與標準化引數的特徵雜湊、請求主體、有效期限以及一次性 Nonce 策略。任何欄位的微小變動皆必須重新發起確認。
5. **一等公民的合規拒答（First-Class Refusal）**：將模型拒絕、授權逾時、使用者否決以及不安全目標，視為正常的標準業務終態，嚴禁觸發任何外部副作用，亦不可將拒答退化為呼叫權限更弱的備用工具。
6. **去敏審計證據（Redacted Audit Evidence）**：詳實記錄操作主體、准入的描述符版本、安全策略修訂版、被授權的標準化目標、決策理由以及實體執行是否正式啟動。儲存特徵雜湊或去敏遮罩後的數值，嚴禁在審計日誌中裸露機密金鑰。

每一次權限過濾，皆在實質收窄下一個元件所被允許執行的操作空間。最終的業務處理常式接收到的應當是經過嚴格校驗的領域指令，而非原始的模型文字加上寬泛的全局金鑰。在 MRTR 重試、任務更新或閘道器轉發呼叫中，必須從頭重複執行上述整條防護鏈。先前的確認絕不能讓後續的請求自動升格為免檢流量。

### 現代與傳統歷史互動路徑

Roots、Sampling 與 Logging 在針對 2026-07-28 規範的全新實作中已被正式廢棄。API 閘道器僅可將舊有的請求通道程式碼，作為帶有版本門控的傳統相容路徑進行隔離維護。

絕不要圍繞「基於連線階段的 Sampling 限流器」去建構全新的防禦體系。配額管制應當精準施加於已認證的使用者主體、發布者、實體資源、目標工具以及具體時間視窗之上。針對現代互動場景，應重點審查 MRTR 的輸入請求與回應內容。

### 無狀態傳輸檢查清單

- 在單一 POST 入口端點上接收現代 MCP 訊息；
- 對現代 GET 與 DELETE 請求堅定回傳 405；
- 絕不簽發亦不依賴 `Mcp-Session-Id`；
- 忽略任何傳統連線階段與重播標頭，絕不將其作為授權輸入；
- 為該次 POST 請求回傳標準 JSON 或請求範疇的 SSE 串流；
- 僅在用戶端顯式發起 `subscriptions/listen` 訂閱時，才推送長連線變更通知。

```figure
tp-tool-poisoning
```

## Build It｜動手實作

`code/main.py` 在行程內部實作了一款小巧嚴密的微型安全閘道器模型：它能對完整工具描述符進行標準化與雜湊鎖定、偵測後設資料投毒與名稱搶佔衝突、嚴格校驗現代請求信封與 HTTP 路由標頭，並在帶簽名 `requestState` 與注入的共享防重放儲存庫保護下，完成包含授權確認的雙輪安全匯出。

該模型運作於 HTTP 轉接層完成 Body 與標頭解析之後。它不負責解析底層的 `Content-Type` 與 `Accept`。若需完整的傳輸層轉接器，請介接第 09 課中嚴格要求 `Content-Type: application/json` 以及包含 `application/json` 與 `text/event-stream` 之 `Accept` 標頭的標準 Streamable HTTP 轉接層。

執行方式：

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
python3 -m unittest discover code/tests -v
```

範例程式碼故意對某個描述符實施了竄改。靜態掃描器與特徵雜湊比對各自獨立產出了審查警報；隨後的匯出流程則完整演示了 `input_required` 回應與無狀態的安全重試。

## Use It｜實際應用

將教學程式碼中的 `SAFE_TOOLS` 替換為源自你自身已核准伺服器的標準化快照。在快照中嚴禁包含任何憑證與機密金鑰。在更新特徵雜湊前，務必對每一個全新或變更過的描述符進行人工審查。

在 API 閘道器層級，於服務發現階段執行該檢查，並在實體轉發前再次覆核。快取能夠減輕服務發現的工作負擔，但快取的授權決策必須具備過期時間，並在描述符發生變更時主動失效。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-threat-model.md`。它能產生相容於最新協定規範的威脅模型分析報告：全面涵蓋後設資料、路由層、擴充能力、授權鑑權、MRTR 互動、快取邊界、註冊表安全以及向下相容邊界。

## Exercises｜練習

1. 將已認證的使用者主體與當前授權決策，深度簽名封裝進 MRTR 狀態中；隨後模擬以不同主體身分發起重試，證明伺服器能精準攔截越權調用。
2. 將記憶體中的防重放儲存庫替換為具備條件插入（Conditional Insert）特性的持久化資料庫，在測試中證明兩個並發行程絕無可能重複消費同一個 Nonce。
3. 在成功核銷 Nonce 之後、模擬實體匯出執行之前注入一次崩潰故障。設計並測試能確保系統安全重試或自癒的交易或冪等性規則。
4. 在完全不修改說明文字的前提下，刻意變更某工具的 `inputSchema`。確認全描述符特徵鎖定機制能敏銳捕捉並攔截該變更。
5. 新增一條安全策略：當 `tools/list` 的可見清單隨使用者身分不同而發生變動時，強制拒絕公開快取。
6. 在閘道器後端模擬一個傳統舊伺服器。將所有初始化交握與連線階段處理邏輯，嚴格封裝於顯式的 `2025-11-25` 相容路徑之中。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| Metadata poisoning | 後設資料投毒；在工具描述中植入未經宣告的惡意指令或欺騙性文字 |
| Rug pull | 描述符偷換攻擊；暗中竄改先前已經過審核通過的工具描述符 |
| Tool shadowing | 工具名稱搶佔；不同後端宣告相同短名引發的路由歧義漏洞 |
| Header mismatch | 標頭不符；HTTP 路由標頭與 JSON-RPC Request Body 出現衝突矛盾，錯誤碼 `-32020` |
| Hash pin | 特徵雜湊鎖定；對已核准通過的完整工具描述符計算的標準化 SHA-256 摘要 |
| MRTR | 多輪往返請求；由伺服器請求輸入並由用戶端重試構成的無狀態協定模式 |
| `requestState` | 多輪互動中由伺服器簽發的狀態識別碼，必須嚴格視為完全不可信的外部輸入 |
| Capability declaration | 能力宣告；僅純粹表明協定特性的相容性，絕不代表被賦予了操作授權 |
| Implicit form support | 空白 `elicitation` 引導能力字典，在協定中隱式等價於支援表單模式 |
| Qualified tool name | 具備完整命名空間修飾的穩定閘道器名稱，例如 `notes.search` |

## Further Reading｜延伸閱讀

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety) ——MCP 官方安全防護與信任設計指引
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr) ——MRTR 雙向互動模式手冊
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) ——無狀態 HTTP 傳輸層規格書
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated) ——已正式廢棄的歷史特性與替代路徑指南
