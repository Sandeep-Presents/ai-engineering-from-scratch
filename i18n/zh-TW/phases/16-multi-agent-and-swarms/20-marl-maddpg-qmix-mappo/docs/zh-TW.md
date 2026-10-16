# 多 Agent 強化學習（MARL）——MADDPG、QMIX、MAPPO

> 多 Agent 協同的強化學習淵源，至今仍影響 2026 年的 LLM Agent 系統。**MADDPG**（Lowe 等人，NeurIPS 2017，arXiv:1706.02275）提出集中訓練、分散執行（Centralized Training, Decentralized Execution, CTDE）：訓練時，每個 critic 能看到所有 Agent 的狀態與動作；測試時只執行本地 actor。適用於合作、競爭與混合情境。**QMIX**（Rashid 等人，ICML 2018，arXiv:1803.11485）採用價值分解與單調混合網路：各 Agent 的 Q 值合成聯合 Q，使 `argmax` 能乾淨地分散計算——在星海爭霸多 Agent 挑戰（SMAC）上占主導地位。**MAPPO**（Yu 等人，NeurIPS 2022，arXiv:2103.01955）是帶有集中式價值函數的 PPO；在粒子世界、SMAC、Google Research Football、Hanabi 上，只需極少調參就「出人意料地有效」。這些方法支撐了必須分散行動的 Agent 團隊的策略訓練。MAPPO 是 **2026 年合作型 MARL 的預設基準**。本課先在小型網格世界中實作三種想法，再接觸 LLM Agent 訓練。

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations)
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## Problem｜問題

LLM Agent 系統越來越常訓練用於 Agent 間協調的策略：何時讓步、何時行動、該呼叫哪個同儕。教導如何訓練這類策略的文獻，是多 Agent 強化學習（Multi-Agent Reinforcement Learning, MARL）。MARL 早於 LLM 浪潮，已有少數主流演算法。

若沒有這些模式詞彙，讀 MARL 論文會很痛苦。集中訓練、分散執行（CTDE）、價值分解與集中式 critic 不是流行語，而是針對具體問題的具體解答：

- 獨立 RL（每個 Agent 各自學習）：從單一 Agent 的視角看，環境是非平穩的。效果差。
- 集中式 RL（一個 Agent 控制全部）：無法擴展，也違反執行限制。
- CTDE 兼取兩者：訓練時使用全域資訊，部署時只依賴本地觀測的策略。

## Concept｜核心概念

### 論文使用的三種環境

- **粒子世界（Particle World / MPE）。** 簡單的 2D 物理環境，含合作與競爭任務。MADDPG 最初使用的測試環境。
- **星海爭霸多 Agent 挑戰（SMAC）。** 合作式微操，具有部分觀測。是 QMIX 的測試環境。離散動作、連續狀態。
- **Google Research Football、Hanabi、MPE。** MAPPO 基準測試所用的環境。

不同環境的動作與觀測型別不同，演算法也會相應選擇。

### MADDPG（2017）——CTDE 模式

每個 Agent `i` 都有一個 actor `mu_i(o_i)`，把自己的本地觀測映射為動作。每個 Agent 還有一個 critic `Q_i(x, a_1, ..., a_n)`，訓練時能看到所有觀測與所有動作。actor 依據 critic 的評估做策略梯度更新。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

為何用 CTDE：訓練時我們知道每個人的動作，用來降低每位 critic 的變異。部署時，每個 Agent 只看見 `o_i`，並呼叫 `mu_i(o_i)`。

失效模式：critic 的輸入維度隨 Agent 數量 N 線性增長（需拼接所有 Agent 的動作）。若沒有近似，超過約 10 個 Agent 就難以擴展。

### QMIX（2018）——價值分解

僅適用於合作型賽局。全域 Q 值是各 Agent 局部 Q 值的單調函數：

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

單調性（monotonicity）保證：`argmax_a Q_tot` 可以由每個 Agent 各自選擇 `argmax_{a_i} Q_i` 得到。這正是**分散執行**所需的性質。訓練時，混合網路（mixing network）由各 Agent 的 Q 值產生 `Q_tot`。

