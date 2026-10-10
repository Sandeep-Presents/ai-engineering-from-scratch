# Transfusion：自回歸文字加擴散影像於單一 Transformer（Transfusion: Autoregressive Text + Diffusion Image in One Transformer）

> Chameleon 與 Emu3 將一切全盤押注在離散 token 之上。這套做法雖然能行，但量化資訊瓶頸顯而易見——其影像生成品質始終被壓制在連續空間擴散模型的水準之下。Transfusion（Meta，Zhou 等人，2024 年 8 月）採取了截然相反的技術路徑：徹底拋棄 VQ-VAE，維持影像特徵的連續性，並在單一 Transformer 骨幹上同時施加雙重損失函式進行聯合訓練。文字 token 遵循「下一個 token 預測」；影像 patch 則計算流匹配（Flow Matching）與擴散損失。兩大目標在同一個權重空間中共同收斂。Stable Diffusion 3 底層的 MMDiT 架構正是其孿生兄弟。本課深入解構 Transfusion 的核心論證、手刻雙損失訓練器原型，並精確剖析讓單一 Transformer 同時兼顧雙重任務的關鍵注意力遮罩。

**Type:** Build
**Languages:** Python (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 建構一個在單一骨幹網路上同時計算雙重損失（文字 token 算 NTP、影像 patch 算擴散 MSE）的統一 Transformer。
- 深入解釋為何「影像 patch 內部雙向注意力」加上「文字 token 因果自注意力」是唯一的最佳遮罩設計。
- 在運算複雜度、成圖保真度與程式碼工程難度三大維度上，深入對比 Transfusion 體系（連續影像 + 擴散損失）與 Chameleon 體系（離散影像 + NTP）。
- 掌握 MMDiT 的核心創新貢獻：各區塊內部的專屬模態權重，以及在殘差串流上的全域聯合注意力。

## The Problem｜問題

「離散 token vs 連續向量」的長年大爭論，歷史遠比現代大語言模型悠久。連續表徵（原始像素、VAE 連續潛在空間）能完好保留豐富的微觀紋理細節；而離散 token（VQ 碼本索引）雖然能天然融入 Transformer 的原生詞彙表中，卻在向量量化（Quantization）階段不可逆地損失了大量高頻訊號。

Chameleon 與 Emu3 堅定走向離散路線：單一損失、單一架構，但影像生成的天花板受制於離散 Tokenizer 的重建極限。

主流擴散模型則堅持走連續路線：具備驚人的視覺逼真度，但模型本身與 LLM 彼此孤立，且伴隨著極度繁複的噪聲排程工程，難以與自回歸文字生成進行深度原生融合。

Transfusion 大膽提出一個兩全其美的方案：我們能否兼得兩者之長？維持影像的連續實數表徵、依然使用單一 Transformer 模型，但透過精巧的雙重損失函式，將兩者縫合於同一次反向傳播梯度更新中。

## The Concept｜核心概念

### 雙損失大一統架構

單一僅解碼器（Decoder-Only）Transformer 接收一條包含以下內容的混合序列：

- 文字 token（源自 BPE 詞彙表的離散整數索引）。
- 影像 patch（連續實數向量，16×16 像素塊經線性投影映射至隱藏維度——與 ViT 編碼器的輸入層完全一致）。
- `<image>` 與 `</image>` 標籤，用以精確界定連續 patch 的起訖邊界。

全模型僅執行單次前向傳播。在輸出端，依據當前 token 的模態屬性動態掛載兩套預測頭之一：

- 針對文字 token：在詞彙表 logit 預測頭上計算標準的交叉熵損失。
- 針對影像 patch：在連續 patch 上計算擴散損失——預測注入各 patch 中的隨機噪聲向量。

梯度反向傳播流經全域共用的 Transformer 本體。兩種完全相異的損失目標，在同一個時間步同步雕琢強化同一套模型權重。

### 注意力遮罩：因果文字加雙向影像

文字 token 必須維持因果關係——任何文字 token 絕對不可提前窺見未來的文字，否則教師強制機制將徹底失效。然而影像 patch 本身代表的是同一個靜態瞬間的空間切片；在同一個影像區塊內部，各 patch 之間理應展開無死角的雙向注意力凝視。

其混合注意力遮罩矩陣設計如下：

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i_image_end)   # text attends to previous images
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

