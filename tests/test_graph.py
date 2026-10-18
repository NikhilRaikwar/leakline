import copy
import uuid
import pytest
from leakline.graph import Graph, WCC, FINDINGS
from leakline.models import Source, Evidence
from test_matching import sample


@pytest.fixture
def graph():
    g = Graph("leakline_test_"+uuid.uuid4().hex)
    yield g
    if g.queries:
        g.graph.delete()


def source():
    return Source(dataset_id="tests/fixture",revision_sha="a"*40,config="default",configs=["default"],
                  splits={"train":3,"test":1},columns={"text":"string"},license="test fixture only")


def edge(a,b,status="confirmed"):
    return Evidence(pair_id=a+b,a=a,b=b,method="minhash_jaccard",score=.95,threshold=.9,status=status,reason="explicit algorithm test fixture")


def test_real_wcc_transitive_singleton_and_ignored_candidate(graph):
    samples=[sample("a","A"),sample("b","B"),sample("c","C","test"),sample("d","D")]
    before=copy.deepcopy(samples)
    graph.store(source(),samples,[edge("a","b"),edge("b","c"),edge("c","d","needs_review")])
    components,findings=graph.components(["train"],["test"])
    assert sorted(len(c.sample_ids) for c in components)==[1,3]
    assert findings[0].sample_ids==["a","b","c"]
    assert WCC in graph.queries and FINDINGS in graph.queries
    assert graph.query("MATCH (s:Sample) RETURN count(s)")==[[4]]
    assert graph.query("MATCH (s:Sample {sample_id:'a'}) RETURN s.text,s.split")==[["A","train"]]
    assert samples==before
    again, findings_again=graph.components(["train"],["test"])
    assert again==components and findings_again==findings
    assert graph.query("MATCH (c:Component) RETURN count(c)")==[[2]]


def test_clean_no_edges_and_isolation(graph):
    graph.store(source(),[sample("a","alpha"),sample("b","beta","test")],[])
    components,findings=graph.components(["train"],["test"])
    assert len(components)==2 and findings==[]
    assert all(not c.crosses_boundary for c in components)


def test_empty_graph(graph):
    graph.store(source(),[],[])
    assert graph.components(["train"],["test"]) == ([],[])


def test_database_outage_has_no_local_algorithm_fallback(monkeypatch):
    monkeypatch.setenv("FALKORDB_PORT","1")
    with pytest.raises(Exception):
        Graph("leakline_unreachable").components(["train"],["test"])


def test_recompute_removes_stale_materialized_components(graph):
    graph.store(source(),[sample("a","A"),sample("b","B"),sample("c","C","test"),sample("d","D")],[edge("a","b"),edge("b","c")])
    _,findings=graph.components(["train"],["test"])
    assert findings
    graph.query("MATCH (:Sample {sample_id:'b'})-[r:CONFIRMED_DUPLICATE_OF]->(:Sample {sample_id:'c'}) DELETE r")
    graph.query("MATCH (e:PairEvidence {pair_id:'bc'}) SET e.status='needs_review'")
    components,findings=graph.components(["train"],["test"])
    assert not findings and sorted(len(c.sample_ids) for c in components)==[1,1,2]
    assert graph.query("MATCH (c:Component) RETURN count(c)")==[[3]]
