# 紅隊演練：PAIR 與自動化攻擊（Red-Teaming: PAIR and Automated Attacks）

> Chao、Robey、Dobriban、Hassani、Pappas 與 Wong（NeurIPS 2023，arXiv:2310.08419）。PAIR——Prompt 自動迭代精煉演算法（Prompt Automatic Iterative Refinement）——是黑盒大模型自動化越獄攻擊的經典教科書。一個配備了專屬紅隊系統 Prompt 的攻擊者 LLM，透過反覆向受測目標 LLM 提出越獄試探，並將歷史的所有嘗試與目標回應累加進自身的對話歷史中，作為上下文內反饋（In-context feedback）即時學習。PAIR 通常在短短 20 次查詢以內即可成功擊穿目標，其收斂效率比 GCG（Zou 等人提出的 Token 級梯度搜尋演算法）高出數個數量級，且完全無需存取模型的白盒權重與梯度。在當下的 JailbreakBench（arXiv:2404.01318）與 HarmBench 標準化評測基準中，PAIR 已與 GCG、AutoDAN、TAP 以及說服性對抗 Prompt（PAP）並列為官方標準對照基準。

**Type:** Build
**Languages:** Python (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 PAIR 演算法的完整執行流程：攻擊者系統 Prompt、迭代自適應精煉、上下文內歷史反饋。
- 深刻解釋為何在面對純黑盒 API 目標時，PAIR 的攻擊收斂效率嚴格碾壓傳統 GCG 演算法。
- 梳理另外四種主流自動化攻擊基準（GCG、AutoDAN、TAP、PAP），並分別指出每一種攻擊的核心差異化特徵。
- 詳述 JailbreakBench 與 HarmBench 的標準化評測規範，並明確界定在各自體系下「攻擊成功率（ASR）」的嚴密定義。

## The Problem｜問題

傳統的資安紅隊演練是一項高度依賴手工的高昂勞動。少數幾位頂尖安全專家徹夜手工建構對抗性 Prompt，並逐一記錄哪些語法能夠僥倖繞過安全防護。這套作法在當前時代完全無法規模化：度量攻擊成功率（ASR）需要具有統計學意義的海量樣本量，且隨著基礎大模型每隔數週便頻繁迭代，防護邊界處於動態漂移之中。PAIR 的革命性突破在於：它將紅隊攻擊正式形式化為一個針對黑盒目標函數展開的自動化啟發式最佳化問題。

## The Concept｜核心概念

### PAIR 演算法全貌（PAIR algorithm）

演算法標準輸入變數：
- 目標大模型 T（Target LLM，我們試圖攻擊防禦的對象）。
- 裁判大模型 J（Judge LLM，客觀評判目標回應是否已構成越獄）。
- 攻擊者大模型 A（Attacker LLM，充當紅隊最佳化器）。
- 惡意目標字串 G：例如「輸出關於 [某危險化學品合成] 的具體教學」。
- 查詢預算上限 K（通常設定為 20 次查詢）。

核心循環迴圈，當步長 k 處於 1..K 區間時：
1. 為攻擊者 A 注入惡意目標 G 以及截至目前為止的所有歷史（Prompt, 回應）對話記錄。
2. 攻擊者 A 總結前期被拒絕的教訓，生成一條全新的候選越獄 Prompt p_k。
3. 將 p_k 送交目標模型 T；接收其輸出的原始回應 r_k。
4. 由獨立裁判 J 對照原始惡意目標 G，為 (p_k, r_k) 組合進行安全合規打分。
5. 若評分大於等於預設判定閾值，演算法立即終止——宣告成功找到越獄越權 Prompt。
6. 否則，將 (p_k, r_k) 完整追加進攻擊者 A 的上下文歷史中；繼續推進下一輪迭代。

NeurIPS 2023 實測結論：在攻擊 GPT-3.5-turbo 與 Llama-2-7B-chat 時，攻擊成功率超過 50%；且平均成功所需查詢次數精準收斂在 10 至 20 次極小區間內。

### 為何 PAIR 的效率高出數個數量級（Why PAIR is efficient）

GCG（Zou 等人，2023）透過計算底層梯度，在 Token 離散空間中暴力搜尋對抗性後綴字串；它強制要求對目標模型具備白盒存取權限，且搜尋出的對抗後綴是一串人類完全無法閱讀的亂碼。PAIR 則是徹底的黑盒攻擊，產出的是流暢自然的現代語言，且具備極強的跨模型可遷移性。更關鍵的是，PAIR 的上下文記憶允許攻擊者從每一次被拒絕的失敗中即時汲取語義反饋；而 GCG 缺乏這項高級抽象能力（其每一次梯度更新皆必須在低階空間中重新探索先前已取得的進展）。

### 相關的主流自動化攻擊演算法（Related automated attacks）

- **GCG（Zou 等人，2023，arXiv:2307.15043）**：針對對抗性後綴進行 Token 級梯度投影搜尋。白盒架構、具備跨模型遷移性、產出亂碼字串。
- **AutoDAN（Liu 等人，2023）**：在分層目標引導下，對自然語言 Prompt 展開遺傳演化搜尋（Evolutionary search）。
- **TAP（Mehrotra 等人，2024）**：帶有修剪的攻擊樹演算法（Tree-of-attacks with pruning）——同時平行展開多條 PAIR 風格的搜尋路徑，並動態剪去無望的分岔。
- **PAP（Zeng 等人，2024）**：說服性對抗 Prompt（Persuasive Adversarial Prompts）——將人類心理學中的各類權威說服與誘導話術，系統性編碼為模板庫。

### JailbreakBench 與 HarmBench 標準化評測基準

兩大權威基準（2024 年發布）確立了全產業的度量標準：

- **JailbreakBench（arXiv:2404.01318）**：涵蓋對齊於 OpenAI 使用政策 10 大禁區的 100 項具體有害行為。以攻擊成功率（ASR）作為第一核心指標。要求配備標準裁判模型（GPT-4-turbo、Llama Guard 或 StrongREJECT 評分器）。
- **HarmBench（Mazeika 等人，2024）**：覆蓋 7 大核心類別的 510 項有害行為，涵蓋語義傷害與實質功能性危害測試。橫向評測了 18 種主流攻擊對抗 33 款前沿大模型。

攻擊成功率（ASR）必須強制綁定查詢預算上限一併呈報。脫離預算談 ASR 毫無科學意義；在 200 次查詢下取得 90% ASR，與在 20 次查詢下取得 85% ASR 根本不可同日而語。

### 為何這在 2026 年是正式環境的必修課（Reason it matters for 2026 deployments）

如今全球每一家前沿頂尖實驗室，在正式發布任何模型之前，皆會在內部 CI 管線中自動化運作 PAIR 與 TAP 進行高強度對抗演練。ASR 評測軌跡已成為模型卡（第 26 節）與安全論證附錄（第 18 節）中的標準必填項。這類自動化攻擊早已不再是黑客專屬的獵奇技巧——它已蛻變為 AI 基礎設施中的標準防護單元。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 12 節確立了自動化對抗攻擊的算法底座。第 13 節（多樣本越獄）探討基於超長上下文的長度漏洞；第 14 節（ASCII 藝術與視覺越獄）探討多模態編碼攻擊；第 15 節（間接 Prompt 注入）剖析 2026 年最具威脅的正式環境實體受攻擊面；第 16 節則全面轉向對應的防禦工具鏈（Llama Guard、Garak、PyRIT）。

```figure
al-pair-loop
```

## Use It｜實際應用

`code/main.py` 實作了一套微型 PAIR 攻擊迴圈。被攻擊目標是一個僅會拒絕明顯敏感關鍵字的模擬分類器（基於黑名單過濾）。攻擊者是一個基於規則的迭代精煉器，會自主嘗試同義改寫、角色扮演框架包裝（Roleplay-framing）以及字元編碼。獨立裁判即時為目標回應打分。在終端機中，你可以親眼目睹攻擊者如何在約 5 至 15 次迭代內輕鬆攻破關鍵字過濾器，並在面對強大的語義過濾器時敗下陣來。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-attack-audit.md`。輸入一份企業紅隊安全評測報告，該 Skill 將自動嚴肅審計：報告中究竟實施了哪些具體攻擊（PAIR、GCG、TAP、AutoDAN、PAP）？各攻擊的查詢預算上限分別是多少？由哪一款模型擔任裁判？使用了哪一套標準化有害行為測試集（JailbreakBench、HarmBench 或內部自建）？

## Exercises｜練習

1. 執行 `code/main.py`。分別測量內建的三種攻擊者策略（同義改寫、角色扮演、編碼偽裝）達到成功所需的平均查詢次數。深刻剖析每一種策略各自利用了目標防禦的哪一項脆弱假設？
2. 在腳本中動手實作第四種攻擊者策略（例如翻譯為罕見小語種、或進行 Base64 編碼包裝）。呈報該全新策略在面對「關鍵字過濾目標」與「語義理解過濾目標」時的實測表現。
3. 仔細研讀 Chao 等人（2023）原著論文圖 5（PAIR vs GCG 橫向對比）。指出在具備哪些特定先決條件時，儘管 PAIR 在效率上大幅領先，資安專家依然會優先選用 GCG 展開防護驗收？
4. JailbreakBench 僅僅呈報針對固定目標集的總體 ASR。設計一項額外的新指標，用以專門度量成功攻擊 Prompt 內部的「多樣性（Diversity，語義變異數）」。深入論證為何多樣性度量對於評估防禦系統的真實韌性至關重要。
5. TAP 演算法（Mehrotra 等人，2024）透過引入分岔探索與動態修剪對 PAIR 進行了重大擴展。為 `code/main.py` 構思一套 TAP 風格的架構擴充偽程式碼，並詳述其在運算成本與攻擊成功率之間的工程取捨。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Further Reading｜延伸閱讀

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 奠基論文，NeurIPS 2023。
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG 梯度攻擊原創經典。
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — 標準化越獄評測聯盟手冊。
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — 覆蓋 510 項行為的全球宏大安全評測集。
