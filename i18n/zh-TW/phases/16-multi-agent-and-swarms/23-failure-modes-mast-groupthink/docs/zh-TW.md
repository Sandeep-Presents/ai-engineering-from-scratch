# 失效模式——MAST 分類體系、群體盲從、單一文化與連鎖崩潰（Failure Modes — MAST, Groupthink, Monoculture, Cascading Errors）

> 2026 年多 Agent 領域的權威失效分類標準當屬 **MAST**（Cemri 等人，NeurIPS 2025，arXiv:2503.13657），該研究深入剖析了橫跨 7 個頂尖開源多 Agent 系統的 1,642 條真實執行軌跡，揭示出高達 **41% 至 86.7% 的驚人失敗率**。三大核心根因分類為：**規格定義問題（Specification Problems）**（佔比 41.77%）——角色邊界模糊、任務目標欠缺精準約束；**協同失靈（Coordination Failures）**（佔比 36.94%）——通訊中斷、狀態不同步；**驗證缺失（Verification Gaps）**（佔比 21.30%）——缺乏獨立檢驗、客觀品質把關缺位。**群體盲從家族（Groupthink Family）**（arXiv:2508.05687）進一步歸納了：單一文化崩潰（同質基底模型導致相關性錯誤）、從眾偏見（Agent 互相迎合並強化彼此的幻覺）、心智理論缺陷、混合動機內耗以及連鎖可靠性崩潰。連鎖崩潰的典型代表為重試風暴（Retry storms）：支付微服務的瞬時抖動引發訂單 Agent 盲目重試，進而觸發庫存檢查風暴，在數秒內使庫存服務面臨 10 倍負載而全面癱瘓（必須強制配置熔斷機制）。記憶體污染：單一 Agent 的幻覺滲入共享記憶體，下游 Agent 奉為真理，導致系統準確率慢性衰退，使根因追溯極其痛苦。**STRATUS**（NeurIPS 2025）指出：透過部署專門的偵測、診斷與驗證 Agent 鐵三角，能使故障緩解成功率提升 1.5 倍。本課將各類失效模式視為一等公民的架構輸入目標。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## Problem｜問題

多 Agent 系統在面對真實複雜任務時，失敗率高達 41% 至 86.7%（Cemri 等人於 2025 年在 7 個開源多 Agent 系統上實測證實了這組殘酷數字）。這類系統性崩潰絕非靠「再多加幾個 Agent」就能輕易除錯。各項失敗背後皆有深刻的結構性誘因。MAST 分類體系為我們提供了權威的歸因座標系。本課將每個分類精準映射至具體的偵測、診斷與工程緩解模式，讓這些統計數字不再抽象。

2026 年的正式環境工程準則，是將各類失效模式直接作為架構設計的初始輸入。在你能針對 MAST 的每一個具體類別指名道姓說出你所部署的相應防禦措施之前，你的系統架構絕對稱不上「已經及格」。

## Concept｜核心概念

### MAST 三大核心根因分類

**規格定義問題（Specification Problems，佔總體失效的 41.77%）。** Agent 的任務目標在語意上未被足夠嚴密地約束。具體範例：

- 角色邊界模糊：兩個 Agent 同時誤以為自己才是主審查員。
- 任務約束不足：使用者需要特定角度的分析，指令卻僅下達為模糊的「請總結此文」。
- 驗收標準隱式未明：Agent 在物理上根本無法判斷自己何時才算真正成功交付。

工程緩解手段：
- 撰寫極其嚴格的角色契約。在每位 Agent 的 prompt 中不僅明確規範它要做什麼，**更必須白紙黑字寫明它絕對不准做什麼**。
- 為每個任務編寫前置驗收測試。在 Agent 啟動前，嚴格定義「完工狀態必須長成 X 樣貌」。
- 派遣前置規格審查員：在正式派發任務前，由專門的 Agent 對任務定義進行靜態檢查。

**協同失靈（Coordination Failures，佔比 36.94%）。** 通訊中斷或狀態嚴重不同步。

具體範例：
- 兩個 Agent 在缺乏同步鎖的前提下同時修改共享狀態。
- 訊息在傳遞中途遺失（佇列故障、連線逾時）。
- 狀態感知漂移：Agent A 認定任務已圓滿結束，而 Agent B 卻仍在背景苦苦運算。

工程緩解手段：
- 實施帶有版本號的樂觀並行控制共享狀態。
- 針對關鍵訊息實施顯式確認應答機制（未收到 ACK 則依原則重試）。
- 部署週期性的狀態同步檢查點；及早揪出狀態漂移。

**驗證缺失（Verification Gaps，佔比 21.30%）。** 缺乏針對產出成果的獨立客觀檢驗。

具體範例：
- 某個 Agent 自行宣稱任務大獲成功；全場無人進行實質核驗。
- 鏈條中的各個 Agent 盲目信任上游交付的半成品。
- 針對自發湧現的整體複合行為完全缺乏整合測試覆蓋。