為什麼 QMIX 在 SMAC 上占主導地位：星海爭霸的合作微操有同質 Agent、局部觀測與全域獎勵，很適合價值分解。

失效模式：單調性限制較強；有些任務的獎勵結構無法單調分解（例如某個 Agent 為團隊犧牲）。QTRAN、QPLEX 等擴充放寬了這個限制。

### MAPPO（2022）——被忽視的預設基準模型

Multi-Agent PPO：PPO 加上集中式價值函數。每個 Agent 有自己的策略；所有 Agent 共享（或各自擁有）能看到完整狀態的價值函數。Yu 等人（2022）在五個基準上比較 MAPPO 與 MADDPG、QMIX 及其擴充，發現：

- MAPPO 在粒子世界、SMAC、Google Research Football、Hanabi 與 MPE 上，能與 off-policy MARL 方法打平或勝過。
- 所需的超參數調整很少。
- 訓練穩定，跨隨機種子可重現。

在這篇論文之前，學界低估了 on-policy MARL。到了 2026 年，MAPPO 是合作型 MARL 的預設基準模型；任何新方法都必須勝過它。

### 為什麼 LLM Agent 工程師應該關心 MARL

三個直接應用：

1. **路由器訓練（Router training）。** 一個元 Agent 決定由哪個子 Agent 處理任務。這是 N 個分散子 Agent 與一個集中路由器的 MARL 問題。MAPPO 適用。
2. **角色湧現（Role emergence）。** 在生成式 Agent 模擬中，訓練 Agent 隨時間形成互補角色，本質上也是 MARL 問題。QMIX 式的價值分解會依其結構強制形成互補性。
3. **多 Agent 工具使用。** 當 Agent 共享工具並競爭預算時，透過 CTDE 訓練可得到能遵守資源限制的本地策略。

實務上的提醒：2026 年多數正式環境 LLM Agent 系統是用 prompt 設定策略，而非訓練策略。當你同時有 (a) 大量互動資料、(b) 清楚的獎勵訊號，以及 (c) 願意投資訓練基礎設施時，才適合導入 MARL。

### CTDE 作為超越強化學習的架構設計模式

即使不訓練模型，CTDE 也是有用的架構模式：

- **設計時**（Design time），假設可以看見整個團隊的全部狀態。
- **執行時**（Runtime），強制分散執行：每個 Agent 只能看見自己的 `o_i`。

這個模式會迫使你在早期就明確定義每個 Agent 的狀態，並思考部分可觀測性。許多正式環境的多 Agent 系統會默默假設到處都有共享狀態；CTDE 的紀律可以避免這種情況。

### 非平穩性問題（non-stationarity）

當多個 Agent 同時學習時，每個 Agent 的環境（包含其他 Agent 的策略）都是非平穩的。古典單 Agent RL 的收斂證明在此不再成立。本課的 MARL 演算法都是為了處理這一點：

- MADDPG：全域 critic 能看到所有人的動作，因此價值估計是平穩的。
- QMIX：價值分解把學習移到聯合 Q 空間，在那裡最佳性定義良好。
- MAPPO：集中式價值函數會抑制因他人策略改變而產生的變異。

在 LLM Agent 系統中，非平穩性常表現為：「我的 Agent 上個月還能正常運作，上游另一個 Agent 改了之後，我的就開始出錯。」用 CTDE 訓練 MARL 是有原則的根本解法；prompt 層級的修補較快，但持久性較差。

### 本課不涵蓋的內容

訓練真正的神經網路屬於 Phase 09。本課以標準函式庫實作腳本化策略版本，展示 CTDE、價值分解與集中式價值函數的模式，不做梯度反向傳播（backpropagation）。目標是在使用完整的 MARL 函式庫（PyMARL、MARLlib、RLlib multi-agent）之前，先內化這些模式。

```figure
sw-ctde
```

## Build It｜動手實作

`code/main.py` 在一個 2-Agent 合作網格世界中展示三種模式：

