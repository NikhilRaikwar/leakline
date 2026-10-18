"""Fresh FalkorDB reads only: no cached components or planner output."""
import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from .graph import Graph, WCC
from .models import Run, Sample, Evidence


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def component_key(ids):
    return hashlib.sha256("|".join(sorted(ids)).encode()).hexdigest()


@dataclass
class Snapshot:
    samples: dict[str, Sample]
    groups: dict[str, list[str]]
    evidence: list[Evidence]
    fingerprint: str
    queries: list[str]

    def crossing(self):
        return {k:ids for k,ids in self.groups.items() if len({self.samples[i].split for i in ids}) > 1}


def snapshot(run: Run) -> Snapshot:
    if run.status != "complete" or not run.result:
        raise ValueError("run_not_complete")
    g = Graph(run.result.graph_name)
    src = g.query("MATCH (d:DatasetRevision) RETURN d.dataset_id,d.revision_sha,d.config")
    expected = run.result.source
    if src != [[expected.dataset_id,expected.revision_sha,expected.config]]:
        raise ValueError("source_revision_mismatch")
    rows = g.query("MATCH (s:Sample) RETURN s.sample_id,s.split,s.row_index,s.text,s.label,s.raw_hash,s.text_hash ORDER BY s.sample_id")
    samples = {row[0]:Sample(**dict(zip(Sample.model_fields,row))) for row in rows}
    expected_ids = {i for c in run.result.components for i in c.sample_ids}
    if len(samples)!=len(rows) or set(samples)!=expected_ids or len(samples)!=run.result.analyzed_samples:
        raise ValueError("graph_scope_mismatch")
    evidence_rows = g.query("MATCH (a:Sample)-[:HAS_PAIR_EVIDENCE]->(e:PairEvidence)-[:CONCERNS]->(b:Sample) "
                           "RETURN e.pair_id,a.sample_id,b.sample_id,e.method,e.score,e.threshold,e.status,e.reason,e.version ORDER BY e.pair_id")
    evidence = [Evidence(**dict(zip(["pair_id","a","b","method","score","threshold","status","reason","version"],r))) for r in evidence_rows]
    if g.query("MATCH (e:PairEvidence) RETURN count(e)")[0][0]!=len(evidence):
        raise ValueError("graph_evidence_result_limit_or_orphan_evidence")
    accepted = {e.pair_id:e for e in evidence if e.status=="confirmed"}
    edges = g.query("MATCH (a:Sample)-[r:CONFIRMED_DUPLICATE_OF]->(b:Sample) "
                    "RETURN r.pair_id,a.sample_id,b.sample_id,r.method,r.score,r.threshold,r.version ORDER BY r.pair_id")
    if g.query("MATCH (:Sample)-[r:CONFIRMED_DUPLICATE_OF]->(:Sample) RETURN count(r)")[0][0]!=len(edges):
        raise ValueError("graph_edge_result_limit")
    for pair,a,b,method,score,threshold,version in edges:
        e = accepted.get(pair)
        if not e or (e.a,e.b,e.method,e.score,e.threshold,e.version)!=(a,b,method,score,threshold,version):
            raise ValueError("unbacked_accepted_edge")
        expected_threshold=1 if method=="exact_sha256" else run.request.threshold
        if threshold!=expected_threshold or not threshold<=score<=1:
            raise ValueError("accepted_edge_policy_mismatch")
    if len(edges)!=len(accepted):
        raise ValueError("missing_accepted_edge")
    grouped = defaultdict(list)
    wcc = g.query(WCC)
    if {r[0] for r in wcc}!=set(samples) or len(wcc)!=len(samples):
        raise ValueError("incomplete_wcc_scope")
    for id,split,cid in wcc:
        if samples[id].split!=split:
            raise ValueError("split_mismatch")
        grouped[cid].append(id)
    groups = dict(sorted((component_key(ids),sorted(ids)) for ids in grouped.values()))
    splits = g.query("MATCH (s:Split) RETURN s.name,s.total_count,s.analyzed_count ORDER BY s.name")
    if {r[0]:r[1] for r in splits}!=expected.splits:
        raise ValueError("split_metadata_mismatch")
    for split,total,count in splits:
        if sum(s.split==split for s in samples.values())!=count:
            raise ValueError("coverage_mismatch")
    fingerprint = sha({"source":src,"samples":[s.model_dump() for s in samples.values()],
                       "evidence":[e.model_dump() for e in evidence],"edges":edges,"groups":groups,"splits":splits})
    return Snapshot(samples,groups,evidence,fingerprint,g.queries)


def distributions(assignments, original=False):
    counts,labels = defaultdict(int),defaultdict(lambda:defaultdict(int))
    for a in assignments:
        counts[a.original_split]+=0
    for a in assignments:
        split = a.original_split if original else a.assigned_split
        if split is None:
            continue
        counts[split]+=1
        for label in label_tokens(a.label):
            labels[split][label]+=1
    return dict(sorted(counts.items())), {s:dict(sorted(labels[s].items())) for s in sorted(counts)}


def label_tokens(value):
    """Scalar class, or marginal class IDs from a JSON list of integer IDs."""
    if value in (None,"-1"):
        return []
    if value.startswith("["):
        try:
            labels=json.loads(value)
            if isinstance(labels,list) and all(type(v) is int and v>=0 for v in labels):
                return sorted({str(v) for v in labels})
        except ValueError:
            pass
    return [value]


def manifest_digest(plan):
    return sha({"schema":plan.schema_version,"analysis_id":plan.analysis_id,"plan_id":plan.plan_id,
                "request":plan.request.model_dump(),"graph_fingerprint":plan.graph_fingerprint,
                "assignments":[a.model_dump() for a in plan.assignments],
                "evidence_references":plan.evidence_references,"target_ratios":plan.target_ratios})
