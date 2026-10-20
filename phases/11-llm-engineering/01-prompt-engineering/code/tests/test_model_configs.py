import json
import sys
from pathlib import Path
import unittest
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prompt_engineering as harness


class ModelConfigTests(unittest.TestCase):
    def setUp(self):
        self.prompt = {
            "system": "You are concise.",
            "user": "Summarize the request.",
            "temperature": 0.5,
        }

    def dispatch(self, models=None, protocol_overrides=None, region="global_en", prompt=None):
        captured = []
        simulate = harness.simulate_llm_call

        def capture(name, request):
            captured.append(json.loads(json.dumps(request)))
            return simulate(name, request)

        with patch.object(harness, "simulate_llm_call", side_effect=capture):
            results = harness.run_prompt_test(
                prompt or self.prompt, models, protocol_overrides, region
            )
        self.assertEqual(len(results), len(captured))
        for result, request in zip(results.values(), captured):
            self.assertEqual(result["request_payload"], request)
        return captured

    def test_default_dispatch_lists_flash_then_m3_only(self):
        requests = self.dispatch()
        self.assertEqual(
            [r["body"]["model"] for r in requests if r["provider"] == "minimax"],
            ["MiniMax-M3.1-Flash", "MiniMax-M3"],
        )
        self.assertNotIn("MiniMax-M2.7", harness.MODEL_CONFIGS)

    def test_current_model_metadata(self):
        flash = harness.MODEL_CONFIGS["MiniMax-M3.1-Flash"]
        m3 = harness.MODEL_CONFIGS["MiniMax-M3"]
        self.assertEqual((flash["context_window"], flash["thinking"]), (1_000_000, ("adaptive",)))
        self.assertEqual((m3["context_window"], m3["thinking"]), (1_000_000, ("adaptive", "disabled")))

    def test_explicit_models_protocols_and_regions_reach_dispatch(self):
        for model in ("MiniMax-M3.1-Flash", "MiniMax-M3", "MiniMax-M2.7"):
            for region, host in (("global_en", "api.minimax.io"), ("cn_zh", "api.minimaxi.com")):
                for protocol, path in (("openai", "/v1/chat/completions"), ("anthropic", "/anthropic/v1/messages")):
                    with self.subTest(model=model, region=region, protocol=protocol):
                        request = self.dispatch([model], {model: protocol}, region)[0]
                        self.assertEqual(request["request_url"], f"https://{host}{path}")
                        body = request["body"]
                        self.assertEqual(body["model"], model)
                        self.assertEqual(body["max_tokens"], 2048)
                        self.assertEqual(body["temperature"], 0.5)
                        self.assertEqual(body["messages"][-1], {"role": "user", "content": self.prompt["user"]})
                        if protocol == "openai":
                            self.assertEqual(body["messages"][0], {"role": "system", "content": self.prompt["system"]})
                            self.assertNotIn("system", body)
                        else:
                            self.assertEqual(body["system"], self.prompt["system"])
                            self.assertEqual(len(body["messages"]), 1)
                        for field in ("thinking", "reasoning_effort", "output_config", "service_tier", "reasoning_split"):
                            self.assertNotIn(field, body)

    def test_registered_custom_model_keeps_exact_id(self):
        custom = dict(harness.MODEL_CONFIGS["MiniMax-M3"], model="saved-custom-model")
        with patch.dict(harness.MODEL_CONFIGS, {"saved-custom-model": custom}):
            request = self.dispatch(["saved-custom-model"])[0]
        self.assertEqual(request["body"]["model"], "saved-custom-model")

    def test_unknown_model_is_not_silently_replaced(self):
        with self.assertRaisesRegex(ValueError, "Unknown model"):
            harness.run_prompt_test(self.prompt, ["unknown-model"])

    def test_invalid_protocol_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "does not support"):
            harness.run_prompt_test(self.prompt, ["MiniMax-M3.1-Flash"], {"MiniMax-M3.1-Flash": "google"})

    def test_invalid_region_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unknown region"):
            harness.run_prompt_test(self.prompt, ["MiniMax-M3.1-Flash"], region="unknown")

    def test_content_blocks_are_preserved(self):
        for protocol, parts in (
            ("openai", [{"type": "text", "text": "Describe"}, {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}}, {"type": "video_url", "video_url": {"url": "mm_file://example"}}]),
            ("anthropic", [{"type": "text", "text": "Describe"}, {"type": "image", "source": {"type": "url", "url": "https://example.com/image.png"}}]),
        ):
            request = self.dispatch(["MiniMax-M3.1-Flash"], {"MiniMax-M3.1-Flash": protocol}, prompt=dict(self.prompt, user=parts))[0]
            self.assertEqual(request["body"]["messages"][-1]["content"], parts)

    def test_non_minimax_requests_remain_unchanged(self):
        requests = self.dispatch(["gpt-4o", "claude-3.5-sonnet", "gemini-1.5-pro"])
        for request in requests:
            self.assertIsNone(request["request_url"])
        self.assertEqual(requests[0]["body"], {
            "model": "gpt-4o", "messages": [{"role": "system", "content": self.prompt["system"]}, {"role": "user", "content": self.prompt["user"]}],
            "temperature": 0.5, "max_tokens": 2048,
        })
        self.assertEqual(requests[1]["body"], {
            "model": "claude-sonnet-5", "system": self.prompt["system"], "messages": [{"role": "user", "content": self.prompt["user"]}],
            "temperature": 0.5, "max_tokens": 2048,
        })
        self.assertEqual(requests[2]["body"]["generationConfig"], {"temperature": 0.5, "maxOutputTokens": 2048})


if __name__ == "__main__":
    unittest.main()
