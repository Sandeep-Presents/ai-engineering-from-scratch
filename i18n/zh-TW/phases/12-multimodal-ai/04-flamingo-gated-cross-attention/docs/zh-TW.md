# Flamingo 與少樣本 VLM 的門控交叉注意力（Flamingo and Gated Cross-Attention for Few-Shot VLMs）

> DeepMind 的 Flamingo（2022）率先達成了兩項開創性壯舉：其一，證明了單一模型能夠處理影像、影片與文字任意交錯的超長序列；其二，展示了多模態模型（VLM）同樣具備強大的在線上下文學習（in-context learning）能力——只需在 prompt 中給出三組（影像, 圖片說明）範例，模型便能在完全不更新任何梯度的情況下，精確為全新的影像生成圖片說明。其關鍵機制為：在凍結 LLM 的既有層之間插入門控交叉注意力（gated cross-attention）層，並搭配一個初始值為零的可學習 tanh 門控，確保模型在初始化之初能完美保留原 LLM 的強大文字能力。本課將深入剖析 Flamingo 的 Perceiver 重取樣器與門控交叉注意力架構——這正是 Gemini 交錯輸入與 Idefics2 視覺 token 的技術先祖。

**Type:** Learn
**Languages:** Python (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 解釋門控交叉注意力如何透過設為零的 tanh(gate) = 0，在初始化階段完美保留凍結 LLM 原本的文字推理能力。
- 深入剖析 Perceiver 重取樣器：如何將任意數量的 N 個影像 patch，透過交叉注意力壓縮為固定數量的 K 個「潛在（latent）」query 向量。
- 說明 Flamingo 如何透過兼顧影像空間位置的因果遮罩，優雅處理影像與文字交錯出現的複雜序列。
- 實作少樣本多模態 prompt 結構（例如 3 組圖文範例後接續待測影像）。

## The Problem｜問題

BLIP-2 的做法是將 32 個視覺 token 餵入凍結 LLM 的輸入層。這種設計在每個 prompt 只包含單張影像時運作良好。但若你想傳入「影像與文字自由交錯」的超長序列——例如「這是影像 A，請說明；這是影像 B，請說明；現在這是影像 C，請說明」呢？此時 LLM 的自注意力機制必須在單一串流中同時混雜處理視覺 token 與文字 token，而關於「哪些文字位置允許凝視哪些影像」的遮罩設定將變得極其繁複混亂。

Flamingo 給出的突破性方案是：完全不動 LLM 的輸入串流！而是在現有的各個 LLM 區塊之間，直接插入額外的交叉注意力層。文字 token 依然如往常般通過 LLM 自身的因果自注意力層。在每隔數個 LLM 區塊之間，文字 token 額外透過新引入的門控層對影像特徵進行交叉注意力運算。該門控在初始時設定為零，這意味著在訓練第 0 步時，這些新插入的層完全不起作用（no-op）——整個模型的行為與原先預訓練好的純文字 LLM 完全一致。隨著訓練推進，門控逐漸平滑開啟，視覺資訊才開始順暢融入。

Flamingo 解答的第二個難題是：如何處理每個 prompt 中包含可變數量影像（0 張、1 張或多張）的彈性場景？答案是 Perceiver 重取樣器（Perceiver resampler）——一個輕巧的交叉注意力模組，無論前端傳入多少個影像 patch，它都能精確輸出固定數量的視覺潛在 token。這使得 LLM 的交叉注意力層無論面對包含多少影像的 prompt，所看到的特徵維度皆完全一致。

## The Concept｜核心概念

### 凍結的 LLM

Flamingo 以凍結的 Chinchilla 70B LLM 為基礎。全部 700 億參數權重完全不動。既有的文字自注意力機制與 FFN 照常運作。

### Perceiver 重取樣器

針對 prompt 中的每一張影像，ViT 會產出 N 個 patch token。Perceiver 重取樣器具備 K 個固定的可學習潛在向量（Flamingo 設定 K=64）。每個重取樣器區塊包含兩個子步驟：

1. 交叉注意力：K 個潛在向量對 N 個 patch token 進行注意力檢索（Q 來自潛在向量，K/V 來自 patch）。
2. 潛在向量內部的自注意力與 FFN 運算。

經過 6 個重取樣器區塊後，無論 ViT 最初產出多少 patch，輸出皆為固定 K=64 個維度為 1024 的視覺 token。一張 224×224 的影像（196 個 patch）與一張 480×480 的影像（900 個 patch），最終皆被壓縮為 64 個重取樣器 token。

對於影片輸入，重取樣器沿時間維度依序套用：每一幀的 patch 各自產生 64 個潛在向量，搭配時間位置編碼讓模型得以區分 t=0 到 t=N 的先後順序。整段影片最終轉化為 T × 64 個視覺 token。

### 門控交叉注意力

在凍結 LLM 每隔 M 層之間（Flamingo 設定 M=4），插入一個全新的門控交叉注意力區塊：

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` 為可學習純量參數，初始值設定為零。
- 由於 `tanh(0) = 0`，在初始化時門控路徑的貢獻嚴格為零。
- 當 `alpha` 隨訓練逐漸偏離零時，交叉注意力的貢獻便能平滑穩定地增長。
- 殘差連接意味著即使門控完全打開，也不會破壞覆蓋 LLM 既有的文字表徵；它只是將視覺特徵自然疊加其上。

這是 Flamingo 最具智慧的架構設計：視覺條件引導具備加法性、門控調節性，且在初始化時精確歸零。第 0 步的 Flamingo 在處理純文字輸入時，其效能表現與原版的 Chinchilla 70B 毫無二致。

### 針對交錯輸入的遮罩交叉注意力

在類似「<影像 A> 說明 A <影像 B> 說明 B <影像 C> ？」的交錯 prompt 中，每個文字 token 應該只能看到出現在它先前的影像。交叉注意力遮罩強制規定：位於位置 `t` 的文字 token，只能凝視影像索引 `i < i_t` 的重取樣器 token，其中 `i_t` 為位置 `t` 之前最近出現的那張影像。「只凝視緊鄰的前一張影像」或「凝視先前出現過的所有影像」皆是合法的設計選項；Flamingo 實務上選擇了前者。

### 上下文中的少樣本學習（In-Context Few-Shot Learning）

典型的 Flamingo prompt 結構如下：

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型辨識出接續生成的模式，並精確輸出「bird」（或 image3 中實際對應的實體）。全程無須更新任何梯度。凍結 LLM 既有的在線上下文學習能力，直接藉由門控交叉注意力穿透傳遞至多模態領域——這正是該論文最震撼學界的亮點所在。

### 訓練資料

Flamingo 在三大資料集上進行聯合訓練：

1. MultiModal MassiveWeb（M3W）：包含 4,300 萬個圖文交錯網頁，並完整重建了原始閱讀順序。
2. 圖文配對（ALIGN + LTIP）：共計 44 億組圖文配對。
3. 視訊文字配對（VTP）：包含 2,700 萬段短影音剪輯。

OBELICS（2023）是該交錯式網頁語料庫的開源重現版本，Idefics、Idefics2 及多數開源類 Flamingo 架構皆在此資料集上完成訓練。

### OpenFlamingo 與 Otter

OpenFlamingo（2023）是其開源重現專案。架構完全對齊（在凍結的 LLaMA 或 MPT 之上架構 Perceiver 重取樣器與門控交叉注意力）。發布了 3B、4B 與 9B 多種尺寸權重。由於底座 LLM 較小且資料規模較少，其表現稍落後於原創 Flamingo。

Otter（2023）在 OpenFlamingo 之上，進一步在多模態指令資料集 MIMIC-IT 上展開指令 fine-tuning，驗證了門控交叉注意力同樣能完美勝任多模態指令遵循任務。

### 演進與後續後裔架構

- Idefics / Idefics2 / Idefics3：Hugging Face 主導的門控交叉注意力架構體系，演進方向日益精簡（Idefics2 移除了重取樣器，改採具備適應性池化的直接 patch token）。
- 從 Flamingo 到 Chameleon 的典範轉移：到了 2024 年，許多研究轉向 Early-Fusion（早期融合，見第 12.11 課）；但在必須嚴格凍結語言底座的工業場景中，Flamingo 風格的門控交叉注意力依然是正式環境的主力。
- Gemini 的交錯輸入架構：在概念上繼承了 Flamingo 處理交錯格式的極致彈性，儘管其確切的內部專有實作細節並未公開。

### 與 BLIP-2 的架構對比

| 比較維度 | BLIP-2 | Flamingo |
|---|---|---|
| 視覺橋樑架構 | 僅在輸入端掛載一次 Q-Former | 在每隔 M 層 LLM 內部皆插入門控交叉注意力 |
| 視覺 Token 數量 | 每張影像 32 個 | 每個交叉注意力層每張影像各 64 個 |
| 凍結語言模型 | 是 | 是 |
| 少樣本在線學習 | 較弱 | 極強——為該論文的核心基石 |
| 圖文交錯輸入 | 無原生支援 | 原生支援，以此為核心設計目標 |
| 訓練資料規模 | 1.3 億圖文對 | 13 億圖文對 + 4,300 萬交錯網頁 |
| 可訓練參數量 | 1.88 億參數 | 約 100 億參數（所有交叉注意力層總和） |
| 訓練運算開銷 | 8 張 A100 訓練數天 | 數千張 TPUv4 訓練數週 |

若預算有限且專注於單圖 VQA，選 BLIP-2；若需處理圖文交錯、少樣本推理或複雜多圖比較，則應優先選用 Flamingo / Idefics2 架構。

```figure
cross-attention-fusion
```

## Use It｜實際應用

`code/main.py` 完整展示了：

1. 在 36 個模擬 patch token 上執行 Perceiver 重取樣器，壓縮為 8 個可學習潛在向量（純 Python 實作交叉注意力）。
2. 門控交叉注意力計算：當 `alpha = 0` 時，輸出與輸入嚴格相等（LLM 文字能力毫髮無傷）；當 `alpha = 2.0` 時，視覺特徵開始平滑注入。
3. 交錯輸入注意力遮罩建構器：為「(影像 1) (文字 1) (影像 2) (文字 2)」序列產生正確的二維注意力遮罩。

## Ship It｜交付成果

本課產出 `outputs/skill-gated-bridge-diagnostic.md`。給定開源 VLM 的組態設定（是否包含重取樣器、交叉注意力插入頻率、門控調控策略），它能精準診斷其所承襲的 Flamingo 架構元素並解釋其權重凍結策略。此工具極適合用於排查「為何多模態 fine-tuning 導致語言模型本體文字能力嚴重退化」的工程痛點（通常原因在於門控開啟過快失控）。

## Exercises｜練習

1. 計算 Flamingo-9B 的視覺參數量：9B LLM + 1.4B 門控交叉注意力層 + 64M 重取樣器。實際參與訓練的參數占全體模型的比例為何？

2. 以 PyTorch 實作門控殘差運算 `y = tanh(alpha) * cross + x`。在實驗中證明當 `alpha=0` 時，在初始化瞬間 `y==x` 嚴格成立。

3. 閱讀 OpenFlamingo 論文（arXiv:2308.01390）第 3.2 節，了解當批次中每個 prompt 包含不同數量的影像時，該模型如何進行批次填充（padding）。說明其填充策略。

4. 為何 Flamingo 的交叉注意力遮罩規定文字 token「只能凝視緊鄰在它之前的那張影像」，而非先前出現過的所有影像？閱讀 Flamingo 論文第 2.4 節並解釋其背後的取捨考量。

5. 上下文少樣本實作：為全新的 Flamingo 變體模型設計一個包含 4 組「影像 → 核心主體顏色」範例的 prompt。描述當範例數量從 0 逐步增加至 8 時，模型預測準確率的預期變化趨勢。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Perceiver resampler | 「固定潛在向量交叉注意力」 | 將任意數量的輸入 patch 透過交叉注意力壓縮為 K 個固定數量 token 的模組 |
| Gated cross-attention | 「Tanh 門控橋樑」 | 形式為 `y = tanh(alpha)*cross + x` 的殘差層，alpha 為可學習純量且初始為 0 |
| Interleaved input | 「圖文交錯序列」 | 影像與文字依照人類真實閱讀順序自由交織混合的 prompt 格式 |
| Frozen LLM | 「不更新 LLM 梯度」 | 文字語言模型的本體權重維持凍結；僅訓練重取樣器與額外插入的交叉注意力層 |
| Few-shot | 「上下文學習範例」 | 在 prompt 中提供少量（影像, 答案）範例；模型無須進行 fine-tuning 即可泛化答題 |
| OBELICS | 「開源交錯網頁語料庫」 | 包含 1.41 億個圖文交錯網頁的開源大型資料集，遵循真實網頁閱讀排版 |
| Chinchilla | 「70B 凍結基底模型」 | Flamingo 所採用的凍結語言模型，源自 DeepMind 著名的 Chinchilla 擴展法則論文 |
| Gate schedule | 「Alpha 開啟節奏」 | 在訓練過程中門控參數 alpha 隨 step 增長的速率與調度曲線 |
| Cross-attn frequency | 「每隔 M 層插入」 | 門控交叉注意力區塊插入 LLM 的頻率間隔；Flamingo 設定為每隔 M=4 層插入一次 |
| OpenFlamingo | 「開源重現版本」 | MosaicML 與 LAION 共同推出的 3B 至 9B 開源重現模型；架構與 Flamingo 完全一致 |

## Further Reading｜延伸閱讀

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) ——Flamingo 原創論文
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) ——開源重現專案
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) ——大規模圖文交錯網頁資料集
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) ——通用 Perceiver 架構
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) ——經指令 fine-tuning 的 Flamingo 衍生模型
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) ——Flamingo 思路的現代精簡化演進
