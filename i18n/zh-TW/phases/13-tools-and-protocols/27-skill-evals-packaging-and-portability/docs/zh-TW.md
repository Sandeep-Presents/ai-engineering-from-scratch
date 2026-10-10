# Skill 評測、封裝打包與可移植性

> 一項 skill 唯有在以下條件皆滿足時才算真正完工：通過靜態語法檢查、在正確的請求上精準觸發路由、顯著提升具體任務的客觀指標、嚴格遵守安全策略限制，並在不同宿主環境下誠實且優雅地降級。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 22, 24, 25, and 26
**Time:** ~150 minutes

## Learning Objectives｜學習目標

- 將專家工作流程轉化為結構化 skill，清晰分離模型判斷、確定性運算、參考資源與輸出格式契約。
- 將套件結構、觸發路由、任務行為表現、腳本正確性、安全性與跨平台可移植性切分為獨立防護層進行評測。
- 透過正向案例、明確負向案例與高度混淆負例（Near Misses），精確測量觸發精確率（Precision）與召回率（Recall）。
- 在多次重複執行基準下，嚴謹對比引入該 skill 前後的任務表現差異。
- 建置並強制執行跨執行時期的能力支援矩陣，並為完整 skill 套件打造自動化發布檢核門檻（Release Gate）。

## The Problem｜問題

在單次展示中，一項 skill 或許表現亮眼：使用者恰好輸入了其描述中所包含的完全相同字句、作者精確知道何時該開啟哪份參考指南、腳本接收到乾淨無瑕的輸入，且預期的宿主環境恰好能識別所有自訂擴充欄位。

然而一旦投入真實工程實踐，各類失效便接踵而至：

- 模型在語意相近但本質不同的無關任務上錯誤呼叫了它。
- 合法的業務請求使用了模型不熟悉的同義詞，導致模型錯失呼叫時機。
- 正文只告訴 agent 該做什麼，卻未定義究竟產出何種具體檔案才能證明任務已完成。
- 內附腳本在遇到包含空格的路徑、重複執行或前次殘留的中間狀態時崩潰報錯。
- 套件安裝程式僅複製了 `SKILL.md`，卻遺失了其引用的所有周邊參考文件。
- 另一個執行時期環境直接無視了自訂呼叫旗標與工具預核准宣告。
- 同一個任務執行四次，一次僥倖成功，另外三次卻迷失在完全不同的決策路徑中。

「Markdown 語法看起來沒問題」完全無法防範上述任何一類失效。Skills 是包含機率性路由與執行層的小型軟體套件，必須像對待任何生產級介面一樣，落實嚴格的關注點分離。

## The Concept｜核心概念

### 自真實業務流程出發，而非抽象主題

「打造一個 Kubernetes skill」絕非合理的工程範疇。Kubernetes 包含數百項操作任務，牽涉完全不同的工具、安全風險與交付產物。

相對地，「診斷特定 Deployment 為何無法進入 Available 就緒狀態、在不變更叢集的前提下收集日誌與事件證據，並產出結構化的故障排查報告」，才是一個合格的 skill 候選題目。它具備：

- 清晰的觸發意圖邊界；
- 穩定的證據收集程序步驟；
- 確實需要模型進行推理的決策判斷點；
- 能被封裝為專用腳本或強型別工具的具體指令；
- 邊界明確的交付產物；
- 明確的安全邊界：唯讀診斷分析。

建議進行以下「架構提煉訪談」：

1. 究竟何種具體事件會促使專家啟動該工作流程？
2. 哪些表面相似的請求**不應該**觸發該流程？
3. 專家最先收集的關鍵客觀證據為何？
4. 哪些決策高度依賴該證據？
5. 哪些步驟具備足夠確定性能被撰寫為自動化腳本？
6. 哪些領域知識規則應當沉澱為獨立的參考文件？
7. 哪些動作需要人工審批，或必須嚴格排除在範疇之外？
8. 究竟產出何種檔案產物才能確鑿證明流程已完工？
9. 獨立審核人員該如何自動化驗收該產物？
10. 哪些步驟深度綁定於特定單一執行時期環境？

這些問題的答案，將直接轉化為套件的目錄架構與評測資料庫。

### 明確分離模型判斷與確定性運算

```figure
skill-workflow-extraction
```

將大模型的智慧判斷聚焦於：文字分類、優先級排序、資訊綜合提煉與語意歧義解析。而將純確定性運算交由執行腳本或工具負責：格式剖析、資料統計、結構校驗、格式轉換、查詢強型別 API 與強制執行系統不變量。

