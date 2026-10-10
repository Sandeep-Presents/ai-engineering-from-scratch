# Agent Skills：可移植契約與執行時期邊界

> 一項 skill 絕非換個漂亮檔名的冗長 prompt。它是一套包含操作指引、輔助資源與可執行腳本的具名封裝套件，可供系統探索，並透過明確的執行時期契約動態載入至 agent 的脈絡環境中。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 精確定義 agent skill，切勿將其與 prompt、儲存庫全域指引、工具、Hook、子 agent 或 plugin 擴充功能互相混淆。
- 深入解讀可移植的 `SKILL.md` 規範契約，並將其與特定宿主環境的專屬擴充功能清晰劃分。
- 將探索（Discovery）、選取（Selection）、啟用（Activation）、資源載入（Resource Loading）、工具呼叫（Tool Use）與獨立驗證（Verification）解析為彼此獨立的生命週期階段。
- 在執行時期環境將 skill 套件登記至 agent 目錄清單前，對其進行嚴格的格式校驗。
- 針對具體的工程任務，在 skill、MCP 工具、Hook、子 agent 或常規程式碼之間做出正確的技術原語選型。

## Ten-Minute First Success｜十分鐘快速上手

在深入閱讀長篇原理解析之前，先動手完成此實作。你將親手建立一個輕量 skill、將完整的審查工具套件安裝至真實的 agent 宿主環境中、顯式呼叫它、驗證產出結果，最後乾淨移除。這將以可觀察的具體成果驗證整套生命週期。

### 真實宿主環境實驗準備檢查

本真實宿主檢查點需要 Node.js、`npx`、Python 3、一個選定的具備 skill 執行能力的宿主環境，以及在安裝程式中選擇之專案或使用者層級的寫入權限。請先驗證本地指令：

```bash
node --version
npx --version
python3 --version
```

在開始安裝前，確定你將使用的宿主與安裝範圍。若缺少任何前置條件，請在網站上閱讀本課內容，或繼續進行下方的純手動套件練習。該備選方案能幫助理解契約規範，但無法驗證宿主的目錄探索、動態呼叫、內建腳本執行或卸載行為。請將該部分驗證標記為暫緩。

### 1. 於空工作目錄中開始

在任何存放學習專案的父目錄下執行以下指令：

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

最後一條指令不應輸出任何內容。若印出檔案，請換至另一個乾淨的空目錄，確保審查範圍邊界清晰。

為你的第一個 skill 建立目錄：

```bash
mkdir -p my-first-skill
```

建立 `my-first-skill/SKILL.md`，內容如下：

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

確認檔案已成功建立於目標目錄：

```bash
test -f my-first-skill/SKILL.md
```

無輸出且結束碼為 0 代表檔案確實存在。

### 2. 安裝完整的審查工具套件

停留在 `agent-skills-first-run` 目錄並執行：

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

選擇你所使用的 agent 宿主與安裝範圍。安裝程式應列出 `skill-contract-reviewer` 及其寫入的目標路徑。`--full-depth` 參數為必填項，因為本課的 skill 是一個包含參考資料、執行腳本與靜態資產的巢狀完整套件。

將 `SKILL_ROOT` 設定為安裝程式回報的絕對路徑目錄。該目錄必須是包含所安裝 `SKILL.md` 的實體目錄，而非課程原始碼目錄，亦非當前工作區：

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

若 agent 階段作業（session）原先已處於開啟狀態，請重新啟動新階段作業或執行該宿主的 skill 重新掃描指令。切勿假設所有宿主環境皆具備目錄熱重載功能。

### 3. 明確顯式呼叫

在已安裝該 skill 的 agent 中，將 `agent-skills-first-run` 設為工作目錄，並依宿主支援的語法發起呼叫：

| 宿主環境 | 顯式呼叫語法 |
|---|---|
| Codex | `skill-contract-reviewer`，或從 `/skills` 選單中選取，隨後附上審查請求 |
| Claude Code | `/skill-contract-reviewer` 後方接續審查請求 |
| 通用備選 | `Use skill-contract-reviewer to review the target package.` |

