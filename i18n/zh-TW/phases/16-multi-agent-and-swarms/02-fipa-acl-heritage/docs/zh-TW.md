# FIPA-ACL 與言語行為理論的歷史傳承（Heritage of FIPA-ACL and Speech Acts）

> 在 MCP 誕生之前，在 A2A 出現之前，早已存在 FIPA-ACL。2000 年，IEEE 智慧實體代理基金會（Foundation for Intelligent Physical Agents）批准了一套標準 agent 通訊語言，其中包含二十種施為詞（performatives）、兩種內容語言以及一整套互動協定——包含合約網（contract net）、訂閱／通知（subscribe/notify）以及條件請求（request-when）。由於本體論（ontology）的額外負擔對網際網路而言過於沉重，它在工業界逐漸沉寂；然而如今 LLM 引領的多 agent 系統復興，正悄悄在沒有形式語意學約束的情況下重新實現相同的思想：以 JSON 契約替代施為詞，以自然語言替代本體論。本課將嚴肅通讀 FIPA-ACL，以便你能看清 2026 年的各大協定決策中哪些是歷史重造輪子、哪些是真正的新穎突破，以及當前浪潮將在何處不可避免地重新踩中 2000 年代早已解決的歷史老坑。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problem｜問題

2026 年的 agent 通訊協定版圖相當擁擠：用於工具連線的 MCP、用於 agent 互聯的 A2A、用於企業稽核的 ACP、用於去中心化信任的 ANP、用於自然語言內容的 NLIP，外加 CA-MCP 與數十項學術提案。每一項規格在發布時皆宣稱自己開創了底層基石。

然而客觀的事實是，絕大多數規格僅是在重新走過一遍二十年前便已確立的決策樹。Austin（1962 年）與 Searle（1969 年）提出的言語行為理論奠定了「言即是行（utterances are actions）」的哲學基石。KQML（1993 年）將其轉化為具體的線路通訊協定。FIPA-ACL（2000 年批准）產出了工業級參考標準：二十種施為詞、SL0/SL1 內容語言，以及合約網與訂閱通知等標準互動協定。JADE 與 JACK 是當時的 Java 參考實作平台。這場標準化運動在 2010 年前後逐漸式微，原因在於其本體論的維護負擔過於龐雜厚重，而輕量級的 Web 技術最終贏得了整個時代。

當你審視 MCP 的 `tools/call`、A2A 的任務生命週期，或 CA-MCP 的共享上下文儲存時，你所看到的本質上是 FIPA 各項設計決策的現代 JSON 化換皮重現。理解這段歷史傳承能帶給你兩項洞察：精準識破哪些所謂的新「創新」實質上是歷史重造輪子，並提前預判新興規格必將重新踩中哪些古典失效模式。

## Concept｜核心概念

### 一段話說明言語行為理論

Austin 敏銳地觀察到，人類的某些話語並非用來描述客觀世界——而是在話說出口的瞬間改變世界。例如「我承諾」、「我請求」、「我宣布」。他將這些語句稱為施為話語（performative utterances）。Searle 將其形式化歸納為五大類別：斷言型、指令型、承諾型、表達型與宣告型。KQML（Finin 等人，1993 年）將此理論工程化落地至軟體 agent：每一則訊息皆由一個施為詞（performative，代表動作類型）加上內容（content，代表動作所指涉的具體標的）所構成。FIPA-ACL 進一步修補了 KQML 的語意漏洞，並標準化收斂為二十種核心施為詞。

### 二十個 FIPA 言語行為（部分清單）

| 施為詞（Performative） | 意圖 |
|---|---|
| `inform` | 「我告訴你 P 為真」 |
| `request` | 「我請你做 X」 |
| `query-if` | 「P 是真的嗎？」 |
| `query-ref` | 「X 的值是多少？」 |
| `propose` | 「我提議我們做 X」 |
| `accept-proposal` | 「我接受這項提議」 |
| `reject-proposal` | 「我拒絕這項提議」 |
| `agree` | 「我同意做 X」 |
| `refuse` | 「我拒絕做 X」 |
| `confirm` | 「我確認 P 為真」 |
| `disconfirm` | 「我否認 P」 |
| `not-understood` | 「你的訊息無法被解析」 |
| `cfp` | 「就 X 徵求提議」 |
| `subscribe` | 「X 變動時通知我」 |
| `cancel` | 「取消正在進行的 X」 |
| `failure` | 「我嘗試了 X，但失敗了」 |

