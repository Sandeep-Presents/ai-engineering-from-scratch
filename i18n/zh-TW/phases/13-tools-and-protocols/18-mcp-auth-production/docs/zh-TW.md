# 正式環境中的 MCP 授權認證：簽發者綁定登錄與權杖治理（MCP Auth in Production: Issuer-Bound Enrollment and Tokens）

> 第 16 課打造了 OAuth 2.1 狀態機。本課將為 MCP 2026-07-28 加固其商業正式環境的安全防線：優先選用用戶端 ID 後設資料文件（CIMD）、將已廢棄的動態用戶端註冊（DCR）僅作為相容路徑隔離、嚴格校驗授權回應中的簽發者（iss）、依授權伺服器簽發者索引金鑰憑證、定時重新整理 JWKS 金鑰集，並在每一個無狀態請求中強制校驗鎖定目標受眾（Audience）。
>
> **規格備註（2026-07-28）：** 動態用戶端註冊（DCR）已被宣告廢棄，全面轉向用戶端 ID 後設資料文件（CIMD）。DCR 僅保留作為向下相容過渡機制。當必須使用 DCR 時，用戶端必須顯式宣告正確的 `application_type`。用戶端必須嚴格校驗回傳的 RFC 9207 `iss` 數值，且絕不可跨不同的授權伺服器簽發者復用憑證。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 透過 RFC 8414 規範的後設資料文件探測授權伺服器，並嚴格覆核其能力契約。
- 透過用戶端 ID 後設資料文件（CIMD）完成自動登錄，並將已廢棄的 DCR 作為例外相容路徑嚴格隔離。
- 嚴格校驗 RFC 9207 的 `iss` 欄位，將用戶端註冊資料依授權伺服器簽發者進行隔離索引，並將綁定資源的存取權杖依「簽發者 + 目標資源」進行複合鍵隔離儲存。
- 規劃並實作定時的 JWKS 金鑰集快取與自動重新整理任務，確保簽名驗證在金鑰輪替期間毫秒級平滑銜接。
- 利用 RFC 8707 資源指示器（Resource Indicators）將權杖精準鎖定於單一 MCP 資源，徹底杜絕跨伺服器的混淆代理與重放攻擊。
- 在 JWT 本地校驗與遠端權杖內省（Introspection）之間做出正確技術選型、定義權杖撤銷新鮮度標準，並在身分依賴項故障時落實安全預設。
- 嚴格拆解授權伺服器、資源伺服器與用戶端三大角色的職責邊界，各司其職。
- 依照正式環境檢核清單全面審計授權伺服器，果斷拒絕任何不安全的用戶端註冊或跨資源權杖復用行為。

## The Problem｜問題

第 16 課在記憶體中演示了 OAuth 2.1 的完整互動流程。然而在真實商業正式環境中，存在三大純記憶體模型無法察覺的營運鴻溝。

第一道鴻溝是**用戶端登錄與憑證隔離機制**。一個真實的企業組織內部可能運維著數百台 MCP 伺服器與數萬個 MCP 用戶端。2026-07-28 最新修訂版強烈推薦採用**用戶端 ID 後設資料文件（CIMD）**：用戶端直接將自身完全受控的 HTTPS 網址作為其唯一身分標識，由授權伺服器主動拉取該後設資料。RFC 7591 動態用戶端註冊（DCR）僅作為向下相容過渡路徑保留。當不得不採用 DCR 時，請求必須明確宣告合規的 `application_type`。用戶端必須在簽發者維度下儲存註冊資料，並在 `(issuer, resource)` 複合鍵下儲存 Access Token。簽發者一旦變更，必須重新發起完整登錄；目標資源一旦不同，必須單獨向授權伺服器申請專屬綁定該受眾的新權杖。

第二道鴻溝是**金鑰輪替（Key Rotation）**。JWT 簽名校驗高度依賴授權伺服器對外發布的公鑰集合（即 JWKS，JSON Web Key Set）。授權伺服器會依據排程定期輪替簽名私鑰（通常按小時輪替，遭遇資安應變時可能幾分鐘內緊急輪替）。若 MCP 伺服器僅在開機啟動時抓取一次 JWKS，在遇到金鑰輪替後便會瞬間癱瘓，導致所有後續請求全數校驗失敗。正式環境必須將 JWKS 設計為具備自動重新整理機制的快取，在舊公鑰正式退休前提前抓取新公鑰，並在遭遇未知金鑰時支援單次快取未命中的後備重拉取。

第三道鴻溝是**受眾鎖定（Audience Binding）**。第 16 課引入了 RFC 8707 資源指示器。在正式環境中，這項指示器在每一個進來的獨立請求中皆轉化為硬性的權杖宣告檢驗。MCP 伺服器必須比對 `token.aud` 是否與自身標準的資源 URL 完全相符，若不符則堅決回傳 HTTP 401。這是在協定層面防範惡意用戶端或遭到滲透的第三方伺服器，將為 A 伺服器簽發的合法權杖在 B 伺服器上進行重放的唯一鐵律。

本課將這三大鴻溝具體落實為實體模組。後設資料文件表現為標準的 HTTP 端點；JWKS 快取重新整理實作為排程背景任務結合鍵值儲存；JWT 校驗則實作為資源伺服器在調度任何工具執行前必須強制通過的共通中介軟體。三大角色邊界涇渭分明：授權伺服器負責簽發與金鑰輪替；資源伺服器負責快取與嚴格校驗；用戶端則負責服務發現與安全登錄。

