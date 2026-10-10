# MCP 授權認證：CIMD、簽發者綁定、PKCE 與權限動態提升（MCP Authorization: CIMD, Issuer Binding, PKCE, and Step-Up）

> 遠端 MCP 請求是無狀態的，但其授權審查絕非匿名。將每一份憑證深度綁定至建立它的簽發者（Issuer），並將每一枚存取 Token 嚴格綁定至接收它的目標資源（Resource）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 透過受保護資源後設資料（Protected-Resource Metadata），標準探測並發現授權伺服器。
- 優先選用用戶端 ID 後設資料文件（CIMD），取代已被正式宣告廢棄的動態用戶端註冊（DCR）。
- 當不得不採用 DCR 向下相容過渡路徑時，精確宣告正確的 `application_type` 應用程式型別。
- 嚴格校驗授權回應中的 `iss` 欄位，並依簽發者實施嚴密的憑證實體隔離。
- 完整落地 PKCE、資源指示器（Resource Indicators）、受眾（Audience）校驗以及漸進式權限範圍擴充。
- 在不依賴任何協定連線階段的前提下，發送通過授權驗證的 MCP 2026-07-28 請求。

## The Problem｜問題

遠端執行的 MCP 伺服器隨時可能讀取私有資料庫、寫入外部生產系統或觸發高昂的非同步任務。身分認證（Authentication）僅僅解決了「是誰出示了這張憑證」；而授權鑑權（Authorization）還必須回答五大核心問題：

- 這張憑證具體是由哪一家授權伺服器簽發的？
- 這枚 Token 究竟被授權給哪一個具體的 MCP 資源？
- 是哪一個用戶端與重導向 URI 完成了整趟授權流？
- 使用者最初審核並同意了哪些具體的操作權限範圍（Scope）？
- 當前發起的這一次獨立請求，是否依然嚴格吻合當初的授權範圍？

2026-07-28 授權規範對用戶端註冊登錄與簽發者處理實施了全方位加固：優先選用用戶端 ID 後設資料文件（CIMD）、廢除傳統 DCR、在 DCR 相容路徑中強制要求 `application_type`、依據 RFC 9207 嚴格校驗回應中的簽發者 `iss`，並嚴格禁止跨簽發者非法復用憑證。

這些安全規則與無狀態核心完美互補，絕不意味著需要恢復過時的交握或 `Mcp-Session-Id`。

## The Concept｜核心概念

### 深刻理解三大角色職責

- **MCP 用戶端（MCP client）**：代表資源擁有者發起呼叫的主控程式。
- **MCP 資源伺服器（MCP resource server）**：驗證 Access Token 並對外提供 MCP 實體端點的服務。
- **授權伺服器（Authorization server）**：負責對資源擁有者進行身分驗證、採集使用者授權同意，並簽發 Token 的權威認證中心。

資源伺服器與授權伺服器在物理上可由同一個團隊運維，但在識別碼、信任邊界與安全校驗職責上必須保持嚴格分離。

### 授權規範僅適用於 HTTP 傳輸層

MCP 授權規範專門為基於 HTTP 的傳輸協定而設計。本地運行的 stdio 伺服器直接受限於本機作業系統與行程層級的信任邊界。絕不要單純為了表面上的架構對稱，而強行在 stdio 通訊上嫁接一套虛假的瀏覽器 OAuth 流程。

針對遠端的 Streamable HTTP 服務，在每一次發起請求時，皆必須在 HTTP `Authorization` 標頭中攜帶 Bearer Token，嚴禁將其置於 URL 查詢參數中。

### 從受保護資源後設資料出發

資源伺服器主動發布符合 RFC 9728 規範的後設資料文件：

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

用戶端從目標 MCP 資源網址出發，首先拉取該文件，選定其中宣告的授權伺服器，隨後拉取該授權伺服器的 OAuth 2.0 或 OpenID Connect 後設資料。