工程緩解手段：
- 部署獨立的客觀驗證者 Agent（第 13 課）。具備唯讀權限與獨立外部資料來源調閱能力。
- 確立明確的交接契約：「Agent A 的輸出必須強制通過檢查器 C 的驗收，方允許觸發 Agent B」。
- 完整落盤最終成果日誌，供事後進行嚴密的回溯稽核。

### 群體盲從家族（Groupthink Family，arXiv:2508.05687）

當 Agent 之間高度同質化或盲目相互模仿時湧現的五大連鎖失效：

**單一文化崩潰（Monoculture collapse）。** 共享相同的基底模型或預訓練資料集 → 引發完全相同的相關性錯誤。當三個 Agent 共享同一套 LLM 時，它們會集體陷入完全相同的幻覺。

**從眾偏見（Conformity bias）。** 各 Agent 迅速向語氣最自信或聲音最大的同儕妥協低頭，即便該論點在客觀事實上錯得離譜。

**心智理論缺陷（Deficient ToM）。** Agent 無法正確推斷對方的意圖與信念；協同體系全面瓦解（第 18 課）。

**混合動機內耗（Mixed-motive dynamics）。** 當各 Agent 具備部分衝突的利益目標時，討論會迅速滑向毫無原則的中庸妥協，最終端出令所有人都無法接受的平庸產物。

**連鎖可靠性崩潰（Cascading reliability failures）。** 某個單一元件的微小異常模式，引爆了依賴它的下游所有元件的連鎖大規模崩潰。

### 連鎖崩潰案例——重試風暴（Retry Storm）

2026 年極具代表性的正式環境災難事故鏈：

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

標準的救命良方：**熔斷機制（Circuit breakers）**。一旦下游微服務的錯誤率突破預設門檻，立即切斷後續呼叫，直接回傳快取結果或降級兜底方案。外加為每個單一請求配置不可逾越的重試次數硬性上限。

熔斷機制是極少數完全無需任何 AI 改造、直接從古典分散式系統借鑒即可完美生效的強大防禦工具。

### 記憶體污染重探（Memory Poisoning Revisited）

回顧第 13 課：單一 Agent 的幻覺被寫入共享記憶體並化為既定事實；下游所有 Agent 紛紛以此虛假事實為基石展開後續推理。在 MAST 的語境下，這本質上正是共享記憶體層級所發生的**驗證缺失**。

慢性的精度衰退是其最顯著的臨床症狀。系統不會發生直接崩潰；而是陷入難以進行根因追溯的慢性語意漂移。

工程緩解之道：維持僅限附加日誌、強制綁定溯源中繼資料、配置物理唯讀的獨立驗證者。

### STRATUS——專用於故障偵測的專業 Agent 鐵三角

STRATUS（NeurIPS 2025）指出，在系統中專門部署以下三位專業 Agent，能將故障緩解成功率提升 1.5 倍：

- **偵測 Agent（Detection agent）。** 即時監控異常前兆模式（意見分歧率驟增、重試頻率飆升、精準度指標慢性下滑）。
- **診斷 Agent（Diagnosis agent）。** 依據偵測到的表象特徵，對照 MAST 分類體系精準推斷最可能的根本原因。
- **驗證 Agent（Validation agent）。** 在工程團隊部署了修復補丁後，負責嚴密驗證該異常症狀是否確實徹底消失。

這本質上是將經典的 SRE（網站可靠性工程）事件回應機制完整平移至多 Agent 系統中。這三位角色皆可由配備專門 prompt 的 LLM 擔任。

### 失效模式季度審查機制（Failure-Mode Audit）

2026 年領先團隊的標準工程實踐是實施每季度一次（或每次重大版本發布前）的全面失效審查：

1. **抽樣真實軌跡。** 隨機抽取約 1,000 條真實環境下的完整執行日誌。
2. **對照歸因分類。** 針對軌跡中暴露的所有失敗，逐一歸類至 MAST 與 Groupthink 分類中。
3. **計算各類別失效佔比。** 精確評估究竟是哪一類別的失效在你的業務系統中佔據絕對主導地位。
4. **排定防禦優先序。** 評估哪一項工程改進能夠一口氣消滅最大比例的系統崩潰。
5. **落實 2-3 項關鍵改進。** 上線部署；並在下一季度對照覆盤。

這種嚴格的工程紀律，遠比具體挑選哪套演算法重要得多。若缺乏定期稽核，各類失效只會混雜在日常雜訊中，永遠無法獲得系統性的根治。

### 警惕致命的「無聲失效」

在所有故障類別中，最具破壞性的是「無聲的正確性失效」。一個直接拋出例外異常、當機崩潰並引發刺耳警報的系統，排查難度相對極低。而一個表面上運作無比絲滑、但端出的成果卻言之鑿鑿全是致命錯誤的系統，根本無法被標準的例外日誌所捕獲。這正是為何「驗證缺失」雖然在數量上僅佔總崩潰的 21.30%，但其單次事故所造成的實質商業代價卻最為昂貴。