在請求中使用先前印出的 `SKILL_ROOT` 與 `TARGET_ROOT` 絕對路徑數值。要求宿主在執行前完整展開變數，並印出完全解析後的精確指令，而非相依於當前行程工作目錄的相對指令：

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

解析完成的執行指令應具備以下形式，不應殘留任何佔位符號：

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

一次成功的執行應同時具備以下三項特徵：

1. 宿主能透過名稱精準找到 `skill-contract-reviewer`。
2. 審查工具讀取套件契約，並順利運行其內附的校驗腳本。
3. 回應內容包含結構完整的校驗報告，對該範例未回報任何結構錯誤，
   並提供經過論證的原語選型建議。

執行證據中亦必須清楚記錄腳本路徑、目標路徑、工作目錄（cwd）、精確的引數陣列（argv）與結束狀態碼。若產出的報告文筆流暢卻缺少這些欄位，無法證明內附的伴隨腳本確實曾被執行。

若宿主回報該 skill 不可用，請檢查安裝目標路徑、執行重新掃描或重啟一次，隨後重試顯式請求。切勿透過隨意竄改 skill 描述來遮掩安裝失敗的底層問題。

### 4. 探測隱式自動選取

啟動一個全新的 agent 對話回合，在不提及 skill 名稱的情況下輸入相同任務：

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

若該宿主環境會對外揭露其選取的 skills，記錄其是否主動挑選了 `skill-contract-reviewer`。若宿主不公開路由決策細節，則將隱式選取標記為未驗證。顯式呼叫始終是跨平台的可移植保底方案。

### 5. 清理環境

僅移除已安裝的審查工具套件：

```bash
npx skills remove skill-contract-reviewer
```

選擇與安裝時相同的宿主與範圍。在執行重新掃描或開啟新階段作業後，針對 `skill-contract-reviewer` 發起的顯式請求應回報其已不可用。你可以保留 `my-first-skill` 供後續課程使用，亦可在完成整組學習路線後將該實驗目錄刪除。

## The Problem｜問題

假設你的團隊擁有成熟可靠的軟體發布流程：自動檢索已合併的變更、核對資料庫遷移說明、更新變更日誌（changelog）、執行打包發布指令，並產出上線檢查清單。

若將這整套流程塞進單一 prompt 中，複製貼上固然容易，維運管理卻困難重重。Prompt 缺乏穩定的識別身分、沒有目錄探索機制、缺少外部資源邊界、無法被單元測試驗證，且無法回答諸多基本工程問題：誰有權呼叫它？模型何時應該選取它？它允許執行哪些腳本？哪些本機檔案是可信任的？當對話脈絡被壓縮截斷時，哪些關鍵狀態得以留存？

相反的極端錯誤，則是將所有可重複使用的指引全數包裝為 skill。儲存庫規範、確定性自動化腳本、外部 API 工具、事件鉤子（hooks）與委派 agent 分別解決的是截然不同的問題。若將它們不加思索地全數塞入 `SKILL.md`，產出的套件表面看似通用，實則深度綁定於單一宿主未公開的私有實作行為。

首要的架構任務在於**精確分類**。在決定如何封裝產物之前，先釐清該產物究竟屬於何種架構原語。

## The Concept｜核心概念

### Skills 負責編碼程序性知識

一個 agent skill 是一個實體目錄，其標準進入點為 `SKILL.md`。該進入點檔案包含 YAML 格式的前置後設資料（frontmatter），後方接續 Markdown 格式的操作指引。該目錄亦可包含參考文件、可執行腳本與靜態資產。

```figure
skill-package-anatomy
```

可部署的最小單位是整個實體目錄，而非單一 Markdown 檔案本身。若僅複製了 `SKILL.md` 卻遺失了其引用的相依資源，即便其 frontmatter 解析完全合法，該套件依然屬於破損狀態。

### 相鄰架構原語之職責邊界

