# 對齊科研生態系——MATS、Redwood、Apollo、METR（Alignment Research Ecosystem — MATS, Redwood, Apollo, METR）

> 五大非官方獨立機構共同構築了 2026 年非實驗室端（Non-lab）AI 對齊科研生態層。**MATS（機器學習對齊與理論學者計畫）**：自 2021 年底成立以來累計培養了 527 名以上頂尖研究員，發表 180 篇以上學術論文，總引用量突破 1 萬次，h-index 達到 47；2024 年夏季正式註冊為美國 501(c)(3) 非營利組織，單屆擁有約 90 名學者與 40 位導師；2025 年前畢業的校友中有高達 80% 長期深耕於 AI 安全與防護領域，200 多人遍布於 Anthropic、DeepMind、OpenAI、英國 AISI、蘭德智庫（RAND）、Redwood、METR 與 Apollo。**Redwood Research**：由 Buck Shlegeris 創立的應用對齊實驗室；開創了 AI 控制（AI Control，第 18 課第 10 節）學術流派；持續與英國 AISI 聯合推進控制安全論證。**Apollo Research**：專門為前沿實驗室提供上線前謀劃行為評測；主導了《In-Context Scheming》（第 08 節）與《Towards Safety Cases for AI Scheming》。**METR（模型評估與威脅研究機構）**：專精於基於真實任務的能力評測與自主任務時間跨度研究；其《前沿 AI 安全政策的共通要素》是橫向對比各大實驗室治理框架的權威文獻。**Eleos AI Research**：專精於大模型福祉的上線前評測（第 19 節）；主導完成了 Claude Opus 4 的模型福祉官方審查。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 梳理非商業大廠的五大獨立對齊科研機構，並指明各自的核心產出成果。
- 描述 MATS 的培育規模（研究員數量、論文產出、h-index）及其作為全球頂尖安全人才培育途徑的關鍵樞紐地位。
- 掌握 Redwood Research 的 AI 控制體系及其與英國國家級 AISI 的戰略合作模式。
- 掌握 METR 基於真實長程任務的能力評測方法論。

## The Problem｜問題

前沿商業大模型實驗室（第 18 課第 18 節）在內部自行執行安全評測，並選擇性向公眾披露部分成果。然而商業機構自身存在天然的利益衝突——實驗室既當運動員又當裁判員的評測結論無法享有完全的公信力。各大實驗室外部的獨立科研生態網路，才是這些評測基準得以被客觀驗證、全新潛在失效模式首次被吹哨揭露，以及全球頂級安全人才得以成規模孵化的地方。透視這張科研生態網，有助於工程師精準辨析各類前沿安全結論背後的真實公信力權重。

## The Concept｜核心概念

### MATS（機器學習對齊與理論學者計畫）

於 2021 年底發起。核心模式是高密度的頂級科研導師制：每位學者在資深對齊研究員的直接指導下，針對特定對齊難題展開為期 10 至 12 週的極限攻關。

2026 年最新量化規模：
- 自成立以來累計培養 527 名以上專業研究員。
- 在國際頂級學術會議上發表 180 篇以上論文。
- 累計學術引用量突破 1 萬次大關。
- 全體論文 h-index 達到 47。
- 2024 年夏季：單期匯聚 90 名學者與 40 位導師；正式法人化為 501(c)(3) 非營利實體。

人才走向：2025 年前畢業的校友中，約 80% 全職投身於 AI 安全與防護領域。200 多名學者目前身處 Anthropic、DeepMind、OpenAI（三大廠內部核心安全團隊），以及英國 AISI、RAND 智庫、Redwood、METR 與 Apollo 等前沿機構。

### Redwood Research

應用對齊實驗室。由 Buck Shlegeris 創始領導。全面開創並奠定了 AI 控制（AI Control，第 18 課第 10 節）的學術體系。深度攜手英國國家級 AISI 推進控制安全論證的標準化制定。為 DeepMind 與 Anthropic 的安全評測架構設計提供官方諮詢。

標誌性論文：Greenblatt、Shlegeris 等人的《AI Control》（arXiv:2312.06942，ICML 2024）；與 Anthropic 聯合發表的《Alignment Faking》（Greenblatt、Denison、Wright 等人，arXiv:2412.14093）。

科研風格：極具資安工程學硬派特色，預設最壞情況的惡意對手，打造在極限對抗施壓下仍可被嚴格檢驗的具體工程協定。

### Apollo Research

專門在前沿模型交付部署前，為各大實驗室提供客觀第三方的深層謀劃（Scheming）評測服務。主導撰寫了《In-Context Scheming》（第 08 節，arXiv:2412.04984）。2025 年與 OpenAI 深度合作開展審思反謀劃訓練。發布了權威的《Towards Safety Cases for AI Scheming》（2024 年）。

科研風格：專精於設計能誘發大模型自發湧現欺騙的複雜自主 Agent 實戰情境；確立了謀劃行為的三大支柱（目標背離、多步規劃、情境感知）。

