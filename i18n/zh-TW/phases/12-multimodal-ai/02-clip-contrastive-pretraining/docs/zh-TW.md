# CLIP 與對比式視覺語言預訓練（CLIP and Contrastive Vision-Language Pretraining）

> OpenAI 的 CLIP（2021）驗證了一個足以引領往後五年的宏大概念：僅利用網路上雜訊紛呈的圖文配對與對比損失函式，即可將影像編碼器與文字編碼器對齊於同一向量空間。零監督標籤、4 億組圖文配對。由此產生的 embedding 空間能執行零樣本分類（zero-shot classification）、圖文跨模態檢索，並作為視覺塔無縫接入 2026 年的各大 VLM。SigLIP 2（2025）進一步以 sigmoid 取代 softmax，以更低的運算成本超越了 CLIP 的擴展規模。本課將從 InfoNCE 梳理至 sigmoid 成對損失的完整數學推導，並以純 Python 標準函式庫實作核心訓練步驟。

**Type:** Build
**Languages:** Python (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 從互資訊（mutual information）推導 InfoNCE 損失函式，並實作具備數值穩定性的向量化版本。
- 解釋為何 sigmoid 成對損失（SigLIP）能在沒有 softmax 所需的 all-gather 通訊負擔下，輕鬆擴展至 32,768 以上的超大批次。
- 透過建構文字模板（`a photo of a {class}`）並取餘弦相似度的 argmax，執行 ImageNet 零樣本分類。
- 掌握 CLIP / SigLIP 預訓練賦予你的四大關鍵調控槓桿：批次大小（batch size）、溫度參數（temperature）、prompt 模板與資料品質。

## The Problem｜問題

在 CLIP 出現之前，電腦視覺本質上是高度仰賴人工標籤的監督式學習。收集標註資料集（例如 ImageNet：120 萬張影像、1000 個類別）、訓練 CNN、發布模型。然而標籤成本極其昂貴，標籤內容往往受限於標註員彼此能達成共識的狹隘類別，且在未進行 fine-tuning 的情況下幾乎無法直接遷移至全新的下游任務。

相反地，網際網路上的圖文配對資源超過數十億組，且完全唾手可得。一張金毛尋回犬的照片搭配替代文字「my dog Max in the park」，本身就蘊含著明確的監督訊號——文字如實描述了影像。關鍵挑戰在於：我們能否將這種弱監督訊號轉化為扎實有效的模型訓練？

CLIP 給出的革命性解答是：將圖文配對視為一種檢索匹配任務。給定由 N 個影像與 N 個描述文字組成的批次，模型必須學會將每張影像精確匹配至其專屬的描述文字，並成功排除其餘 N-1 個干擾項。這種監督訊號本質上就是「這兩者屬於一對；其餘 N-1 個則不是」。無需人為預設類別標籤，無需耗時的人工精細標註，只需依賴對比損失函式。

由此學習而成的 embedding 空間，展現出遠超原先訓練目標的泛化威力。ImageNet 的零樣本分類之所以能直接生效，是因為「a photo of a cat」的文字特徵，會自然落在從未被顯式標註為「貓」的真實貓咪照片 embedding 附近。這項豪賭徹底開啟了 2026 年多模態 VLM 的繁榮時代。

## The Concept｜核心概念

### 雙塔編碼器（Dual Encoder）

CLIP 具備兩座獨立塔：

- 影像編碼器 `f`：ViT 或 ResNet，為每張影像輸出一個 D 維向量。
- 文字編碼器 `g`：小型 Transformer，為每段描述文字輸出一個 D 維向量。

兩座塔皆會將其輸出特徵向量正規化為單位長度（unit length）。由於兩者長度皆為 1，彼此間的相似度即為餘弦相似度 `cos(f(x), g(y)) = f(x)^T g(y)`。

對於包含 N 組（影像, 描述文字）配對的批次，建構形狀為 `(N, N)` 的相似度矩陣 `S`：

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 為可學習的溫度參數（CLIP 初始值設為 0.07，並在對數空間中進行梯度更新學習）。

### InfoNCE 損失函式

CLIP 在相似度矩陣的列（row）與行（column）上套用對稱的交叉熵損失：

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

這便是 InfoNCE。交叉熵中的 softmax 會迫使每張影像與其自身配對文字的相似度，必須顯著高於批次中其他所有文字。而「負樣本」即為批次中的其餘所有項目。批次越大，負樣本越多，對比監督訊號就越強烈。CLIP 採用高達 32,768 的超大批次進行訓練；在對比學習中，規模即是一切。

### 溫度參數（Temperature）

`tau` 負責控制 softmax 分布的陡峭程度。較低的 tau 會使機率分布變得極其尖銳，產生類似難負樣本挖掘（hard negative mining）的效果；較高的 tau 則使分布平緩，讓所有樣本皆能提供平滑的梯度貢獻。CLIP 學習 log(1/tau)，並施加數值截斷以避免訓練崩潰；而 SigLIP 2 則固定初始 tau，改以可學習的偏差偏置項（bias）進行調節。

### 為何 Sigmoid 能實現更優異的規模擴展（SigLIP）

Softmax 運算必須在全局維持完整的相似度矩陣同步。在分散式訓練中，必須將每個副本上的所有 embedding 透過 all-gather 廣播至全體 GPU，隨後才能計算 softmax。這種通信開銷隨叢集規模呈二次方（quadratic）劇烈增長。

SigLIP 以逐元素的 sigmoid 取代了 softmax：針對每一組配對 `(i, j)`，將損失視為「它們是否為同一對？」的二元分類問題。對角線上的正樣本標籤為 1，其餘負樣本標籤為 0。其損失函式表示為：

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

當 `i == j` 時 `y_ij = 1`，其餘情況為 0。由於每個配對的損失各自獨立，完全無需跨節點進行 all-gather 通訊！每張 GPU 只需計算其局部的區塊矩陣並進行純純的純量加總。這使得 SigLIP 2 能以極其低廉的通訊成本輕鬆擴展至 32k 至 512k 的海量批次，而傳統 CLIP 在相同規模下則會被通訊頻寬徹底拖垮。

### 零樣本分類（Zero-Shot Classification）

給定 N 個類別名稱，為每個類別套用標準文字模板：

```
"a photo of a {class}"
```

利用文字編碼器對每個模板文字產生 embedding。同時利用影像編碼器為待測影像產生 embedding。計算餘弦相似度後取 argmax，即為模型預測的類別。整個過程完全無需在目標類別上進行額外訓練。

Prompt 模板的設計對精度有顯著影響。CLIP 原論文為每個類別設計了 80 種不同風格的模板（如清晰照片、藝術圖、油畫等）並將其 embedding 取平均，直接在 ImageNet 上帶來了 3 個百分點的準確率提升。現代實務中通常精選一至兩個代表性模板即可取得優異成效。

### 線性探針（Linear Probe）與 Fine-Tuning

零樣本分類常作為基準線。若在凍結的 CLIP 特徵之上針對目標類別僅訓練一層線性分類器（稱為線性探針，Linear Probe），通常能在特定領域任務上超越零樣本表現。而若進行全參 fine-tuning，領域內準確率雖能進一步提升，卻往往會損害原有的通用零樣本遷移能力。這三種範式各自具備明確的工程取捨。

### SigLIP 2：NaFlex 與密集特徵

SigLIP 2（2025）帶來了關鍵進展：
- NaFlex：單一模型原生支援任意長寬比與彈性解析度輸入。
- 專為下游語意分割與深度估計調校出更卓越的密集特徵，旨在作為 VLM 的凍結視覺骨幹網路。
- 多語言支援：CLIP 僅限英文，而 SigLIP 2 在涵蓋 100 種以上語言的資料上進行訓練。
- 參數量擴展至 10 億（1B），突破了 CLIP 原先 4 億（400M）的規模上限。

在 2026 年的開源 VLM 中，SigLIP 2 SO400m/14 已是公認的標準視覺塔。而在特定圖文檢索場景中，若檢索查詢特徵高度契合 LAION-2B 的分布，經典 CLIP 依然是一線主力。

### ALIGN、BASIC、OpenCLIP 與 EVA-CLIP

ALIGN（Google，2021）：沿用與 CLIP 相同的思路，擴展至 18 億圖文配對規模，且容忍 90% 的雜訊，證明了雜訊資料的規模化潛力。OpenCLIP（LAION）：在 LAION-400M / 2B 上成功開源重現 CLIP，提供多種尺寸檢查點，是目前最受歡迎的開源社群權重。EVA-CLIP：以遮蓋影像建模（MIM）權重進行初始化，成為 VLM 的強悍骨幹。BASIC：Google 融合 CLIP 與 ALIGN 的超大規模混合架構。它們皆屬同一架構家族，核心差異在於資料規模與超參數調校。

### 零樣本分類的效能天花板

CLIP 級別的模型在 ImageNet 零樣本準確率上通常在 76% 左右遭遇天花板（如 CLIP-G、OpenCLIP-G）。若想進一步突破，必須仰賴更巨量的資料訓練（SigLIP 2 突破了 80% 以上）或架構改良（引入監督式分類頭或更大參數量）。儘管單純的基準評測逐漸趨於飽和，但對比學習產生的通用 embedding 空間，才是多模態大模型得以生根茁壯的真正沃土。

```figure
multimodal-fusion
```

## Use It｜實際應用

`code/main.py` 完整實作了：

1. 玩具雙塔編碼器（基於字元與雜湊的特徵擷取），無需安裝 numpy 即可直觀洞悉 InfoNCE 的矩陣運作。
2. 純 Python 實作具備數值穩定性（Log-Sum-Exp）的 InfoNCE 損失函式。
3. Sigmoid 成對損失函式以供對照剖析。
4. 完整的零樣本分類常式：計算與一系列文字 prompt 的餘弦相似度，並取 argmax 輸出分類結果。

動手運行該程式碼並觀察損失收斂曲線。雖然數值規模為展示用玩具模型，但收斂形態與真實大規模 CLIP 訓練時的動態特徵完全一致。

## Ship It｜交付成果

本課產出 `outputs/skill-clip-zero-shot.md`。給定一組影像檔案路徑與目標類別清單，它將依據 CLIP 模板自動建構文字 prompt，利用指定模型權重（例如 `openai/clip-vit-large-patch14`）抽取雙向 embedding，並輸出 Top-1 與 Top-5 預測類別及相似度分數。該技能會嚴謹回絕任何未列於候選清單中的無根據推測。

## Exercises｜練習

1. 手算一個包含 4 組配對的小批次 InfoNCE 損失。親手建構 4×4 的相似度矩陣，逐列計算 softmax，取出對角線正樣本機率並計算交叉熵。將你的手算數值與 Python 實作程式碼的計算結果進行對照驗證。

2. SigLIP 在溫度參數之外額外引入了偏差偏置參數 `b`：`S'[i,j] = S[i,j]/tau + b`。當批次中存在嚴重類別不平衡（矩陣每列的負樣本數量遠遠壓倒正樣本）時，`b` 發揮了什麼核心作用？閱讀 SigLIP 原論文第三節（arXiv:2303.15343）。

3. 針對貓與狗分類任務建構零樣本分類器。嘗試對比兩種 prompt 模板：`a photo of a {class}` 與 `a picture of a {class}`。在 100 張測試影像上評估分類準確率。多模板整合（ensemble）是否優於單一模板？

4. 在包含 512 塊 GPU 的分散式叢集、批次大小為 32,768 的設定下，計算傳統 softmax InfoNCE 與 sigmoid 成對損失的通訊成本。何者的通訊複雜度為 O(N)，何者為 O(N^2)？引用 SigLIP 論文第四節的推導。

5. 閱讀 OpenCLIP 規模縮放法則論文（arXiv:2212.07143，Cherti 等人）。根據論文圖表重現其關於資料規模的結論：在固定模型規模下，ImageNet 零樣本準確率與訓練資料規模之間呈現何種對數線性（log-linear）關係？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| InfoNCE | 「對比損失函式」 | 在批次相似度矩陣上計算的交叉熵；每個項目的正樣本為其專屬配對，其餘皆為負樣本 |
| Sigmoid loss | 「SigLIP 損失」 | 逐配對獨立計算的二元交叉熵；無需 softmax 與 all-gather，在分散式訓練中擴展成本極低 |
| Temperature | 「tau 參數」 | 在 softmax/sigmoid 之前縮放 logit 的純量；負責調控機率分布的陡峭程度 |
| Zero-shot | 「免 fine-tuning 直接分類」 | 利用文字 prompt 建構類別 embedding 並依餘弦相似度分類；無需在目標類別上重新訓練 |
| Prompt template | 「a photo of a ...」 | 圍繞目標類別名稱建構的文字模板；能使零樣本分類準確率產生 1 至 5 個百分點的差異 |
| Dual encoder | 「雙塔模型」 | 由一個影像編碼器與一個文字編碼器組成，輸出對齊於相同的 D 維空間 |
| Hard negative | 「難負樣本」 | 與正樣本外觀極其相似的干擾項，迫使模型必須深入辨識關鍵細節才能區分 |
| Linear probe | 「凍結主體只訓單層」 | 凍結主幹特徵，僅在其頂部訓練一個線性分類器；用於精確衡量特徵本身的表徵品質 |
| NaFlex | 「原生彈性解析度」 | SigLIP 2 的原生能力，無需強制縮放填充即可直接處理任意長寬比與解析度的影像 |
| Temperature scaling | 「對數參數化 tau」 | CLIP 將參數表示為 `log(1/tau)` 以保證梯度穩定，並施加數值截斷以防參數趨近於零造成數值崩潰 |

## Further Reading｜延伸閱讀

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) ——經典 CLIP 原創論文
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) ——SigLIP 論文
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) ——多語言支援與 NaFlex 原生解析度
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) ——利用海量網路雜訊資料進行規模擴展
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) ——OpenCLIP 經驗縮放法則