| 架構原語 | 核心職責 | 載入或執行時機 | 絕不可冒充的角色 |
|---|---|---|---|
| Prompt | 形塑單次模型互動行為 | 由應用程式或使用者即時注入 | 包含外部資源的版本化套件 |
| Repository instructions（儲存庫指引） | 闡述單一程式碼庫的常態性規範 | 程式撰寫環境進入該專案範疇時 | 可跨專案復用的具體任務流程 |
| Agent skill（Agent 技能） | 提供可重複使用的程序性操作知識 | 經顯式或隱式選取後動態啟用 | 強制性的底層權限隔離防線 |
| MCP tool（MCP 工具） | 暴露具備強型別的遠端操作能力 | 由模型或應用程式主動呼叫 | 冗長繁複的作業程序說明書 |
| Hook（事件鉤子） | 針對特定系統事件執行確定性邏輯 | 宣告的目標事件被觸發時 | 依機率進行的模型智慧路由層 |
| Subagent（子 Agent） | 委派具備獨立脈絡與狀態的專項工作 | 由協調者（Orchestrator）建立或調用 | 靜態不變的指令集合 |
| Plugin | 發布並散播大型執行時期擴充套件 | 宿主系統安裝或啟用該套件時 | 可移植的 skill 核心契約本體 |
| Learned skill library（經驗學習庫） | 儲存透過探索與實踐所習得的行為模式 | 策略模型依任務相似度檢索出先前軌跡 | 符合標準規範的 `SKILL.md` 套件 |

發布技能可以指導 agent 如何審查版本發布；MCP 伺服器可以暴露發布註冊表 API；Hook 可以強制禁止直接向 main branch 推送程式碼；子 agent 則能獨立審計候選版本。這些元件各司其職，彼此無縫組合。

### 「Skill」一詞代表兩種截然不同的理念

在學術研究體系中，透過強化學習或環境探索習得的一段程式碼、成功軌跡或環境特化策略片段，常被稱為「skill」。Agent 可以在自主探索中動態生成這些產物、依任務相似度檢索並執行它們，並依回饋持續迭代該程式庫。Phase 14 · 10 便致力於建構這類終身學習程式庫。

而本專題模組中的 Agent Skill 則截然不同。它是一套由人類工程師或系統精心編寫的封裝套件，具備宣告式的檔案系統契約、目錄後設資料、漸進式揭露機制、受執行時期管制的調用模式，以及由宿主完全主控的工具集。它可由 agent 輔助生成或最佳化，但該格式本身完全不要求具備模型自主學習機制。

| 評估維度 | Agent Skill 套件 | Learned skill library（學習程式庫） |
|---|---|---|
| 核心單位 | 包含 `SKILL.md` 的實體目錄 | 程式碼、策略權重、軌跡或記憶體記錄 |
| 建立方式 | 人工編寫、自動生成或精心維護 | 通常源自環境探索與經驗累積自動發現 |
| 選取機制 | 目錄描述比對搭配執行時期策略 | 依任務特徵向量檢索或策略網路推論 |
| 執行方式 | 模型遵循指引並呼叫宿主提供的工具 | 模擬環境直接執行預存行為或程式產物 |
| 可移植性 | 套件契約可跨相容的各大宿主無縫遷移 | 通常深度綁定於特定模擬環境與動作空間 |
| 評估維度 | 意圖路由、產物質量、安全性與宿主相容性 | 獎勵分數、任務成功率、遷移泛化與庫容量 |

兩者皆致力於封裝可重複利用的工程能力。切勿僅因兩者名稱相同而混淆其底層實作承諾。

### 可移植的核心契約

