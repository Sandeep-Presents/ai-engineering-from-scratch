# LLM 的群體最佳化（Swarm Optimization for LLMs (PSO, ACO)）

> 仿生最佳化演算法正在 LLM 領域重新受到關注。**LMPSO**（arXiv:2504.09247）將粒子群最佳化（PSO）與 LLM 結合，其中每個粒子的速度是一段 prompt，由 LLM 生成下一個候選解；在結構化序列輸出（數學式、程式碼）上表現良好。**Model Swarms**（arXiv:2410.11163）將每個專家 LLM 視為模型權重流形（manifold）上的 PSO 粒子，在 9 個資料集、每次僅 200 個實例下，相較 12 個基準模型平均提升 **13.3%**。**SwarmPrompt**（ICAART 2025）把 PSO 與灰狼最佳化結合，用於 prompt 最佳化。**AMRO-S**（arXiv:2603.12933）借鑒 ACO 的費洛蒙，用於多 Agent LLM 路由——**4.7 倍加速**、可解釋的路由依據，以及讓推論與學習解耦的品質門禁非同步更新。本課將在 prompt 參數空間實作 PSO、在 Agent 路由上實作 ACO，衡量這些古典演算法為何適合 LLM 時代，以及何時不適用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problem｜問題

你手上的 prompt 在任務評測中只拿到 62% 的分數，想要改進。最單純的做法是無梯度的手動調整，但擴展性很差。強化學習需要設計獎勵訊號，並進行大量 rollouts 才能訓練。對 prompt 直接做反向傳播（backpropagation）實務上行不通：prompt 是離散的字串，不是可微的參數。

古典的仿生最佳化演算法（連續搜尋空間的粒子群最佳化 PSO，以及路徑選擇的蟻群最佳化 ACO）正是為這種情境設計的：不需要梯度、以族群為基礎、每次評估成本低。把它們和 LLM 結合，負責無梯度的搜尋步驟，就能得到相當實用的最佳化器。

同樣的模式也適用於多 Agent 系統中的 Agent 路由（routing）。ACO 風格的費洛蒙軌跡記錄哪個 Agent 最擅長哪種任務類型，讓路由器利用該軌跡；費洛蒙會衰減，使路線能被重新發現。

## Concept｜核心概念

### PSO 演算法快速複習（Kennedy & Eberhart 1995）

粒子群最佳化演算法：在連續搜尋空間中初始化一群粒子。每個粒子都有位置 `x_i` 與速度 `v_i`。每次迭代：

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

其中 `p_best` 是粒子自身的最佳位置，`g_best` 是整個群體的最佳位置，`w, c1, c2` 分別是慣性、認知與社會權重，`r1, r2` 是隨機因子。

### PSO 用於 LLM 輸出：LMPSO

arXiv:2504.09247 將 PSO 用於 LLM 生成的結構化輸出（數學式、程式）。每個粒子是一個候選輸出。速度是一段 **prompt**，描述如何把當前輸出朝個人或全域最佳方向修改。LLM 依據速度 prompt 生成新的候選輸出。速度的「慣性」則是類似「做小幅漸進修改」的 prompt。

LMPSO 適用於：
- 輸出具結構（可解析、可評估）。
- 適應度可自動計算（測試執行、算術評估）。
- 族群小（約 10–30 個粒子），使 LLM 呼叫總數可控。

若適應度需要人工審查，效果就不好，因為每次迭代的成本會高到難以承受。

### 模型群體最佳化（Model Swarms）

arXiv:2410.11163 把 PSO 從輸出層移到**模型層**。每個「粒子」是一個專家 LLM（參數）。群體以無梯度的更新，把參數朝集體最佳方向移動。報告的結果：在 9 個資料集上，相較 12 個基準模型平均提升 13.3%；每次迭代只用 200 個實例。

關鍵洞察是：LLM 專家模型在共享的參數流形（manifold）中本來就彼此靠近（例如 adapter 權重、LoRA 差值）。在這個低維子空間上做 PSO 既便宜又有效。

### ACO 蟻群演算法快速複習（Dorigo 1992）

蟻群最佳化演算法：螞蟻在圖上穿梭；每條路徑都有費洛蒙軌跡（pheromone trail）。螞蟻移動方向的選擇機率會依費洛蒙強度加權。完成任務的螞蟻會依解的品質在路徑上沉積費洛蒙。費洛蒙會隨時間衰減。

### AMRO-S：用於 Agent 路由的 ACO

arXiv:2603.12933 將 ACO 用於多 Agent 路由。每種任務類型是一個「目的地」；每個 Agent 是可能的路徑。產出好結果的路徑會被費洛蒙加強。主要貢獻：

- **可解釋的路由依據。** 費洛蒙強度是人類可讀的訊號。
- **品質門禁的非同步更新。** 只有通過品質檢查後才更新費洛蒙，使推論與學習解耦。
- 在多 Agent 路由基準上達到 **4.7 倍加速**。

品質門禁很重要：沒有它，快但錯的 Agent 會累積費洛蒙，系統就會鎖定在糟糕的路線上。

### 何時使用 PSO / ACO 於 LLM

**適合使用 PSO：**
- 搜尋空間是連續的，或能自然映射到連續參數（例如 prompt embedding、LoRA 權重、數值生成參數）。
- 適應度評估便宜且可自動化。
- 粒子數可以維持在小範圍（10–30 個）。

**適合使用 ACO：**
- 問題是圖上的路由或離散路徑選擇。
- 決策會隨時間自我強化（相同類型的任務會重複出現）。
- 路由決策需要可解釋的依據。

