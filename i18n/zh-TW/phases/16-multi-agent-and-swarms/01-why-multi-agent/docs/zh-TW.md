# 為何需要多 Agent 架構？（Why Multi-Agent?）

> 單一 agent 終究會撞上天花板。明智之舉並非打造一個更龐大的 agent——而是引入更多的 agent。

**Type:** Learn
**Languages:** TypeScript
**Prerequisites:** Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 識別單一 agent 的能力天花板（上下文溢位、專業領域混雜、循序執行瓶頸），並明確解釋何時將任務拆分為多個 agent 是正確的決定
- 比較各種編排（orchestration）模式，例如管線（pipeline）、平行扇出、監督者與階層式架構，並為給定的任務結構挑選最適方案
- 設計具備清晰角色邊界、共享狀態與通訊契約的多 agent 系統
- 權衡分析多 agent 複雜度（延遲、成本、除錯難度）與單一 agent 簡潔性之間的得失

## The Problem｜問題

你在 Phase 14 中親手打造了一個單一 agent。它運作正常。它能夠讀取檔案、執行指令、呼叫 API 並推理結果。接著，你將它指向一個真實的程式碼庫：包含 200 個檔案、三種程式語言、依賴基礎架構的測試套件，以及要求在編寫程式碼前先研究外部 API 的需求。

此時 agent 卡住了。這並非因為底層的 LLM 不夠聰明，而是因為任務規模遠遠超出了單一 agent 迴圈所能承載的極限。上下文視窗迅速被各個檔案的內容塞滿。agent 開始忘記它在 40 次工具呼叫之前讀過的內容。它試圖同時扮演研究員、工程師與審查員的多重角色，結果卻是在這三個角色上全都表現拙劣。

這正是所謂的「單一 Agent 天花板（Single-Agent Ceiling）」。每當一項任務需要滿足以下條件時，你都會撞上這道牆：

- **需要超出單一視窗容量的龐大上下文**——通讀 50 個檔案就會超過 200k 個 token
- **在不同階段需要不同的專業知識**——研究需求所需的 prompt 設計，與生成高品質程式碼所需的設計不同
- **任務本身可以平行進行**——當你能同時讀取三個檔案時，為何要依序讀取？

## The Concept｜核心概念

### 單一 Agent 的能力天花板

單一 agent 意味著單一迴圈、單一上下文視窗以及單一系統 prompt。畫面如下：

```
┌─────────────────────────────────────────┐
│            SINGLE AGENT                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         Context Window            │  │
│  │                                   │  │
│  │  research notes                   │  │
│  │  + code files                     │  │
│  │  + test output                    │  │
│  │  + review feedback                │  │
│  │  + API docs                       │  │
│  │  + ...                            │  │
│  │                                   │  │
│  │  ██████████████████████ FULL ███  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  One system prompt tries to cover       │
│  research + coding + review + testing   │
│                                         │
│  Result: mediocre at everything         │
└─────────────────────────────────────────┘
```

系統會在三個關鍵面向上失靈：

1. **上下文飽和（Context saturation）**——工具呼叫的輸出結果不斷堆積。到了第 30 輪對話時，agent 已經吞下了 150k 個 token 的檔案內容、終端機輸出與先前的推理記錄。第 5 輪的關鍵細節就此遺失。

2. **角色混淆（Role confusion）**——一個宣稱「你同時是研究員、工程師、審查員與測試員」的系統 prompt，最終只會產出一個研究與寫程式都做不好、且永遠無法完成程式碼審查的平庸 agent。

3. **循序執行瓶頸（Sequential bottleneck）**——agent 依序讀取檔案 A、檔案 B，接著是檔案 C。發起三次串列的 LLM 呼叫。三次串列的工具執行。沒有任何平行運算。

### 多 Agent 解決方案

將龐大的工作拆開。賦予每個 agent 單一職責、專屬的上下文視窗，以及針對該職責調校的系統 prompt：

```
┌──────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                          │
│                                                          │
│  "Build a REST API for user management"                  │
│                                                          │
│         ┌──────────┬──────────┬──────────┐               │
│         │          │          │          │               │
│         ▼          ▼          ▼          ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │RESEARCHER│ │  CODER   │ │ REVIEWER │ │  TESTER  │  │
│   │          │ │          │ │          │ │          │  │
│   │ Reads    │ │ Writes   │ │ Checks   │ │ Runs     │  │
│   │ docs,    │ │ code     │ │ code     │ │ tests,   │  │
│   │ finds    │ │ based on │ │ quality, │ │ reports  │  │
│   │ patterns │ │ research │ │ finds    │ │ results  │  │
│   │          │ │ + spec   │ │ bugs     │ │          │  │
│   └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│         │           │            │             │         │
│         └───────────┴────────────┴─────────────┘         │
│                          │                               │
│                     Merge results                        │
└──────────────────────────────────────────────────────────┘
```

