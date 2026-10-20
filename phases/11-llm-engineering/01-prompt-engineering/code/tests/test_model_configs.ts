import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { MODEL_CONFIGS, buildPrompt, runPromptTest } from "../main.ts";

const prompt = buildPrompt("persona", {
  role: "an editor", experience: "editing", style: "concise",
  priority: "clarity", task: "Summarize the request.",
});

function dispatch(...args: Parameters<typeof runPromptTest>) {
  const stringify = JSON.stringify;
  const serialized: string[] = [];
  const spy = mock.method(JSON, "stringify", (value: unknown) => {
    const text = stringify(value);
    serialized.push(text);
    return text;
  });
  try {
    const results = runPromptTest(...args);
    assert.deepEqual(serialized.map((text) => JSON.parse(text)), Object.values(results).map((r) => r.requestPayload));
    return results;
  } finally {
    spy.mock.restore();
  }
}

test("default dispatch lists Flash then M3 without legacy models", () => {
  const results = dispatch(prompt);
  assert.deepEqual(Object.keys(results).filter((name) => name.startsWith("MiniMax-")), ["MiniMax-M3.1-Flash", "MiniMax-M3"]);
  assert.equal(MODEL_CONFIGS["MiniMax-M2.7"], undefined);
});

test("Flash and M3 metadata keep their distinct thinking modes", () => {
  assert.equal(MODEL_CONFIGS["MiniMax-M3.1-Flash"].contextWindow, 1_000_000);
  assert.deepEqual(MODEL_CONFIGS["MiniMax-M3.1-Flash"].thinking, ["adaptive"]);
  assert.deepEqual(MODEL_CONFIGS["MiniMax-M3"].thinking, ["adaptive", "disabled"]);
});

test("explicit current and legacy selections preserve protocol, region and body", () => {
  for (const model of ["MiniMax-M3.1-Flash", "MiniMax-M3", "MiniMax-M2.7"]) {
    for (const region of ["global_en", "cn_zh"] as const) {
      for (const protocol of ["openai", "anthropic"] as const) {
        const request = dispatch(prompt, [model], { [model]: protocol }, region)[model].requestPayload;
        const host = region === "global_en" ? "api.minimax.io" : "api.minimaxi.com";
        const path = protocol === "openai" ? "/v1/chat/completions" : "/anthropic/v1/messages";
        assert.equal(request.requestUrl, `https://${host}${path}`);
        const body = request.body;
        assert.equal(body.model, model);
        assert.ok("messages" in body);
        assert.equal(body.max_tokens, 2048);
        assert.equal(body.temperature, prompt.temperature);
        assert.deepEqual(body.messages.at(-1), { role: "user", content: prompt.user });
        if (protocol === "anthropic") {
          assert.ok("system" in body);
          assert.equal(body.system, prompt.system);
          assert.equal(body.messages.length, 1);
        } else {
          assert.deepEqual(body.messages[0], { role: "system", content: prompt.system });
        }
        for (const field of ["thinking", "reasoning_effort", "output_config", "service_tier", "reasoning_split"]) {
          assert.equal(field in body, false);
        }
      }
    }
  }
});

test("registered custom selections preserve the exact model ID", () => {
  Object.assign(MODEL_CONFIGS, { "saved-custom-model": { ...MODEL_CONFIGS["MiniMax-M3"], model: "saved-custom-model" } });
  try {
    assert.equal(dispatch(prompt, ["saved-custom-model"])["saved-custom-model"].requestPayload.body.model, "saved-custom-model");
  } finally {
    Reflect.deleteProperty(MODEL_CONFIGS, "saved-custom-model");
  }
});

test("unknown model selections fail instead of silently switching", () => {
  assert.throws(() => runPromptTest(prompt, ["unknown-model"]), /Unknown model/);
});

test("unsupported protocols fail before dispatch", () => {
  assert.throws(() => runPromptTest(prompt, ["MiniMax-M3.1-Flash"], { "MiniMax-M3.1-Flash": "google" }), /does not support/);
});

test("non-MiniMax requests retain their previous format", () => {
  const results = dispatch(prompt, ["gpt-4o", "claude-3.5-sonnet", "gemini-1.5-pro"]);
  for (const result of Object.values(results)) assert.equal(result.requestPayload.requestUrl, null);
  assert.deepEqual(results["gpt-4o"].requestPayload.body, {
    model: "gpt-4o", messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
    temperature: prompt.temperature, max_tokens: 2048,
  });
  assert.deepEqual(results["claude-3.5-sonnet"].requestPayload.body, {
    model: "claude-sonnet-5", system: prompt.system, messages: [{ role: "user", content: prompt.user }],
    temperature: prompt.temperature, max_tokens: 2048,
  });
});