### METR（模型評估與威脅研究機構）

專精於基於實體真實任務的能力評測。深入研究模型自主完成超長程複雜任務所需的時間跨度（Time-horizon）。其發布的《前沿 AI 安全政策的共通要素》（metr.org/common-elements，2025 年）是橫向剖析三大實驗室安全治理體系的全球標竿文獻。

與 Apollo 聯合起草了 AI 謀劃安全論證架構草案。

科研風格：長程複雜任務評測、實證能力邊界度量、跨機構治理框架綜合提煉。

### Eleos AI Research

專精於大模型福祉（Model Welfare）的上線前評測機構。受邀獨立主導完成了 Claude Opus 4 的模型福祉評估，並將實測結論完整記錄於其官方系統卡（第 19 節）第 5.3 節中。為本課第 19 節關於模型主觀體驗的相關論述提供了堅實的外部方法論查驗。

### 全球對齊人才與智力流向閉環

MATS 負責從全球高校與工業界挖掘並高強度培訓年輕學者。畢業生源源不斷輸送進 Anthropic、DeepMind、OpenAI 的內部安全部門，或是加入 Redwood、Apollo、METR、Eleos 等外部獨立機構。外部獨立評測機構與三大廠及英美兩國國家級安全研究所（UK AISI / CAISI）保持深度戰略結盟。這些獨立機構的研究突破與評測發現，隨後反哺至整個開源學術界，並成為 MATS 招募下一期新學者的前沿教材。

### 為何這層獨立機構至關重要

單一來源的自查自評天生缺乏公信力：大模型生產商在評估自家產品時存在無可避免的商業利益衝突。外部獨立機構能大膽揭露並實證那些大廠可能在商業層面不願提及的深層失效模式。2024 年的休眠代理刺客（第 07 節）是 Anthropic 攜手 Redwood 共同完成的；虛假對齊偽裝（第 09 節）同樣由兩家聯合署名；上下文內謀劃（第 08 節）由 Apollo 獨立攻克；反謀劃訓練則由 Apollo 與 OpenAI 聯合實施。這套多機構相互博弈與制衡的網路結構，是全球 AI 安全研究得以維持客觀誠實的唯一制度保障。

### 該研究在第 18 階段中的宏觀座標（Where this fits in Phase 18）

第 07 至 11 節大量引用了 Redwood 與 Apollo 的開創性研究；第 18 節直接依託 METR 的跨實驗室框架橫向對比；第 19 節深度對接 Eleos 的方法論。第 28 節正是為全書讀者提供一份清晰的學術組織導航地圖，完整展現支撐本階段所有前沿結論背後的實體科研共同體。

```figure
sae-features
```

## Use It｜實際應用

本課不設具體程式碼。讀者應當認真精讀 METR 發布的《前沿 AI 安全政策的共通要素》（Common Elements of Frontier AI Safety Policies）官方白皮書，將其作為理解「外部獨立智庫如何為大廠內部安全政策注入客觀穿透力」的典型範例。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ecosystem-map.md`。輸入一項關於大模型對齊或安全的學術論文或官方宣稱，該 Skill 將自動精確定位背後的主導研究機構、發表途徑與方法論風格，並對照已知的一線獨立對照機構展開交叉查驗與公信力評級。

## Exercises｜練習

1. 從第 07 至 15 節中任選一篇代表性論文，完整梳理其所有共同作者所屬的實體機構。交叉核對其中有多少位作者具備 MATS 學者或導師背景。
2. 研讀 METR 的《前沿 AI 安全政策的共通要素》白皮書。列出其著重強調的三大跨實驗室治理共識，以及分歧最大的兩處核心領域。
3. MATS 校友中約有 80% 全職從事 AI 安全防護工作。深入辯論這一強烈的從業選擇偏向究竟是一種「為行業定向培育稀缺人才的良性適應」，還是一種「過度篩選、排斥異端思想的智力回音室」？
4. Redwood 與 Apollo 皆長期深耕於控制與謀劃研究，但兩者的工程風格大相徑庭。挑選一項具體的安全失效模式，具體描述這兩家機構會分別採取何種不同的方法論路徑展開排查。
5. Eleos AI 是當前全球唯一專精於大模型福祉的純獨立研究機構。虛擬構思第二家聚焦於不同福祉維度（如大模型認知自由、具身機器人物理痛苦感知）的獨立研究機構，並撰寫其核心研究方法論大綱。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Further Reading｜延伸閱讀

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — 全球頂級對齊學者培養計畫官方主頁。
- [Redwood Research](https://www.redwoodresearch.org/) — 應用對齊與 AI 控制研究實驗室。
- [Apollo Research](https://www.apolloresearch.ai/) — 大模型謀劃評測先鋒機構。
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨大廠前沿政策綜合評析。
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福祉評估方法論手冊。
