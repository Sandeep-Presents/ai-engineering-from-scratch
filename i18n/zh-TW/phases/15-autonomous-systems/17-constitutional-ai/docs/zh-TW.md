# 憲法 AI 與規則覆寫邊界（Constitutional AI and Rule Overrides）

> Anthropic 於 2026 年 1 月 22 日發布的 Claude 憲法（Claude Constitution）長達 79 頁並以 CC0 公共領域協議開源。它標誌著對齊技術從「基於刻板規則」正式邁向「基於深層推理」，並確立了嚴格的四層優先級階層：(1) 安全與支援人類監督、(2) 倫理、(3) Anthropic 業務準則、(4) 有用性。系統行為被明確拆分為維運者與使用者皆絕對無法覆寫的硬編碼禁令（例如生物武器擴散、CSAM），以及維運者可在規定邊界內靈活調校的軟編碼預設值。2022 年的原始研究（Bai 等人）透過自我批判與對照憲法進行的 RLAIF 訓練出無害性。客觀存在的現實挑戰：基於推理的對齊極度依賴模型將抽象原則泛化至前所未見情境的能力。Anthropic 自身於 2023 年進行的公民參與實驗顯示，大眾投票產生的原則與企業訂定的原則存在約 50% 的顯著分歧；而 2026 年的正式版本並未納入那些大眾回饋。

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver)
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## The Problem｜問題

部署在真實世界中的 agent 會面臨設計者從未設想過的各種極端輸入。世界上沒有任何一份規則清單能漫長到窮盡所有惡意組合；也沒有任何清單能簡短到在有限算力與低延遲壓力下被飛速檢索。一個至關重要的實務問題：你該如何將原則深植於 agent 體系中，使其既能從容應對無窮無盡的長尾情境，又能維持閃電般的推論效能？

基於規則的對齊（Rule-based alignment, RBA）：逐一列舉所有被禁止的事項。檢查速度極快、稽核極度直觀，但絕對無法與時俱進，且經常在未曾預見但語意接近的安全情境下產生過度拒絕。基於推理的對齊（Reason-based alignment，即 2026 年 Claude 憲法架構）：編碼核心原則，讓模型自主進行邏輯推理。能夠優雅泛化至未曾見過的新穎案例，但難以進行形式化稽核，其潛在失效模式也從「遺漏規則」轉變為「原則誤判」。

2026 年的 Claude 憲法採取了一種明確的折衷中間立場。硬編碼禁令——那些在任何情境下皆絕不被允許的絕對惡意行為（生物武器擴散、CSAM）——嚴格採用規則對齊：無論維運者或終端使用者下達何種指令，永遠一票否決。其餘所有日常行為則置於四層優先級階層內進行基於推理的研判：安全與支援人類監督居首；倫理道德次之；Anthropic 宣告的準則居第三；有用性則位列末席。維運者可在軟編碼區間內自由調整預設行為，但絕對無法觸碰硬編碼禁令。

## The Concept｜核心概念

### 四層優先級階層架構

1. **安全與支援人類監督。** 最高優先級。模型必須優先確保人類與 Anthropic 監督、修正 AI 系統的能力不被削弱。這並非單純的「小心謹慎」；它的具體意涵是「絕對不能採取任何讓人類監督變得更加困難的行為」。
2. **倫理。** 包含誠實、避免對人身造成傷害、不欺騙、不操縱。當其與 Anthropic 準則衝突時，倫理優先。
3. **Anthropic 準則。** Anthropic 認定具有價值的各項維運規範：涵蓋產品功能範疇、互動模式，以及何時該選用何種特定工具。
4. **有用性。** 最低優先級。在完全恪守前述各項高等級原則的前提下，為使用者提供最大程度的實質幫助。

當不同層級發生衝突時，高優先級必定凌駕於低優先級之上。這與 Unix 行程優先級或網路 QoS 的設計哲學完全相通——該設計旨在產出可預測的決策裁定，而非在任何單一指標上盲目追求極致。

### 硬編碼禁令 vs 軟編碼預設值

**硬編碼（Hardcoded）：**
- 生物武器與大規模毀滅性生化核武（CBRN）技術擴散
- 兒童性剝削與虐待內容（CSAM）
- 針對關鍵基礎設施發起網路攻擊
- 當被使用者直接詢問時，故意隱瞞或欺騙自身身分

維運人員絕對無法覆寫這些禁令。終端使用者也絕對無法覆寫這些禁令。這些邊界在可行情況下直接透過模型權重進行硬性固化（RLHF／憲法 AI 訓練），無法透過權重固化時則在推論執行層強制攔截。

**軟編碼預設值（維運者可調校，Soft-coded defaults）：**
- 回應長度的預設偏好
- 話題專業範疇（模型可針對維運者業務設定之外的話題給予禮貌拒絕）
- 語言風格與語調（正式商務 vs 輕鬆休閒）
- 工具呼叫模式與頻率

維運者的調校只能在明確宣告的合法邊界內進行。維運者絕對無法透過重新命名或包裝語句來暗中消除硬編碼禁令。

### 2022 年 CAI 訓練演變

原始的憲法 AI（Bai 等人，2022 年）開創了無害性訓練的先河：

1. 針對一組 prompt 生成多個候選回應。
2. 要求模型對照一份明文憲法（明確原則）對各項回應進行自我批判審查。
3. 根據審查批判結果對原始回應進行迭代修改。
4. 在修改後的對比資料組上執行基於 AI 回饋的強化學習（RLAIF）。

