# Skill 探索與漸進式揭露

> 一項 skill 早在其正文被載入之前便已發揮關鍵價值。其名稱與描述在目錄清單中贏得一席之地；而其深層資源檔案唯有在具體任務真正觸及時，才被按需納入上下文脈絡。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## Learning Objectives｜學習目標

- 建構一套將範圍範疇、格式校驗、命名衝突策略與目錄發布清晰解耦的檔案系統探索管線（Pipeline）。
- 深入闡明三層漸進式揭露體系：目錄後設資料、啟用中操作指引，以及任務專屬輔助資源。
- 設計高內聚的參考資源，使 agent 無需載入整個龐大套件即可精確直達所需的細節指引。
- 將目錄容量預算與啟用中 skill 的脈絡預算進行獨立規劃與配額管理。
- 在 skill 讀取自身內部資源時，嚴格防禦路徑遍歷（Path Traversal）與符號連結（Symlink）逃逸風險。

## The Problem｜問題

假設你的 agent 安裝了 200 個各類 skills。若在階段作業剛啟動時便將每個 `SKILL.md`、參考文件、執行腳本與樣板檔案全數載入，當前的核心任務將瞬間被海量無關的作業程序所淹沒。相反地，若什麼都不預載，使用者就必須被迫死記硬背精確的檔案系統路徑。

業界常見的折衷方案是建立**目錄清單（Catalog）**：僅向模型出示每個合規 skill 的精簡識別身分與意圖路由描述，待模型做出選取決策後，才動態載入完整正文。然而這隨即引發了兩大全新的工程難題。

首先，目錄探索絕非單純的遞迴檔案搜尋。Skills 可能散落於專案工作區、使用者個人目錄、系統管理員策略、外接擴充套件或執行時期內建等多種不同範疇（Scopes）。兩套獨立套件可能恰好同名；符號連結可能惡意指向受信根目錄之外；格式損壞的套件可能白白耗盡寶貴的目錄空間，甚至引發呼叫癱瘓。

其次，漸進式揭露若設計不當，極易演變為「漸進式混淆」。若 `SKILL.md` 僅含糊地寫著「請閱讀相關指引」，而套件內部包含十二份指南，模型只能憑空盲猜。若每份指南又進一步引用三份額外檔案，資源載入將瞬間失控退化為無窮無盡的圖遍歷。

一個優秀的執行時期環境，必須確保探索過程具備確定性，並讓每一次揭露皆帶有明確的架構意圖。

## The Concept｜核心概念

### 探索管線如同編譯器前端

請將檔案系統視為原始輸入原始碼。絕不可將未經處理的底層實體路徑直接裸露給模型。

```figure
skill-discovery-pipeline
```

管線的每個階段皆應產出結構化資料與明確的結構化錯誤。完整的探索日誌應具備回答以下問題的能力：

- 掃描了哪些根目錄？
- 發現了哪些候選套件？
- 拒絕了哪些候選套件？具體原因為何？
- 在命名衝突中，哪一個套件最終勝出？
- 哪些目錄條目因超出配額預算而被截斷或省略？

若缺乏這些關鍵證據，排查「模型為何始終不使用我的 skill」將變得如同大海撈針。

### 探索範疇屬於執行時期策略

可移植的官方規範定義的是 skill 套件本身的結構，而非全域唯一的安裝路徑或固定的優先順序。各宿主環境擁有決定檢索路徑的最高自主權。

一個典型的通用執行時期環境通常劃分以下範疇：

| 探索範疇（Scope） | 範例根目錄 | 法定擁有者與維護者 |
|---|---|---|
| Workspace（工作區） | `<repo>/.agents/skills/` | 專案維護團隊 |
| User（使用者） | `<user-data>/skills/` | 個別開發者 |
| Administrator（系統管理員） | `<system>/skills/` | 主機環境或組織全域政策 |
| Plugin（外接套件） | 具備數位簽名的 plugin 套件 | 套件發行者與安裝者 |
| Built-in（內建） | 執行時期內建模組 | 執行時期系統開發商 |

