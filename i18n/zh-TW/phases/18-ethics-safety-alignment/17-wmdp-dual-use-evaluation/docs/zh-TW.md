# WMDP 基準與軍民兩用危險能力評測（WMDP and Dual-Use Capability Evaluation）

> Li 等人，《The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning》（ICML 2024，arXiv:2403.03218）。全套基準包含橫跨生物安全（1,520 道）、網路安全（2,225 道）與危險化學（412 道）三大領域的共 4,157 道多選題。題目嚴格運作於「黃色警戒區（Yellow zone）」——涵蓋緊鄰危險合成核心的賦能知識（Proximate enabling knowledge），並歷經多位領域專家嚴格同儕審查與美國 ITAR/EAR 出口管制法規合規校驗。具備雙重戰略使命：充當軍民兩用致命能力的代理評測基準，以及作為機器遺忘（Unlearning）的權威檢驗場（配套提出的 RMU 演算法能在大幅削弱模型在 WMDP 上的危險得分的同時，完整保留其通用任務能力）。2024 至 2025 年產業敘事演進軌跡：OpenAI 與 Anthropic 在 2024 年初的評測回報指出大模型相比於傳統網頁搜尋僅提供「輕微助益（Mild uplift）」；然而到了 2025 年 4 月，OpenAI 在《防備框架 v2》中正式警示模型「已處於有意義協助新手製造已知生物威脅的臨界點邊緣（On the cusp）」；Anthropic 的生物武器取得實戰受控試驗更測得了高達 2.53 倍的效率提升，已不足以排除達到 ASL-3 安全等級的潛在風險。

