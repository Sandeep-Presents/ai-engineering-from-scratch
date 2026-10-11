# 多 Agent 強化學習——MADDPG、QMIX、MAPPO（MARL — MADDPG, QMIX, MAPPO）

> 多 Agent 協同的強化學習（RL）歷史淵源，在 2026 年依然深刻啟發並指引著現代 LLM Agent 系統的架構演進。**MADDPG**（Lowe 等人，NeurIPS 2017，arXiv:1706.02275）首創了「集中訓練、分散執行（Centralized Training, Decentralized Execution, CTDE）」範式：在訓練時期，每位 Critic（評論家）皆能俯瞰全場所有 Agent 的狀態與動作；而在測試執行環境，僅由本地的 Actor（行動者）獨立決策運作。該架構同時適用於合作、競爭與混合賽局。**QMIX**（Rashid 等人，ICML 2018，arXiv:1803.11485）提出了基於單調混合網路的價值分解架構：將各個 Agent 的局部 Q 值融合成全域聯合 Q 值，確保 `argmax` 運算子能夠完美分散式求解——在星海爭霸多 Agent 挑戰賽（SMAC）上長期佔據統治地位。**MAPPO**（Yu 等人，NeurIPS 2022，arXiv:2103.01955）則是配備全域集中價值函數的 PPO；在微小粒子世界、SMAC、Google 足球研究環境與花火（Hanabi）等基準上展現出「出人意料的強大實效」，且幾乎無需繁複的超參數調校。這三大經典算法奠定了所有必須分散運作的 Agent 團隊原則訓練基石。MAPPO 更是 **2026 年合作型 MARL 的唯一預設基準線**。本課將在輕量級網格世界中從零實現這三大思想，在深入接觸 LLM Agent 訓練之前，將這些核心模式化為直覺肌肉記憶。

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations)
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## Problem｜問題

在當代多 Agent 系統中，愈來愈多團隊開始嘗試訓練用於跨 Agent 協同決策的專屬原則（Policy）：例如判斷何時應當謙讓、何時應當主動出擊、該向哪位同儕發起任務交接。指引此類協同原則訓練的權威文獻體系，正是早於本輪 LLM 浪潮便已高度成熟的「多 Agent 強化學習（Multi-Agent Reinforcement Learning, MARL）」，該領域已沉澱出極少數幾套佔據絕對統治地位的核心演算法。

若缺乏這套經典的術語辭彙庫，直接研讀現代多 Agent 前沿論文將極其晦澀難懂。「集中訓練、分散執行（CTDE）」、「價值分解（Value decomposition）」以及「全域集中 Critic」絕非行銷流行語——它們是針對特定物理瓶頸給出的精準數學解答：

- **獨立 RL（Independent RL）**（每個 Agent 孤立自主學習）：從個別 Agent 的主觀視角出發，周遭環境處於劇烈的非平穩狀態。收斂極差。
- **全域集中 RL（Centralized RL）**（單一超級大腦統一掌控全體）：計算維度組合爆炸，且在實體分散式部署中直接違背執行隔離約束。
- **CTDE 範式** 巧妙兼取兩者之長：在訓練階段享有全知全能的全域資訊以穩定收斂，在正式部署時退化為純粹依賴本地觀測的自主原則。

## Concept｜核心概念

### 論文採用的三大經典環境

- **微小粒子世界（Particle World / MPE）。** 簡約直觀的 2D 物理世界，支援合作、對抗與混合賽局任務。MADDPG 原始論文的專屬試驗場。
- **星海爭霸多 Agent 挑戰賽（SMAC）。** 專注於極限微操的合作型賽局，具備部分可觀察性（Partial observation）。QMIX 奠定霸權的主場。特徵為離散動作空間與連續狀態空間。
- **Google 足球研究環境（Google Research Football）、花火（Hanabi）、MPE。** MAPPO 全面超越對手的基準測試集。

不同的模擬環境對應著截然不同的動作與觀測型別。各演算法正是依據這些物理邊界進行了針對性數學設計。

