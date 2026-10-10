# Chameleon 與早期融合純 Token 多模態模型（Chameleon and Early-Fusion Token-Only Multimodal Models）

> 截至目前為止我們見過的所有 VLM，皆將影像與文字視為壁壘分明的不同實體。視覺 token 產自視覺編碼器，流經投影器，最後才在 LLM 內部與文字相遇。視覺與文字的詞彙表（vocabulary）從未真正重疊。Chameleon（Meta，2024 年 5 月）大膽提出質疑：如果將兩者徹底統一呢？訓練一個 VQ-VAE 將影像直接轉化為來自共用詞彙表的離散 token 序列。從此，每篇多模態文件皆成為一條純粹的序列——文字 token 與影像 token 自由交錯，共享單一自回歸損失函式。這帶來了一項震撼的副產物：模型能夠在單次推論呼叫中，自主交錯生成圖文混排的混合模態輸出。本課深入探討早期融合（Early-Fusion）的宏大命題，並從零實作其極簡原型系統。

**Type:** Build
**Languages:** Python (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 解釋共用詞彙表搭配單一因果損失函式，如何從根本上顛覆並重塑模型的能力邊界。
- 深入說明 VQ-VAE 如何將連續影像向量離散化為整數 token 序列，使其與 Transformer 的下一個 token 預測目標完美相容。
- 掌握維持 Chameleon 訓練穩定性的三大核心法寶：QK-Norm、Dropout 插入位置以及 LayerNorm 排列順序。
- 對比 Chameleon 與 BLIP-2 的 Q-Former 途徑，並指出兩者在實際工程選型時的決策分界線。

## The Problem｜問題

基於外加適配器（Adapter）的 VLM（LLaVA、BLIP-2、Qwen-VL）在架構上始終將文字與影像割裂對待。文字 token 通過 `embed(text_token)` 查表；而影像則流經 `visual_encoder(image) → projector → ... pseudo_tokens`。模型擁有兩條完全平行的輸入路徑，直至模型深處才勉強匯流。

這種架構帶來了三重無法迴避的後天缺陷：

1. LLM 只能作為單向的視覺接收者，永遠無法主動「輸出」影像。模型產物被死死限制在純文字領域。
2. 混合模態文件（文字段落與影像交錯穿插，如常見的雜誌排版或技術文章）處理起來極其彆扭——你必須在模型本體之外手動解析多模態格式，或是依賴多輪外部呼叫鏈強行串接。
3. 表徵分布失配（Distributional mismatch）：視覺 token 與文字 token 往往聚集在隱藏特徵空間的不同幾何區域，產生難以彌合的細微對齊斷層。

Chameleon 徹底推翻了這套假設：影像本質上不過是來自共用詞彙表的一串離散 token。在圖文交錯文件上進行端到端預訓練，共用單一自回歸解碼器與交叉熵損失，自然免費解鎖了圖文混排生成的終極能力。

## The Concept｜核心概念

### 作為影像 Tokenizer 的 VQ-VAE

其核心影像 tokenizer 採用向量量化變分自編碼器（VQ-VAE）。其內部架構為：

- 編碼器（Encoder）：由 CNN 與 ViT 構成，將輸入影像映射為二維空間特徵圖（例如 32×32 個維度為 256 的連續特徵向量）。
- 碼本（Codebook）：一個預先學習好的向量字典，包含 K 個原型向量（Chameleon 設定 K=8192），維度同樣為 256。
- 向量量化（Quantization）：針對每個二維空間特徵，計算其與碼本中所有向量的 L2 距離，取最近鄰的碼本向量，並將連續特徵直接替換為對應的整數索引（0 到 8191）。
- 解碼器（Decoder）：CNN 架構，負責接收離散整數索引還原出的向量，並將其逆向解碼重建為原始像素。

訓練目標：VAE 重建損失 + 承諾損失（commitment loss）+ 碼本更新損失。碼本中的離散整數索引，便構成了專屬於影像的離散字母表。

在 Chameleon 中：一張影像會轉化為 32×32 = 1024 個離散 token，取值範圍落在 0 至 8191。將它們與文字 token（源自 LLM 的 BPE 詞彙表，例如 32,000 個詞）共同拼接。最終的合併詞彙表大小為 40,192。在 Transformer 眼中，輸入只是一條純粹由整數構成的單一序列，並統一在單一損失下前進。

### 共用詞彙表架構

Chameleon 的共用詞彙表將文字 token、影像離散 token 以及模態分隔標記統整於單一 ID 空間中。每個 token 都有唯一的整數編號。底層的輸入 embedding 層將每個 ID 映射至 D 維隱藏空間；頂層的線性輸出投影層則將隱藏狀態直接投射回 40,192 維的 logit 機率分布。Softmax 自主挑選下一個最合理的 token，無論其屬於文字還是視覺。

分隔符號至關重要：`<image>` 與 `</image>` 標籤用於精確界定影像 token 序列的起訖邊界。在推論生成期間，一旦模型輸出 `<image>`，外圍的調度系統便能精準預期接下來的 1024 個 token 是專屬於 VQ 碼本的索引，會直接將其匯入 VQ-VAE 解碼器以彩現輸出實體像素。

### 混合模態自主生成

推論過程完全遵循在共用詞彙表上的標準下一個 token 自回歸預測。例如給定 prompt：「Draw a cat and describe it.」，Chameleon 能夠一氣呵成輸出：

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

模型能夠自主決策產出的先後順序——它可以選擇先圖後文、先文後圖，甚至圖文交替出現。完全共用同一個解碼器，完全受制於同一個語言建模損失。

相較於只能輸出純文字的傳統外加式 VLM，Chameleon 為模型輸出模態的想像力開創了全新維度。

### 訓練穩定性技巧——QK-Norm、Dropout 與 LayerNorm 排序

早期融合（Early-Fusion）架構在大規模訓練時極度容易發生數值崩潰。Chameleon 論文詳盡記錄了三項力挽狂瀾的工程關鍵：

- QK-Norm：在注意力運算的點積計算之前，對 Query 與 Key 投影向量先行套用 LayerNorm。此舉能有效防止隨著模型層數加深而發生的 logit 數值爆炸。該技術已被 2024 年後的多數前沿大模型廣泛採納。
- Dropout 的插入位置：將 Dropout 精確置於每一次殘差相加（residual-add）之後，而非僅僅放在注意力與 MLP 內部。當來自大量影像 token 的梯度開始在網路中佔據主導時，需要更強大的正則化來約束震盪。
- LayerNorm 的排布順序：在殘差路徑上採用標準 Pre-LN，並在最後一個區塊的跨接連接處額外加裝一道額外的 LayerNorm。這大幅穩定了最終輸出層的梯度流。

若缺乏這三項關鍵技巧，340 億參數的 Chameleon 在預訓練期間多次遭遇發散崩潰；而引入後則能順暢收斂。這套訓練穩定性配方與模型架構本身具備同等重要的技術價值。

### Tokenizer 的重建效能天花板

VQ-VAE 本質上是有損壓縮。在 8192 碼本容量以及每張 512×512 影像僅分配 1024 個 token 的約束下，其像素級重建峰值訊噪比（PSNR）通常卡在 26 到 28 dB 的天花板。這足以生成辨識度尚可的清晰影像，但相較於連續潛在空間的擴散模型（如 Stable Diffusion 3 可輕易達成 32+ dB），其視覺細緻度依然存在肉眼可見的差距。

Tokenizer 是整套架構最大的效能瓶頸。更強大的離散 tokenizer（如 MAGVIT-v2、IBQ、SBER-MoVQGAN）能持續推升此上限。Emu3（第 12.12 課）正是單憑更優異的離散 tokenizer，在不改變自回歸範式的前提下達成了比肩 SDXL 的生成水準。

### Chameleon 對比 BLIP-2 與 LLaVA

Chameleon 體系（早期融合，共用詞彙表）：
- 單一自回歸解碼器，單一因果損失。
- 原生支援圖文混排自主雙向生成。
- 影像生成上限嚴格受限於離散 tokenizer 的重建極限。
- 推論路徑上若需生成影像，必須即時運行 VQ-VAE 解碼器，計算開銷較大。

BLIP-2 / LLaVA 體系（後期融合，雙塔架構）：
- 單向「影像輸入、文字輸出」。
- 能直接高度重用現成成熟的純文字預訓練 LLM。
- 在純理解任務上不受離散 tokenizer 的資訊瓶頸制約。
- 推論輕快，單次前向即可完成。

選型依據任務而定：若需要圖文雙向多模態生成能力，選 Chameleon 家族；若純粹專注於多模態理解與問答，外加適配器式的 VLM 架構更簡單，且能最大限度復用既有的預訓練語言算力。

### Fuyu 與 AnyGPT

Fuyu（Adept，2023）是一項頗具啟發性的平行嘗試：徹底捨棄獨立的視覺編碼器，直接將原始影像 patch 當作文字 token 般餵入 LLM 的輸入投影層，且完全不使用離散 tokenizer。雖然比 Chameleon 更簡潔，卻失去了共用詞彙表自主生成影像的能力。

AnyGPT（Zhan 等人，2024）則進一步將 Chameleon 的思想延伸至四大模態：文字、影像、語音與音樂。為每種模態各自配置專屬的 VQ-VAE，並在統一的 Transformer 骨幹下完成全模態任意對任意（Any-to-Any）的自回歸生成。第 12.16 課將展開深入剖析。

```figure
vq-codebook
```

## Use It｜實際應用

`code/main.py` 從零實作了一個微型的早期融合（Early-Fusion）原型：

- 一個極簡的 VQ-VAE 風格向量量化器，將 8×8 局部 patch 映射至離散碼本索引（K=16）。
- 一個統整（文字 ID 0..31）+（影像 ID 32..47）+（分隔符號 48, 49）的共用詞彙表。
- 一個在合成圖片說明與影像 token 序列上訓練的雙連詞（bigram）自回歸解碼器。
- 一個給定文字 prompt 後，能夠自主交錯生成文字與影像 token 的取樣迴圈。

程式碼刻意將語言模型簡化為直觀的雙連詞表，讓你能夠毫無阻礙地端到端追蹤跨模態 token 的流轉機制。

## Ship It｜交付成果

本課產出 `outputs/skill-tokenizer-vs-adapter-picker.md`。給定產品規格需求（僅需理解 vs 兼具理解與生成、目標視覺品質、推論成本預算），它能在 Chameleon 家族（早期融合）與 LLaVA 家族（後期融合）之間做出精確裁決，並提供量化的工程經驗法則佐證。

## Exercises｜練習

1. Chameleon 採用 K=8192 的碼本容量，每張 512×512 的影像壓縮為 1024 個 token。計算相較於 24 位元未壓縮 RGB 影像的壓縮比。這是否有損？其資訊損失的程度有多大？

2. 一張 4K 影像（3840×2160）在相同的 VQ-VAE 密度下會產生多少個視覺 token？Chameleon 風格的模型能否在單次推論呼叫中直接生成 4K 影像？最先被擊穿的瓶頸會是 context 視窗、tokenizer 重建極限還是 KV 快取容量？

3. 以純 Python 實作 QK-Norm。給定 64 維的 Query 與 Key 向量，展示在套用 LayerNorm 前後的點積結果。為何在深層網路中約束數值量級對於訓練穩定性至關重要？

4. 閱讀 Chameleon 論文第 2.3 節關於訓練穩定性的分析。描述在未採用 QK-Norm 的情況下，該模型在 34B 規模時所遭遇的具體崩潰病徵。其「數值範數爆炸（norm explosion）」的典型軌跡為何？

5. 擴充教學程式碼中的玩具解碼器，使其在面對純文字 prompt 時能自主產出圖文混排回應。在訓練資料分佈為 60% 先文後圖、40% 先圖後文的設定下，測量模型自發選擇「先生成影像」與「先生成文字」的實際頻率。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Early fusion | 「早期融合純 Token 化」 | 影像在預訓練第 1 步起即被轉化為與文字共享詞彙表的離散 token 體系 |
| VQ-VAE | 「影像離散 Tokenizer」 | 結合 CNN、ViT 與碼本字典的自編碼器，將影像量化為 Transformer 可預測的整數索引 |
| Shared vocabulary | 「統一單一字典」 | 一個跨越文字、視覺離散索引以及模態控制分隔符號的全域 token ID 空間 |
| QK-Norm | 「注意力穩定神油」 | 在 Query 與 Key 計算注意力點積之前先行施加 LayerNorm，有效抑制數值範數爆炸 |
| Mixed-modality generation | 「圖文交錯混排生成」 | 模型在單次推論過程中，能夠根據情境自發且交錯生成文字與影像 token |
| Codebook size | 「K 個碼本向量」 | VQ-VAE 允許量化的離散代表向量總數；負責在壓縮率與視覺保真度之間進行權衡 |
| Tokenizer ceiling | 「離散重建上限」 | 透過離散解碼所能達到的最高 PSNR 峰值；直接錨定了早期融合模型的視覺生成天花板 |

## Further Reading｜延伸閱讀

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818) ——Meta 原創奠基論文
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520) ——因果遮罩多模態模型的前導探索
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591) ——自回歸圖文生成里程碑工作
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226) ——全模態任意對任意自回歸模型
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b) ——極簡純 Patch 直入大模型嘗試