## Scope: Production Enforcement After Lesson 16｜邊界界定：接續第 16 課後的正式環境防護落地

[第 16 課：MCP 安全防護：OAuth 2.1 授權狀態機](../../16-mcp-security-oauth-2-1/docs/en.md) 聚焦於授權碼流程、PKCE、受保護資源探索、資源指示器與權限範圍決策。本課絕非重複定義另一套 OAuth 流程，而是從這些契約已經確立之處出發，深入解決已上線的資源伺服器在面對金鑰輪替、不透明權杖解析、權杖撤銷、外部依賴項當機、滾動發布以及緊急資安應變時，該如何持續穩健執行防護。

正式環境的防護邊界更為聚焦且偏向維運實戰：

- JWT 路徑：在每一次請求中地毯式核驗鎖定的簽發者、演算法、簽名金鑰、受眾標識、時間戳記與權限範圍，同時安全執行 JWKS 快取重新整理。
- 不透明權杖路徑：透過經過認證的後端通道呼叫授權伺服器的 RFC 7662 內省端點，嚴格檢驗回傳的 active 狀態、受眾或目標資源、過期時間、主體識別碼與權限範圍。
- 權杖撤銷政策：明確定義憑證在被撤銷後，至多允許延遲多久在全叢集徹底失效，並量化各級快取對該時效的具體影響。
- 依賴項故障處置策略：明確約定當服務發現端點、JWKS 伺服器、內省介面或撤銷清單發生網路中斷時，系統該如何安全失敗。
- 審計留存：詳實記錄做出裁決的簽發者後設資料、金鑰集版本或內省回應、權杖聲明摘要、安全策略版本與拒絕理由，且嚴禁在日誌中直接儲存明文權杖。

這項界定確保了知識體系的模組化：第 16 課證明了流程的正確性；第 18 課則證明了權杖在抵達真實線上 MCP 請求路徑後，如何持續保持值得信賴，或在異常時被果斷拒絕。

## The Concept｜核心概念

### RFC 8414——OAuth 授權伺服器後設資料規範

位於 `/.well-known/oauth-authorization-server` 的標準文件宣告了用戶端所需的全部端點資訊：

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

用戶端在取得 MCP 資源 URL 後，會發起串聯探索：先透過 RFC 9728（資源伺服器的 `oauth-protected-resource` 文件）取得認可的授權伺服器簽發者清單，隨後透過 RFC 8414（`oauth-authorization-server`）取得該授權伺服器的每一個實體端點。用戶端絕不能在程式碼中寫死任何授權位址。

針對帶有子路徑的資源識別碼，在構造 RFC 9728 的探索路徑時，必須將 well-known 片段精確插入於該子路徑之前。例如針對 `https://mcp.example.com/team/server`，其受保護資源後設資料位於 `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`。若盲目在資源路徑後附加 `/.well-known/...` 是完全錯誤的。

在信任某個身分提供商（IdP）之前，必須嚴格覆核以下契約項目：

- `code_challenge_methods_supported` 必須包含 `S256`（遵循 RFC 7636 的 PKCE）。官方規範極為明確：若該欄位**缺漏**，代表授權伺服器不支援 PKCE，用戶端**必須直接拒絕繼續連線**。
- `grant_types_supported` 必須包含 `authorization_code`，且必須拒絕 `password` 與 `implicit` 等不安全模式。
- 至少具備一條合法的用戶端登錄路徑：`client_id_metadata_document_supported: true`（CIMD，官方推薦首選）、現成的預註冊用戶端、或 `registration_endpoint`（已廢棄的 RFC 7591 相容路徑）。
- 若 `authorization_response_iss_parameter_supported` 為 true，用戶端在授權回應中強制要求提供 RFC 9207 `iss`，並在重新導向後與原先記錄的簽發者字串進行完全一致的比對。
- 在 OAuth 2.1 體系下，`response_types_supported` 必須嚴格等於 `["code"]`。

若缺少 `S256`，MCP 伺服器必須堅決拒絕與該 IdP 進行對接——PKCE 絕不存在任何降級模式。若上述登錄途徑全數未宣告且缺乏預註冊的 `client_id`，則代表部署配置錯誤，系統應直接中斷。

### RFC 9728 複習——受保護資源後設資料

第 16 課已對 RFC 9728 進行了鋪墊。在正式環境中，該文件是用戶端確認「當前這台 MCP 伺服器究竟信任哪些授權中心」的唯一權威依據。單一台 MCP 伺服器允許同時認可多個 IdP（例如一個面向內部員工，另一個面向外部合作夥伴）：

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### 用戶端 ID 後設資料文件（CIMD，官方推薦首選）

CIMD 將用戶端註冊從傳統的「主動推送（Push）」顛覆為「按需拉取（Pull）」。用戶端不再需要請求授權伺服器為其動態簽發一個隨機的 `client_id`，而是直接將自身完全掌控的公開 HTTPS 網址**作為**其 `client_id`！該網址解析為標準的 JSON 後設資料文件；授權伺服器在執行 OAuth 授權流期間，按需主動抓取該文件。信任鏈直接錨定於 DNS：只要伺服器維運者信任 `app.example.com` 網域，便天然信任託管於 `https://app.example.com/client.json` 的用戶端。零註冊往返延遲、無 `client_id` 命名空間耗盡問題，亦無需在各伺服器間同步維護龐大的用戶端狀態表。

