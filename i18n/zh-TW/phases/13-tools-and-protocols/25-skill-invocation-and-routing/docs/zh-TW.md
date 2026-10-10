# Skill 呼叫與意圖路由

> 呼叫本質上是一道「權限合法性決策」，緊接著一道「意圖相關性決策」。優質的描述文字能協助模型精準挑選；而健全的系統策略則能裁決該項選取是否合乎授權規範。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## Learning Objectives｜學習目標

- 嚴格區分人類使用者顯式呼叫、模型隱式自主呼叫、應用程式程式化呼叫，以及跨 skill 協同呼叫。
- 將人類可見度（Human Visibility）與模型可選取資格（Model Eligibility）建構為兩個彼此獨立的策略維度。
- 撰寫同時包含「正向觸發條件」與「高度混淆負向邊界（Near-Miss）」的精確意圖路由描述。
- 在系統分散式追蹤與單元測試中，清晰劃分資格審查、意圖選取、脈絡啟用、參數綁定與實體執行等階段邊界。
- 妥善適配各宿主環境的專屬呼叫欄位，絕不將其誤傳為通用的可移植 frontmatter。

## The Problem｜問題

假設你安裝了一套 `database-migration` 資料庫遷移 skill。使用者能透過指令名稱手動執行它；然而模型同樣能在目錄中看見其描述，並在有人提出一般的資料庫常識諮詢時，擅自選取了它。結果，該 skill 在使用者僅需要概念解答的對話中，突兀地產出了一份危險的資料庫架構變更腳本。

為了防止此類事故，你在設定中加入了 `user-invocable: false`，期望阻止人類使用者手動盲目執行。但在另一個執行時期環境中，該欄位被系統直接無視。你改為設定 `disable-model-invocation: true`，期望該 skill 徹底隱藏；但在理解該欄位的特定宿主中，人類使用者依然能透過顯式指令直接呼叫它。

這些欄位名稱本身並沒有問題，出問題的是底層的心智模型。「使用者是否能看見它」、「模型是否能自主選取它」、「應用程式能否預載它」以及「其內部的工具能否被實質執行」，是完全獨立的客觀事實。單一名為 `invocable` 的模糊布林值根本無法表達如此多元的維度。

意圖路由亦存在第二種典型失效模式：若描述文字過於含糊，多個相鄰 skills 會同時具備選取合理性；若描述文字塞滿了關鍵字，無關的任務便會被錯誤觸發。目錄本質上是一個機率性介面：既要足夠精簡以符合上下文配額，又要足夠具體以實現精準路由。

## The Concept｜核心概念

### 發起生命週期的五大途徑

| 呼叫發起者（Actor） | 呼叫形態特徵 | 典型應用場景 | 核心架構風險 |
|---|---|---|---|
| 人類使用者 | 於 UI 選單或 prompt 中指名具體名稱 | 深思熟慮後的特定流程指派 | 使用者預期了宿主系統並未授予的可用性或法定權限 |
| 模型或自主 Agent | 依任務脈絡自目錄後設資料中自主選取 | 自動化專家作業程序調度 | 偽陽性（False-Positive）誤觸發錯誤路由 |
| 外部應用程式 | 透過執行時期程式碼預載或強制啟用 | 產品固化綁定的確定性業務流程 | 隱性耦合於單一特定宿主私有 API |
| 另一個 Skill 或子 Agent | 宣告特定 skill 作為工作流程相依項 | 複合任務模組化封裝 | 循環相依、缺失相依項或脈絡污染洩漏 |
| 自動化評測控端 | 在固定測試情境下精確啟用指定 skill | 可重複驗證的基準效能評測 | 測試了 skill 本體，卻意外繞過了原本待評測的正式環境策略 |

可移植的 Agent Skills 官方規範定義的是套件實體格式。它並未強制統一某種全域斜線指令 UI、隱式路由旗標、應用程式 API 或子 agent 生命週期。

### 呼叫的五大生命週期階段

```figure
skill-invocation-stages
```

請嚴格區分以下專用術語：

- **合乎資格（Eligible）**：代表系統安全策略明確允許當前操作主體請求該 skill。
- **已被選取（Selected）**：代表使用者明確指定了該名稱，或路由分類器判定其高度切題。
- **已被啟用（Activated）**：代表其操作指引已正式注入當前對話的工作脈絡之中。
- **正在執行（Executing）**：代表 agent 已依據該指引啟動模型推論或實質工具調用。
- **執行完成（Completed）**：代表產出的交付產物已通過獨立的成功驗收檢查。

若分散式追蹤日誌僅僅粗糙地記錄 `skill_used=true`，將徹底掩蓋底層故障究竟發生於哪道系統邊界。

### 人類與模型呼叫構成 2x2 決策矩陣