Agent Skills 官方規範嚴格要求以下兩個 frontmatter 欄位：

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name` 是穩定的唯一識別碼。它必須符合規範的命名規則，且必須與其父目錄名稱完全一致。`description` 既是文檔說明，更是模型意圖路由的關鍵後設資料。它應明確指出該 skill 的具體功能，以及模型在何種情境下應當選取它。

核心規範中定義的可選可移植欄位：

| 欄位名稱 | 用途說明 | 可移植性備註 |
|---|---|---|
| `license` | 宣告該套件的授權條款 | 核心標準規範 |
| `compatibility` | 宣告所需的最低環境依賴要求 | 核心標準規範 |
| `metadata` | 攜帶字串鍵值型的擴充資料 | 核心標準規範 |
| `allowed-tools` | 建議預先批准的工具清單 | 實驗性特徵；各宿主支援度不同 |

Markdown 正文承載具體的操作指引。它應清晰定義作業流程、關鍵決策點、異常失敗處置方式，以及指向周邊輔助資源的直接路徑。

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### 執行時期擴充功能是第二層延伸

部分宿主支援額外的 frontmatter 或伴隨設定檔。這些欄位在特定環境中極具價值，但它們並不具備開箱即用的跨平台可移植性。

| 行為特徵 | 宿主擴充範例 | 是否屬於可移植核心？ |
|---|---|:---:|
| 對模型隱藏該 skill，僅允許使用者手動顯式呼叫 | `disable-model-invocation` | 否 |
| 在使用者的指令選單中隱藏，但允許模型自動路由 | `user-invocable` | 否 |
| 在指令選單中顯示參數輸入提示說明 | `argument-hint` | 否 |
| 在獨立委派的子脈絡中執行該 skill | `context`、`agent` | 否 |
| 鎖定特定模型或推論強度設定 | `model`、`effort` | 否 |
| 註冊生命週期自動化鉤子 | `hooks` | 否 |
| 在 Codex 中關閉隱式自動選取 | `agents/openai.yaml` 策略 | 否 |

請將各項專屬擴充視為外部介面配接器（Adapters）。維持核心工作流程在缺少這些欄位時依然合法運作，詳盡記錄降級回退方案，並針對目標宿主進行相容性測試。未知的欄位可能會被某些執行時期直接忽略、拒絕載入，或單純保留而不觸發任何特定行為。

### Frontmatter 屬於可執行後設資料

後設資料在 skill 正文尚未被模型閱讀前，便已在底層實質改變系統行為：

- 畸形的 `name` 會直接導致目錄探索失敗。
- 含糊不清的 `description` 會引發模型錯誤路由。
- 標註為僅限人類呼叫的旗標，會將該 skill 自模型的可用目錄清單中徹底隱藏。
- 工具授權宣告會改變宿主是否在呼叫前向使用者彈出權限確認提示。
- 脈絡環境設定會直接將執行流程調度至完全獨立的 agent 階段作業中。

請以對待設定檔程式碼的嚴謹態度審查 frontmatter。落實嚴格校驗、納入版本控管，並將其路由表現列入 Evals 評測體系。

### Skill 的完整生命週期

```figure
skill-runtime-lifecycle
```

每個轉移箭頭皆是一道具備專屬失敗模式的系統邊界：

1. **探索（Discovery）**：在預先配置的目錄中檢索潛在的 skill 套件。
2. **驗證（Validation）**：在將套件註冊至目錄前，果斷拒絕格式損壞或不安全的套件。
3. **目錄發布（Cataloging）**：僅對外暴露精簡的 `name` 與 `description`，絕不提前載入完整套件。
4. **選取（Selection）**：依據使用者意圖判斷該 skill 是否切題。
5. **啟用（Activation）**：將 skill 正文動態注入模型當前可見的對話脈絡中。
6. **揭露（Disclosure）**：僅在執行特定決策路徑時，按需載入周邊參考文件或資產。
7. **執行（Execution）**：在宿主環境的權限管控與沙盒隔離機制下呼叫工具。
8. **驗證（Verification）**：獨立審計所產出的產物品質，絕不單憑模型自稱的成功報告。

混淆這些階段會導致危險的心智模型：被探索到的 skill 尚未處於啟用狀態；已啟用的 skill 並不代表具備執行其所描述之一切操作的法定權限；被允許的工具呼叫亦無法保證執行產出的結果百分之百正確無誤。

### Skills 與 Tools 是正交互補的

MCP 解決的是：「應用程式具備哪些可被調用的具體能力？其輸入參數 Schema 為何？」而 Skill 解決的是：「面對此類複雜工程任務，agent 應當採取何種最佳實踐流程與決策路徑？」

```figure
skill-tool-orthogonality
```

Skill 正文中可以提及某個工具名稱，但實體能力的註冊表始終由宿主環境嚴格掌控。若所需工具不存在，skill 應明確指引降級方案或拋出清晰錯誤。它絕不可暗示單憑在文字中提及某項能力便能自動憑空建立該工具。

### Skills 與儲存庫指引屬於不同範疇

儲存庫全域指引描述的是你當前身處的既有專案環境：可用指令、架構約定、自動生成檔案規則與作業紅線。而 Skill 則提供一套可跨多個不同專案重複應用的標準作業程序。

當兩者同時適用時，當前的使用者具體請求與儲存庫常態規則具備更高優先權，嚴格約束 skill 的執行範疇。通用的重構 skill 絕不可違背儲存庫中「禁止手動修改自動生成檔案」的最高紅線。

### Skills 之間不存在語言級的匯入關係

一個 skill 可以指示 agent 進一步調用另一個 skill，但這絕非程式語言層級的 import 引用。被調用的第二個 skill 依然必須完整走過執行時期的探索、資格審查、脈絡啟用、權限核准與狀態隔離機制。

請將跨 skill 的相依關係編寫為可被觀測的工作流程節點：

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

這能使相依邊界可被單元測試覆核，並賦予宿主環境實施安全策略的機會。

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套符合規範的套件校驗器與架構原語選型器，完全無外部相依，確保每條規則清晰透明。

該校驗器提供：

- `parse_frontmatter(text)`：精確分離 frontmatter 與正文。
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`：檢查必填欄位、命名規範、未經許可的宿主擴充、正文存在性與可移植字元長度限制。
- `ValidationIssue` 與 `SkillReport`：回傳結構化驗證證據，而非單一模糊的布林值。
- `FrontmatterSyntaxError`：精準捕捉無法安全解析的畸形輸入。