每個 agent 皆具備：
- 聚焦單一目標的系統 prompt（「你是一名程式碼審查員。你的唯一任務就是找出潛在 bug。」）
- 自身乾淨的獨立上下文視窗（不受其他 agent 工作內容的污染）
- 明確規範的輸入／輸出契約（接收研究摘要筆記，輸出實作程式碼）

### 採用此模式的真實系統

**Claude Code 子 Agent（Subagents）**——當 Claude Code 透過 `Task` 生成子 agent 時，它會建立一個帶有專屬任務邊界的子 agent。父 agent 得以保持自身上下文乾淨。子 agent 專注完成特定任務後，回傳摘要結果。

**Devin**——內部同時運作規劃者 agent、寫程式的 agent 以及瀏覽器 agent。規劃者負責將整體工作拆解為具體步驟。寫程式的 agent 專注撰寫程式碼。瀏覽器 agent 負責研究官方文件。彼此各自擁有獨立的上下文。

**多 Agent 程式碼編寫團隊（SWE-bench）**——在 SWE-bench 上名列前茅的系統，多採用由負責通讀程式碼庫的研究員、負責設計修復方案的規劃者，以及負責實作的寫程式 agent 組成的多 agent 團隊。單一 agent 系統的得分較低。

**ChatGPT 深度研究（Deep Research）**——平行衍生多個搜尋 agent，各自從不同角度探索，最後再綜合各路結果。

### 多 Agent 的演進光譜

多 agent 架構並非二元對立的選擇，而是一道連續的光譜：

```
SIMPLE ──────────────────────────────────────────── COMPLEX

 Single        Sub-         Pipeline      Team         Swarm
 Agent         agents

 ┌───┐       ┌───┐        ┌───┐───┐    ┌───┐───┐    ┌─┐┌─┐┌─┐
 │ A │       │ A │        │ A │ B │    │ A │ B │    │ ││ ││ │
 └───┘       └─┬─┘        └───┘─┬─┘    └─┬─┘─┬─┘    └┬┘└┬┘└┬┘
               │                │        │   │       ┌┴──┴──┴┐
             ┌─┴─┐          ┌───┘───┐    │   │       │shared │
             │ a │          │ C │ D │  ┌─┴───┴─┐    │ state │
             └───┘          └───┘───┘  │  msg   │    └───────┘
                                       │  bus   │
 1 loop      Parent +      Stage by    │       │    N peers,
 1 context   child tasks   stage       └───────┘    emergent
                                       Explicit      behavior
                                       roles
```

**單一 Agent（Single agent）**——單一迴圈、單一 prompt。適合單純直觀的任務。

**子 Agent（Subagents）**——由父 agent 針對特定子任務動態派生子 agent。父 agent 掌握整體規劃。子 agent 回報結果。這正是 Claude Code 的做法。

**管線（Pipeline）**——agent 依序串聯運作。Agent A 的輸出直接作為 Agent B 的輸入。適合階段分明的工作流程：研究 -> 編碼 -> 審查 -> 測試。

**團隊（Team）**——多個 agent 藉由共享訊息匯流排平行運作。每個成員各司其職。由編排者統一調度。適用於同時需要多種不同專業技能的場景。

**群體（Swarm）**——由大量相同或高度近似的 agent 共享全域狀態。沒有固定的中心編排者。各 agent 自主從任務佇列中領取工作。適合高吞吐量的平行大規模任務。

### 四種多 Agent 模式

#### 模式一：管線模式（Pipeline）

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每個 agent 依序轉換資料並傳給下游。這種結構容易推理。然而單一階段的失敗會阻塞後續的所有階段。

#### 模式二：扇出／扇入模式（Fan-out / Fan-in）

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

將工作拆給多個平行運作的 agent，最後再合併成單一成果。適合能自然分解為彼此獨立子任務的工作。

#### 模式三：編排者-工作者模式（Orchestrator-Worker）

```
                    ┌──────────┐
                    │  Orch.   │
                    └──┬───┬───┘
                  task │   │ task
                 ┌─────┘   └─────┐
                 ▼               ▼
           ┌──────────┐   ┌──────────┐
           │ Worker A │   │ Worker B │
           └──────────┘   └──────────┘
```

由聰明的編排者決定該做什麼、把任務指派給各工作者，並綜合最終成果。編排者本身也是一個 agent，其工具可用來生成與管理工作者。

#### 模式四：對等群體模式（Peer Swarm）

```
         ┌───┐ ◄──── msg ────▶ ┌───┐
         │ A │                  │ B │
         └─┬─┘                  └─┬─┘
           │                      │
      msg  │    ┌───────────┐     │ msg
           └───▶│  Shared   │◄────┘
                │  State    │
           ┌───▶│  / Queue  │◄────┐
           │    └───────────┘     │
      msg  │                      │ msg
         ┌─┴─┐                  ┌─┴─┐
         │ C │ ◄──── msg ────▶ │ D │
         └───┘                  └───┘
```

