# 心智理論與湧現式協同（Theory of Mind and Emergent Coordination）

> Li 等人（arXiv:2310.10701）顯示，在合作型文字博弈中，LLM Agent 會**自發湧現高階心智理論（Theory of Mind, ToM）**——即推理「另一個 Agent 認為第三個 Agent 相信什麼」——但由於上下文管理與幻覺（hallucination）累積，它們在長時程規劃上會失敗。Riedl（arXiv:2510.05174）在群體規模上測量了高階綜效（higher-order synergy），發現**只有**在 ToM prompt 條件下，才會產生身分綁定的角色分化與目標導向的互補；較低能力的 LLM 只顯示出偽湧現。也就是說，協同湧現取決於 prompt 條件與模型，並非免費。本課將實作一個最小的 ToM 感知 Agent，在有無 ToM prompt 的兩種條件下執行合作任務，並依 Riedl 2025 的協定量測協同增量。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Problem｜問題

多 Agent 系統的協同常常看起來很神奇：Agent 自發分工、預判彼此的動作、避免重複。但這種「湧現」通常只是 prompt 工程的結果——有人在 prompt 裡寫了「請協同合作」。拿掉這段 prompt，協同也就消失了。

Riedl 在 2025 年得出了更嚴格的結論：在受控實驗中，只有當 Agent 被明確要求推理**其他 Agent 的心智狀態（ToM）**時，協同才會出現。若沒有 ToM prompt，即使是強模型展現的協同模式，在控制其他因素後也無法成立。這對正式環境很重要：許多團隊宣傳的「多 Agent 自發協同」功能，本質上可能是脆弱、且高度依賴措辭的表面包裝。

本課把 ToM 視為一種具體能力（推理他人如何看待某項信念），建立最小的 ToM 感知 Agent，並衡量真正的協同與 prompt 包裝的差別。

## Concept｜核心概念

### ToM 的意義

發展心理學的說法：3 歲的孩子認為每個人的內心都和自己一樣。5 歲的孩子理解別人可能有不同的信念。7 歲的孩子能推理信念的信念（「她以為我認為球在杯子下面」）。這分別是零階、一階與二階 ToM。

對 LLM Agent 而言，ToM 的階數對應以下結構：

- **零階（Zeroth-order）**：不建模其他人。Agent 只依據自己的觀察行動。
- **一階（First-order）**：Agent 為每位其他 Agent 建立信念模型。「Alice 相信 X。」
- **二階（Second-order）**：Agent 會建模遞迴信念。「Alice 相信 Bob 認為 X。」

Li 等人（2023）發現：在合作博弈中，LLM Agent 會自發出現一階與二階 ToM，但隨著時程拉長與通訊不可靠，能力會下降。

### 莎莉-安測試（簡述）

1985 年的錯誤信念測試：莎莉把彈珠放進籃子 A 後離開。安妮把它移到籃子 B。莎莉回來時會去哪裡找？有一階 ToM 的孩子會說籃子 A（莎莉的信念與現實不同）。沒有的孩子會說籃子 B。

GPT-4 世代的 LLM 在直接提問的莎莉-安式測試中能通過。但當敘述變長、場景多次變化，或問題以間接方式提出時，就會失敗。這就是 2026 年正式環境 LLM 在 ToM 上的實際狀況。

### Riedl 的協同測量

Riedl（arXiv:2510.05174）建立了群體規模的測試：N 個 Agent、一個合作目標，以及不同的 prompt 條件。測量以下三項：

1. **身分綁定的角色分化（Identity-linked differentiation）。** Agent 是否會隨時間形成穩定的角色區分？
2. **目標導向的互補（Goal-directed complementarity）。** Agent 的動作是否互補（處理不同子任務），而非重複？
3. **高階綜效（Higher-order synergy）。** 一項統計量，用來判斷整體是否達到任何子集都無法達到的成果。

結果：只有在 ToM prompt 條件下，三項指標才全部高於基準值。若沒有 ToM prompt，中等能力模型的指標接近隨機。大型模型在沒有顯式 ToM prompt 時也會出現一些協同，但效果比有 prompt 時小。

### 協同假象（Coordination illusion）

在沒有統計控制時，示範中的「湧現協同」通常來自以下情況：

- 把協同寫進 prompt 的工程（例如 prompt 中寫著「一起合作」）。
- 觀察者偏誤（我們會看到自己預期的模式）。
- 事後挑選成功的執行結果。

正式環境中，若宣稱「湧現協同」卻沒有可量測的訊號，應視為行銷話術。在宣稱之前先量測。

### 最小的 ToM 感知 Agent

底層狀態結構：

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

`other_models` 屬性就是 ToM 狀態。一階 ToM 只保留一層。二階則加入 `other_models[i][other_models_of_j]`，也就是「我認為 Agent i 認為 Agent j 相信什麼」。

### 為什麼長時程會損害 ToM

Li 等人記錄：上下文限制會讓 Agent 忘記哪個信念屬於哪個同儕。幻覺則會把虛假信念加進其他 Agent 的模型。兩者都會造成「我以為他以為 X」這類錯誤，並隨時間累積。

論文及 2024 至 2026 年後續研究中記載的緩解方式：

