# 心智理論與湧現式協同（Theory of Mind and Emergent Coordination）

> Li 等人（arXiv:2310.10701）證明，在合作型文字博弈遊戲中，LLM Agent 展現出了**自發湧現的高階心智理論（Theory of Mind, ToM）**——即能夠推理「另一個 Agent 對第三個 Agent 的信念持有何種信念」——但由於上下文管理的瓶頸與幻覺累積，在長時程規劃中表現脆弱。Riedl（arXiv:2510.05174）在群體規模下精準量化了高階綜效（Higher-order synergy），發現**唯有**在顯式提示心智理論的條件下，系統才會自發湧現出基於身分綁定的角色分化與目標導向的互補分工；中低能力模型展現的僅是統計上的偽湧現。換言之：協同的自發湧現強烈依賴特定 prompt 的誘導與底層模型能力，絕非免費的午餐。本課將親手實作一個具備心智理論感知能力的最小可行 Agent、在具備與不具備 ToM prompt 的兩種條件下運作合作任務，並對照 Riedl 2025 的標準協定精準測量協同增量。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Problem｜問題

多 Agent 系統之間的自主協同表面上看似極具魔法：Agent 之間自發分工、提前預判彼此的動作、避免資源競爭與重複浪費。然而在現實中，這種所謂的「自發湧現」往往只是 prompt 工程營造出來的表象——純粹是因為某人在 prompt 中直接下達了「請協同合作」的指令。一旦抽離該 prompt，協同效應隨即蕩然無存。

Riedl 在 2025 年給出了更為嚴苛的實證結論：在嚴格受控的實驗條件下，唯有當 Agent 被顯式引導去推理**其他同儕的大腦心智狀態（ToM）**時，真正的深度協同才會真正湧現。若缺乏 ToM prompt，即便是當前最強大的頂尖模型，其展現出的所謂協同模式在統計控制下也無法通過顯著性檢定。這在正式環境中具有生死攸關的意義：無數團隊對外宣傳的「多 Agent 自發協同」功能，在工程本質上往往是脆弱且高度依賴特定措辭的表面包裝。

本課將心智理論視為一項具體的軟體架構能力（推理關於信念的信念），親手建構一個具備心智感知架構的 Agent，並在嚴格的統計對照下，精準區分何謂真正的實質協同、何謂純粹的 prompt 辭藻修飾。

## Concept｜核心概念

### 心智理論（ToM）的深層內涵

發展心理學中的經典階梯：一個 3 歲幼童會天真地認為全世界內心所見皆與自己完全相同。到了 5 歲，幼童開始理解其他人可能持有與自己不同的主觀信念。到了 7 歲，兒童便具備了推理「信念背後的信念」的遞歸能力（例如「她以為我認為球在杯子底下」）。這分別對應著零階、一階與二階心智理論。

在 LLM Agent 領域，心智理論的階數精準映射至以下架構維度：

- **零階心智（Zeroth-order）**：完全缺乏對其他實體的內部建模。Agent 僅純粹依據自身的客觀物理觀察進行反應。
- **一階心智（First-order）**：Agent 在內部建立了一張針對其他每個同儕主觀信念的狀態表。「Alice 相信事實 X。」
- **二階心智（Second-order）**：Agent 具備遞歸信念的內部建模能力。「Alice 相信 Bob 認為事實是 X。」

Li 等人於 2023 年的研究發現：在合作型博弈遊戲中，LLM Agent 能夠自發展現出一階與二階心智理論，但該能力會隨著時間時程拉長以及非同步通訊的雜訊干擾而急遽衰退。

### 莎莉-安測試（Sally-Anne Test）簡析

1985 年提出的經典錯誤信念測試：莎莉將彈珠放進籃子 A，隨後離開房間。安妮趁機將彈珠偷偷移至箱子 B。當莎莉回到房間時，她會去哪裡尋找彈珠？具備一階心智理論的兒童會指出籃子 A（因為莎莉的主觀信念與客觀物理現實存在落差）。而缺乏該能力的幼童則會回答箱子 B。

GPT-4 世代的尖端 LLM 在面對直截了當的莎莉-安測試時能輕鬆通過。然而一旦敘述文字變長、物理場景經歷多次複雜變換，抑或提問改採間接隱晦的方式呈現時，模型便會頻繁崩潰。這正是 2026 年工業級 LLM 在心智理論維度上的真實客觀水準。

