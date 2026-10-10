# 自動化對齊研究（Automated Alignment Research, Anthropic AAR）

> Anthropic 在獨立沙盒中平行運作由 Claude Opus 4.6 組成的自動化對齊研究員（AAR）團隊，透過日誌儲存於所有沙盒之外的共享論壇進行協同（因此 agent 無法刪除自身的歷史記錄）。在弱監督到強泛化（weak-to-strong）訓練問題上，AAR 的表現超越了人類研究員。Anthropic 自身的總結報告特別指出：硬性規定的工作流程往往會限制 AAR 的靈活性並降低其效能。對齊研究的自動化，是一個大幅壓縮時間軸的關鍵步驟，直接逼近負責任擴展政策（RSP）旨在偵測的各項失準風險。

**Type:** Learn
**Languages:** Python (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## The Problem｜問題

對齊研究極度消耗人類研究員寶貴的時間。諸如可擴展監督（scalable oversight）、獎勵規範制定或弱到強訓練等前沿問題，每次實驗迭代都需要耗費數週。隨著尖端模型能力飛速進展，對齊研發的工作量增長速度遠遠超過了合格研究員的供給速度。

自動化對齊研究（Automated Alignment Research, AAR）探討的是：那些能力正在超越現有對齊手段的尖端模型本身，是否能夠回過頭來協助弭平這個缺口？Anthropic 於 2026 年發布的一份關於 AAR 執行弱到強訓練研究的報告（alignment.anthropic.com/2026/automated-w2s-researcher/），是此類系統在實際部署中的首批公開成果之一。

這項成果確實令人振奮：AAR 在特定研究問題上的表現擊敗了人類基準線。但這項成果也將本階段所探討的所有安全疑慮高度濃縮在單一系統中。如果對齊研究能夠被完全自動化，那麼破壞安全防護機制的各個環節同樣能夠被自動化。RSP 針對 AI 研發能力所設定的防禦門檻，正是圍繞著這個自我增強迴圈而制定的。

## The Concept｜核心概念

### 公開描述的系統架構

- **平行 Agent。** 多個 Claude Opus 4.6 執行個體作為 AAR 運作，各自處於獨立的沙盒中。沙盒嚴格限制了檔案系統、網路連線與行程存取表面。
- **共享論壇。** 所有研究發現都會發布至一個共享論壇，其儲存後端完全獨立於所有沙盒之外。agent 可以讀取該論壇，但絕對無法從自身沙盒內部刪除或修改論壇記錄。
- **任務指派。** 由人類設計的任務佇列將各項研究題目指派給各 AAR。AAR 自主提出任務分解、執行實驗並撰寫研究結果。
- **弱到強訓練研究焦點。** 公開的實驗針對弱到強訓練——即使用能力較弱的監督模型來訓練能力更強的學生模型。AAR 在此任務上的表現超越了人類研究員。

### 為什麼沙盒外日誌至關重要

日誌的完整性，是區分一場受控科學實驗與一場潛在遭受竄改破壞的實驗的關鍵分水嶺。如果 AAR 能夠編輯修改自身的日誌，它們就能夠輕易掩蓋失敗或存疑的實驗步驟。Anthropic 在報告中明確指出：這項不可竄改特性是信任研究產出的必要前提，且其驗證過程極具挑戰性。

在基礎架構層面，這相當於僅限附加（append-only）且直接直寫至外部儲存的日誌系統（例如具備物件鎖定的 S3 Object Lock、不可變更的 Datadog 日誌）。agent 完全沒有修改過去歷史記錄的權限憑證。這與 2026 年企業資安團隊用來防範勒索軟體的不可竄改稽核軌跡採用了完全相同的防禦模式。

### 規定工作流程的權衡取捨

Anthropic 的報告指出，過度刻板規定的工作流程往往會約束 AAR 的靈活性並削弱其表現。換言之：若人類設計師一步步手把手規定研究步驟，AAR 的表現反而劣於給予高階目標並賦予自主任務分解自由的設定。這與整個 Agentic 科研領域（如 LangGraph、微軟 Agent Framework）的實證結果高度一致——過度指定的鷹架反而會扼殺高能力 agent 的潛力。

這背後的安全意涵非常微妙。能夠提升 AAR 表現的靈活性，同時也是允許未經授權的任務分解、新奇工具呼叫以及目標漂移（goal-drift）的靈活性。這是一個系統設計空間上的取捨抉擇：究竟該賦予多少自由度以換取擊敗人類的強大能力，同時又不會留給 agent 將目標泛化至非預期分布之外的空間？

### 時間線壓縮的潛在風險

RSP v3.0（第 19 課）引入了「AI 研發能力門檻」：即以媲美「人類加 AI 工具」的具競爭力成本，全自動化整條 AI 研發管線的能力。DeepMind 的 FSF v3 也包含了類似的機器學習研發自主性等級。這兩個安全框架都將這個門檻視為啟動高等級管控機制的觸發點。

AAR 目前距離完全跨越該門檻僅有一步之遙：它自動化了管線的一部分（在特定且定義明確的任務上進行對齊研究），但尚未完全閉合端到端的模型能力研發閉環。關鍵的時間線問題在於：這個剩餘的差距會以多快的速度被弭平？

被急遽壓縮的時間線引發了複合性失效的深層憂慮。如果對齊研究與能力研發以相似的速率複合增長，那麼失準風險的覆蓋表面至少會與能力同步擴大。若能力研發複合增長得更快（這正是歷史常態），兩者之間的缺口將會進一步拉大。這正是為何 AAR 被視為一種有條件的正面進展：每一項新發現的對齊成果唯有在研究過程完全可信的前提下，才能真正縮小安全落差。

### AAR 尚未取代的人類職責

人類研究員依然負責設定任務佇列、審查實驗結果，並掌握至高無上的憲法管治權力。AAR 只是加速了管線的中游執行環節，而非兩端的決策核心。Anthropic 公開的研究產物中，同時包含了 AAR 的研究貢獻，以及人類研究員針對何時該公開發布、何時該撤回重審以及何時該進一步深化的專業價值判斷。

這與第 15 課所探討的「先提議後確認寫入（propose-then-commit）」模式在科研領域的投射完全吻合：AAR 負責提出提議；人類負責最終 commit。

```figure
aar-forum
```

## Use It｜實際應用

`code/main.py` 模擬了一個多 AAR 的協同研究論壇。三個獨立的「科研 agent」平行運作，將各自的研究發現發布至僅限附加的論壇，並包含可選的竄改日誌嘗試。

觀察焦點：

- 沙盒外日誌如何精準捕獲竄改日誌的非法企圖。
- 具備自由任務分解的任務分配方式，在面對難題時為何顯著優於刻板固定的工作流程。
- 若日誌不具備防竄改證明能力，單一失控受損的 AAR 會如何迅速污染整個論壇的資訊品質。

## Ship It｜交付成果

`outputs/skill-aar-deployment-review.md` 是一份用於自動化對齊研究管線部署前的全面安全審查清單。

## Exercises｜練習

1. 執行 `code/main.py`。比較「固定工作流程」與「自由任務分解」兩種設定。自由任務分解是否總是能取得壓倒性勝利？抑或存在特定類型的問題讓固定流程依然具備競爭力？

2. 修改模擬器，讓其中一個 agent 嘗試竄改歷史日誌。確認僅限附加的日誌系統能否成功偵測。撰寫一個段落，精確描述該偵測特徵在日誌中呈現出的具體樣貌。

3. 閱讀 Anthropic 的弱到強 AAR 研究報告。指出 AAR 擊敗人類研究員的具體子任務為何。究竟是該任務的哪些特質使其特別適合被自動化？

4. 設計一套任務佇列分配政策，在 AAR 靈活性（換取更優異的研究成果）與刻板流程約束（換取更容易的稽核審查）之間取得平衡。說明你將如何對這兩種模式進行 A/B 測試。

5. 閱讀 RSP v3.0 中的「AI R&D-4」能力門檻。用一個段落描述你認為跨越該門檻所需具備、但目前 AAR 尚未擁有的關鍵能力。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Further Reading｜延伸閱讀

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — 第一手研究報告。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — AI 研發能力門檻定義。
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 廣義的 agent 自主性架構探討。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — 與 RSP 對標的機器學習研發自主性等級。
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — AAR 所攻克的底層科學難題。