完整清單收錄於官方規範 `fipa00037.pdf`（FIPA ACL Message Structure）。學習的重點絕非死記硬背這些動詞——關鍵在於深刻意識到：清單中的每一個動詞，都精準對應著當前各個 LLM 協定遲早會被迫重新追加的核心原語。

### 標準 FIPA-ACL 訊息格式

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

訊息信封由七個標準欄位承載；單一欄位（`content`）封裝具體酬載。其餘欄位，正是每當你在現代 JSON 協定之上嘗試手動拼裝重試機制、對話執行緒以及語意標註時，所反覆重新發明的輪子。

### 兩大歷史遺產平台

**JADE**（Java Agent DEvelopment framework，1999–2020 年代）是歷史上應用最廣泛的 FIPA 相容執行環境。各 agent 繼承特定基礎類別、互相交換 ACL 訊息、在專屬容器中運作，並透過「行為（behaviors）」進行協同編排。其內建的互動協定函式庫預設提供了合約網、訂閱通知、條件請求以及提議接受等功能。

**JACK**（Agent Oriented Software，商業軟體）則強調在 FIPA 訊息之上建構嚴謹的 BDI（信念-願望-意圖，Belief-Desire-Intention）推理模型。理論形式化程度更高，但工業界採用率相對較低。

當現代 Web 技術堆疊全面席捲並接管多 agent 業務場景時，這兩大平台相繼退場。MCP 與 A2A 正是 2026 年當代的全新執行環境「容器」。

### 為什麼 FIPA 最終式微

- **本體論的沉重負擔。** FIPA 強制要求通訊雙方具備共享本體論才能精準解析 `content`。但在現實中，協商並確立統一本體論是一場耗時數年的漫長標準化泥潭。而 Web 技術直接採用了粗暴有效的 HTTP + JSON 組合拳。
- **無人落地的形式語意學。** SL（語意語言，Semantic Language）提供了嚴謹的真值條件證明，然而多數工業界系統直接塞入非結構化的自由文本，架空了這套形式化體系。
- **工具鏈生態綁定過深。** JADE 深度綁定 Java 生態；JACK 則是昂貴的商業閉源產品。現代多語言開發團隊自然選擇繞道而行。
- **網際網路技術贏得了技術堆疊霸權。** 先是 REST，接著是 JSON-RPC，隨後是 gRPC，取代了 ACL 的專屬傳輸層。

### LLM 復興本質上是 FIPA 輕量化

比對 FIPA 的 `request` 與 MCP 的 `tools/call`：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

相同的信封結構，不同的語法外殼。兩者皆攜帶：誰發送、發給誰、意圖為何、核心酬載、相關聯識別碼。兩者都不是對方的革命性超越，它們只是在同一套設計空間中做出的不同工程取捨。

Liu 等人於 2025 年發布的綜述（《A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP》，arXiv:2505.02279）明確指出了這段血脈傳承：MCP 對應於工具呼叫類的言語行為，A2A 對應於 agent 點對點協同的言語行為，ACP 對應於稽核軌跡的言語行為，而 ANP 則對應於去中心化身分擴充。新興規格本質上就是披著 JSON 語法外衣、放寬了語意嚴謹度的現代 ACL 繼承者。

### 取捨權衡的本質

**FIPA 所賦予、而現代規格所丟棄的資產：**

- 形式語意學——你能夠在數學上嚴格證明 `inform` 意味著發送方確實相信該內容為真。
- 權威收斂的施為詞字典——你無需在架構會議上無休止爭吵「我們是否該新增一個 `cancel` 動作？」。
- 歷經數十年實戰淬鍊的經典互動協定模式——合約網、訂閱通知、提議接受——具備已知的正確性性質。

**現代規格所賦予、而 FIPA 所缺乏的優勢：**

- 與現代任何開發工具天然相容的 JSON 原生酬載。
- LLM 能夠直接解讀的自然語言內容，徹底告別了手工編寫本體論的噩夢。
- 與現代 Web 技術堆疊完全相容的傳輸機制（HTTP、SSE、WebSocket）。
- 具備動態能力發現機制（例如 MCP 即時的 `server/discover` 與 A2A Agent Cards）。

