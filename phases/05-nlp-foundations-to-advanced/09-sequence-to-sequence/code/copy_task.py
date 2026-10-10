# Exercise 1 (easy) from phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/docs/en.md
# Toy copy task: a GRU encoder-decoder must reproduce its input sequence.
# Everything the decoder knows passes through one fixed-size context vector
# (the encoder's final hidden state), so accuracy falls as length grows.
# Reference: Cho et al. 2014 (GRU encoder-decoder), Sutskever et al. 2014 (seq2seq).
# --attention adds Luong dot-product attention over encoder states (lesson 10 preview).
# Run: python3 copy_task.py  [--hidden 32] [--steps 3000] [--lengths 5 10 20] [--attention]

import argparse

import torch
import torch.nn as nn

PAD, SOS, EOS = 0, 1, 2
N_SYMBOLS = 10
VOCAB = N_SYMBOLS + 3  # symbols are ids 3..12


def make_batch(batch_size, seq_len, gen):
    """Random symbol sequences. Source == target (the copy task)."""
    src = torch.randint(3, VOCAB, (batch_size, seq_len), generator=gen)
    sos = torch.full((batch_size, 1), SOS)
    eos = torch.full((batch_size, 1), EOS)
    dec_in = torch.cat([sos, src], dim=1)   # teacher-forced decoder input
    dec_out = torch.cat([src, eos], dim=1)  # what the decoder must predict
    return src, dec_in, dec_out


class Encoder(nn.Module):
    def __init__(self, vocab, emb, hidden):
        super().__init__()
        self.embed = nn.Embedding(vocab, emb)
        self.gru = nn.GRU(emb, hidden, batch_first=True)

    def forward(self, src):
        outputs, h = self.gru(self.embed(src))
        # h (1, B, H) is the context vector. Without attention it is the only
        # bridge to the decoder; outputs (B, T, H) are thrown away.
        return outputs, h


class Decoder(nn.Module):
    def __init__(self, vocab, emb, hidden):
        super().__init__()
        self.embed = nn.Embedding(vocab, emb)
        self.gru = nn.GRU(emb, hidden, batch_first=True)
        self.out = nn.Linear(hidden, vocab)

    def forward(self, tokens, h, enc_outputs=None):
        o, h = self.gru(self.embed(tokens), h)
        return self.out(o), h


class AttnDecoder(Decoder):
    """Luong dot-product attention: each step reads all encoder states, not just h."""

    def __init__(self, vocab, emb, hidden):
        super().__init__(vocab, emb, hidden)
        self.out = nn.Linear(2 * hidden, vocab)

    def forward(self, tokens, h, enc_outputs=None):
        o, h = self.gru(self.embed(tokens), h)                     # (B, T_dec, H)
        weights = torch.softmax(o @ enc_outputs.transpose(1, 2), dim=-1)  # (B, T_dec, T_enc)
        context = weights @ enc_outputs                            # (B, T_dec, H)
        return self.out(torch.cat([o, context], dim=-1)), h


class Seq2Seq(nn.Module):
    def __init__(self, vocab=VOCAB, emb=32, hidden=32, attention=False):
        super().__init__()
        self.encoder = Encoder(vocab, emb, hidden)
        self.decoder = (AttnDecoder if attention else Decoder)(vocab, emb, hidden)

    def forward(self, src, dec_in):
        """Teacher forcing: decoder sees the gold previous token at every step."""
        enc_outputs, h = self.encoder(src)
        logits, _ = self.decoder(dec_in, h, enc_outputs)
        return logits

    @torch.no_grad()
    def greedy(self, src, max_len):
        """Inference: decoder feeds back its own predictions."""
        enc_outputs, h = self.encoder(src)
        tok = torch.full((src.size(0), 1), SOS)
        preds = []
        for _ in range(max_len):
            logits, h = self.decoder(tok, h, enc_outputs)
            tok = logits.argmax(-1)
            preds.append(tok)
        return torch.cat(preds, dim=1)


def train(seq_len, hidden, steps, attention=False, batch_size=128, lr=3e-3, seed=0):
    torch.manual_seed(seed)
    gen = torch.Generator().manual_seed(seed)
    model = Seq2Seq(hidden=hidden, attention=attention)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    for _ in range(steps):
        src, dec_in, dec_out = make_batch(batch_size, seq_len, gen)
        logits = model(src, dec_in)
        loss = loss_fn(logits.reshape(-1, VOCAB), dec_out.reshape(-1))
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
    return model


def evaluate(model, seq_len, n=2000, seed=123):
    """Token accuracy, exact-match sequence accuracy, and accuracy per output position."""
    gen = torch.Generator().manual_seed(seed)
    src, _, _ = make_batch(n, seq_len, gen)
    pred = model.greedy(src, seq_len)
    correct = pred == src
    return {
        "token_acc": correct.float().mean().item(),
        "seq_acc": correct.all(dim=1).float().mean().item(),
        "by_position": correct.float().mean(dim=0).tolist(),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--hidden", type=int, default=32)
    p.add_argument("--steps", type=int, default=3000)
    p.add_argument("--lengths", type=int, nargs="+", default=[5, 10, 20])
    p.add_argument("--attention", action="store_true")
    args = p.parse_args()

    mode = "with attention" if args.attention else "no attention"
    print(f"GRU seq2seq copy task | {mode} | hidden={args.hidden} | {args.steps} steps x 128 per length")
    print(f"context vector = {args.hidden} floats, fixed regardless of input length\n")
    print(f"{'seq_len':>8} {'token_acc':>10} {'seq_acc':>9}   accuracy by output position (first -> last)")
    for L in args.lengths:
        model = train(L, args.hidden, args.steps, args.attention)
        r = evaluate(model, L)
        curve = " ".join(f"{a:.2f}" for a in r["by_position"])
        print(f"{L:>8} {r['token_acc']:>9.1%} {r['seq_acc']:>8.1%}   {curve}")


if __name__ == "__main__":
    main()