### MADDPG（2017）——CTDE 集中訓練分散執行架構

每個 Agent `i` 皆配備專屬的行動者網路 `mu_i(o_i)`，負責將其私有的本地觀測映射為具體動作。與此同時，每個 Agent 還配備專屬的評論家網路 `Q_i(x, a_1, ..., a_n)`，該網路在訓練時期能夠俯瞰全體 Agent 的全域狀態與所有人的動作。行動者透過評論家給出的價值評估進行原則梯度更新。

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

為何 CTDE 能引發質的飛躍：在訓練階段，我們在模擬器中知曉所有人的動作；我們利用這項全域上帝視角大幅削弱每位 Critic 的評估變異數。而在正式推向正式環境執行時，每位 Agent 僅能看見自身的私有觀測 `o_i`，並直接呼叫本地原則 `mu_i(o_i)` 飛速運作。

架構瓶頸：Critic 的輸入維度隨著 Agent 數量 N 呈線性乃至指數級擴展（輸入必須拼接所有人的動作向量）。若缺乏近似簡化手段，該演算法很難直接擴展至超越約 10 位 Agent 之外。

### QMIX（2018）——價值分解架構

嚴格專注於純合作型賽局。全域獎勵被數學表述為各 Agent 局部 Q 值的單調函數組合：

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

其**單調性約束（Monotonicity constraint）**在數學上嚴密保證了一項黃金特性：求解全域最佳動作的 `argmax_a Q_tot`，能夠在物理上精確等價於讓每位 Agent 在本地獨立求解各自的 `argmax_{a_i} Q_i`。這正是**分散執行所必需的終極物理保證**。在訓練時期，由專門的混合網路（Mixing network）依據各局部 Q 值動態合成 `Q_tot`。

為什麼 QMIX 能在星海爭霸 SMAC 評測中稱王：星海爭霸的微操具備高度同質的兵種、局部有限視野以及共享的全域勝負獎勵——這與價值分解的數學假設形成了天衣無縫的完美契合。

架構缺陷：單調性假設在某些情境下過於嚴苛；特定任務的獎勵結構無法被簡單單調分解（例如需要某位 Agent 為了全體團隊利益主動做出自我犧牲的場景）。後續的擴充演算法（如 QTRAN、QPLEX）針對此進行了理論放寬。

### MAPPO（2022）——被忽視的預設基準線

多 Agent PPO（Multi-Agent PPO）：將 PPO 與全域集中價值函數相結合。每位 Agent 擁有自身的本地原則；全體 Agent 共享（或各自維護）一個能夠看清全域完整狀態的價值評估函數。Yu 等人於 2022 年在五大嚴苛基準上對比了 MAPPO 與 MADDPG、QMIX 及其一系列衍生擴充，得出震撼結論：

- MAPPO 在粒子世界、SMAC、Google 足球、花火以及 MPE 上，全面打平或直接擊潰了當時最先進的各類 Off-policy MARL 演算法。
- 所需的超參數調校極其微小。
- 訓練過程展現出無與倫比的穩定性；跨不同隨機種子具備高度可復現性。

在此論文問世之前，整個學界長期嚴重低估了 On-policy MARL 的實戰潛力。到了 2026 年，MAPPO 已毫無爭議地成為所有合作型 MARL 的法定預設基準線；任何聲稱具備突破性的新演算法，皆必須在它面前證明自己。

### 為什麼 LLM Agent 工程師需要深入理解 MARL

三大直接落地場景：

1. **路由器智慧訓練（Router training）。** 由一個元 Agent 負責判定將任務派發給哪位專門子 Agent。這本質上是一個由 N 個分散工作者與單一中央路由器構成的典型 MARL 問題。MAPPO 是絕佳選擇。
2. **角色自發湧現（Role emergence）。** 在開放世界的生成式 Agent 模擬中，訓練各 Agent 隨著時間推移自發形成互補性角色分工，本質上正是偽裝後的 MARL 難題。QMIX 風格的價值分解在結構上強制引匯出互補協同。
3. **多 Agent 工具競爭共享。** 當多位 Agent 共享有限的 API 配額、工具連線數與財務預算時，透過 CTDE 訓練能產出在本地嚴格遵守全域資源約束的成熟離線原則。

