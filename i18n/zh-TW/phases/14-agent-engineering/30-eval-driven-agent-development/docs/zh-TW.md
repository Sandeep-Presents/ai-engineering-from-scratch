# 評測驅動的 Agent 開發學（Eval-Driven Development）

> Anthropic 的權威指引：「始於簡潔的 Prompt，透過全方位的嚴格評測實施最佳化，唯有在真正需要時才引入多步驟 Agent 系統。」評測絕非系統開發的收尾環節，它是驅動 Phase 14 所有其他架構抉擇的外層閉環。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出三大評測防護層——公開靜態基準、自訂離線評測、線上正式環境評測——以及各自的核心使命。
- 深入解釋「評估者—最佳化者（Evaluator-Optimizer）」的高頻緊密閉環。
- 掌握 2026 年的業界最佳實踐：Evals 與業務程式碼緊鄰共存、在 CI 中自動運行，並作為 PR 合併的硬性卡點。
- 將 Phase 14 的每一課精確對映至其所衍生的具體評測測試案例。

## The Problem｜問題

Agent 往往能順利跑通精心準備的 Demo 展示。然而一旦投入正式環境，它們卻會以 Demo 永遠無法預測的方式崩潰。公開基準僅能回答「這款大模型是否具備泛化能力？」，卻無法回答「該 Agent 能否為你的專屬產品產出正確無誤的修復補丁？」。唯一解法是：建立三層持續運行的自動化評測體系，將每道安全護欄與學到的規則皆轉化為可執行的測試案例。

## The Concept｜核心概念

### 三大評測防護層

1. **靜態公開基準（Static benchmarks）**：針對程式碼修復的 SWE-bench Verified（第 19 課）、針對網頁與桌面操作的 WebArena / OSWorld（第 20 課）、針對全能推理的 GAIA（第 19 課）、針對工具呼叫的 BFCL V4（第 06 課）。用於跨模型橫向對比與阻斷嚴重回歸退步。資料污染問題真實存在：SWE-bench+ 實證揭露高達 32.67% 的解法洩漏；對外一律以 Verified 或經去污染審計的分數為準。
2. **自訂離線評測（Custom offline evals）**：針對你專屬產品業務形態的特化評測：
   - 大模型即裁判（LLM-as-judge，結合 Langfuse、Phoenix、Opik——第 24 課）；
   - 基於實體執行的驗收（套用補丁、實跑單元測試）；
   - 基於動作軌跡的驗收（將動作序列與專家黃金標準對比；OSWorld-Human 實測揭露頂尖 Agent 往往耗費人類 1.4 至 2.7 倍的多餘步數）。
3. **線上正式環境評測（Online evals）**：即時正式環境中的持續守護：
   - 階段作業完整重播（Langfuse）；
   - 觸發安全護欄的即時警報（第 16、21 課）；
   - 逐步驟成本與延遲追蹤（第 23 課 OTel Spans）。

### 評估者—最佳化者閉環（Anthropic）

緊密的高頻改進閉環：

1. 提案者生成產物初稿；
2. 評估者進行客觀判定；
3. 迭代精煉修正，直到評估者批准通過。

這正是 Self-Refine（第 05 課）的通用化實踐。你所關心的任何核心 Agent 業務流，皆能透過包裹在評估者—最佳化者之中來取得極高的系統可靠性。

### 2026 年業界最佳工程實踐

- Evals 評測案例直接與業務程式碼存放在同一個儲存庫中；
- 每次發起 PR 時，由 CI 自動化管線強制全量運行；
- 以評測得分作為 PR 合併的硬性門檻（例如「相較於 main branch，指標回歸退步不得超過 5%」）；
- 每一道安全護欄，皆對應一組專屬的 Evals 測試案例；
- 每一條沉澱的經驗規則（Reflexion、學習規則），皆對應一個曾經真實發生過的失敗案例。

### 將 Phase 14 全部章節融會貫通

Phase 14 中的每一課，皆能直接衍生出具體的 Evals 測試案例：