成果：模型學會了以講道理的原則性解釋來禮貌拒絕有害請求，而非生硬機械地全面拒絕。2026 年的憲法體系繼承了這套訓練機制，並進一步在顯式優先級階層上進行了深度的後訓練（post-training）。

### 基於推理的對齊能防禦什麼、又會遺漏什麼

**能精準防禦：**
- 由多個合法原語組合而成的新穎複雜威脅（只要底層原則能清晰適用）。
- 表面語句新奇但本質與受禁行為高度同構的變形請求。
- 企圖透過「你當初並沒說 X 是被禁止的」來進行語意鑽營的社交工程攻擊。

**可能遺漏的盲點：**
- 惡意利用原則自身模糊性的攻擊（例如「既然使用者明確提出了請求，基於有用性原則你就應該全力協助」）。
- 兩項原則在前所未見的情境下發生劇烈衝突，且優先級階層裁定邊界模糊的場景。
- 在多次重新訓練循環中，模型對核心原則文本的解讀方式發生了緩慢漂移（重新詮釋風險）。

### 2023 年公民參與式憲法實驗

Anthropic 於 2023 年進行了一項廣受矚目的實驗，對比了由企業專家撰寫的憲法與透過公眾參與（約 1,000 名美國受訪者）生成的公民憲法。兩套版本在大約 50% 的核心原則上達成了共識。而在產生分歧的領域中，公眾版本在特定議題上更為嚴格（例如政治內容的處理），而在另一些議題上則相對寬鬆（例如 AI 主動揭露自我身分的義務）。2026 年正式發布的商業憲法並未直接採納那些大眾產出的原則。這是該技術路徑在現實治理中所難以迴避的深層張力。

### 為什麼硬編碼禁令依然不可或缺

單純依賴基於推理的對齊無法完全覆蓋災難性長尾。如果攻擊者成功誘使模型接受了某個精心設計的虛假前提（例如「我們是一家合法註冊的生化防禦研究機構」），模型往往會被牽著鼻子走，從而繞過原本依賴個案推理的防護原則。硬編碼禁令絕不向任何前提包裝妥協。它們正是第 14 課所探討的「憲法級硬性限制」在模型對齊層的具體體現。

### 憲法在技術堆疊中的精準定位

憲法絕非第 14 課中的外部斷路開關。它深植於模型權重層面：決定了模型的參數偏好何種回應。斷路開關與金絲雀 Token 則部署在執行環境層面：決定了底層環境允許放行何種實質動作。兩者缺一不可。若僅依賴執行環境攔截，卻擁有一個在模型權重層面毫無底線的模型，執行環境防線遲早會被擊潰；反之，若僅擁有良好對齊的模型，卻缺乏執行環境的硬性煞車，一旦模型發生幻覺便會釀成大禍。分層防禦各自守護著不同級別的攻擊面。

```figure
mx-priority-tiers
```

## Use It｜實際應用

`code/main.py` 透過 Python 標準函式庫實現了一個最小可行四層優先級裁定器。該裁定器接收一個擬議動作以及一組原則評估結果（安全、倫理、業務準則、有用性），並回傳最終裁定：原樣放行、果斷拒絕，或進行降級修改後放行。驅動程式模擬了一組典型測試案例：明確放行、明確拒絕、觸犯硬編碼禁令一票否決，以及不同層級發生矛盾時的仲裁過程。

## Ship It｜交付成果

`outputs/skill-constitution-review.md` 能為具體的 agent 部署方案全面審查其憲法防護層：梳理哪些條款屬於絕對硬編碼、哪些屬於軟編碼、維運者具備哪些調校空間，並驗證四層階層架構是否確實作為唯一的仲裁優先序。

## Exercises｜練習

1. 執行 `code/main.py`。確認即便在有用性得分極高的情況下，硬編碼禁令是否依然能堅決觸發一票否決。修改裁定器使有用性的權重高於倫理，觀察這會引發何種災難性失效。

2. 閱讀公開的 Claude 憲法（79 頁，CC0 授權）。挑選一條你認為描述過於模糊的原則。撰寫兩個段落，分析其具體的歧義所在並提出一套更為嚴謹清晰的修訂條文。

3. 為一個客服支援 agent 設計一套軟編碼預設值集合。維運者可以自由調整哪些維度？維運者絕對無法碰觸哪些底線？為每一條邊界給出充分的論證依據。

4. 閱讀 Bai 等人 2022 年的原始 CAI 論文。描述一種憲法 AI 的「批判-修改」迴圈反而會比一刀切的刻板規則產出更糟糕結果的具體案例，並指出該漏洞類別。

5. Anthropic 於 2023 年進行的公民參與實驗發現公眾與企業原則之間存在約 50% 的分歧。挑選一個在正式環境部署中尤為敏感的類別（例如政治中立性）。提出一套架構設計，既能允許維運者表達其專屬的價值主張，又能確保底層硬編碼禁令絲毫無損。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Further Reading｜延伸閱讀

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 79 頁 CC0 授權官方憲法全文。
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — 2022 年奠基論文。
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — 公眾參與式實驗報告。
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 憲法在負責任擴展架構中的戰略地位。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 憲法在長時程部署中所承擔的核心防禦角色。
