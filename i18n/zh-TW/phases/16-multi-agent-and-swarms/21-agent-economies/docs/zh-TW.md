# Agent 經濟體、代幣激勵與聲譽系統（Agent Economies, Token Incentives, Reputation）

> 長時程自主 Agent（METR 定義的 1 小時至 8 小時工作曲線）迫切需要經濟自主權。業界新興形成的 **5 層技術堆疊** 體系為：**DePIN**（實體算力層）→ **身分層**（W3C DID + 聲譽資本）→ **認知層**（RAG + MCP）→ **結算層**（帳戶抽象化）→ **治理層**（Agentic DAO）。當前正式環境中的 Agent 激勵網路包括 **Bittensor**（TAO 子網專門獎勵特定任務的專家模型）、**Fetch.ai / ASI 聯盟**（ASI-1 Mini LLM + FET 代幣），以及 **Gonka**（將算力重新分配至高產出 AI 任務的 Transformer 工作量證明 PoW）。學術前沿進展：AAMAS 2025 發布的去中心化 LaMAS 採用**夏普利值（Shapley-value）貢獻歸因演算法**，公平獎勵每位參與協同的 Agent；Google Research 在《Mechanism design for large language models》中提出了單調聚合架構下的**次價代幣拍賣機制（Second-price token auctions）**。本課將親手打造一個微型 Agent 交易市場、將夏普利值歸因應用於多 Agent 管線，並實際運作次價拍賣機制，讓博弈論機制在工程肌肉記憶中扎實落地。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problem｜問題

當多個 Agent 共同協同產出巨大價值、卻需要對個體進行獨立分配獎勵時，多 Agent 系統會變得極其棘手。古典分配機制——平均分配、抑或由最後一位交付者獨吞所有報酬——在博弈本質上不是嚴重不公，就是極易被惡意投機鑽營。基於聯盟博弈的夏普利值（Shapley value）分配機制在公理上保證了絕對的公平，然而其精確計算開銷極其高昂。2025 至 2026 年的學術文獻提出了一系列高度實用的工程近似手段：夏普利蒙地卡羅抽樣、單調聚合拍賣，以及依據經證實的實質貢獻動態累積的鏈上聲譽系統。

除了抽象的貢獻度歸因之外，整個產業已全面邁向具備實體金融行為能力的自主經濟 Agent：Bittensor TAO 專門激勵礦工算力以 fine-tuning 特定子網模型；Fetch.ai / ASI 聯盟透過 FET 代幣獎勵呼叫 ASI-1 Mini LLM 的實際用量；Gonka 則將傳統無意義的雜湊運算轉化為實質有益於 AI 推論的 Transformer 工作量證明。具備自主交易能力的經濟 Agent 早已成為現實；核心關鍵在於如何設計出能與人類總體目標對齊的激勵機制。

本課將 Agent 經濟體視為一個具體的工程問題家族——涵蓋貢獻度歸因、機制設計與聲譽管理——並以最精準精煉的數學推演親手實現它們。

## Concept｜核心概念

### 5 層 Agent 經濟體技術堆疊

1. **DePIN（實體去中心化算力層）。** 負責出租 GPU、儲存空間與頻寬的去中心化基礎設施。例如 Bittensor 子網、Render Network、Akash。這並非 Agent 專屬技術，而是作為 Agent 賴以生存的底層物理養分。
2. **身分層（Identity）。** W3C 去中心化識別碼（DID）賦予每個 Agent 一個完全獨立於任何中心化平台的持久化身分。各項歷史聲譽牢牢綁定至該 DID 之上。Agent 網路協定（ANP）即將 DID 作為其底層服務發現層。
3. **認知層（Cognition）。** Agent 本身的核心推理閉環：LLM + RAG + MCP。這正是本書其他各階段所傳授的核心技術。
4. **結算層（Settlement）。** 帳戶抽象化（以太坊 ERC-4337 標準）允許 Agent 直接從自身的智慧合約帳戶中自主支付 Gas 費，而無需人為持有 ETH。Agent 能夠自主為第三方外部服務付費、彼此之間互相轉帳結算，或為自身消耗的底層算力買單。
5. **治理層（Governance）。** Agentic DAO：由人類*與*具備法定資格的 Agent 共同就協定升級進行投票的治理組織，投票權重通常與歷史聲譽嚴格掛鉤。