在建構 RFC 9728 的 .well-known 探索路徑時，必須完整保留資源的相對路徑。針對資源 `https://notes.example.com/mcp`，教學程式碼嚴格調用 `https://notes.example.com/.well-known/oauth-protected-resource/mcp`。若盲目丟棄 `/mcp` 後綴，可能會在同一網域主機上誤讀取到其他非相關資源的後設資料。

絕不可單憑主機名稱盲猜授權伺服器位址，亦絕不可輕信未經校驗的錯誤訊息內文所指向的簽發者。用戶端必須在本地維護明確信任的簽發者白名單政策。

### 校驗授權伺服器後設資料

授權伺服器的後設資料應當完整宣告其公開端點與支援的密碼學控制能力：

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

強制要求支援 PKCE S256。將回傳的簽發者字串原封不動地精確記錄下來。該精確字串將成為後續用戶端註冊與 Token 隔離儲存的核心分區鍵（Key）。

### 遵循註冊優先級順序

當用戶端與該簽發者已具備預先約定的正式信任關係時，優先使用預註冊（Pre-registered）資訊；否則，只要授權伺服器宣告支援，一律優先選用用戶端 ID 後設資料文件（CIMD）；僅在授權伺服器過於老舊時，方可降級啟用已被廢棄的 DCR 向下相容路徑；若上述自動化註冊皆不可用，方可向使用者提示手動輸入用戶端資訊。

### 優先選用用戶端 ID 後設資料文件（CIMD）

CIMD（Client ID Metadata Document）賦予了用戶端一個 HTTPS 網址，該網址本身既是用戶端的唯一全域身分標識，同時也是其公開後設資料文件的託管位址：

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

授權伺服器負責主動抓取並校驗該文件。`client_id` 必須是一個帶有具體路徑的 HTTPS 網址，且文件內部宣告的數值必須與該 URL 完全吻合。必填欄位為 `client_id`、`client_name` 與 `redirect_uris`。在此範例中雖然出現了 `application_type`，但它並非 CIMD 的硬性必備要求。其全新的強制要求特別針對 DCR 路徑。

在授權伺服器端抓取該文件時，必須嚴格落實防範伺服器端請求偽造（SSRF）的各項控制：解析並校驗目標 IP、嚴格阻絕本機迴路、私有內部網路與鏈路本地位址、在重導向與 DNS 解析後重複覆核、設定嚴格的重新導向跳數、位元組長度與逾時上限、要求合法 JSON 格式，並僅依據合格的 HTTP 快取標頭進行暫存。將 `client_name` 等字串一律視為不可信的純文字。

CIMD 徹底消除了每次初次通訊皆需動態向授權伺服器申請派發全新金鑰的繁瑣流程，但它絕不會削弱對重導向 URI 的合法性校驗、簽發者信任策略或使用者實體授權同意。

### DCR 僅作為向下相容過渡路徑

動態用戶端註冊（Dynamic Client Registration）雖為相容歷史老舊授權伺服器而暫時保留，但針對所有全新 MCP 實作皆已被正式標記為廢棄。

在調用 DCR 時，必須強制顯式宣告 `application_type`：

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- 桌面原生軟體、行動端 App、CLI 命令列工具與本機迴路重導向應用，一律宣告為 `native`。
- 遠端託管的 Web 瀏覽器端應用，則宣告為 `web` 並配置遠端 HTTPS 重導向端點。

若遺漏該欄位，OpenID Connect 註冊實作者通常會預設為 `web`，從而導致合法的本地本機迴路重導向在嚴格校驗下直接報錯。

將 DCR 程式碼封裝在明確的後備路徑背後。絕不可在遭遇隨意的 CIMD 校驗失敗後，自動無聲回退至 DCR，否則會讓潛在的攻擊者輕易將系統降級至安全性更弱的註冊流程。

### 將憑證嚴格綁定至簽發者

將授權伺服器派發的註冊憑證與金鑰，嚴格依簽發者全稱進行物理隔離儲存：

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