在訓練與推論階段，皆被嚴格實作可視為「區塊三角注意力遮罩（Block-Triangular Mask）」。

### Transformer 內部的擴散損失機制

其擴散損失採用標準公式：為影像 patch 添加噪聲，並要求模型預測噪聲（或等價地預測乾淨 patch）。Transfusion 實作中採用了流匹配（Flow Matching）——直接預測從噪聲流向清晰影像的速度場（velocity field）。

訓練流程：
1. 針對每個影像 patch x0，均勻隨機取樣時間步 t。
2. 取樣標準高斯噪聲 ε，計算線性插值 xt = (1-t) * x0 + t * ε。
3. Transformer 預測速度場 v_theta(xt, t)；損失函式取均方誤差 MSE(v_theta(xt, t), ε - x0)。
4. 與同序列中的文字 NTP 交叉熵損失相加後，執行聯合反向傳播。

在推論階段，生成流程為：
- 文字 token：執行標準的自回歸逐步取樣。
- 影像 patch：以先前的文字 token 為條件引導，執行擴散去噪迴圈（通常需 10 到 30 個步長）。

### MMDiT：Stable Diffusion 3 的架構變體

Stable Diffusion 3（Esser 等人，2024 年 3 月）在大致相同的時間推出了多模態擴散 Transformer（MMDiT）。兩者在架構思想上堪稱孿生兄弟。

MMDiT 的關鍵差異在於：

- 各區塊專屬的模態獨立權重：每個 Transformer 區塊為文字 token 與影像 patch 分別維護獨立的 Q、K、V 與 MLP 權重矩陣。注意力運算則是全域聯合的（跨模態交互）；其餘運算則模態隔離。
- 整流流（Rectified Flow）訓練：一種具備直線性取樣軌跡且數學形式比 DDPM 更簡潔的流匹配變體。
- 規模擴展：MMDiT 作為 SD3 的核心骨幹（提供 2B 與 8B 多種規格）。Transfusion 論文則成功擴展至 70 億（7B）參數量級。

兩者皆殊途同歸地收斂至同一共識：由單一 Transformer 統一承擔文字端自回歸 NTP 與影像端連續擴散去噪。

### 為何此方案能超越 Chameleon 體系

連續擴散與離散 NTP 在成圖保真度上的質量差距，在客觀指標上顯而易見。Transfusion 論文實測顯示：

- 在同為 7B 參數規模下，Transfusion 在成圖 FID 指標上以 3 到 5 個點的巨大差距超越了 Chameleon 體系。
- 無需預先耗時訓練離散 Tokenizer——其影像前端極度簡潔（僅需純線性層將像素投影至隱藏維度，與 ViT 輸入層無異）。
- 在推論時，影像 patch 的去噪過程能在空間上高度平行運算，遠比逐一自回歸吐出數千個影像 token 更具吞吐優勢。

客觀工程代價：Transfusion 是一個典型的雙損失系統，其訓練動態更具挑戰性。兩大損失項的權重比例極度敏感；NTP 與擴散損失在收斂節奏上的步調失配，容易引發其中一端被邊緣化的風險。

### 後續演進技術版圖

Janus-Pro（第 12.15 課）進一步解耦了視覺編碼器——理解任務採用 SigLIP，生成任務採用 VQ，同時共用 Transformer 本體。Show-o（第 12.14 課）則嘗試將連續擴散替換為離散擴散（遮蓋式預測）。在大統一生態系中，技術體系在 Transfusion 之後迅速衍生出多元流派。

