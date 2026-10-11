# 動作預算、迭代上限與成本管理器（Action Budgets, Iteration Caps, and Cost Governors）

> 一家規模中等的電商 agent 在團隊啟用了「訂單追蹤（order-tracking）」skill 之後，其單月 LLM 成本從 1,200 美元暴增至 4,800 美元。這絕非 API 的定價錯誤，而是一個 agent 發現了死迴圈並在其中肆無忌憚地揮霍資源。微軟於 2026 年 4 月 2 日發布的 Agent 治理工具包（Agent Governance Toolkit）將防禦此類失效的手段進行了標準化歸納：包含單次請求的 `max_tokens`、任務級別的 token 與美元預算、每日／每月配額上限、迭代輪次上限、分層模型路由、prompt 快取、上下文視窗壓縮、針對昂貴動作設定的 HITL 檢查點，以及在預算超支時觸發的斷路開關（kill switch）。Anthropic 的 Claude Code Agent SDK 也在不同命名下提供了完全相同的核心原語。財務消耗速度限制（例如：10 分鐘內支出超過 50 美元即切斷存取權限）攔截失控迴圈的速度，遠比傳統的月度上限快得多。

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## The Problem｜問題

自主 agent 在運作的每一輪對話中都在消耗真金白銀。傳統 chatbot 的不良輸出最多只是一句糟糕的回覆；而一個自主 agent 陷入死迴圈，換來的是一張天文數字的帳單。業界將這種典型的失效模式稱為「錢包阻斷（Denial of Wallet）」——agent 不斷自我推理、不斷呼叫工具、不斷產生計費，而沒有任何防護機制能加以阻止，因為最初根本就沒有人為它設計煞車系統。

解決之道絕非僅靠設定單一數字。它必須是一套涵蓋不同時間尺度與控制粒度的分層限制堆疊：包含單次請求、單次任務、每小時、每日以及每月維度。一套設計精良的防護堆疊能在數分鐘內攔截失控的無窮迴圈、在數小時內揪出緩慢的暗中洩漏，並在一整天內及時捕獲有瑕疵的軟體發布。唯有依賴這套防護體系，長時程自主 agent 的預算管理才可能在現實中真正落地。

這是一堂極其嚴肅的工程實踐課：底層的數學極為簡單，但多數團隊往往缺乏嚴格的工程紀律而敗下陣來。下文所列出的所有控制項，皆已被收錄於微軟 Agent 治理工具包或 Anthropic Claude Code Agent SDK 的官方文件中。

## The Concept｜核心概念

### 縱深防禦的成本管理技術堆疊

1. **單次請求的 `max_tokens`。** 最直觀的基本防線。防止單一呼叫生成無休止的冗長回應。
2. **單次任務的 Token 預算。** 在單次完整執行過程中，總消耗嚴禁超過 N 個 token。一旦觸及上限強制終止。
3. **單次任務的美元預算。** 與 token 預算概念相同，但以真實法幣計價。在 Claude Code 中對應為 `max_budget_usd`。
4. **單一工具呼叫上限。** 嚴格限制最多呼叫 N 次 `WebFetch`、N 次 `shell_exec` 等。
5. **迭代輪次上限（`max_turns`）。** 限制單一工作階段中 agent 迴圈的總迭代次數，避免無窮推理迴圈。
6. **每分鐘／每小時／每日／每月滾動配額上限。** 透過多重時間視窗，在不同時間維度上及時捕獲資源洩漏。
7. **財務消耗速度限制（Financial velocity limit）。** 例如：「若 10 分鐘內支出超過 50 美元，立即切斷存取權限」。這能在月度上限被觸發之前，第一時間掐死因死迴圈引發的瞬間資金狂飆。
8. **分層模型路由（Tiered model routing）。** 預設採用成本低廉的小模型；唯有當分類器研判任務確實極具挑戰時，才動態升級至更大型的模型。
9. **Prompt 快取（Prompt caching）。** 將系統 prompt 與穩定的靜態上下文保存在供應商快取中；讓重複傳輸的 token 成本趨近於零。
10. **上下文視窗壓縮（Context windowing）。** 透過精簡壓縮與摘要機制，將活躍上下文的大小壓制在門檻以下，直接大幅削減 token 成本。
11. **針對高成本動作設定 HITL 檢查點。** 在發起已知代價高昂的操作（例如耗時甚久的工具呼叫、巨量資料下載、代價昂貴的模型版本升級）之前，強制要求人類點選確認。
12. **預算超支自動觸發斷路開關（kill switch）。** 一旦觸碰任何上限門檻，整個工作階段立即強制終止。違規記錄會被保存，且必須經過獨立的重新啟用流程才能復原。

### 為什麼需要分層防禦，而非單一上限

僅依賴單一的月度上限，往往只能在整個月的預算耗盡之後才被動反應。而若僅設定單次請求上限，在整個工作階段層級上起不到約束作用。不同的系統失效模式，本質上需要不同尺度的時間視窗來精準應對：