若在 skill 正文中花費 80 行文字教導模型如何手動模擬資料剖析，系統將極度脆弱；反之，若在腳本中試圖替人類做出主觀的架構決策，系統將缺乏透明度。請讓每種行為落在其最易被測試的正確載體上。

### 依依賴順序自外而內撰寫套件

切勿一開始便著手修飾潤色操作指引文字。應當自最外層可被驗證的契約開始逐步向內建置：

1. **產物契約（Artifact contract）**：明確定義必備的檔案清單、欄位結構或決策選項。
2. **獨立驗收（Verification）**：明確規範各項要求將如何被自動化校驗。
3. **證據工具（Evidence tools）**：實作確定性的資料收集器與格式驗證腳本。
4. **決策導航（Decision map）**：將客觀證據狀態與各決策路徑清晰串聯。
5. **參考文檔（References）**：僅在需要深入該路徑時按需提供領域細節。
6. **進入點正文（Entry body）**：闡述核心工作流程、安全邊界、失敗處置與預期產物。
7. **意圖描述（Description）**：定義核心能力與正向／負向觸發邊界。
8. **宿主配接器（Runtime adapters）**：獨立處理專屬呼叫旗標或脈絡擴充設定。
9. **多層評測（Evals）**：依序執行結構、路由、行為、安全與可移植性評測。
10. **封裝打包（Package）**：安裝至乾淨的實體目標目錄，並於目的地進行端到端測試。

此流程確保了文字正文是為可驗證的工程系統服務，而非在展示僥倖通過後才拼湊驗收標準。

### 六大評測防護層

```figure
skill-eval-layers
```

每個防護層回答一個截然不同的工程問題。通過其中一層絕無法替代另一層的防禦。

## Layer 1: Package Structure

靜態語法檢查（Linting）負責核驗完全無需調用大模型的客觀結構事實：

- 套件根目錄下確實存在 `SKILL.md`；
- frontmatter 能被安全解析；
- `name` 與其父目錄名稱完全一致；
- 必填欄位完整且長度未超限；
- 所有非標準 frontmatter 欄位皆出現在發布策略的擴充白名單中；
- 所有直接引用的參考檔案皆嚴格位於套件目錄內部；
- references、scripts、assets 與 eval fixtures 採用發布策略允許的副檔名，且單檔大小未超過位元組配額；
- 不存在任何非法的符號連結或特殊裝置檔案；
- 正文字元數維持在發布策略規範的字元上限以內；
- 通過敏感特徵掃描，確認未殘留任何明文密鑰賦值或私鑰標頭；
- 必須包含非空的 `## Output contract` 與 `## Failure behavior` 章節。

在解析 `SKILL.md`、評測資料、證據日誌或 Manifest 之前，必須先對實體檔案系統目錄樹進行實體預檢。在讀取任何檔案內容前，果斷拒絕指向根目錄的符號連結、指向父目錄或進入點檔案的符號連結、缺漏必備常規檔案以及任何特殊檔案。隨後才執行感知內容的策略檢查。若在預檢前過早解析路徑，會抹除檢查根目錄符號連結所需的關鍵證據。

本課的測試控端將這些策略數值具象化：正文字元上限為 10,000 字元、附屬檔案大小上限為 1,000,000 位元組、特定目錄的副檔名白名單，以及由套件需求明確指定的自訂擴充欄位名稱。這些皆屬於具體的發布策略範例，而非 Agent Skills 的全域標準限制。特徵比對僅是防範低級疏失的基本防護網，無法證明套件絕對不含機密。

檢查報告應產出穩定的問題代號（Issue Codes）。CI 管線可阻斷嚴重錯誤（`E_*`），同時允許經審查的設計警示（`W_*`）。

靜態檢查僅能證明套件結構完整，無法保證模型會正確選取或遵循該指引。

## Layer 2: Trigger Routing

在頻繁修改描述文字之前，必須先建立標註評測資料庫。

| 測試案例型別 | 評測目的 | 發布就緒檢核的具體範例 |
|---|---|---|
| 正向案例（Positive） | 測量預期的意圖覆蓋率（召回率） | 「Can version 3.1.0 ship?」 |
| 換樣正向（Paraphrased positive） | 避免模型死記硬背特定關鍵字 | 「Audit this tag before we publish it」 |
| 明確負向（Clear negative） | 捕捉嚴重過度選取的泛化誤觸發 | 「Explain batch normalization」 |
| 高度混淆負例（Near miss） | 精準定義相鄰功能的邊界區隔 | 「Why did the package build fail?」 |
| 競爭 Skill 案例 | 測試在多個看似合理的選項中的選取精度 | 「Draft the release notes」 |
| 對抗性干擾措辭 | 測試關鍵字堆疊與注入名稱干擾下的抗逆力 | 「Do not use release-readiness; explain this stack trace」 |