### Riedl 的協同度量化實驗

Riedl（arXiv:2510.05174）設計了一項群體規模的嚴謹實驗：N 個 Agent、共同的合作目標、不同的 prompt 實驗組對照。評估三大核心指標：

1. **身分綁定的角色分化（Identity-linked differentiation）。** 隨著時間演進，各 Agent 是否自發形成了長期穩定的專業角色分工？
2. **目標導向的互補分工（Goal-directed complementarity）。** 各 Agent 執行的動作是否呈現出精準的互補性（各自認領不同的獨立子任務），而非無謂的動作衝突與重複？
3. **高階綜效（Higher-order synergy）。** 嚴格的統計指標，用以證明整個群體達成的成就，在數學上絕對無法由任何局部子集的簡單加總所替代。

實證結果震撼人心：**唯有在明確注入 ToM prompt 的實驗條件下**，這三項指標才能全面超越隨機基準線。在缺乏 ToM prompt 時，中等規模模型的各項指標完全徘徊在隨機猜測邊緣。頂尖大模型在無顯式提示下雖能展現極微弱的自發特徵，但其幅度顯著遠低於顯式提示組。

### 虛假的「協同假象（Coordination Illusion）」

在缺乏嚴格統計控制的前提下，各類展示中看似精妙的「自發協同」，往往只是以下三種幻覺的產物：

- 在 prompt 中粗暴寫入的指令假象（例如在系統 prompt 中明文指示「請緊密分工合作」）。
- 人類觀察者的心理投射偏誤（我們總會一廂情願地在隨機雜訊中看出我們期待看到的協同規律）。
- 事後針對偶然成功的特定對局進行挑選式宣傳（Cherry-picking）。

任何在正式環境中宣稱實現了「湧現式自發協同」但無法提出客觀統計顯著性指標的系統，皆應當被直接視為公關宣傳話術。在對外發布前，務必先以實證結果說話。

### 具備心智理論感知能力的最小可行 Agent

底層架構狀態結構：

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

其中 `other_models` 屬性正是心智理論的核心狀態載體。一階 ToM 僅維護單一維度。二階 ToM 則在此基礎上擴充為 `other_models[i][other_models_of_j]`——即「我認為 Agent i 認定 Agent j 所持有的信念為何」。

### 為什麼長時程會破壞心智理論

Li 等人的實證研究揭示了深刻的系統瓶頸：有限的上下文視窗會導致 Agent 迅速忘記「哪一項信念具體屬於哪一位同儕」。而模型的幻覺則會向同儕模型中胡亂注入虛假的主觀信念。這兩者會迅速引發「我以為他以為 X」的連鎖判斷失真，並隨著時間推移呈指數級放大。

文獻記載的工業級實務緩解手段：

- **在 Prompt 中顯式約束結構化的 ToM 狀態。** 採用強型別的結構化格式：`{agent_id: belief_list}`。強制檢索機制維護身分與信念之間的嚴格綁定。
- **縮短單步推理鏈條。** 降低每一輪對話中心智狀態的更新頻率，以遏止複合性幻覺的蔓延。
- **引入外部專屬 ToM 儲存庫。** 將心理狀態模型持久化保存在 LLM 上下文之外，在每一輪中僅按需精準注入最核心的局部切片。

### 心智理論在正式環境中的崩潰盲點

- **對抗博弈情境。** 具備優異心智理論的 Agent 往往更容易遭受惡意操縱（攻擊者能輕易推算你對他的推算，進而實施反向心理利用）。
- **異質混合團隊。** 面對採用截然不同架構的模型同儕時，針對某一特定模型校準的心智模型往往完全無法泛化。
- **強烈依賴客觀物理事實的任務。** 心智理論的核心在於揣摩「主觀信念」；若一項任務的成敗完全取決於「客觀科學事實」，過度的心智揣摩只會淪為分散注意力的無謂內耗。

### 真正能夠被客觀測量的實質協同

證明一個團隊的協同源自真實能力而非 prompt 表面修飾的三大實證信號：

1. **跨時程的動作互補性（Complementarity over time）。** 在多輪執行過程中，各 Agent 的實質動作是否穩定覆蓋互不重疊的獨立子任務？
2. **行為預判能力（Anticipation）。** Agent A 在第 T+1 輪採取的動作，是否精確建立在對 Agent B 在第 T+2 輪即將採取動作的準確預判之上？
3. **即時主動修正（Correction）。** 當 Agent A 在第 T 輪誤判了 Agent B 的意圖時，A 能否在第 T+2 輪前自發修正該認知偏差？