系統內部不存在任何中央編排者。所有 agent 之間皆為平等的點對點（peer-to-peer）通訊。整體決策由群體互動自然湧現。除錯較困難，但可擴展至許多 agent。

### 何時「不該」使用多 Agent 架構

多 agent 架構會增加複雜度。agent 之間傳遞的每一則訊息，都是一個潛在的系統故障點。除錯從「讀完一段對話」變成「在五個 agent 之間追蹤訊息」。

**在以下情境中請維持單一 Agent：**
- 任務規模可完全容納於單一上下文視窗內（工作資料低於 ~100k token）
- 不同階段不需要不同的系統 prompt
- 循序執行的速度已足以滿足業務延遲需求
- 任務結構夠單純，拆解帶來的通訊開銷超過其實質價值

**複雜度帶來的沉重代價：**
- 每一個 agent 邊界本質上都是一次有損壓縮：Agent A 的完整上下文必須被濃縮為一則精簡訊息傳遞給 Agent B
- 協同協調邏輯（誰該做什麼、何時執行、先後順序為何）本身也是 bug 的來源
- 延遲增加：N 個 agent 至少意味著 N 次串聯 LLM 呼叫，若涉及來回協商，延遲還會更高
- 成本倍增：每個 agent 各自獨立消耗 token

經驗法則：若一項任務所需的工具呼叫少於 20 次且資料量在 100k token 以內，請維持單一 agent 架構。

```figure
swarm-messages
```

## Build It｜動手實作

### 步驟一：不堪重負的單一 Agent

以下展示一個試圖包辦一切的單一 agent。它有一個龐大的系統 prompt，並用單一上下文視窗裝入研究資料、程式碼與審查意見：

```typescript
type AgentResult = {
  content: string;
  tokensUsed: number;
  toolCalls: number;
};

async function singleAgentApproach(task: string): Promise<AgentResult> {
  const systemPrompt = `You are a full-stack developer. You must:
1. Research the requirements
2. Write the code
3. Review the code for bugs
4. Write tests
Do ALL of these in a single conversation.`;

  const contextWindow: string[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const research = await fakeLLMCall(systemPrompt, `Research: ${task}`);
  contextWindow.push(research.output);
  totalTokens += research.tokens;
  totalToolCalls += research.calls;

  const code = await fakeLLMCall(
    systemPrompt,
    `Given this research:\n${contextWindow.join("\n")}\n\nNow write code for: ${task}`
  );
  contextWindow.push(code.output);
  totalTokens += code.tokens;
  totalToolCalls += code.calls;

  const review = await fakeLLMCall(
    systemPrompt,
    `Given all previous context:\n${contextWindow.join("\n")}\n\nReview the code.`
  );
  contextWindow.push(review.output);
  totalTokens += review.tokens;
  totalToolCalls += review.calls;

  return {
    content: contextWindow.join("\n---\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

此做法的問題：
- 上下文視窗隨著每個階段持續膨脹。到了程式碼審查步驟時，視窗內同時包含研究筆記、程式碼與先前的推理內容。
- 系統 prompt 很通用，無法針對各階段調整。
- 沒有任何部分能平行執行。

### 步驟二：建構專注領域的專家 Agent

現在把它拆開。每個 agent 各負責一項工作：

```typescript
type SpecialistAgent = {
  name: string;
  systemPrompt: string;
  run: (input: string) => Promise<AgentResult>;
};

function createSpecialist(name: string, systemPrompt: string): SpecialistAgent {
  return {
    name,
    systemPrompt,
    run: async (input: string) => {
      const result = await fakeLLMCall(systemPrompt, input);
      return {
        content: result.output,
        tokensUsed: result.tokens,
        toolCalls: result.calls,
      };
    },
  };
}

const researcher = createSpecialist(
  "researcher",
  "You are a technical researcher. Read documentation, find patterns, and summarize findings. Output only the facts needed for implementation."
);

const coder = createSpecialist(
  "coder",
  "You are a senior TypeScript developer. Given requirements and research notes, write clean, tested code. Nothing else."
);

const reviewer = createSpecialist(
  "reviewer",
  "You are a code reviewer. Find bugs, security issues, and logic errors. Be specific. Cite line numbers."
);
```

每個專家 agent 都有聚焦的 prompt，並各自擁有乾淨的上下文視窗，只接收它所需的輸入。

### 步驟三：以結構化訊息協調各 Agent

利用明確的訊息傳遞機制將這些專家 agent 串聯在一起：

```typescript
type AgentMessage = {
  from: string;
  to: string;
  content: string;
  timestamp: number;
};

