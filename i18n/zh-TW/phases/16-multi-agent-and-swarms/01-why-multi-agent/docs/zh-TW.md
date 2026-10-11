# 為何需要多 Agent 架構？（Why Multi-Agent?）

> 單一 agent 終究會撞上天花板。明智之舉並非打造一個更龐大的 agent——而是引入更多的 agent。

**Type:** Learn
**Languages:** TypeScript
**Prerequisites:** Phase 14 (Agent Engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 識別單一 agent 的能力天花板（上下文溢位、專業領域混雜、循序執行瓶頸），並明確解釋何時將任務拆分為多個 agent 是正確的決定
- 比較各種編排模式（管線、平行扇出、監督者、階層式架構），並為給定的任務結構挑選最適方案
- 設計具備清晰角色邊界、共享狀態與通訊契約的多 agent 系統
- 權衡分析多 agent 複雜度（延遲、成本、除錯難度）與單一 agent 簡潔性之間的得失

## The Problem｜問題

你在 Phase 14 中親手打造了一個單一 agent。它運作順暢。它能夠讀取檔案、執行指令、呼叫 API 並對結果進行推理。接著，你將它指向一個真實的程式碼庫：包含 200 個檔案、三種程式語言、強烈依賴基礎架構的測試套件，以及在編寫程式碼之前必須先深入調研外部 API 的嚴格需求。

此時 agent 徹底卡死了。這並非因為底層的 LLM 不夠聰明，而是因為任務規模遠遠超出了單一 agent 迴圈所能承載的極限。上下文視窗迅速被各個檔案的內容塞滿。agent 開始忘記它在 40 次工具呼叫之前讀過的核心邏輯。它試圖同時扮演研究員、工程師與審查員的多重角色，結果卻是在這三個角色上全都表現拙劣。

這正是所謂的「單一 Agent 天花板（Single-Agent Ceiling）」。每當一項任務需要滿足以下條件時，你都會不可避免地撞上這道牆：

- **需要超出單一視窗容量的龐大上下文**——通讀 50 個檔案會輕易衝破 200k 個 token
- **在不同階段需要截然不同的專業知識**——調研需求所需的 prompt 設計與生成高品質程式碼截然不同
- **任務本質上完全可以平行進行**——當你明明能同時並行讀取三個檔案時，為何要依序串列讀取？

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

系統會在三個關鍵維度上徹底瓦解：

1. **上下文飽和（Context saturation）**——工具呼叫的輸出結果不斷堆積。到了第 30 輪對話時，agent 已經吞下了 150k 個 token 的檔案內容、終端機輸出與先前的推理記錄。第 5 輪中至關重要的微小細節就此石沉大海。

2. **角色混淆（Role confusion）**——一個宣稱「你同時是研究員、工程師、審查員與測試員」的系統 prompt，最終只會孕育出一個調研半吊子、寫程式馬馬虎虎、且永遠無法徹底完成程式碼審查的平庸 agent。

3. **循序執行瓶頸（Sequential bottleneck）**——agent 依序讀取檔案 A、檔案 B，接著是檔案 C。發起三次串列的 LLM 呼叫。三次串列的工具執行。完全喪失了平行運算的能力。

### 多 Agent 解決方案

將龐大的工作進行解耦。賦予每個 agent 單一職責、專屬的上下文視窗，以及專門針對該職責深度調校的系統 prompt：

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
- 聚焦單一目標的系統 prompt（「你是一名專業程式碼審查員。你的唯一任務就是找出潛在 bug。」）
- 自身乾淨的獨立上下文視窗（絕不被其他 agent 的無關中間過程所污染）
- 明確規範的輸入／輸出契約（接收研究摘要筆記，輸出實作程式碼）

### 真實世界中的成熟實踐案例

**Claude Code 子 Agent（Subagents）**——當 Claude Code 透過 `Task` 生成子 agent 時，它會建立一個帶有專屬任務邊界的子 agent。父 agent 得以維持自身上下文的絕對純淨。子 agent 專注完成特定任務後，僅回傳高度濃縮的摘要結果。

**Devin**——內部同時運作規劃者 agent、編程者 agent 以及瀏覽器 agent。規劃者負責將整體工作拆解為具體步驟。編程者專注編寫程式碼。瀏覽器 agent 負責調研官方文件。彼此各自擁有獨立的上下文。

**多 Agent 程式碼編寫團隊（SWE-bench）**——在 SWE-bench 上名列前茅的頂尖系統，普遍採用由負責通讀程式碼庫的研究員、負責設計修復方案的規劃者，以及負責落地編碼的工程師組成的多 agent 團隊。單一 agent 系統的得分明顯落後。

**ChatGPT 深度研究（Deep Research）**——平行衍生多個搜尋 agent，各自從不同維度深入探索，最後再由主架構對各路結果進行綜合提煉。

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

**單一 Agent（Single agent）**——單一迴圈、單一 prompt。極度適合單純直觀的任務。

**子 Agent（Subagents）**——由父 agent 針對特定子任務動態派生子 agent。父 agent 掌握全域規劃。子 agent 定期匯報結果。這正是 Claude Code 的運作核心。

**管線（Pipeline）**——agent 依序串聯運作。Agent A 的輸出直接作為 Agent B 的輸入。非常適合階段分明的工作流程：調研 -> 編碼 -> 審查 -> 測試。

**團隊（Team）**——多個 agent 藉由共享訊息匯流排平行運作。每個成員各司其職。由編排器進行整體調度。適用於同時需要多種不同專業技能協同的場景。

**群體（Swarm）**——由大量相同或高度近似的 agent 共享全域狀態。沒有固定的中心編排器。各 agent 自主從任務佇列中領取工作。極度適合高吞吐量的平行大規模任務。

### 四大多 Agent 核心模式

#### 模式一：管線模式（Pipeline）

```
Input ──▶ Agent A ──▶ Agent B ──▶ Agent C ──▶ Output
          (research)  (code)      (review)
```

每個 agent 依序對資料進行轉換處理並向下游傳遞。系統邏輯極易推理分析。然而單一階段的失敗會導致後續管線全面阻塞。

#### 模式二：扇出／扇入模式（Fan-out / Fan-in）

```
                ┌──▶ Agent A ──┐
                │              │
Input ──▶ Split ├──▶ Agent B ──├──▶ Merge ──▶ Output
                │              │
                └──▶ Agent C ──┘
```

將總體工作拆解並分發給多個平行運作的 agent，最後再匯聚整合成單一成果。極度適合可自然分解為相互獨立子任務的工作。

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

由具備高智慧的編排者負責綜觀全域、拆解決策、指派任務給各工作者，並對最終成果進行提煉整合。編排者本身也是一個具備生成與管理工作者工具的 agent。

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

系統內部不存在任何中央編排者。所有 agent 之間皆為平等的點對點（peer-to-peer）通訊。整體決策由群體互動自然湧現而成。除錯難度極高，但具備擴展至成百上千個 agent 的強大彈性。

### 何時「絕不該」使用多 Agent 架構

多 agent 架構必然伴隨著複雜度的劇烈攀升。agent 之間傳遞的每一則訊息，都是一個潛在的系統故障點。除錯的維度從原本單純的「通讀單一對話歷史」，急遽演變為「在五個獨立 agent 之間繁雜追蹤訊息傳遞軌跡」。

**在以下情境中請堅決維持單一 Agent：**
- 任務規模可完全容納於單一上下文視窗內（工作資料低於 ~100k token）
- 不同工作階段不需要完全不同的專屬系統 prompt
- 循序串聯執行的耗時已經完全滿足業務延遲需求
- 任務結構足夠單純，以至於將其拆解所帶來的通訊開銷遠超過實質業務價值

**複雜度帶來的沉重代價：**
- 每一個 agent 邊界本質上都是一次有損壓縮：Agent A 的完整上下文必須被濃縮為一則精簡訊息傳遞給 Agent B
- 協同協調邏輯（誰該做什麼、何時執行、先後順序為何）本身就是產生 bug 的全新溫床
- 延遲顯著增加：N 個 agent 意味著最少產生 N 次串聯 LLM 呼叫，若涉及來回協商延遲將成倍攀升
- 成本乘數暴增：每個 agent 都在獨立燃燒各自的 token 配額

黃金經驗法則：若一項任務所需的工具呼叫少於 20 次且資料量在 100k token 以內，請務必堅定維持單一 agent 架構。

```figure
swarm-messages
```

## Build It｜動手實作

### 步驟一：不堪重負的單一 Agent

以下展示一個試圖包山包海的單一 agent。它背負著一個無比臃腫的龐大系統 prompt，並用單一上下文視窗硬塞入調研資料、程式碼與審查意見：

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

該架構暴露出的致命缺陷：
- 上下文視窗隨著每個階段線性膨脹。到了程式碼審查步驟時，視窗內部充斥著大量的調研筆記、厚重的程式碼以及先前的推理雜訊。
- 系統 prompt 泛化而平庸，無法針對特定階段進行極限調優。
- 所有環節皆為循序阻塞執行，完全喪失平行運作優勢。

### 步驟二：建構專注領域的專家 Agent

現在我們對其進行職責拆解。賦予每個 agent 唯一的特定職責：

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

每個專家 agent 皆擁有高度聚焦的專屬 prompt，且各自享有乾淨獨立的上下文視窗，僅接收其工作必需的最小輸入。

### 步驟三：透過結構化訊息進行跨 Agent 協同

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

每個 agent 僅會接收到明確發送給它的訊息內容。徹底根絕了上下文污染。調研員在通讀官方文件時產生的 50k token 雜訊，絕不會未經篩選便流入審查員的上下文之中。

### 步驟四：實測效能對比

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

多 agent 版本的總體 token 消耗量確實有所增加（因為拆分為三個獨立 agent 發起三次呼叫），但每個 agent 的上下文始終保持高度純淨與精煉。由於每個階段的系統 prompt 皆經過深度特化，最終產出的每一項成果品質皆獲得了質的躍升。

## Use It｜實際應用

本課交付了一個可用於判斷何時該導入多 agent 架構的實用 prompt 決策樣板。詳見 `outputs/prompt-multi-agent-decision.md`。

## Exercises｜練習

1. 追加第四個專家 agent：一個接收編程者產出的程式碼與審查員回饋意見、並專注編寫單元測試的「測試員（tester）」agent。
2. 改造管線流程，使審查員能夠將回饋意見打回給編程者進行迭代修訂迴圈（限制最多進行 2 輪修訂）。
3. 將原本循序執行的管線重構為平行扇出架構：讓研究員與「需求分析師」agent 並行運作，並在將結果傳遞給編程者之前對兩者輸出進行合併。

## Key Terms｜關鍵術語

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Swarm | "A hive mind of AI agents" | A set of peer agents with shared state and no fixed leader. Behavior emerges from local interactions. |
| Orchestrator | "The boss agent" | An agent whose tools include spawning and managing other agents. It plans and delegates but may not do the actual work. |
| Coordinator | "The traffic cop" | A non-agent component (often just code, not an LLM) that routes messages between agents based on rules. |
| Consensus | "The agents agree" | A protocol where multiple agents must reach agreement before proceeding. Used when conflicting outputs need resolution. |
| Emergent behavior | "The agents figured it out themselves" | System-level patterns that arise from agent interactions but were not explicitly programmed. Can be useful or harmful. |
| Fan-out / fan-in | "Map-reduce for agents" | Splitting a task across parallel agents (fan-out), then combining their results (fan-in). |
| Message passing | "Agents talk to each other" | The communication mechanism between agents: structured data sent from one agent to another, replacing shared context windows. |

## Further Reading｜延伸閱讀

- [The Landscape of Emerging AI Agent Architectures](https://arxiv.org/abs/2409.02977) — 多 agent 架構模式的全面綜述論文。
- [AutoGen: Enabling Next-Gen LLM Applications](https://arxiv.org/abs/2308.08155) — 微軟開源的多 agent 對話架構奠基之作。
- [Claude Code subagents documentation](https://docs.anthropic.com/en/docs/claude-code) — 深入探討 Claude Code 如何透過 Task 委派子任務。
- [CrewAI documentation](https://docs.crewai.com/) — 基於角色分工的權威多 agent 框架官方文件。
