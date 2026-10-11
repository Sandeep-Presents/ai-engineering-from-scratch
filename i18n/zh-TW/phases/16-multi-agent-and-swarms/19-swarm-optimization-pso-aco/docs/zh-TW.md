# LLM 領域的群體最佳化演算法（PSO、ACO）（Swarm Optimization for LLMs (PSO, ACO)）

> 仿生最佳化演算法正強勢回歸 LLM 領域。**LMPSO**（arXiv:2504.09247）將粒子群最佳化（PSO）與大型語言模型結合，其中每個粒子的速度表現為一段 prompt，並由 LLM 負責生成下一個候選解；在結構化序列產出（數學表達式、程式碼）上成效斐然。**Model Swarms**（arXiv:2410.11163）將每個專長 LLM 視為模型權重多樣體空間中的一個 PSO 粒子，在 9 個資料集上僅透過 200 個實例樣本便相較於 12 個基準線取得了 **13.3% 的平均增益**。**SwarmPrompt**（ICAART 2025）將 PSO 與灰狼最佳化演算法混成用於 prompt 最佳化。**AMRO-S**（arXiv:2603.12933）則借鑒蟻群最佳化（ACO）的費洛蒙軌跡實現多 Agent 智慧路由——達成 **4.7 倍加速**、產出高可解釋性的路由依據，並透過品質門禁的非同步更新徹底解耦了推論與學習流程。本課將親手實作 prompt 參數空間上的 PSO 以及 Agent 路由上的 ACO，精準衡量為何這些古典演算法能完美契合 LLM 時代，以及它們何時不適用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problem｜問題

你手頭有一套在任務評測中僅能取得 62% 得分的 prompt。你渴望提升它的表現。最單純的做法是無梯度的手動調校，但其擴展性極差。強化學習（RL）需要設計嚴密的獎勵訊號，並進行大量推展（rollouts）才能完成訓練。而針對 prompt 進行直接的反向傳播在物理上是不可能的——prompt 是離散的自然語言字串，而非可微的連續浮點參數。

古典的仿生最佳化演算法——專攻連續搜尋空間的粒子群最佳化（PSO）與專長於路徑選擇的蟻群最佳化（ACO）——當初正是為了這種情境量身打造的：完全無需梯度、基於群體族群演化、單次評估成本低廉。將它們與 LLM 深度結合來承擔無梯度的探索步驟，你將獲得一套出奇實用的強大最佳化器。

完全相同的架構哲學亦能直接應用於多 Agent 系統中的 **Agent 智慧路由**。ACO 風格的費洛蒙軌跡能精確記錄哪位 Agent 在處理特定任務類型時表現最優異，引導路由器主動利用高效路徑，同時透過費洛蒙自然揮發衰減讓全新路徑具備被重新發現的機會。

## Concept｜核心概念

### PSO 演算法快速複習（Kennedy & Eberhart 1995）

粒子群最佳化演算法：在連續搜尋空間中初始化一群粒子。每個粒子皆具備空間位置 `x_i` 與運動速度 `v_i`。在每一次迭代中：

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

其中 `p_best` 為粒子自身的歷史最佳位置，`g_best` 為全域群體的當前最佳位置，`w, c1, c2` 分別代表慣性權重、自我認知係數與社會學習權重，`r1, r2` 則為隨機擾動因子。

### 運作於 LLM 生成層的 PSO——LMPSO

論文 arXiv:2504.09247 將 PSO 成功調適至 LLM 生成的結構化產出（數學公式、程式碼邏輯）。每個粒子代表一個候選輸出。速度被具象化為一段 **prompt**，負責描述如何朝著個體最佳或全域最佳的特質對當前候選解進行定向修飾。LLM 隨後依據該速度 prompt 生成全新的候選輸出。而速度公式中的「慣性權重」，則被轉化為類似「僅進行細微漸進式調整」的引導語句。

該機制在以下情境表現無比卓越：
- 輸出成果具備高度結構化（易於解析、易於客觀評判）。
- 適應度評估完全自動化（可自動執行測試案例或算術計算）。
- 族群規模保持精巧（約 10-30 個粒子），以確保總體 LLM 呼叫成本完全受控。

然而，一旦適應度評估必須依賴人類專家介入審查，該機制將徹底失靈——因為每次迭代累積的高昂人工開銷會瞬間使其變得難以承受。

### 模型群體最佳化（Model Swarms）

論文 arXiv:2410.11163 將 PSO 從表面的文本生成層，一舉推進至深層的**模型參數層**。每個「粒子」代表一個具備特定領域專長的 LLM 權重。整個群體透過完全無梯度的更新公式，驅動各模型的參數空間集體向群體最佳方向動態位移。實測成果：在 9 個資料集上相較於 12 個強大基準線錄得了 13.3% 的平均增益，且每次迭代僅需消耗微不足道的 200 個訓練實例。