將測試資料明確劃分為開發集（Development Set）與驗證集（Validation Set）。利用開發集調整描述文字；利用驗證集評估調整後的描述是否具備真實泛化能力。若發布決策攸關重大，保留一份徹底隔離的留出集（Held-out Set）。

針對二元呼叫決策：

```text
precision = true_positives / (true_positives + false_positives)
recall = true_positives / (true_positives + false_negatives)
f1 = 2 * precision * recall / (precision + recall)
```

報告中必須同時呈現原始計數與百分比率。10 次全中與 100 次全中雖然同為 100%，所承載的統計證據力卻天差地遠。

對於大型目錄清單，亦需測量 Top-1 選取準確率、主動棄權（Abstention）品質，以及相鄰 skills 之間的混淆度矩陣。一個在選取目標前必須先錯誤嘗試三項無關技能的路由器是不健康的。

### 意圖路由評測必須在目標真實執行時期中執行

純字彙相似度模擬器能有效解釋指標並發現明顯重疊，但它無法證明真實大模型在正式環境中的路由表現。在對外宣稱路由品質前，必須將標註測試集實際運行於目標宿主環境、真實大模型、實體目錄序列化結構與正式策略配置中。

## Layer 3: Instruction and Artifact Behavior

精準觸發僅是門檻；skill 必須在實質任務中帶來客觀的效能提升。

建立包含以下要素的標準測試任務（Fixtures）：

- 輸入檔案與前置環境假設；
- 允許使用的工具清單與安全邊界；
- 預期的交付產物實體路徑；
- 確定性的結構驗證邏輯；
- 需要主觀判斷的評分指標（Rubrics）；
- 耗時上限、工具呼叫次數配額或 Token 成本預算；
- 異常輸入案例與預期的安全終止行為。

實施成對對照實驗：

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

保持底層模型、溫度係數（Temperature）、工具集合、任務測試資料與資源配額完全一致。否則你無法將任何效能差異客觀歸因於該 skill 的引入。

關鍵評估維度包括：

| 評估維度 | 具體衡量標準 |
|---|---|
| 正確性（Correctness） | 必備的單元測試與系統不變量全數通過 |
| 完整性（Completeness） | 產物契約所要求的每個欄位皆完整存在 |
| 執行效率（Efficiency） | 工具呼叫總次數、耗時時間、Token 消耗量與呼叫成本 |
| 證據支撐（Evidence） | 提出的各項主張皆明確指向實體檔案或客觀觀測結果 |
| 範疇控制（Scope） | 禁止存取的檔案與受限危險操作完全未被觸碰 |
| 異常恢復（Recovery） | 被中斷的工作流程能平滑恢復，且不產生重複副作用 |
| 人工介入（Human effort） | 審核人員被迫手動介入修正的次數與嚴重程度 |

切勿單純以 Token 消耗減少作為唯一的最佳化目標。一次耗費 Token 較少、卻因貪快而略過了關鍵安全檢查的執行，在工程上是徹底失敗的。

### 產物契約使行為表現具備可執行驗收力

一份產物契約（Artifact Contract）是一組可被獨立程式化驗證的客觀屬性清單：

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

Schema 校驗負責檢查資料結構；領域邏輯校驗負責核對候選版本號與證據檔案路徑；最後由人工專家或經過標定的審核模型覆核最終建議是否由所附證據嚴格推導得出。

## Layer 4: Script Correctness

將 skill 內附的腳本視為獨立的常規軟體模組，完全脫離大模型對話環境進行獨立單元測試。

最低必測情境：

- 常規標準輸入；
- 空白或空值輸入；
- 格式畸形的惡意輸入；
- Unicode 字元、多重空格與極端路徑邊界；
- 重複執行下的冪等性；
- 逾時中斷或相依服務連線失敗；
- 前次執行失敗所殘留的半成品檔案；
- 輸出大小達到系統配額上限；
- 預演模式（Dry-run）行為；
- 結構化的退出狀態碼與錯誤契約。

採用靜態的本機測試資料。單元測試嚴禁依賴外部實體網路。將需要網路連線的整合測試隔離於顯式旗標之後，並明確記錄其所依賴的遠端服務契約。

若腳本具備外部寫入副作用，將產生計畫階段與實質寫入階段清晰切分。為所有重試的外部操作提供冪等鍵或反向補償機制。

## Layer 5: Safety and Authority

安全評測負責驗證該套件是否始終維持在被授予的法定權限邊界之內。

至少應當覆蓋以下測試案例：

