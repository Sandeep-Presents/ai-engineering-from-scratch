# 基準評測：SWE-bench、GAIA 與 AgentBench

> 三大權威基準奠定了 2026 年的 Agent 評測基石：SWE-bench 測試程式碼修復補丁；GAIA 測試通用多工具呼叫；AgentBench 測試多環境複雜推理。必須深入掌握它們的測試結構、資料集污染背景，以及它們究竟無法衡量什麼。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入解釋 SWE-bench 的測試控端機制（FAIL_TO_PASS），並說明為何以單元測試作為嚴格卡點。
- 闡述為何 OpenAI 推出 SWE-bench Verified（500 個精選任務），以及它具體剔除了哪些雜訊。
- 描述 GAIA 的設計哲學：對人類輕而易舉、對 AI 舉步維艱，以及其三級難度階梯。
- 指出 AgentBench 的八大實體環境，以及開源模型追趕商業閉源模型時的核心瓶頸。
- 總結 SWE-bench+ 的資料污染實證發現及其對業界排行的深遠衝擊。

## The Problem｜問題

公開排行榜僅告訴你在特定基準評測上究竟是哪款模型拔得頭籌。但它們絕不會主動告訴你：

- 該基準評測是否存在嚴重的資料污染（訓練資料中已預先看過標準答案、測試案例洩漏）；
- 該基準評測是否真的切合你關心的真實業務維度（寫程式 vs 網頁瀏覽 vs 通用問答）；
- 評估器本身的驗收邏輯是否足夠穩健（AST 抽象語法樹比對 vs 實體狀態驗收 vs 人工審查）。

在引用任何官方宣傳數字之前，務必徹底搞清這三大定海神針評測及其潛在失效盲區。

## The Concept｜核心概念

### SWE-bench（Jimenez 等人，ICLR 2024 Oral 論文）

- 涵蓋來自 12 個熱門開源 Python 儲存庫的 2,294 個真實 GitHub Issues。
- Agent 取得的輸入資訊：修復前指定 Commit 的程式碼庫 + 自然語言 Issue 描述。
- Agent 的預期產出：一份 Git Patch 修復補丁。
- 評估器邏輯：自動套用該補丁，運行儲存庫既有的單元測試套件。該補丁必須成功翻轉 FAIL_TO_PASS 測試（原本失敗、修復後必須通過），同時絕不可破壞 PASS_TO_PASS 測試（原本就通過的既有測試必須維持通過）。

SWE-agent（Yang 等人，2024 年）在發布時透過針對大模型量身調校的「Agent—電腦互動介面（ACI）」（模型易於理解的檔案編輯器指令與搜尋語法），取得了 12.5% 的亮眼表現。

### SWE-bench Verified

OpenAI 於 2024 年 8 月推出。由人工專家精心審查篩選的 500 個高質量子集。徹底剔除了描述模糊不清的 Issues、不可靠的脆弱測試案例，以及修復邊界不明的任務。如今已成為檢驗「你的 Agent 能否產出生產級修復補丁」的首要權威基準。

### 資料污染（Contamination）

- 超過 94% 的 SWE-bench Issues 其建立時間早於絕大多數現有大模型的知識截止日。
- **SWE-bench+** 的研究深入指出：高達 32.67% 的成功修復補丁，其解決方案細節早已直接洩漏在 Issue 描述文字中（模型在提示中直接看見了標準答案）；而 31.08% 則因測試覆蓋度過於脆弱而存在偽陽性疑慮。
- Verified 子集雖然相對乾淨，但依然無法做到百分之百完全免於污染。

實際工程啟示：一款在 SWE-bench 上宣稱達到 50% 的模型，在去除污染的 SWE-bench+ 上真實得分可能僅有 35%。對外宣稱 SWE-bench 表現時，務必同時回報兩組結果。

### GAIA（Mialon 等人，2023 年 11 月）

- 包含 466 個精選問題；其中 300 個問題嚴格保留於 huggingface.co/gaia-benchmark 作為未公開的私有排行榜盲測集。
- 核心設計哲學：「對人類在概念上輕而易舉（人類得分 92%），對 AI 而言卻舉步維艱（配備外接擴充功能的 GPT-4 僅得 15%）。」
- 全面考驗複合推理、多模態感知、真實網頁檢索與多工具調用。
- 劃分三大難度層級；Level 3 往往需要跨越多模態進行超長路徑的複雜工具鏈調用。

GAIA 是衡量「通用 Agent 綜合能力」的首選基準。切勿將其與程式碼專門測試互相混淆。

### AgentBench（Liu 等人，ICLR 2024）

- 橫跨八大異質實體環境：程式碼（Bash、DB、KG 知識圖譜）、遊戲（Alfworld、LTP）、網頁導航（WebShop、Mind2Web）以及開放式文本生成。
- 多回合長對話互動，每個測試切分約耗費 4k 至 13k 個回合。
- 核心研究結論：長路徑推理、即時決策與嚴格遵守指令能力，是阻礙開源大模型追趕商業閉源模型的最關鍵護城河。

