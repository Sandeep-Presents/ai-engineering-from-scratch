# 審核 Agent：將建置者與評分者徹底分離

> 寫出程式碼的 Agent 絕對不能親自給自己打分數。審核者（Reviewer）是第二個獨立的控制迴圈，擁有截然不同的系統 Prompt、截然不同的目標，並對建置者產出的所有產物僅具備唯讀權限。建置者與審核者之間的架構鴻溝，正是系統可靠性賴以生存的真正沃土。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 38 (Verification Gate)
**Time:** ~55 minutes

## Learning Objectives｜學習目標

- 深入闡明為何同一個 Agent 無法可靠地自我審核。
- 打造一套審核 Agent 迴圈，完整消費建置者產出的客觀產物，並輸出結構化的審核報告。
- 編寫一套具備明確維度、而非憑主觀感覺打分的審核者標準評分表（Reviewer Rubric）。
- 將審核 Agent 接合至工作台體系中，使人類工程師的最終簽名確認始於一份嚴謹的書面產物，而非空白頁面。

## The Problem｜問題

你要求 Agent 修復一個 Bug。它修改了四個檔案、執行了測試，並宣稱大功告成。驗收關卡（第 38 課）確認了驗收指令確實執行過且範疇未超限，關卡亮起綠燈輸出 `passed: true`。你放心地合併了程式碼。兩天後，你發現這項修復解決的是 Bug 中錯誤的那一半問題。

驗收關卡是必要的，但它並不充分。審核者專門提出那些確定性驗收無法回答的深層問題：這項修改是否解決了真正的問題？它是否在未標註的情況下暗中擴大了範疇？它是否記錄了那些本應受到質疑的前提假設？它留下的工作台狀態是否足以讓下一個工作階段平滑接手？

## The Concept｜核心概念

```mermaid
flowchart LR
  Builder[建置者 Agent] --> Artifacts[差異 + 狀態 + 回饋 + 裁決]
  Artifacts --> Reviewer[審核者 Agent]
  Reviewer --> Rubric[reviewer_checklist.md]
  Reviewer --> Report[review_report.json]
  Report --> Human[人類簽核]
```

### 審核者評分標準表

涵蓋五大維度，每項評分 0 至 2 分。

| 評估維度 | 核心檢核問題 |
|---|---|
| Problem fit（問題切合度） | 該變更是否精準解決了最初交辦的任務，而非解決了一個相鄰的無關問題？ |
| Scope discipline（範疇紀律性） | 編輯改動是否嚴格收斂在契約內部，或者契約是有意擴展的？ |
| Assumptions（假設顯式化） | 所有隱性假設是否皆被白紙黑字寫在可供審核的文件中？ |
| Verification quality（驗收品質度） | 驗收指令是否真正證明了目標達成，抑或只是證明了一個較弱版本的目標？ |
| Handoff readiness（移交就緒度） | 下一個對話工作階段能否自當前狀態乾淨俐落地無縫接手？ |

滿分為 10 分。總分低於 7 分屬於軟性未通過（Soft fail）；總分低於 5 分則屬於硬性阻斷（Hard fail）。

### 審核者是角色分離，而非模型分離

你完全可以使用與建置者完全相同的模型來執行審核者。這項架構紀律的精髓在於**角色分工**：不同的系統 Prompt、不同的輸入上下文脈絡，且對 Git Diff 堅決不具備寫入權限。系統姿態的改變也會改變信號。

### 審核者絕對無權編輯 Git Diff

審核者閱讀 Diff、讀取狀態、審視回饋、覆核驗收裁決。它產出的是審核報告。它**絕不親自動手修改 Diff**。若報告指出「請修復此處瑕疵」，由下一個建置者回合負責實施修復；審核者隨後退回審核位。一旦角色混淆，兩者之間的防禦鴻溝將瞬間蕩然無存。

### 審核者評分手冊與自動化驗收關卡

驗收關卡（第 38 課）專門核驗確定性的客觀事實：驗收指令是否執行過、規則是否全數通過、範疇是否被遵守。而審核者則專門做出質性判斷：方向是否正確、假設是否記錄在案、移交是否真正可用。兩者皆不可或缺。

```figure
wb-builder-marker
```

## Build It｜動手實作

`code/main.py` 實作了以下核心架構：

- `ReviewerInputs` 資料類別：完整打包審核者所需閱讀的各項產物；
- 評分標準打分器：每個維度配置一個專屬評分函式（教學中為確定性的模擬常式，正式環境會呼叫 LLM）；
- `review_report.json` 寫入器：輸出五項維度得分、總分與最終裁決（`pass`、`soft_fail`、`hard_fail`）；
- 兩次演示案例：一次乾淨俐落的合規變更，另一次為「測試通過、但修錯問題」的典型失效變更。

執行實驗：

```
python3 code/main.py
```

輸出包含：寫入磁碟的兩份審核報告，以及終端格式化呈現的維度評分表格。

## 真實世界中的生產級模式

實測資料顯示，Cloudflare 於 2026 年 4 月發布的 AI 程式碼審核系統在 30 天內跨越 5,169 個儲存庫的 48,095 個 Merge Requests 中執行了 131,246 次審核。單次審核耗時中位數僅為 3 分 39 秒。在「審核協調器（Review Coordinator）」的指揮下，多達 7 個專業領域審核者（資安、效能、程式碼品質、文件、發布管理、合規性、Engineering Codex）並行執行審核，由協調器負責去重並判定嚴重性。頂級旗艦模型嚴格專供協調器使用；各專業領域專家則執行於更便宜的輕量模型層級。

四大實戰模式支撐了該架構在規模化場景下的穩健運作：