並非所有正式環境系統皆必須完整覆蓋這全部 5 層。Bittensor 覆蓋了第 1、2 層，局部涵蓋 3 與 4 層，完全未觸及第 5 層。OpenAI 的原生 Agent 則幾乎僅停留在第 3 層。這套 5 層堆疊是一份宏觀的架構參考地圖，而非教條式的硬性規範。

### Bittensor、Fetch.ai、Gonka——真實運作現況

**Bittensor（TAO）。** 其子網（Subnets）專門鎖定高度特化的特定 AI 任務（例如語言建模、圖像生成、金融時間序列預測）。礦工節點送出各自的模型推論產出；驗證者節點負責對其進行客觀排序打分；隨後依據權益加權評分向各礦工動態分發 TAO 代幣獎勵。每個子網皆擁有自身專屬的客觀評估體系。其最深刻的經濟學啟示在於：**為特定任務的產出品質付費，絕不單純為消耗的物理算力買單。**

**Fetch.ai / ASI 聯盟。** ASI-1 Mini LLM 原生運作於 Fetch.ai 的去中心化網路之上；終端使用者透過支付 FET 代幣換取模型推論服務。在此體系中，「Agent 作為對等同儕」的特質更為鮮明：Fetch 網路中的一個 Agent 能夠自主呼叫另一個 Agent 協助完成特定子任務，並直接以 FET 代幣進行點對點結算。

**Gonka。** 基於 Transformer 的實質工作量證明：其 PoW 運算本質上正是 Transformer 模型的真實前向傳播（Forward pass）。礦工透過執行具備已知正確基準答案的推論任務（源自標準訓練集）來賺取收益。以實質高產出的有用 AI 算力，徹底取代了傳統浪費電力的無意義 SHA-256 暴力碰撞。

截至 2026 年 4 月，這三者皆已達到工業級就緒水準。其利益分配機制各有側重：Bittensor 依據子網驗證者的相對品質評分分配收益；Fetch 依據真實付費用戶的實質效用需求分配；Gonka 則專門獎勵經密碼學驗證的有用推論算力。

### 基於夏普利值（Shapley Value）的貢獻度精準歸因

設想三個 Agent 協同攻克一項複雜任務。最終交付成果斬獲了 0.8 分的高分。究竟該如何客觀公允地向三者分配這份榮譽與收益？

夏普利值是合作博弈論中唯一能夠同時嚴格滿足四大公理（有效性、對稱性、線性、虛擬角色性）的唯一公平分配公式。對於 Agent i，其夏普利值定義為：

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

其中 `S_i_O` 代表在給定排列順序 `O` 中，排在 Agent `i` 之前的所有同儕集合。在工程實務中：列舉全體可能的排列排列組合，計算 Agent `i` 在每種排列順序下所帶來的邊際貢獻增量，最後求取全域平均值。

對於 N=3 的小型團隊，僅存在 6 種排列組合。而當團隊規模擴大至 N=10 時，排列組合將激增至 360 萬種——因此在工業級實踐中，通常採用蒙地卡羅抽樣近似，而非窮舉全排列。

### 用於聚合輸出的次價拍賣機制（Second-Price Auction）

Google Research 在《Mechanism design for large language models》中提出了一種專門用於聚合多個 LLM 輸出的次價代幣拍賣機制。架構設定：N 個 Agent 各自生成一份候選回應；每個 Agent 對於自身產出被系統最終選中持有各自的私有保留估值。拍賣主辦方選取報價最高的方案，但最終僅向其支付**第二高報價**的金額。在單調聚合（即整體效用取決於選中了哪個方案，而非總共提出了多少出價）的數學前提下，該機制具備嚴格的激勵相容性（Truthful）——各 Agent 的唯一最優策略，就是誠實呈報自身的真實私有估值。