在 2026 年能夠主動輸出影像的前沿多模態大模型中——包括 Gemini 3 Pro、GPT-5 以及 Claude Opus 4.7 的圖像生成路徑——其底層極可能皆運作著該家族的某種變體演進架構。

```figure
cfg-guidance-scale
```

## Use It｜實際應用

`code/main.py` 在微型 MNIST 風格任務上實作了完整的 Transfusion 原型：

- 文字描述為表徵數字（0-9）的簡短整數序列。
- 影像為 4×4 的微型位元組網格。
- 以一組共享權重的線性投影層作為 Transformer 的抽象代表；文字端計算 NTP 交叉熵損失，影像端計算噪聲 patch 的 MSE 均方誤差損失。
- 訓練迴圈交替計算雙重損失，並嚴格實作了顯式區塊三角注意力遮罩。
- 推論常式在單次前向調度中，無縫生成圖文並茂的連貫回應。

雖然模型維度極小，但其雙損失銜接機制、注意力遮罩建構邏輯與推論取樣迴圈，與正式生產系統百分之百同構。

## Ship It｜交付成果

本課產出 `outputs/skill-two-loss-trainer-designer.md`。給定全新的多模態聯合任務（文字 + 影像、文字 + 音訊、文字 + 視訊），它能為其量身規劃雙損失排程體系（損失平衡權重、遮罩幾何形狀、共用 vs 模態特化區塊設定），並深度預警潛在的梯度失衡風險。

## Exercises｜練習

1. 一個 Transfusion 風格的模型在訓練時分配 70% 的 token 給文字、30% 給影像 patch。實測發現影像擴散損失在數值量級上約為文字 NTP 損失的 10 倍。該設定何種平衡權重比例才能穩定兩者的梯度貢獻？

2. 為序列 `[T, T, <image>, P, P, P, P, </image>, T]` 實作二維區塊三角注意力遮罩矩陣。精確標註每一個座標項的值為 0 還是 1。

3. MMDiT 引入了模態特化的 QKV 權重矩陣。相較於 Transfusion 完全共用權重的 Transformer，這額外增加了多少參數量？在 7B 規模下，這筆算力與記憶體開銷是否值得？

4. 推論計算量評估：給定一段文字 prompt，模型先自回歸生成 50 個文字 token，隨後遇到 `<image>` 標籤，接著在 256 個 patch 上執行 20 步擴散去噪迴圈。總計需要執行多少次 Transformer 前向傳播？

5. 閱讀 SD3 論文第 3 節。描述整流流（Rectified Flow）的直線性數學原理，並解釋為何它相較於傳統 DDPM 能在顯著更少的推論步長下迅速收斂。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Two-loss training | 「雙損失聯合訓練」 | 單一 Transformer 在同一次梯度更新中，同時最佳化文字交叉熵與連續影像 MSE 損失 |
| Flow matching | 「流匹配／整流流」 | 一種擴散模型變體，直接預測從純噪聲流向清晰資料的速度場；數學形式比 DDPM 更直觀 |
| MMDiT | 「多模態擴散 Transformer」 | Stable Diffusion 3 採用的核心架構：全域聯合注意力搭配模態特化的專屬 MLP 與 Norm 層 |
| Block-triangular mask | 「區塊三角遮罩」 | 對文字序列維持嚴格因果因果遮罩，但對影像內部區域開放全域雙向注意力的混合遮罩 |
| Continuous image representation | 「純連續無量化」 | 直接將影像 patch 視為實數向量進行處理，徹底告別 VQ 離散碼本量化造成的細節丟失 |
| Velocity prediction | 「v 參數化預測」 | 類神經網路直接預測噪聲與乾淨資料之間的瞬時速度向量場，而非直接預測噪聲本身 |

## Further Reading｜延伸閱讀

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039) ——Meta 原創核心論文
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206) ——MMDiT 架構與整流流
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748) ——擴散 Transformer 先驅
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280) ——單一 Transformer 多模態探索
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528) ——離散擴散大一統模型