async function multiAgentApproach(task: string): Promise<AgentResult> {
  const messages: AgentMessage[] = [];
  let totalTokens = 0;
  let totalToolCalls = 0;

  const researchResult = await researcher.run(task);
  messages.push({
    from: "researcher",
    to: "coder",
    content: researchResult.content,
    timestamp: Date.now(),
  });
  totalTokens += researchResult.tokensUsed;
  totalToolCalls += researchResult.toolCalls;

  const coderInput = messages
    .filter((m) => m.to === "coder")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const codeResult = await coder.run(coderInput);
  messages.push({
    from: "coder",
    to: "reviewer",
    content: codeResult.content,
    timestamp: Date.now(),
  });
  totalTokens += codeResult.tokensUsed;
  totalToolCalls += codeResult.toolCalls;

  const reviewerInput = messages
    .filter((m) => m.to === "reviewer")
    .map((m) => `[From ${m.from}]: ${m.content}`)
    .join("\n");

  const reviewResult = await reviewer.run(reviewerInput);
  messages.push({
    from: "reviewer",
    to: "orchestrator",
    content: reviewResult.content,
    timestamp: Date.now(),
  });
  totalTokens += reviewResult.tokensUsed;
  totalToolCalls += reviewResult.toolCalls;

  return {
    content: messages.map((m) => `[${m.from} -> ${m.to}]: ${m.content}`).join("\n\n"),
    tokensUsed: totalTokens,
    toolCalls: totalToolCalls,
  };
}
```

每個 agent 只接收發給它的訊息，因此不會有上下文污染。研究員閱讀官方文件產生的 50k token，不會進入審查員的上下文。

### 步驟四：比較效能

```typescript
async function compare() {
  const task = "Build a rate limiter middleware for an Express.js API";

  console.log("=== Single Agent ===");
  const single = await singleAgentApproach(task);
  console.log(`Tokens: ${single.tokensUsed}`);
  console.log(`Tool calls: ${single.toolCalls}`);

  console.log("\n=== Multi-Agent ===");
  const multi = await multiAgentApproach(task);
  console.log(`Tokens: ${multi.tokensUsed}`);
  console.log(`Tool calls: ${multi.toolCalls}`);
}
```

多 agent 版本的總 token 消耗量確實較多（因為拆分為三個獨立 agent，發起三次呼叫），但每個 agent 的上下文都保持乾淨精簡。由於每個階段的系統 prompt 都經過特化，各階段成果的品質皆有提升。

## Use It｜實際應用

本課交付了一個可用於判斷何時該導入多 agent 架構的實用 prompt 決策樣板。詳見 `outputs/prompt-multi-agent-decision.md`。

## Exercises｜練習

1. 追加第四個專家 agent：一個接收寫程式 agent 產出的程式碼與審查員回饋意見、並專注撰寫單元測試的「測試員（tester）」agent。
2. 改造管線流程，讓審查員能把回饋意見退回給寫程式的 agent，形成迭代修訂迴圈（最多 2 輪修訂）。
3. 將原本循序執行的管線重構為平行扇出架構：讓研究員與「需求分析師」agent 並行運作，並在將結果傳遞給寫程式的 agent 之前合併兩者的輸出。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| 群體（Swarm） | 「AI agent 的蜂巢心智」 | 一組共享狀態、沒有固定領導者的對等 agent。行為從局部互動中浮現。 |
| 編排者（Orchestrator） | 「主管 agent」 | 工具包含衍生與管理其他 agent 的 agent。它負責規劃與委派，但本身未必執行實際工作。 |
| 協調器（Coordinator） | 「交通警察」 | 非 agent 的元件（通常只是程式碼，而非 LLM），依規則在 agent 之間路由訊息。 |
| 共識（Consensus） | 「agent 們達成一致」 | 一種協定，多個 agent 必須先達成一致才能繼續。用於需要解決衝突輸出的情境。 |
| 湧現行為（Emergent behavior） | 「agent 們自己想通了」 | 系統層級的模式，源自 agent 之間的互動，但並未被明確編寫。可能有益，也可能有害。 |
| Fan-out / fan-in | 「agent 版的 map-reduce」 | 將任務分給多個平行 agent（fan-out），再合併其結果（fan-in）。 |
| 訊息傳遞（Message passing） | 「agent 彼此對話」 | agent 之間的通訊機制：由一個 agent 把結構化資料傳給另一個 agent，取代共享的上下文視窗。 |

## Further Reading｜延伸閱讀

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) — 多 agent 模式綜述。
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) — 微軟的多 agent 對話框架。
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) — Claude Code 如何透過 Task 委派任務。
- [CrewAI documentation](https://docs.crewai.com/) — 以角色為基礎的多 agent 框架。