**不適合使用兩者：**
- 適應度需要人工逐一審查（每次迭代成本太高）。
- 搜尋空間是 PSO 無法良好涵蓋的離散組合問題（此時遺傳演算法較合適）。
- 需要嚴格低延遲（PSO 與 ACO 的收斂相對於單次啟發式規則較慢）。

### 為什麼仿生演算法仍然有用

基於梯度的方法需要可微分的訊號。LLM 輸出與路由決策並不容易直接求導。偽梯度方法（例如強化學習路由器、DPO 式 prompt 調整）可行，但需要昂貴的訓練。

PSO 與 ACO 只需要一個**評估器（Evaluator）**函式。只要能為候選輸出或路由決策評分，就能在該空間中做最佳化。因此適用門檻低得多。

### 實務限制

- **族群預算。** N 個粒子 × T 次迭代 × 每次評估成本。若每次 LLM 評估約 0.02 美元，20 個粒子跑 50 次迭代約花 20 美元。請事先規劃。
- **探索 vs 利用（Exploration vs exploitation）。** 費洛蒙衰減率與 PSO 慣性會相互權衡：衰減太快會忘掉好解；太慢則會卡在早期的局部最佳。
- **災難性漂移（Catastrophic drift）。** 若適應度地形改變（新的資料分布），兩種演算法都可能先收斂再發散。要監控最佳適應度的穩定性。

```figure
swarm-stigmergy
```

## Build It｜動手實作

`code/main.py` 實作了以下模組：

- `LMPSO`——對數值型 prompt 參數（temperature、top_k 權重）做 PSO。每個粒子的「LLM 生成」以腳本化的適應度函式模擬。執行 30 次迭代並顯示 g_best 的收斂。
- `AMRO_S`——ACO 風格的路由。3 個 Agent、4 種任務類型、費洛蒙矩陣，共路由 100 個任務。輸出（task_type → agent 選擇）隨時間的分布，顯示軌跡如何形成。
- 比較：在相同任務流下比較隨機路由與 ACO 路由，量測品質與延遲。

執行指令：

```
python3 code/main.py
```

預期輸出：
- LMPSO：g_best 在 30 次迭代中從隨機低分提升到接近最佳。
- AMRO-S：費洛蒙表會穩定指向每種任務類型的合適 Agent；ACO 路由的品質比隨機路由高約 30–40%，並因減少重試而降低延遲。

## Use It｜實際應用

`outputs/skill-swarm-optimizer.md` 協助在 PSO、ACO、遺傳演算法與梯度最佳化器之間，為 LLM 或 Agent 最佳化問題做選擇。

## Ship It｜交付成果

- **從小規模開始。** 10–20 個粒子、20–50 次迭代。只有收斂曲線顯示明確增益時才擴大。
- **每次迭代記錄費洛蒙或 g_best。** 沒有軌跡紀錄，群體最佳化器很難除錯。
- **對更新設品質門禁。** 特別是 ACO 路由：快但錯的 Agent 不得累積費洛蒙。
- **分布漂移時重設衰減。** 評測分布改變後，舊費洛蒙已過時；可重設，或暫時將衰減率加倍。
- **限制每次迭代成本。** 輸出每次迭代的成本指標。若 PSO 每次迭代花 500 美元只換得 0.5% 增益，就不值得交付。

## Exercises｜練習

1. 執行 `code/main.py`，觀察 LMPSO 的收斂。把粒子數設為 5、10、20、50。收斂時間在哪個規模開始趨於飽和？
2. 實作「災難性漂移」實驗：第 30 次迭代後更改適應度函式。PSO 需要多少輪才能適應？重設 `p_best` 是否有幫助？
3. 為 AMRO-S 加上品質門禁：只有評測分數超過 0.7 才沉積費洛蒙。與未加門禁的版本相比，收斂速度有何不同？
4. 閱讀 LMPSO（arXiv:2504.09247）。把「速度即 prompt」映射回你程式中的數值速度。模擬中損失了什麼？保留了什麼？
5. 閱讀 AMRO-S（arXiv:2603.12933）。實作解耦的「推論快速路徑」，費洛蒙以非同步方式更新。在持續負載下，延遲會如何變化？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| PSO | 粒子群最佳化 | Kennedy-Eberhart 1995。以族群為基礎、無梯度的最佳化器。 |
| ACO | 蟻群最佳化 | Dorigo 1992。透過費洛蒙軌跡做路徑／路由最佳化。 |
| LMPSO | 搭配 LLM 生成的 PSO | arXiv:2504.09247。速度是 prompt；由 LLM 產生候選解。 |
| Model Swarms | 專家權重上的 PSO | arXiv:2410.11163。在模型參數子空間上做無梯度更新。 |
| AMRO-S | 用於 Agent 路由的 ACO | arXiv:2603.12933。以任務類型 × Agent 組成費洛蒙矩陣。 |
| p_best / g_best | 個人最佳／全域最佳 | 每個粒子與整個群體迄今找到的最佳解。 |
| 費洛蒙 | 路由記憶 | 邊上的強度；會隨時間衰減；依品質沉積。 |
| 品質門禁更新 | 只從好的執行學習 | 費洛蒙沉積以品質檢查為前提。 |
| 災難性漂移 | 分布偏移 | 適應度地形改變；舊的 p_best 與費洛蒙失效。 |

## Further Reading｜延伸閱讀

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) — 1995 年的 PSO 論文
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) — 1992 年 ACO 奠基研究
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) — 用於結構化 LLM 輸出的 PSO
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) — 在模型權重子空間上進行 PSO
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) — 以費洛蒙驅動且具品質閘門的路由
