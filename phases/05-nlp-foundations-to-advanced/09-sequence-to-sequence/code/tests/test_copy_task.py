import os
import sys
import unittest

import torch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from copy_task import EOS, SOS, VOCAB, Seq2Seq, evaluate, make_batch, train  # noqa: E402


class TestMakeBatch(unittest.TestCase):
    def test_shapes_and_shift(self):
        gen = torch.Generator().manual_seed(0)
        src, dec_in, dec_out = make_batch(4, 7, gen)
        self.assertEqual(src.shape, (4, 7))
        self.assertEqual(dec_in.shape, (4, 8))
        self.assertEqual(dec_out.shape, (4, 8))
        self.assertTrue((dec_in[:, 0] == SOS).all())
        self.assertTrue((dec_out[:, -1] == EOS).all())
        self.assertTrue(torch.equal(dec_in[:, 1:], src))
        self.assertTrue(torch.equal(dec_out[:, :-1], src))

    def test_symbols_exclude_special_tokens(self):
        src, _, _ = make_batch(64, 10, torch.Generator().manual_seed(1))
        self.assertTrue((src >= 3).all() and (src < VOCAB).all())


class TestModel(unittest.TestCase):
    def test_forward_logit_shape(self):
        for attention in (False, True):
            model = Seq2Seq(hidden=16, attention=attention)
            src, dec_in, _ = make_batch(3, 6, torch.Generator().manual_seed(0))
            self.assertEqual(model(src, dec_in).shape, (3, 7, VOCAB))

    def test_greedy_length(self):
        model = Seq2Seq(hidden=16, attention=True)
        src, _, _ = make_batch(5, 9, torch.Generator().manual_seed(0))
        self.assertEqual(model.greedy(src, 9).shape, (5, 9))

    def test_evaluate_keys_and_ranges(self):
        r = evaluate(Seq2Seq(hidden=8), 4, n=50)
        self.assertEqual(len(r["by_position"]), 4)
        self.assertTrue(0.0 <= r["seq_acc"] <= r["token_acc"] <= 1.0)

    def test_short_copy_is_learnable(self):
        model = train(3, hidden=32, steps=400)
        self.assertGreater(evaluate(model, 3, n=500)["token_acc"], 0.9)

    def test_bottleneck_longer_is_harder(self):
        # Same small context vector and budget: longer sequences copy worse.
        short = evaluate(train(4, hidden=16, steps=300), 4, n=500)["token_acc"]
        long = evaluate(train(16, hidden=16, steps=300), 16, n=500)["token_acc"]
        self.assertGreater(short, long + 0.2)


if __name__ == "__main__":
    unittest.main()