選型器則提供 `TaskShape` 與 `select_primitives(task)`。它將任務特徵精確對映至一般程式碼、儲存庫指引、skill、Hook、子 agent 或 MCP 工具。

執行實驗：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

該指令區塊需要本機 clone 儲存庫，並可在儲存庫內任何路徑啟動，以便 `git rev-parse --show-toplevel` 正確解析儲存庫根目錄。

演示程式會印出四種典型情境的 JSON 診斷報告：合法可移植 skill、包含宿主擴充之 skill、非法損壞套件，以及多個任務的選型決策結果。請仔細觀察問題代號（issue codes）。一個優秀的套件校驗器應具備引導作者精準修復產物的能力，而非替作者盲目猜測意圖。

### 校驗執行順序至關重要

在進行深度語義內容檢查前，必須優先校驗成本低廉的基礎結構性約束：

```figure
skill-validation-order
```

嚴格遵循此執行順序，能防止次要細節錯誤掩蓋了最關鍵的底層結構破壞。

## Use It｜實際應用

在動手編寫任何 skill 前，請先填寫以下決策檢核表：

| 評估問題 | 若回答為「是」 | 最合適的架構原語 |
|---|---|---|
| 這是否需要跨越多個步驟由模型提供可重複的智慧判斷？ | 程序相對穩定但決策路徑具備多樣性 | Skill |
| 這是否必須在特定事件發生時百分之百強制執行？ | 遺漏任何一次執行皆無法被系統接受 | Hook 或常規應用程式碼 |
| 模型是否需要呼叫具備強型別參數的外部能力？ | 該運作存在於模型對話脈絡之外 | Tool 或 MCP 伺服器 |
| 該任務是否需要完全獨立的脈絡環境、狀態或責任歸屬？ | 需要一個隔離的工作者回傳邊界明確的結果 | Subagent（子 Agent） |
| 該指引是否高度特化於當前單一程式碼儲存庫？ | 它描述的是本機專屬指令與本地約束規則 | Repository instructions |
| 單次即時互動是否已足以達成目標？ | 完全不需要維護可移植的套件生命週期 | Prompt |