其背後的核心洞察在於：經過 fine-tuning 後的各領域專長 LLM 模型，在共有的參數多樣體（Parameter manifold）空間中本來就彼此緊密相鄰（如各類 Adapter 權重、LoRA 差分權重）。在這個低維子空間上運作 PSO，兼具了極致的廉價性與驚人的收斂成效。

### ACO 蟻群演算法快速複習（Dorigo 1992）

蟻群最佳化演算法：螞蟻在圖狀網路中穿梭探索；每條可通行的路徑皆鋪設有特定濃度的人工費洛蒙（Pheromone trail）。螞蟻在各節點挑選前進方向的機率，正比於該路徑上的當前費洛蒙濃度。成功完成目標任務的螞蟻會在路徑上沉積與解答品質成正比的費洛蒙。與此同時，所有路徑上的費洛蒙會隨時間推移自然揮發衰減。

### AMRO-S——基於蟻群演算法的 Agent 動態路由

論文 arXiv:2603.12933 將 ACO 成功引入多 Agent 任務路由領域。每種任務類型被抽象為一個「終點目標」；每位候選 Agent 則是一條可選的「前進路徑」。持續產出高品質結果的路徑上的費洛蒙將被不斷強化。核心技術貢獻：

- **高可解釋性的路由決策依據。** 費洛蒙濃度的強弱直接構成了一套人類直觀可讀的可解釋性決策指標。
- **品質門禁把關的非同步更新。** 唯有在嚴格通過品質檢驗的前提下才允許沉積費洛蒙，徹底實現了即時推論與離線學習的完美解耦。
- 在多 Agent 路由基準測試上取得了高達 **4.7 倍的驚人加速**。

品質門禁的存在生死攸關：若缺乏這道防線，動作飛快但錯誤百出的低劣 Agent 會迅速累積大量費洛蒙，導致整座系統被死死鎖定在錯誤的災難性路徑上。

### 何時該將 PSO / ACO 導入 LLM 系統

**在以下情境果斷選用 PSO：**
- 搜尋空間屬於連續空間，或可自然映射至連續參數（例如 Prompt embedding 向量、LoRA 適配權重、數值生成超參數）。
- 適應度評估極其廉價且能完全自動化執行。
- 粒子族群規模能有效壓縮在小型區間（10-30 個粒子）。

**在以下情境果斷選用 ACO：**
- 你面臨的是複雜的圖狀路由或離散路徑選擇難題。
- 業務決策具備隨時間自我強化的特性（相同類型的任務會週期性重複出現）。
- 你的正式環境對路由決策的透明可解釋性有嚴格要求。

**在以下情境堅決放棄兩者：**
- 適應度評估需要人類專家逐一審核（單次迭代成本高昂到不可承受）。
- 搜尋空間屬於 PSO 無法有效涵蓋的離散組合爆炸領域（此時遺傳演算法 GA 是更優選擇）。
- 即時性業務對端到端延遲有著極為嚴苛的毫秒級要求（相較於單次啟發式規則，PSO 與 ACO 的收斂過程相對耗時）。

### 為什麼仿生最佳化演算法依然立於不敗之地

基於梯度的傳統方法必須依賴嚴格可微的連續訊號。然而 LLM 的最終文本產出與 Agent 的離散路由決策，在數學上根本無法直接進行平滑求導。偽梯度方法（例如強化學習路由器、類 DPO 的 prompt 調校）固然可行，但需要耗費龐大算力進行昂貴的模型重新訓練。

而 PSO 與 ACO 僅僅需要一個**評估器（Evaluator）**函式。只要你具備為候選產出或路由決策給出客觀打分的能力，你就能在該空間中自由展開全域最佳化。這使得它們在工業界落地的門檻顯著更低。

### 實務工程邊界與代價

- **族群運算預算。** 總成本 = N 個粒子 × T 次迭代 × 單次評估開銷。若以單次 LLM 評估消耗 0.02 美元計算，一個包含 20 個粒子、運作 50 次迭代的 PSO 最佳化過程將產生約 20 美元的帳單。在啟動前務必做好財務預算。
- **探索與利用的權衡取捨（Exploration vs exploitation）。** 費洛蒙的揮發衰減率與 PSO 的慣性權重直接決定了平衡點：衰減過快會導致系統過早遺忘優秀解；衰減過慢則會讓系統死死受困於早期的局部最佳陷阱。
- **災難性目標漂移（Catastrophic drift）。** 一旦底層業務資料分布發生突變（適應度地形改變），兩種演算法皆可能在原本已收斂的最佳點附近產生劇烈發散。必須即時監控歷史最佳適應度的穩定性。