用戶端託管的後設資料文件內容範例：

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

文件內部的 `client_id` 欄位值，**必須嚴格等於**其被託管服務的實體 URL（授權伺服器會強制校驗這點；任何不符皆會被果斷拒絕）。授權伺服器透過在 RFC 8414 後設資料中宣告 `client_id_metadata_document_supported: true` 來表明支援。

在當前的 CIMD 規範契約中，`client_id`、`client_name` 與非空的 `redirect_uris` 陣列為必填項。用戶端標識必須是帶有具體路徑的絕對 HTTPS URL。在此範例中雖然展示了 `application_type`，但它並非 CIMD 的強制必填欄位；切勿將 DCR 對於 `application_type` 的強制性複製到偏好的 CIMD 路徑中。

規範特別強調了兩大安全防禦要點：

- **防範 SSRF（伺服器端請求偽造）**：授權伺服器負責主動抓取用戶端出示的網址，因此必須具備嚴密防禦，嚴禁對內部私有網段或管理員介面發起連線。
- **防止本機迴路偽造（localhost Impersonation）**：單純依賴 CIMD 無法阻止惡意攻擊者聲稱擁有合法的遠端後設資料 URL、同時將重導向端點綁定至其本機的 `localhost` 埠號。授權伺服器**必須**在向人類使用者彈出同意授權對話框時，清晰標註重導向 URI 的主機名稱，並**應當**在僅包含 `localhost` 時向使用者發出明確警示。

因為 CIMD 在伺服器端完全無需維護狀態，因此完全不需要像 DCR 那樣維護專門的註冊登記服務。用戶端只需將其後設資料部署在靜態 HTTPS 節點上供授權伺服器拉取即可。

若授權伺服器維運者已預先為用戶端配發了專屬金鑰，優先使用該預註冊資訊；否則首選 CIMD；唯有在兩者皆不可行時，方可降級啟用已廢棄的 DCR。

### RFC 7591：已廢棄的向下相容登錄路徑

動態用戶端註冊（DCR）在 2026-07-28 規範中已被宣告廢棄。僅在面對不支援 CIMD 且無法預註冊的傳統老舊授權伺服器時，作為向下相容過渡路徑保留。相容用戶端發起如下請求：

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

授權伺服器回傳派發的 `client_id` 與供日後修改更新使用的 `registration_access_token`：

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type` 絕非裝飾性欄位。桌面本地軟體必須宣告為 `native`；遠端託管的 Web 服務則宣告為 `web` 並使用嚴格的 HTTPS 重導向端點。對於公有原生用戶端，`token_endpoint_auth_method: none` 是標準預設值。它僅獲配一個 `client_id`，由 PKCE 機制提供所有權證明（Proof-of-possession）。

三大正式環境維運防禦要點：

- 註冊端點必須嚴格依來源 IP 實施頻率限制（Rate Limit）。否則惡意攻擊者能輕易撰寫腳本發起數百萬次虛假註冊，徹底耗盡資料庫中的 `client_id` 命名空間。
- 部分企業級 IdP 強制要求提供 `software_statement`（由權威中心簽署的 JWT 軟體聲明）。在正式環境中，應配置嚴格的簽名校驗，拒絕來自本機迴路之外的未簽名註冊請求。
- 派發的 `registration_access_token` 在資料庫中必須以特徵雜湊形式儲存，嚴禁儲存明文。該權杖一旦洩漏，攻擊者便能隨意竄改該用戶端的重導向 URI。

### RFC 8707 複習——資源指示器（Resource Indicators）

第 16 課確立了其基礎語義。正式環境的強制鐵律為：每一次向授權伺服器請求 Token 時，必須顯式包含 `resource=<canonical-mcp-url>`，且 MCP 伺服器在接收到請求時，必須逐請求強制核驗 `token.aud` 是否嚴格等於自身的資源 URL。規範定義的標準 URL 是專屬於該伺服器的最高精度標識：採用全小寫的協定與主機名稱、不帶 URL 片段，且約定不帶末尾斜線。路徑片段**絕不可**被隨意剔除——當同一個網域名稱下共存多台不同的 MCP 伺服器時，必須依賴路徑進行精確區分。`https://mcp.example.com`、`https://mcp.example.com/mcp`、`https://mcp.example.com:8443` 與 `https://mcp.example.com/server/mcp` 皆屬於合法的標準資源 URI。為每台伺服器選定一個固定識別碼，並將 `aud` 與其精確綁定。（本課教學模擬為了簡潔起見採用如 `https://notes.example.com` 的純主機名稱受眾；在同一來源下共管多台 MCP 伺服器的正式部署中，則透過路徑明確區分。）

### RFC 7636 複習——PKCE 密碼學防禦

PKCE 在 OAuth 2.1 中屬於強制必備項目。授權碼流程必須始終伴隨 `code_challenge` 與 `code_verifier`。授權伺服器必須堅決拒絕任何缺少校驗碼、或校驗碼與當初登記的 S256 挑戰摘要不符的換約請求。

### MCP 2026-07-28 授權設定檔規範（Profile）

當前最新的 MCP 修訂版在全面實施無狀態傳輸的同時，完整保留了 OAuth 資源伺服器的安全防線。由於在協定層面不存在連線階段可供快取授權決策，授權防護層必須在每一次請求中獨立執行鑑權校驗：