這項機制對大模型工程具有顛覆性價值：你能將文字生成任務直接外包給市場上定價策略各異的多個 Agent；拍賣機制保證了系統能挑選出最優產出，同時向其支付絕對公平客觀的報酬，且所有 Agent 在博弈結構上完全喪失了惡意虛報價格的投機動機。

### 聲譽資本（Reputation Capital）

綁定於 DID 上的聲譽評分，由一次次被客觀證實的高品質貢獻動態累積而成。典型的平滑更新規則：

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

其中衰減係數 `alpha` 設定為接近 1 的浮點數。聲譽資本具備以下三大實務特質：

- 查詢極其廉價，可直接作為路由決策的依據（例如「將艱難的高危任務優先派發給高聲譽 Agent」）。
- 偽造代價極其高昂（必須長期在鏈上累積真實貢獻，且嚴密綁定至特定 DID）。
- 支援罰沒機制（Slashing）：一旦某項交付被客觀驗證判定為失敗或惡意欺騙，其累積的歷史聲譽將被嚴厲扣除。

### AAMAS 2025 去中心化 LaMAS 體系

AAMAS 2025 發布的 LaMAS 提案完美融合了三大支柱：DID 去中心化身分認證、基於夏普利值的貢獻度公平歸因，以及極簡的拍賣競價機制。其核心技術主張：將貢獻度歸因邏輯徹底去中心化，能讓多 Agent 體系具備無懈可擊的可稽核性，並天然免疫於中心化單點被惡意竄改的系統性風險。

### 經濟激勵機制何時會徹底崩潰

- **價格預言機遭受惡意操縱。** 若貢獻度評分函數本身存在邏輯漏洞，各 Agent 必定會無情地針對該漏洞進行作弊與套利。任何機制上線前皆必須進行紅隊對抗檢驗。
- **女巫攻擊（Sybil attacks）。** 單一惡意維運者在底層批次啟動 N 個虛假 Agent，藉此人為虛報並刷高自身的貢獻份額。DID 僅能增加攻擊成本，無法徹底根絕女巫；唯有拉高聲譽的鍛造代價才是根本的緩解之策。
- **驗證成本吞噬所有收益。** 貢獻度歸因的公允度，完全受制於底層驗證機制的嚴謹度。若驗證機制過於廉價（依賴低階小模型），它極易被表面文字欺騙；若驗證機制過於昂貴（依賴專家評審團），整套系統將徹底喪失經濟規模效應。
- **嚴苛的金融法規監管壁壘。** Agent 經濟體不可避免地會觸及各國金融法規的敏感神經。截至 2026 年，Bittensor、Fetch 與 Gonka 在多個司法管轄區內依然運作於法律邊界未明的灰色地帶。

### 何時建構 Agent 經濟體才真正具備實質意義

- **由多個互不相識的異質維運團隊組成的開放網路。** 不存在單一實體能全權掌控全場所有 Agent。
- **具備機器可客觀驗證的明確產出。** 若缺乏可客觀驗證的標準，一切貢獻度歸因皆只是無謂的主觀猜測。
- **需要跨越數天乃至數週運作的長時程工作流程。** 單次對話任務根本無法從長期的聲譽累積中獲益。
- **代幣化支付結算在你所在的司法管轄區具備完全合法的法規基礎。**

在封閉的企業內部系統中，經濟學機制往往應當讓位給更為簡練直接的管理指派模式（由主管 Agent 直接派發任務，採用內部指標考核）。經濟學文獻的精妙設計，主要綻放於開放式的去中心化協同網路之中。

```figure
swarm-auction
```

## Build It｜動手實作

`code/main.py` 透過 Python 標準函式庫完整實作了以下核心機制：

- `shapley(value_fn, agents)`——針對小規模 N，透過全排列窮舉實現精確夏普利值的計算。
- `second_price_auction(bids)`——實現嚴格激勵相容的次價拍賣機制；競價獲勝者僅需支付第二高的報價金額。
- `Reputation`——綁定於 DID 上的動態聲譽評分系統，原生支援指數型衰減與惡意罰沒機制。
- 展示一：三位 Agent 展開深度協同，透過精確夏普利值演算法完成公平的貢獻度歸因。
- 展示二：五位 Agent 競標單一任務執行資格；次價拍賣機制自動挑選出最優勝出者並精算出公平支付金額。
- 展示三：在 100 輪任務指派中，對比隨機指派與基於聲譽權重動態路由的成效；聲譽加權路由在預熱完畢後展現出顯著更優異的任務品質。

