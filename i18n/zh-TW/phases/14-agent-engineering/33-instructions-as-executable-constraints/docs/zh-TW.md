# Agent 指引即具備可執行力的約束（Executable Constraints）

> 以純文字散文形式撰寫的指引僅是空洞的願望；以硬性約束（Constraints）形式撰寫的指引才是嚴謹的測試。工作台將每條操作規則轉化為：Agent 在執行時期能主動自我檢核、審核人員在事後能客觀驗證的實體工程契約。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 32 (Minimal Workbench)
**Time:** ~50 minutes

## Learning Objectives｜學習目標

- 將高層次的路由散文與具體的底層操作規則清晰解耦。
- 將啟動前置條件、絕對禁止紅線、完工定義（DoD）、不確定性處置與審批邊界表達為機器可檢驗的硬性約束。
- 實作一套規則檢查器（Rule Checker），對照規則集對 Agent 運行成果進行客觀評分。
- 確保規則集對 Git Diff 高度友善，使程式碼審查能一目了然看清規則演進。

## The Problem｜問題

典型的 `AGENTS.md` 讀起來往往宛如新人入職手冊。它叮囑 Agent 要「格外小心」、「充分測試」，以及「拿不準時多問問」。然而三天之後，Agent 交付了一份完全沒有單元測試的改動、擅自修改了嚴禁碰觸的受保護目錄，且全程從未開口提問——因為它根本不知道系統紅線究竟劃在哪裡。

當指引具備明確可操作性時，它是強大的防禦武器；而當指引僅是空洞的道德願景時，它脆弱不堪。真正的解法是：撰寫工作台能夠自動解析執行、審核者能夠客觀打分的嚴密規則。

## The Concept｜核心概念

規則應當獨立存放在 `docs/agent-rules.md` 中，與簡短的根目錄路由器分開。每條規則皆擁有唯一名稱、所屬分類以及一項實體檢查常式。

```mermaid
flowchart LR
  Router[AGENTS.md] --> Rules[docs/agent-rules.md]
  Rules --> Checker[rule_checker.py]
  Checker --> Report[rule_report.json]
  Report --> Reviewer[Reviewer]
```

### 涵蓋絕大多數場景的五大核心分類

| 規則分類 | 該規則回答的核心問題 | 具體工程範例 |
|---|---|---|
| Startup（啟動前置） | 在正式開工前必須滿足何種前提？ | 「狀態檔案必須存在且時間戳記不得過期」 |
| Forbidden（絕對紅線） | 哪些破壞性操作絕對不允許發生？ | 「嚴禁編輯 `scripts/release.sh` 發布腳本」 |
| Definition of done（完工定義） | 產出何種客觀證據方能證明任務已完工？ | 「pytest 必須以狀態碼 0 退出且驗收斷言通過」 |
| Uncertainty（不確定性） | 當 Agent 面對模糊歧義時該如何處置？ | 「主動開啟疑問筆記，嚴禁自行瞎猜」 |
| Approval（審批邊界） | 哪些操作強制要求人類工程師批准？ | 「任何新增依賴項、任何正式環境寫入」 |

若某條規則無法被歸入這五個分類之一，通常意味著它混合了多種職責。果斷將其拆分為兩條獨立規則。

### 規則必須具備機器可讀性

每條規則皆包含一個 Slug 代號、所屬分類、一行精確描述，以及一個指向 `rule_checker.py` 中具體函式名稱的 `check` 欄位。每新增一條業務規則，即意味著同步新增一項檢查函式；規則檢查器與工作台同步有機演進。

### 規則對 Git Diff 高度友善

規則在單一 Markdown 檔案中依章節標題嚴格以「一條規則佔據一個 H2/H3」排列。重命名在 Git Diff 中清晰可見。新規則置於所屬分類的頂端。過時的舊規則直接物理刪除，絕不使用註解隱藏——因為工作台是實體系統的最高事實來源，而非記錄團隊上個季度主觀感受的對話日誌。

### 規則 vs 框架層安全護欄

框架層護欄（OpenAI Agents SDK 護欄、LangGraph 中斷）是在執行時期動態強制執行的防禦攔截器。而本課的規則集，則是這些護欄在設計層面所落實的人類可讀、可供審計的合規契約。兩者互為表裡：執行時期負責在對話回合中捕獲即時違規；規則集則確鑿證明該執行時期確實恪守了正確的工程邊界。

### 漸進式揭露：一張地圖，而非整套百科全書

