# 視訊語言模型：時間 Token 與時間軸定位（Video-Language Models: Temporal Tokens and Grounding）

> 影片絕非一疊單純的靜態照片堆疊。一段 5 秒鐘的短片蘊含著嚴格的因果因果次序、動作動詞以及事件發生的精確時間點，這些是純靜態影像模型完全無力表達的。Video-LLaMA（Zhang 等人，2023 年 6 月）推出了首款具備視訊音訊時空定位的開源視訊 LLM；VideoChat 與 Video-LLaVA 則進一步將此模式規模化。到了 2025 年，Qwen2.5-VL 憑藉 TMRoPE 徹底縮小了開源模型與頂級閉源模型的差距。各家系統對時間 token 的解法大異其趣——以短片為單位的 Q-former、逐影格池化拼接，或是細粒度至逐 token 的 TMRoPE。本課帶你梳理各類流派，動手實作均勻與動態影格取樣器，並在時間軸定位任務上展開嚴謹評測。

**Type:** Build
**Languages:** Python (stdlib, frame sampler + temporal-grounding evaluator)
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 minutes

## Learning Objectives｜學習目標

- 解釋為何時間位置編碼能獨立於視覺編碼器之外，根本性地拉動視訊 VLM 的任務表現。
- 在每秒 token 消耗與時間軸定位精確度兩大維度上，深入對比均勻取樣、動態 FPS 取樣與事件驅動取樣。
- 剖析「短片級 Q-Former（Video-LLaMA）」、「逐影格池化（Video-LLaVA）」與「逐 token M-RoPE（Qwen2.5-VL）」三種架構設計的本質差異。
- 掌握四大核心視訊評測基準：VideoMME、TempCompass、EgoSchema 與 Video-MMMU。

## The Problem｜問題

一段 1 分鐘長度、每秒 30 幀的標準視訊包含 1800 個影格。若以 ViT-B @ 224 解析度每幀產生 196 個視覺 token 計算，總計高達 352,000 個 token——遠遠超出了 2024 年代絕大多數 LLM 的 context 視窗上限。

業界發展出三種核心壓縮手段：

1. 影格降取樣（依視訊內容動態選取 1 到 8 FPS）。
2. 對每個影格的 patch token 進行激進的空間池化（採用 3×3 或 4×4 雙線性池化）。
3. 透過視訊 Q-Former 進行壓縮，接收 16 幀的短片片段並固定輸出 64 個 token。

每種策略伴隨著不同的取捨：降取樣會遺失高速動態細節；空間池化會抹殺微觀空間紋理；Q-Former 雖然兩端皆有些許折損，但在 token 數量上最為節省。

時間位置編碼是另一個決定性維度：模型如何精確知曉「第 5 幀確實發生在第 6 幀之前」？可選方案涵蓋了簡單的一維時間 RoPE（Video-LLaMA）、可學習的時間 embedding（Video-LLaVA），以及全三維的 TMRoPE（Qwen2.5-VL）。

## The Concept｜核心概念

### Video-LLaMA：片段級 Q-Former 加音訊路徑

Video-LLaMA（2023）是首款開源的視訊語言大模型。其典型架構為：

- 接收以 2 FPS 取樣的 16 幀短片片段（總長度為 8 秒）。
- 逐影格提取 ViT 特徵 → 送入視訊 Q-Former 對全體 16 幀進行交叉注意力檢索 → 壓縮為 32 個學習到的 query 向量 → 餵入 LLM。
- 平行的音訊處理路徑：原始波形 → ImageBind 音訊編碼器 → 音訊 Q-Former → 32 個 query 向量 → 餵入 LLM。

強項在於：原生具備視訊與音訊的跨模態聯合推理能力；硬傷在於：片段長度死死固定，無法進行任意長度的高精度時間戳記定位。

### VideoChat 與 Video-LLaVA

VideoChat 延續了 Video-LLaMA 的思路，但移除了音訊模組以追求架構簡化。Video-LLaVA（Lin 等人，2023）則大膽採用單一視覺編碼器同時在靜態圖片與視訊影格上展開聯合預訓練（倡導「投影前先對齊」的理念），賦予模型統一的表徵空間。兩者底層本質上皆為「凍結的 CLIP 編碼器 + 雙層 MLP + LLM」。

