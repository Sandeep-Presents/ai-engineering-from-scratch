# Tree of Thoughts 與 LATS：審慎搜尋架構

> 單一思維鏈（Chain-of-Thought）軌跡完全沒有回溯（Backtrack）的餘地。ToT（Yao 等人，2023）將推論過程轉化為一棵樹，並在每個節點上引入自我評估。LATS（Zhou 等人，2024）則在蒙地卡羅樹搜尋（MCTS）框架下，將 ToT、ReAct 與 Reflexion 完美統一起來。在 24 點遊戲中，準確率從 CoT 的 4% 飆升至 ToT 的 74%；而 LATS 在 HumanEval 上更取得了 92.7% 的 pass@1 頂尖表現。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 將推論過程抽象為搜尋問題：節點代表「思維（Thoughts）」、邊代表「擴展（Expansions）」、評估值代表「潛力前瞻性」。
- 以純 Python 標準函式庫實作一套具備自我評估評分機制的 ToT 風格廣度優先搜尋（BFS）思維樹。
- 擴充實作極簡的 LATS MCTS 迴圈，完整涵蓋選擇（Select）、擴展（Expand）、模擬（Simulate）與反向傳播（Backpropagate）四大階段。
- 準確決策何時值得付出昂貴的 Token 乘數代價啟用搜尋（如 24 點數學難題、複雜程式碼生成），何時單次線性軌跡已足以勝任（一般問答）。

## The Problem｜問題

思維鏈（Chain-of-Thought）本質上是一條單向線性的漫步。若第一步邁錯了方向，後續的每一步皆建立在崩潰的前提假設之上。在經典的 24 點遊戲中（利用四個數字與加減乘除計算出 24），GPT-4 使用常規 CoT 僅能取得 4% 的極低準確率。模型往往過早選中了錯誤的子運算式，隨後陷入死胡同無法自拔。

大模型推論真正需要的是：主動提出多個候選步驟、進行客觀評估、挑選最有前景的路徑，並在遭遇死胡同時果斷回溯。這正是「搜尋（Search）」的核心本質。Tree of Thoughts 與 LATS 正是該領域最權威的兩大經典架構。

## The Concept｜核心概念

### Tree of Thoughts（Yao 等人，NeurIPS 2023）

樹上的每個節點皆代表一個連貫的中繼推論步驟（即「一個思維」）。每個節點可進一步擴展出 K 個子思維節點。LLM 透過專門的評分 prompt 對每個節點進行自我評估。搜尋演算法（如廣度優先 BFS、深度優先 DFS 或束搜尋 Beam Search）在樹狀空間中系統性探索。

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

自我評估是該架構的核心支柱。論文展示了三種評分變體：`sure / likely / impossible` 三元分類評定、`1..10` 數值評分，以及在多個候選節點之間投票表決。這三種機制在 24 點遊戲中皆顯著超越了常規 CoT（GPT-4 準確率從 4% 躍升至 74%）。

### LATS（Zhou 等人，ICML 2024）

LATS 在蒙地卡羅樹搜尋（MCTS）體系下，將 ToT、ReAct 與 Reflexion 融為一體。LLM 在其中扮演三大角色：

- **策略網路（Policy）**：主動提出候選的下一步動作（ReAct 風格）。
- **價值函數（Value function）**：對局部軌跡進行評分（ToT 風格的自我評估）。
- **自我反思器（Self-reflector）**：遭遇失敗時，撰寫自然語言反思總結（Reflexion 風格），並用以引導後續的推演擴展。

真實環境的反饋（觀察結果）會即時融入價值函數中，使樹搜尋能建立在真實工具執行的客觀事實之上，而非純粹依賴大模型的主觀揣測。論文發表時的實測成果：GPT-4 在 HumanEval 上的 pass@1 達到 92.7%（創下當時 SOTA）；GPT-3.5 在 WebShop 上取得 75.9 的平均分（逼近基於梯度的 fine-tuning 表現）。

### 極簡 MCTS 四步法

每次迭代依序包含四個階段：

1. **選擇（Select）**：利用 UCT 演算法（樹的上信賴區間公式）自根節點向下漫步至葉節點。
2. **擴展（Expand）**：利用策略網路產出 K 個子節點。
3. **模擬（Simulate）**：自某個子節點出發利用策略網路向下推演，並利用價值函數（或外部環境獎勵）對葉節點評分。
4. **反向傳播（Backpropagate）**：沿著存取路徑向上更新所有祖先節點的拜訪次數與估計價值。