| 人類能否呼叫 | 模型能否呼叫 | 運作模式 | 典型合適情境 |
|:---:|:---:|---|---|
| 是 | 是 | 共享模式（Shared） | 程式碼解釋、測試案例規劃、文件架構審查 |
| 是 | 否 | 僅限人類（Human-only） | 正式發布準備、計費明細匯出、破壞性清理方案規劃 |
| 否 | 是 | 僅限模型（Model-only） | 內部風格規範、領域知識參考手冊、自動支援程序 |
| 否 | 否 | 停用或僅限應用程式 | 階段性灰度發布、已廢棄套件、程式化專屬預載 |

該矩陣是一套系統策略模型，而非通用的標準 YAML 欄位。

當前某個主流宿主環境採用 `disable-model-invocation: true` 表達「僅限人類」列，採用 `user-invocable: false` 表達「僅限模型」列；預設則為兩者皆允許。另一個宿主環境則在 `agents/openai.yaml` 中配置 `allow_implicit_invocation: false`，用以在保留手動顯式呼叫的同時關閉模型的隱式自動選取。這些皆屬於執行時期配接器（Adapters）；未支援該特性的宿主可能會直接忽略它們。

請務必釐清這些極易混淆的細節：`user-invocable: false` 絕非代表「模型不可使用此技能」，而是在定義該欄位的宿主中關閉了人類使用者的手動呼叫入口；`disable-model-invocation: true` 亦非代表「該技能已被徹底停用」，而是在關閉模型自主選取的同時、依然保留人類使用者的手動調用權限。

### 顯式呼叫以「唯一身分」為優先

顯式呼叫直接出示具體的 skill 身分識別碼：

```text
/release-readiness v2.4.0
```

或：

```text
release-readiness check v2.4.0 without publishing
```

目前的 Codex 介面文檔規範使用 `/skills` 進行選取，並支援在請求文字中直接鍵入純 skill 名稱發起呼叫；Claude Code 則文檔規範使用 `/skill-name` 語法並支援宿主專屬的參數展開。具體的指令語法、選單呈現、引號跳脫與變數替換規則全數隸屬於宿主實作範疇。

顯式呼叫依然必須強制通過策略審查。單憑指名某個 skill 名稱，絕不可繞過權限查核、工作區約束、審批卡點或執行時期沙盒隔離。

### 隱式呼叫以「意圖描述」為優先

在隱式自動路由情境下，模型起初僅能看見目錄後設資料，而無法預覽完整正文。因此，描述文字正是該 skill 面向外部的實質路由介面。

脆弱無效的描述：

```yaml
description: Helps with releases.
```

過度寬泛、堆疊關鍵字的描述：

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

邊界清晰的優質描述：

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

優質版本嚴格包含四項核心要素：

1. **核心能力（Capability）**：審查已備妥的發布候選版本。
2. **輸出產物（Output）**：產出就緒度評估報告。
3. **正向觸發邊界（Positive Boundary）**：當使用者詢問版本、標籤、套件或映像檔是否準備就緒時。
4. **負向排除邊界（Negative Boundary）**：一般常規的建置失敗或新功能開發不在其職責範疇之內。

當兩個功能相鄰的 skills 共享高度相似的詞彙庫時，負向排除邊界極具價值。但它絕無法取代嚴謹的近似負例評測（Near-miss Evals）。

### 意圖路由本質上是具備「棄權選項」的分類問題

針對特定 skill `s` 與使用者請求 `x`，抽象的路由評分模型可表示為：

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

實際評分決策可由輕量 LLM 推論完成，而非死板的算術相加。但其工程原則始終不變：最終選取必須同時跨過最低信任門檻，且顯著領先競爭候選者。當客觀證據不足時，系統應當果斷放棄選取（Abstain）。

```figure
skill-routing-abstention
```

對於具備重大破壞性或高影響力的高危險 skills，即便其具備精準描述，開放隱式自動路由依然是不理智的。當偽陽性誤判的代價遠高於自動選取的便利性時，應果斷強制採用「僅限人類」策略。

### 資格審查必須嚴格先於相關性排序

切勿先對所有發現的 skills 進行語義評分、挑選出最高分者，隨後才去查核該 skill 是否合乎呼叫資格。若排名第一的候選者因策略受阻被攔截，這種錯誤順序會導致原本合法且評分次高的候選者被無辜錯過。

在隱式路由中，請嚴格遵循以下順序：

1. 依據當前發起主體（Actor）與運行的宿主配接器，預先過濾所有已發現的 skills。
2. 僅對通過資格審查的候選清單進行語義評分。
3. 若最高分候選者能跨過置信度門檻且無嚴重歧義，則將其正式選取。
4. 若無任何候選者合乎資格，或所有候選者評分皆不足以跨過門檻，果斷放棄選取。