- 超出該 skill 職責範疇的使用者指令；
- 隱藏於外部輸入檔案中的惡意 prompt 注入指令；
- 企圖逃逸出套件目錄的非法資源相對路徑；
- 企圖逃逸出獲准根目錄的工作區符號連結；
- 請求連線至未預先宣告的外部網路來源；
- 企圖利用環境中現存未授權金鑰發起的操作指令；
- 未經人工審批授權的破壞性或對外寫入操作；
- 產生海量輸出的阻斷服務攻擊或無窮迴圈行程；
- 跨 skill 之間引發的死迴圈相互調用；
- 中斷恢復執行時可能引發的重複扣款或重複寫入副作用。

清楚記錄該防禦措施究竟由誰把守：僅靠 prompt 約定、工具權限策略、人工審批、底層沙盒，還是事後驗收關卡。僅靠 prompt 約定的軟弱防線，絕不可在安全報告中被誇大宣稱為實體防護邊界。

## Layer 6: Packaging and Portability

### 將實體目錄作為單一不可分割的封裝單元安裝

發布測試必須先將套件安裝至一個乾淨隔離的目的地目錄，隨後針對該安裝複本執行完整驗證。

```figure
skill-package-install
```

若僅在原始碼目錄中進行測試，將徹底遺漏：安裝腳本缺陷、執行權限位元遺失、巢狀目錄被拍平、套件名稱被意外覆寫，以及舊版本殘留孤兒檔案等真實致命問題。

Manifest 清單範例：

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

將 `assets/manifest.json` 保留為清單後設資料，且嚴格自其內部的 `files` 雜湊表中排除。任何檔案皆不可能在自身內部承載自身完整當前內容的穩定雜湊值。對套件內的所有其他檔案進行雜湊校驗，並透過外部受信任的渠道（例如具備數位簽名的 Release 或受信任的註冊表紀錄）確立該清單本身的真實性。標準的外層信封格式嚴格僅接受 `manifestVersion: 1` 與 `algorithm: "sha256"`；遇到任何未知數值必須立刻安全拒絕。清單中的鍵名必須已經是規範化的相對 POSIX 路徑，因此 `./SKILL.md`、反斜線、絕對路徑與父目錄片段皆應直接被判定為非法而拒絕，而非默默進行正規化。教學控端直接消費內部的路徑雜湊字典，且兩者皆嚴格拒絕在字典內部出現保留的清單路徑。

雜湊值負責偵測未授權篡改；版本號負責傳遞向下相容性。兩者皆無法取代在版本升級前進行完整的程式碼 Diff 審查與 Evals 重新評測。

### 可移植性是一套多維度的能力支援矩陣

切勿將特定宿主「是否支援 skills」簡化為單一布林值。應當詳盡審視其究竟支援哪些具體架構行為。

| 核心能力項 | 對可移植套件的依賴程度 | 缺失時的降級回退方案 |
|---|---|---|
| 必備 `name` 與 `description` | 核心規範必備項 | 套件無法參與目錄清單與自動路由 |
| 正文動態啟用（Activation） | 用戶端核心標準行為 | 退化為顯式的外部檔案讀取適配 |
| References、Scripts、Assets | 核心套件實體架構 | 宿主環境需支援檔案存取與行程呼叫工具 |
| 人類使用者顯式呼叫 | 宿主 UI 或 Prompt 慣例 | 在一般自然語言文字中直接提及 skill 名稱 |
| 模型隱式自主選取 | 宿主智慧路由器能力 | 由外部應用程式透過程式碼顯式強制啟用 |
| 人類／模型 2x2 策略控制 | 宿主專屬擴充或應用程式策略 | 在全域配置中全面停用模型的隱式自動選取 |
| 參數結構化綁定 | 宿主指令剖析器能力 | 於正文啟用後以自然語言追問補齊參數 |
| 工具預先授權宣告 | 實驗性或特定宿主專屬 | 回歸標準的每次工具呼叫彈出確認提示 |
| 獨立委派脈絡環境 | 宿主專屬進階特徵 | 退化於當前對話脈絡執行，或由應用程式調度子 agent |
| 生命週期自動化鉤子 | 宿主專屬進階特徵 | 由外部 CI/CD 腳本觸發，或直接略過鉤子 |
| 脈絡持久化保留 | 宿主專屬進階特徵 | 將重要狀態儲存至檔案，並明確規範中斷恢復邏輯 |

針對每項宣告的必備能力，明確得出以下四種客觀結論之一：

- 原生支援且單元測試通過；
- 透過相容配接器順利支援；
- 支援度降級，但具備清晰記錄的回退方案；
- 完全不支援，安裝程序必須果斷報錯中止。

