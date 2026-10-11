# AlphaEvolve——演化式程式碼編寫 Agent（Evolutionary Coding Agents）

> 將尖端程式碼模型與演化迴圈以及機器可驗證的評估器（machine-checkable evaluator）相結合。讓該迴圈持續運作足夠長的時間。它成功發現了一種僅需 48 次純量乘法的 4x4 複數矩陣乘法演算法——這是 56 年來對 Strassen 演算法的首次突破。它還找到一種適用於 Google 全公司的 Borg 排程啟發式演算法，能在正式環境中回收約 0.7% 的叢集算力。其系統架構刻意設計得相當樸素。這些成果的來源，正是評估器的嚴謹性。

**Type:** Learn
**Languages:** Python (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## The Problem｜問題

大型語言模型可以編寫程式碼。演化演算法可以在程式碼空間中搜尋。這兩者幾十年來都被分別嘗試過；但兩者都碰到了天花板。LLM 的天花板在於虛談幻覺（confabulation）：模型能寫出看似合理但實際上根本無法達到其宣稱效果的程式碼。演化演算法的天花板則在於搜尋成本：對語法做隨機突變，極少能產生可編譯的程式，更遑論表現更好的程式了。

AlphaEvolve（Novikov 等人，DeepMind，arXiv:2506.13131，2025 年 6 月）將兩者結合在一起。LLM 針對程式資料庫提出定向修改；自動評估器為每個變體評分；高分變體則成為未來世代的親代。LLM 負責解決撰寫合理程式碼的高成本步驟；評估器則負責捕捉這些虛談幻覺。這個迴圈可以持續執行數小時乃至數週。

論文報告的成果包括：僅需 48 次純量乘法的 4x4 複數矩陣乘法（Strassen 在 1969 年提出的界限是 49 次）、應用於 Google 正式環境的 Borg 排程啟發式演算法、提升 32.5% 的 FlashAttention 核心（kernel）加速，以及 Gemini 訓練吞吐量的改善。

該架構之所以能發揮作用，是因為其評估器具備機器可驗證性（machine-checkable）。在評估器無法被機器驗證的領域，它就無法運作。這種不對稱性正是本課的核心教訓。

## The Concept｜核心概念

### 演化迴圈機制

1. 從一個正確但非最佳的種子程式 `P_0` 開始。
2. 維護一個變體程式資料庫，每個變體皆由評估器評分。
3. 從資料庫中取樣一個或多個親代（採用 MAP-elites 風格或基於島嶼模型）。
4. prompt LLM（使用 Gemini Flash 處理大量候選變體，使用 Gemini Pro 處理艱難案例）以生成親代程式的修改變體。
5. 在留出（held-out）評估器上編譯、執行並評估該變體。
6. 根據其分數與特徵向量為索引鍵，插入回資料庫中。
7. 重複上述步驟。

有兩個重要細節。首先，prompt LLM 時所提供的資訊遠多於單純的親代程式——通常包含資料庫中的數個頂尖變體、評估器的函式簽章，以及簡短的任務描述。模型的任務是提出可能提升分數的定向修改。第二，資料庫採用結構化設計（MAP-elites 網格、基於島嶼模型），讓迴圈能主動探索多樣性，而不僅僅是局限於當前領先的解法。

### 評估器為何不可妥協

AlphaEvolve 的所有勝利，全部來自於評估器具備快速、確定性且難以作弊的領域：

- **矩陣乘法演算法**：一個能進行矩陣相乘並以位元級精確度檢查相等性的單元測試。
- **Borg 排程啟發式演算法**：一個正式環境等級的模擬器，能重播歷史叢集負載並衡量浪費的算力。
- **FlashAttention 核心**：正確性測試加上在真實硬體上的實際耗時基準測試。
- **Gemini 訓練吞吐量**：測量每一步驟所消耗的 GPU 秒數。

在每個案例中，評估器都能有效捕獲原本會佔主導地位的 LLM 錯誤類型：虛構的正確性宣稱、在硬體上就會消失的效能宣稱，以及邊界條件的失效。若拿掉評估器，演化迴圈所最佳化的將只會是表面漂亮的程式碼。

### 獎勵作弊（Reward Hacking）是同一枚硬幣的另一面

演化只會最佳化評估器所衡量的指標。若評估器存在瑕疵，迴圈必定會找出該瑕疵。在未經驗證的領域中，迴圈最佳化的只會是表面特徵，而非預期的真實行為。DeepMind 在論文中明確指出了這一點：AlphaEvolve 的成功僅能遷移至評估器的嚴謹性足以匹配搜尋野心的領域。

2025-2026 年程式碼搜尋迴圈中獎勵作弊的具體實例：

- 將「完成時間」作為最佳化目標，結果系統學會直接送出空解法以獲得高分獎勵。
- 針對「測試下正確性」給予獎勵的基準測試，導致系統學會死記硬背測試案例並產生過度擬合。
- 某個「程式碼品質」代理指標給予獎勵的結果，是系統直接刪除註解並改寫變數名稱，但語意並未改變。

AlphaEvolve 的解法：交付一個 LLM 從未見過的留出評估器，且測試輸入是在評估時期動態生成的。即使如此，DeepMind 仍建議嚴格審查任何擬部署的方案。

### 為什麼「LLM + 搜尋」勝過單獨任一方

LLM 能產出可編譯且語意合理的修改。若以隨機突變的遺傳演算法處理一個 2000 行的 Python 檔案，幾乎總會產生語法錯誤。LLM 還能將搜尋集中在合理的鄰域內（例如修改特定函式，而非隨機變更位元組），這大幅減少了評估器呼叫的無謂浪費。

相對地，評估器則能揪出 LLM 的虛談幻覺。LLM 常常自信滿滿地宣稱某個函式「在極限下是 O(n log n)」，然而實際跑起來卻是 O(n^2)；實際耗時基準測試能讓爭論一錘定音。

### AlphaEvolve 在尖端技術堆疊中的定位

| 系統 | 生成器 | 評估器 | 領域 | 代表性成果 |
|---|---|---|---|---|
| AlphaEvolve | Gemini | 正確性 + 基準測試 | 演算法、核心、排程器 | 48 次乘法的 4x4 矩陣乘法 |
| FunSearch（DeepMind，2023） | PaLM / Codey | 正確性 | 組合數學 | cap-set 下界 |
| AI Scientist v2（Sakana，L5） | GPT/Claude | LLM 評論 + 實驗 | 機器學習研究 | ICLR workshop 論文 |
| Darwin Godel Machine（L4） | agent 鷹架 | SWE-bench / Polyglot | agent 程式碼 | SWE-bench 從 20% 提升至 50% |

這四者全都是同一套配方的不同變形：生成器加上評估器，形成迴圈。其差異僅在於評估器評分的對象為何，以及其嚴格程度如何。

```figure
alphaevolve-loop
```

## Use It｜實際應用

`code/main.py` 在一個玩具符號迴歸問題上實現了一個最小的類 AlphaEvolve 迴圈。「LLM」是一個標準函式庫的替代常式（proxy），它會對計算目標函式的程式提出微小的語法突變。「評估器」則在留出測試點上衡量均方誤差（MSE）。

觀察焦點：

- 最佳分數如何隨著世代演進逐步提升。
- MAP-elites 網格如何讓多樣化的解法保持存活，從而避免迴圈過早收斂至局部最小值。
- 拿掉留出測試（僅採用訓練評估器）如何導致迴圈產生驚人的過度擬合。

## Ship It｜交付成果

`outputs/skill-evaluator-rigor-audit.md` 是在任何新領域中考慮導入類 AlphaEvolve 迴圈的必備前置條件：你的評估器真的能捕獲你所在意的失效嗎？

## Exercises｜練習

1. 執行 `code/main.py`。記錄最佳分數的演進軌跡。停用留出評估器（加上旗標 `--no-holdout`）並重新執行。量化其過度擬合的程度。

2. 閱讀 AlphaEvolve 論文第 3 節關於 MAP-elites 網格的內容。為一個新問題（例如編譯器最佳化 pass）設計一套特徵向量描述符，使搜尋能保持多樣性。

3. 48 次乘法的 4x4 矩陣相乘結果在 56 年後突破了 Strassen 的 49 次界限。閱讀論文附錄 F，用三句話解釋為何此問題的評估器特別容易做對，以及為何多數領域無法像它一樣。

4. 提出一個 AlphaEvolve 會失效的具體領域。精準指出評估器會在何處崩潰以及背後的原因。

5. 針對你熟悉的領域，寫出你預計採用的評估器函式簽章。請包含 (a) 正確性條件、(b) 效能指標、(c) 留出輸入生成規則、(d) 至少一項防止獎勵作弊的檢查機制。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| AlphaEvolve | 「DeepMind 的演化式程式碼 agent」 | Gemini + 程式資料庫 + 機器可驗證的評估器 |
| MAP-elites | 「保留多樣性的存檔」 | 以特徵向量為索引的網格；每個格子保存具有該描述符的最佳變體 |
| 島嶼模型 | 「並行演化的子族群」 | 彼此獨立的族群，定期互相遷移；可防止過早收斂 |
| 機器可驗證評估器 | 「確定性的判定器」 | 一個 LLM 無法偽造的單元測試、模擬器或基準測試；是此迴圈的前提條件 |
| 獎勵作弊 | 「最佳化的是指標，而非目標」 | 迴圈找到了不執行預期任務、卻能最大化分數的方法 |
| 種子程式 | 「起點」 | 迴圈演化的起始程式，正確但非最佳 |
| 留出評估器 | 「LLM 從未見過的評估資料」 | 在評估時動態生成輸入，以防止死記硬背 |

## Further Reading｜延伸閱讀

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) — 完整論文。
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) — 廠商發布的文章與成果介紹。
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) — 發現的演算法庫，包含 48 次乘法的 4x4 矩陣相乘。
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) — 前身系統研究。
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 將受評估器約束的自主性視為核心研究方向。