- 環境：4x4 網格上有 2 個 Agent 和一顆獎勵 pellet。任一 Agent 抵達 pellet 時獎勵為 1，任務結束。
- `IndependentAgents`——每個 Agent 把其他 Agent 當成環境的一部分，作為基準模型。
- `MADDPGStyle`——集中式 Critic 計算聯合價值；Actor 策略據此更新。腳本化的策略改進。
- `QMIXStyle`——配備單調混合器的價值分解。
- `MAPPOStyle`——集中式價值函數；各 Agent 的策略依據共享基準函數更新。

四種版本都在相同的 episode 上執行，並回報平均抵達目標的步數。CTDE 變體收斂到的路徑比獨立基準模型短。

執行指令：

```
python3 code/main.py
```

預期輸出：獨立 Agent 平均約 6 步；CTDE 變體收斂到約 3.5 步（4x4 網格的最優解為 3 步）。即使是腳本化策略，模式差異也會顯現。

## Use It｜實際應用

`outputs/skill-marl-picker.md` 是一個 skill，依多 Agent 任務選擇 MARL 演算法：合作 vs 競爭、同質 vs 異質、動作空間型態、規模，以及獎勵訊號。

## Ship It｜交付成果

MARL 在正式環境中並不常見。若要使用：

- **從 MAPPO 開始。** 2022 年的論文確立了它作為基準模型；先重現它，可省下追逐花俏方法的時間。
- **記錄每個 Agent 的觀測與動作串流。** 沒有逐 Agent 的追蹤，MARL 幾乎無法除錯。
- **訓練程式與執行程式分開。** CTDE 是一種紀律；確保執行路徑只能看到 `o_i`。
- **獎勵塑形（reward shaping）警示。** MARL 對獎勵設計很敏感。獎勵塑形中只要有一個協調漏洞，Agent 就會學會利用它。請做對抗測試。
- **對 LLM Agent，先考慮 prompt 層級的策略。** 只有在互動資料、獎勵訊號與基礎設施都具備時，才投入 MARL 訓練。

## Exercises｜練習

1. 執行 `code/main.py`。量測獨立 Agent 與 MAPPO 風格 Agent 的平均步數差距。在 6x6 網格上，差距是變大還是變小？
2. 實作競爭變體：兩個 Agent、一顆 pellet，只有先到達的 Agent 得獎。哪種模式能乾淨地處理競爭？（歷史上是 MADDPG）。
3. 閱讀 MADDPG（arXiv:1706.02275）第 3 節。用自己的話，以偽程式碼寫出 Critic 的更新規則。
4. 閱讀 MAPPO（arXiv:2103.01955）。作者為什麼認為「集中式價值 + PPO」在他們的基準上勝過 off-policy MARL？列出三個最有力的論點。
5. 把 CTDE 套用到一個假設的 LLM Agent 系統（例如研究 Agent + 摘要 Agent + 寫程式 Agent）。列出設計時可見、但執行時必須隔離的全域資訊。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| MARL | 多 Agent RL | 用於多 Agent 系統的強化學習。 |
| CTDE | 集中訓練、分散執行 | 訓練時使用全域資訊；部署時使用本地策略。 |
| MADDPG | 多 Agent DDPG | 採用 CTDE；每個 Agent 的 Critic 能看到所有觀測與動作。 |
| QMIX | 價值分解 | 對各 Agent 的 Q 值做單調混合。適用於合作。 |
| MAPPO | 多 Agent PPO | 具集中式價值函數的 PPO。2026 年的預設基準模型。 |
| 價值分解 | 個別 Q 值的加總 | 聯合 Q 值表示為各 Agent Q 值的單調函數。 |
| 非平穩性 | 移動的目標 | 每個 Agent 的環境會隨其他 Agent 學習而改變。是 MARL 的核心問題。 |
| On-policy / off-policy | 從當前經驗學習／從回放學習 | PPO 是 on-policy（MAPPO）；DDPG 與 Q-learning 是 off-policy。 |
| SMAC | 星海爭霸多 Agent 挑戰 | 合作微操基準；QMIX 的主要測試場。 |

## Further Reading｜延伸閱讀

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG；NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX；ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO；NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — 易讀的 MAPPO 研究結果說明
- [SMAC repository](https://github.com/oxwhirl/smac) — StarCraft 多 Agent 挑戰賽
