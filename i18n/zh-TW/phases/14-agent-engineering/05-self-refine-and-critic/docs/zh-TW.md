# Self-Refine 與 CRITIC：迭代式產出改進

> Self-Refine（Madaan 等人，2023）利用單一大模型在迴圈中分別扮演三大角色——生成（Generate）、反饋（Feedback）、精煉（Refine），在 7 項基準任務上取得了平均 20 個百分點的絕對提升。CRITIC（Gou 等人，2023）則將反饋驗證步驟導向外部實體工具進行事實錨定。在 2026 年，該模式已作為「評估者—最佳化者（Evaluator-Optimizer）」（Anthropic）或輸出安全護欄迴圈（OpenAI Agents SDK）落地於各大主流框架中。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 掌握 Self-Refine 的三大 prompt 環節（生成、反饋、精煉），並深入理解為何保留歷史軌跡對精煉 prompt 至關重要。
- 理解 CRITIC 的核心洞見：大模型若缺乏外部工具的實體事實錨定（Grounding），在自我驗證事實時極度不可靠。
- 以純 Python 標準函式庫實作一套具備歷史回溯與選用外部驗證器的 Self-Refine 迴圈。
- 將該架構模式精確對映至 Anthropic 的「評估者—最佳化者（Evaluator-Optimizer）」工作流程與 OpenAI Agents SDK 的輸出安全護欄。

## The Problem｜問題

Agent 產出了一份答案，但內容「差強人意」：也許某行程式碼存在語法錯誤；也許摘要文字稍微超出了長度限制；也許執行計畫忽略了某個極端邊界案例。此時你最理想的預期是：讓 agent 自行批判自身的輸出，並主動動手修復它。

Self-Refine 確鑿證明了：單純依靠單一模型、無需任何額外訓練資料、亦無需強化學習，便能完美達成自我修復。然而這裡存在一個致命陷阱：大語言模型在自我驗證艱深的客觀事實時表現極差。CRITIC 精準指出了破局之道——將驗證步驟導向外部實體工具（搜尋引擎、程式碼直譯器、計算機、單元測試執行器）。

這兩篇奠基論文共同確立了 2026 年迭代式改進的通用預設範式：生成 → 驗證（盡可能引入外部工具）→ 精煉修正 → 驗證器通過時停止。

## The Concept｜核心概念

### Self-Refine（Madaan 等人，NeurIPS 2023）

單一大模型，分別扮演三大角色：

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

關鍵架構細節：`refine` 步驟必須能完整檢視完整的歷史脈絡——包含先前所有的產出與批判反思——以確保其絕不重蹈覆轍。論文進行了嚴格的消融實驗（Ablation）：一旦拿掉歷史脈絡，最終品質便會呈現懸崖式暴跌。

核心戰報：在涵蓋數學、程式碼、縮寫詞與對話等 7 項任務中（包含 GPT-4），平均取得了高達 20 個百分點的絕對表現提升。全流程無需任何 fine-tuning、無外部工具相依，純靠單一模型自力更生。

### CRITIC（Gou 等人，arXiv:2305.11738，v4 2024 年 2 月）

Self-Refine 的天花板在於：反饋環節本質上依然是大模型在給自己「批改作業」。面對嚴肅的客觀事實陳述時，這種機制極易失靈（大模型所產生的幻覺，在它自己看來往往顯得無比可信且合乎邏輯）。CRITIC 將純模型的 `feedback(task, output)` 替換為 `verify(task, output, tools)`，其中 `tools` 包含：

- 用於核實客觀事實陳述的搜尋引擎；
- 用於檢驗程式碼執行正確性的程式碼直譯器；
- 用於核算算術公式的計算機；
- 特定領域專屬驗證工具（單元測試、型別檢查器、靜態分析 Linter）。

驗證器輸出錨定於實體工具回傳結果的結構化批判。隨後，精煉器在該客觀批判的指引下發起二次修正。

核心結論：在事實性任務上，CRITIC 徹底碾壓了純 Self-Refine，因為其批判錨定於客觀事實。而在缺乏外部驗證器的開放性任務上（創意寫作、格式排版），CRITIC 則平滑退化為常規的 Self-Refine。

### 終止條件（Stop Condition）

兩類常見形態：

1. **驗證器全數通過**：外部實體測試回報完全成功。只要環境具備條件（單元測試、型別檢查、護欄斷言），這始終是首選。
2. **未提出任何反饋**：模型表示「產出結果已無任何問題」。成本低廉但偶爾不可靠；必須強制搭配最大迭代次數上限。

2026 年的複合最佳實踐：雙重保險。「若驗證器通過，或模型表示無問題且迭代次數 >= 2，或達到最大迭代次數上限時終止。」

### 評估者—最佳化者（Anthropic, 2024）

Anthropic 於 2024 年 12 月將此模式定名為五大核心工作流程模式之一。包含兩大實體角色：

- Evaluator（評估者）：對產出進行評分並輸出批判建議。
- Optimizer（最佳化者）：依據該批判建議重新修改輸出。

兩者交替迴圈直到評估者批准通過。這正是 Anthropic 語境下的 Self-Refine / CRITIC 架構。Anthropic 特別補充了一項關鍵工程細節：評估者與最佳化者的 prompt 風格必須具備實質結構差異，防止模型陷入「自己審查自己」的橡皮圖章盲目放行陷阱。

### OpenAI Agents SDK 輸出安全護欄