以犧牲嚴苛的意圖語意學為代價，換取較低的落地實作門檻。這正是整場演進背後的本質取捨。

### 值得移植的互動協定

FIPA 規範定義了大約 15 種經典互動協定。其中有三種模式極具實踐價值，值得繼承至當代的 LLM 多 agent 系統中：

1. **合約網協定（Contract Net Protocol, CNP）。** 管理者廣播發布 `cfp`（招標提議呼叫）；競標者回覆 `propose` 報價；管理者最終做出接受或拒絕裁定。這是最經典的任務市場運作架構（Phase 16 · 16 協商談判機制）。
2. **訂閱／通知協定（Subscribe/Notify）。** 訂閱者發送 `subscribe`；每當特定主題狀態變更時，發布者主動推送 `inform`。這正是 2026 年各類事件匯流排的標準架構原型。
3. **條件請求協定（Request-When）。** 「當條件 Y 成立時，執行動作 X」。一種帶有前置條件約束的延時執行機制。在 2026 年的現代對應，正是持久化工作流程引擎中的延遲任務排程（Phase 16 · 22 正式環境擴展架構）。

每一種模式都能清楚地對應到現代訊息佇列、HTTP 輪詢或 SSE 串流通道。

### 當你丟棄本體論時會引發什麼崩潰

在缺乏統一共享本體論的環境下，agent 只能被迫仰賴自然語言來自行推敲意圖。文獻記錄的 2026 年典型失效模式正是**語意漂移（semantic drift）**：兩個 agent 同時使用完全相同的詞彙（例如 `"customer"`），各自底層所指涉的概念卻存在細微差異；接收方 agent 依據自身偏頗的解讀執行了錯誤操作，而外部的 JSON Schema 驗證器卻判定資料結構完全合法。若在 FIPA 的嚴格本體論約束下，此類歧義訊息在解析階段就會被立即一票否決。

無需重回龐雜本體論泥潭的務實緩解防禦：

- 針對 `content` 嚴格約束 JSON Schema——在線路傳輸層直接攔截結構性語法錯誤。
- 採用具備型別定義的工件（A2A 規範）——拒絕模態不匹配的資料。
- 在訊息信封中顯式標註行為施為詞——即使內容採用自然語言，訊息意圖本身依然清晰無歧義。

### 2026 年新興規格對照言語行為歷史

| 現代規格 | FIPA 對應 | 保留的部分 | 捨棄的部分 |
|---|---|---|---|
| MCP `tools/call` | `request` | 明確的意圖、關聯識別碼 | 形式語意學、本體論 |
| MCP `resources/read` | `query-ref` | 明確的意圖、關聯識別碼 | 形式語意學 |
| A2A Task lifecycle | contract-net + request-when | 非同步生命週期、狀態轉換 | 形式化的完備性保證 |
| A2A streaming events | subscribe/notify | 非同步推送 | 具型別謂詞的訂閱 |
| CA-MCP shared context | blackboard（Hayes-Roth 1985） | 多寫入者共享記憶體 | 邏輯一致性模型 |
| NLIP | 自然語言內容 | 原生支援 LLM | 結構描述 |

從上至下通讀此對比表格，其核心規律昭然若揭：保留結構骨架原語，揚棄繁複形式證明，將其餘的模糊語意交由 LLM 去自行弭平。

```figure
sw-contract-net
```

## Build It｜動手實作

`code/main.py` 透過純標準函式庫實現了一個 FIPA-ACL 雙向轉譯器。它能精準編碼與解碼標準 ACL 訊息信封，並具體展示任何現代的 MCP 或 A2A 訊息結構本質上是如何無縫簡化為相同的七個核心欄位。該展示包含：

- 將五種 MCP 風格與 A2A 風格的現代訊息編碼為標準 FIPA-ACL 格式。
- 將 FIPA-ACL 訊息無損解碼還原為現代 JSON 等價格式。
- 在一名管理者與三個競標者之間，使用 `cfp`、`propose`、`accept-proposal` 與 `reject-proposal` 跑通一場完整的玩具合約網（Contract Net）競標協商。

執行指令：

```
python3 code/main.py
```

