# AI Scientist v2——工作坊等級的自主科學研究（AI Scientist v2 — Workshop-Level Autonomous Research）

> Sakana 推出的 AI Scientist v2（Yamada 等人，arXiv:2504.08066）能夠執行完整的科研閉環：提出假說、編寫程式碼、進行實驗、繪製圖表、撰寫論文並完成投稿。它是第一個讓全自動生成論文在 ICLR 2025 工作坊通過同行評審的系統。然而，獨立第三方評估（Beel 等人）指出，有 42% 的實驗因為程式碼錯誤而崩潰，且文獻回顧步驟頻繁將既有成熟概念誤標為原創新穎。Sakana 自身的官方文件也警告：該程式碼庫會直接執行由 LLM 編寫的程式碼，強烈建議使用 Docker 進行沙盒隔離。這兩幅並存的圖景，正是本課所要探討的核心焦點。

**Type:** Learn
**Languages:** Python (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## The Problem｜問題

科學研究是一項極度開放且非結構化的任務。不同於 AlphaEvolve 的演算法搜尋或 DGM 受基準測試約束的自我修改，研究成果並沒有機器可判讀的客觀正確性準則。一篇學術論文是由審稿人而非單元測試來評判的。這使得研究閉環更加難以閉合——但若一旦閉合，其價值也更加驚人，因為科學研究正是指數級複合進步的源頭。

AI Scientist v1（Sakana，2024 年）透過依賴人類預先撰寫的樣板來閉合迴圈。LLM 僅在固定的鷹架內填充實驗。AI Scientist v2（Yamada 等人，2025 年）則透過引入具備視覺語言模型（VLM）審查迴圈的 Agentic 樹狀搜尋，徹底擺脫了對預設樣板的依賴。該系統能夠自主發想創意、執行實驗、生成視覺圖表、撰寫論文，並根據審稿回饋進行迭代。

同行評審的裁定：一篇由 v2 生成的論文在 ICLR 2025 工作坊中被正式接受（附帶來源揭露）。獨立評估的結論：該系統距離真正穩定可靠仍有漫長距離。這兩者皆是不容忽視的事實。

## The Concept｜核心概念

### 系統架構

1. **創意生成（Idea generation）。** LLM 根據指定的主題與先前文獻提出研究假說。v1 依賴樣板；v2 則在龐大的假說空間中展開 Agentic 搜尋。
2. **新穎性檢驗（Novelty check）。** 文獻檢索步驟會檢查該創意是否早已發表。這正是 Beel 等人的評估中發現嚴重誤標的環節——既有的成熟方法經常被系統判定為全新發明。
3. **實驗規劃（Experiment plan）。** agent 起草實驗協定並編寫相應的程式碼。
4. **程式碼執行（Execution）。** 程式碼在沙盒中實際運作。失敗會回饋至重試迴圈中。在 Beel 等人的實測中，高達 42% 的實驗在此階段因程式碼錯誤而中斷。
5. **圖表生成（Figure generation）。** 視覺語言模型會檢視生成的圖表，並為了清晰度與美觀進行重繪潤飾。這是 v2 的關鍵技術亮點。
6. **論文撰寫（Writeup）。** LLM 起草完整論文草稿，並與內部審稿 agent 進行多輪修訂。
7. **可選步驟：投稿（Submission）。** 將論文正式送交至學術會議。

### 工作坊論文被錄取的背後含義

一篇由 v2 生成的論文確實通過了 ICLR 2025 工作坊的同行評審。作者在投稿時向大會籌委會坦誠揭露了論文的生成來源。被錄取是一個客觀事實；但這絕不代表可以輕率宣稱該系統「已經具備獨立科研能力」。

重要的背景脈絡：工作坊論文的門檻本來就顯著低於主會議論文。同行評審本身具有隨機性與雜訊；在任何給定的審查日中，總有一定比例的稿件會碰巧過關。單一案例的成功僅能視為概念驗證（PoC），絕非系統穩定性的證明。《Nature》2026 年刊登的論文記錄了這個端到端的閉環，且該論文本身是由人類研究員共同撰寫的；並非「AI 系統獨立寫出了一篇 Nature 論文」。

### 獨立第三方評估的實測發現

Beel 等人（arXiv:2502.14297）進行了外部獨立評估。其核心發現包括：

- **實驗崩潰率極高。** 42% 的實驗因程式碼錯誤（錯誤的 import、張量形狀不符、未定義變數等）而失敗。重試迴圈僅能捕捉到一部分，而非全部。
- **新穎性嚴重誤標。** 文獻檢索步驟頻繁將學界早已確立的既有概念標記為原創新穎。這等同於科研層級的幻覺。
- **呈現品質與實質水準的脫節。** 視覺語言模型的圖表審查產出了出版級的優美圖表，卻巧妙掩蓋了底層脆弱不堪的實驗缺陷。

最後一項發現對於本階段的學習尤為關鍵。一個能夠產出看似極度專業但在實質研究上漏洞百出的系統，比一個直接崩潰失敗的系統更加危險。評估機制必須穿透表面包裝，直接檢驗底層的科學論點與實驗結果。

### 沙盒逃逸（Sandbox-Escape）的安全隱患

Sakana 自身程式碼庫的 README 發出了鄭重警告：

> 鑑於本軟體的本質是執行由 LLM 生成的程式碼，我們無法保證其安全性。存在安裝危險套件、不受控的網路存取以及生成非預期行程的重大風險。請自行承擔使用風險，並強烈建議採用 Docker 進行隔離。

這正是自主 agent 在未經驗證領域中所展現的運作形態。LLM 編寫程式碼；程式碼被執行；而該程式碼可以執行該行程被賦予權限的任何操作。若沒有在檔案系統、網路連線以及行程行為上進行硬性限制的沙盒環境，任何自主科研 agent 都有可能外洩資料、燒乾運算資源，甚至改寫自身邏輯。

AlphaEvolve 的沙盒相對容易建構，因為其評估器嚴格且封閉。而 AI Scientist v2 的迴圈執行的則是以開放式目標為導向的任意程式碼。這正是為何它需要更強大的隔離機制（最低限度為 Docker；強烈建議採用 seccomp 或 gVisor），以及在任何產物離開系統前必須經過嚴格的人工審查。

### v2 在尖端技術堆疊中的定位

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

在三者之中，v2 擁有最薄弱的自動評估器、最寬廣的輸出表面，以及通往公開產物的最短路徑。系統的運作控制（沙盒、人工審查、來源揭露）承擔了絕大部分的安全防護職責。

```figure
mx-research-loop
```

## Use It｜實際應用

`code/main.py` 將 v2 迴圈模擬為一個狀態機：創意 → 新穎性檢查 → 實驗 → 圖表 → 撰寫 → 審稿 → 接受或迭代。每個狀態都帶有根據 Beel 等人實測結果所配置的失敗機率。讓模擬器執行 N 個迴圈並統計：

- 有多少創意能夠成功走到投稿階段。
- 有多少投稿包含被精美論文表面所掩蓋的致命實驗缺陷。
- 重試預算如何在產出品值與產能之間取得取捨平衡。

## Ship It｜交付成果

`outputs/skill-ai-scientist-sandbox-review.md` 是一份針對科研迴圈 agent 所產出的任何成果在離開沙盒前必須通過的雙重閘門審查清單。

## Exercises｜練習

1. 以預設參數執行 `code/main.py`。有多大比例的迴圈能產出「乾淨無瑕」的論文？有多大比例的論文存在被圖表審查所美化的實驗缺陷？

2. 預設參數已採用 Beel 等人的 42% 與 25%。改用 `--experiment-failure 0.20 --novelty-mislabel 0.10` 與 `--experiment-failure 0.60 --novelty-mislabel 0.40` 重新執行。這兩種設定下，「表面光鮮但實質有瑕」的論文比例產生了怎樣的變化？

3. 閱讀 Sakana 的 AI Scientist v2 程式碼庫中關於沙盒要求的 README。列舉除了 Docker 之外，在面對為期數天的自主執行時你還會追加的兩項安全限制。

4. 閱讀 Beel 等人論文第 4 節關於呈現品質脫節的討論。設計一個額外的評估器，使其能夠精準揪出外觀精美但實驗存在致命缺陷的論文。

5. 針對科研 agent 的產出提出一套比「讓博士通讀每篇論文」更具可擴展性的人工審查協定。指出瓶頸所在並針對性地進行機制設計。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Further Reading｜延伸閱讀

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066) — 論文全文。
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) — 原廠摘要介紹與同行評審背景。
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) — 外部獨立評估結果。
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) — 採用樣板的前身系統論文。
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 針對開放式科研 agent 的廣義安全架構評估。
