# 無狀態 MCP 閘道器與註冊表准入治理（Stateless MCP Gateways and Registry Admission）

> 閘道器應當讓每一條路由轉發完全顯式化。2026-07-28 協定為其賦予了方法、名稱、版本、能力宣告、識別資訊、快取與追蹤邊界，全程無需任何傳輸層連線階段。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 在單一 2026-07-28 端點後端聚合多台 MCP 伺服器，且完全不依賴任何連線親和性（Session Affinity）。
- 在執行安全策略或路由轉發前，嚴格校驗逐請求後設資料與 HTTP 路由標頭。
- 透過穩定命名空間、確定性排序、描述符特徵鎖定、RBAC 權限控制與私有快取安全合併工具。
- 將公開註冊表紀錄視為探索證據，始終在本地實施獨立的准入治理策略。
- 正確路由轉發請求範疇的 SSE、`subscriptions/listen` 訂閱、MRTR 重試以及 Tasks 擴充功能調用。
- 將傳統歷史交握與連線階段相容邏輯，與現代無狀態主幹進行徹底物理隔離。

## The Problem｜問題

將單一用戶端直接連接至單一伺服器非常直觀。但在企業級大型部署中，系統必須面對更嚴苛的架構課題：

- 允許存取連接哪些後端伺服器？
- 哪一個認證主體具備檢視與調用特定工具的合法權限？
- 當兩個獨立後端宣告了完全相同的工具名稱時該如何裁決？
- 工具描述符的非預期變更是如何被嚴格審查把關的？
- 速率限制與合規審計日誌該在何處統一落實？
- 叢集中的任何一個無狀態實例，能否順暢接手處理下一個相繼抵達的請求？

MCP 閘道器（Gateway）坐落於用戶端與多台後端 MCP 伺服器之間。它對外呈現單一的 MCP 入口端點、統一實施跨領域安全策略，並代理轉發已獲准的合法請求。

舊版的閘道器設計往往試圖將單一用戶端連線階段多工分流至多個後端連線階段，並暗中改寫 `Mcp-Session-Id`。這純屬向下相容的過渡設計。在 2026-07-28 現代核心中，完全不存在任何協定連線階段。

## The Concept｜核心概念

### 現代閘道器執行路徑

針對接收到的每一個請求：

1. 從傳輸層授權憑證中認證發起主體；
2. 嚴格校驗 `MCP-Protocol-Version`、`Mcp-Method`、`Mcp-Name` 以及 `params._meta`；
3. 針對當前主體、目標資源、調用方法、工具名稱與引數實施授權鑑權；
4. 套用描述符特徵鎖定、註冊表准入策略、速率限制與資料分類策略；
5. 為選定的目標後端建立一筆全新、自包含的獨立請求；
6. 校驗後端回傳的執行成果，並封裝回傳標準的閘道器成果；
7. 記錄審計日誌，且嚴禁在日誌中洩漏機密憑證。

全流程中沒有任何一個步驟需要依賴隱藏的協定連線階段。業務應用狀態依然可以安全存在於資料庫、顯式識別碼、Tasks 擴充功能或帶簽名的 MRTR 狀態之中。

### 執行期安全策略是閘道器的首要決策

准入治理（Admission）僅負責裁決「哪一個後端版本允許接入閘道器」。它絕不代表對具體線上呼叫的授權。針對每一個進來的請求，閘道器必須依據已認證主體、簽發者與目標資源、租戶邊界、匹配的方法與名稱、標準化引數、准入描述符雜湊鎖定、當前節點健康狀態、能力交集、資料安全等級、速率計量狀態以及動作綁定審核，即時重新計算安全決策。

這項先後順序至關重要：即使某個註冊表紀錄依然處於啟用狀態，某使用者的角色權限可能已被即時撤銷；即使某個描述符雜湊完全吻合，傳入的目標引數可能已惡意跨越了租戶邊界；即使後端伺服器通過了准入審查，突發的應變策略可能正在隔離所有具實體副作用的變更操作。因此，即時執行期策略始終是發出允許或拒絕的最高裁決者，而註冊表與描述符特徵僅是其評估輸入之一。