```figure
swarm-stigmergy
```

## Build It｜動手實作

`code/main.py` 完整實作了以下模組：

- `LMPSO`——運作於數值型 prompt 參數（例如溫度係數、top_k 加權）之上的粒子群最佳化器。每個粒子的「LLM 生成與評估」由腳本化的適應度函式精確模擬。運作 30 次迭代並清晰展示 g_best 全域最佳解的平滑收斂歷程。
- `AMRO_S`——ACO 風格的智慧 Agent 路由器。包含 3 位專業 Agent、4 種任務類型、費洛蒙矩陣，並完成 100 次連續任務路由派發。即時輸出「任務類型 → Agent 選取」的動態分布變遷，直觀呈現費洛蒙軌跡的自發形成。
- 效能實測對比：在相同的任務流衝擊下，對比隨機路由與 ACO 智慧路由的表現，量化統計產出品質與系統延遲。

執行指令：

```
python3 code/main.py
```

預期終端輸出：
- LMPSO：全域最佳適應度 g_best 在 30 次迭代中，從最初的隨機低分逐步收斂至逼近理論極限的近乎最佳解。
- AMRO-S：費洛蒙矩陣迅速穩定收斂，針對每種任務類型精準鎖定最適的專業 Agent；ACO 智慧路由相較於隨機路由在任務品質上斬獲了約 30-40% 的顯著提升，且由於大幅減少了無謂的重試失敗，端到端系統延遲亦顯著降低。

## Use It｜實際應用

`outputs/skill-swarm-optimizer.md` 能針對特定的 LLM 或多 Agent 最佳化難題，客觀評估並指引團隊在 PSO、ACO、遺傳演算法以及梯度最佳化器之間做出最具性價比的技術選型。

## Ship It｜交付成果


- **嚴格從小規模起步。** 初始配置 10-20 個粒子、迭代 20-50 輪。唯有當收斂曲線展現出明確無誤的實質增益時，才允許擴大規模。
- **逐輪落盤記錄費洛蒙矩陣或全域最佳值。** 缺乏歷史軌跡日誌的群體最佳化器，在遭遇異常時將徹底喪失除錯排查能力。
- **強制設定品質門禁。** 特別在 ACO 路由中：動作飛快但錯誤百出的低劣 Agent 絕對嚴禁累積費洛蒙。
- **在資料分布漂移時主動重設衰減機制。** 當評測資料集發生實質變更時，陳舊的費洛蒙已失去參考價值；應當即刻重設矩陣或在短期內將揮發衰減率翻倍。
- **為單次迭代成本設定硬性上限。** 即時輸出「每次迭代成本」指標。若一個每次迭代需消耗 500 美元卻僅能換取 0.5% 微弱提升的 PSO，在商業上絕對不具備交付價值。

## Exercises｜練習

1. 執行 `code/main.py`。觀察 LMPSO 的收斂動態。將粒子群規模分別設定為 5、10、20 與 50。當規模擴大至多少時，收斂時間的縮短將會遭遇嚴重的飽和效應？
2. 實現「災難性目標漂移」對抗實驗：在第 30 次迭代之後，突發篡改底層適應度函式的評分標準。觀察 PSO 需要經過多少輪才能適應新地形？手動重設 `p_best` 能否顯著加速系統的再收斂？
3. 為 AMRO-S 追加嚴格的品質門禁：唯有當單次執行的評測得分突破 0.7 時才允許沉積費洛蒙。對比未設門禁的原始版本，觀察兩者在收斂速度與最終路由準確性上的差異。
4. 閱讀 LMPSO 論文（arXiv:2504.09247）。將論文中「以 prompt 形式表達速度」的核心思想，映射回你程式碼中的純數值速度。在模擬環境中究竟損失了哪些真實特性？又精準保留了哪些底層精髓？
5. 閱讀 AMRO-S 論文（arXiv:2603.12933）。實作解耦的「推論極速通道」，將費洛蒙更新完全移至非同步背景執行緒中。量化測量在源源不絕的持續高併發負載下，該解耦架構能為系統端到端延遲帶來何種程度的改善？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Further Reading｜延伸閱讀

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) — 1995 年 PSO 奠基論文。
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) — 1992 年 ACO 蟻群演算法開山鼻祖文獻。
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) — 專為結構化 LLM 輸出設計的粒子群最佳化論文。
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) — 運作於模型權重子空間上的無梯度 PSO 專長模型最佳化。
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) — 帶有品質門禁防護的蟻群演算法多 Agent 智慧路由規範。