終端機將並列輸出每一則現代訊息在 2026 年 JSON 形態與其 FIPA-ACL 形態的對照軌跡，隨後完成一次合約網競標的往返編解碼。同樣的協定原語在往返過程中保持不變，只有語法不同。

## Use It｜實際應用

`outputs/skill-fipa-mapper.md` 是一項能深度解析任何新興 agent 通訊協定規格並精準映射回 FIPA-ACL 基準架構的專業 skill。在評估導入任何全新協定之前，使用它能快速給出客觀裁定：「這究竟是一項真正突破的全新原語，抑或只是披著 JSON 語法外衣的傳統 `inform`？」

## Ship It｜交付成果

切勿盲目將沉重的 FIPA-ACL 帶回現代生產線。我們應當繼承的是其嚴謹的自檢核對清單：

- 每一則訊息的底層意圖原語（施為詞）究竟為何？
- 系統是否配備了用於關聯請求-回應以及支援非同步取消的唯一關聯識別碼（correlation id）？
- 是否具備明確定義的內容語言契約（JSON-RPC、純文字、或具備強型別結構的工件）？
- 互動協定是否被視為一等公民原生支援，還是團隊在每次業務中都在從頭手寫合約網？
- 當兩個 agent 對自然語言內容產生語意歧義（語意漂移）時，系統具備何種兜底機制？

在將任何全新 agent 協定推向正式環境之前，應為上述五大問題撰寫架構說明文件。

## Exercises｜練習

1. 執行 `code/main.py`。觀察雙向編解碼流程。精準指出 FIPA 施為詞中的哪一個動詞分別對應至 `tools/call`、`resources/read` 以及 A2A 的任務建立操作。
2. 為合約網展示擴充 `cancel` 施為詞，使管理者能在競標進行中途隨時撤銷任務。思考 `cancel` 能解決哪些單靠「逾時重試」無法解決的失效情境？
3. 閱讀 FIPA ACL 訊息結構規範 (http://www.fipa.org/specs/fipa00037/) 第 4.1 至 4.3 節。挑選一個本課未提及的施為詞，並為其設計現代 JSON-RPC 的等價實作結構。
4. 閱讀 Liu 等人的論文（arXiv:2505.02279）。針對 MCP、A2A、ACP、ANP 四大協定，逐一列出它們各自繼承與拋棄的 FIPA 施為詞家族。
5. 在你自己的系統中，為 `request` 施為詞的 `content` 欄位設計一套最小可行的 JSON Schema。相較於純自然語言，這套結構描述能為你帶來哪些實質保障？其伴隨的架構代價又是什麼？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 言語行為（Speech act） | 「會產生動作的話語」 | Austin／Searle：話語即行動，是 ACL 的理論源頭。 |
| FIPA | 「那個老舊的 XML 東西」 | IEEE 智慧實體代理基金會（Foundation for Intelligent Physical Agents），2000 年將 ACL 標準化。 |
| ACL | 「Agent 通訊語言」 | FIPA 的訊息信封格式：施為詞 + 內容 + 中繼資料。 |
| 施為詞（Performative） | 「動詞」 | 訊息的意圖類別，例如 `inform`、`request`、`propose`、`cfp` 等。 |
| KQML | 「FIPA 的前身」 | 知識查詢與操作語言（1993 年）。較簡單、範圍較窄。 |
| 本體論（Ontology） | 「共享詞彙」 | 內容語言所談論之概念的正式定義。 |
| SL0 / SL1 | 「FIPA 的內容語言」 | 語意語言第 0 與第 1 級，是正式的內容語言家族。 |
| 合約網（Contract Net） | 「任務市場」 | 管理者發出 cfp，競標者提出提議，管理者接受。最經典的互動協定。 |
| 互動協定（Interaction protocol） | 「訊息模式」 | 一串具已知正確性的施為詞序列，例如 request-when、subscribe-notify 等。 |

## Further Reading｜延伸閱讀

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — 將現代規格連結到 FIPA 歷史傳承的 2025 年經典綜述。
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 2000 年批准的訊息信封格式。
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 完整的施為詞目錄。
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) — 目前作為 `request`/`query-ref` 等價物的無狀態工具使用規格。
- [A2A specification](https://a2a-protocol.org/latest/specification/) — 對應合約網與訂閱通知機制的現代 agent 點對點規格。