`AGENTS.md` 之所以會無休止地瘋狂膨脹，正是因為每次發生線上事故時團隊便往裡面追加一條規則，卻從未有人主動刪除舊規則。一年過去，該檔案膨脹至兩千行；Agent 剛讀完第一頁便耗盡了注意力預算，隨後僅能盲目執行它所被告知內容的九牛一毛。一份龐大的指引文件之所以失敗，原因與一份長達四十頁的新人入職文件完全一致：讀者只會粗略瀏覽一次，隨後永遠不會回到真正重要的具體章節。

解法絕非單純將檔案改短，而是**實施分層式漸進揭露**。根目錄路由器始終保持極度精簡，短到每個對話階段作業皆能完整閱讀，且除了指標參照之外不含任何冗餘細節。深度的專項指引分散存放在各專題目錄檔案中，僅在任務真正觸及該領域時才按需載入。給予 Agent 一張清晰的導航地圖，而非整座圖書館，讓它自主循著路徑走向當下所需的具體頁面。

```
AGENTS.md                  # router, < 50 lines: what this repo is, where to look, the 5 hard rules
docs/
  agent-rules.md           # the full rule set (this lesson)
  architecture.md          # loaded when the task touches module boundaries
  testing.md               # loaded when the task writes or runs tests
  deploy.md                # loaded only for release work, gated behind an approval rule
feature_list.json          # the backlog (Phase 14 · 36)
```

| 架構層級 | 實體存放位置 | 讀取與載入時機 | 容量配額預算 |
|---|---|---|---|
| Router（路由器） | `AGENTS.md` | 每個階段作業啟動時，始終強制載入 | 嚴格控制在 50 行以內 |
| Rules（規則集） | `docs/agent-rules.md` | 每個階段作業啟動時載入 | 每個分類約一面螢幕容量 |
| Topic docs（專題指南） | `docs/<topic>.md` | 僅當任務實質觸及該專題時按需加載 | 依業務需要深度展開 |

兩項關鍵驗收測試確保分層結構不變形。**可達性測試**：Agent 自根路由器出發，最多透過兩次跳轉即可抵達任何具體規則；因此路由器必須直接以相對路徑連結每個專題文件，而非用散文進行抽象描述。**新鮮度測試**：路由器短小精悍，使審核者在每次 PR 審查時皆能完整重新通讀一遍，這是阻止它再次退化為龐大百科全書的唯一屏障。一個無法被解析的死連結，比缺失規則更為致命；因此，路由器中出現失效連結本身便屬於一項嚴重的啟動前置違規。

```figure
wb-rule-checkoff
```

## Build It｜動手實作

`code/main.py` 實作了以下核心功能：

- 能將規則解析為強型別資料結構的 `agent-rules.md` 剖析器；
- 對應每個 `check` 參照的 `rule_checker.py` 風格檢查函式；
- 演示一次 Agent 運行故意違反了兩項規則，隨後由檢查器精準捕獲並產生報告。

運行實驗：

```
python3 code/main.py
```

輸出包含：已解析的規則集清單、運行軌跡、逐條規則的通過／失敗判定，並於同級目錄下持久化產出 `rule_report.json` 診斷檔案。

## Production patterns in the wild｜真實世界中的生產級模式

三大實戰模式將能存活一個季度的優秀規則集，與在一週內迅速腐化廢棄的脆弱設定徹底區分開來：

**在編寫當下強制標註嚴重性等級**：每條規則皆必須明確宣告 `severity`：`block`（阻斷）、`warn`（警示）或 `info`（資訊）。檢查器會完整回報全部三個等級；但執行時期僅會針對 `block` 實施強制拒絕。許多團隊在初期往往過度高估嚴重性，隨後在交付截稿壓力下又悄悄全面放行；在編寫當下強制標註，能在源頭逼迫工程師進行冷靜標定。搭配驗收關卡（第 38 課），任何針對 `block` 規則的人工手動覆寫放行，皆必須簽名記錄至 `overrides.jsonl` 審計日誌中。

**將規則過期日作為強制清理機制**：每條規則皆標註明確的 `expires_at` 到期日（預設為建立後 90 天）。當一條未過期的規則連續 60 天內發生違規的次數為零時，檢查器會發出警示；在下季度的審查中，團隊必須提出正當理由保留它、將其降級為 `info`，或果斷將其物理刪除。Cloudflare 發布的生產級 AI 程式碼審查實測報告（2026 年 4 月，涵蓋 30 天內 5,169 個儲存庫的 131,246 次審查運行）指出：具備顯式過期機制的儲存庫，其規則總數能健康穩定在 30 條以內；而缺乏該機制的儲存庫，規則數量迅速失控飆升至 80 條以上，且絕大多數從未被真正觸發過。