- **失控的死迴圈**（agent 陷入間隔 5 秒的瘋狂重試）：由消耗速度限制在幾分鐘內快速掐死。
- **慢性的暗中洩漏**（agent 每次任務消耗的資源達到預期的兩倍）：由每日配額上限及時捕獲。
- **瑕疵版本發布**（新發布的程式碼版本消耗了 5 倍的 token）：由每週或每月配額上限及時發現。
- **業務正常激增**（來自真實用戶的合法流量爆發而非系統 bug）：由每小時或每日配額搭配清晰的稽核日誌予以識別。

### harness 的預算介面

Claude Code Agent SDK 在其公開文件中提供了以下控制參數：

- `max_turns`——迭代輪次硬性上限。
- `max_budget_usd`——美元金額預算上限；一旦超出即刻終止工作階段。
- `allowed_tools` / `disallowed_tools`——工具白名單與黑名單。
- 在工具執行前觸發的鉤子（hook）端點，專供開發者實作自訂的成本核算邏輯。

將這些機制與權限模式階梯（第 10 課）緊密結合。一個在未配置 `max_budget_usd` 的情況下運作的 `autoMode` 工作階段，屬於缺乏成本治理的自主運作。Anthropic 明確強調 Auto Mode 必須搭配預算管控；分類器模型本身並無法解決財務成本失控的問題。

### 歐盟 AI 法案與 OWASP Agentic Top 10

微軟 Agent 治理工具包完全涵蓋了 OWASP Agentic Top 10 以及歐盟《人工智慧法案》第 14 條（人類監督）的合規要求。在歐盟的正式環境運作中，日誌完整留存與預算上限強制執行不再是可有可無的建議，而是具有法律效力的硬性規定。

### 真實案例剖析：從 1,200 美元到 4,800 美元的失控暴增

微軟官方文件中記錄了一個極具代表性的真實慘痛案例：某電商平台的 agent 在引入一項全新工具後，其單月帳單暴增了三倍。該工具允許 agent 在每個對話工作階段中主動輪詢訂單狀態。然而系統缺乏死迴圈偵測、缺乏單一工具呼叫上限，更沒有任何週對週成本異常增長的告警機制。最終的修復方案是追加單一工具呼叫配額，並設定每日成本增長警示。這是一份經典的工程教訓：每一個新增的工具表面，都是潛在死迴圈的全新入口；每一個工具都必須配備專屬的呼叫配額與告警策略。

```figure
cost-governor-stack
```

## Use It｜實際應用

`code/main.py` 模擬了一個 agent 在配備與未配備分層成本管理器技術堆疊下的運作對比。受測的模擬 agent 會在若干輪對話後不慎陷入輪詢死迴圈；分層防護堆疊會在消耗速度視窗內迅速捕獲並掐死迴圈，而單一的月度上限則要等到數天之後、資金大幅損失時才會遲鈍地觸發。

## Ship It｜交付成果

`outputs/skill-agent-budget-audit.md` 能針對所提議的 agent 部署方案全面稽核其成本防禦堆疊，並精準標記出任何缺失的保護層級。

## Exercises｜練習

1. 執行 `code/main.py`。確認在輪詢死迴圈的軌跡中，消耗速度限制是否確實先於迭代上限被觸發。接著停用消耗速度限制，量化計算 agent 在被迭代上限攔截之前究竟額外「浪費」了多少金額。

2. 為瀏覽器 agent（第 11 課）設計一套單一工具呼叫配額組合。哪一個工具需要最為嚴苛的上限約束？哪一個工具可以安全地允許無界呼叫而無重大風險？

3. 閱讀微軟 Agent 治理工具包官方文件。列出該工具包所提及的所有配額上限類型。將每一種類型精準對應至其所能防禦的失效模式（失控迴圈、慢性洩漏、瑕疵發布、流量激增）。

4. 為一次真實的夜間無人值守任務（例如「針對儲存庫中的 50 個 issue 進行分流分級」）進行成本估算。將 `max_budget_usd` 設定為你點估計值的 2 倍。說明將安全裕度設為 2 倍的論證依據。

5. Claude Code 的 `max_budget_usd` 是依據工作階段的累計總成本觸發的。設計一套由外部強制執行的互補型消耗速度限制。其切斷存取的具體觸發條件為何？而後續的重新啟用流程又長什麼樣？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| 錢包阻斷 |「帳單失控」| agent 迴圈持續產生費用，卻沒有上限能阻止 |
| max_tokens |「單次請求上限」| 單次生成內容的大小上限 |
| max_turns |「迭代上限」| agent 工作階段迴圈的迭代次數上限 |
| max_budget_usd |「美元斷路開關」| 工作階段成本上限；超限時中止 |
| 消耗速度限制 |「費率上限」| 短時間內的支出上限（例如每 10 分鐘 50 美元）|
| 分層路由 |「先用小模型」| 預設使用低成本模型；只有分類器判斷需要時才升級 |
| prompt 快取 |「快取的系統 prompt」| 服務供應商端的快取，讓重送 token 的成本接近零 |
| HITL 檢查點 |「人工核准關卡」| 執行高成本動作前必須由人員點選確認 |

## Further Reading｜延伸閱讀

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)