若受保護資源的探索結果從 `https://auth-one.example` 變更為 `https://auth-two.example`，必須徹底重新評估信任鏈。**絕對不可**將簽發給第一個授權伺服器的 Client Secret、DCR Client ID、註冊存取權杖、Refresh Token 或 Access Token 擅自發送給第二個授權伺服器！

CIMD 用戶端標識則截然不同，因為它是一個自託管的公開 HTTPS 網址，而非由某一特定授權伺服器所派發的專屬私密憑證。同一個 CIMD 網址具備高度的可攜帶性：全新的受信任簽發者可以直接抓取並校驗同一份文件，完全無需重複發起 DCR 註冊。然而，後續產出的授權回應與 Access Token，依然必須嚴格按新簽發者分區隔離儲存。

### 搭配 PKCE 的授權碼流程

完整的標準互動流程：

1. 本機生成高熵（High-entropy）隨機字串 `code_verifier`；
2. 計算其 SHA-256 摘要並生成 S256 `code_challenge`；
3. 發起授權請求，完整攜帶 `client_id`、`redirect_uri`、`scope`、`code_challenge` 以及 `resource` 參數；
4. 接收授權伺服器回傳的授權碼 `code`，以及回傳的 `iss` 標識；
5. 在調用任何其他欄位之前，先嚴格校驗 `iss` 是否與當初紀錄的簽發者完全一致；
6. 透過 Token 端點交換金鑰，出示 `code_verifier`、相同的重導向 URI 以及相同的 `resource`；
7. 將取得的 Access Token 嚴密儲存於 `(issuer, resource)` 複合索引鍵值下。

源自 RFC 8707 的 `resource` 參數在授權請求與 Token 交換請求中皆必須顯式出現，用以精確聲明該權杖所專屬綁定的目標 MCP 伺服器標準 URI。

### 嚴格精確校驗 `iss` 標頭

RFC 9207 規範能有效防止授權回應被混淆冒充（Mix-Up Attacks）——即防止攻擊者誘導用戶端將簽發給合法伺服器的授權碼，誤發送給惡意偽造的授權伺服器。

當授權回應中包含 `iss` 欄位時，必須與預先記錄的授權伺服器簽發者實施嚴格字元串比對：嚴禁執行大小寫摺疊（Case folding）、嚴禁剔除末尾斜線、嚴禁移除預設連接埠號，亦嚴禁實施 URL 百分比解碼標準化。一旦出現任何細微不一致，必須立刻中止流程，且絕不可在 UI 上呈現該回應中夾帶的任何可疑錯誤訊息。

已完整支援該規範的授權伺服器會在後設資料中宣告 `authorization_response_iss_parameter_supported: true`；但現代用戶端在收到 `iss` 時，無論該宣告是否存在，皆必須一律強制執行上述嚴格校驗。

### 在 MCP 伺服器端驗證受眾（Audience）

資源伺服器僅能接受明確為自身簽發的合法權杖：

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

任何簽發者不符、過期、無效或受眾不屬於本伺服器的 Token，一律堅定回傳 HTTP 401 拒絕存取。MCP 伺服器絕不可接受或轉發本意為其他第三方服務簽發的權杖。

### 僅請求當前所需的最小權限範圍

始終貫徹最小權限原則：僅申請當前操作所絕對必需的 Scope。若後續調用的工具需要更高權限，伺服器會主動回傳 HTTP 403 搭配明確的動態權限挑戰標頭（Scope Challenge）：

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

用戶端解析該標頭，向使用者清晰說明為何需要追加此項新權限，取得使用者明確授權同意後，發起包含合併權限集合的全新授權流，並以全新的 JSON-RPC 請求 ID 重新發起最初被阻擋的 MCP 呼叫。

絕不能假設挑戰的權限必然包含在先前探索到的 `scopes_supported` 清單內。針對當前具體操作而言，伺服器當下拋出的權限挑戰具有最高權威性。

### 授權鑑權與無狀態 MCP 傳輸層