執行指令：

```
python3 code/main.py
```

預期終端輸出：詳細列印每位 Agent 的精確夏普利值分配；展示次價拍賣在博弈均衡下達成的誠實出價；以及聲譽加權路由相較於盲目隨機指派所取得的 10-20% 品質躍升。

## Use It｜實際應用

`outputs/skill-economy-designer.md` 能為去中心化多 Agent 網路量身設計完整的微觀經濟機制：涵蓋身分層選型、貢獻度歸因演算法、支付結算協定，以及動態聲譽獎懲規則。

## Ship It｜交付成果

2026 年運作 Agent 經濟體系統的必備工程鐵律：

- **優先引入聲譽系統，慎用實體代幣。** 聲譽機制的建置成本低廉且自身便具備巨大治理價值；而引入實體金融代幣會瞬間引發沉重的法律與金融風險。
- **獎勵分配前必須強制執行獨立驗證。** 絕不允許在未經客觀驗證的前提下發放報酬。盲信 Agent 自行申報的品質，只會招致猖獗的女巫作弊遊戲。
- **採用夏普利蒙地卡羅抽樣，切勿盲目窮舉。** 在實際生產中抽樣 100 至 1,000 種排列組合即可；精確的全排列窮舉在規模擴大後在物理上無法計算。
- **為聲譽衰減係數設定邊界並配置最低底線。** 無界限的過快衰減會無辜抹殺合法貢獻者的長期心血；而過於遲鈍的衰減則會讓躺在功勞簿上的陳舊高聲譽 Agent 享有不公的特權。
- **對經濟博弈機制展開殘酷的紅隊對抗測試。** 在正式對外開放網路之前，必須模擬各類極限投機博弈場景。每一套經濟機制背後皆是一場博弈；你必須親手在測試環境中揪出漏洞，而非等待真實黑客前來上課。

## Exercises｜練習

1. 執行 `code/main.py`。確認計算出的夏普利值總和是否嚴格等於全體協同創造的總價值（驗證有效性公理）。修改底層價值函數，觀察夏普利分配結果是否朝符合經濟學直覺的預期方向位移？
2. 實現**夏普利蒙地卡羅抽樣演算法**（在 K 種隨機排列組合上進行抽樣計算）。評估抽樣次數 K 如何影響逼近真實值的精確度？針對 N=4 的團隊，比對抽樣估計與精確窮舉之間的誤差幅度。
3. 在拍賣前引入聯盟組建（Coalition-forming）環節：允許各 Agent 自行合併為聯合團隊進行整包投標。觀察系統中會自發形成何種聯盟？最終產出的市場均衡相較於個體獨立競標是否達成了帕雷托最優（Pareto-better）？
4. 閱讀 Google Research 關於大模型機制設計的官方技術文章。指出其中一項一旦被破壞就會導致激勵相容性（誠實出價）徹底瓦解的核心假設。在真實 LLM 業務環境中，該假設破裂會呈現出何種具體失效？
5. 閱讀 AAMAS 2025 去中心化 LaMAS 論文。在包含 10 位 Agent 的合成任務上實現其夏普利歸因步驟。精確計算耗費了多少時間？抽樣 100 次的近似估算與精確值之間的落差有多大？

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Further Reading｜延伸閱讀

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — 2026 年針對 5 層 Agent 經濟體架構堆疊的全面權威綜述。
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — 單調聚合架構下的代幣拍賣機制設計。
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — 基於夏普利值的去中心化貢獻度歸因架構論文。
- [Bittensor TAO documentation](https://docs.bittensor.com/) — 子網架構與代幣激勵分發官方技術文件。
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini LLM 與 FET 代幣生態系官方入口。
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) — 支撐去中心化身分與聲譽綁定的底層國際標準規範。