**靜默降級（Silent Degradation）**是跨平台移植中最應全力避免的系統缺陷。

### 可移植性評測必須引入真實宿主測試環境

任何相容性宣告皆必須指向具體的自動化測試結果或權威官方契約。宿主系統的內部實作隨時可能變動。請在相容性報告中忠實記錄所用的適配器版本與測試日期。

重點測試：

1. 於預期範疇內的目錄探索行為；
2. 遭遇同名套件時的衝突仲裁行為；
3. 顯式指令呼叫成功率；
4. 隱式自主選取（或其停用狀態）之合規性；
5. 參數傳遞與變數展開邏輯；
6. 存取內部 references 與 scripts 的通暢度；
7. 權限彈出提示與人工審批機制；
8. 委派子脈絡或於當前脈絡執行的正確性；
9. 遭遇對話脈絡壓縮或系統重啟後的恢復能力；
10. 套件升級與徹底卸載行為。

### 生態系規模資料絕非產物質量證據

發表於 2026 年 8 月的 GitSkills 資料集論文報告指出：在 2026 年 7 月對 GitHub 的全網爬取中，於 282,200 個程式碼儲存庫內發現了 3,797,117 個類似 skill 的檔案，其中具備 1,877,981 種獨立的位元組內容。依據該論文的位元組比對標準，約有 50.5% 的檔案屬於逐字完全複製的複本。

這些客觀資料確鑿證明：Skill 產物在原始碼儲存庫生態中已具備龐大的規模效應，且重複程式碼在資料集建置、語意搜尋、來源溯源與版本升級分析中扮演著舉足輕重的角色。然而，這**完全不代表**半數的 skills 都是好是壞、不代表 skills 必然能提升任務表現、不代表任何私有呼叫欄位已成為通用標準，亦無法證明任何沙盒設計是天然安全的。該論文是一項生態資料集實證研究，而非品質或安全性基準評測。

善用這些生態系統計資料來推動重複程式碼過濾與出處溯源；但請始終堅持利用你自己的 Evals 評測體系來做出真實的品質宣告。

## Repeated Runs and Uncertainty｜多次重複執行與不確定性

大語言模型與智慧路由天生具備隨機性。必須在正式環境標準取樣策略下，對每個行為測試案例執行多次重複測試。

針對 `n` 次等效執行與 `k` 次成功：

```text
observed_pass_rate = k / n
```

完整保留每次執行的底層追蹤鏈。70% 的通過率可能代表單一固定的失效模式，亦可能代表互不相關的隨機崩潰。整體的統計比率用於巨觀比較；而具體的 Trace 則是指引架構修復的唯一依據。將出處憑證綁定至每次獨立運行的原始預測記錄上，而非僅僅記錄第 0 次執行與最終平均通過率。不同的預測序列順序可能擁有完全相同的初次數值與相同的平均通過率，但背後卻代表著截然不同的執行時期穩定性特徵。

在任務維度下逐一比較 Baseline 與 Treatment，切勿僅依賴全域匯總平均數。即使平均指標有所提升，也必須嚴肅回報局部的回歸退步。對於具備重大影響的關鍵任務，發布門檻應當要求安全案例百分之百全數通過，而非容忍平均值妥協。

## Release Gates｜發布檢核門檻

一套實用的發布檢核門檻配置範例：

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

具體門檻數值取決於業務風險與測試樣本容量。核心原則在於：門檻必須在檢閱最終測試結果**之前**預先宣告。

檢核失敗報告應當精準指出出錯的層級與相關客觀證據。切勿將路由、行為與安全評分粗暴揉合成單一分數，否則優美的文字風格評分將會暗中抵消了嚴重的權限違規漏洞。

### 清晰劃分測試資料成功、本機完整性與正式環境就緒

確定性的教學測試資料（Fixtures）能證明發布門檻的判斷邏輯本身運作正常。但它無法證明真實目標執行時期環境確實選取了該 skill、確實產出了對照產物、確實執行了內附腳本，或確實嚴格遵守了安全授權邊界。

必須清晰劃定三大信任邊界：

- `fixturePassed`：在使用預先宣告的確定性觸發、產物、證據與宿主能力測試資料模式下，所有評測層全數通過；
- `localEvidenceReady`：所有四項捕獲模式標籤皆具備非空的真實來源，且其 SHA-256 雜湊值與完整的本地觸發觀測紀錄、產物實體、腳本與安全審查日誌，以及非空的宿主支援矩陣完全吻合；
- `productionReady`：所有評測層與本地完整性校驗全數通過，且具備可信的外部認證（Attestation）明確綁定評測器的完整 `evidenceRoot`。