現實的工程邊界提醒：在 2026 年的正式環境實踐中，絕大多數 LLM 多 Agent 系統依然優先採用基於 Prompt 的經驗規則，而非端到端重新訓練原則。唯有當你同時具備以下三大條件時，才值得重度投資 MARL 訓練體系：(a) 擁有海量跨 Agent 互動軌跡資料、(b) 具備客觀明確的獎勵訊號，以及 (c) 具備維護分散式訓練基礎架構的工程實力。

### CTDE 作為超越強化學習的架構設計模式

即便完全不碰實體模型訓練，CTDE 也是一門極具智慧的宏觀軟體架構思維：

- 在**架構設計時期（Design time）**，假設自己具備俯瞰全團隊一切狀態的全域上帝視角。
- 在**正式執行環境（Runtime）**，強制實施嚴格的分散式獨立執行：每位 Agent 嚴禁越權窺探他人的私有狀態，僅能看見屬於自己的 `o_i`。

這套思維模式能強迫你在架構初期就將每個 Agent 的私有狀態劃分得一清二楚，並提前嚴肅思考局部可觀察性帶來的資訊盲點。許多粗製濫造的系統在程式碼層面無處不在地濫用全域共享狀態——CTDE 的架構紀律能徹底防範這種架構腐敗。

### 非平穩性難題（The Non-Stationarity Problem）

當多個 Agent 同時展開自主學習時，對任何單一 Agent 而言，其所處的外部環境（因為包含了其他隨時在改變行為原則的動態同儕）處於嚴重的非平穩狀態。古典單一 Agent 強化學習的所有數學收斂證明在此全數失效。本課探討的所有 MARL 演算法皆是為了攻克這項物理瓶頸而生：

- MADDPG：全域 Critic 能夠看清全場所有人的即時動作，從而確保價值評估維持絕對的平穩。
- QMIX：價值分解將學習過程引導至全域聯合 Q 空間，在該空間中最佳解具備良定義。
- MAPPO：全域集中價值函數能夠大幅熨平因其他同儕原則突變所引發的評估變異數。

在純 LLM 多 Agent 系統中，非平穩性通常表現為：「我的 Agent 上個月明明運作良好，但自從上游團隊調整了另一個 Agent 的行為邏輯後，我的 Agent 突然開始頻繁發瘋。」透過 CTDE 嚴格訓練原則是從底層徹底治本的解法；而基於 Prompt 的調整雖然見效極快，但在長期系統演進中往往脆弱不堪。

### 本課明確不涵蓋的範疇

訓練真實的深度神經網路屬於 Phase 09 的核心範疇。本課聚焦於透過純標準函式庫實現腳本化原則版本，旨在完全剝離複雜梯度反向傳播的干擾，將全部精力聚焦於透徹理解 CTDE、價值分解以及全域集中價值函數三大核心架構原語。目標是在你接觸成熟的 MARL 工業庫（如 PyMARL、MARLlib、RLlib multi-agent）之前，將這些底層思維化為不可磨滅的工程肌肉記憶。

```figure
sw-ctde
```

## Build It｜動手實作

`code/main.py` 在一個極簡的 2-Agent 合作網格世界中完整展示了三大核心架構模式：

- 環境設定：兩位 Agent 置於 4x4 的網格中，目標爭奪一枚獎勵代幣。只要任何一位 Agent 順利觸碰代幣即可獲得獎勵 1，任務即刻宣告完工。
- `IndependentAgents`——每位 Agent 粗暴地將同儕視為靜態環境的一部分。作為對照基準線。
- `MADDPGStyle`——集中式 Critic 負責計算全域聯合價值；Actor 原則據此進行定向提升。腳本化原則演進。
- `QMIXStyle`——配備單調混合器的價值分解架構。
- `MAPPOStyle`——集中式全域價值函數；各 Agent 原則對照共享基準線進行優雅更新。

