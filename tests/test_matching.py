import hashlib
import pytest
from leakline.models import Sample
from leakline.matching import normalize, match, shingles
from leakline.ingest import dataset_id


def sample(id, text, split="train", label="0"):
    return Sample(sample_id=id,split=split,row_index=0,text=text,label=label,
                  raw_hash=hashlib.sha256(text.encode()).hexdigest(),
                  text_hash=hashlib.sha256(normalize(text).encode()).hexdigest())


def test_exact_normalization_preserves_negation_and_case():
    edges = match([sample("a","Hello  world"),sample("b","Hello\nworld","test"),sample("c","hello world")])
    assert [(e.a,e.b,e.method,e.score) for e in edges] == [("a","b","exact_sha256",1)]
    assert normalize("not good") != normalize("good")


def test_verified_near_and_label_quarantine():
    text = "A detailed film review discusses remarkable acting, thoughtful dialogue and careful pacing throughout the entire production."
    edited = text + "!"
    edges = match([sample("a",text),sample("b",edited,"test")])
    assert len(edges) == 1 and edges[0].status == "confirmed"
    a,b = shingles(text),shingles(edited)
    assert edges[0].score == len(a&b)/len(a|b)
    assert match([sample("a",text),sample("b",edited,"test","1")])[0].status == "needs_review"
    negated = text.replace("discusses", "does not discuss")
    edges = match([sample("a",text),sample("b",negated)], .8)
    assert edges and edges[0].status == "needs_review"


def test_clean_and_short():
    assert match([sample("a","good"),sample("b","bad")]) == []
    assert match([]) == []


@pytest.mark.parametrize("url",["http://huggingface.co/datasets/a/b","https://evil.com/datasets/a/b","https://huggingface.co@localhost/datasets/a/b","a/b/resolve/main","https://huggingface.co/datasets/a/b?x=1"])
def test_reject_source(url):
    with pytest.raises(ValueError):
        dataset_id(url)


def test_source_url():
    assert dataset_id("https://huggingface.co/datasets/owner/name") == "owner/name"