最終全域發布欄位 `passed` 嚴格取決於 `productionReady`，絕不能僅因 `fixturePassed` 或 `localEvidenceReady` 為真就宣稱通過。本機雜湊計算僅能發現資料錯位。它無法證明資料來源真實，因為任何擁有該套件寫入權限的人都能輕易竄改測試資料標籤、捏造來源字串並重新計算本機雜湊值。

標準的評測器會針對完整的觸發、產物、證據、宿主與 Manifest 配置物件計算全域 SHA-256 `evidenceRoot`。在正式環境中發起呼叫時，必須自套件外部傳入一份專屬認證檔案：

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

並透過 `--trusted-attestation-sha256` 命令列參數顯式傳入該認證檔案位元組的精確 SHA-256 雜湊值。該預期雜湊值必須來自頻外（Out-of-band）受信途徑、CI 安全金鑰、具備數位簽名的發布紀錄或註冊表審核結果。若將其存放在相同套件內部，該檢核將退化為另一個可在本地被隨意重新計算的虛假雜湊。評測器會堅決拒絕任何缺失、位於套件內部、指向符號連結、格式畸形、數值不符或版本不支援的認證檔案。

## Build It｜動手實作

`code/main.py` 實作了本專題模組的完整發布檢核控端。

核心功能包含：

- 在讀取任何設定檔之前，對套件實體目錄樹進行嚴格的實體預檢；
- `lint_package(root)`：執行第一層套件結構靜態語法檢查；
- `TriggerCase`、`repeated_run_observations(...)` 與 `evaluate_triggers(...)`：評測標註意圖路由案例並產出完整原始 Trace；
- `classification_metrics(...)`：精確計算精確率、召回率、準確率與底層原始混淆計數；
- `repeated_run_rates(...)`：分析各案例在多次重複執行下的統計穩定性；
- `ArtifactContract` 與 `evaluate_artifact(...)`：執行交付產物契約校驗；
- `EvidenceCheck` 與 `evaluate_evidence_checks(...)`：審查顯式的腳本執行與安全邊界證據；
- `EvaluationProvenance`、本地完整性雜湊計算、全域 evidence-root 雜湊計算，以及獨立回報的測試資料模式、本機完整性、受信錨點與正式環境就緒裁決；
- `build_manifest(...)` 與 `verify_manifest(...)`：為原始碼與乾淨安裝目錄建立並校驗檔案 Manifest 清單；
- `HostCapabilities` 與 `portability_matrix(...)`：產出明確標註原生支援與降級回退狀態的跨平台矩陣；
- `run_release_gate(...)`：產出層級分明的最終發布裁決報告。

運行總結專題實驗：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

該指令區塊需要本機 clone 儲存庫，並能自儲存庫內任何工作目錄啟動並正確解析儲存庫根目錄。

演示程式會對內附的總結專題 skill 進行全面評測：檢核標註觸發集、分析多次重複執行表現、校驗產物契約、審查腳本與安全性證據、透過 Manifest 校驗乾淨安裝複本，並模擬多種不同的宿主環境特徵。它會輸出包含 `checks_passed` 與 `fixture_passed` 為 true、而 `local_evidence_ready`、`trust_anchor_valid`、`production_ready` 與 `passed` 維持為 false 的標準 JSON 發布報告。替換測試資料並在本地重新計算雜湊能確立本機完整性，但真正的正式環境發布依然強制要求頻外的外部可信認證。

### 依防護層級解讀診斷報告

請嚴格遵循以下順序解讀報告：優先檢視重大的安全性違規與套件結構損壞；隨後分析意圖路由混淆矩陣；接著將任務行為表現與 Baseline 進行嚴格對照。唯有在正確性與安全邊界全數達標之後，探討執行效率指標才有實質工程意義。

將產出的檢核報告連同套件修訂版本與評測資料版本一同存檔。任何來自舊版模型、舊版宿主或舊版程式碼的合格紀錄皆屬於歷史證據，絕不可作為當前最新組合的合規證明。

## Use It｜實際應用

在對 skill 進行每次迭代修改時，請嚴格遵循以下編寫閉環流程：

```figure
skill-authoring-loop
```

始終針對引發故障的對應防護層進行針對性修改。若底層根本原因是安裝腳本遺失了周邊參考文件、或沙盒環境將使用者家目錄無端暴露，切勿徒勞無功地向 `SKILL.md` 中堆砌更多空洞的叮囑文字。

## Real-Host Portability Checkpoint｜真實宿主環境跨平台檢核點

確定性的測試資料證明了發布門檻本身的邏輯運作無誤。而本檢核點將進一步確鑿證明真實的實體宿主環境如何探索、載入、授權與移除該套件。在向外界宣稱該套件具備可移植性之前，必須完整走過此流程。

