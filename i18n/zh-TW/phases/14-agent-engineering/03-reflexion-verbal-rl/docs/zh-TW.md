# Reflexion：語言強化學習

> 基於梯度的傳統強化學習需要成千上萬次的試驗與龐大的 GPU 算力叢集才能修正單一失效模式。Reflexion（Shinn 等人，NeurIPS 2023）則完全在自然語言維度實現強化：在每次試驗失敗後，agent 自主撰寫一段反思總結、存入情節記憶中，並將該記憶作為下一次試驗的前置脈絡條件。這正是 Letta 睡眠期運算、Claude Code 的 CLAUDE.md 經驗沉澱，以及各類專業工作流程中學習規則的底層架構原型。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出 Reflexion 的三大核心元件——Actor（執行者）、Evaluator（評估器）、Self-Reflector（自我反思器），以及情節記憶（Episodic memory）的關鍵定位。
- 以純 Python 標準函式庫實作一套包含二元評估器、反思快取緩衝區與全新重試機制的 Reflexion 迴圈。
- 針對具體的工程任務，在純量（Scalar）、啟發式（Heuristic）與模型自評（Self-evaluated）三種反饋來源間做出正確選型。
- 深入闡明為何語言強化學習能即時捕獲並修復傳統梯度 RL 需要數千次試驗才能解決的認知錯誤。

## The Problem｜問題

當 agent 執行某項任務遭遇失敗時，在傳統強化學習框架下，你需要啟動數千次額外試驗、計算損失梯度、更新模型權重。這極度昂貴、緩慢，且絕大多數正式環境的生產級 agent 根本不具備為每次偶發失敗動用模型重新訓練的預算。

Reflexion（Shinn 等人，arXiv:2303.11366）提出了一個顛覆性的反向思考：如果讓 agent 自己在腦海中復盤反思為何會失敗，並將這份思考注入下一次重試的 prompt 中呢？完全無需更新模型權重。不涉及任何反向傳播梯度。純粹依賴在試驗回合之間持久化儲存的自然語言。

結果令人震撼：在 ALFWorld 上，它全面超越了 ReAct 與其他未經 fine-tuning 的基準模型；在 HotpotQA 上顯著優於純 ReAct；在程式碼生成任務（HumanEval/MBPP）上更創下了當時的最佳紀錄（SOTA）。而這一切，完全未更新任何一個梯度參數！

## The Concept｜核心概念

### 三大核心元件

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

外加一個核心資料結構：

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

單次試驗由 Actor 執行 ReAct 迴圈。Evaluator 對產出的執行軌跡進行評分。若分數偏低，Self-Reflector 便產出一段自然語言反思文字（例如：「我選錯了工具，因為我將題目誤讀為詢問 X，但實際上是在詢問 Y」）。該反思隨後被存入情節記憶中。下一次試驗從全新的乾淨狀態重新開始，但在 prompt 最前端清晰出示了先前的失敗反思。

### 三類評估器架構

1. **純量評估器（Scalar）**：來自外部的二元明確信號。例如 ALFWorld 任務成功或失敗；HumanEval 單元測試全數通過或未通過。這是最簡潔、信號雜訊比最高的型別。
2. **啟發式評估器（Heuristic）**：預先定義的失效特徵規則。例如「若 agent 連續兩次產生完全相同的動作，標記為卡死」；「若執行軌跡超過 50 步，標記為效率低下」。
3. **模型自評估器（Self-evaluated）**：由 LLM 對自身軌跡進行自我審查評分。適用於缺乏客觀標準答案（Ground Truth）的開放性場景。信號相對較弱，通常與工具實體驗證相結合（詳見第 5 課——CRITIC）。

2026 年的主流最佳實踐是混合體系：有客觀標準時優先採用純量信號，缺乏時退化為模型自評，並始終以啟發式規則作為安全護欄。

### 為何此模式能廣泛泛化

Reflexion 與其說是一項全新演算法，不如說是一種被明確定義的通用架構範式。幾乎所有現代生產級「自我修復（Self-healing）」agent 皆在運行該模式的某種衍生變體：

- Letta 的睡眠期運算（Sleep-time compute，第 8 課）：獨立的後台 agent 在閒暇時復盤過往對話，並將教訓寫入記憶區塊。
- Claude Code 的 `CLAUDE.md` / 「save memory」模式：將失敗反思提煉為經驗沉澱，在未來的對話階段作業中自動前置加載。
- 專業工作流程的 `/learn-rule` 指令：將使用者的糾正即時轉化為明確的規則約束。
- LangGraph 的反思節點（Reflection nodes）：專門評估輸出品質並在需要時將流程導向修正節點。

所有這些實踐皆源於同一個核心洞見：**自然語言本身就具備足夠豐富的表現力，足以在不同次執行之間完美承載「我從失敗中學到了什麼」**。

### 適用邊界與失效情境

Reflexion 在以下情境表現優異：

- 存在清晰明確的失敗信號（測試不通過、工具報錯、答案明顯錯誤）；
- 任務類別具備可重現性（相同的問題類型會被重複提出）；
- 該反思對後續軌跡具備實質改善空間（具備足夠的後續操作預算）。