| 課程章節 | 衍生出的具體 Evals 測試案例 |
|---|---|
| 01 Agent 迴圈 | 預算耗盡中斷、防死迴圈安全卡點 |
| 02 ReWOO | 當某個工具執行失敗時，規劃器能否正確重新排程 |
| 03 Reflexion | 沉澱的經驗反思能否在下次重試中順利發揮作用 |
| 05 Self-Refine/CRITIC | 評判者能否精準核驗精煉後的產物 |
| 06 工具使用 | 參數型別寬容轉換正常運作；未註冊工具被果斷拒絕 |
| 07-10 記憶體體系 | 檢索召回的引文出處與來源吻合；過時矛盾的事實被正確淘汰 |
| 12 工作流程模式 | 每個工作流程模式皆產出符合預期的正確輸出 |
| 13 LangGraph | 中斷復原能否百分之百精確還原全域狀態 |
| 14 AutoGen Actors | 死信佇列（DLQ）能否正確捕獲崩潰的處理常式 |
| 16 OpenAI Agents SDK | 安全護欄能否在正確的惡意輸入上精準觸發警報 |
| 17 Claude Agent SDK | 子 agent 的執行成果能否順暢回傳給主協調者 |
| 19-20 基準評測 | SWE-bench Verified 得分、WebArena 成功率、OSWorld 步驟效率 |
| 21 Computer Use | 逐步驟安全分類器能否精準捕捉 DOM 中夾帶的惡意注入指令 |
| 23 OTel 語意約定 | 發射的 Spans 完整攜帶規範要求的所有必備標準屬性 |
| 26 失效模式 | 檢測器能否自動標註所有已知的結構性失效類別 |
| 27 Prompt 注入防禦 | PVE 防禦層能否果斷拒絕夾帶惡意指令的被投毒檢索內容 |
| 28 編排模式 | 監督者能否精準將任務分派給正確的專業專家 |
| 29 執行時期形態 | 死信佇列能否從容應對高達 N% 的任務隨機失敗率 |

若你的 Evals 測試套件完整涵蓋了上述每個維度，便代表你已徹底吃透了 Phase 14。

### 評測驅動開發的常見陷阱

- **缺乏基準線 Baseline**：若缺乏「已知良好狀態」作為基準線，評測分數將毫無解讀價值。務必持久化儲存 Baseline。
- **缺乏事實錨定的 LLM 裁判**：大模型裁判自己同樣會產生幻覺。牢記第 05 課的 CRITIC 原則——裁判必須依賴外部實體工具進行客觀驗證。
- **過度擬合評測集**：單純為了刷高評測分數而過度調校，會與真實業務實用性脫節。定期輪換測試案例。
- **測試案例充斥隨機波動（Flaky evals）**：非確定性的案例會頻繁引發虛假報警。固定隨機種子、對狀態進行快照存檔。

```figure
ae-eval-three-layers
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套評測控端：

- 包含三大類別（公開基準、自訂離線、線上生產）的測試案例註冊表；
- 受測的腳本化 Agent 模組；
- 評估者—最佳化者閉環：提案、評判、修正直到通過或達到最大輪次；
- CI 合併卡點：統計全域通過率，並比對是否相較於 Baseline 發生了回歸退步。

運行實驗：

```
python3 code/main.py
```

輸出會呈現逐案例的通過狀態、回歸標記，以及 CI 合併卡點的最終裁決結果。

## Use It｜實際應用

- 將評測測試案例直接寫在與 Agent 程式碼相同的儲存庫中。
- 透過 CI 自動化管線在每次發起 PR 時強制執行。
- 若檢測到效能指標回歸退步，直接阻斷程式碼合併。
- 長期追蹤全域通過率的演進趨勢。
- 將線上發生的每一次真實故障，皆轉化為一個全新的回歸測試案例。

## Ship It｜交付成果

`outputs/skill-eval-suite.md` 能為任何 Agent 產品自動建立完整的三層評測套件，內建 CI 合併阻斷卡點與回歸追蹤機制。

## Exercises｜練習

1. 挑選一例你目前線上發生的真實故障。撰寫一個能精準重現該故障的 Evals 測試案例。你的 Agent 目前能否順利通過它？
2. 為你的業務領域打造一套 LLM 裁判標準（涵蓋事實性、專業語氣、邊界遵守度三維度）。為 50 次真實階段作業進行打分。
3. 將評測套件接入 CI 管線中：若指標回歸退步 >=5%，強制阻斷建置。
4. 新增軌跡執行效率指標：你的 Agent 實際執行的步驟數，相較於人類專家的黃金軌跡膨脹了多少倍？
5. 將 Phase 14 中的每一課逐一對映至你的 Evals 套件中。目前尚缺漏哪些案例？這正是下一步需要補齊的技術盲點。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Static benchmark | 「公開權威基準」 | SWE-bench、GAIA、AgentBench、WebArena、OSWorld |
| Custom offline eval | 「自訂領域評測」 | 針對特定業務形態實施的 LLM-as-judge、實體執行或軌跡評測 |
| Online eval | 「線上生產評測」 | 階段作業重播、安全護欄報警、逐步驟成本與延遲監控 |
| Evaluator-optimizer | 「提案—審核—修正」 | 提案者與評估者交替循環直到驗收通過的緊密閉環 |
| CI gate | 「PR 合併阻斷卡點」 | 當評測指標發生回歸退步時，強制阻斷程式碼合併的品質防線 |
| Baseline | 「歷史最優基準線」 | 用以比對是否發生回歸退步的參考歷史基準得分 |
| Trajectory efficiency | 「軌跡執行效率」 | Agent 實際執行的步數除以人類專家黃金步數之比值 |

## Further Reading｜延伸閱讀

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——「從簡潔出發，以評測為導向進行最佳化」官方指南
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) ——人工精選審核基準
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) ——工具使用權威評測
- [Langfuse docs](https://langfuse.com/) ——生產級 Evals 與階段作業重播實務手冊
