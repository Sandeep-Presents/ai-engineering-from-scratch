# Emu3：基於下一個 Token 預測的影像與視訊生成（Emu3: Next-Token Prediction for Image and Video Generation）

> 北京智源人工智慧研究院（BAAI）的 Emu3（Wang 等人，2024 年 9 月）堪稱本該為「擴散 vs 自回歸」世紀大辯論劃下句點的震撼成果。一個純粹的 Llama 風格僅解碼器（Decoder-Only）Transformer，僅依賴「下一個 token 預測（Next-Token Prediction）」單一目標，在涵蓋文字、2D 影像 VQ token 與 3D 視訊 VQ token 的大一統詞彙表上進行訓練，在影像生成品質上擊敗了 SDXL，在多模態感知評測中超越了 LLaVA-1.6。零 CLIP 損失、零擴散加噪時程。推論時採用無分類器引導（Classifier-Free Guidance, CFG）提升成圖保真度，但訓練核心始終是最純粹的教師強制自回歸預測。該成果正式發表於《Nature》。本課深入拆解 Emu3 的核心論點——為何「一個更頂級的 Tokenizer 加上足夠的參數量擴展」便是你所需的全部——並與主流擴散模型展開全方位對比。

**Type:** Learn
**Languages:** Python (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 解釋為何儘管長期以來業界普遍深信「高品質影像生成必備擴散模型」，Emu3 的單一「下一個 token 預測」目標依然能打破迷思。
- 深入說明 3D 視訊 Tokenizer：時空 VQ 碼本的內部幾何構造，以及為何 patch 需要跨越時間維度。
- 在訓練算力、推論開銷與品質天花板三大維度上，深入對比 Emu3 與 Stable Diffusion XL 的工程優劣。
- 指出同一個 Emu3 檢查點所兼任的三大功能角色：Emu3-Gen（影像生成）、Emu3-Chat（多模態感知對話）與 Emu3-Stage2（視訊生成）。

## The Problem｜問題

直至 2024 年，產學界始終深植著一項定論：影像生成必須依賴擴散模型（Diffusion Models）。其論據看似無懈可擊：離散影像 token 在量化過程中遺失了太多高頻細節，難以完美還原像素；而自回歸取樣在跨越數千個 token 的長程生成中，會不可避免地累積誤差。Stable Diffusion、DALL-E 3、Imagen、Midjourney 全無例外皆建立在某種擴散形式之上。Chameleon（第 12.11 課）雖然在小規模上嘗試突圍，但在視覺生成品質上依然無法望 SDXL 之項背。

Emu3 正面挑戰了這項成見。其核心論點簡潔而霸氣：只要擁有更優異的視覺 Tokenizer + 足夠大的模型規模擴展 + 最純粹的下一個 token 預測損失，便能在同一個原生模型內部，同時實現超越擴散模型的影像生成品質與頂級的多模態感知理解能力。

該成果在剛發表時引發了巨大爭議。然而兩年過去，以 Emu3、Show-o、Janus-Pro 與 Transfusion 為代表的「大一統生成（Unified Generation）」體系，已然成為前沿多模態研究的絕對顯學；而各大主流閉源實驗室的前沿模型，顯然亦在內部廣泛採用了某種相似變體。

## The Concept｜核心概念

### Emu3 專屬 Tokenizer

最關鍵的核心殺手鐧在於其客製化視覺 Tokenizer。Emu3 訓練了一款基於逆向瓶頸量化器（IBQ，源自 SBER-MoVQGAN 家族）的離散 Tokenizer，每個 token 達成 8×8 的空間維度壓縮。一張 512×512 的影像被轉化為 64×64 = 4096 個離散 token，碼本容量高達 32,768。

這雖然比 Chameleon 在 512×512 尺寸下的 1024 個 token（K=8192）產生了更多 token，但單一 token 的解碼開銷更為低廉。最關鍵的量化指標在於：其重建峰值訊噪比（PSNR）達到了驚人的 30.5 dB，完全逼近了 Stable Diffusion 在連續潛在空間上的 32 dB 水準！

在影片領域：3D VQ Tokenizer 將一個時空立方體 patch（4×4×4 像素）直接編碼為單一整數索引。一段包含 32 幀（4 秒長度、每秒 8 幀）的 256×256 視訊剪輯，在經過 4 倍空間與 4 倍時間壓縮後，產生的視覺 token 總數為 (256/4) × (256/4) × (32/4) = 64 × 64 × 8 = 32,768 個。

Tokenizer 的重建水準是整體系統的硬性天花板。Emu3 的重大成功，很大一部分歸功於「訓練出了一個極致頂級的離散 Tokenizer」。

### 單一損失聯合訓練

Emu3 始終堅守單一目標：在跨越文字 token、2D 影像 token 與 3D 視訊 token 的統一詞彙表上，進行純粹的下一個 token 預測。在訓練過程中，僅透過乘以各模態特定的平衡權重係數來調節梯度貢獻，損失函式的形式始終維持百分之百純粹的一致性。

模型在高度混合的多模態資料上展開聯合預訓練：
- 影像生成樣本：`<text caption> <image> image_tokens </image>`
- 影像感知樣本：`<image> image_tokens </image> <question> text_tokens`
- 影片生成樣本：`<text caption> <video> video_tokens </video>`
- 視訊理解樣本：比照對應的視訊問答排版。
- 純文字樣本：標準因果語言建模預測。

模型自發從資料分佈中學會何時該輸出影像 token、何時該輸出文字 token。圖像生成能力的產生，純粹源自於模型在 `<image>` 起始標記後，自發預測出連貫合理的影像離散 token 序列。

### 無分類器引導（CFG）與溫度調控

自回歸影像生成在推論階段若引入無分類器引導（Classifier-Free Guidance, CFG），成圖品質會產生戲劇性躍升。Emu3 借鑑了此機制：在推論時模型計算兩次前向傳播——一次傳入完整文字描述（條件生成），另一次傳入空白文字描述（無條件生成）——並透過引導權重 gamma（通常設定為 3.0 到 7.0）將兩組 logit 進行線性混合。這項擴散模型界的神油技巧，被完美移植至純自回歸生成場景。

取樣溫度（Temperature）的設定同樣極其敏感：溫度過高會導致畫面充斥斑駁雜訊；溫度過低則會引發模式崩潰（Mode Collapse）。Emu3 官方推薦的黃金設定為：執行感知問答時取 1.0；執行影像生成時取 0.8。

### 單一模型的多元角色

Emu3 以三種功能完全相異的 API 形式對外釋出，但底層完全共享同一套完全相同的模型權重檢查點：

- Emu3-Gen：純影像生成。輸入文字 prompt，輸出連續影像 token。
- Emu3-Chat：視覺問答（VQA）與圖文描述。輸入影像 token，輸出文字解答。
- Emu3-Stage2：視訊生成與視訊問答。輸入文字或視訊影格，生成流暢影片或文字分析。

完全沒有為不同任務加裝任何額外的特化預測頭。僅憑不同的 prompt 模板，全權由同一個權重解讀處理。

### 基準評測表現

摘自 Emu3 論文實測報告（2024 年 9 月）：

- 影像生成能力：在 MJHQ-30K 評測集的 FID 分數上擊潰了 SDXL（5.4 vs 5.6，數值越低越佳）；在 GenEval 總分上取得統計平手（0.54 vs 0.55）；在 Deep-Eval 綜合評測中旗鼓相當。
- 影像感知理解能力：在 VQAv2 上擊敗了專門的視覺大模型 LLaVA-1.6（75.1 vs 72.4），並在複雜多學科評測 MMMU 上平分秋色。
- 影片生成能力：產出 4 秒高畫質短片，在 FVD 視訊品質評測上比肩 Sora 時期發布的各主流基準模型。

這些評測成績宣告了一項重要里程碑：雖然在極少數專門子項上與特化模型各有勝負，但「下一個 token 預測足以通吃全模態」的論點在實證上已然完全站得住腳。

### 運算開銷與推論成本

Emu3 在 70 億（7B）參數量級下，於約 3,000 億多模態 token 上完成了完整預訓練。其消耗的 GPU 小時大約等同於從零訓練一個 Llama-2-7B（約 2000 到 4000 A100 GPU 年）。相較之下，Stable Diffusion 3 等擴散模型在總訓練預算上大致相仿，卻必須依賴額外複雜的文字編碼器、多階段擴散排程器以及更繁複的資料管線。

然而在推論階段，Emu3 的生成速度明顯慢於 SDXL：生成一張 512×512 影像需要逐一產出 4096 個 token，以每秒 30 個 token 的推論速度計算需耗時約 2 分鐘；而 SDXL 僅需 2 到 5 秒即可出圖。儘管投機解碼（Speculative Decoding）與 KV 快取最佳化能大幅收窄差距，但自回歸圖像生成計算開銷沈重，依然是現階段無法忽視的客觀工程代價。

### 為何此成果意義深遠

Emu3 最深遠的貢獻在於概念上的徹底釋放。如果單純的下一個 token 預測就能在圖像生成上比肩甚至擊敗擴散模型，那麼「單一因果損失、單一 Transformer 骨幹、橫跨任意模態」的大一統模型路線便完全具備了可行性。未來的世界不再需要為文字、影像與語音分別維護各自孤立的專屬編碼器、排程器與擴散模型。只需一個 Transformer 加上各模態專屬的高品質 Tokenizer，便能坐享規模擴展帶來的強大紅利。

Show-o、Janus-Pro 與 InternVL-U 等後續架構，皆在此基礎上持續深耕；大一統多模態自回歸模型正在以驚人的速度重塑整個 AI 生態。

```figure
l5-emu3-next-token
```

## Use It｜實際應用

`code/main.py` 實作了兩大關鍵核心原型：

- 2D vs 3D VQ Tokenizer 幾何計算器：給定（影像解析度、patch 尺寸、影片秒數、FPS），自動推導影像與視訊的視覺 token 數量。
- 結合無分類器引導（CFG）與取樣溫度的自回歸影像 token 取樣器原型。

其 CFG 演算法嚴格對齊 Emu3 的工程實作——在機率 logit 空間中，精準混合條件路徑與無條件路徑的預測結果。

## Ship It｜交付成果

本課產出 `outputs/skill-token-gen-cost-analyzer.md`。給定具體的生成產品規格（影像或視訊、目標解析度、品質要求等級、推論延遲上限），它能自動精算端到端 token 總量、預估伺服器推論開銷，並在 Emu3 家族（自回歸體系）與擴散模型體系之間做出明確的工程選型裁決。

## Exercises｜練習

1. Emu3 在 8×8 空間壓縮下，一張 512×512 影像會產生 4096 個 token。請計算在 1024×1024 與 2048×2048 解析度下會產生多少個視覺 token？這會對自回歸推論延遲造成何種致命影響？

2. 閱讀 Emu3 論文第 3.3 節關於視訊 Tokenizer 的論述。描述其 3D VQ 的時空 patch 形狀，並解釋為何選擇 4×4×4 的立方體，而非 8×8×1 的二維平面切片。

3. 將無分類器引導（CFG）的權重從 3.0 調升至 5.0，會對生成畫面的飽和度與語意忠實度產生何種具體視覺影響？追蹤 `code/main.py` 中的數學公式加以說明。

4. 估算 Emu3-7B 在 3,000 億 token 訓練下的總運算量（FLOPs），並與 Stable Diffusion 3 的訓練開銷進行對比。兩者在訓練資源消耗上有何本質差異？

5. Emu3 在 FID 成圖指標上擊潰了 SDXL，但在 VQAv2 多模態感知評測上卻稍遜於最頂級的特化型 VLM。請深入分析為何大一統損失路線在不同性質的基準評測中，會與專項特化模型展現出不同的強弱消長。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Next-token prediction | 「下一個 Token 預測」 | 經典的自回歸語言建模損失，給定前文預測下一個離散標記；只要離散化即可通吃全模態 |
| IBQ tokenizer | 「逆向瓶頸量化器」 | 具備超大碼本容量（32,768+）的頂級 VQ-VAE，其像素重建保真度大幅超越早期方案 |
| 3D VQ | 「時空量化器」 | 索引涵蓋時間、高度與寬度三維度的立體碼本；單一整數 token 即可覆蓋 4×4×4 的像素立方體 |
| Classifier-free guidance | 「CFG 引導係數」 | 將條件生成與無條件生成的 logit 依權重 gamma 進行線性混合，顯著推升生成畫面品質 |
| Unified vocabulary | 「大一統共用詞彙表」 | 文字、2D 影像與 3D 視訊完全共享同一個整數 ID 空間；模型自主決定下一個輸出的模態 |
| MJHQ-30K | 「Midjourney 高畫質基準」 | 包含 3 萬組 prompt 的生成評測集；Emu3 在此報告了超越 SDXL 的優異 FID |

## Further Reading｜延伸閱讀

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869) ——Emu3 奠基論文
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222) ——前身工作
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268) ——百萬長時序百萬 token 視訊模型
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737) ——頂級視訊量化 tokenizer
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905) ——視覺自回歸建模新範式