在真實生產實踐中，許多架構流程會同時結合多種原語。此決策卡能徹底杜絕單一產物試圖冒充解決所有問題的過度設計。

## Ship It｜交付成果

本課於 `outputs/` 目錄交付 `skill-contract-reviewer` 完整工具套件，其包含：

- 一個可移植的 `SKILL.md`，專門用於審查任何提出的 skill 套件架構；
- 針對可移植契約與架構原語選型的參考檢核清單；
- 確定性的本地驗證腳本；
- 涵蓋 prompts、skills、tools、hooks、一般程式碼與子 agent 的任務特徵測試資料（fixtures）。

請安裝完整套件，切勿只複製單一進入點檔案：

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

課程安裝腳本會回報複製的每個 Phase 13 skill，並寫入 `/tmp/aiefs-skills/manifest.json`。這個乾淨的目標目錄可用於檢查套件結構；上方的十分鐘快速上手流程則可用於驗證真實宿主環境中的目錄探索與呼叫行為。

後續課程將深入剖析每個生命週期階段：第 24 課探討目錄探索與漸進式揭露；第 25 課探討呼叫策略與智慧路由；第 26 課劃分權限管制與沙盒隔離邊界；第 27 課則將整個套件打造成具備完整評測體系的標準發布產物。

## Exercises｜練習

1. 使用 `TaskShape` 對你團隊內部的五個工作流程進行分類。對於選用超過一種架構原語的複合案例，提出完整的架構論證。
2. 為校驗器新增邊界測試，證明長度為 500 字元的 `compatibility` 欄位順利通過，而 501 字元的數值則被判定為違反規範的錯誤。
3. 將一項宿主專屬擴充新增至白名單中。編寫測試，證明該檔案在被允許的同時，依然能與純可移植 skill 被精確區分開來。
4. 將一段長達 400 行的龐大 prompt 拆解為：一個核心 `SKILL.md`、一份參考文檔、一份腳本呼叫契約，以及一份輸出格式範本。確保每個檔案各自承擔單一職責。
5. 為一個引用了缺失 MCP 工具的 skill 設計一套優雅的降級回應常式。切勿暗中偷偷替換為權限過度寬鬆的其他現存工具。
6. 審查一個現有的 skill，將正文中的每句話分別標註為：意圖路由、作業程序、系統策略、外部參考指標或輸出格式契約。果斷剔除任何不屬於該範疇的雜亂文字。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Agent skill | 「存檔的 prompt」 | 包含程序性操作指引與可選周邊資源的可探索實體目錄 |
| Portable core | 「各執行時期共通欄位」 | 由 Agent Skills 官方標準規範所定義的核心契約集合 |
| Runtime extension | 「額外 frontmatter」 | 宿主特化的專屬設定欄位，需搭配相容的配接器方能生效 |
| Activation | 「Skill 已執行」 | Skill 正文被載入至模型可見的上下文脈絡中；實體執行可能在後續發生 |
| Skill dependency | 「引用另一個 Skill」 | 經由執行時期仲介調用的動態關聯邊界，伴隨可用性與策略安全檢查 |
| Tool contract | 「函式宣告 Schema」 | 為特定操作能力所定義的輸入、輸出、權限、副作用、錯誤代號與憑證 |

## Further Reading｜延伸閱讀

- [Agent Skills specification](https://agentskills.io/specification) ——可移植目錄架構與 frontmatter 契約權威規範
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices) ——職責範疇、撰寫指引與資源組織最佳實務
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills) ——Codex 當前目錄探索與呼叫機制官方說明
- [Claude Code skills](https://code.claude.com/docs/en/skills) ——Claude Code 在呼叫控制、參數提示、工具授權與委派脈絡上的專屬擴充指南
