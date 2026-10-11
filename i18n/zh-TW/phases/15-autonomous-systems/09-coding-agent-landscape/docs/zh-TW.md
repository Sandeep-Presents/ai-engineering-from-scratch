# 自主程式碼編寫 Agent 的全景版圖（2026）（The Autonomous Coding Agent Landscape (2026)）

> SWE-bench Verified 的基準測試分數在不到三年的時間內從 4% 提升至 80.9%。完全相同的 Claude Sonnet 4.5 模型，在 SWE-agent v1 鷹架上的得分為 43.2%，而在 Cline 自主鷹架上的得分為 59.8%——環繞在模型周圍的鷹架（scaffolding）架構，其重要性已與模型本身同等。OpenHands（前身為 OpenDevin）是當前最活躍的 MIT 開源平台，其 CodeAct 迴圈直接在沙盒中執行 Python 動作，而非依賴 JSON 工具呼叫。然而，頭條數字背後隱藏著方法論上的問題：在 SWE-bench Verified 的 500 個任務中，有 161 個僅需修改 1–2 行程式碼；而在要求修改 10 行以上的 SWE-bench Pro 上，相同的尖端模型得分僅落在 23–59% 之間。

**Type:** Learn
**Languages:** Python (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## The Problem｜問題

「哪一個寫程式的 agent 最厲害？」是一個錯誤的問題。真正正確的問題應該是：在符合我實際工作內容的任務分布上，搭配我預計在正式環境中運作的鷹架架構，究竟能取得多高的端到端可靠度？

在 2022 至 2026 年間，整個業界學到鷹架——檢索層、規劃器、沙盒環境、編輯驗證迴圈、回饋格式——具有關鍵的支撐作用。同一款 Claude Sonnet 4.5 模型，置於 SWE-agent v1 鷹架中僅取得 43.2% 的 SWE-bench Verified 分數；但在 Cline 的自主鷹架中卻斬獲了 59.8%。完全相同的權重，僅因外圍鷹架不同就產生了 16.6 個絕對百分點的落差。基底模型僅是一個元件；完整的迴圈才是真正交付的產品。

伴隨而來的另一項痛點是基準測試飽和所掩蓋的效能退化。SWE-bench Verified 目前已趨近於飽和，且其長尾中的簡單任務（500 個任務中有 161 個僅需 ≤2 行修改）拉高了頂尖得分。真實世界的軟體工程品質更適合在如 SWE-bench Pro（要求 10 行以上修改）此類嚴苛分布上衡量，而相同的領先系統在該測試集上的得分依然徘徊在 23–59% 之間。

## The Concept｜核心概念

### 一個段落了解 SWE-bench

SWE-bench（Jimenez 等人）收集真實的 GitHub issue 及其標準答案修補檔（ground-truth patch），並要求 agent 產出能讓既有測試套件全數通過的修補程式碼。SWE-bench Verified（OpenAI，2024 年）是一個經過人工篩選的 500 個任務子集，剔除了語意模糊與環境損壞的任務。SWE-bench Pro 則是難度更高的後繼者——專門聚焦於需要修改 10 行以上程式碼的任務，目前尖端 agent 的得分僅落在 23–59% 區間。

### 2022 至 2026 年能力曲線的真實樣貌

- **2022 年**：研究型模型在原始 SWE-bench 上的得分約為 4%。
- **2024 年**：GPT-4 搭配 Devin 風格鷹架達到約 14%；SWE-agent 約為 12%。
- **2025 年**：Claude 3.5/3.7 Sonnet 搭配 Aider 與 SWE-agent 推進至 40–55% 區間。
- **2026 年**：Claude Sonnet 4.5 與同級尖端競爭對手在 SWE-bench Verified 上達到 70–80%+。Epoch AI 的排行榜即時追蹤這些分數。

這條陡峭上升的斜率來自於三大動力的複合疊加：更強大的基底模型、更優異的鷹架架構（CodeAct、反思、驗證器迴圈），以及更嚴謹的基準測試（Verified 剔除了大量雜訊）。

### CodeAct 與 JSON 工具呼叫的架構抉擇

OpenHands（All-Hands-AI，arXiv:2407.16741，前身為 OpenDevin）押注了一項獨特的架構方向：與其讓模型發出由主機解碼並執行的結構化 JSON 工具呼叫，不如讓模型直接輸出 Python 程式碼，並由類似 Jupyter 的核心（kernel）在沙盒中執行。這讓 agent 能夠在單一動作中遍歷檔案、串接多項工具，並自行捕獲內部例外狀況。

這兩者的權衡取捨如下：

- **JSON 工具呼叫**：每一次動作都是單輪對話；容易稽核；組合能力受限；預設就具安全性，因為每個呼叫都會經過明確的驗證器。
- **CodeAct**：單一動作即可構成一個完整的程式；具備組合性；需要加固的沙盒環境（OpenHands 採用 Docker 隔離）；其潛在失效模式包含沙盒執行環境所允許的任何行為。

這兩種架構皆已廣泛應用於正式環境。CodeAct 在開放式平台（OpenHands、smolagents）中佔據主導地位；而 JSON 工具呼叫則在代管型服務（Anthropic Managed Agents、OpenAI Assistants）中依然居於主流，因為在這些場景中，由供應商控制執行器。

### 2026 年業界主流鷹架架構對比

| 鷹架 | 授權 | 執行模型 | 值得注意的特性 |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | Docker 中的 CodeAct | 最活躍的開源平台；事件串流可重播 |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | 第一個端到端的 SWE-bench 鷹架 |
| Aider | Apache-2 | 透過 diff 在本地儲存庫編輯 | 精簡的鷹架，回歸穩定性強 |
| Cline | Apache-2 | 具工具政策的 VS Code agent | Sonnet 4.5 上得分最高的開源鷹架 |
| Devin (Cognition) | 專有 | 代管 VM + 規劃器 | 第一個「AI 軟體工程師」產品類別 |
| Claude Code | 專有 | 權限模式 + 例行流程 | 第 10 課詳細介紹 agent 迴圈 |

### 為什麼鷹架設計決定了系統成敗

編寫程式碼的任務本質上是一條長時程軌跡（第 1 課）。系統可靠度會隨著每一步驟的執行呈乘法級複合。鷹架能夠為系統贏得分數的三大支柱包括：

1. **資訊檢索（Retrieval）**：找出該讀取哪些檔案，是無聲的效能瓶頸。SWE-agent 的 ACI、OpenHands 的 file-index（檔案索引），以及 Aider 的 repo-map（程式碼庫地圖）都在攻克這個難題。
2. **驗證器迴圈（Verifier loop）**：自主執行測試、讀取堆疊追蹤資訊並迭代修復，能在 SWE-bench 上帶來 10 個百分點以上的差距。
3. **失效隔離（Failure containment）**：在發生錯誤時能自動回滾的沙盒，可防止損害逐步複合。同一款模型在配備驗證器迴圈前後，表現差距就像兩個不同的產品。

### 基準測試飽和與真實業務分布

OpenHands 作者群與 Epoch AI 皆明確指出，SWE-bench Verified 存在一個簡單的尾部分布：500 個任務中有 161 個僅需修改 1–2 行程式碼。較高的基準測試得分，有一部分正是被這批簡單任務推高的。SWE-bench Pro 則僅限於需要 10 行以上修改的任務，在此標準下，即便是尖端系統得分也僅落在 23–59% 之間。你在正式環境中面對的真實任務分布，幾乎必然更接近 Pro 而非 Verified。

這對挑選 agent 架構的實務啟示是：從你自己的真實 bug 待辦清單中抽取一個類似 Pro 難度的任務子集進行實測。真正重要的指標，是在能代表你實際交付內容的任務上的得分。

```figure
a5-scaffold-delta
```

## Use It｜實際應用

`code/main.py` 在固定的微型任務分布上對比了兩種玩具級 agent 鷹架：

1. 一個每次動作僅執行單一操作的 **JSON 工具呼叫** 鷹架。
2. 一個每次動作皆可產出一小段 Python 程式碼的 **CodeAct** 鷹架。

兩者皆採用固定規則的存根（stub）「模型」，以確保在排除模型能力差異的條件下，獨立評估鷹架本身的架構特質。輸出結果顯示，CodeAct 鷹架能以更少的對話輪次解決更多任務，但代價是單次動作的爆炸半徑（blast radius）較大。

## Ship It｜交付成果

`outputs/skill-scaffold-audit.md` 能協助你在正式導入前稽核所提議的程式碼 agent 鷹架：涵蓋檢索品質、驗證器是否存在、沙盒隔離強度，以及基準測試與真實業務分布的匹配程度。

## Exercises｜練習

1. 執行 `code/main.py`。在相同的任務集上，兩種鷹架各自消耗了多少對話輪次？兩者各自的單次動作爆炸半徑為何？

2. 閱讀 OpenHands 論文（arXiv:2407.16741）。該論文主張 CodeAct 在複雜任務上優於 JSON 工具呼叫。找出論文所承認的一種失效模式，並用一句話說明該模式會在何種正式環境情境下佔據主導地位。

3. 從你團隊的真實 bug 清單中挑選一個需要在兩個檔案之間修改 10 行以上程式碼的任務。評估尖端模型在 (a) JSON 工具呼叫 與 (b) CodeAct 下的端到端成功機率。論證兩者差距的背後原因。

4. SWE-bench Verified 包含 161 個單一檔案且僅需修改 1–2 行的任務。計算一套排除這些任務後的調整分數。排行榜的排名格局會發生怎樣的洗牌？

5. 閱讀 OpenAI 發布的《Introducing SWE-bench Verified》。說明其用來剔除模糊任務的具體方法論，並指出該人工篩選過程可能會遺漏的某一類任務。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| SWE-bench | 「程式碼基準測試」 | 附有標準答案修補檔與測試套件的真實 GitHub issue |
| SWE-bench Verified | 「清理過的子集」 | 500 個經人工篩選的任務，仍保有較簡單的尾部 |
| SWE-bench Pro | 「較難的子集」 | 需修改 10 行以上；尖端系統得分約 23–59% |
| CodeAct | 「以程式碼作為動作」 | Agent 輸出 Python；類 Jupyter 的核心在沙盒中執行 |
| JSON 工具呼叫 | 「函式呼叫」 | 每個動作都是結構化 JSON 負載，執行前經過驗證 |
| 鷹架 | 「agent 框架」 | 圍繞基底模型的檢索 + 規劃器 + 執行器 + 驗證器迴圈 |
| ACI (Agent-Computer Interface) | 「SWE-agent 的格式」 | 為 LLM 使用習慣設計、而非為人類 shell 設計的指令集 |
| 驗證器迴圈 | 「測試後重試」 | 執行測試、讀取輸出、修訂修補程式；是模型以外最大的可靠度增益 |

## Further Reading｜延伸閱讀

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) — 原始基準測試與方法論。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 經過篩選的驗證子集建構方式。
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct 架構與事件流設計。
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) — 即時更新的排行榜。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 長時程程式碼 agent 可靠度的框架說明。