絕不要將允許決策快取在底層 TCP 連線或已被廢止的連線階段標識下。若策略評估引擎暫時不可用，必須依據操作類別執行明確宣告的失敗策略。保守的安全預設為：對所有狀態變更與敏感讀取實施安全中斷（Fail Closed）；唯有在威脅模型明確允許的前提下，少數預先核准的公開唯讀路徑方可短暫使用快取的已知策略。詳實記錄做出裁決的具體策略版本與失敗路徑，並在對外回傳前再次校驗後端結果。

### 單一 POST 入口端點

現代 Streamable HTTP 規範將每一個 JSON-RPC 訊息封裝於 POST 請求中傳輸：

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

閘道器可為該次 POST 回傳標準 JSON 或請求範疇的 SSE 串流。對於現代請求，GET 與 DELETE 入口堅決回傳 405。傳入的 `Mcp-Session-Id` 與 `Last-Event-ID` 絕不賦予任何權限、連線親和性或重播行為。

HTTP 標頭數值必須與 Request Body 內容嚴格吻合。在查詢後端路由之前，一旦發現矛盾必須立刻拋出 `-32020` 拒絕執行。這使得負載平衡器、API 閘道器與限流器無需完整解析龐大的 Body，即可安全實施初步路由，同時在數學上確保端到端完整性。

嚴格依循鋼鐵順序展開校驗：校驗 JSON-RPC 與後設資料型別 → 比對標頭數值與 Body 內容 → 判定協定版本是否受支援。標頭衝突回傳 HTTP 400 搭配 `-32020`；標頭與內文一致同意了不支援的版本，回傳 HTTP 400 搭配 `-32022` 以及 `data` 嚴格為 `{"supported":["2026-07-28"],"requested":"<actual>"}` 的錯誤物件；未知方法回傳 HTTP 404 搭配 `-32601`。

`ProtocolError` 可攜帶選填的 `data` 欄位，閘道器負責將其序列化至 JSON-RPC 錯誤物件中。單向通知不帶 `id`，絕不可為其產生 JSON-RPC 成功或失敗回應。接收合法的 HTTP 單向通知時回傳空內文的 202。

### 在每一層實施服務發現

閘道器對外為用戶端實作標準的 `server/discover` 介面；同時，它在內部亦對每一個後端伺服器發起服務發現探測，以掌握其支援的協定版本、核心能力與擴充功能。

閘道器對外宣告的範例結果：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

僅對外宣告閘道器自身能夠在端到端保證履行的能力交集（Capability Intersection）。後端支援的某項特性，並不代表閘道器對外暴露是安全的；而若某項閘道器特性在後端缺乏路徑支撐，對外虛假宣傳亦毫無意義。

`serverInfo` 僅供前端展示與除錯之用，絕不可作為替代註冊表或發布者信任的憑證。

### 逐請求的用戶端能力宣告

閘道器向後端轉發的每一個請求，皆必須攜帶專屬的最新 `_meta` 封裝信封：

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

切勿盲目將外層用戶端的能力宣告原樣複製轉發給後端。對於後端伺服器而言，閘道器本身就是其直接用戶端。僅宣告閘道器自身能夠正確代理調度的協定特性。

### 確定性命名空間合併

將後端各伺服器的工具，統一合併於穩定的公共命名空間之下：

```text
notes.search
notes.create
issues.list
issues.open
```

在閘道器內部維護「公共名稱 → 後端實例與原始工具名」的確定性映射表。面對重名衝突，絕不允許隨機選取首個或末個條目。公共名稱本身就是使用者授權審查與合規審計契約的一部分，變更公共名稱屬於破壞性重大變更。

`tools/list` 輸出必須具備絕對的確定性排序。當可見工具清單隨使用者身分而不同時，標註為 `cacheScope: private`。配置合理的 `ttlMs` 存活時間，既能減輕對後端的探測負擔，又能防止使用者私有清單跨授權邊界外洩。

對外暴露的每個工具描述符，皆必須包含穩定名稱、說明文字以及標準物件根節點的 `inputSchema`。命名空間的包裹絕不能丟棄任何必備的描述符欄位。完整的清單回傳結果亦必須包含 `resultType`、伺服器識別資訊與快取提示。

### 鎖定已核准的工具描述符

在准入治理階段，將審查核准的完整描述符進行標準化序列化，並將其 SHA-256 特徵摘要鎖定於對應的公共修飾名稱之下。在後續的清單列舉與實體呼叫時，即時比對線上描述符是否與鎖定摘要吻合。

