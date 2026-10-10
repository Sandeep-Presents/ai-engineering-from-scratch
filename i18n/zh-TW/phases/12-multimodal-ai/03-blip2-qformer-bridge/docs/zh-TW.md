# 從 CLIP 到 BLIP-2——作為模態橋樑的 Q-Former（From CLIP to BLIP-2 — Q-Former as Modality Bridge）

> CLIP 能夠對齊影像與文字，卻無法自主生成圖片說明、回答問題或進行多輪對話。BLIP-2（Salesforce，2023）透過一座小巧且可訓練的模態橋樑解決了這個難題：32 個可學習的 query 向量透過交叉注意力（cross-attention）凝視並萃取凍結 ViT 的特徵，隨後直接注入凍結 LLM 的輸入串流中。僅憑 1.88 億參數的橋樑，便成功將 110 億參數的 LLM 與 ViT-g/14 緊密串接。直至 2026 年，所有基於 adapter 的 VLM——MiniGPT-4、InstructBLIP 以及 LLaVA 家族——皆為其直系後裔。本課將深入剖析 Q-Former 的架構原理，詳解其兩階段預訓練機制，並以純 Python 標準函式庫手刻一個將視覺 token 注入凍結文字解碼器的原型系統。

**Type:** Build
**Languages:** Python (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 解釋為何在凍結的視覺編碼器與凍結的 LLM 之間加裝可訓練的資訊瓶頸層，在成本與訓練穩定性上遠勝於端到端全參 fine-tuning。
- 實作交叉注意力區塊，使一組固定數量的可學習 query 能精確檢索外部影像特徵。
- 完整剖析 BLIP-2 的兩階段預訓練機制：表徵學習階段（ITC + ITM + ITG）以及生成式學習階段（搭配凍結解碼器的語言模型損失）。
- 對比 Q-Former 與 LLaVA 採用的純 MLP 投影器，並論證兩者各自適用的決策情境。

## The Problem｜問題

假設你有一個凍結的 ViT，每張影像能產出 256 個維度為 1408 的 patch token。你同時有一個凍結的 7B LLM，預期接收維度為 4096 的 token embedding。最直覺的銜接橋樑——一個從 1408 映射至 4096 的線性層——確實能跑通，但將全部 256 個 patch token 硬塞入 LLM 的 context，意味著每張影像都要額外耗費 256 個 token 額度。若是一個批次處理 32 張影像，光是視覺模態就會直接吞噬 8,192 個 token。

BLIP-2 提出的核心問題是：我們能否將這 256 個 token 的影像表徵大幅壓縮至極少數量（例如 32 個），同時保留足夠豐富的高階資訊，讓 LLM 依然能順暢生成圖文描述、回答問題並對影像展開深度推理？而且，能否在完全不改動任何凍結骨幹網路的前提下訓練這座橋樑，將訓練開銷死死限制在橋樑自身的微小參數量內？

答案正是：Q-Former。32 個可學習的「query」向量透過交叉注意力機制檢索 ViT 的 patch token，萃取出包含 32 個視覺 token 的精華摘要供 LLM 消化。整座橋樑總計僅 1.88 億參數。在接觸 LLM 之前，它先後透過對比式、配對式以及生成式多重目標進行了扎實預訓練。

## The Concept｜核心概念

### 可學習 Query 向量

Q-Former 最核心的精妙技巧在於：不直接讓 LLM 的文字 token 去檢索影像 patch，而是額外引入一組全新的 32 個可學習 query 向量 `Q`，讓「它們」主動去檢索影像 patch。這些 query 本身就是模型的內部參數——在訓練過程中逐步習得，且所有影像皆共用這同一組 32 個 query。

經過交叉注意力機制後，每個 query 皆承載了整張影像的某種高度壓縮摘要——例如「描述核心主體」、「捕捉背景氛圍」、「統計物件數量」等。這些 query 並非僵化地綁定於特定語意標籤，而是自主學會任何能最有效降低下游任務損失的最佳編碼模式。

### 網路架構

Q-Former 本質上是一個輕量級 Transformer（共 12 層，約 1 億參數），其內部切分為兩條運作路徑：

1. Query 路徑：32 個 query 向量依序通過自注意力機制（彼此相互溝通）、跨越凍結 ViT patch token 的交叉注意力機制，最後通過 FFN。
2. 文字路徑：一個類似 BERT 的文字編碼器，與 Query 路徑共用自注意力與 FFN 的權重。但文字路徑會關閉交叉注意力機制。

在訓練期間，兩條路徑同時啟動。Query 與文字透過共用的自注意力機制即時互動，這意味著 Query 能依據文字內容進行條件引導，以因應需要圖文語意對齊的特定任務（ITM、ITG）。而在推論階段進行 VLM 模態交接時，僅有 Query 路徑單獨運作，穩定輸出 32 個視覺 token。

### 兩階段訓練

BLIP-2 採取兩階段預訓練策略：

第 1 階段：表徵學習（不引入 LLM）。結合三種損失函式共同最佳化：
- ITC（Image-Text Contrastive，圖文對比）：類似 CLIP 的對比損失，計算池化後的 query token 與文字 CLS token 之間的相似度。
- ITM（Image-Text Matching，圖文匹配）：二元分類器——判斷當前圖文配對是否真實吻合。引入難負樣本挖掘以強化判別力。
- ITG（Image-Grounded Text Generation，基於影像的文字生成）：以 query 為條件引導文字解碼器的因果語言模型損失。迫使 query 必須編碼出足以解碼還原文字的關鍵視覺細節。

在此階段僅訓練 Q-Former 本身。ViT 完全凍結，且尚未牽涉任何 LLM。

第 2 階段：生成式學習。掛載凍結的 LLM（例如 OPT-2.7B 或 Flan-T5-XL 等）。透過一個小型的線性投影層，將 32 個 query 的輸出維度映射至 LLM 的 embedding 維度。將它們作為前綴貼在文字 prompt 之前。僅針對該線性投影層與 Q-Former，在串接後的「prompt + 影像 + 描述」完整序列上計算語言模型損失。

完成第 2 階段後，Q-Former 搭配線性投影層即構成一個完整的視覺介面包裝器（adapter）。在推論時：影像 → ViT → Q-Former → 線性投影 → 前綴於文字之前 → 由凍結的 LLM 生成最終回應。

### 參數經濟學

若以 ViT-g/14（11 億參數，凍結）+ OPT-6.7B（67 億參數，凍結）+ Q-Former（1.88 億參數，訓練中）建構 BLIP-2，全系統高達 80 億參數，而實際參與訓練的僅 1.88 億。Q-Former 僅占整體堆疊參數量的約 2.4%。訓練成本直接體現此優勢：僅需幾張 A100 訓練數天，而非動輒耗費數週進行昂貴的端到端全參訓練。

在表徵品質上：BLIP-2 在零樣本 VQA 評測上打平甚至超越了 800 億參數的巨無霸 Flamingo-80B，而體積卻小了 50 倍。這座橋樑的有效性得到了強力驗證。

### InstructBLIP 與具備指令感知能力的 Q-Former

InstructBLIP（2023）為 Q-Former 引入了額外的輸入：指令文字本身。在執行交叉注意力時，Query 不僅能凝視影像 patch，還能同步讀取使用者給出的指令。這使得 Query 能針對特定任務靈活特化（例如「數一下有幾輛車」或「描述畫面色調情緒」），而非千篇一律生成固定的全景摘要。這在多項未知測試任務上取得了顯著的基準提升。

### MiniGPT-4 與純投影器途徑

MiniGPT-4 保留了原裝的 Q-Former，但在訓練時進一步凍結了 Q-Former 本身，僅訓練輸出端的線性投影層。成本極其低廉，代價則是上限受限——因為你使用的是 BLIP-2 預先訓練好的 query 表徵，而非量身定做。適合快速原型驗證，但並非終極最佳架構。

### 為何 LLaVA 選擇更簡潔的架構

LLaVA（2023，第 12.05 課）大膽拋棄了 Q-Former，改採樸素的雙層 MLP 投影器，直接將 ViT 的每一個 patch token 映射至 LLM 空間——以 24×24 網格為例，每張影像產生 576 個 token，全數送入 LLM。壓縮率較差，卻讓 LLM 擁有了直接凝視原始 patch 的完整視野。這在當時備受爭議；然而到了 2023 年底，隨著高品質視覺指令資料（LLaVA-Instruct-150k）的成熟，證明了純 MLP 同樣能學會保留足夠豐富的表徵。其取捨在於：LLaVA 的 context 消耗極快，但能非常自然地直接擴展至多圖與影片任務。

到了 2026 年，技術路線形成了清晰分流：在 token 預算極其吃緊的領域（長影片、巨量圖庫檢索），Q-Former 依然屹立；而在追求單 token 極致表徵品質的通用問答場景中，MLP 投影器已成為主流。

### 門控交叉注意力：始祖 Flamingo

早於 BLIP-2 出現的 Flamingo（第 12.04 課）便已採用相同的交叉注意力概念，但它是將其注入至凍結 LLM 的每一層內部，而非僅作為單一的前端輸入橋樑。BLIP-2 證明了僅在輸入層進行壓縮同樣能達到極佳效果。Gemini 與 Idefics 則融合了這兩者的長處：同時採用交錯輸入 token 與選用的門控交叉注意力，以強化上下文中的少樣本學習能力。

### 2026 年的後續演進體系

- Q-Former 體系：BLIP-2、InstructBLIP、MiniGPT-4，以及多數出於 token 預算考量打造的視訊語言模型。
- Perceiver 重取樣器（Perceiver resampler）：Flamingo 採用的變體（第 12.04 課）；Idefics 家族、Eagle、OmniMAE。
- MLP 投影器：LLaVA、LLaVA-NeXT、LLaVA-OneVision、Cambrian-1。
- 注意力池化（Attention pool）：VILA、PaliGemma。

這四種機制皆有其用武之地。決策的根本核心在於：你所面臨的瓶頸是嚴苛的 token 預算上限，還是極致的單 token 語意保真度。

```figure
modality-projection
```

## Use It｜實際應用

`code/main.py` 以標準函式庫實作了 Q-Former 風格的交叉注意力機制：

1. 模擬產出 256 個影像 patch token（維度 128）。
2. 宣告 32 個可學習 query 向量（維度 128）。
3. 執行縮放點積交叉注意力運算（Q 來自 query，K/V 來自 patch）。
4. 透過線性層將輸出投影至 LLM 維度（512）。
5. 產出 32 個可直接餵入 LLM 的視覺 token。

所有數學運算皆以純 Python 撰寫（巢狀迴圈處理向量矩陣）。架構小巧但數學幾何形態完全正確。程式碼中會印出注意力權重矩陣，讓你親眼觀察每個 query 各自聚焦於哪些 patch 區域。

## Ship It｜交付成果

本課產出 `outputs/skill-modality-bridge-picker.md`。給定目標 VLM 配置（視覺編碼器 token 總數、LLM context 預算、部署環境限制、目標品質標準），它將精確評估並推薦選用 Q-Former、MLP 還是 Perceiver 重取樣器，並附帶具體技術論證與每種橋樑架構的參數量評估。

## Exercises｜練習

1. 以 PyTorch 實作交叉注意力區塊。驗證在傳入 32 個 query 與 256 個 key/value 的情況下，注意力權重矩陣的形狀為 32×256，且經過 softmax 之後每一列的總和皆嚴格等於 1。

2. 在 BLIP-2 的第 1 階段中，Q-Former 同時計算三個損失函式：ITC、ITM、ITG。以虛擬碼寫出這三個函式的前向傳播方法簽署（signature）。其中哪一個損失必須啟用文字編碼器路徑？

3. 參數量對比：Q-Former（12 層，隱藏維度 768）vs 雙層 MLP 投影器（從 1408 映射至 4096，共兩層）。在何種規模的 LLM 部署架構下，承擔 1.88 億參數的 Q-Former 開銷能在訓練效率上真正收回成本？

4. 閱讀 BLIP-2 論文（arXiv:2301.12597）第 3.2 節關於 Q-Former 權重初始化的細節。解釋為何從 BERT-base 初始化（而非隨機初始化）能大幅加速收斂。

5. 針對一段長度為 10 分鐘、以每秒 1 幀抽樣出 60 幀的影片，計算在（Q-Former → 每幀 32 token）與（MLP 投影器 → 每幀 576 token）之下的視覺 token 消耗量。何者能夠順暢塞入 128k token 的 LLM context 視窗中？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Q-Former | 「Query 查詢 Transformer」 | 包含 32 個可學習 query 向量的小型 Transformer，負責透過交叉注意力檢索凍結 ViT 特徵 |
| Learnable queries | 「視覺軟提示（Soft prompt）」 | 一組固定形狀的模型內部參數，作為交叉注意力的 query 來源；模型全域共用 |
| Cross-attention | 「Q 來自此處，K/V 來自彼處」 | Query 與 Key/Value 來自不同模態來源的注意力機制；讓 query 能抽取 ViT patch 的資訊 |
| ITC | 「圖文對比損失」 | 類似 CLIP 的對比損失，套用於 Q-Former 池化後的 query 與文字 CLS token 之間 |
| ITM | 「圖文匹配損失」 | 建立在難負樣本挖掘之上的二元分類損失；迫使 query 具備分辨細粒度不相符之處的能力 |
| ITG | 「圖文生成引導損失」 | 因果語言模型損失，在 query 的條件引導下生成文字；迫使 query 編碼具備解碼能力的語意 |
| Two-stage pretraining | 「先學表徵再學生成」 | 第 1 階段單獨訓練 Q-Former（ITC/ITM/ITG）；第 2 階段掛載凍結 LLM 僅訓練投影層與 Q-Former |
| Frozen backbone | 「不進行 fine-tuning」 | 視覺編碼器與 LLM 的本體權重維持完全固定；僅有中間的模態橋樑參與訓練更新 |
| Projection head | 「映射至 LLM 維度」 | 最終的線性投影層，負責將 Q-Former 的輸出維度精確轉換為 LLM 的 token embedding 維度 |
| Perceiver resampler | 「Flamingo 版的橋樑」 | 同樣基於可學習 query 的交叉注意力變體，在 Flamingo 中貫穿於 LLM 的每一層內部 |

## Further Reading｜延伸閱讀

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) ——核心原創論文
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) ——奠定 ITC/ITM/ITG 三重損失的前身工作
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) ——「先對齊再融合（align before fuse）」——第 1 階段訓練的思想發源
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) ——具備指令感知能力的 Q-Former
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) ——純線性投影器取向的極速實作
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) ——可學習 query 交叉注意力的通用架構先驅
