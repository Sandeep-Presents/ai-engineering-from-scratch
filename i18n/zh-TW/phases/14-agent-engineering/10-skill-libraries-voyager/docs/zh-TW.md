# 技能程式庫與終身學習（Voyager）

> Voyager（Wang 等人，TMLR 2024）將可執行程式碼視為技能（Skill）。每項技能皆具名、可被檢索、可自由組合，並能依據環境反饋進行持續精煉。這正是 Claude Agent SDK skills、skillkit 以及 2026 年各類技能程式庫架構模式的權威參考原型。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 指出 Voyager 的三大核心元件——自動化課綱（Automatic Curriculum）、技能程式庫（Skill Library）、迭代式 Prompt 機制（Iterative Prompting）及其各自職責。
- 深入闡明為何 Voyager 將動作空間直接抽象為可執行程式碼，而非單一底層基本指令。
- 以純 Python 標準函式庫實作一套具備註冊、相似度檢索、拓撲相依組合與錯誤驅動精煉的技能程式庫。
- 將 Voyager 範式精確對映至 2026 年的 Claude Agent SDK skills 與 skillkit 開發者生態。

## The Problem｜問題

若一個 agent 在每個全新的對話階段作業中皆被迫從零重新探索所有操作能力，它必然面臨三大致命缺陷：

1. **浪費 Token**：每個任務皆在重複推導完全相同的底層認知邏輯。
2. **遺失經驗積累**：在階段作業 A 中歷經千辛萬苦習得的修正經驗，無法平滑遷移至階段作業 B。
3. **無法應對長路徑複合任務**：複雜的工程任務需要層級分明的階梯式能力抽象；單次 One-shot prompt 根本無法承載如此龐大的深度。

Voyager 給出的經典解法：**將每項可重複利用的操作能力封裝為儲存於程式庫中的具名程式碼模組，支援依語意相似度動態檢索、能與其他既有技能靈活組合，並能在實體執行反饋的推動下不斷自我精煉進化。**

## The Concept｜核心概念

### 三大核心元件

Voyager（arXiv:2305.16291）圍繞以下三大支柱建構 agent：

1. **自動化課綱（Automatic curriculum）**：由好奇心驅動的任務提案模組，依據 agent 當前已掌握的技能清單與即時環境狀態，自主提出下一個學習目標。探索由底向上自主推進。
2. **技能程式庫（Skill library）**：每項技能皆為可實體執行的程式碼。當一項任務成功達成時，對應的程式碼被納入庫中。支援依「任務查詢—技能描述」的向量相似度進行動態檢索。
3. **迭代式 Prompt 機制（Iterative prompting mechanism）**：當執行遭遇失敗時，agent 完整接收執行錯誤日誌、環境物理反饋與自我驗收失敗資訊，隨後有針對性地改寫精煉該技能程式碼。

在 Minecraft（我的世界）環境中的實測表現（Wang 等人，2024 年）：相較於傳統基準模型，解鎖了 3.3 倍的獨特物品種類、製作石器工具速度加快 8.5 倍、製作鐵器工具速度加快 6.4 倍、地圖探索跨度提升了 2.3 倍。這些實測結果雖特化於遊戲環境，但背後的架構模式具備極高的通用遷移價值。

### 動作空間 = 可執行程式碼（Action Space = Code）

絕大多數常規 agent 僅輸出底層的基本動作指令；而 Voyager 則直接輸出結構化的 JavaScript 函式。一項技能具備以下形態：

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

由多個底層子技能共同複合而成；以功能描述與語意 embedding 為索引鍵儲存；檢索出來的是一段可執行的完整程式，而非抽象的 prompt 指令。

這正是 2026 年 Claude Agent SDK skill 的精髓：一段具備名稱、可按需檢索，兼具可執行程式碼與操作指引的複合技能模組。

### 技能動態檢索（Skill Retrieval）

當接收到全新任務「製作一把鑽石鎬」時，Agent：

1. 計算該任務目標描述的語意 embedding；
2. 查詢技能程式庫，檢索出相似度最高的 Top-k 候選技能；
3. 成功召回 `craftIronPickaxe`、`mineDiamond`、`placeCraftingTable` 等既有模組；
4. 利用檢索到的基礎原語結合全新邏輯，快速組裝出全新的高階技能。

這正是 MCP 資源（第 13 課）與 Agent SDK skills 的通用落地範式：針對特定業務任務，在龐大的知識與程式碼表面上實施動態精準召回。

### 迭代式自我精煉（Iterative Refinement）

Voyager 的持續演進閉環：

1. Agent 編寫出一段初步的技能程式碼；
2. 技能在真實模擬環境中實體執行；
3. 環境回傳三種反饋信號之一：`success` 成功、`error` 報錯（附帶完整堆疊追蹤）、`self-verification failure` 自我驗證失敗；
4. Agent 將該錯誤上下文作為脈絡，有針對性地重構改寫該技能；
5. 持續迴圈直到成功或達到最大重試輪次。

這正是將 Self-Refine（第 5 課）深度套用於程式碼生成，並結合環境事實錨定驗證的具體實踐。而 CRITIC（第 5 課）則是該模式以外部工具作為驗證器的攣生架構。

### 探索課綱與能力拓展