截至 2026 年 8 月，Codex 官方文件宣告的專案探索機制為：自 `$CWD/.agents/skills` 起始，一路向上遞迴搜尋父目錄直至儲存庫根目錄，並疊加使用者、系統管理員與內建路徑。它支援指向實體目錄的符號連結；當遭遇同名套件時，Codex 可能會同時保留兩者而非自動合併。請注意，這些皆屬於 Codex 自身的特化實作行為，而非 `SKILL.md` 的標準規範；在撰寫適配器時，請務必核對最新版的 [Codex skill 官方文件](https://learn.chatgpt.com/docs/build-skills)。

切勿憑目錄名稱的主觀臆測來推導優先級。必須將其顯式定義為確定性策略並落實單元測試。本課實驗為每個 `Scope` 指派了明確的整數優先級權重，確保相同的候選集合始終產生完全一致的解析結果。

### 命名衝突需要超越 `name` 的實體識別

兩個皆命名為 `release-readiness` 的套件可能皆合法存在：一個是專案工作區的覆寫版本，另一個則是開發者的全域預設範本。因此，目錄條目至少需包含以下身分欄位：

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

常見的命名衝突解決策略包括：

| 衝突策略 | 架構優勢 | 潛在風險 |
|---|---|---|
| 保留所有候選者 | 完全不隱藏任何條目 | 模型面對完全同名的條目產生歧義混淆 |
| 最高優先級範疇勝出 | 保持對外呼叫介面簡潔 | 本地套件可能惡意搶佔（Shadow）受信套件 |
| 直接拒絕重複項目 | 徹底杜絕靜默搶佔風險 | 正當的本地覆寫自訂機制將無法運作 |
| 依來源限定完整名稱 | 身分指向清晰明確 | 面向使用者的呼叫名稱變得冗長不便 |

請為你的宿主選定一種統一策略。即便某些候選者未被納入最終出示給模型的目錄清單中，也必須在內部診斷日誌中完整保留被搶佔或被拒絕的候選紀錄。

### 三層漸進式揭露體系

Agent Skills 官方規範明確倡導分段載入理念。其核心關鍵在於：每一層級皆承載著截然不同的架構目的。

```figure
skill-disclosure-levels
```

#### 第一層（Level 1）：目錄後設資料

模型僅需要足夠的關鍵資訊，便能將該 skill 與其他相鄰 skills 清晰區分開來。規範預估每個目錄條目約佔用 100 個 Tokens，但具體的序列化格式與 Token 化計算完全取決於宿主實作。

一條高效的描述文字通常由兩個子句構成：

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

前半句清晰界定**核心能力**；後半句精確指明**觸發時機與意圖邊界**。第 25 課將透過正向案例與高度混淆的近似案例對該邊界進行全面評測。

#### 第二層（Level 2）：啟用中操作指引

在通過意圖選取並正式啟用後，正文應扮演「導航地圖」與「作業程序書」的雙重角色。官方規範建議將 `SKILL.md` 的長度控制在 500 行以內。這是一項架構設計的指引信號，而非必須填滿的配額目標。

正文應當清晰包含：

- 任務邊界與作業範疇；
- 預設的核心工作流程；
- 決策判斷條件與分流路徑；
- 指向深層檔案的直接檔案參照；
- 工具與腳本的呼叫契約；
- 異常失敗處置與終止條件；
- 預期產出物及其驗收標準。

切勿單純為了縮短進入點檔案行數，而將核心工作流程盲目移至外部參考文件中。啟用階段必須賦予模型足夠的完整脈絡，以確保其能正確啟動第一步。

#### 第三層（Level 3）：周邊輔助資源

References 提供長篇說明文件或規範資料；Scripts 提供確定性的可執行運算；Assets 則作為可被複製、填充或轉換的交付產物範本，而非操作指令。

| 目錄名稱 | 模型是否讀取？ | 模型是否執行？ | 典型承載內容 |
|---|:---:|:---:|---|
| `references/` | 是（按需讀取） | 否 | Schemas、合規政策、領域知識手冊 |
| `scripts/` | 可按需檢視原始碼 | 透過獲授權的工具執行 | 校驗腳本、資料轉檔工具、日誌收集器 |
| `assets/` | 僅在需要時讀取 | 否 | 格式樣板、測試資料、圖片、初始檔案 |

這些目錄名稱屬於約定慣例，而非天然具備魔法能力。宿主環境依然需要具備底層檔案讀取權限與工具執行能力。

### 決策路徑專屬參照勝過無差別資訊傾倒

請將進入點檔案編寫為一張清晰的決策導航圖：

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

這賦予了每份參考文件明確可被觀測的載入觸發條件。而含糊的「請參閱 `references/` 取得更多資訊」則完全不具備此特性。

保持參考資源關聯圖維持扁平。官方指南強烈建議自 `SKILL.md` 發起直接單跳連結，嚴禁設計過深的鏈狀相依。單跳直達使可達性具備高度可測試性，並大幅降低因相依過深導致必要限制從未被納入脈絡的風險。

```figure
skill-reference-map
```

### 目錄容量預算與啟用中脈絡預算各自獨立

令 `c_i` 為 skill `i` 序列化後的目錄空間成本，`B_c` 為目錄總預算，`b_j` 為已啟用之 skill 正文成本，`r_k` 為實際被揭露讀取的資源成本：

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

壓縮其中一項預算，並不代表另一項會自動隨之降低。簡化目錄描述文字固然能節省目錄空間，但一旦啟用了一個長達 900 行的臃腫正文，依然會瞬間壓垮當前任務。唯有在執行時期環境與操作指引確實能精準避開無關分流路徑時，將正文拆解為參考文件才能真正降低啟用脈絡開銷。

在已知脈絡視窗上限時，Codex 目前將初始 skill 目錄清單的預算上限設定為脈絡視窗的 2%。8,000 字元的上限僅在視窗大小未知時作為備用保底機制生效，兩者絕非疊加關係。當目錄超出適用預算時，部分描述可能會被壓縮或直接省略。請將這些數值視為 Codex 當前的特化維運策略，而非 Agent Skills 的通用標準規範。

### 資源路徑屬於關鍵安全邊界

Skill 嚴格僅能讀取自身封裝套件內部的資源檔案。單純實施文字字串的前綴檢查存在嚴重的安全漏洞：

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

必須基於檔案系統真實語意完整解析套件根目錄與目標候選路徑，堅決拒絕絕對路徑輸入，並確鑿驗證解析後的實體目標依然嚴格位於解析後的根目錄之下。在啟動探索前明確決定是否允許符號連結；若允許，則必須在每次存取時嚴格校驗其最終解析目標。

```figure
skill-resource-containment
```

落實路徑包含驗證（Path Containment）並不等同於建立了內容信任。套件內部一個完全合法的本機參考文件，內部依然可能潛藏惡意 prompt 注入攻擊。第 26 課將深入處置該資安威脅。

### 載入過程必須完全可觀測

在不洩漏任何機密資訊的前提下記錄每一次揭露事件：

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

清晰的 reason 欄位將單純的脈絡調度選擇轉化為可供審計的客觀證據，亦有助於迅速揪出那些促使 agent 「以防萬一」而無差別預載所有檔案的糟糕指引。

## Build It｜動手實作

`code/main.py` 實作了一套確定性的探索與漸進式揭露引擎。

探索介面包含：

- `Scope`：封裝來源與優先級後設資料；
- `SkillCandidate`：表示尚未經過格式校驗的檔案系統候選項目；
- `discover_scope(scope)`：列舉指定範疇下的直屬 skill 目錄；
- `resolve_collisions(candidates, precedence)`：執行宣告的命名衝突策略；
- `CatalogEntry` 與 `build_catalog(...)`：對外發布受配額限制的目錄後設資料；
- `CatalogBudget`：對序列化後的條目精確核算容量，而不盲目將字元數等同於跨模型通用的 Token 數。

揭露介面包含：

- `load_skill_body(entry, ...)`：執行第二層（Level 2）正文啟用；
- `validate_reference(skill_dir, reference)`：落實嚴格的路徑包含與逃逸防護校驗；
- `load_reference(...)`：執行具備配額邊界的第三層（Level 3）資源讀取。

執行實驗：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

該指令區塊需要本機 clone 儲存庫，並能自儲存庫內任何工作目錄啟動並正確解析儲存庫根目錄。

演示程式會建立臨時的專案與使用者範疇、製造一次人為命名衝突、在故意設限的小容量預算下建置目錄清單、啟用一項 skill，並分別演示一次合法的參考文件讀取與一次惡意的路徑遍歷越界攔截。全流程不殘留任何持久化檔案。

### 為何目錄探索應保持淺層掃描

`discover_scope` 僅會檢查直屬子目錄中的 `SKILL.md`，絕不會遞迴將每個深層巢狀的 `SKILL.md` 誤當作獨立套件。這能完整捍衛套件邊界，並有效防止將已安裝套件內部內建的測試範例或測試資料誤發布為頂層技能。

### 為何教學實驗不實作任意 YAML 解析

本實驗僅支援目錄建置所需的純量前置宣告。生產級執行時期環境應採用具備明確 Schema 約束、大小限制且嚴格停用自訂物件建構的安全 YAML 解析器。「純標準函式庫實作」是教學約束，絕非暗中發明自製非標準 YAML 方言的許可證。

## Use It｜實際應用

為任何探索適配器導入以下十項標準檢核清單：

1. 詳盡列舉每個已配置的根目錄，並明確標註誰具備其寫入權限。
2. 明確宣告是否允許包含符號連結的套件。
3. 嚴格校驗套件名稱、目錄名稱、必填後設資料與進入點檔案大小。
4. 在系統內部身分中完整保留來源路徑與探索範疇。
5. 明確宣告並單元測試同名衝突處置行為。
6. 精確測量最終出示給模型的序列化目錄實際開銷。
7. 忠實記錄載入特定正文或周邊資源的具體業務原因。
8. 確保所有資源讀取嚴格被限制在已解析的套件根目錄之內。
9. 在引用的檔案缺失時拋出清晰明確的錯誤回報。
10. 在安裝套件變更或系統策略調整時自動觸發目錄重建。

## Ship It｜交付成果

本課產出 `skill-catalog-builder` 工具套件。它能掃描具備明確優先順序的根目錄、果斷拒絕符號連結進入點檔案與名稱目錄錯位問題、解決跨範疇命名衝突、拒絕同等優先級下的重複項目，並將選定的後設資料精準塞入宣告的條目數、描述長度與字元容量預算之中。

其產出的 JSON 報告包含：入選條目清單、被搶佔的候選者、因配額省略的條目、格式校驗錯誤、優先順序仲裁結果與預算使用狀態。正文載入與參考文件讀取始終保持為完全獨立的執行時期後續操作，因此目錄建置器絕不擅自執行任何腳本，亦不將整個龐大套件無差別塞入上下文脈絡中。

## Exercises｜練習

1. 新增一個 plugin 範疇，將其優先級設定在使用者與內建範疇之間。編寫測試驗證衝突解決結果。
2. 將衝突策略從「最高優先級勝出」修改為「完整限定名稱」。確保兩個同名條目皆得以完整保留於目錄清單中。
3. 為 `load_reference` 新增位元組大小上限約束。編寫測試驗證剛好位於上限邊界的檔案與超出上限 1 個位元組的檔案之處置行為。
4. 撰寫兩份聽起來幾乎完全相同的描述文字。動手改寫它們，使兩者的觸發意圖邊界完全不再重疊。
5. 建立一份包含所有參考文件與腳本雜湊值的 Manifest 清單。在載入任何資源之前，精準檢測其是否曾遭外部惡意篡改。
6. 為演示程式實作深入埋點，分別獨立回報第一層、第二層與第三層所消耗的具體位元組數。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Skill discovery | 「找到所有 SKILL.md」 | 檢索已配置的範疇、校驗套件合法性、附加來源出處並套用系統策略 |
| Skill catalog | 「已安裝的 Skills 清單」 | 面向模型可見、用於意圖路由的精簡後設資料索引 |
| Collision policy | 「同名衝突誰勝出」 | 為來自不同來源的同名候選套件所預先宣告的仲裁規則 |
| Progressive disclosure | 「延遲載入機制」 | 自目錄、正文至特定分流資源所實施的分段脈絡准入體系 |
| Reference graph | 「Skill 引用的檔案結構」 | 可達資源的拓撲結構與其所對應的觸發載入條件 |
| Path containment | 「限制在資料夾內」 | 確鑿驗證解析後的實體目標依然嚴格位於解析後的套件根目錄內部 |

## Further Reading｜延伸閱讀

- [Agent Skills specification](https://agentskills.io/specification) ——套件實體結構與漸進式揭露層級權威規範
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) ——目錄意圖路由後設資料撰寫指引
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) ——直接檔案參照與進入點檔案大小最佳實務
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) ——Codex 當前探索範疇與目錄容量配額官方說明