一旦發現特徵不符：

- 立刻將其從對外的 `tools/list` 中剔除；
- 堅決拒絕任何針對該工具的直接呼叫；
- 發出嚴重的安全審計警報；
- 強制要求安全策略引擎或安全人員重新審核核准，方可更新特徵鎖定。

閘道器是極佳的中央執行卡點，但它無法憑空將一個未經驗證的描述符自動洗白。初次准入的人工審查依然是不可或缺的安全基石。

### 註冊表僅供服務探測，不等於安全准入判決

公開註冊表（Registry）中的 `server.json` 提供了標準的發布後設資料。一個由套件驅動的標準紀錄範例：

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

發布後設資料絕不等於閘道器的安全准入決策。必須將已驗證的發布者與數位出處證據，獨立儲存於專屬的本地准入狀態庫中：

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

閘道器校驗 `server.json` 的資料結構，並將其與外部准入狀態進行交叉檢驗。閘道器自身必須具備明確的准入治理策略。

針對每一個被核准准入的後端服務，必須詳實記錄：

- 精確的註冊表名稱與紀錄識別碼；
- 通過驗證的發布者命名空間或網域所有權證據；
- 允許使用的傳輸協定與端點位址；
- 鎖定的軟體版本或已核准的升級更新策略；
- 軟體製品或工具描述符的特徵雜湊；
- 關聯的授權伺服器簽發者與目標資源；
- 審核人員、核准時間戳記與有效期限。

絕不可僅僅因為某個伺服器的展示名稱看似熟悉便盲目放行。絕不可將出現在公開註冊表中，直接等同於通過了營運安全審查。私有伺服器即便從未登錄於任何公開註冊表中，亦能完全透過同一套本地准入證據模型進行安全治理。

本課實作了閘道器的對接縫隙：在後端服務獲得可路由資格之前，將發布證據與本地准入決策進行強制綁定。[第 30 課：MCP 註冊表供應鏈、准入治理、漂移偵測與安全回滾](../../30-mcp-registry-supply-chain-and-drift/docs/en.md) 將專題建置包含精確命名空間證明、製品數位出處、不可變特徵鎖定、即時描述符漂移監控、註冊表狀態對齊協調、防篡改准入帳本以及基於證據的原子化回滾在內的完整控制平面。請務必將該供應鏈狀態與上述逐請求的執行期決策進行嚴格隔離。

### 憑證代理與隔離

閘道器負責對外認證呼叫端，並在內部以獨立憑證向各後端伺服器發起鑑權。後端伺服器的機密憑證絕不對外洩漏給用戶端。

保持明確清晰的兩層綁定關係：

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

**嚴禁**將外層用戶端出示的閘道器 Token 直接轉發給後端！**嚴禁**將某一後端的 Token 挪用至另一個簽發者或資源！若某個工具需要代表終端使用者發起委派操作，請透過嚴謹設計的 Token 交換協定或宣告模型傳遞，絕不可直接使用共享的服務級全局憑證冒充使用者。

### 無連線階段的速率限制

將速率限制與配額指標，精準鍵值化綁定至：已認證主體、簽發者、目標資源、公共工具名稱、運算成本等級以及具體時間視窗。在無狀態體系中連線階段 ID 本身就不存在，即便存在亦極易被攻擊者隨意更換輪替。

在投入昂貴的高階運算前，先執行廉價的基礎格式校驗。明確約定被拒絕的非法呼叫是否應當計入防防刷濫用限額或業務配額。

### 完整決策鏈審計日誌

日誌中記錄的資訊必須足以完全重現每一次呼叫軌跡：

- 請求 ID 與全鏈路分散式追蹤識別碼（Trace ID）；
- 已認證的主體與簽發者；
- 調用的公共工具名稱與後端實體路由；
- 描述符特徵鎖定版本；
- 安全策略評估裁決與決策原因；
- 執行耗時與成果狀態類別；
- 適用時記錄 MRTR 輪次或關聯的任務 ID。

在寫入日誌前，嚴格去敏 Bearer Token、授權碼、Refresh Token、原始機密以及不必要的敏感業務引數。

### 請求範疇的 SSE 串流

常規的 POST 請求在處理耗時任務時，可回傳綁定於該次請求的專屬 SSE 串流。關閉該 HTTP 回應串流，即直接等同於取消正在傳輸中的非同步請求。

