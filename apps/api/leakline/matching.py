import hashlib
import re
import unicodedata
from collections import defaultdict
from datasketch import MinHash, MinHashLSH
from .models import Evidence


def normalize(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def shingles(text):
    return {text[i:i+5] for i in range(max(0, len(text)-4))}


def negations(text):
    return re.findall(r"\b(?:not|no|never|without)\b|n't\b", text.casefold())


def match(samples, threshold=.9):
    edges = {}
    buckets = defaultdict(list)
    lsh = MinHashLSH(threshold=.75, num_perm=128)
    seen = {}
    def add(a, b, method, score, status, reason):
        a, b = sorted([a.sample_id, b.sample_id])
        pair_id = hashlib.sha256(f"{a}|{b}|strict-v1|{threshold}".encode()).hexdigest()
        edges[(a,b)] = Evidence(pair_id=pair_id, a=a, b=b, method=method, score=score,
                               threshold=1 if method == "exact_sha256" else threshold, status=status, reason=reason)
    for sample in samples:
        for other in buckets[sample.text_hash]:
            add(sample, other, "exact_sha256", 1, "confirmed", "Equal strict-v1 normalized SHA-256" +
                ("; conflicting labels" if sample.label != other.label else ""))
        buckets[sample.text_hash].append(sample)
        text = normalize(sample.text)
        grams = shingles(text)
        if len(text) < 40 or len(grams) < 20:
            continue
        mh = MinHash(num_perm=128, seed=42)
        for gram in sorted(grams):
            mh.update(gram.encode())
        for key in sorted(lsh.query(mh)):
            other, other_grams = seen[key]
            if sample.text_hash == other.text_hash:
                continue
            score = len(grams & other_grams) / len(grams | other_grams)
            if score >= threshold:
                review = sample.label != other.label or negations(text) != negations(normalize(other.text))
                add(sample, other, "minhash_jaccard", score, "needs_review" if review else "confirmed",
                    "Label or negation mismatch" if review else "Verified character-5 shingle Jaccard")
        lsh.insert(sample.sample_id, mh)
        seen[sample.sample_id] = (sample, grams)
    if len(edges) > 100000:
        raise ValueError("audit_budget_exceeded: too many duplicate pairs")
    return list(edges.values())