- **在 prompt 中明確列出 ToM 狀態。** 使用結構化格式：`{agent_id: belief_list}`，讓檢索保留身分與信念的對應。
- **縮短推理鏈。** 每輪減少 ToM 更新，可降低複合性幻覺。
- **外部 ToM 儲存。** 把模型放在 LLM 上下文之外，每輪只注入相關部分。

### ToM 在正式環境中的失效情境

- **對抗情境。** ToM 較強的 Agent 反而更容易被操縱（對手可以建模你對他的建模，再加以利用）。
- **異質團隊。** 模型不同時，對某個對手有效的 ToM 模型不一定能推廣。
- **依賴真實標籤（ground truth）的任務。** ToM 關心的是信念；若正確性取決於事實，ToM 可能只會分散注意力。

### 可實際測量的協同

三個實務信號可用來判斷團隊的協同是真實能力，而非 prompt 包裝：

1. **跨時間的互補性（Complementarity over time）。** 在多輪任務中，Agent 的動作是否涵蓋互不重疊的子任務？
2. **預判（Anticipation）。** Agent A 在 T+1 輪的動作，是否依賴對 B 在 T+2 輪動作的預測，而且預測正確？
3. **修正（Correction）。** 若 A 在 T 輪誤判了 B 的信念，A 能否在 T+2 輪前修正？

這些在有紀錄的多 Agent 系統中都可以測量。它們是「協同」敘事的實質版本。

```figure
sw-theory-of-mind
```

## Build It｜動手實作

`code/main.py` 實作了以下模組：

- `ToMAgent`——追蹤自身信念，並為每個其他 Agent 維護信念模型。
- 一個合作任務：三個 Agent 必須從三個箱子各收集一個 token；每個箱子最多放一個。Agent 不能通訊，只能從彼此的動作推斷意圖。
- 兩種設定：`zeroth_order`（無 ToM）與 `first_order`（一層信念模型的 ToM）。
- 在 200 次隨機試驗上量測完成率、重複率（兩個 Agent 瞄準同一個箱子），以及平均完成輪數。

執行指令：

```
python3 code/main.py
```

預期輸出：零階 Agent 的重複努力率約 35%，10 輪內完成約 60% 的試驗。一階 ToM Agent 的重複率約 5%，完成率約 95%。差距即為可量測的協同效果。

## Use It｜實際應用

`outputs/skill-tom-auditor.md` 是一個 skill，用來審查多 Agent 系統聲稱的「湧現協同」：檢查 prompt 包裝、對照組的統計顯著性，以及量測到的互補性。

## Ship It｜交付成果

協同宣稱檢查清單：

- **對照組。** 移除協同 prompt 的系統版本。兩者都要量測。
- **統計檢定。** 系統與對照組在你的指標上，差異是否在 `p < 0.05` 下顯著？
- **互補性指標。** 跨時間測量動作的互斥程度，而不只看最終是否成功。
- **失敗案例紀錄。** Agent 協調失敗時，ToM 狀態看起來如何？
- **揭露模型能力門檻。** 若效果在較小模型上消失，應明確說明。

## Exercises｜練習

1. 執行 `code/main.py`。確認一階 ToM 是否把重複率降低約 7 倍。擴大到 5 個 Agent 與 5 個箱子時，差距是否仍然存在？
2. 實作二階 ToM（Agent A 建模 B 對 C 的看法）。它是否比一階更好？在哪些任務上有幫助？
3. 在 ToM 狀態中注入**幻覺**：每輪隨機翻轉一條信念。這會讓一階 ToM 的表現下降多少？
4. 閱讀 Li 等人的論文（arXiv:2310.10701）。重現「長時程退化」結果：輪數從 10 增加到 30，你的一階 ToM 表現如何變化？
5. 閱讀 Riedl 2025（arXiv:2510.05174）。在你的模擬紀錄上實作高階綜效統計量。若沒有 ToM prompt，效應還在嗎？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| 心智理論（ToM） | 理解他人心智 | 建模另一個 Agent 信念的能力，依階數區分（0、1、2 以上）。 |
| 莎莉-安測試 | 錯誤信念測試 | 1985 年的發展心理學測驗；LLM 能通過直接版本，但無法通過複雜版本。 |
| 一階 ToM | 「A 相信 X」 | 建模某一個他者對事實的信念。 |
| 二階 ToM | 「A 相信 B 相信 X」 | 再往下一層的遞迴建模。 |
| 身分綁定的角色分化 | 隨時間穩定的角色 | Riedl 的指標：角色會持續存在，而非隨機。 |
| 目標導向的互補 | 互不重疊的動作 | Agent 處理不同子任務，而非同一項。 |
| 高階綜效 | 群體超越任何子集 | Riedl 用來判斷真實協同的統計量。 |
| 協同假象 | 看起來協同 | 由 prompt 包裝出的協同外觀，但沒有可量測的訊號。 |

## Further Reading｜延伸閱讀

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) — 合作遊戲中的湧現 ToM；長時程的失效模式
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) — 群體規模的測量；ToM prompting 是關鍵條件
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — ToM 概念的 1978 年起源
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8) — Sally-Anne 論文（1985）