這些維度皆能在受日誌記錄的多 Agent 系統中被嚴密量化。它們構成了「真實協同」這項敘事背後唯一起作用的實質骨架。

```figure
sw-theory-of-mind
```

## Build It｜動手實作

`code/main.py` 完整實作了以下核心模組：

- `ToMAgent`——負責精準追蹤自身信念，並為其他同儕各自維護獨立的信念模型。
- 一項協同合作任務：三位 Agent 必須從三個箱子中分別收集三枚代幣；每個箱子最多只能容納一枚代幣。各 Agent 之間嚴禁直接交談通訊；它們必須純粹透過觀察彼此的物理動作來推斷對方的真實意圖。
- 兩種對照實驗設定：`zeroth_order`（缺乏心智理論的零階盲目 Agent）與 `first_order`（具備一階信念建模能力的 ToM Agent）。
- 橫跨 200 次隨機試驗的量化統計：任務完成率、資源競爭重複率（兩位 Agent 同時爭搶同一個箱子），以及平均完工步數。

執行指令：

```
python3 code/main.py
```

預期終端輸出：零階 Agent 的資源爭搶重複率高達約 35%，且在 10 步之內僅能勉強完成約 60% 的試驗。而配備了一階 ToM 的 Agent 資源重複率急遽驟降至約 5%，完工率高達約 95%。這 30 個百分點以上的巨大落差，正是可被客觀量化的實質協同增益。

## Use It｜實際應用

`outputs/skill-tom-auditor.md` 是一項專業 skill，能客觀審查任何多 Agent 系統所宣稱的「自發湧現協同」：嚴密檢驗是否存在 prompt 表面包裝、對照控制組執行顯著性檢定，並測量實質的動作互補度指標。

## Ship It｜交付成果

對外宣稱具備自主協同能力前的必備驗收清單：

- **必須配置對照組（Control condition）。** 必須在系統中提供一個移除了協同誘導 prompt 的純淨對照組。兩者必須同時施測。
- **嚴格執行統計顯著性檢定。** 實驗組與對照組的指標差異，是否在你的業務資料上達到 `p < 0.05` 的嚴格顯著性？
- **量化互補度指標。** 測量跨時程的動作互斥度，而非僅僅展示最終任務是否碰巧成功。
- **詳盡記錄協同失靈案例。** 當 Agent 發生協同衝突時，其內部的心智信念模型究竟呈現出何種扭曲樣貌？
- **坦誠揭露模型能力下限。** 若該協同效應在輕量級小模型上完全崩潰消失，請在技術規格中明確予以坦誠揭露。

## Exercises｜練習

1. 執行 `code/main.py`。確認一階 ToM 是否成功將資源爭搶率降低了約 7 倍。當你將規模擴大至 5 位 Agent 與 5 個箱子時，該優勢差距是否依然穩定存在？
2. 實現二階心智理論（讓 Agent A 能夠建模 B 認為 C 在想什麼）。二階 ToM 相較於一階 ToM 是否帶來了進一步的實質提升？它在哪一類特定任務上才能展現優勢？
3. 在 ToM 狀態中人為**注入幻覺**：在每一輪隨機翻轉一條信念。觀察這會對一階 ToM 的整體任務效能造成何種程度的破壞？
4. 閱讀 Li 等人的論文（arXiv:2310.10701）。嘗試復現其「長時程效能衰退」的實證結論：當虛擬執行輪次從 10 輪拉長至 30 輪時，一階 ToM 的判斷準確性發生了何種位移？
5. 閱讀 Riedl 2025 年論文（arXiv:2510.05174）。在你的模擬日誌上實作其高階綜效統計演算法。檢驗在缺乏 ToM prompt 的條件下，該統計效應是否確實徹底消失？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Further Reading｜延伸閱讀

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) — 合作博弈中的湧現式心智理論及其長時程失效模式。
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) — 群體規模量化評測；證明 ToM prompt 是協同湧現的承重條件。
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — 1978 年心智理論概念的開山鼻祖文獻。
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8) — 1985 年莎莉-安測試奠基論文。