本檢核點需要本機 clone 儲存庫、Node.js、`npx`、Python 3、一個選定的具備 skill 執行能力的真實宿主環境，以及具備寫入權限的專案或使用者層級目錄。請先確認 `node --version`、`npx --version` 與 `python3 --version`，並在開始前選定目標宿主與安裝範圍。若缺乏實體宿主環境，請在觀念上推演該檢核流程，並將每項宿主觀測結論標註為暫緩。單純在網頁上閱讀絕無法確立跨平台可移植性。

### 1. 確立本機測試資料邊界

自本地 clone 儲存庫內任何工作目錄啟動。將 `TARGET_ROOT` 解析為原始儲存庫工作區中的本課實體目錄：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

報告應顯示 `checksPassed` 與 `fixturePassed` 為 true，而 `productionReady` 與 `passed` 維持為 false。請在實驗筆記中明確記錄此核心差異：測試資料通過絕不等於真實宿主執行成功。

### 2. 將完整套件安裝至第一家宿主環境中

在相同工作目錄下執行：

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

記錄宿主名稱、宿主版本號、安裝範圍、實體安裝路徑與執行日期。在探測行為之前，請重新啟動新階段作業或重新掃描目錄清單。

將 `SKILL_ROOT` 設定為安裝程式回報的絕對路徑安裝目錄。該目錄內部必須包含實體的 `SKILL.md`：

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. 探測探索、意圖路由、參考文件與腳本執行

依據第一家宿主所支援的顯式語法發起調用：

| 宿主環境 | 顯式呼叫語法 |
|---|---|
| Codex | `skill-release-gate`，或自 `/skills` 選單中選取，隨後輸入評測請求 |
| Claude Code | `/skill-release-gate` 後方接續評測請求 |
| 通用備選 | `Use skill-release-gate to evaluate the target bundle.` |

分別以獨立的對話回合發送以下三個請求，並將所有佔位符號替換為上方印出的真實絕對路徑數值：

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

第一個請求測試顯式指令呼叫。第二個請求測試隱式自動路由。第三個請求是典型的高度混淆負例（Near Miss），它絕不應當觸發套件評測工作流程。若該宿主環境不向使用者揭露其究竟選取了哪項技能，請將兩項路由結果如實標註為「未驗證」，切勿單憑模型看似流暢的回應文字自行主觀腦補。

在顯式調用中，確認宿主能夠順利讀取 `references/eval-contract.md` 並執行已安裝套件內的 `scripts/evaluate_skill.py`。解析後的具體執行指令必須具備以下精確結構：

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

單純依賴進入點文字編造的回應，無法證明宿主支援完整的實體套件。請忠實記錄解析後的腳本路徑、目標套件路徑、工作目錄（cwd）、精確的 argv 引數陣列與結束狀態碼。若宿主無法對外暴露特定欄位，請將該欄位標註為「未驗證」。

### 4. 探測人工審批防禦行為

發送最後一個測試請求：

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

預期安全行為：絕不發生任何實際發布動作。該 skill 必須嚴格堅守測試資料與正式環境的邊界隔離，並在發布前主動終止。請忠實記錄該安全攔截究竟由誰主導：skill 操作指引、宿主審批提示、缺少對應工具，還是沙盒底層策略。切勿將這四種防護手段混為一談。

### 5. 於第二家宿主驗證或宣告降級回退方案

若環境具備條件，在第二個相容的宿主環境中重複步驟 2 至 4。若無其他可用宿主，在跨平台矩陣中新增 `unverified` 或 `unsupported` 記錄列，並指名具體的降級方案（例如手動載入檔案或顯式指令呼叫）。僅在單一宿主上測試通過，絕無法證明具備通用的跨平台可移植性。

你的客觀證據紀錄表應當包含：

| 檢核項目 | 宿主 1 | 宿主 2 或降級回退方案 |
|---|---|---|
| 目錄探索與安裝路徑 | 實際觀測數值 | 實際觀測數值或未驗證 |
| 顯式指令呼叫 | 成功或失敗（附客觀日誌） | 成功、失敗或降級方案 |
| 隱式與近似負例路由 | 實際觀測或未驗證 | 實際觀測或未驗證 |
| 存取內部參考文件 | 實際讀取路徑或失敗 | 實際讀取路徑或降級方案 |
| 實體腳本執行 | 執行指令與結束碼 | 執行指令與結束碼或不支援 |
| 人工審批防禦行為 | 實際實施控制的防護層級 | 實際實施控制的防護層級或不支援 |

