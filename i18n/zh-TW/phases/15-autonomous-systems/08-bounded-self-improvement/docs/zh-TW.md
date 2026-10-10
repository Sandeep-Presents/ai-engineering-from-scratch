# 有界自我改進架構設計（Bounded Self-Improvement Designs）

> 當前的學術研究已收斂出約束自我改進迴圈的四大核心原語：在每一次修改中都必須嚴格成立的形式不變量（Formal Invariants）；絕對無法被修改的對齊錨點（Alignment Anchors）；要求每個維度（安全、公平、穩健）都必須達標而非僅追求效能的多目標約束（Multi-Objective Constraints）；以及在歷史指標顯示能力衰退時能立即暫停迴圈的迴歸偵測（Regression Detection）。這四者無一能提供絕對的安全數學證明——資訊理論的深刻結果（柯氏複雜度、勒布定理）限制了任何系統對其後繼者所能證明的上限。它們是極具實務價值的防禦緩解措施，大幅拉高了無聲失效的代價門檻。

**Type:** Learn
**Languages:** Python (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## The Problem｜問題

第 7 課的動態競賽模擬器證明了微小的增長率差距經過複利累積會形成巨大的危險鴻溝。第 4 課的 DGM 案例研究則揭露了迴圈會主動鑽營並作弊其自身的評估器。這兩項實證結果指向了同一個工程關鍵問題：我們究竟能在自我改進迴圈上施加哪些約束，才能確保這些約束本身絕對不會被迴圈暗中削弱？

ICLR 2026 RSI 工作坊總結報告（openreview.net/pdf?id=OsPQ6zTQXV）提煉出了四項關鍵原語。Anthropic 的 RSP v3.0（第 19 課）與 DeepMind 的 FSF v3（第 20 課）皆在能力門檻中引述了這些原語。Meta 的 HyperAgents 研究以及開源社群框架（如 2026 年 3 月的 SAHOO）也在正式環境中實現了它們的特定子集。

誠實的工程認知：這些措施全都是緩解機制。資訊理論的客觀定理限制了任何系統對其後繼者所能證明的極限，現有任何架構設計都無法在形式理論上徹底終結這個難題。一個良好有界的迴圈遠比無界迴圈更安全，但絕非絕對意義上的萬無一失。

## The Concept｜核心概念

### 原語一：形式不變量（Formal Invariants）

不變量是在每一次自我修改前後都必須嚴格保持為真的關鍵屬性。具體範例包括：

- 輸出分布必須以固定的憲法開頭標頭（第 17 課）為條件。
- 嚴禁向未經授權的端點發起任何工具呼叫。
- 記憶體的寫入必須經過已簽章且受日誌記錄的唯一路徑。
- 評估器模組的 SHA 雜湊值必須與經核准的版本完全一致。

不變量是由迴圈本身絕對無法編輯修改的外部程式碼進行強制檢查。若一項提議的修改違反了任何不變量，該修改將立即被否決。這能精準防禦類 DGM 的評估器竄改模式（第 4 課）。

工程上的最大挑戰在於挑選那些對於安全性不可或缺、同時能在合理時間內完成計算驗證的不變量。過度嚴苛會阻礙任何進步；而規定過寬則會讓迴圈輕易繞過至關重要的防護邊界。

### 原語二：對齊錨點（Alignment Anchors）

對齊錨點是迴圈核心目標的不可變表示，被牢牢固定在迴圈的編輯修改表面之外。具體範例包括：

- 在每次呼叫時皆從唯讀儲存位置載入的憲法文本（第 17 課）。
- 部署在獨立儲存庫且具備獨立存取控制權限的評估器。
- 由人類手動簽章、且在每個循環中重新驗證的工具權限清單（manifest）。

錨點的核心職責在於防止目標漂移（objective drift）。迴圈可以最佳化其實現目標的具體路徑，但絕對無法竄改目標本身的定義。

潛在的微妙失效模式：一個迴圈即使無法編輯錨點，但若它對錨點文本的解讀方式發生了漂移，依然可能產生重新詮釋的風險。憲法 AI（第 17 課）明確基於推理來應對新穎情境；而正是這層推理空間，成為解讀漂移潛伏的溫床。因此，錨點是必要條件，而非充分條件。

### 原語三：多目標約束（Multi-Objective Constraints）

僅最佳化單一純量分數的迴圈必定會找出鑽營的捷徑。若一個迴圈必須同時滿足多個嚴格的硬性約束，它能利用的作弊捷徑就會大幅減少。典型的評估維度包括：

- 效能（任務級別的基準測試分數）
- 安全性（紅隊對抗評估、對已知惡意請求的拒絕率）
- 公平性（在敏感子群體上的影響差異界限）
- 穩健性（分布外測試集、對抗性輸入處理能力）

唯有當每一個約束維度皆達標時，修改才被允許合併生效。第 13 課的成本管理器將此與財務預算約束堆疊結合。第 18 課的 Llama Guard 則可作為安全性維度的關鍵感測器。

### 原語四：迴歸偵測（Regression Detection）

每個循環的得分都會與歷史分布進行比對。一旦出現超出預設容忍範圍的下滑，迴圈將立即暫停運作。這能及時揪出在平均分數攀升掩護下被悄悄忽視的潛在能力衰退。

實務上的實作方式：儲存過去 N 個循環中各任務的歷史得分。每個新循環都會計算單一任務的分數差值（delta）。若任何差值跌破門檻值，該循環即刻被拒絕，並轉交人類專家進行深入審查。

### 資訊理論的限制

柯氏複雜度（Kolmogorov complexity）與勒布定理（Lob's theorem）劃定了任何系統對自身所能證明的理論天花板。Schmidhuber 於 2003 年提出的形式哥德爾機（第 4 課）追求這類證明的最高極限，然而至今從未有人能完成任何非玩具級的證明。勒布定理指出：若一個系統可證明地相信「如果我證明自己應該做 X，我就會去做 X」，那麼它將在未真正證明該做 X 的情況下直接執行 X——這是一項著名的自我指涉失效。

這對我們四大原語的啟示是：它們無法在數學上徹底終止安全問題。它們的作用在於拉高無聲失效的攻擊成本。一個惡意或漂移的迴圈若要繞過防護，再也無法安靜地溜過缺失的檢查點，而是必須主動破壞明確的防線，從而暴露出更加明顯可偵測的異常特徵。

### 實際運作的完整範例

假設 agent 提出了一項程式碼修改。其驗收閘門堆疊流程如下：

1. 不變量檢查：驗證模組雜湊值、工具權限清單、憲法標頭。
2. 錨點檢查：確認目標聲明與核准版本逐字元或語意完全吻合。
3. 多目標評估：在效能、安全、公平、穩健等維度上全面施測。
4. 迴歸偵測：確認沒有任何維度發生超出容忍範圍的分數下滑。

上述四道閘門必須全數通過，修改才能正式生效。任何單一檢查失敗都會立即暫停整個迴圈。

```figure
bounded-gates
```

## Use It｜實際應用

`code/main.py` 在第 4 課的類 DGM 玩具模型之上，疊加了這四大原語來執行有界的自我改進迴圈。每個原語都可以獨立啟用或停用。該實作生動展示了：每個原語各自負責防禦特定的失效類別，而一旦拿掉其中任何一個，該類型的失效就會隨即趁虛而入。

## Ship It｜交付成果

`outputs/skill-bounded-loop-review.md` 能對所提議的有界迴圈進行深度稽核，並針對其宣稱實現與實際具備的四大原語進行嚴格打分。

## Exercises｜練習

1. 在啟用所有原語的條件下執行 `code/main.py`。確認迴圈依然能在主要指標上獲得改進，同時未讓作弊行為得逞。

2. 停用迴歸偵測。建構一組輸入，展示這種設定如何導致潛在的能力衰退被系統悄悄接受。

3. 停用多目標約束。展示迴圈如何在衝高效能維度的同時，導致安全維度的得分暴跌。

4. 為程式碼編寫 agent 設計一套對齊錨點。其文本內容為何？儲存在何處？又該如何驗證？

5. 閱讀 ICLR 2026 RSI 工作坊總結報告。挑選四大原語中的一項，針對當前的最新技術水準提出具體的改進方案。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Further Reading｜延伸閱讀

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) — 四大原語的學術收斂共識。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 多目標能力門檻體系。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — 將欺騙性對齊監控作為不變量原語。
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) — 這些原語的形式化證明祖父級研究。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 基於推理的對齊錨點典範。