### 這些基準評測無法衡量的面向

- 真實正式環境的維運成本（Token 消耗總額、實體掛鐘耗時）；
- 面對對抗性惡意攻擊時的安全防禦表現；
- 在你專屬垂直業務領域內的真實適配度（必須依賴你自己的專屬 Evals，詳見第 30 課）；
- 長尾極端失效（基準評測衡量的是平均值；而正式環境維運最致命的永遠是那最糟糕的 1%）。

### 評測實踐中的常見盲區

- **單一指標執念**：SWE-bench 50% 傳遞的資訊量，遠不如查看 P50/P75/P95 成本與步驟數分佈來得深刻。
- **引用污染數字**：僅回報未經審核的 SWE-bench 分數，而對 Verified 或 SWE-bench+ 避而不談，在工程上極具誤導性。
- **將評測基準當作產品開發靶標**：過度針對基準評測指標進行特化刷分，往往會與真實正式環境的實用性背道而馳。

```figure
ae-swebench-gate
```

## Build It｜動手實作

`code/main.py` 以純 Python 標準函式庫實作了一套極簡的 SWE-bench 形態測試控端：

- 合成的 Bug 修復任務資料庫（包含 3 個具體任務）；
- 腳本化的「Agent」模組，負責產出修復補丁；
- 測試執行器：嚴格檢核 FAIL_TO_PASS（確認缺陷已修復）與 PASS_TO_PASS（確認既有功能未退化）；
- GAIA 風格的難度分級分類器（依據問題拆解深度進行判定）。

運行實驗：

```
python3 code/main.py
```

日誌會清晰展示各任務與各難度級別的修復成功率，並將評估器的底層判斷規則具象化呈現。

## Use It｜實際應用

- **SWE-bench Verified**：專門評測撰寫程式碼 agent。對外一律以 Verified 基準分數為準。
- **GAIA**：專門評測全能通用型 agent。務必採用私有盲測排行榜切分。
- **AgentBench**：跨多環境的橫向綜合能力橫向評測。
- **自訂 Evals（第 30 課）**：真正決定你產品成敗的專屬業務評測集。

## Ship It｜交付成果

`outputs/skill-benchmark-harness.md` 能為任何「程式碼庫—任務」成對資料建立標準的 SWE-bench 風格測試控端，內建 FAIL_TO_PASS 與 PASS_TO_PASS 的自動化驗收卡點。

## Exercises｜練習

1. 將教學測試控端移植至一個真實的開源程式碼庫上。為已知的 Bug 撰寫 3 個 FAIL_TO_PASS 單元測試。
2. 新增步驟計數指標。在你的 3 個任務中，成功修復一個 Issue 平均需要耗費多少個 Agent 步驟？
3. 研讀 SWE-bench+ 論文。實作一個「答案洩漏檢測器」：透過特徵比對檢查 Issue 描述文字與最終 Diff 補丁之間是否存在重複字句。
4. 下載一道 GAIA 公開切分集中的真實題目。手動推演 GPT-4 等級的 agent 會採取何種行動路徑？它需要調用哪些外部工具？
5. 研讀 AgentBench 各環境的細分表現。哪一個環境與你目前的產品形態最為接近？該環境當前的 SOTA 水準究竟為何？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|---|---|---|
| SWE-bench | 「程式碼 Agent 基準」 | 涵蓋 2,294 個 GitHub Issues；補丁必須成功翻轉 FAIL_TO_PASS 測試 |
| SWE-bench Verified | 「乾淨版 SWE-bench」 | 由 OpenAI 人工精選審查的 500 個高品質無歧義任務子集 |
| FAIL_TO_PASS | 「修復驗收卡點」 | 原本失敗、修復補丁套用後必須轉為通過的測試集合 |
| PASS_TO_PASS | 「防回歸卡點」 | 原本即通過、修復後必須繼續維持通過的既有測試集合 |
| GAIA | 「通用多工具基準」 | 包含 466 道對人類簡單、對 AI 極具挑戰性的複合多模態問題 |
| AgentBench | 「多環境基準」 | 橫跨 8 種異質環境的長路徑多回合綜合評測體系 |
| Contamination | 「測試集資料污染」 | 基準測試中的問題與答案已預先存在於模型預訓練語料庫中 |
| SWE-bench+ | 「資料污染審計研究」 | 揭露成功補丁中有 32.67% 存在 Issue 文字洩漏答案的審計研究 |

## Further Reading｜延伸閱讀

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) ——SWE-bench 奠基論文
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) ——人工精選子集官方說明
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) ——通用多模態多工具基準論文
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) ——多環境綜合評測體系論文