然而這兩者皆無法處理長影片。其設計本質上皆局限在 8 到 16 幀的短片段系統。

### Qwen2.5-VL 與 TMRoPE

Qwen2.5-VL 引入了革命性的 TMRoPE（時空模態旋轉位置編碼）。每個 patch token 皆攜帶三維座標 (t, h, w)，其中 t 為精確的「實體絕對時間戳記」（而非相對影格序號）。

與傳統時間 embedding 表相比的核心質變：

- 絕對時間而非相對索引：模型直接看見「在 4.2 秒時」，而非模糊的「在第 15 幀」。
- 細化至逐 token 的獨立旋轉：每個視覺 token 依據自身的實體時間戳記各自進行高頻旋轉。
- 原生相容於非均勻的動態 FPS：無論此處抽樣 2 FPS、彼處抽樣 4 FPS，TMRoPE 皆能天然處理不均勻的時間間隔。

TMRoPE 真正解鎖了「貓在第幾秒跳了起來？」這類極精確的時間軸定位查詢。模型能夠自信輸出「在 4.2 秒處」；而早期的 Video-LLaMA 最多只能含糊回答「在片段前段」。

### 影格取樣策略全解析

均勻取樣（Uniform）：在整個視訊時長內等間距抽取 N 幀。實作最簡單，但容易錯失高速動作的關鍵瞬間。

動態 FPS 取樣（Dynamic FPS）：依據畫面動態劇烈程度自適應調整抽幀率。利用光流（Optical Flow）或相鄰影格差分演算法，自動在劇烈運動區間提高抽幀密度。Qwen2.5-VL 在此策略上進行了深度預訓練。

事件驅動取樣（Event-driven）：前端先運行一個超輕量的動態偵測器，僅在真正發生實體動作的區間密集抽樣。常為 VideoAgent 所採用。

關鍵影格加上下文（Keyframe + context）：在鏡頭轉換的剪輯邊界處強制抽樣，並搭配前後各數幀作為背景。極度適合電影長片與剪輯視訊。

### 逐影格空間池化

在 1 FPS 且每幀產生 576 個 token 的設定下，一段 5 分鐘的視訊將累積高達 172,800 個 token。雖然 Qwen2.5-VL-72B 的 128k context 視窗極限能勉強承受，但推論延遲與伺服器成本極其昂貴。

套用 3×3 雙線性空間池化，能將每幀精簡為 64 個 token → 5 分鐘視訊總 token 量降至 19,200。這是當前絕大多數商業任務的最佳性價比平衡點。

面對純文字操作的 Agent 工作流程（畫面空間細節要求較低），可施加更激進的 6×6 池化（每幀壓縮至僅 16 個 token）。

### 四重視訊基準評測體系

- VideoMME：涵蓋短片、中長片與超長視訊的全方位權威綜合基準。
- TempCompass：專注於極細粒度時序推理（如「之前」與「之後」的先後因果辨識）。
- EgoSchema：專注於長達數分鐘的第一人稱視角長程行為理解。
- Video-MMMU：橫跨多學科領域的高難度多模態視訊問答。

完整的視訊大模型評測必須全量覆蓋這四大基準。它們各自檢驗不同的架構維度——TempCompass 考驗時序排列；EgoSchema 考驗 3 分鐘以上的超長程邏輯；VideoMME 則檢驗跨時長泛化。

### 時間軸定位輸出格式

時間軸定位的輸出協定演進：