一次通過授權驗證的工具呼叫，依然必須完整攜帶當前規範的標準請求信封：

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Bearer Token 負責鑑權存取主體的身分與權限；請求內部的後設資料負責協商協定層面的具體行為。兩者各司其職，絕不可相互混淆或替代。

傳輸層校驗依然遵循鋼鐵順序：校驗 JSON-RPC 與後設資料型別 → 比對標頭數值與 Body 內容 → 判定協定版本是否受支援。標頭衝突回傳 HTTP 400 搭配 `-32020`；標頭與內文一致同意了不支援的版本，回傳 HTTP 400 搭配 `-32022` 以及 `data` 嚴格為 `{"supported":["2026-07-28"],"requested":"<actual>"}` 的錯誤物件；未知方法回傳 HTTP 404 搭配 `-32601`。

所有請求層級的錯誤（包含 401 權杖無效與 403 權限不足），皆必須包裝於帶有原始請求 `id` 的標準 JSON-RPC 錯誤信封中回傳。結構化的恢復資料放置於選填的 `data` 欄位中；而 `WWW-Authenticate` 則維持為標準的 HTTP 標頭輸出。單向通知不帶 `id`，絕不可為其產生 JSON-RPC 錯誤信封。接收合法的 HTTP 單向通知時回傳空內文的 202。

伺服器強制實作 `server/discover` 並宣告工具能力，因此它亦必須實作必備的 `tools/list` 方法。工具描述符具備穩定名稱、說明文字以及標準物件根節點的 `inputSchema`。清單輸出具備確定性排序，並包含 `resultType`、伺服器識別資訊、`ttlMs` 與 `cacheScope`。服務發現與不隨使用者變動的工具清單可在授權前直接公開；若可見清單隨主體權限變動，則必須實施正常的授權過濾並標註為私有快取。

### 嚴禁 Token 透傳轉發

MCP 伺服器**絕不允許**直接將用戶端出示的 MCP Access Token，擅自轉發給下游的其他微服務或第三方 API！若需調用下游服務，必須向授權伺服器單獨申請具備正確下游受眾（Audience）的專屬權杖，或透過標準的 Token 交換（Token Exchange）架構完成。受眾校驗機制唯有在所有服務皆堅決拒絕「為其他人簽發的權杖」時，方能築起堅固的安全屏障。

### 重新整理權杖（Refresh Tokens）

Refresh Token 屬於選用特性。一旦簽發，必須實施高規格的機密保護，並嚴格依簽發者與目標資源實施複合索引隔離儲存。絕不能預設所有伺服器皆會簽發它。若授權伺服器支援輪替更新（Rotation），用戶端應主動完成輪替，並具備自動偵測並作廢已失效舊權杖的防禦機制。

```figure
t3-scope-stepup
```

## Build It｜動手實作

`code/main.py` 在行程內部實作了一套完整的協定與授權模擬器。它涵蓋了受保護資源服務發現、授權伺服器後設資料解析、CIMD 動態註冊、帶有版本防護的 DCR 降級相容、應用程式型別校驗、PKCE 密碼學挑戰、簽發者嚴格對齊、綁定資源指示器的 Token 簽發、權限範圍動態挑戰提升、`server/discover`、`tools/list` 以及標準的無狀態工具調用流程。

該模型運作於已完成 Body 與標頭解析的環境下。它不負責底層 `Content-Type` 與 `Accept` 的字串解析。若需完整的傳輸層轉接器，請介接第 09 課中嚴格要求 `Content-Type: application/json` 以及包含 `application/json` 與 `text/event-stream` 之 `Accept` 標頭的標準 Streamable HTTP 轉接層。