四組實驗在完全相同的環境情境下連續運作，並即時回報抵達目標所需的平均步數。具備 CTDE 特性的變體能夠穩定收斂至顯著更短的最優路徑。

執行指令：

```
python3 code/main.py
```

預期終端輸出：獨立無協同的基準線 Agent 平均需要消耗約 6 步才能抵達目標；而配備了 CTDE 架構的變體能迅速平滑收斂至約 3.5 步（在該 4x4 網格環境中，理論最優步數為 3 步）。即便在腳本化原則的純粹展示下，架構模式帶來的巨大效能鴻溝亦清晰展露無遺。

## Use It｜實際應用

`outputs/skill-marl-picker.md` 能為給定的多 Agent 業務任務精準裁決最適的 MARL 演算法：橫向考量合作 vs 競爭賽局、同質 vs 異質團隊、動作空間型態（連續 vs 離散）、群體規模，以及獎勵訊號的明確度。

## Ship It｜交付成果

MARL 機制推向正式環境實戰前的工程鐵律：

- **堅定以 MAPPO 作為首選起點。** 2022 年的權威論文已確立其無可撼動的基準地位；先完整復現它，能為你省去追逐花俏演算法的大量無謂冤枉路。
- **逐輪強制記錄每位 Agent 的完整觀測流與動作流。** 缺乏單一 Agent 顆粒度軌跡日誌的 MARL 系統，在排查協同異常時將徹底淪為一場噩夢。
- **嚴格在程式碼層面物理隔離「訓練管線」與「執行管線」。** CTDE 是一項嚴肅的架構紀律；確保執行環境的推理路徑在物理上確實僅能存取本地的 `o_i`。
- **獎勵塑形（Reward shaping）的致命警示。** 多 Agent 強化學習對獎勵函數的設計極度敏感。獎勵塑造中哪怕存在一絲一毫的邏輯漏洞，全體 Agent 都會迅速學會以荒謬的作弊手段殘酷鑽營該漏洞。必須強制執行紅隊對抗性測試。
- **針對 LLM Agent 體系，優先評估 Prompt 層級原則。** 唯有在具備充足真實互動資料、客觀獎勵閉環以及完備分散式訓練基礎設施的前提下，才值得真正啟動 MARL 深度訓練。

## Exercises｜練習

1. 執行 `code/main.py`。精確測量獨立 Agent 與 MAPPO 風格 Agent 在抵達目標平均步數上的落差。將網格環境擴大至 6x6，觀察該優勢差距是進一步擴大還是縮小？
2. 實現純對抗競爭變體：兩位 Agent、單一枚代幣，唯有率先觸碰代幣的 Agent 才能獨佔所有獎勵。哪一種架構模式能夠最為優雅純粹地處理這類零和博弈？（回顧 MADDPG 的歷史特性）。
3. 通讀 MADDPG 論文（arXiv:1706.02275）第 3 節。嘗試用你自己的話，以虛擬碼形式符號化寫出其精確的 Critic 更新數學規則。
4. 閱讀 MAPPO 奠基論文（arXiv:2103.01955）。深度剖析作者為何強烈主張「集中價值函數 + PPO」能夠在其實測基準上全面碾壓 Off-policy MARL？整理列舉其最強有力的三大核心論據。
5. 將 CTDE 作為一門架構設計模式，套用於一個假設的 LLM Agent 系統（例如：深度調研 Agent + 摘要提煉 Agent + 程式碼工程師）。列出在「架構設計時期」可全知取得、但在「正式執行環境」必須被物理隔絕的所有全域資訊維度。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## Further Reading｜延伸閱讀

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG 奠基之作，NeurIPS 2017。
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX 經典論文，ICML 2018。
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO 震撼學界的權威論文，NeurIPS 2022。
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — 伯克利 AI 研究院對 MAPPO 實質成效極為通俗生動的架構解讀。
- [SMAC repository](https://github.com/oxwhirl/smac) — 星海爭霸多 Agent 挑戰賽官方開源基準庫。
