# 角色專門化分工——規劃者、審查者、執行者與驗證者（Role Specialization — Planner, Critic, Executor, Verifier）

> 2026 年最為普及的多 Agent 任務拆解典範：一人專職規劃、一人專注執行、一人負責批判審查或客觀驗證。MetaGPT（arXiv:2308.00352）將此架構形式化為深植於角色 prompt 中的標準作業程式（SOP）——涵蓋產品經理、架構師、專案經理、工程師與 QA 測試工程師——恪守 `Code = SOP(Team)` 的核心公式。ChatDev（arXiv:2307.07924）則透過「對話鏈」將設計師、程式設計師、審查員與測試員串聯在一起，並引入了「通訊去幻覺（communicative dehallucination）」機制（各 agent 在遭遇細節缺失時主動向上游索取而非盲目臆造）。其中，驗證者的存在至關重要：Cemri 等人（MAST 失效分類研究，arXiv:2503.13657）證明，絕大多數多 Agent 系統的崩潰皆可直接歸咎於驗證機制的缺失或失效。PwC 的正式環境實測更指出，在 CrewAI 中僅僅引入結構化驗證迴圈，就讓系統任務準確率獲得了高達 7 倍的飛躍（從 10% 暴增至 70%）。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Problem｜問題

平庸泛化的多 Agent 系統只會產出平庸泛化的平庸結果。讓三位程式設計師在同一個群組對話中協同，產出的只不過是同一種平庸程式碼的三種微小變體。你可以繼續盲目追加更多 agent、拉長對話輪次，系統品質依然無法跨越及格門檻。

真正的解法絕非盲目堆砌更多 agent——而是引入具備**截然不同專業分工**的異質 Agent。賦予彼此截然不同的角色定義。給予審查者規劃者所不具備的專屬分析工具。為驗證者配備冷酷客觀的自動化測試套件。唯有如此，系統內部才能產生基於實證基礎的良性爭鳴與精準修正，而非停留於平行胡亂猜測。

## Concept｜核心概念

### 四大經典標準角色

**規劃者（Planner）。** 通讀全域目標，產出結構化的步驟清單或技術規格說明書。工具鏈：知識檢索、文獻庫查詢。產出結果：結構化執行規劃。

**執行者（Executor）。** 每次嚴格讀取單一步驟的規劃，產出具體的實體工件。工具鏈：真實的生產作業工具（程式碼編譯器、終端機 Shell、API 用戶端）。產出結果：實體目標工件。

**審查者（Critic）。** 對照規劃者的原始意圖，對執行者交付的產出進行品質審查。工具鏈：工件唯讀檢視權限、靜態程式碼分析器。產出結果：附帶具體反駁理由的接受或打回裁定。

**驗證者（Verifier）。** 讀取工件並執行確定性的客觀程式碼檢驗。工具鏈：自動化測試執行器、型別檢查器、Schema 結構驗證器。產出結果：附帶確鑿實證的通過或失敗判定。

審查者是主觀的、帶有審美與架構偏好的，通常由進階 LLM 擔任。驗證者則是冷酷客觀的、具備確定性的，通常直接由底層程式碼或測試常式擔任。兩者絕非同一個角色。

### MetaGPT 的 SOP 模式

MetaGPT（arXiv:2308.00352）將軟體工程領域的標準作業程式（SOP）直接編碼進各角色的系統 prompt 中：

- **產品經理（Product Manager）** 負責撰寫產品需求文件（PRD）。
- **架構師（Architect）** 負責輸出系統架構設計。
- **專案經理（Project Manager）** 負責進行詳細的任務拆解與排程。
- **工程師（Engineer）** 專注於具體實作。
- **QA 工程師（QA Engineer）** 專門執行自動化測試。

每個角色皆背負著極其嚴格的輸入／輸出 Schema 規範。角色 prompt 清楚界定了該角色「是什麼」以及「必須產出什麼」。這正是 `Code = SOP(Team)` 的深層哲學——確定性的 SOP 能將一群容易發散的 LLM 馴服為高度可預測的高效生產管線。

### ChatDev 的通訊去幻覺機制（Communicative Dehallucination）

ChatDev 引入了一項極具啟發性的關鍵架構：當執行者在實作中發現需要某些規劃中未曾提及的具體細節時，它會主動向上游的設計師發起明確詢問，確認細節後才繼續前進。這徹底遏止了 LLM 習慣性編造看似合理但漏洞百出細節的經典幻覺。

具體實作方式：在角色 prompt 中硬性規定「當你需要未被明確賦予的具體資訊時，在生成任何輸出前，必須指名道姓向相應的角色發起詢問確認」。

### 為什麼驗證者（Verifier）最為生死攸關

Cemri 等人（MAST 研究團隊）對 1,642 次多 Agent 系統的真實崩潰事故進行了詳盡的根因追溯。高達 21.3% 的事故直接源自「驗證缺失（verification gaps）」——即系統直接交付了一個從未經過任何人或程式檢驗的答案。而在剩餘 79% 的各類事故中，絕大多數本質上也能歸咎於「存在某項檢驗步驟，但該檢驗無聲崩潰或從未被真正執行」。驗證者是整個架構中真正承重的核心支柱。