執行模擬常式：

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
python3 -m unittest discover code/tests -v
```

終端機日誌將清晰展示：先服務發現後鑑權、CIMD 自動登錄、常規唯讀操作、兩次獨立的動態權限提升（Step-Up），以及基於簽發者的加密憑證隔離儲存。

## Use It｜實際應用

將模擬器中的抽象類別對應至真實的生產元件：

- `ResourceServer.protected_resource_metadata` 映射為符合 RFC 9728 規範的實體端點。
- `AuthorizationServer.metadata` 映射為 RFC 8414 或 OpenID Connect 的標準發現介面。
- `Client.enroll` 映射為 CIMD 自動解析加上顯式的 DCR 相容路徑。
- 簽發者派發的用戶端憑證與 `tokens_by_issuer_resource` 映射為後端加密資料庫中的安全紀錄。CIMD 網址維持全網可攜帶性，而各簽發者產出的授權成果則維持簽發者隔離。
- `ResourceServer.handle` 映射為標準的中間件（Middleware）：在請求轉發給具體工具執行器之前，地毯式驗證 MCP 標頭、Bearer 權杖合法性與目標工具的所需權限範圍，並將每一次請求層級的錯誤妥善包裝進帶有對應 ID 的 JSON-RPC 錯誤信封中。

## Ship It｜交付成果

本課產出 `outputs/skill-oauth-scope-planner.md`。它能規劃標準的註冊優先級時序、依簽發者隔離的憑證儲存庫、應用程式型別校驗規則、PKCE 參數、資源指示器配置、動態權限挑戰協定，以及當前規範下的無狀態請求安全邊界。

## Exercises｜練習

1. 為系統引入 Refresh Token 自動輪替更新（Rotation）機制，並編寫測試證明系統能果斷拒絕已被作廢的舊 Refresh Token 的二次重放。
2. 建立簽發者白名單制度。當受保護資源變更了授權伺服器時，證明系統僅會復用可攜帶的 CIMD 網址，而堅決作廢並拒絕發送所有源自前一簽發者的註冊憑證與 Access Token。
3. 為授權碼（Authorization Code）配置短暫的有效期限。證明過期抵達的換約請求會被授權伺服器堅定拒絕。
4. 建構一個配置有遠端 HTTPS 重導向端點的 Web 用戶端變體，將其在 DCR 中宣告的後設資料，與本機 Native 用戶端進行深度量化對比。
5. 在同一個授權伺服器名下宣告第二個獨立的受保護資源。編寫測試確鑿證明：為第二個資源簽發的 Access Token，絕無法在第一個資源伺服器上通過受眾（Audience）校驗。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| Protected-resource metadata | RFC 9728 標準文件；宣告目標資源本身及其對應認可的授權伺服器清單 |
| CIMD | 用戶端 ID 後設資料文件；以 HTTPS URL 作為 OAuth 用戶端識別碼的全新標準 |
| DCR | 動態用戶端註冊；已廢棄的動態登錄流程，僅純粹作為向下相容老舊服務保留 |
| `application_type` | 宣告為 `native` 或 `web`，用於授權伺服器嚴格校驗重導向 URI 的合法規則 |
| PKCE | 包含隨機校驗碼與 S256 挑戰摘要的防禦機制，保護傳輸中的授權碼免遭攔截截胡 |
| `iss` | RFC 9207 規範在授權回應中強制回傳的簽發者身分識別碼，防止授權混淆攻擊 |
| Resource indicator | RFC 8707 參數；在請求中顯式指明該 Token 所專屬綁定的目標 MCP 伺服器 URI |
| Audience | 權杖受眾；該 Access Token 被合法授權存取的目標資源服務範圍 |
| Step-up | 動態權限提升；當操作超出當前權杖範圍時，發起增量授權並簽發新權杖的機制 |
| Issuer-bound credentials | 簽發者綁定憑證；依授權伺服器的精確簽發者字串實施物理隔離的註冊與權杖儲存體系 |

## Further Reading｜延伸閱讀

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) ——MCP 授權認證官方最新規範
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728) ——受保護資源後設資料標準
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707) ——資源指示器官方規格書
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207) ——簽發者身分識別防混淆標準
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/) ——CIMD 官方架構草案