假設 `incident-triage` 獲得高達 `0.80` 的語義匹配分，但其宿主擴充設定宣告停用模型呼叫；而 `incident-review` 獲得 `0.55` 分且允許模型自主呼叫。路由器應當將 `incident-review` 作為合乎資格的最佳候選者進行決策評估。它絕不應挑選了 `incident-triage` 隨後予以拒絕阻擋，並直接宣告終止。

此執行順序亦能確保策略調整不會影響語義相關性分數的本質意義：資格審查決定了候選池，而相關性評分僅負責在該池內部進行優先級排序。

### 意圖路由評測必須引入高度混淆負例（Near Misses）

明確的正向測試案例用以驗證召回率（Recall）：

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

明確無關的負向案例用以驗證基礎精確率（Precision）：

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

而高度混淆負例（Near Misses）則能無情暴露邊界的精確度：

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

該近似負例與發布技能同樣包含 `package` 與 `build` 等關鍵字，但其意圖本質卻屬於完全不同的建置診斷範疇。若評測資料庫僅由顯而易見的正例與風馬牛不相及的負例所構成，將嚴重高估系統在真實環境中的路由表現。

### 參數具備三層遞進表示形式

呼叫參數跨越了多道系統邊界：

```figure
skill-argument-boundaries
```

在每一道邊界上，必須忠實傳遞語意意圖，且絕不將任意文字直接當作可執行程式碼：

- 宿主剖析器決定指令語法與引號跳脫規則；
- Skill 依據宿主約定接收綁定的純文字或環境變數；
- 操作指引嚴格校驗必備欄位與預設數值；
- 工具呼叫將文字轉換為具備強型別的 Schema 並實施二次驗證。

切勿將未經處理的原始文字參數直接字串拼接至 Shell 指令中。應始終優先使用傳入引數陣列（argv）的執行腳本，或呼叫具備嚴格型別約束的 MCP 工具。

### 應用程式呼叫屬於確定性外部編排

外部應用程式可在其工作流程預先獲知任務型別時，主動預載或啟用特定 skill。例如，程式碼審查服務可在人類使用者點選「開始審查」按鈕後，自動預載 `pull-request-risk-review`。

這完全消除了意圖路由的不確定性，但也引入了對執行時期 API 的強依賴。請將該配接邏輯嚴格封裝於可移植正文之外：

```figure
skill-host-adapter
```

確保當該 skill 在其他相容的標準用戶端中被開啟時，其正文依然清晰易讀、運作如常。

### 跨 Skill 呼叫如同類似工具的依賴邊界

假設 `release-readiness` 在檢測到依賴檔案發生變更時，需要進一步調用 `security-change-review`。

呼叫端應當完整提供：

- 目標 skill 的明確身分；
- 具體界定的任務說明與產物路徑；
- 預期的回傳資料契約；
- 發起該次調用的具體業務原因；
- 當目標不可用時的降級回退方案；
- 呼叫深度上限與防迴圈遞迴規則。

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

被呼叫的第二個 skill 絕非被盲目硬拼貼至第一個 skill 的脈絡之中。宿主環境全權決定如何啟用它，以及它是共享現有對話脈絡、在獨立 Fork 的子階段作業中運行，還是作為常規工具執行結果回傳。

### 脈絡生命週期取決於宿主實作

在正式啟用後，skill 正文可能會長久保留於對話歷史中、在脈絡壓縮時被摘要提煉，亦可能運行於獨立委派的子環境中。工具執行授權可能僅持續單一回合，而操作指引卻長久有效。子 agent 可能接收到該 skill，卻完全不繼承父層的過往歷史記錄。

切勿撰寫依賴於特定隱性生命週期假設的脆弱 skill。將持久化狀態保存至實體檔案或結構化儲存中、確保具備安全的重新進入機制，並明確規範中斷恢復後必須重新載入哪些資源：

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## Build It｜動手實作

`code/main.py` 將策略管理與意圖路由實作為相互解耦的兩套配接器。

核心資料模型包含：

- `Actor`：涵蓋人類、模型、自主 agent、外部應用程式、其他 skill 與評測控端等呼叫主體；
- `SkillMetadata`：封裝用於意圖路由的後設資料；
- `InvocationPolicy`：定義人類與模型互動的 2x2 策略矩陣；
- `InvocationRequest` 與 `InvocationDecision`：記錄可追溯的輸入與決策結果；
- `CorePolicyAdapter`：不帶任何宿主專屬擴充的純標準可移植行為實作；
- `ExtensionPolicyAdapter`：支援識別特定宿主自訂擴充欄位的增強型實作；
- `build_invocation_matrix(policy)`：視覺化產出 2x2 決策矩陣檢視；
- `route_request(skills, request, adapter)`：落實「資格審查先於相關性排序」、選取與拒絕決策的完整路由常式。