- 實作符合 RFC 9728 規範的受保護資源後設資料，並透過 401 回應中的 `WWW-Authenticate: Bearer resource_metadata="..."` 標頭、**或**標準的 `/.well-known/oauth-protected-resource` 端點對外發布（SEP-985 將該標頭設為選用，並提供了 well-known 作為兜底回退）。其 `authorization_servers` 清單中**必須**至少包含一家受信任的授權伺服器。
- 在**每一次**進來的獨立請求中，僅接收位於 HTTP `Authorization: Bearer ...` 標頭中的權杖——嚴禁在 URL Query 中傳遞，亦絕不可僅在連線建立時檢查一次便終身免檢。
- 逐請求嚴格校驗 `aud`、`iss`、`exp` 以及所需權限範圍。伺服器**必須**確認該權杖是專門為自身所簽發；缺少 `aud` 或受眾不符的權杖必須一律堅定拒絕，絕不可寬容當作萬用字元（Wildcard）。
- 在回傳 HTTP 401 或 403 時，必須輸出 `WWW-Authenticate: Bearer` 標頭，其中包含 `error=...`、指向後設資料文件 URL 的 `resource_metadata="<PRM-URL>"` 參數，以及在 `insufficient_scope`（403）權限不足時附帶的 `scope="..."` 挑戰。請特別注意：該標頭參數名稱嚴格為 `resource_metadata`（這是一個服務發現指標，標頭中不存在名為 `resource` 的參數）。
- 授權伺服器探索同時相容 RFC 8414 OAuth 後設資料與 OpenID Connect Discovery 1.0；用戶端必須依照優先順序依序探測這兩個標準後綴。
- 由用戶端（而非伺服器）主導防範**授權混淆攻擊（Mix-Up Attacks）**：用戶端在發起重導向之前，記錄預期的 `issuer`，並在收到實際授權回應時，在出示換約碼之前嚴格校驗回傳的 RFC 9207 `iss` 欄位值。單純依賴 PKCE 無法防禦混淆攻擊，因為用戶端會無辜地將自身的 `code_verifier` 親手送至攻擊者指定的偽造 Token 端點。
- 用戶端憑證嚴格歸屬於單一授權伺服器簽發者。若探索出的簽發者發生變更，用戶端必須發起全新登錄，嚴禁跨簽發者出示舊有的 `client_id`、註冊權杖或存取權杖。
- CIMD 是官方推薦的首選登錄機制。DCR 已被廢棄；相容路徑下的 DCR 請求依然必須顯式宣告正確的 `application_type`。

OAuth 2.1 草案是底層基石；各項 RFC 規範是協定外表；而 MCP 規格書則是約束它們的專屬設定檔。

### 部署能力檢核清單

雲端廠商的功能宣傳手冊極易過期。必須對實際部署對接的授權伺服器所回傳的真實後設資料進行自動化檢驗：

| 檢核項目 | 強制決策準則 |
|---|---|
| 探測出的簽發者（Issuer） | 必須與內部安全策略預期的精確 HTTPS 網址完全相符 |
| PKCE 支援 | 必須明確宣告支援 `S256`；若未宣告則立刻中止部署 |
| 登錄路徑 | 優先選用 CIMD；允許預註冊；僅在老舊相容時開放 DCR |
| 授權回應校驗 | 當提供或宣告時，強制校驗 RFC 9207 `iss` 欄位 |
| 資源綁定 | 請求權杖時必須攜帶 `resource`；資源伺服器必須強制匹配 `aud` |
| 憑證儲存隔離 | 依簽發者索引用戶端 ID 與註冊金鑰；依「簽發者 + 資源」索引存取權杖 |
| DCR 向下相容 | 強制宣告 `native` 或 `web`；堅決拒絕與型別不符的重導向 URI |

絕不可單憑產品品牌或付費等級便假設其具備某項能力。必須將線上探測出的完整後設資料納入部署審計證據，一旦必備欄位缺漏，必須立刻安全終止。

### JWKS 重新整理模式（AS 負責輪替，資源伺服器負責重新整理）

必須在語義上嚴格區分兩個動作，混淆它們是真實正式環境中最嚴重的架構錯誤：

- **輪替（Rotate）**：是**授權伺服器（AS）**的專屬職責——產出全新的簽名私鑰、將其公鑰發布至 JWKS 中，並在稍後將過期的舊私鑰正式銷毀。資源伺服器完全無法亦絕不應該執行此操作，因為它根本不持有 IdP 的私鑰。
- **重新整理（Refresh）**：是**資源伺服器**的專屬動作——重新透過 HTTP `GET` 將最新發布的 JWKS 拉取至本地快取中。這是資源伺服器針對 JWKS 唯一允許執行的操作。

正式環境中最常見的故障，正是快取過期導致的誤報阻擋。解法是：結合排程任務與鍵值快取。資源伺服器運行一個定時任務（Cron 或背景定時器），定期抓取 `<issuer>/.well-known/jwks.json` 並覆寫更新本地快取 `cache[issuer] = {keys, fetched_at}`。校驗器始終從該快取中讀取公鑰。當進來的權杖攜帶了一個快取中不存在的未知 `kid` 時，觸發**單次**同步的保底重新整理，隨後重新校驗。這能完美覆蓋兩大情境：日常的定時公鑰更新，以及新簽發權杖搶先在排程定時器前夕抵達的金鑰重疊過渡期。

