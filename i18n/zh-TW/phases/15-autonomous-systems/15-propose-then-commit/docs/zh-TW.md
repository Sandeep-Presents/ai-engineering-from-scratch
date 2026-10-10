# 人在迴圈中：先提議後確認寫入（Human-in-the-Loop: Propose-Then-Commit）

> 2026 年業界對「人在迴圈中（HITL）」達成了高度具體的共識。它絕非「agent 發問、使用者點選核准」這種粗暴互動，而是嚴謹的先提議後確認寫入（propose-then-commit）模式：擬議動作會攜帶冪等性金鑰（idempotency key）被持久化儲存至外部儲存庫；帶著執行意圖、資料血統（data lineage）、觸及權限、爆炸半徑以及回滾方案，完整呈現給人類審查員；唯有在獲得明確積極確認後才執行 commit；執行完畢後立即讀取驗證，確保外部副作用確實正確發生。LangGraph 的 `interrupt()` 搭配 PostgreSQL 檢查點機制、微軟 Agent Framework 的 `RequestInfoEvent`，以及 Cloudflare 的 `waitForApproval()` 皆實現了完全相同的架構。該模式最典型的失效模式是「橡皮圖章式核准」：使用者不假思索便直接點選「核准」。文獻認證的最佳緩解手段，是引入附帶明確核對清單的質詢應答（challenge-and-response）機制。

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency)
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## The Problem｜問題

Agent 即將執行一項操作。使用者必須做出抉擇：核准，還是拒絕。若這項決定是在一瞬間做出的，它極高機率根本沒有經過真正的審查。若這項決定是結構化的，雖然審查較為耗時，但結果高度可信。工程上的關鍵問題在於：如何將結構化審查設計為系統阻力最小的自然路徑？

2023 年代的 HITL 模式本質上是一個同步彈出視窗：「Agent 想要發送主旨為 Y 的信件給 X——是否核准？」使用者隨手點選核准。每個人都產生了系統很安全的幻覺。然而在實務中，這種互動介面極易淪為流於形式的橡皮圖章：使用者核准速度飛快、審核毫無實質把關能力，而當 agent 釀成大禍時，稽核紀錄往往充斥著使用者早已毫無印象的大量核准歷史。

2026 年的主流架構——先提議後確認寫入——將 HITL 建立在持久化底座之上，強制附帶結構化中繼資料，並要求使用者給予明確具體的 commit 確認。所有代管型 agent SDK 皆提供了各自的實作：LangGraph 的 `interrupt()`、微軟 Agent Framework 的 `RequestInfoEvent`、Cloudflare 的 `waitForApproval()`。API 命名雖有不同，底層架構完全一致。

## The Concept｜核心概念

### 先提議後確認寫入的狀態機

1. **提議（Propose）。** agent 生成擬議動作。該動作被持久化儲存至外部儲存庫（PostgreSQL、Redis 或 Durable Object）。包含：
   - 意圖（intent，說明 agent 為何要執行此動作）
   - 資料血統（data lineage，追溯導致此提議的具體資料來源）
   - 觸及權限（permissions touched，涉及哪些權限範圍、檔案或端點）
   - 爆炸半徑（blast radius，評估最壞情況下的損害規模）
   - 回滾方案（rollback plan，若確認生效後，該如何乾淨還原）
   - 冪等性金鑰（idempotency key，每個提議具備唯一雜湊值；重複送出將直接回傳相同記錄）
2. **呈現（Surface）。** 審查人員查閱包含完整中繼資料的提議內容。審查者必須是真實人類（絕非 agent 進行自我審查）。
3. **確認寫入（Commit）。** 人員給予積極確認。動作正式發送執行。
4. **驗證（Verify）。** 執行完畢後，系統會主動回讀外部副作用以確認其確實發生。若驗證步驟失敗，系統將進入已知異常狀態並立即發送警報。

### 冪等性金鑰（Idempotency Key）

若缺乏冪等性金鑰，短暫的網路抖動就可能導致一項已核准的動作被重複執行兩次。具體慘痛範例：使用者核准了「從帳戶 A 轉帳 100 美元至帳戶 B」。網路突然發生瞬斷。工作流程啟動重試。此時使用者雖然只核准了一次，轉帳操作卻被重複執行了兩次。冪等性金鑰將審查核准與單一、唯一的外部副作用牢牢綁定；第二次重試執行將直接視為無操作（no-op）並回傳前次結果。

這正是 Stripe 與 AWS API 在過去十年間廣泛採用的經典冪等架構。微軟 Agent Framework 官方文件明確指出，應當將該成熟模式直接沿用於 agent 的人工審查體系。

### 持久化：為什麼審查狀態能超越行程生命週期

審查等待室是一處 agent 本身絕對無法掌控的持久化狀態。工作流程在此刻暫停（第 12 課）。當人工確認到達時，工作流程能精準從該斷點接續運作。這正是為何 LangGraph 將 `interrupt()` 與 PostgreSQL 檢查點機制綁定，而非單純保存在記憶體中——即便核准指令在兩天之後才姍姍來遲，工作流程依然完整無損。