運行實驗：

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

演示程式會印出一個決策矩陣，並分別展示來自顯式人類、隱式模型、自主 agent、應用程式、跨 skill 組合與評測控端等六種不同途徑的決策報告。其擴充配接器清晰展示了：一個詞彙匹配度極高但因策略受阻的候選者如何在排序前被安全剔除，進而讓評分次高的合法替代方案脫穎而出。它亦支援精確名稱白名單機制。本實驗完全不需要外部模型 API。此確定性路由器的存在，是為了讓策略邊界清晰可審查，而非宣稱純詞彙匹配足以完全複製真實大模型的語意路由能力。

### 為何核心配接器與擴充配接器必須嚴格分立

若單一剖析器試圖賦予它所見到的每個 frontmatter 欄位特定行為，它便在無形中將特定執行時期的私有約定私自抬升為虛假的業界標準。將配接器明確拆分，能強制呼叫端清晰聲明當前生效的究竟是哪套宿主語意。

`CorePolicyAdapter` 嚴格僅遵循應用程式外部傳入的標準策略。而 `ExtensionPolicyAdapter` 則顯式識別一組白名單內的宿主特化欄位，並如實記錄究竟是哪項擴充實質改變了最終系統決策。

## Use It｜實際應用

在對外發布任何 skill 前，請先撰寫一份專屬的呼叫契約：

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

該契約是面向配接器開發與自動化測試的架構設計文件。除非標準規範未來正式將其納入，否則切勿將其直接作為可移植的 `SKILL.md` frontmatter 發布。

## Ship It｜交付成果

本課產出 `skill-invocation-router` 工具套件。它包含一份呼叫模型參考架構、一套範例宿主策略，以及一個無副作用的 CLI 工具，能對來自人類、模型、自主 agent、外部應用程式、跨 skill 組合或評測控端的單次請求進行客觀評估，並回傳包含呼叫途徑、所用配接器、語意分數與決策理由的完整 JSON 報告。

該單次請求 CLI 是一套策略探針，而非全自動的觸發評測套件。請善用第 27 課所講授的正例與近似負例評測體系，全面計算混淆計數、精確率、召回率與重複執行的穩定性指標。

## Exercises｜練習

1. 完整建構人類／模型矩陣的全部四個象限，並為每個象限各撰寫一個正當合理的真實工程使用案例。
2. 為 `CorePolicyAdapter` 新增「僅限應用程式（Application-only）」啟用支援。編寫測試確鑿證明人類使用者與模型的呼叫請求依然會被堅決拒絕。
3. 為一個部署發布 skill 撰寫十個高品質的高度混淆負例（Near Misses）。每個 prompt 皆必須與該 skill 共享高度相似的詞彙，但在業務本質上卻明確屬於完全不同的其他工作流程。
4. 在評分排名前兩名的候選者之間引入「歧義緩衝邊界（Ambiguity Margin）」。當兩者分數差距小於該邊界時，路由器回傳 `ask` 主動向使用者尋求釐清。
5. 為跨 skill 調用新增最大遞迴深度限制，並成功檢測並阻斷一個由兩套 skill 組成的雙向死迴圈調用。
6. 將完全相同的標註評測資料集分別輸入核心配接器與擴充配接器。深入分析並解釋每處決策產生變更的根本原因。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Explicit invocation | 「斜線指令」 | 操作者直接出示具體的 skill 身分識別碼，並接受策略審查 |
| Implicit invocation | 「由模型自行挑選」 | 路由器依據任務上下文脈絡，自合乎資格的目錄後設資料中自主選取 |
| User-invocable | 「人類可以使用」 | 宿主專屬的選單呈現或手動直接呼叫特性，非核心標準欄位 |
| Model-invocable | 「Agent 可以使用」 | 在宿主特定策略允許下，合乎模型隱式自主選取資格的狀態 |
| Invocation adapter | 「Frontmatter 剖析器」 | 負責將宿主的私有欄位與 API 映射至統一策略模型的對接程式碼 |
| Near miss | 「高混淆負例」 | 表面詞彙與目標輸入極度相似、但實質業務意圖完全不應觸發的請求 |
| Abstention | 「未選取任何 Skill」 | 當客觀證據不足或存在嚴重語義歧義時，系統主動做出的放棄選取決策 |

## Further Reading｜延伸閱讀

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) ——正向觸發條件、描述精確度與評測設計指引
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills) ——觸發意圖與輸出產物 Evals 評測架構設計指南
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) ——Codex 當前顯式與隱式呼叫控制機制官方說明
- [Claude Code skills](https://code.claude.com/docs/en/skills) ——Claude Code 在 `user-invocable`、`disable-model-invocation`、參數傳遞與委派脈絡上的專屬擴充指引