而在以下情境 Reflexion 毫無幫助：

- Agent 初次嘗試就已經成功；
- 失敗源自外部不可抗力（網路中斷、工具服務當機）——對「網路斷線」的反思對未來執行毫無意義；
- 反思演變為盲目迷信——將某次偶發的隨機波動錯誤歸納為固定敘事。

2026 年的典型維運陷阱：**記憶腐化（Memory rot）**。歷史反思不斷堆疊積累；部分經驗已經過時甚至有害；隨著情節緩衝區不斷膨脹，重試成本與延遲急遽飆升。應對之道：定期實施記憶壓縮（第 6 課）、為反思設定存活時間（TTL），或調度專門的後台清理 agent。

```figure
react-trace
```

## Build It｜動手實作

`code/main.py` 在一個益智數值拼圖上實作了 Reflexion 閉環：產出一個總和等於目標值的 3 元素整數串列。Actor 提出候選串列；Evaluator 驗算總和；Self-Reflector 撰寫一行失敗診斷分析。反思隨後存入情節記憶供下一次試驗參考。

核心元件：

- `Actor`：在看到反思時能動態調整行為的策略模組。
- `Evaluator.binary()`：針對目標總和的通過／失敗二元裁決。
- `SelfReflector`：產出一行簡明的失敗診斷。
- `EpisodicMemory`：具備容量上限與 TTL 淘汰機制的記憶緩衝區。

運行實驗：

```
python3 code/main.py
```

輸出會完整展示三次試驗軌跡：試驗 1 失敗並儲存反思；試驗 2 讀取該反思後調整了猜測、有所改善但仍未完全命中；試驗 3 結合累積反思一舉成功。將其與缺乏反思的 Baseline 基準對比——Baseline 會在試驗 1 的錯誤答案上原地打轉。

## Use It｜實際應用

LangGraph 將反思實作為標準的節點圖模式。Claude Code 的 `/memory` 指令與 pro-workflow 的 `/learn-rule` 將情節記憶外部化儲存為 Markdown 文件。Letta 的睡眠期運算在系統閒置時非同步運行 Self-Reflector，確保主線 agent 的即時回應速度不受影響。OpenAI Agents SDK 雖未直接內建 Reflexion，但你可以透過自訂 Guardrail（依評分拒絕不良軌跡）搭配跨執行階段作業持久化的記憶體 `Session` 輕鬆組裝出該模式。

## Ship It｜交付成果

`outputs/skill-reflexion-buffer.md` 專門建立並維護具備反思捕獲、TTL 淘汰與語意去重能力的情節記憶緩衝區。給定任務類別與失敗現象，它能自動產出真正對下一次試驗具備實質指導意義的高品質反思（絕非空洞的「請更加謹慎」）。

## Exercises｜練習

1. 將二元評估器改為回傳數值距離（與目標值相差多少）的純量評估器。收斂速度是否顯著加快？
2. 為反思設定 10 次試驗的 TTL 有效期。超過該時間點後，舊反思對系統究竟是有益還是有害？
3. 實作啟發式評估器：若連續兩次回合重複相同動作，判定為卡死。該機制如何與 Self-Reflector 協同互動？
4. 設計一個故意無視反思的對抗性 Actor。需要對反思 prompt 進行何種最小改寫，方能強制 Actor 關注該反思？
5. 研讀 Reflexion 論文第 4 節關於 ALFWorld 的實驗。在觀念上推演其 130% 的成功率提升：相較於原始 ReAct，最關鍵的核心架構差異為何？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Reflexion | 「自我糾錯機制」 | Shinn 等人 2023 年提出——Actor、Evaluator、Self-Reflector 結合情節記憶的閉環 |
| Verbal reinforcement | 「無梯度學習」 | 將自然語言反思前置於下一次試驗的 prompt 中進行認知引導 |
| Episodic memory | 「任務專屬反思記憶」 | 為特定任務類別維護的有界限歷史反思快取緩衝區 |
| Scalar evaluator | 「二元成功信號」 | 依據客觀標準答案所產出的通過／失敗或數值評分 |
| Heuristic evaluator | 「特徵規則檢測器」 | 基於預定義失效特徵（如卡死死迴圈、步驟超限）的規則檢驗器 |
| Self-evaluator | 「模型自審自評」 | 缺乏客觀標準時由 LLM 對自身軌跡評分——需搭配工具實體驗證以防幻覺 |
| Memory rot | 「過期記憶腐化」 | 情節緩衝區堆滿了過時或錯誤的反思；透過壓縮與 TTL 淘汰治理 |
| Sleep-time reflection | 「非同步後台復盤」 | 脫離即時呼叫路徑在系統閒暇時非同步運行反思，確保主線維持低延遲 |

## Further Reading｜延伸閱讀

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) ——Reflexion 奠基論文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) ——正式環境非同步反思架構深度解析
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) ——將情節記憶作為上下文脈絡工程的一環進行管理
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) ——反思節點模式實務手冊