### 橡皮圖章式核准與質詢應答緩解機制

HITL 預設的陽春介面（僅提供單純的「核准」／「拒絕」按鈕）不可避免地會誘發毫無實質把關的飛速盲目核准。文獻記載的有效緩解之道：採用質詢應答（challenge-and-response）核對清單，要求審查人員在「核准」按鈕被啟用前，必須逐一正面回答特定關鍵問題。具體形式如下：

- 「你是否清楚此動作將觸及哪些核心資源？[ ]」
- 「你是否已親自驗證此動作的潛在爆炸半徑在可承受範圍內？[ ]」
- 「一旦此動作失敗，你是否已具備明確的回滾復原方案？[ ]」

這絕非官僚主義的繁文縟節——這是一道強制的防呆推力。無法自信勾選清單的審查員，要麼主動尋求進一步澄清（問題升級），要麼選擇果斷拒絕（安全預設值）。Anthropic 的 agent 安全研究明確將清單驅動的 HITL 視為遏止橡皮圖章式盲目核准的關鍵防禦措施。

### 哪些動作屬於「具備實質後果」

並非所有操作都需要大費周章地走先提議後確認寫入流程。2026 年的業界指導原則如下：

- **具備實質後果的動作**（強制要求 HITL）：不可逆的寫入、金融轉帳交易、對外發布通訊、正式環境資料庫變更、毀滅性的檔案系統操作。
- **可逆動作**（視情境評估是否引入 HITL）：本機程式碼檔案的修改、測試暫存環境的變更、具備極其清晰回滾機制的撤銷性寫入。
- **純讀取與狀態檢視**（絕不需要 HITL）：讀取檔案、列出雲端資源、呼叫唯讀 API。

### 動作後驗證（Post-Action Verification）

「確認寫入指令已發出」並不等同於「外部副作用已確實正確生效」。網路分割與並行競爭可能導致工作流程誤以為操作已成功，而後端儲存層實際上根本未持久化該變更。驗證步驟會在 commit 後立即重新讀取目標資源以核實狀態。這與資料庫事務中附帶 `RETURNING` 子句，或在 AWS S3 中發起 `PutObject` 之後立即執行 `GetObject` 進行驗證的架構哲學完全一致。

### 歐盟 AI 法案第 14 條的法律要求

歐盟《人工智慧法案》第 14 條明確規定，部署在歐盟的高風險 AI 系統必須配備「有效的人類監督」。法律條文中的「有效」絕非裝飾性詞彙。監管機構的具體指引明確排除了流於形式的橡皮圖章核准模式。在微軟 Agent 治理工具包的法規遵循文件中，附帶質詢應答機制的先提議後確認寫入模式，正是唯一能從容通過第 14 條嚴格法規檢驗的標準架構。

```figure
mx-propose-then-commit
```

## Use It｜實際應用

`code/main.py` 透過 Python 標準函式庫實現了一個先提議後確認寫入的狀態機。持久化儲存庫採用 JSON 檔案。冪等性金鑰由 (thread_id, action_signature) 的雜湊值派生。驅動程式模擬了三種經典情境：一次乾淨順暢的核准流程；一次在短暫故障後發起重試但保證不重複執行的流程；以及橡皮圖章式預設介面與質詢應答核對清單介面的實戰對比。

## Ship It｜交付成果

`outputs/skill-hitl-design.md` 能為所提議的 HITL 工作流程全面審查其是否符合先提議後確認寫入架構，並精準標記出缺失的中繼資料、冪等性防護、狀態驗證機制或質詢應答層。

## Exercises｜練習

1. 執行 `code/main.py`。確認針對已核准提議的重試會直接複用持久化記錄，而絕不會發生重複執行。接著修改冪等性金鑰，讓其包含時間戳記，展示這會如何導致重試產生災難性的二次執行。

2. 為提議記錄擴充一個 `rollback` 欄位。模擬一次動作後驗證失敗的執行情境，展示系統如何自動觸發回滾邏輯。

3. 閱讀微軟 Agent Framework 的 `RequestInfoEvent` 官方文件。指出該 API 所包含但本玩具引擎所缺失的一個關鍵中繼資料欄位。將其補入程式碼中並說明它旨在防禦何種風險。

4. 為一項特定動作（例如「向公開的 Twitter/X 帳號發布貼文」）設計一套質詢應答核對清單。審查員必須回答哪三個問題？為什麼挑選這三個？

5. 挑選一個同步彈出「核准？」對話框便已完全足夠（無需持久化儲存庫）的實際業務場景。說明背後的原因，並明確指出你在此情境下所甘願承擔的風險類別。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Further Reading｜延伸閱讀

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent` 與持久化核准機制。
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()` 與 Durable Objects 整合。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 將 HITL 作為緩解長時程風險的核心防禦。
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — 高風險系統的人類監督法定基準。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 圍繞人類監督建構的憲法級規範。
