# Janus-Pro：大一統多模態模型的解耦編碼器架構（Janus-Pro: Decoupled Encoders for Unified Multimodal Models）

> 大一統多模態模型始終面臨著不可調和的內在張力。多模態「理解」渴求語意特徵——例如 SigLIP 或 DINOv2 產出的高維特徵向量，富含深度的概念抽象；多模態「生成」則渴求便於像素還原的重構碼——例如能清晰解碼回銳利像素的 VQ 離散 token。這兩種截然不同的目標，根本無法在單一視覺編碼器中和平共存。DeepSeek 的 Janus（2024 年 10 月）與 Janus-Pro（2025 年 1 月）指出了一條明路：別再試圖強行調和，果斷「解耦」這兩大編碼器！在底層完全共享 Transformer 骨幹大腦，但在輸入端依任務將理解導流至 SigLIP，將生成導流至專屬的 VQ Tokenizer。在僅僅 7B 的參數量下，Janus-Pro 在 GenEval 評測上擊潰了 DALL-E 3，並在 MMMU 上打平了 LLaVA。本課帶你洞悉雙編碼器架構何以在單編碼器折戟之處大獲全勝。

**Type:** Build
**Languages:** Python (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 解釋為何單一共享編碼器必然會在理解深度或生成保真度兩者之一做出痛苦妥協。
- 深入說明 Janus-Pro 的路由機制：理解任務在輸入端導流至 SigLIP 特徵，生成任務在輸入與輸出端皆導流至 VQ token。
- 剖析讓 Janus-Pro 克服初代 Janus 侷限並取得成功的資料混合規模化擴展軌跡。
- 全方位對比解耦架構（Janus-Pro）、連續耦合架構（Transfusion）與離散耦合架構（Show-o）的工程優劣。

## The Problem｜問題

大一統多模態模型的核心理念，是讓單一 Transformer 本體跨界兼顧感知理解與主動生成。先前的代表性嘗試（Chameleon、Show-o、Transfusion）皆試圖為這兩個方向共用同一個視覺 Tokenizer。然而這款 Tokenizer 不可避免地成為妥協的產物：

- 若以像素「精準重建（生成）」為最佳化目標：VQ-VAE 雖然捕捉了細緻微觀的局部紋理，產出的離散 token 卻缺乏宏觀的語意凝聚力。
- 若以宏觀「語意對齊（理解）」為最佳化目標：SigLIP 的 embedding 空間雖然能將「貓」的影像精準分群在文字「貓」附近，卻完全喪失了解碼還原為高畫質像素的能力。

Show-o 與 Transfusion 皆為這種單一編碼器的內在衝突付出了肉眼可見的品質代價。Janus-Pro 直球發問：既然理解與生成本質需求迥異，為何非得強逼它們共用同一個視覺編碼器？

## The Concept｜核心概念

### 解耦視覺編碼機制

Janus-Pro 的核心設計徹底拆分了兩大編碼路徑：

- 理解路徑（Understanding path）：輸入影像 → SigLIP-SO400m 視覺塔 → 雙層 MLP 投影器 → 餵入共用的 Transformer 本體。
- 生成路徑（Generation path）：輸入影像（若作為條件引導圖）→ 專屬 VQ Tokenizer → 離散 token ID → 餵入共用的 Transformer 本體。
- 輸出生成端：Transformer 預測出的影像離散 token → 專屬 VQ 解碼器 → 彩現還原為實體像素。

Transformer 骨幹大腦完全共享。骨幹本體上游與下游的所有模態編碼與解碼元件，皆依任務性質嚴格特化隔離。

在輸入端透過 prompt 格式進行確定性路由分流：帶有 `<understand>` 標記的請求導流至 SigLIP；帶有 `<generate>` 標記的請求則導流至 VQ 編碼器；或依據任務類型隱式自動判斷。

### 為何此設計能破局生效

多模態理解損失直接享受到 SigLIP 產出的優質語意特徵，這些特徵早已在海量對比學習中對齊了文字世界的高階語意。因此模型在感知評測上的表現，顯著超越了被 VQ 碼本限制語意的 Show-o 或 Transfusion。

而影像生成損失則直接作用於專為像素重建打磨的 VQ 離散 token。因為 VQ 碼本索引能精準無損地還原銳利線條與飽和色彩，其成圖品質直接超越了 Show-o。

底層共用的 Transformer 本體同時接收這兩種不同統計特性的輸入分佈（SigLIP 連續特徵與 VQ 離散索引），並在海量資料淬鍊下學會了自如駕馭兩端。其核心實證假設為：只要模型參數量夠大、訓練資料夠充沛，單一 Transformer 骨幹完全有能力吸收這種雙分佈切換。

### 資料規模擴展——Janus vs Janus-Pro

初代 Janus（arXiv:2410.13848）驗證了編碼器解耦的概念可行性，但受限於較小的模型規模（13 億參數）與有限的訓練資料。Janus-Pro（arXiv:2501.17811）則展開了全面的規模化擴展：

- 模型規模躍升至 70 億（7B）參數。
- 第 1 階段（特徵對齊）訓練資料從 7,200 萬圖文對大幅擴充至 9,000 萬。
- 第 2 階段（大一統預訓練）資料從 2,600 萬激增至 7,200 萬。
- 第 3 階段額外注入了 20 萬條高畫質文生圖指令資料。

成果驚艷：7B 規模的 Janus-Pro 在 MMMU 感知基準上打平了專門的多模態大模型 LLaVA（60.3 vs ~58），並在 GenEval 文生圖綜合評測中以 0.80 的高分超越了專有的 DALL-E 3（0.67）。一個開源模型，在理解與生成兩大極端同時展現出前沿競爭力。

### JanusFlow——整流流連續生成變體

JanusFlow（arXiv:2411.07975）進一步將生成路徑的離散 VQ 方案替換為連續空間的整流流（Rectified Flow）。架構演變為「SigLIP 主攻多模態理解 + 整流流主攻連續影像生成」。影像生成品質上限進一步推升，而核心骨架依然堅守「解耦雙編碼器 + 共享 Transformer 本體」的成功模式。

### 共享 Transformer 本體的職責使命

Transformer 本體處理單一的序列，但需適應兩大輸入分佈。它的核心職責劃分為：

- 執行理解任務時：消化 SigLIP 連續特徵與文字 token → 自回歸輸出文字回應。
- 執行生成任務時：消化文字 prompt 與可選的條件影像 VQ token → 自回歸輸出影像 VQ 離散 token。

Transformer 本體內部沒有任何模態特化的層級權重。它就是你所熟知、運作於 Qwen 或 Llama 內部的經典 Transformer 大腦，僅在外部銜接了兩套獨立的模態適配器。

極具工程價值的是：這意味著 Janus-Pro 的骨幹大腦可以直接從現成的預訓練文字 LLM 進行權重初始化！Janus-Pro 實務上正是從 DeepSeek-MoE-7B 進行初始化。這項決定性抉擇賦予了模型強大的通用推理能力，而這正是純粹從零從頭預訓練的統合模型往往難以望其項背的。

### 與 InternVL-U 的架構對比

InternVL-U（第 12.10 課）是 2026 年的後續集大成者。它深度融合了：

- 原生多模態預訓練（承襲 InternVL3 骨幹）。
- 解耦編碼器分流路由（輸入端採 SigLIP，輸出端兼具 VQ 與擴散生成頭）。
- 統合視覺理解、文生圖與影像精細編輯。

InternVL-U 將 Janus-Pro 的解耦編碼思維納入更宏大的原生體系。解耦編碼已成為當前超大規模大一統模型的主流標準。

### 架構侷限與選型邊界

解耦編碼器必然會引入額外的架構複雜度：需要同時維護兩套獨立的 Tokenizer、兩條平行的前向資料流，以及應對兩種不同的邊界失效模式。若產品僅需純視覺問答，Janus-Pro 顯然過度工程化——選用 LLaVA 家族純理解模型更輕量穩定。

若業務僅需單純的文生圖，Janus-Pro 亦顯繁瑣——直接選用專門的 Stable Diffusion 3 或 Flux 更為專精。

但若你的業務必須在單一開源端點上，同時提供高水準的視覺對話、圖表推理與高畫質圖片自主生成，Janus-Pro 堪稱目前開源領域首屈一指的參考架構。

```figure
l5-janus-decouple
```

## Use It｜實際應用

`code/main.py` 完整模擬了 Janus-Pro 的分流路由機制：

- 兩個模擬編碼器：類 SigLIP 編碼器（產出 256 維語意向量）與類 VQ 編碼器（產出離散整數碼）。
- Prompt 路由調度器：依據任務標記動態指派正確的視覺編碼路徑。
- 共享 Transformer 骨幹原型：無差別處理各編碼器送入的 token 序列。
- 模擬從第 1 階段（特徵對齊）演進至第 3 階段（指令調校）的加權樣本排程調度。

運行該程式碼，印出三組典型實例（影像問答、文生圖、圖生圖編輯）的分流路徑日誌。

## Ship It｜交付成果

本課產出 `outputs/skill-decoupled-encoder-picker.md`。當產品需要在前沿水準下兼具大一統影像生成與深度理解時，它能在 Janus-Pro、JanusFlow 與 InternVL-U 之間精確權衡，並給出具體的訓練資料規模規劃建議。

## Exercises｜練習

1. Janus-Pro-7B 在 GenEval 評測上擊敗了 DALL-E 3。請深入分析為何一個 7B 的開源模型能在影像生成上追平甚至超越專有旗艦模型，但在多模態複雜推理上卻仍有落差？

2. 實作一個前端路由器函式：給定使用者輸入的 prompt 文字，自動將其分類為 `understand` 或 `generate`。面對「先詳細描述這張圖，然後依此畫一張速寫草圖」這類複合模糊 prompt，該如何設計優雅的拆解或流水線路由機制？

3. JanusFlow 將原先的 VQ 生成路徑更換為整流流（Rectified Flow）。此時 Transformer 骨幹本體的輸出目標轉變為何？損失函式發生了何種相應變化？

4. 試著為 Janus-Pro 架構提議第四種潛在的專屬解耦編碼器。例如引入 DINO 進行密集語意分割，或引入 MiDaS 進行精準幾何深度估計。

5. 閱讀 Janus-Pro 論文第 4.2 節關於資料規模擴展的消融實驗結果。哪一個訓練階段的資料擴充對文生圖品質帶來的增益幅度最為顯著？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Decoupled encoding | 「視覺雙編碼器」 | 依任務方向拆分獨立編碼器：理解端採高階語意特徵，生成端採易於重構的離散標記 |
| Shared body | 「共享單一大腦」 | 單一 Transformer 本體同時處理兩套編碼器送入的特徵；無模態特化層級權重 |
| SigLIP for understanding | 「語意特徵塔」 | CLIP 家族的高階視覺塔，提供極致豐富的抽象概念特徵，但不擅長像素還原 |
| VQ for generation | 「像素重構碼」 | 透過向量量化產生的高保真離散 token，能精確且乾淨地解碼還原回實體像素 |
| JanusFlow | 「整流流連續變體」 | 以連續空間的流匹配生成頭取代 VQ 離散碼本的升級版 Janus-Pro 架構 |
| Routing tag | 「任務分流標籤」 | Prompt 中的控制標籤（如 `<understand>` 或 `<generate>`），用以驅動正確的編碼器分流 |

## Further Reading｜延伸閱讀

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848) ——雙編碼器原創奠基論文
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811) ——大規模擴展突破性成果
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975) ——整流流連續生成變體
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877) ——大一統多模態進階版圖
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499) ——早期自回歸雙向生成探索