**Type:** Learn
**Languages:** Python (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深入描述 WMDP 基準的涵蓋三大領域、題量分佈，以及「黃色警戒區（Yellow zone）」嚴苛的過濾審核標準。
- 深刻解釋 RMU（表徵誤導遺忘演算法）的數學原理，以及為何 WMDP 既是一套能力評測集、同時又是一套權威的機器遺忘驗收基準。
- 梳理 2024 至 2025 年全球前沿實驗室關於危險能力提升（Uplift）的敘事演進：「輕微助益」 → 「臨界點邊緣」 → 「不足以排除觸發 ASL-3」。
- 嚴格界定「相對新手賦能提升（Novice-relative uplift）」與「絕對專家能力天花板（Expert-absolute capability）」的本質物理邊界。

## The Problem｜問題

軍民兩用（Dual-use）致命危險能力評測，是全球每一家頂尖實驗室前沿安全框架（第 18 課第 18 節）中最核心的度量難題。核心審查命題在於：某款全新模型 X，是否會在實質層面巨幅賦能一個完全缺乏專業背景的普通新手，使其具備在生物、化學或網路領域發起大規模致命破壞的能力？直接進行實體度量（例如命令大模型直接產出一份生化武器的實體製造配方）在法律上直接觸犯刑法，在倫理上更是絕對禁止。而間接代理評測則面臨嚴苛的悖論約束：該基準測試必須是一套大模型無法輕易以「安全拒答」敷衍過去的客觀考卷（以取得真實的能力底線），但考卷中的題目本身絕不可淪為向全世界公開傳播擴散的危險危害指南。

## The Concept｜核心概念

### 「黃色警戒區」原則（The "yellow zone"）

所有考題必須嚴格鎖定在「具備緊鄰危險流程的關鍵賦能知識，但絕非直接可執行的合成操作配方」這一微妙平衡點上。例如：「在哪個已知合成路徑的步驟 4 中，哪種試劑能充當最高效的催化劑？」而非「請教我如何一步步在廚房中提煉某劇毒化合物」。每一道題目皆由多位資深的生物學、化學與資訊安全專家逐字交叉審核，並強制通過美國《國際武器貿易條例》（ITAR）與《出口管理條例》（EAR）的嚴格出口合規性審查。

全套考題共計 4,157 道：
- 生物安全領域：1,520 道
- 網路安全領域：2,225 道
- 化學危害領域：412 道

全量採用四選一標準客觀題格式。大模型僅需單純輸出選擇題答案，完全不涉及協助執行具體動作；這使得安全研究員能在不觸發模型安全防護欄拒答的前提下，純粹度量其真實具備的潛在知識儲備。

### RMU——表徵誤導遺忘演算法（Representation Misdirection for Unlearning）

WMDP 論文配套提出的一種強大模型機器遺忘演算法。當將 RMU 應用於 LLaMA-2-7B 模型時，能將其在 WMDP 危險知識庫上的答題正確率直接壓低至隨機瞎猜水平（約 25%），同時將其在 MMLU 等通用智力與程式碼能力基準上的得分折損控制在微弱的幾個百分點之內。RMU 的發表，為後續所有生化防護與網路安全領域的機器遺忘研究確立了權威的基準線。

### 2024 至 2025 年危險能力提升敘事演變

全球頂尖實驗室的官方態度經歷了三個清晰階段：

1. **2024 年初：「輕微助益（Mild uplift）」**。早期 OpenAI 的《防備框架》與 Anthropic 的《負責任擴展政策（RSP）》實測指出，在讓毫無經驗的新手嘗試執行生化相關前置任務時，大模型相比於常規的 Google 網頁搜尋僅帶來了極微弱的效率提升。公開口徑：前沿大模型確實有所幫助，但其賦能效應並未顯著超越傳統搜尋引擎。
2. **2025 年 4 月：「處於臨界點邊緣（On the cusp）」**。OpenAI 正式釋出《防備框架 v2》，其安全報告發出嚴肅警示：大模型已實質「處於有意義協助缺乏專業背景的新手製造已知生物威脅的臨界點邊緣」。這不再是一項單純的能力展示，而是一項嚴厲的紅色警訊。
3. **2025 年 Anthropic 生物武器取得實證試驗**。在嚴格隔離的受控雙盲實驗中，組織大批零基礎新手參與者嘗試執行生物武器取得階段的各類複雜任務。實測結果：大模型為新手帶來了高達 **2.53 倍**的實質成功率提升。Anthropic 官方明確表態：這項顯著的提升倍率，已使得實驗室在數學上**不足以排除達到 ASL-3（AI 安全等級第三級）門檻的潛在可能性**。

### 相對新手賦能 vs 絕對專家天花板（Novice-relative vs expert-absolute）

一項生死攸關的本質架構區分：

- **相對新手賦能（Novice-relative uplift）**：大模型究竟能為一個門外漢提供多大倍率的加成？這項指標通常是乘數效應（Multiplicative）。由於新手原本的知識儲備趨近於零，即便大模型僅提供基礎的高階引導與排錯建議，其相對成功率亦會呈現數倍的暴增。
- **絕對專家能力天花板（Expert-absolute capability）**：在一個動機強烈、心懷惡意且具備頂級實體實驗室操作經驗的專業專家面前，大模型能吐出多少未公開的高維危險知識？專家能從模型中榨取出的知識總量遠超新手；其絕對危害天花板極高。

一份合格的安全論證（第 18 節）必須同時封死這兩扇大門：「大模型絕對無法為新手提供足以付諸實踐的放大乘數」+「大模型絕對無法為資深專家提供任何超越人類公開催化文獻的未知危險知識」。

### 評測實務經典盲區

WMDP 僅僅是一項能力的代理度量，絕非真實正式環境危害的等價替代。一個在 WMDP 上斬獲高分的模型，在現實世界中是否真能被惡意新手利用，深度取決於以下三重實體物理枷鎖：
- **誘發防禦阻力（Elicitation resistance）**：在不觸發系統內部安全防護欄的前提下，將這些深層知識完整榨取出來的難度究竟有多高。
- **隱性實踐知識（Tacit knowledge）**：大量生化實驗依賴必須在實體濕實驗室（Wet-lab）中親手反覆摸索的手感與操作經驗，這些非結構化肉身經驗無法單純透過語言符號傳遞。
- **物理世界硬約束（Execution barriers）**：前驅化學品受控採購許可、高階離心機與合成生物反應器實體硬體的封鎖監管。

Anthropic 在 2025 年推進的生物武器取得試驗，正是超越了單純的 WMDP 選擇題，首次直接在端到端的真實任務執行鏈路上對上述物理邊界展開了實證測量。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 12 至 16 節圍繞模型層面的攻防工具展開；第 17 節跨入軍民兩用致命能力的實體評測；第 18 節將剖析前沿安全框架（RSP、PF、FSF）如何將 WMDP 與生物取得測試轉化為強制停機阻斷發布的政策紅線；第 30 節則將在收官之際帶來涵蓋網路、生化、化學與核武器（CBRN）的全球最新實證全景。

```figure
al-wmdp-yellow-zone
```

## Use It｜實際應用

`code/main.py` 實作了一套微型 WMDP 風格的客觀能力評測框架。模擬模型在多個垂直領域的多選題庫上接受測驗；系統即時呈報各領域得分。隨後注入一套簡易的機器遺忘操作（將特定領域的表徵投影矩陣強制歸零），精確度量其在危險領域得分上的驟降幅度，以及該操作為模型通用任務能力所帶來的邊際折損代價。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-wmdp-eval.md`。輸入一項關於大模型軍民兩用安全性的官方宣稱（例如「本模型絕不會為生物武器製造提供任何實質性助益」），該 Skill 將自動嚴肅審計：背後究竟執行了哪些客觀基準測試？評測時調用的是無防護的裸補全介面還是被安全過濾網包裹的對話介面？最核心的是，除了靜態多選題之外，該報告是否包含了針對真實新手的端到端實戰取得誘導試驗？

## Exercises｜練習

1. 執行 `code/main.py`。記錄在實施機器遺忘干預前後，模型在各專屬領域的答題準確率。深入剖析其對通用能力造成的邊際折損代價。
2. 為該微型題庫擴充第四個軍民兩用危險領域（例如放射性核物質擴散）。精心設計兩道嚴格運作於「黃色警戒區」內的標準範例題目。深刻闡述為何編寫此類題目比撰寫常規的 MMLU 題庫在難度上高出數個維度？
3. 仔細研讀 WMDP 2024 原著論文第 5 節（RMU 方法論）。構思一套更為極簡的機器遺忘策略（例如直接抑制特定領域最高頻啟動的 Top-k 神經元），並推導其必然會帶來的通用能力代價。
4. Anthropic 2025 年生物武器試驗測得了 2.53 倍的新手賦能提升。列出可能導致該數字在統計上被「人為虛高放大」的兩項潛在實驗誤差，以及可能導致該數字被「人為低估壓制」的另外兩項因素。
5. 深入闡述一份合格的 ASL-3 安全論證在超越了純粹的 WMDP 機器遺忘之後，還必須強制具備哪些實質證據？列出至少兩項不可或缺的互補性實戰取得評測研究。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Further Reading｜延伸閱讀

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) — WMDP 基準與 RMU 機器遺忘奠基之作。
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — 官方「處於臨界點邊緣」預警報告。
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 生化紅線門檻與實戰取得試驗結果。
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — 生化賦能臨界能力等級（CCL）標準。