UCT 公式：`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第一項代表利用（Exploitation）；第二項代表探索（Exploration）。依任務特性調整平衡係數 `c`。

### 殘酷的 Token 成本現實

搜尋會引發 Token 消耗量指數級爆炸。在 24 點遊戲中，ToT 消耗的 Token 量是 CoT 的 100 到 1000 倍。LATS 亦然。這絕非免費的午餐；嚴格僅將搜尋保留用於：

- 單一線性軌跡顯然無法勝任的極限任務（如 24 點難題、複雜演算法程式碼編寫）；
- 正確性權重大於實體耗時的任務；
- 具備低成本且可靠之價值函數的任務（如程式碼單元測試、具備明確目標值的數學題目）。

若你的任務本身具備單一標準答案但評估器充斥大量雜訊，引入樹搜尋往往會適得其反——它會高效率地找尋出一個「得分看似極高」的錯誤荒謬答案。

### 2026 年的業界定位

大多數正式環境的生產級 agent 並不運行完整的 LATS。它們通常採用結合工具實體驗證的 ReAct 迴圈（如 CRITIC，詳見第 5 課）。樹搜尋主要出現在專門的深水區利基場景中：

- 以單元測試執行結果作為價值函數的程式碼撰寫 agent（HumanEval 形態）；
- 探索多條並行查詢路徑的深度研究（Deep Research）agent；
- LangGraph 子圖內部的高度重度規劃工作流程。

AlphaEvolve（第 11 課）是 2025 年的極致代表：針對程式碼進行演化搜尋、具備機器可驗證的適應度評估，並取得了突破前沿的重大成果（打破了 56 年未曾突破的 4x4 矩陣乘法效率紀錄）。

```figure
tree-of-thoughts
```

## Build It｜動手實作

`code/main.py` 以純標準函式庫實作了以下核心架構：

- 針對特定「挑選算術運算子」任務的輕量 ToT BFS 搜尋器；
- 針對相同任務、具備 UCT 選擇機制的極簡 LATS MCTS 迴圈（包含 Select / Expand / Simulate / Backpropagate）；
- 同時結合符號規則評分與自我評估評分的價值函數。

運行實驗：

```
python3 code/main.py
```

輸出會清晰對比：ToT 透過 BFS 在每個節點平鋪擴展三個候選路徑；而 LATS 則透過 MCTS 演算法逐步收斂聚焦至最優推演路徑。兩者皆會印出詳細的 Token 消耗統計。

## Use It｜實際應用

LangGraph 將 ToT 風格的探索實作為標準子圖範式；LangChain 團隊於 2024 年 5 月發布的 LATS 專題教學是權威參考指南。LlamaIndex 亦內建了 `TreeOfThoughts` agent。在絕大多數 2026 年的生產系統中，該模式通常隱藏於 `if task_complexity > threshold: use_search()` 條件門檻之後——詳見第 5 課中的「評估者—最佳化者（Evaluator-Optimizer）」架構。

## Ship It｜交付成果

`outputs/skill-search-policy.md` 能在給定任務特徵、運算預算與評估器精確度的前提下，自動在線性 ReAct、ToT、LATS 與演化搜尋之間完成架構選型。

## Exercises｜練習

1. 調整極簡 LATS 中的 UCT 參數：對比 c=0.1 與 c=2.0。執行軌跡產生了何種本質變化？
2. 將價值函數替換為帶有更多雜訊的評分器（人為加入隨機抖動）。MCTS 是否依然能找到最優葉節點？它所能容忍的最低信噪比門檻為何？
3. 實作束搜尋（Beam-search）ToT（在每個層級僅保留 Top-k 個最優節點）並與全廣度 BFS 進行對照。在嚴格受限的 Token 預算下，哪種策略更勝一籌？
4. 研讀 LATS 論文第 5.1 節。推導 HumanEval 的軌跡數量：需要執行多少次模擬推演才能達到論文回報的 pass@1 水準？
5. 研讀 LATS 論文中關於「LATS 在何種情境下收效甚微」的章節。撰寫一段決策規則，將任務特徵精準對映至合適的搜尋策略。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Tree of Thoughts | 「思維樹」 | Yao 等人提出——具備自我評估機制的思維節點樹狀探索結構 |
| LATS | 「大模型版 MCTS」 | Zhou 等人提出——在 MCTS 框架下統籌 ToT、ReAct 與 Reflexion 的綜合架構 |
| UCT | 「樹之上信賴區間」 | 在節點選擇階段平衡「利用（Q 數值）」與「探索（ln N / n）」的數學公式 |
| Value function | 「當前狀態有多好」 | 經 prompt 引導的 LLM 評分或環境客觀獎勵；反向傳播更新的數值來源 |
| Policy | 「動作提案器」 | ReAct 風格的生成器；負責產出候選的下一步思維或具體行動 |
| Rollout | 「模擬推演軌跡」 | 自特定節點出發利用策略網路漫步至葉節點，並利用價值函數進行結算評分 |
| Backpropagate | 「反向更新祖先節點」 | 將葉節點結算的獎勵數值沿路徑向上回傳，同步更新拜訪計數與 Q 數值 |
| Search cost | 「Token 消耗爆炸」 | 在 24 點遊戲中消耗高達 CoT 的 100 到 1000 倍；採用前必須進行嚴格預算評估 |

## Further Reading｜延伸閱讀

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) ——ToT 奠基論文
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) ——融入 Reflexion 反思反饋的 MCTS 樹搜尋論文
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——搜尋子圖架構模式
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) ——結合程式化評估器的演化搜尋論文
