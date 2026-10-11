# 大語言模型的差分隱私技術（Differential Privacy for LLMs）

> 差分隱私隨機梯度下降（DP-SGD）依然是業界事實標準——透過向梯度更新注入高斯噪聲，提供嚴密的 (ε, δ) 形式化隱私保證。然而其在算力、顯存與模型實用性上的開銷極其沉重；參數高效的差分隱私 fine-tuning（LoRA + DP-SGD）成為了 2025 年最主流的標準架構（ACM 2025）。當前兩大前沿實證結論處於深刻張力之中：基於金絲雀樣本的成員推論攻擊（MIA，Duan 等人，2024）回報大語言模型抵禦 MIA 的效果出人意料地良好；而訓練資料提取攻擊（Carlini 等人，2021；Nasr 等人，2025）卻能輕易誘發模型一字不差地逐字背誦出大量訓練文本。2025 年 3 月的最新論文（arXiv:2503.06808）徹底化解了這項矛盾：兩者衡量的對象本質不同——前者測試的是人為插入的金絲雀，而後者探查的是整個資料集中「最易被提取」的極限長尾資料。全新的金絲雀設計實現了無需影子模型的基於損失值 MIA，並在真實資料上完成了首個具備實用隱私保證的非平凡大模型差分隱私審計。替代架構：PMixED（arXiv:2403.15638）——在推論執行時期透過混合專家（MoE）對 Next-token 預測機率分佈實施隱私保護；差分隱私合成資料生成（Google Research，2024）。新興攻擊向量：基於 LLM 反饋的差分隱私逆向破譯——利用模型暴露的置信度分數精確重識別個體。