PwC 在 2025 年發布的 CrewAI 正式環境部署報告指出：僅僅在系統中補齊結構化的驗證迴圈，就將任務端到端準確率從微不足道的 10% 直接拉升至驚人的 70%。單一角色的引入，換來了 7 倍的巨大效能回報。

### 審查者（Critic）vs 驗證者（Verifier）的本質區別

- 審查者本質上是一個 LLM，負責評估工件的整體品質與設計風格。具有主觀性。極容易被外觀優美、言之鑿鑿的表面包裝所欺騙。
- 驗證者本質上是一段直接運作在工件上的確定性程式。具有絕對客觀性。透過執行結果產出鐵證如山的通過或失敗判定。

兩者必須並存。審查者負責揪出驗證者難以用公式表達的設計品味與架構瑕疵。驗證者則負責精準捕獲審查者在閱讀文字時完全無法察覺、唯有在執行環境才會瞬間引爆的細微 bug。

### 致命的反模式（Anti-Pattern）

最常見的災難性反模式：系統中的每一個角色全部由 LLM 擔任，且每個角色的輸出都是客客氣氣的「我看過了，完全沒問題（looks good to me）」。這是 MAST 分類體系中最經典的集體失靈。任何架構中，請務必至少配置一位其裁定由實體程式碼而非 LLM 決定的客觀驗證者。

### 主流框架的實作映射

- **CrewAI**——其 `Agent(role, goal, backstory)` 是業界最直觀的角色專門化介面。
- **LangGraph**——每個節點皆可配置高度專門化的 prompt；透過圖邊強制約束審查與驗證管線。
- **AutoGen**——在 GroupChat 中使用單詞命名具備特定角色職責的 ConversableAgent。
- **OpenAI Agents SDK**——在不同專業角色的 Agent 之間定義專屬的交接工具。

```figure
swarm-roles
```

## Build It｜動手實作

`code/main.py` 實現了一個由四大角色協同編寫 Python 函式的標準管線：

- **規劃者（Planner）** 輸出技術規格。
- **執行者（Executor）** 生成程式碼字串。
- **審查者（Critic）**（模擬 LLM）標註顯而易見的設計瑕疵。
- **驗證者（Verifier）** 在沙盒環境（`exec`）中針對測試案例實際執行生成的程式碼。

展示程式會完整執行兩次對比：第一次是執行者生成正確程式碼的情境（審查者與驗證者皆順利放行）；第二次則是執行者產出不符規格程式碼的情境（審查者因程式碼表面看似合理而產生疏漏，但驗證者透過測試失敗精準攔截）。

執行指令：

```
python3 code/main.py
```

## Use It｜實際應用

`outputs/skill-role-designer.md` 能接收一項業務任務並自動產出完備的角色編制架構（3-5 個角色）、各角色的嚴格輸入／輸出 Schema，以及專屬的客觀驗證者檢查規格。在將各 agent 連線進任何框架之前，務必先使用該工具完成角色架構藍圖。

## Ship It｜交付成果

正式環境上線前的核心自檢清單：

- **至少配備一位確定性的客觀驗證者。** 絕不允許全員皆為純 LLM。
- **每個角色具備明確的 I/O Schema。** 規劃者必須回傳結構化規格而非自然語言散文；執行者直接依據該 Schema 進行精準解析。
- **落實通訊去幻覺機制。** 執行者在遭遇資訊缺失時必須強制向上游反問；嚴禁私自憑空捏造。
- **審查者與驗證者的嚴格執行順序。** 先跑審查者（成本低廉，快速揪出宏觀設計缺陷），後跑驗證者（耗時較長，精準捕捉執行環境深層 bug）。
- **嚴格限制修訂迴圈預算。** 審查者與執行者之間的迭代修訂最多允許進行 2 輪，超出後必須果斷上報人工介入。

## Exercises｜練習

1. 執行 `code/main.py` 並仔細觀察驗證者是如何精準揪出審查者所漏掉的潛在 bug。為系統追加一個靜態分析檢查步驟（例如統計 `return` 關鍵字的出現次數）作為輔助驗證者。思考它能捕捉到哪些執行環境測試可能會遺漏的結構問題？
2. 在體系中追加第五個角色：「需求分析師」，負責將使用者的模糊願望轉化為規劃者可直接消費的技術規格。在此架構下，哪些類型的通訊去幻覺請求應當反向流向該角色？
3. 閱讀 MetaGPT 論文第 3 節（Agents）。整理並列出 MetaGPT 旗下 5 大核心角色各自的標準輸入／輸出 Schema。
4. 閱讀 ChatDev 的對話鏈架構圖（arXiv:2307.07924，圖 3）。具體指出通訊去幻覺機制在何處成功打破了原本會導致無窮死迴圈的閉環。
5. PwC 報告中 7 倍的準確率躍升主要歸功於驗證迴圈的引入。嘗試設想三種引入客觀驗證者「毫無用武之地」的業務任務——即在此類任務中，對正確性進行確定性檢驗在物理上是不可能的，或成本高昂至不可承受。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Further Reading｜延伸閱讀

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — 將 SOP 編碼為角色 prompt 的經典奠基論文。
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — 對話鏈與通訊去幻覺機制的權威論文。
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 失效分類體系；揭示 21.3% 的系統崩潰源自驗證缺失。
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) — 正式環境角色規格定義官方指南。