絕不要建立獨立的 GET 串流端點，亦絕不要承諾支援 Last-Event-ID 斷點續傳。這些皆是過時的歷史傳輸假設。

### 長期變更通知全面採用 subscriptions/listen

針對工具清單與資源的動態變更通知，現代用戶端透過 POST 發起 `subscriptions/listen` 請求，並接收長連線 SSE 串流回應。通知過濾器嚴格採用扁平欄位 `toolsListChanged`、`promptsListChanged`、`resourcesListChanged` 以及 `resourceSubscriptions`：

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

首條事件負責確認伺服器實際接受的過濾子集。其訂閱識別碼嚴格等於發起監聽請求時的 JSON-RPC 請求 ID：

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

閘道器隨後僅轉發已獲確認的變更類型。該串流上的每一條通知，其 `params._meta` 中皆必須原樣攜帶相同的 `io.modelcontextprotocol/subscriptionId`。不存在自動重播或自動重連機制。一旦連線中斷，用戶端必須指派新請求 ID 重新發起監聽，並主動拉取所依賴的清單。伺服器主動發起的優雅關閉，會回傳帶有相同訂閱 ID 的終態 complete 結果。

現代路徑徹底取代了舊版的 `resources/subscribe`、`resources/unsubscribe` 以及主動推送的獨立 GET 串流。

### 穿透閘道器的 MRTR 互動

當後端回傳 `resultType: input_required` 時，閘道器唯有在外層用戶端明確宣告支援相應輸入請求時，方可向上透傳該成果。除非閘道器自身有意擔任代理並重構交互，否則必須逐位元組原樣保留 `requestState`。

用戶端攜帶全新的 JSON-RPC 請求 ID 與 `inputResponses` 對原始公共工具發起重試。閘道器重新對該重試實施鑑權審查、確認公共路由合法性，隨後向目標後端發起一次全新的獨立請求。絕不能預設早期的輪次就自動代表無限制的後續授權。

### Tasks 擴充功能路由轉發

Tasks 是一項由 `io.modelcontextprotocol/tasks` 唯一標識的官方標準擴充功能。它絕不是核心協定連線階段的劣質替代品。

用戶端在逐請求能力中宣告擴充支援，而閘道器唯有在自身能夠端到端完整維持任務生命週期的前提下，方可在服務發現中對外宣傳該能力。針對受支援的 `tools/call`，完全由後端服務自主決定回傳常規成果還是回傳 `resultType: task`。任務成果直接包含 `taskId`、`status`、時間戳記、`ttlMs` 以及選填的 `pollIntervalMs`。在向外發送該結果之前，底層必須已確保該任務已處於持久化可讀取狀態。

閘道器為該不透明的任務識別碼記錄已認證主體與後端路由。後續發起的 `tasks/get`、`tasks/update` 與 `tasks/cancel` 呼叫皆將 `params.taskId` 作為 `Mcp-Name` 標頭輸出，為沿途的中繼節點提供路由鍵值。`tasks/get` 回傳標註有 `resultType: complete` 的任務快照，並在終態時內聯終態成果或協定錯誤。`tasks/update` 為未決的輸入金鑰送出 `inputResponses` 並回傳空的確認。`tasks/cancel` 是協同式取消意圖的宣告，回傳確認訊息，絕不保證後端立即終止。

嚴禁實作全新或自訂的 `tasks/list` 或 `tasks/result` 方法。需要輸入的任務會透過 `tasks/get` 暴露完整的嵌附請求；用戶端透過 `tasks/update` 送出解答，而非盲目重試原始工具呼叫。用戶端依照建議間隔進行輪詢；任務建立始終由伺服器主導。

持久化的任務路由狀態是依任務識別碼索引的業務應用資料，絕非協定連線階段。

### 向下相容隔離邊界

若閘道器必須同時服務傳統舊版用戶端或後端：

- 顯式偵測其所屬的協定時代；
- 將初始化交握、傳輸連線階段、GET 串流、資源訂閱以及舊版 Tasks 方法，嚴格隔離封裝在專屬的傳統適配器內部；
- 嚴禁讓傳統連線階段 ID 污染現代無狀態路由與授權體系；
- 優先採用有逾時邊界的服務發現探測與顯式回退策略，絕不允許無聲的隱式降級。