**Type:** Build
**Languages:** Python (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精確定義 (ε, δ)-差分隱私的數學形式，並熟練推導 DP-SGD 的標準執行流水線。
- 深刻剖析 2024 至 2025 年間的學術張力：為何金絲雀成員推論攻擊（MIA）與訓練資料提取攻擊給出了截然相反的隱私結論。
- 掌握 PMixED 的核心架構，並闡明為何「推論時期的私有預測」能成為替代全量差分隱私訓練的重大路徑。
- 深入描述利用大模型置信度分數進行差分隱私逆向破譯（Differential Privacy Reversal）的新型攻擊路徑。

## The Problem｜問題

大語言模型具備強烈的記憶背誦傾向。Carlini 等人早在 2021 年便證實：正式環境中的商業語言模型能根據簡單的前綴提示，一字不差地完整默寫出訓練集中的機密原始文本。差分隱私（Differential Privacy, DP）是唯一的嚴密數學防衛體系：透過對訓練過程實施可證明的隨機擾動，確保模型的最終輸出分佈對任何單一訓練樣本的存在與否皆在統計上不敏感。然而 2024 至 2025 年的最新實證表明，單純跑通 DP-SGD 是遠遠不夠的——實際配置的 ε 數值往往無法抵禦真實世界的攻擊模型。

## The Concept｜核心概念

### (ε, δ)-差分隱私數學定義

一個隨機化演算法 M 滿足 (ε, δ)-差分隱私，若且唯若對於任意兩個僅相差單一記錄的相鄰資料集 D 與 D'，以及任意輸出事件子集 S：
P(M(D) in S) <= e^ε * P(M(D') in S) + δ。

物理直覺解釋：演算法產出任何特定結果的機率分佈皆極度接近（由 ε 精密控制其上限邊界），使得任何外部攻擊者皆無法以超過 δ 的極微小機率，可靠反推某個特定個體的資料究竟是否被納入過訓練集中。

### DP-SGD 標準架構流水線

Abadi 等人於 2016 年確立的黃金配方：
1. 從全量資料中採樣一個 Mini-batch 批次。
2. 計算每一個樣本各自的獨立梯度向量（Per-example gradients）。
3. 將每個獨立梯度向量依照預設的實體模長上限 C 進行強制裁剪（Clipping）。
4. 將裁剪後的各樣本梯度求和，並注入標準差為 σ * C 的高斯噪聲向量。
5. 使用這組被噪聲充分擾動後的加權梯度總和，正式更新模型參數。

全流程消耗的隱私預算由專屬的隱私會計師（如 Moments Accountant 或 Rényi DP Accountant）全天候即時累計。大模型文獻中回報的 ε 數值因威脅建模、資料敏感度與實用性目標不同而存在極大差異；業界絕無放之四海皆準的「絕對安全預設 ε」。部分文獻中的典型數值大致落在 ε ≈ 1–10 區間，但這些僅屬示範性參考——絕非開箱即用的安全承諾。更低的 ε 必然要求注入更大變異數的噪聲，往往會引發模型任務準確率的顯著折損。

### LoRA + DP-SGD 參數高效 fine-tuning

對千億參數的前沿模型直接實施全量 DP-SGD 在算力與顯存上完全不可行（因為記錄每個樣本的獨立梯度會直接打爆 HBM 顯存）。LoRA（Hu 等人，2022）將梯度更新嚴格限制在極低秩的旁路適配器（Adapter）之中，使每樣本梯度的暫存空間暴降數個數量級。LoRA + DP-SGD 是 2025 年工業級落地的絕對主流架構。此時嚴密的差分隱私數學保證僅作用於該 LoRA 適配器；而龐大的 Base 模型權重全程凍結保持不變。

### 2024 至 2025 年的隱私學術大爭論

兩大看似針鋒相對的實驗實證：

- **金絲雀成員推論攻擊（Canary MIA，Duan 等人，2024）**：在訓練集裡隨機插入精心設計的唯一金絲雀樣本，隨後測試攻擊者能否透過模型輸出精確判定該金絲雀是否存在。實測結論：在大模型上難以成功。這傳遞出一種樂觀訊號：成員推論攻擊（MIA）在大模型上極端困難。
- **訓練資料逐字提取攻擊（Carlini 2021，Nasr 等人 2025）**：向模型餵入一段常見前綴，測試其能否自然吐出訓練集中的機密明文。實測結論：能大規模精確還原大量未公開文字。這傳遞出相反的悲觀訊號：大模型本質上是一個巨大的記憶海綿，隱私洩漏極其輕而易舉。

2025 年 3 月的突破性論文（arXiv:2503.06808）徹底解開了這個謎團：兩者度量的根本不是同一個物理量。MIA 測試的是「特定隨機金絲雀 e 是否在資料集 D 中」，其樣本缺乏記憶親和性；而提取攻擊測試的是「在整個資料集 D 中，哪些資料最容易被模型記住並提取」。在隱私防護層面，那批「最易被提取的長尾資料」才是決定系統生死的核心軟肋；隨機插入的金絲雀因其不具備極限可提取性，人為掩蓋了真實威脅。

新一代金絲雀設計應運而生：實現了無需昂貴影子模型（Shadow models）即可直接基於損失函數展開的實用 MIA，並在真實資料上完成了首個具備實用意義的非平凡大模型差分隱私實體審計。

### 替代 DP 訓練的新興架構

- **PMixED（arXiv:2403.15638）**：在推論執行時期實現私有化預測。將訓練資料分片為多個獨立子集並指派給不同的專家模型；在推論計算 Next-token 預測機率分佈時引入混合專家機制，並在聚合層注入精確的高斯噪聲以滿足差分隱私。徹底規避了痛苦的高成本 DP-SGD 訓練。
- **差分隱私合成資料生成（Google Research 2024）**：首先使用 LoRA + DP-SGD 訓練一個私有生成器，隨後用其取樣產出海量合成資料，下游任務完全在合成資料上以常規方式無拘無束地訓練分類器。

兩種方案皆在保留傳統模型強大實用性的同時，透過重構威脅建模巧妙繞開了全量 DP 訓練的巨大精度代價。

### 基於 LLM 反饋的差分隱私逆向破譯

2025 年新興的頂級攻擊手法：即便一個大模型經過了嚴格的 DP-SGD 訓練且文字輸出完全不包含機密明文，攻擊者依然可以將模型對外暴露的 Token 置信度分數（Confidence scores / Log-probs）充當神諭評判器（Oracle），從而在極高置信度下精確反推特定敏感個體是否存在。

標準防護手段：在對外服務介面中堅決隱藏或嚴禁直接暴露浮點精度的 Log-probs；若業務強烈需要，必須在輸出前對置信度進行粗粒度截斷或量化離散化。這是在常規 (ε, δ)-DP 訓練之外必須強制疊加的端點防禦。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 20 與 21 節解決偏見與公平性；第 22 節解決資料隱私洩漏；第 23 節將跨入數位浮水印與產權溯源；第 27 節則將在資料治理維度為全生命週期資料血緣築牢合規基石。

```figure
an-dp-clip-noise
```

## Use It｜實際應用

`code/main.py` 在一個微型二元分類任務中完整模擬了 DP-SGD 的運作流程。你可以自由掃描噪聲乘數 σ 與梯度裁剪閾值 C，即時度量其累積消耗的 (ε, δ) 隱私預算以及對應的模型分類準確率折損。程式內嵌了一套微型金絲雀插入攻擊，直觀演示在實施差分隱私干預前後，基於 Log-loss 的統計檢驗能否成功偵測到金絲雀的存在。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-dp-audit.md`。輸入一份大模型差分隱私宣稱報告，該 Skill 將自動嚴肅審計：報告所標稱的 (ε, δ) 數值是否真實合理？採用了何種隱私會計師演算法？MIA 成員推論評測是否採用了最新一代具備可提取性的金絲雀標準？以及系統是否在 API 端點層面對置信度分數外洩風險進行了嚴密防堵。

## Exercises｜練習

1. 執行 `code/main.py`。分別在 σ in {0.5, 1.0, 2.0} 條件下進行參數掃描，記錄 (ε, δ) 與模型準確率的權衡曲線。標定出系統實用性開始徹底崩潰雪崩的臨界噪聲水平。
2. 在腳本中手動實作金絲雀插入邏輯與 Log-loss 偵測檢驗。精確測量在 σ = 1.0 的 DP-SGD 干預前後，金絲雀被成功檢出的機率變化。
3. 仔細研讀 Nasr 等人（2025）關於訓練資料提取攻擊的原著論文。為何在溫和的 ε 約制下，資料提取攻擊的成功率並未如預期般迅速歸零？這對將傳統 MIA 作為唯一隱私驗收手段的做法提出了何種深刻質疑？
4. 設計一套基於 PMixED（arXiv:2403.15638）架構、完全運作在推論時期的隱私服務方案。明確指出 PMixED 所能成功防禦、而傳統 DP-SGD 反而難以兼顧的獨特威脅模型。
5. 構思基於 LLM 反饋的差分隱私逆向破譯攻擊原理圖。設計一套能在 API 閘道層限制置信度外洩的工程過濾方案，並精確評估其對下游使用者體驗帶來的微小代價。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Further Reading｜延伸閱讀

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) — 差分隱私隨機梯度下降開山奠基論文。
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) — 大模型訓練資料提取攻擊權威論文。
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) — 金絲雀成員推論攻擊實證研究。
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) — 化解 MIA 與提取攻擊張力的最新重磅突破。
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) — 推論時期混合專家差分隱私預測架構。
