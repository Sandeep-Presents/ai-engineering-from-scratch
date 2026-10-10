# 視覺 Transformer 與 Patch-Token 原語（Vision Transformers and the Patch-Token Primitive）

> 在進行任何多模態處理之前，影像必須先轉化為 Transformer 能夠消化處理的 token 序列。2020 年的 ViT 論文以 16×16 像素 patch、線性投影以及 position embedding 解答了這個問題。五年過去，在 2026 年的每個尖端模型（例如具備 2576px 原生解析度的 Claude Opus 4.7、Gemini 3.1 Pro、Qwen3.5-Omni）依然以這種方式啟動——編碼器雖已從 ViT 演進至 DINOv2 再到 SigLIP 2，並引入了暫存器 token，位置編碼機制也進化為 2D-RoPE，但這個底層原語依然屹立不搖。本課帶你端到端剖析 patch-token 管線，並以純 Python 標準函式庫實作，為 Phase 12 後續課程建立堅實具體的「視覺 token」心智模型。

**Type:** Learn
**Languages:** Python (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 將形狀為 H×W×3 的影像轉換為具備正確位置編碼的 patch token 序列。
- 計算給定（patch 大小、解析度、隱藏維度、深度）的 ViT 之序列長度、參數量與 FLOPs。
- 指出促使 ViT 從 2020 年學術研究躍升至 2026 年正式環境生產的三大核心升級：自我監督預訓練（DINO / MAE）、暫存器 token 以及原生解析度打包。
- 為下游特定任務在 CLS 池化、平均池化與暫存器 token 之間做出正確取捨。

## The Problem｜問題

Transformer 運作於向量序列之上。文字本身就是天然的序列（位元組或 token）。然而影像是由具備三個色彩通道的像素所構成之二維網格——並非序列。若你將所有像素直接展平，一張 224×224 的 RGB 影像將產生 150,528 個 token，而在如此龐大的長度下進行自注意力運算完全不可行（運算複雜度隨序列長度呈二次方爆炸）。

2020 年以前的常見做法是在前端串接一個 CNN 特徵擷取器：由 ResNet 產出 2048 維向量構成的 7×7 特徵圖，再將這 49 個 token 餵入 Transformer。這種做法雖能運作，卻繼承了 CNN 的歸納偏置（平移等變性、局部感受野），並失去了 Transformer 吞吐規模化資料的強大潛力。

Dosovitskiy 等人（2020）提出了一個直截了當的靈魂拷問：如果我們完全捨棄 CNN 呢？將影像切割成固定尺寸的 patch（例如 16×16 像素），將每個 patch 線性投影為一個向量，加上 position embedding，最後將整個序列直接餵入最純粹的原生 Transformer。在當時這簡直是離經叛道——居然敢在視覺領域摒棄卷積。然而，在足夠龐大的資料（JFT-300M，後來的 LAION）餵養下，它在 ImageNet 上擊敗了 ResNet，並持續擴展突破。

到了 2026 年，ViT 原語已成為無可撼動的基石。所有開源權重 VLM 的視覺塔（vision tower）皆為其衍生架構（DINOv2、SigLIP 2、CLIP、EVA、InternViT）。如今的關鍵問題已不再是「我們該不該用 patch？」，而是「該用多大的 patch 尺寸、採用何種解析度策略、以何種預訓練目標最佳化，以及搭配何種位置編碼機制」。

## The Concept｜核心概念

### Patch 作為 Token

給定形狀為 `(H, W, 3)` 的影像 `x` 與 patch 尺寸 `P`，你將影像切割成 `(H/P) x (W/P)` 個不重疊的 patch 網格。每個 patch 皆為大小是 `P x P x 3` 的像素立方體。將每個立方體展平為 `3 P^2` 維度的向量。接著套用共用的線性投影矩陣 `W_E`（形狀為 `(3 P^2, D)`），將每個 patch 映射至模型的隱藏維度 `D`。

以 ViT-B/16 的經典標準組態為例：
- 解析度 224，patch 尺寸 16 → 網格 14×14 → 196 個 patch token。
- 每個 patch 為 `16 x 16 x 3 = 768` 個像素數值，投影至 `D = 768`。
- 加入一個可學習的 `[CLS]` token → 最終序列長度為 197。

在數學上，patch 投影等價於卷積核大小為 `P`、步長為 `P`、輸出通道數為 `D` 的二維卷積。正式環境程式碼正是如此高效實作的——`nn.Conv2d(3, D, kernel_size=P, stride=P)`。「線性投影」是概念上的架構心智模型；而卷積核的實作方式則是為了追求運算效率。

### 位置編碼與 Position Embedding

Patch 本身不具備任何固有順序——在 Transformer 眼中它們只是一堆雜亂無章的無序集合。早期的 ViT 會加上可學習的一維 position embedding（每個位置對應一個 768 維向量，共 197 個）。這種做法可行，但會將模型死死綁定於訓練時的固定解析度：在推論階段若改變網格大小，就必須對位置表進行插值。

現代視覺骨幹網路（backbone）多採用 2D-RoPE（如 Qwen2-VL 的 M-RoPE、SigLIP 2 的預設方案）或分解式二維位置編碼。2D-RoPE 依據 patch 的（列, 行）二維座標旋轉查詢與鍵向量，模型即可直接從旋轉角度推導出相對的二維空間位置。無需預先儲存位置表，使模型在推論階段能無縫支援任意解析度的網格尺寸。

### CLS Token、池化輸出與暫存器 Token

影像層級的整體表徵該如何提取？當前生態共存三種策略：

1. `[CLS]` token。在 patch 序列開頭前綴一個可學習向量。在通過所有 Transformer 區塊後，CLS token 的隱藏狀態即代表整張影像。此設計承襲自 BERT，為原創 ViT 與 CLIP 所採用。
2. 平均池化（Mean pool）。將所有 patch token 的輸出隱藏狀態取平均。SigLIP、DINOv2 及多數現代 VLM 採用此方案。
3. 暫存器 token（Register tokens）。Darcet 等人（2023）觀察到，若 ViT 在訓練時缺乏顯式的彙整接收 token，會自發在背景 patch 上形成高範數（high-norm）的「假影」異常點，進而干擾自注意力機制。額外引入 4 到 16 個可學習的暫存器 token 能夠吸收這些冗餘負荷，顯著提升密集預測（如分割、深度估計）的品質。DINOv2 與 SigLIP 2 皆原生內建暫存器機制。

這項抉擇對下游任務影響深遠。CLS 適用於單純分類；但對於需要將 patch token 餵入 LLM 的 VLM 而言，完全無需進行影像層級的池化——每個 patch 都會直接轉化為 LLM 的輸入 token。而暫存器 token 則會在交付給 LLM 之前被安全剔除（它們只是鷹架，並非實際內容）。

### 預訓練：監督式、對比式、遮蓋式與自我蒸餾

2020 年原版 ViT 採用 JFT-300M 上的監督式分類進行預訓練，隨後迅速被更強大的範式所取代：

- CLIP（2021）：在 4 億圖文對上進行對比式學習。詳見第 12.02 課。
- MAE（2021，He 等人）：隨機遮蓋 75% 的 patch 並重建原始像素。純自我監督，僅需未標註影像即可訓練。
- DINO（2021）／DINOv2（2023）：透過學生—教師網路進行自我蒸餾，無標籤、無文字描述。2023 年的 DINOv2 ViT-g/14 是最強大的純視覺骨幹網路，也是「密集特徵（dense features）」應用場景的標準首選。
- SigLIP ／ SigLIP 2（2023、2025）：採用 sigmoid 損失函式並支援原生長寬比 NaFlex 的改良版 CLIP。是 2026 年開源 VLM（Qwen、Idefics2、LLaVA-OneVision）最主流的視覺塔。

預訓練策略的選擇直接決定了骨幹網路的擅長領域：CLIP/SigLIP 專精於圖文語意對齊，DINOv2 擅長豐富的密集視覺特徵，而 MAE 則是下游 fine-tuning 適應的絕佳初始起點。

### 規模縮放法則

ViT 縮放法則（Zhai 等人 2022）確立了 ViT 在模型規模、資料量與運算量之間遵循高度可預測的冪律規律。在固定運算量下：
- 模型更大 + 資料更多 → 表徵品質更高。
- Patch 尺寸是序列長度與視覺保真度之間的平衡槓桿。Patch 14（DINOv2 / SigLIP SO400m 的常見規格）比 patch 16 產生更多 token，對 OCR 與密集預測任務更優異，但運算速度較慢。
- 解析度是另一個巨大槓桿。將解析度從 224 提升至 384 再至 512 幾乎必定能帶來提升，代價是 FLOPs 呈二次方增長。

ViT-g/14（10 億參數，patch 14，解析度 224 → 256 個 token）與 SigLIP SO400m/14（4 億參數，patch 14）是 2026 年開源 VLM 最核心的兩大主力編碼器。

### ViT 參數量計算

完整計算公式實作於 `code/main.py`。以解析度 224 的 ViT-B/16 為例：

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

在載入任何權重檢查點之前，務必以此方式粗估模型規格。骨幹網路的大小決定了任何下游 VLM 的 VRAM 最低門檻。

### 2026 年正式環境配置

2026 年多數開源 VLM 採用的標準編碼器為具備原生解析度（NaFlex）的 SigLIP 2 SO400m/14。其具備：
- 4 億參數。
- Patch 尺寸 14，預設解析度 384 → 每張影像產生 729 個 patch token。
- 影像層級任務採平均池化；視覺問答（VQA）時則將全數 729 個 patch 餵入 LLM。
- 4 個暫存器 token，在交付給 LLM 之前丟棄。
- 具備影像層級縮放因子的 2D-RoPE，以適應原生長寬比。

該組態中的每一項設計抉擇，皆能在對應的學術文獻中找到深刻的理論與實驗依據。

```figure
image-patch-tokens
```

## Use It｜實際應用

`code/main.py` 是一個 patch tokenizer 與幾何計算器。它接收（影像高 H、寬 W、patch 尺寸 P、隱藏維度 D、層數 L）並輸出：

- 切割 patch 後的網格形狀與序列長度。
- 針對合成的 8×8 像素玩具影像產生 token 序列（端到端演示展平與線性投影路徑）。
- 依 patch embedding、position embedding、Transformer 區塊與輸出層詳細拆解參數量。
- 目標解析度下單次前向傳播的 FLOPs。
- 橫跨 ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384 的綜合規格比對表。

實際動手運行它。比對各模型的參數量與公開論文數值。調整 patch 尺寸與解析度，親身感受 token 數量暴增帶來的運算成本壓力。

## Ship It｜交付成果

本課產出 `outputs/skill-patch-geometry-reader.md`。給定任一 ViT 組態（patch 尺寸、解析度、隱藏維度、深度），它將產出 token 數量、參數量與 VRAM 需求的評估報告與原理解釋。在為 VLM 選型視覺骨幹網路時請隨時善用此技能——它能防止「token 數量突然爆炸塞滿 LLM context」的災難。

## Exercises｜練習

1. 計算 Qwen2.5-VL 在原生 1280×720 解析度下搭配 patch 尺寸 14 的 patch-token 序列長度。這與僅使用 CLS 的表徵方式相比差異為何？

2. 一個 1080p 畫面（1920×1080）在 patch 14 下會產生多少個 token？在每秒 30 幀的 5 分鐘影片中，總共會產生多少視覺 token？池化、畫面抽樣與 token 合併這三種手段中，哪一種能為你節省最多運算成本？

3. 以純 Python 實作針對 patch token 的平均池化。驗證在 DINOv2 輸出的 196 個 token 上進行平均池化的結果，與該模型在請求池化 embedding 時呼叫 `forward` 所回傳的數值完全一致。

4. 閱讀《Vision Transformers Need Registers》（arXiv:2309.16588）的第三節。以兩句話說明暫存器 token 吸收了何種假影，以及為何這對下游的密集預測任務至關重要。

5. 修改 `code/main.py` 以支援 patch-n'-pack：給定一組不同解析度的影像清單，產出單一打包序列與對應的區塊對角注意力遮罩（block-diagonal attention mask）。在學到第 12.06 課時對照驗證你的實作。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|----------------|------------------------|
| Patch | 「16×16 像素方塊」 | 輸入影像中不重疊的固定尺寸局部區域；最終轉化為一個 token |
| Patch embedding | 「線性投影」 | 共用的學習矩陣（或 stride=P 的 Conv2d），將展平後的 patch 像素映射為 D 維向量 |
| CLS token | 「類別 token」 | 前綴的可學習向量，其最終隱藏狀態代表整張影像；在 2026 年已非絕對必選 |
| Register token | 「接收器／水槽 token」 | 額外的可學習 token，專門吸收 ViT 在預訓練期間產生的高範數注意力假影 |
| Position embedding | 「位置資訊」 | 賦予序列空間位置感知的逐位置向量或旋轉機制；2D-RoPE 為現代預設標準 |
| Grid | 「Patch 網格」 | 給定解析度與 patch 尺寸下形成的 (H/P) × (W/P) 二維 patch 陣列 |
| NaFlex | 「原生彈性解析度」 | SigLIP 2 的特色機制：單一模型無需重新訓練即可支援多種長寬比與解析度 |
| Backbone | 「視覺塔（vision tower）」 | 預訓練的影像編碼器，其輸出的 patch token 作為多模態模型中 LLM 的輸入 |
| Pooling | 「影像層級摘要」 | 將眾多 patch token 彙整為單一向量的策略：CLS、平均、注意力池化或基於暫存器 |
| Patch 14 vs 16 | 「精細與粗粒度網格」 | Patch 14 每張圖產生更多 token，對 OCR 保真度更高但運算較慢；patch 16 則是經典預設 |

## Further Reading｜延伸閱讀

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) ——原創 ViT 論文
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) ——MAE 自我監督預訓練
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) ——大規模自我蒸餾，無標籤監督
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) ——暫存器 token 與注意力假影剖析
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) ——2026 年預設的主流視覺塔
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) ——經驗縮放法則