保底操作**必須嚴格是「重新拉取（Re-fetch）」，絕不能是「產出新金鑰（Rotate）」**！若將快取未命中錯誤地掛載為產出新金鑰，會引發兩大災難：其一，新生成的金鑰依然無法匹配當前權杖的 `kid`，校驗依然失敗；其二，外部攻擊者只要惡意發送大量帶有隨機 `kid` 的垃圾權杖，便能強迫伺服器瘋狂建立無窮無盡的新金鑰，直接引發自我阻斷服務（DoS）崩潰！而重新拉取具備完全的冪等性，面對惡意 `kid` 至多只會浪費一次輕量級的網路查詢。

標準的快取資料結構：

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

在穩定運作狀態下，快取中同時包含新舊兩把金鑰是完全正常的現象。授權伺服器在退役舊金鑰（`k_2026_03`）之前，會提前發布新金鑰（`k_2026_04`），確保在舊金鑰下簽發的既有權杖在自然過期前依然能被合法校驗。快取保存聯集；校驗器依 `kid` 精準匹配。

### 資源伺服器端的核心校驗常式

MCP 伺服器在轉發任何工具執行前執行校驗。`code/main.py` 採用的呼叫結構如下：

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate` 函式解碼 JWT、從 JWKS 快取中解析簽名公鑰（未命中時執行單次安全重新拉取）、驗證密碼學簽名、檢查 `iss` 是否位於允許清單中、檢查 `aud` 是否嚴格等於本伺服器的標準資源 URL、檢查過期時間 `exp`，並校驗是否具備當前操作所需的 Scope——一旦遭遇任何失敗，立刻回傳帶有合規挑戰的 `WWW-Authenticate` 標頭。在資源伺服器端維持單一的中央校驗常式，意味著所有入口端點皆強制通過完全相同的安全防線，徹底杜絕任何繞過鑑權的旁路漏洞。

### 不透明權杖採用內省機制，絕不盲目猜測

並非所有 Access Token 皆為結構化的 JWT。若授權伺服器簽發的是不透明權杖（Opaque Tokens），資源伺服器本體無法直接自文字中解碼出任何可信聲明。此時，資源伺服器必須透過後台經過認證的安全通道，將權杖送至授權伺服器的 RFC 7662 權杖內省（Introspection）端點，並強制要求回傳 `active: true`、吻合的簽發者上下文、精確的 MCP 受眾或資源識別碼、未過期的時間戳記，以及具體工具所需的權限範圍。

內省結果應依據簽發者、單向權杖特徵摘要與目標 MCP 資源進行複合快取。嚴禁將明文權杖直接寫入系統日誌或作為快取標籤。正向快取的有效期限，應取「權杖自身到期時間」、「授權伺服器快取指引」與「內部安全撤銷時效目標」三者中的最小值。負向快取（針對無效權杖）的時效必須足夠短暫，防止剛簽發的合法權杖被誤判為持續失效。針對某一個資源的內省成功結果，絕不能被挪用至另一個資源，即便兩者出示的權杖字串完全相同亦然。

絕不能由完全受攻擊者控制的權杖文字內容來動態決定採用哪種校驗模式。必須將「走 JWT 本地校驗」還是「走遠端內省」的決策，嚴格綁定在經過校驗的簽發者後設資料與伺服器靜態設定檔之中。在 JWT 模式下，必須在本地寫死受信任的簽名演算法與 `jwks_uri`，嚴禁輕信由權杖標頭（Header）所單方聲稱的金鑰 URL。

### 權杖撤銷本質上是一份新鮮度契約

RFC 7009 允許用戶端主動請求授權伺服器撤銷特定權杖。然而，該網路請求並不會瞬間清除分散於全球各資源伺服器本地快取中的既有複本。架構設計必須明確定義系統能夠容忍的最大撤銷延遲（Revocation Freshness Objective），並要求所有各層級快取嚴格恪守該時效。

對於不透明權杖體系，可在高風險敏感操作時強制執行即時內省，或配置極短的正向快取時效；對於自包含的 JWT 體系，通常透過「極短命的 Access Token（如 5 到 15 分鐘）」搭配「Refresh Token 遠端即時撤銷」以及「資安事件時全域吊銷簽名金鑰」進行立體防禦，必要時可在本地維護緊急的黑名單。除非資源伺服器獲得了最新的外部撤銷證據，否則簽名合法的未過期 JWT 在密碼學層面依然會被判定為有效。

使用者登出、帳號遭停用、授權撤回與資安應變是不同的觸發源，但最終皆必須收斂至同一句具備可測性的硬性承諾：在宣告的最大撤銷時間視窗之後，叢集中的每一個伺服器節點皆必須堅決拒絕該憑證。必須透過負載平衡器進行真實的跨節點黑箱抽測，而非僅僅在單一常駐行程中自我驗證。

### 依賴項故障需要明確宣告處置策略

絕不要在例外捕捉（Exception Handler）程式碼區塊中臨時隨興發揮可用性策略。

| 故障情境 | 正式環境安全處置準則 |
|---|---|
| 定時 JWKS 重新整理失敗，但已知 `kid` 依然存在於未過期的有限快取中 | 僅在宣告的過期容錯視窗內允許繼續服務，並即刻發出降級健康警報 |
| 進來的權杖帶有未知的 `kid`，且單次保底重新整理網路請求失敗 | 堅決拒絕；絕不接受任何無法驗證密碼學簽名的權杖 |
| 授權伺服器的遠端內省端點發生網路中斷 | 對所有受保護的呼叫一律實施安全中斷（Fail Closed）；絕不可將網路超時判定為 `active: true` |
| 受保護資源或授權伺服器的後設資料發生非預期突變 | 立即停止接受新用戶端登錄與新權杖取得；在受控應變策略下僅放行預先鎖定且未過期的合法配置 |
| 遠端撤銷端點連線失敗 | 回報登出或撤銷操作未完全成功，盡可能在本機將該憑證標記為不可用，且絕不可向使用者承諾全域撤銷已完成 |
| 本機時鐘來源異常或權杖時間戳記型別畸形 | 堅決拒絕；絕不可為了讓權杖通過而盲目放寬時鐘偏差容忍範圍 |

明確區分「底層相依服務故障」與「憑證本身非法」的本質差異。相依服務中斷屬於系統營運錯誤，應觸發健康度降級與重試排程；而簽名錯誤、簽發者不符、受眾錯位、權杖過期或權限不足，則屬於授權拒絕。兩者皆絕不可穿透至工具執行常式，且皆絕不可在日誌中洩漏敏感的明文權杖。

### 受眾重放攻擊推演（存取權杖特權限制）

伺服器 A（`notes.example.com`）與伺服器 B（`tasks.example.com`）皆在同一個企業授權伺服器下註冊。伺服器 A 遭到內部攻擊者滲透竊取。攻擊者取得了一枚使用者用於存取伺服器 A 的合法筆記權杖，並企圖將該權杖重放至伺服器 B，試圖竊取使用者的機密待辦任務。

伺服器 B 的校驗器展開防禦：

1. 解碼 JWT，依 `kid` 自快取中檢索公鑰，驗證數位簽名（通過）。
2. 比對 `iss` 是否屬於自身受保護資源後設資料中的 `authorization_servers` 清單（通過——兩者共享同一個 IdP）。
3. 嚴格比對 `aud == "https://tasks.example.com"`（**攔截失敗！**——該權杖內部的 `aud` 明確標註為 `https://notes.example.com`）。
4. 伺服器 B 果斷回傳 HTTP 401 搭配 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`。

受眾聲明（Audience Claim）是協定層面防範跨服務重放攻擊的唯一防線。單純為了節省效能而跳過受眾檢查，是微服務體系中最常見的致命疏失；校驗器必須在每一次進來的獨立請求中嚴格執行，絕不可僅在連線建立時檢查一次。官方規範將此定義為**存取權杖特權限制（Access-Token Privilege Restriction）**：MCP 伺服器 `MUST` 堅決拒絕任何未在受眾中明確指名自身的權杖。

> **命名辨析備註：** 官方規範將*混淆代理人（Confused Deputy）*嚴格保留給另一個關聯但獨立的問題：當某個 MCP 伺服器充當存取第三方外部 API 的 OAuth **代理（Proxy）**時，若該代理使用單一靜態 Client ID 且未經由各用戶端取得使用者的個別授權同意，便將收到的權杖擅自向下游轉發，便會引發混淆代理人漏洞。受眾鎖定解決的是上述的橫向重放攻擊；而混淆代理人漏洞的解法，則是強制落實個別用戶端的使用者實體授權同意，**並且**絕不將進來的外層權杖擅自透傳至下游服務（MCP 伺服器 `MUST` 單獨為下游申請專屬權杖）。

### 授權混淆攻擊（伺服器無法代勞的用戶端專屬防禦）

一個用戶端在其生命週期內，往往需要與全球各地不同的授權伺服器通訊。一個惡意偽造的授權伺服器，能設計陷阱誘騙用戶端將一個誠實合法授權伺服器所派發的授權碼，誤發送至攻擊者掌控的 Token 端點進行換約。受眾鎖定對此無能為力——因為攻擊在權杖真正被簽發之前就已經發生了。防禦該攻擊的唯一責任，完全落在用戶端肩膀上（RFC 9207）：

1. 在向瀏覽器發起重導向之前，用戶端必須在本地安全記錄下經校驗的預期 `issuer` 字串；
2. 當接收到授權回應時，用戶端在向任何端點發送授權碼之前，必須先將回傳的 `iss` 參數與本地預先記錄的簽發者字串進行嚴格字元串比對；
3. 一旦出現任何不吻合（或當授權伺服器宣告支援 `authorization_response_iss_parameter_supported` 但回應卻遺漏 `iss` 時）→ 立刻拒絕，且絕不在前端 UI 上呈現該回應中夾帶的任何 `error` 錯誤欄位。

單純依賴 PKCE 完全無法阻止混淆攻擊，因為用戶端在被誘導轉向時，會毫無防備地將自身的 `code_verifier` 親手奉送至攻擊者的偽造端點。這正是規範強制要求用戶端在維護 PKCE 校驗碼與 `state` 的同時、必須逐請求記錄並嚴格覆核簽發者的核心原因。

### 典型失效模式排查

- **過期的 JWKS 快取**：授權伺服器輪替金鑰後，資源伺服器誤將合法的新權杖全數判定為非法。解法：必須落實「定時排程重新整理 + 未命中單次保底重新拉取」的雙軌架構，絕不可裸存無重整機制的靜態快取。
- **將保底重整誤寫為產出新金鑰**：在快取未命中時錯誤地調用生成金鑰邏輯，不僅永遠無法產出缺漏的 `kid`，更會讓攻擊者利用隨機 `kid` 發動阻斷服務攻擊。保底機制必須嚴格是冪等的 `refresh-jwks` 重新拉取。
- **遺漏 `aud` 宣告**：部分 IdP 在請求中未顯式傳入 `resource` 參數時，會預設在簽發的權杖中省略 `aud` 欄位。校驗器必須將缺失 `aud` 的權杖直接判定為非法拒絕，絕不可寬容當作萬用字元放行。
- **遺漏 `iss` 校驗引發的混淆攻擊**：用戶端未嚴格比對授權回應中的 RFC 9207 `iss` 欄位，導致使用者的授權碼被惡意誘騙至攻擊者伺服器完成盜刷。這是純用戶端缺陷，後端資源伺服器完全無法代為修復。
- **權限提升競爭條件（Scope Upgrade Race）**：同一使用者並發發起兩次動態權限提升，先後產出了具備不同權限範圍的兩枚 Access Token。校驗器必須嚴格以「當前請求實體攜帶的權杖聲明」為準，嚴禁在資料庫中去查詢「該使用者當前理論上具備的最新權限」——否則會引發嚴重的檢查時與使用時（TOCTOU）競態漏洞。
- **註冊權杖失竊**：未加密的 `registration_access_token` 外洩，導致攻擊者得以隨意竄改該用戶端的重導向 URI。在持久化儲存中必須實施特徵雜湊存儲，並在遭遇可疑行為時主動觸發輪替。
- **`iss` 未實施允許清單鎖定**：校驗器盲目信任權杖自身宣稱的任意 `iss`，導致攻擊者能夠自行架設偽造的授權中心，為目標資源自行簽發並通過校驗。受保護資源後設資料中的 `authorization_servers` 清單即為法定白名單，必須強制覆核。
- **憑證或權杖快取分區混淆**：用戶端僅依據目標資源索引註冊憑證，導致將 A 授權伺服器的身分誤出示給 B 授權伺服器；或僅依據簽發者索引 Access Token，導致將為 A 伺服器簽發的權杖重放至 B 伺服器。必須嚴格落實「註冊憑證依簽發者單獨索引」、「Access Token 依 `(issuer, resource)` 複合鍵索引」，並在簽發者變更時強制觸發重新登錄。

```figure
t3-jwks-rotate
```

## Use It｜實際應用

`code/main.py` 以純 Python 標準函式庫完整演示了生產級的完整授權與治理閉環，並劃分出三大實體角色：`AuthorizationServer`（授權伺服器）、`ResourceServer`（資源伺服器）與 `Client`（用戶端）。

在儲存庫根目錄下執行：

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

第一條指令印出簽發者綁定登錄、受眾限制與權杖校驗的完整執行日誌；第二條指令回報 18 項測試全數順利通過（PASS）。全流程完全無需啟動實體網路通訊埠，亦絕不在硬碟上殘留任何明文密鑰。

1. 授權伺服器在 `/.well-known/oauth-authorization-server` 發布標準 RFC 8414 後設資料。
2. MCP 用戶端探測該端點，校驗登錄選項（CIMD 對應 `client_id_metadata_document_supported`，DCR 對應 `registration_endpoint`）以及 `S256` PKCE 支援度。
3. 用戶端檢驗是否存在預註冊資訊，隨後以自身的 HTTPS 用戶端 ID 後設資料文件（CIMD）完成自動登錄。已廢棄的 DCR 作為獨立可測的相容路徑保留。
4. 用戶端記錄通過驗證的簽發者、生成 S256 挑戰碼、接收單次授權碼與 `iss` 標識、完成簽發者一致性覆核，隨後攜帶原始校驗碼與 RFC 8707 `resource` 指示器完成權杖兌換。
5. 用戶端在向 MCP 伺服器調用工具時，於標頭攜帶 `Authorization: Bearer ...`。
6. MCP 伺服器執行 `validate`，自 JWKS 快取中檢索公鑰並驗證簽名。
7. 授權伺服器在後台觸發金鑰輪替；定時重新整理任務主動將最新公鑰拉取至快取中。
8. 下一次工具調用直接基於重新整理後的快取順暢通過校驗，且舊有權杖在金鑰重疊過渡期內依然維持合法可用。
9. 模擬跨伺服器受眾重放攻擊：當攻擊者試圖將該權杖出示給另一台 MCP 資源伺服器時，伺服器精準阻擋並回傳帶有 `audience mismatch` 與 `resource_metadata` 指標的 HTTP 401 挑戰。

教學程式碼為了確保零外部依賴而在 JWT 簽名上使用了基於對稱密鑰的 HS256 演算法；而在真實線上生產中，則全面採用 RS256 或 EdDSA 搭配上述標準 JWKS 機制，其餘所有校驗邏輯完全百分之百同構。在教學實作中，由於兩者運行於同一個行程內，`refresh_jwks` 直接讀取授權伺服器的記憶體金鑰陣列；在實體網路環境中，它對應於向 `jwks_uri` 發起標準的 HTTP `GET` 請求。

## Ship It｜交付成果

本課產出 `outputs/skill-mcp-auth.md`。給定具體的 MCP 伺服器拓撲組態與目標 IdP 的能力清單，該工具將自動輸出標準的認證防護規格書：涵蓋受保護資源後設資料宣告、登錄路徑決策（CIMD、預註冊或 DCR 備選）、JWKS 重新整理週期排程、Scope 權限映射表，以及當 IdP 未能完全滿足 RFC 設定檔時所必須嚴格落實的安全拒絕規則。

## Exercises｜練習

1. 運行 `code/main.py`。端到端追蹤日誌軌跡。重點觀察授權伺服器在第 6 步執行金鑰輪替後，定時任務 `refresh_jwks` 如何即時重新拉取公鑰集，並證明舊權杖（重疊過渡期）與新簽發的權杖皆能在不重啟行程的前提下雙雙順暢通過校驗。

2. 在受保護資源後設資料的 `authorization_servers` 清單中追加第二家合法的 IdP。簽發一枚由新 IdP 簽署的權杖，確認校驗器能合法放行；隨後簽發一枚由未列入清單的惡意 IdP 簽署的權杖，確認校驗器精準攔截並回傳帶有 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` 的標準挑戰。