OpenAI Agents SDK 將該模式封裝為「輸出安全護欄（Output Guardrails）」。護欄本質上是在 agent 產出最終結果後立即執行的獨立校驗器。若觸發護欄警報（拋出 `OutputGuardrailTripwireTriggered`），該輸出將被果斷拒絕，且 agent 獲准發起重試。護欄既能呼叫外部工具（CRITIC 風格），亦能由純函式邏輯構成（Self-Refine 風格）。

### 2026 年常見架構陷阱

- **橡皮圖章形式主義閉環（Rubber-stamp loops）**：當完全相同的模型使用雷同的 prompt 風格同時負責生成與審查時，系統極易迅速收斂至「我看沒問題」的盲目自信中。解法：採用結構截然不同的 prompt，或引入獨立的輕量模型負責挑刺。
- **過度精煉（Over-refinement）**：每次精煉迭代皆會顯著拉長響應延遲並消耗 Token。通常規劃 1 至 3 次迭代為上限；若仍未達標，應果斷升級交由人工介入審查。
- **在瑣碎任務上盲目濫用 CRITIC**：若特定任務根本不存在可用的外部實體驗證器，CRITIC 會直接退化為 Self-Refine；切勿為了一個空殼 stub 驗證器白白浪費無謂的網路延遲。

```figure
self-refine
```

## Build It｜動手實作

`code/main.py` 在一個具體任務上實作了 Self-Refine 與 CRITIC：給定主題產出一份精簡的列點清單。驗證器負責檢查格式規範（剛好 3 個項目，每項長度在 60 字元以內）。CRITIC 進一步追加了外部的「事實查核器」，能精準處罰已知的幻覺內容。

核心元件：

- `generate`：腳本化的初稿生產者。
- `feedback`：LLM 風格的自我批判模組。
- `verify_external`：CRITIC 風格的事實錨定驗證器。
- `refine`：依據累積歷史脈絡重新編寫輸出的精煉模組。
- 終止條件：驗證器通過或達到最大 4 次迭代上限。

運行實驗：

```
python3 code/main.py
```

對比純 Self-Refine 與 CRITIC 的執行軌跡。CRITIC 精準捕獲了一處純 Self-Refine 所遺漏的客觀事實錯誤，因為外部驗證器具備自我批判器所欠缺的實體事實錨定依據。

## Use It｜實際應用

Anthropic 的 Evaluator-Optimizer 正是此模式在 Claude 語境下的具象化表達。OpenAI Agents SDK 的輸出安全護欄採用 CRITIC 形態（護欄內部支援呼叫外部工具）。LangGraph 內建了宛如 Self-Refine 的反思節點模式。Google 的 Gemini 2.5 Computer Use 則為每一步操作引入了即時安全評估器，這正是 CRITIC 的另一項變體：每項動作在正式確認生效前皆必須通過實體驗證。

## Ship It｜交付成果

`outputs/skill-refine-loop.md` 能在給定任務特徵、驗證器可用性與迭代預算的前提下，自動配置一套評估者—最佳化者迴圈。產出生成器、評估／驗證器與最佳化者的專屬 prompts，以及健全的終止條件策略。

## Exercises｜練習

1. 在 max_iterations=1 的單次迭代限制下運行該程式。CRITIC 是否依然能發揮實質效益？
2. 將外部驗證器替換為充斥雜訊的評分器（隨機產生 30% 的偽陽性誤判）。迴圈會如何應對？這正是 2026 年絕大多數生產級護欄技術堆疊所面臨的真實挑戰。
3. 實作「異構模型生成與批判」變體：由超大型模型負責初稿生成，由輕量小模型負責挑刺批判。該組合是否能戰勝完全相同的單一模型架構？
4. 研讀 CRITIC 論文第 3 節（arXiv:2305.11738 v4）。指出其定義的三大驗證工具類別，並為每類各舉出一個實用範例。
5. 將 OpenAI Agents SDK 的 `output_guardrails` 機制精確對映至 CRITIC 的驗證器角色。分析該 SDK 在哪些架構設計上做對了，而在哪些限制上仍有不足？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Self-Refine | 「模型自我修復」 | 單一模型內部閉環：生成 → 反饋 → 精煉，嚴格保留累積歷史脈絡 |
| CRITIC | 「工具錨定驗證」 | 將反饋環節替換為外部實體工具（搜尋、程式碼執行、計算機、測試套件） |
| Evaluator-Optimizer | 「評估者—最佳化者」 | Anthropic 提出的架構模式：評估者評分，最佳化者依建議修改，迭代至收斂 |
| Output guardrail | 「事後合規護欄」 | OpenAI Agents SDK 於 agent 產出結果後立即執行的獨立驗證卡點 |
| Verify step | 「實體驗收環節」 | 決定最終品質的關鍵邊界：究竟是主觀自評還是客觀實體工具錨定 |
| Refine history | 「模型先前的嘗試歷史」 | 附加於精煉 prompt 前端的前次輸出與批判；遺失歷史會導致品質暴跌 |
| Rubber-stamp loop | 「形式主義盲目放行」 | 生成與審核風格雷同導致系統快速收斂至「我看沒問題」的嚴重架構失效 |
| Stop condition | 「收斂終止條件」 | 驗證器通過、或無進一步反饋且達到迭代上限；絕不採用單一脆弱條件 |

## Further Reading｜延伸閱讀

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) ——Self-Refine 奠基經典論文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) ——引入外部工具事實錨定的 CRITIC 論文
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——評估者—最佳化者（Evaluator-Optimizer）架構指南
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) ——將輸出安全護欄作為 CRITIC 形態驗證器的官方說明