**Markdown 作為原始碼，JSON 作為熱路徑快取**：`agent-rules.md` 是由人類維護編輯的原始碼檔案；而 `agent-rules.lock.json` 則是供檢查器在即時熱路徑上高速讀取的序列化快取。Lock 快取由 pre-commit 掛鉤自動重新生成。Markdown Diff 易於人類審查；而 JSON 則避免了在每個對話回合重複消耗 Markdown 剖析耗時。其架構形態與 `package.json` / `package-lock.json` 以及 `Cargo.toml` / `Cargo.lock` 完全如出一轍。

## Use It｜實際應用

在正式環境中：

- Claude Code、Codex、Cursor 在階段作業啟動時讀取該規則集，並在拒絕危險操作時精確引用對應條款。檢查器隨後在 CI 中重新全量執行，即時防範靜默漂移。
- OpenAI Agents SDK 將相同的檢查項目註冊為輸入與輸出護欄。Markdown 負責充當人類可讀的契約文檔；SDK 則在執行時期負責強制執行。
- LangGraph 中斷（Interrupts）在執行中的節點違反規則時即時觸發。中斷處理常式讀取違規條款、彈出提示詢問人類，隨後依據決策平滑復原。

該規則集在上述三大體系中皆具備完美的可移植性，因為其本質純粹是 Markdown 文字結合具名函式。

## Ship It｜交付成果

`outputs/skill-rule-set-builder.md` 是一項實用的規則集建置技能。它透過結構化訪談引導專案負責人，將既有的散文形式指引精確梳理並分類為五大類別，最終產出具備版本控管的 `agent-rules.md` 與對應的檢查器程式碼骨架。

## Exercises｜練習

1. 若你的垂直業務確實存在特殊需求，嘗試定義第六個規則類別。提出完整的架構論證，證明它為何無法被收斂歸納至既有的五大類別中。
2. 擴充檢查器，使規則支援嚴重性等級標籤（`block`、`warn`、`info`），並使產出的診斷報告能依嚴重性進行多維度匯總。
3. 將規則檢查器接入 CI 自動化管線中：若在最新的 Agent 運行日誌中檢測到任何 block 等級的違規，強制阻斷建置。
4. 為每條規則新增過期欄位。當一條規則在連續 90 天內未曾觸發過任何檢查失敗時，將其自動標記為待審查退役狀態。
5. 找出一份真實存在的 `AGENTS.md` 檔案，並動手將其重構為五類別規則架構。統計其中究竟有多少行文字具備真正的可操作性？又有多少行純屬空洞的願景？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Operational rule | 「實體操作規則」 | 工作台能夠在執行時期直接執行自動化檢查的硬性約束 |
| Aspirational rule | 「空洞道德叮囑」 | 缺乏對應檢查機制的軟性願望；應當升級為可執行檢查或直接刪除 |
| Definition of done | 「完工驗收標準」 | 客觀、背後具備實體檔案檢驗依據、確鑿證明任務已完工的契約 |
| Block severity | 「強制阻斷級別」 | 一旦違規立刻強制中止運行；除非有人類工程師介入否則無法略過 |
| Rule expiry | 「過期規則清理機制」 | 連續 N 天未曾被觸發的規則自動進入退役審查流程，防止系統膨脹 |

## Further Reading｜延伸閱讀

- [OpenAI Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/) ——護欄機制官方文檔
- [LangGraph interrupts](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/) ——中斷斷點實踐手冊
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——高效 Agent 建構指南
- [Rick Hightower, Agent RuleZ: A Deterministic Policy Engine](https://medium.com/@richardhightower/agent-rulez-a-deterministic-policy-engine-for-ai-coding-agents-9489e0561edf) ——正式環境中的 block/warn/info 分級策略實戰
- [Cloudflare, Orchestrating AI Code Review at Scale](https://blog.cloudflare.com/ai-code-review/) ——覆蓋 13 萬次審查運行的規則編排經驗總結
- [microservices.io, GenAI development platform — part 1: guardrails](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) ——規則與 CI 之間的深度縱深防禦
- [Type-Checked Compliance: Deterministic Guardrails (arXiv 2604.01483)](https://arxiv.org/pdf/2604.01483) ——以 Lean 4 形式化驗證作為規則檢查的極限上限研究
- [logi-cmd/agent-guardrails](https://github.com/logi-cmd/agent-guardrails) ——PR 合併卡點實作：範疇限制、變異測試與違規配額管理
- Phase 14 · 32——本規則集所直接植入的極簡工作台基石
- Phase 14 · 38——直接消費並核驗本規則報告的自動化驗收關卡
- Phase 14 · 39——專職為規則符合度進行打分的獨立審核 Agent