- 自由文字描述：「貓大約在 4 秒處跳了起來。」易於人類閱讀，但極難被下游軟體可靠解析。
- 結構化 JSON：`{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL 深度訓練此格式，保證機器百分之百可靠解析。
- 專屬 Token 形式：在文字回答中穿插特殊的 `<time>4.1</time>` 標籤。這是 Qwen2.5-VL 內部的原生表徵形式。

專屬 Token 形式在下游推理中具備最高的準確度，而 Qwen2.5-VL 的 JSON 輸出格式則能直接被各類 Agent 系統直接消費。

### 2026 年最佳工程實務

當前前沿視訊 VLM 的標準工業配方：

- 視覺編碼器：具備 M-RoPE 或 TMRoPE 的 SigLIP 2（如 Qwen2.5-VL）。
- 影格取樣：依運動劇烈度動態調度的動態 FPS（1 到 4 FPS），並設有每請求最大影格數上限。
- 逐影格池化：採用 3×3 雙線性空間池化。
- 輸出規範：帶有時間區間與事件實體的標準結構化 JSON。
- 評測驗證：通用能力測 VideoMME + TempCompass；長時序規劃測 EgoSchema。

```figure
video-temporal-patches
```

## Use It｜實際應用

`code/main.py` 完整實作了：

- 均勻取樣與動態 FPS 視訊影格取樣器。
- 時間軸定位微型評測器：給定真實世界發生於時間 T 的事件標準答案，評估模型預測結果在容許誤差（tolerance）內的精確命中率。
- 橫跨 Video-LLaMA（16 幀，Q-Former）、Video-LLaVA（8 幀，MLP 拼接）與 Qwen2.5-VL（動態 FPS + TMRoPE）的三代架構規格量化比對。

## Ship It｜交付成果

本課產出 `outputs/skill-video-vlm-frame-planner.md`。給定具體的視訊業務場景（安防監控、動作行為識別、時間軸剪輯定位、長片內容摘要），它能精準規劃最佳的影格取樣器參數、空間池化倍率、輸出格式規範，並提供預期的基準準確率等級評估。

## Exercises｜練習

1. 針對一段長度為 3 分鐘的料理教學影片，你該選擇均勻取樣還是動態 FPS 取樣？請以具體的 token 預算數字論證你的抉擇依據。

2. 相較於傳統簡單的一維時間 embedding 查表，TMRoPE 究竟額外帶來了哪些傳統機制完全無法實現的根本能力？

3. 為時間軸定位任務撰寫一份完整的 JSON Schema，使其能被 VLM 穩定遵循輸出，並包含當未發現目標事件時的合規錯誤回傳欄位定義。

4. 閱讀 Video-LLaVA 論文第 3 節關於「投影前先對齊（Alignment Before Projection）」的論述。為何這種聯合訓練範式，遠勝過分別訓練孤立的靜態影像編碼器與動態視訊編碼器？

5. 檢視當前的 VideoMME 排行榜，分析頂級開源模型與頂級閉源商業模型之間的實際差距。這段差距中有多大比例應歸因於時間位置編碼架構，有多大比例歸因於底座語言模型的規模？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際意義 |
|------|-----------------|------------------------|
| Temporal grounding | 「時間軸精確定位」 | 模型能為視訊中發生的特定事件，輸出精確到秒級的時間戳記區間的能力 |
| TMRoPE | 「時間多模態 RoPE」 | 將連續絕對時間戳記直接編碼進旋轉位置的三維 RoPE 架構，為 Qwen2.5-VL 所採用 |
| Dynamic FPS | 「運動感知動態抽幀」 | 在劇烈運動片段提高取樣幀率、在靜態畫面降低幀率的智慧視訊取樣演算法 |
| Frame pooling | 「逐幀空間特徵壓縮」 | 在影格餵入 LLM 之前，利用雙線性插值大幅縮減每幀 patch token 數量的機制 |
| Video Q-former | 「短片時空壓縮器」 | 透過交叉注意力將 N 幀視訊壓縮為 K 個可學習 query 向量的資訊瓶頸模組 |
| VideoMME | 「權威視訊多模態評測」 | 涵蓋短、中、長視訊的代表性高難度權威評測集，包含 2500 多道精選多模態題目 |

## Further Reading｜延伸閱讀

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858) ——首款開源視訊語言模型
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355) ——視訊對話架構
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122) ——圖文視訊聯合對齊架構
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923) ——TMRoPE 與動態 FPS 視訊新標竿
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533) ——視訊語言多模態擴展研究