Voyager 的課綱模組會依據 agent 目前所擁有的資源與尚未解鎖的領域，主動提出如「在湖邊搭建一個庇護所」等探索目標。提案器結合即時環境狀態與技能庫存量，精準選取剛好略高於當前能力上限的任務——這正是系統學習的「最近發展區（Exploration sweet spot）」。

在生產級企業 agent 中，這轉化為「能力盲區檢測器（What's missing operator）」：給定當前技能庫與目標業務領域，我們目前還缺漏哪些核心技能？工程團隊通常會透過定期的課綱審查會議來手動實踐該機制。

### 典型架構失效模式

- **技能程式庫臃腫腐化（Skill library rot）**：完全相同的核心邏輯被以略微不同的描述文字重複存入了 10 次。解法：在寫入時實施嚴格去重，檢索時僅回傳唯一權威基準版本。
- **複合技能相依漂移（Composed-skill drift）**：父層技能高度依賴某個子技能，而該子技能隨後經歷了深度改寫精煉。解法：為技能實施嚴格的版本鎖定；鎖定在 v1 的父技能絕不應當被靜默升級至 v3。
- **檢索準確率劣化**：當程式庫規模超過數百個技能時，純語意向量檢索的精確度開始下降。解法：疊加標籤過濾（Tag filters）與硬約束條件（例如「僅檢索標註 `category=tooling` 的技能」）。

```figure
voyager-skills
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套完整的技能程式庫：

- `Skill`：封裝名稱、描述、程式碼字串、版本號、標籤與相依清單。
- `SkillLibrary`：提供註冊、搜尋（Token 重疊檢索）、相依拓撲組合（Topological sort），以及精煉（更新時自動遞增版本號）。
- 腳本化 agent 演練：註冊三項基礎原語技能、組合出第四項高階技能、遭遇執行失敗，隨後自動精煉出修復版。

運行實驗：

```
python3 code/main.py
```

日誌軌跡會依序展示：技能庫寫入、動態檢索、拓撲組合、執行報錯，以及升級至 v2 的精煉修正——端到端完整重現了 Voyager 的核心學習閉環。

## Use It｜實際應用

- **Claude Agent SDK skills（Anthropic）**：2026 年的工業級標竿——每項技能皆具備描述、程式碼與指引，於 agent 對話期間按需載入。
- **skillkit（npm: skillkit）**：跨 32 種以上主流 AI 撰寫程式碼 agent 的跨平台技能管理標準工具。
- **領域專屬自訂技能庫**：資料工程 agent 專用的 SQL 技能庫、基礎設施 agent 專用的 Terraform 技能庫。Voyager 架構在垂直領域同樣展現出強大威力。
- **OpenAI Agents SDK `tools`**：輕量級別的體現；每個 tool 本質上就是一個微型封裝技能。

## Ship It｜交付成果

`outputs/skill-skill-library.md` 能為任何目標環境產出 Voyager 風格的技能程式庫鷹架，內建技能註冊、語意檢索、版本控管與失敗驅動精煉管線。

## Exercises｜練習

1. 為 `compose()` 組合函式新增循環相依檢測器。當技能 A 相依於 B、而 B 又反向相依於 A 時，系統應如何應對？拋出錯誤還是輸出警示？
2. 實作技能層級的版本鎖定機制。當父技能引用子技能 `crafting@1` 時，對子技能發起的 `crafting@2` 精煉升級絕不可靜默波及父技能。
3. 將簡易的 Token 重疊檢索替換為 sentence-transformers embedding 模型（或本機 BM25 演算法）。在包含 50 個技能的測試庫上實測其 Recall@5 表現。
4. 打造一個「課綱提案 agent」：給定當前技能庫清單與目標業務描述，自動分析並提出 5 項缺漏的必備技能。將其配置為每週定時調用。
5. 研讀 Anthropic 的 Claude Agent SDK 官方技能文件。將本課的教學技能庫移植為符合該 SDK 規範的 Schema 結構。其目錄探索與可發現性產生了哪些改變？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Skill | 「可重複利用的能力」 | 具備名稱、可執行程式碼與意圖描述的模組，支援依相似度召回 |
| Skill library | 「Agent 的技能經驗庫」 | 持久化儲存技能的結構化倉庫，支援搜尋檢索與拓撲組合 |
| Curriculum | 「任務提案引擎」 | 依據當前能力盲區與環境狀態所驅動的由底向上目標探索器 |
| Composition | 「技能有向無環圖」 | 技能調用其他子技能的複合階層體系；在實體執行時依拓撲排序排程 |
| Iterative refinement | 「自修復學習閉環」 | 將環境反饋、錯誤日誌與自我驗收結果折疊為下次回合的修正脈絡 |
| Action-space-as-code | 「以程式碼為動作空間」 | 模型直接輸出結構化函式程式碼，而非單一基礎指令，用以表達複雜長路徑行為 |
| Dedup on write | 「寫入時技能去重」 | 將語意高度相似的重複技能描述在寫入時自動收斂至單一權威基準版本 |

## Further Reading｜延伸閱讀

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) ——Voyager 奠基權威論文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) ——Skills 作為 2026 年工業級產品落地規範
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) ——Skills 與子 agent 實戰深度指南
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) ——Voyager 底層所仰賴的自我精煉迴圈論文