```figure
t3-gateway-funnel
```

## Build It｜動手實作

`code/main.py` 在行程內部實作了一款協定閘道器與兩台後端伺服器。每一次向後端發起的呼叫，皆是一次全新的獨立現代請求。閘道器完整提供了服務發現、基於使用者身分過濾的確定性 `tools/list`、帶命名空間的路由轉發、註冊表 `server.json` 結合外部准入狀態審查、描述符特徵鎖定、RBAC 權限控制、依主體計量的速率限制、全鏈路審計日誌，以及 `subscriptions/listen` SSE 確認模擬。

該模型運作於已完成 Body 與標頭解析的環境下。它不負責底層 `Content-Type` 與 `Accept` 的字串解析。若需完整的傳輸層轉接器，請介接第 09 課中嚴格要求 `Content-Type: application/json` 以及包含 `application/json` 與 `text/event-stream` 之 `Accept` 標頭的標準 Streamable HTTP 轉接層。

執行展示與單元測試：

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
python3 -m unittest discover code/tests -v
```

展示常式將同時印出外層請求 ID 與轉發後的全新後端請求 ID，使每一次無狀態的跨節點跳轉一覽無遺。

## Use It｜實際應用

將教學程式碼中的虛擬後端物件，替換為真正的現代協定用戶端連線。始終堅持以下架構接縫：

- 建立實體連線前先覆核准入紀錄；
- 對外宣告能力前先對後端執行服務發現；
- 實施授權前先解析標準公共名稱；
- 列舉或調用工具前先比對描述符特徵鎖定；
- 轉發前先重新壓印逐請求後設資料；
- 對外回傳前先校驗後端結果結構。

## Ship It｜交付成果

本課產出 `outputs/skill-gateway-bootstrap.md`。它能產生現代 MCP 閘道器的完整架構規劃書：涵蓋入口路由、服務發現、准入治理、命名空間劃分、授權鑑權、快取策略、串流轉發、事件訂閱、MRTR 代理、Tasks 路由、可觀測性以及傳統版本隔離。

## Exercises｜練習

1. 在外層請求與轉發請求的後設資料中加入分散式追蹤上下文（Trace Context），並在審計事件中記錄前後的關聯 ID。
2. 接入一個支援 Tasks 擴充功能的後端服務，並透過 `Mcp-Name` 中的任務 ID 實作 `tasks/get` 的精準路由轉發。
3. 刻意修改某個後端工具的描述符，證明閘道器在服務發現階段與直接呼叫階段皆能精準實施攔截阻擋。
4. 新增一項特定於某主體的專屬能力宣告，並詳述為何此時服務發現成果必須標註為私有快取（Private Cache）。
5. 在完全不向現代 `Gateway` 核心類別注入任何連線狀態的前提下，設計一套傳統舊版適配器介面。

## Key Terms｜關鍵術語

| 術語 | 實際意義 |
|------|---------|
| MCP gateway | MCP 閘道器；坐落於用戶端與多個後端伺服器之間的安全策略與路由代理中心 |
| Admission record | 准入紀錄；綜合發布證據與本地審核決策、正式放行某後端接入閘道器的憑據 |
| Qualified tool name | 具備命名空間修飾的公共穩定路由名稱，例如 `notes.search` |
| Descriptor pin | 描述符特徵鎖定；在服務發現與轉發呼叫時嚴格核驗的完整描述符 SHA-256 摘要 |
| Private cache scope | 私有快取作用域；限定該快取成果僅允許在單一授權安全上下文內部復用 |
| Request-scoped SSE | 請求範疇的 SSE 串流；依附於單一 POST 請求生命週期的事件回應串流 |
| `subscriptions/listen` | 由用戶端發起的長回應 SSE 串流，用於監聽已明確訂閱的長期變更事件 |
| Task route | 任務路由；將不透明的任務 ID 映射至具體後端服務的業務應用層映射關係 |
| Legacy adapter | 傳統相容適配層；專門用以隔離舊版交握與連線階段行為的顯式版本門控邊界 |

## Further Reading｜延伸閱讀

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) ——無狀態 HTTP 傳輸層規格書
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) ——動態服務發現與版本協商官方手冊
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md) ——官方註冊表宣告文件規範
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks) ——官方 Tasks 擴充功能最新草案規範
