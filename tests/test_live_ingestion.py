"""Live public HF + actual FalkorDB. No mocks and no network skips."""
import copy
import uuid
from leakline.ingest import inspect, ingest
from leakline.matching import match, normalize
from leakline.models import AuditRequest
from leakline.graph import Graph


def test_public_pinned_source_to_falkordb_and_unchanged_original():
    req = AuditRequest(dataset="cornell-movie-review-data/rotten_tomatoes",limit_per_split=12)
    src = inspect(req)
    assert len(src.revision_sha)==40
    assert set(src.splits)>={"train","validation","test"}
    req.revision=src.revision_sha
    req.config=src.config
    samples=ingest(req,src)
    assert len(samples)==24 and all(s.text for s in samples)
    before=copy.deepcopy(samples)
    evidence=match(samples)
    g=Graph("leakline_test_"+uuid.uuid4().hex)
    try:
        g.store(src,samples,evidence)
        components,findings=g.components(req.train_splits,req.evaluation_splits)
        assert g.query("MATCH (s:Sample) RETURN count(s)")==[[24]]
        assert sum(len(c.sample_ids) for c in components)==24
        # Independent reachability oracle only in tests.
        adjacency={s.sample_id:set() for s in samples}
        for e in evidence:
            if e.status=="confirmed":
                adjacency[e.a].add(e.b); adjacency[e.b].add(e.a)
        groups=[]
        remaining=set(adjacency)
        while remaining:
            todo=[next(iter(remaining))]; group=set()
            while todo:
                node=todo.pop()
                if node in group: continue
                group.add(node); todo.extend(adjacency[node]-group)
            remaining-=group; groups.append(group)
        assert {frozenset(c.sample_ids) for c in components}=={frozenset(g) for g in groups}
        splits={s.sample_id:s.split for s in samples}
        expected={frozenset(g) for g in groups if {splits[x] for x in g}>={"train","test"}}
        assert {frozenset(c.sample_ids) for c in findings}==expected
        for e in evidence:
            if e.method=="exact_sha256":
                texts={s.sample_id:normalize(s.text) for s in samples}
                assert texts[e.a]==texts[e.b]
    finally:
        g.graph.delete()
    assert samples==before
    again=ingest(req,src)
    assert again==before  # same pinned remote rows and split assignments after audit
