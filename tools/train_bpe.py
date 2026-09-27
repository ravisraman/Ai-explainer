#!/usr/bin/env python3
"""Train the page's byte-level BPE tokenizer.

Trains ~3,840 merges (vocabulary of 4,096 = 256 bytes + merges) on word
frequencies from the `wordfreq` package, mostly English with a little Spanish,
German, French and Hindi, plus digit strings. Pre-tokenization follows the
GPT style: words carry their leading space, numbers split into runs of up to
three digits. Output: src/data/bpe.txt, one merge per line ("a b"), in the
GPT-2 printable byte alphabet (a leading space shows as "Ġ").

    pip install wordfreq
    python3 tools/train_bpe.py
"""
import collections
import pathlib
import random

import regex
from wordfreq import top_n_list, word_frequency

# Same pre-tokenizer as the page (src/js/l06-data.js).
PRETOK = regex.compile(r"'s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}\p{M}]+| ?\p{N}{1,3}| ?[^\s\p{L}\p{M}\p{N}]+|\s+(?!\S)|\s+")

ROOT = pathlib.Path(__file__).resolve().parent.parent
N_MERGES = 3840


def bytes_to_unicode():
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return dict(zip(bs, map(chr, cs)))


B2U = bytes_to_unicode()


def encode(s):
    return tuple(B2U[b] for b in s.encode("utf-8"))


def corpus():
    counts = collections.Counter()
    langs = [("en", 40000, 1.0), ("es", 4000, 0.05), ("de", 4000, 0.05), ("fr", 4000, 0.04), ("hi", 2000, 0.015)]
    scale = 1e9
    for lang, n, w in langs:
        for word in top_n_list(lang, n):
            f = word_frequency(word, lang) * w * scale
            if f < 1:
                continue
            if not any(ch.isalpha() for ch in word):
                continue
            counts[" " + word] += f * 0.82
            counts[word] += f * 0.08
            cap = word[:1].upper() + word[1:]
            if cap != word:
                counts[" " + cap] += f * 0.08
                counts[cap] += f * 0.02
    # punctuation and common symbols
    for p, f in [(".", 4e7), (",", 4e7), ("'s", 3e6), ("'t", 2e6), ("?", 3e6), ("!", 2e6), (":", 3e6), (";", 1e6),
                 ('"', 5e6), (" \"", 3e6), ("(", 3e6), (" (", 3e6), (")", 3e6), ("-", 3e6), (" -", 2e6),
                 ("...", 1e6), (" $", 1e6), ("%", 1e6), (" =", 1e6), (" +", 5e5), ("{", 5e5), ("}", 5e5),
                 (" {", 5e5), (");", 4e5), ("()", 4e5), ("[", 4e5), ("]", 4e5), (" <", 3e5), ("++", 2e5),
                 (" +=", 2e5), ("://", 2e5), ("\n", 5e6), ("\n\n", 2e6), ("  ", 1e6), ("    ", 5e5)]:
        counts[p] += f
    # numbers: runs of 1-3 digits, small numbers and years more common
    rnd = random.Random(0)
    for n in range(1000):
        f = 3e6 / (n + 1) ** 1.1
        counts[str(n)] += f
        counts[" " + str(n)] += f * 2
    for y in range(1900, 2031):
        counts[" " + str(y)[:3]] += 2e5
    for _ in range(3000):
        k = rnd.randint(1, 3)
        s = "".join(rnd.choice("0123456789") for _ in range(k))
        counts[s] += 2e3
    split = collections.Counter()
    for w, f in counts.items():
        for piece in PRETOK.findall(w):
            split[piece] += f
    return split


def train(counts, n_merges):
    words = [list(encode(w)) for w in counts]
    freqs = [counts[w] for w in counts]
    pair_counts = collections.defaultdict(float)
    where = collections.defaultdict(set)
    for i, w in enumerate(words):
        for a, b in zip(w, w[1:]):
            pair_counts[(a, b)] += freqs[i]
            where[(a, b)].add(i)
    merges = []
    for step in range(n_merges):
        if not pair_counts:
            break
        best = max(pair_counts, key=lambda p: (pair_counts[p], p))
        if pair_counts[best] <= 0:
            break
        merges.append(best)
        a, b = best
        new = a + b
        for i in list(where[best]):
            w = words[i]
            f = freqs[i]
            j = 0
            changed = False
            out = []
            while j < len(w):
                if j < len(w) - 1 and w[j] == a and w[j + 1] == b:
                    out.append(new)
                    j += 2
                    changed = True
                else:
                    out.append(w[j])
                    j += 1
            if not changed:
                continue
            for p in zip(w, w[1:]):
                pair_counts[p] -= f
                if pair_counts[p] <= 1e-9:
                    pair_counts.pop(p, None)
                where[p].discard(i)
            for p in zip(out, out[1:]):
                pair_counts[p] += f
                where[p].add(i)
            words[i] = out
        pair_counts.pop(best, None)
        where.pop(best, None)
        if step % 500 == 0:
            print(step, a, b)
    return merges


if __name__ == "__main__":
    c = corpus()
    print(f"{len(c)} distinct pre-tokens")
    m = train(c, N_MERGES)
    out = ROOT / "src" / "data" / "bpe.txt"
    out.write_text("\n".join(f"{a} {b}" for a, b in m), encoding="utf-8")
    print(f"wrote {len(m)} merges to {out}")