**專業專家池，而非單一龐大的全能審核者**：對於個人專案，單一包含 5 個維度的評分表足矣。一旦程式碼庫涉及資安敏感、極致效能與架構文件等多個深水區表面，應當拆分為擁有多個小 Prompt 的專業專家。協調器負責去重；專家絕不需要通讀整本百科全書。這自然形成模型層級的分流：輕量模型跑專家，旗艦模型跑協調器。

**消除偏見是系統架構需求，而非選配最佳化**：LLM 評審存在四種可預測的系統性偏見（Adnan Masood，2026 年 4 月）：位置偏見（Position bias，GPT-4 在 (A,B) 與 (B,A) 的排序下約有 40% 不一致）、冗長偏見（Verbosity bias，較長的輸出平均會獲得約 15% 的分數膨脹）、自喜好偏見（偏愛同模型家族產出的內容）、權威偏見（過度評高引用知名作者的輸出）。緩解方案：同時評估正反兩種順序且僅在一致時採納；採用明確獎勵簡練文字的 1–4 分評分制；跨模型家族輪換裁判；在評分前移除作者姓名。

**建立標準標定校準集，而非憑主觀感覺盲測**：維護一份包含 10 到 20 個歷史任務及其已知正確裁決的基準校準集。每當修改審核 Prompt 時，強制在該資料集上全量重跑。若與歷史紀錄的一致性低於 80%，該評分標準必須修改後才能發布。這是每個團隊最終都會重新發現的事；不如一開始就建立它。

**與驗收關卡組成混合規範（Hybrid Norm）**：驗收關卡（第 38 課）全權負責客觀確定性檢查（指令是否執行過、測試是否通過、範疇是否守住）。審核者則專職負責語意質性檢查（方向是否正確、假設是否完備、移交是否可用）。Anthropic 於 2026 年的指引明確強調了此切分：切勿要求審核者重複去做驗收關卡早已證明的事情。

## Use It｜實際應用

在正式環境中：

- **Claude Code 子 Agent**：在建置者關閉任務後，啟動審核者子 agent。它會在 PR 上直接發表包含評分細項的評論。
- **OpenAI Agents SDK 委派移交**：建置者在任務完工時移交給審核者。審核者可帶著缺陷清單反手退回給建置者，或向上呈報給人類。
- **雙模型協同拍檔**：建置者執行於速度更快、成本更低的輕量模型；審核者則執行於推理更深、上下文更精煉的頂級旗艦模型。

審核者是當人類工程師無暇親自通讀每次微小變更時，工作台自主生長出的「第二雙眼睛」。

## Ship It｜交付成果

`outputs/skill-reviewer-agent.md` 能為特定專案量身產出審核者評分標準表、對接建置者產物的審核 Agent 骨架，以及與驗收關卡的串聯配置，確保人類審核始於一份結構化的書面報告，而非一片空白。

## Exercises｜練習

1. 針對你的產品領域新增第六個專屬評分維度。說明它為何無法歸入既有的五大維度中。
2. 使用兩種截然不同的系統 Prompt（簡練風 vs 詳盡風）執行審核者。哪一種產出的報告更容易被人類工程師認真通讀？
3. 為每個評分維度新增 `confidence` 信心值欄位。當最低維度的信心值低於 0.6 時，堅決拒絕發布該審核報告。
4. 建立一份標定校準資料集：包含 10 個歷史任務及其已知正確的裁決。執行審核者進行對照，分析它在何處與歷史客觀事實產生了分歧。
5. 新增「要求出示更多證據」的互動機制：審核者在正式打分前，有權要求建置者執行一項特定測試。該如何設計退避機制以防陷入死迴圈？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| Reviewer rubric | 「審核檢查清單」 | 包含五個維度、每個維度評分 0 至 2 分且附帶具體問題的標準評分手冊 |
| Soft fail | 「需返工修改」 | 總分低於 7 分；建置者會收到待處理的缺陷清單 |
| Hard fail | 「直接駁回」 | 總分低於 5 分或任何單一維度得 0 分；流程立即中斷並呈報人類工程師 |
| Role separation | 「角色解耦」 | 相同的模型可以承擔兩種角色；關鍵在於不同的 Prompt 姿態與輸入限制 |
| Confidence floor | 「低信心值不發布」 | 當評分標準對自身判斷缺乏足夠把握時，拒絕輸出草率的裁決結果 |

## Further Reading｜延伸閱讀

- [OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-python/handoffs/)
- [Anthropic Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
- [Cloudflare, Orchestrating AI Code Review at Scale](https://blog.cloudflare.com/ai-code-review/) ——7 專家 + 協調者架構，30 天內 13 萬次執行實證
- [Agent-as-a-Judge: Evaluating Agents with Agents (OpenReview / ICLR)](https://openreview.net/forum?id=DeVm3YUnpj) ——DevAI 基準與 366 項階層式解法需求
- [Adnan Masood, Rubric-Based Evaluations and LLM-as-a-Judge](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80) ——四類 LLM 評審偏見及其緩解方法
- [MLflow, LLM-as-a-Judge Evaluation](https://mlflow.org/llm-as-a-judge) ——建置者與評估者解耦之生產級工具
- [LangChain, How to Calibrate LLM-as-a-Judge with Human Corrections](https://www.langchain.com/articles/llm-as-a-judge) ——標定校準資料集工作流程
- [Evidently AI, LLM-as-a-judge: a complete guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Arize, LLM as a Judge — Primer and Pre-Built Evaluators](https://arize.com/llm-as-a-judge/)
- Phase 14 · 05——Self-Refine 與 CRITIC（單 Agent 自我審核之基準線）
- Phase 14 · 30——評測驅動開發（標定校準資料集生成機制）
- Phase 14 · 38——審核者所依託閱讀的自動化驗收關卡
- Phase 14 · 40——直接消費本審核報告的階段移交封包