必須重度投資：
- 基於抽樣的人工專家定期盲測審查。
- 打造金牌標準測試集（Golden datasets）執行每週回歸測試。
- 針對高危核心產出，強制實施跨 Agent 交叉覆核。

### 立即失效 vs 慢性衰退失效

部分失效是瞬間爆發的；部分失效則是慢性滲透的。立即失效（網路逾時、Schema 結構不符、認證金鑰失效）極其容易在第一時間被捕獲。而慢性衰退失效（記憶體污染、單一文化同質漂移、角色職責泛化模糊）的偵測與防禦成本高出數個數量級。

2026 年的前沿工程實踐：針對各類慢性衰退失效佈設即時代理指標（Proxy metrics），以便在隱患演變為災難前及時掐死。共識達成率、重試頻率分布、輸出文字長度變異數，以及相鄰版本之間的編輯距離，皆是極具前瞻價值的核心代理指標。

```figure
a5-retry-cascade
```

## Build It｜動手實作

`code/main.py` 完整實作了以下模組：

- `FailureTaxonomy`——負責將模擬的各類事故自動分類至 MAST 與 Groupthink 體系中。
- `CircuitBreaker`——經典的熔斷器模式；當錯誤率突破預設門檻時自動跳脫斷開。
- `RetryStormSimulator`——生動展示連鎖重試風暴的雪崩過程；支援手動開啟與關閉熔斷機制進行對比。
- `DetectionAgent`——腳本化的 STRATUS 風格症狀比對與歸因 Agent。

執行指令：

```
python3 code/main.py
```

預期終端輸出：
- 在未配置熔斷機制的情境下：庫存服務的請求負載如海嘯般暴增，最終徹底崩潰。
- 在啟用熔斷機制的情境下：呼叫在觸碰門檻時被果斷截斷，系統優雅回傳降級後的預設兜底回應。
- 偵測 Agent 迅速捕捉到了異常模式，並精準指出該事故所屬的 MAST 根因類別。

## Use It｜實際應用

`outputs/skill-mast-auditor.md` 是一項專業的失效審查 skill，能為多 Agent 系統展開完整的 MAST 故障審查：將真實日誌軌跡進行自動分類，並自動產出針對性的工程防禦優先級清單。

## Ship It｜交付成果

正式環境中面對失效模式的工程鐵律：

- **每季度強制執行 MAST 全面稽核。** 絕非形式化的年度走過場。隨著系統演進，主導性的故障類別會動態漂移。
- **全方位無死角佈設熔斷機制。** 面向任何外部依賴微服務的每一次呼叫皆必須受其保護。預設將錯誤率跳脫門檻設定為 5-10%。
- **維護金牌標準測試集（Golden datasets）。** 規模保持精巧、品質極高、由人類專家親自把關。每週強制執行自動化回歸測試。
- **組建 STRATUS 監控鐵三角。** 部署偵測、診斷與驗證 Agent 守護正式環境。初始階段可僅啟用偵測 Agent；待症狀模式豐富後再導入診斷模組。
- **確立清晰的故障預算（Failure budget）。** 為各類別的失效設定明確的服務水準目標（SLO）。一旦實際失效率擊穿預算，立即凍結新功能交付並啟動架構修復。

## Exercises｜練習

1. 執行 `code/main.py`。確認熔斷機制是否成功遏止了重試風暴的雪崩擴散。調整錯誤率跳脫門檻，觀察系統在「及早保護」與「過早誤傷」之間的取捨平衡。
2. 實現一個**慢性衰退失效的代理監控指標**：即時統計三個平行 Agent 之間的意見分歧率。當該分歧率發生異常暴跌時主動觸發告警。透過人為逐步拉高輸出相關性，模擬單一文化漂移的爆發過程。
3. 閱讀 Cemri 等人的論文（arXiv:2503.13657）。挑選其評測的 7 個 MAS 系統中的一個，整理其前三大主要失效類別。這些實測結果與 MAST 的理論預測存在何種異同？
4. 閱讀群體盲從論文（arXiv:2508.05687）。指出其歸納的五大模式中，哪一項在正式環境中最難以被即時偵測？為其設計一套合理的代理監控指標。
5. 針對你所熟悉的一套真實多 Agent 系統，量身設計 STRATUS 風格的「偵測-診斷-驗證」鐵三角架構。偵測 Agent 應當緊盯哪些具體症狀？診斷 Agent 會推薦哪些修復手段？而驗證 Agent 又該如何確認修復確實生效？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Further Reading｜延伸閱讀

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 權威失效分類體系奠基論文，NeurIPS 2025。
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) — 深度剖析單一文化、從眾效應與五大盲從家族的權威文獻。
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) — NeurIPS 2025 會議論文（偵測 + 診斷 + 驗證鐵三角架構）。
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) — 熔斷器模式的經典架構聖經。
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 來自工業級正式環境的第一手失效模式與維運筆記。