### 6. 演練版本升級與徹底卸載

在當初安裝時所使用的相同範疇中執行：

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

記錄更新指令回報的是實質版本變更還是已處於最新狀態。在移除完成後，重新啟動新階段作業或重新掃描目錄，並重試顯式指令呼叫。宿主系統應當不再能發現 `skill-release-gate`。殘留在目錄清單中的孤兒條目屬於嚴重的卸載失效，必須如實記錄。

## Ship It｜交付成果

本課產出 `skill-release-gate` 完整總結專題套件，內含 `SKILL.md`、架構參考指南、唯讀評測腳本、宿主能力測試資料、標註觸發案例庫與產物格式契約。自本地 clone 儲存庫內任何工作目錄，皆可解析儲存庫根目錄並針對目標套件絕對路徑運行已安裝或原始碼內的評測器，以驗證內附的教學測試資料，而絕不冒進做出發布承諾。

在真正的正式環境中，請將所有測試資料替換為線上真實擷取的觀測資料、重建保留的 Manifest 清單、透過獨立的外部發布基礎設施取得認證檔案及其受信雜湊值，隨後執行：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

該指令唯有在六層發布門檻、本機證據完整性以及外部可信錨點全數通過時，方能順利以 0 結束碼退出。若缺少該外部信任錨點，單純在本地重新標註並重新計算雜湊的測試資料，依然無法通過正式發布檢核。

課程安裝程式能完整複製該套件實體目錄樹。目錄與網站會錨定其 `SKILL.md` 進入點，同時完整保留所有巢狀周邊資源。這正是扁平的單一 Markdown 產物所無法企及的實體可移植性驗證。

## Exercises｜練習

1. 為你日常使用的一項 skill 撰寫十個正向案例、十個明確負向案例與十個高度混淆負例（Near Misses）。在著手修改其描述文字之前，先將它們切分為開發集與驗證集。
2. 針對一項特定任務實施五次重複運行的 Baseline 與 Treatment 對照實驗。即使全域平均指標有所提升，也必須詳盡記錄並回報每個個別任務的回歸退步現象。
3. 為產物評測新增一個需要人類主觀評判的評分項目（Rubric）。在將其納入正式發布門檻前，先在五個範例上完成標定校準。
4. 新增一項宿主能力項目，並為其清晰定義原生支援、配接器相容、降級回退與完全不支援等四種客觀結論。
5. 在 Manifest 清單建立完成後，故意修改已安裝目錄下的一份參考文件。證明套件校驗能在該 skill 被正式啟用前精準攔截報錯。
6. 打造一個正文能順利通過靜態 Lint 檢查、但內附腳本卻蓄意違反產物契約的惡意 skill。明確找出究竟是哪一層發布門檻成功阻止了它。
7. 設計一套版本升級評測程序，能自動對比兩個不同套件版本之間的呼叫策略與所需能力宣告之差異。
8. 撰寫一份詳盡的相容性審查報告，詳列經實測驗證的宿主版本號、測試日期、降級回退方案與未驗證行為，且全文絕不濫用任何未經驗證的「全平台通用可移植」宣傳徽章。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Trigger eval | 「該 Skill 能否被觸發？」 | 於意圖路由邊界上針對選取率、主動棄權率與混淆度的標註量化測量 |
| Behavior eval | 「它能否順利運作？」 | 依據產物契約、執行品質、安全邊界與資源效率所實施的任務端到端評測 |
| Baseline | 「未引入該 Skill 的原始狀態」 | 在相同模型、工具、任務與資源預算對照條件下的基準表現 |
| Artifact contract | 「預期交付產物」 | 確鑿證明任務已圓滿完工所必備的、可被獨立驗證的客觀屬性清單 |
| Capability matrix | 「支援的執行時期清單」 | 針對各宿主環境的原生支援度、配接器相容性、降級回退與不相容狀態所建立的逐項台帳 |
| Release gate | 「所有測試全數通過」 | 能精準阻斷特定缺陷類別、且絕不抹除底層失效證據的層級分明之發布門檻 |
| Silent degradation | 「被宿主無視的後設資料」 | 宿主系統遺失了關鍵必備行為，卻完全未向安裝程式或使用者發出任何警示的嚴重缺陷 |

## Further Reading｜延伸閱讀

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills) ——觸發評測、輸出產物評測、多次重複執行與 Baseline 對照架構指引
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) ——內聚範疇界定與資源目錄架構最佳實務
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts) ——確定性輔助腳本與結構化介面設計指引
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support) ——目錄探索、脈絡啟用、信任建立與生命週期管理實作手冊
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906) ——大規模生態資料集實證研究及其量測邊界說明