3. 為 `register_client` 註冊端點新增基於來源 IP 的頻率限制防禦。利用簡單的 Python 字典維護以 IP 為鍵值的權杖桶（Token-Bucket）演算法。

4. 研讀 RFC 7591 規範，找出本課教學 `/register` 處理常式未實施校驗的兩個選填欄位，並動手為其補齊校驗邏輯（提示：思考 `software_statement` 簽名校驗與 `redirect_uris` 的 URL 協定規範）。

5. 接入第二台獨立的授權伺服器。編寫測試確鑿證明：用戶端能夠在本地為其建立完全隔離的簽發者登錄紀錄，並堅決拒絕將第一台簽發者的 Access Token 或 `client_id` 洩漏給第二台授權伺服器。

6. 進行 DoS 防禦實證。向校驗器傳入一個帶有隨機 `kid` 的無效權杖，確認 `refresh_jwks` 至多僅會被觸發執行一次，且授權伺服器的內部金鑰總數絕不增加。隨後故意將保底機制篡改為「未命中時自動產出新金鑰」，觀察金鑰數量如何隨惡意請求瘋狂暴增——實驗結束後務必立刻復原為正確的冪等重新拉取機制。

7. 針對已廢棄的 DCR 機制，分別編寫 `native` 與 `web` 用戶端的測試案例。確認當 Web 用戶端誤傳純 HTTP 重導向網址、或 Native 用戶端缺少精確的本機迴路位址時，皆會被伺服器嚴格拒絕。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| ASM | 「OAuth 後設資料文件」 | 位於 RFC 8414 `/.well-known/oauth-authorization-server` 的標準端點宣告 JSON |
| CIMD | 「用戶端後設資料 URL」 | 用戶端 ID 後設資料文件；直接將 HTTPS URL 作為 `client_id`，由 AS 主動拉取，為 2026 推薦首選 |
| DCR | 「動態用戶端註冊」 | RFC 7591 `POST /register` 端點；已正式廢棄，僅純粹作為向下相容過渡路徑保留 |
| JWKS | 「JWT 驗簽公鑰集」 | 從 `jwks_uri` 端點拉取的 JSON Web Key Set，依金鑰 ID `kid` 建立索引 |
| Rotate vs refresh | 「金鑰更新」 | 輪替（Rotate）是 AS 產出與淘汰密鑰；重新整理（Refresh）是資源伺服器重新拉取公鑰。資源伺服器只能執行重新整理 |
| Resource indicator | 「目標受眾指示器」 | RFC 8707 `resource` 參數，將 Access Token 嚴格鎖定於特定的單一 MCP 資源伺服器 |
| `aud` claim | 「受眾聲明」 | JWT 內部的法定聲明，校驗器將其與自身標準的資源 URL 進行逐字比對 |
| Audience replay | 「權杖跨站重放」 | 將為伺服器 A 簽發的合法權杖惡意出示給伺服器 B；由受眾校驗機制（存取權杖特權限制）完美攔截 |
| Confused deputy | 「代理混淆盲用」 | 帶有靜態 Client ID 的 MCP 代理伺服器在未獲個別使用者同意下擅自轉發權杖的架構漏洞 |
| Mix-up attack | 「授權碼混淆冒領」 | 用戶端被誤導將合法 AS 的授權碼發送至攻擊者端點；由用戶端嚴格覆核 RFC 9207 `iss` 進行防禦 |
| `iss` allow-list | 「信任的簽發者清單」 | 定義於受保護資源後設資料 `authorization_servers` 中的合法授權伺服器白名單 |
| `resource_metadata` | 「後設資料指向指標」 | 在 401/403 回應的 `WWW-Authenticate` 標頭中，指向 RFC 9728 文件網址的標準參數 |
| Public client | 「公有用戶端」 | 無法安全保密 `client_secret` 的原生或瀏覽器應用；強制由 PKCE 提供密碼學所有權證明 |
| `WWW-Authenticate` | 「授權挑戰標頭」 | HTTP 401/403 回應標頭，攜帶 `Bearer error=...` 指令以引導用戶端進行正確的安全恢復 |

## Further Reading｜延伸閱讀

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) ——MCP 授權認證官方最新規範設定檔
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) ——CIMD、簽發者校驗、DCR 廢止與憑證隔離架構變更公告
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) ——CIMD 官方架構草案標準
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) ——授權伺服器動態探索標準
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) ——動態用戶端註冊協定（相容備選路徑）
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) ——公有用戶端防攔截授權碼證明標準
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) ——資源指示器與受眾精確鎖定標準
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) ——受保護資源後設資料探索規範
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207) ——防範混淆攻擊的 `iss` 參數標準規範
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662) ——不透明權杖遠端內省標準
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009) ——權杖主動撤銷協定規範
