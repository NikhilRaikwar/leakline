import hashlib
import os
from collections import defaultdict
from falkordb import FalkorDB
from .models import Component

WCC = """CALL algo.wcc({nodeLabels: ['Sample'], relationshipTypes: ['CONFIRMED_DUPLICATE_OF']})
YIELD node, componentId
RETURN node.sample_id, node.split, componentId"""
FINDINGS = """MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component)
WHERE c.crosses_boundary = true
RETURN c.component_key, collect(s.sample_id), collect(DISTINCT s.split)
ORDER BY c.component_key"""
SAMPLES = """UNWIND $rows AS row MATCH (sp:Split {name: row.split})
MERGE (s:Sample {sample_id: row.sample_id})
SET s.split=row.split, s.row_index=row.row_index, s.text=row.text,
s.label=row.label, s.raw_hash=row.raw_hash, s.text_hash=row.text_hash
MERGE (sp)-[:CONTAINS]->(s)"""
EVIDENCE = """UNWIND $rows AS row
MATCH (a:Sample {sample_id: row.a}), (b:Sample {sample_id: row.b})
MERGE (e:PairEvidence {pair_id: row.pair_id})
SET e.method=row.method, e.score=row.score, e.threshold=row.threshold,
e.status=row.status, e.reason=row.reason, e.version=row.version
MERGE (a)-[:HAS_PAIR_EVIDENCE]->(e) MERGE (e)-[:CONCERNS]->(b)"""


class Graph:
    def __init__(self, name):
        self.db = FalkorDB(host=os.getenv("FALKORDB_HOST", "localhost"),
                          port=int(os.getenv("FALKORDB_PORT", "6380")),
                          password=os.getenv("FALKORDB_PASSWORD") or None,
                          socket_timeout=60, socket_connect_timeout=5)
        self.graph = self.db.select_graph(name)
        self.queries = []

    def query(self, query, params=None):
        result = self.graph.query(query, params or {})
        self.queries.append(query)
        return result.result_set

    def store(self, source, samples, evidence):
        self.query("CREATE (d:DatasetRevision {dataset_id:$id, revision_sha:$sha, config:$config, license:$license})",
                   {"id": source.dataset_id, "sha": source.revision_sha, "config": source.config, "license": source.license})
        for split, total in source.splits.items():
            self.query("MATCH (d:DatasetRevision) CREATE (d)-[:HAS_SPLIT]->(s:Split {name:$name, total_count:$total, analyzed_count:$count})",
                       {"name":split,"total":total,"count":sum(s.split == split for s in samples)})
        for start in range(0,len(samples),200):
            self.query(SAMPLES, {"rows":[s.model_dump() for s in samples[start:start+200]]})
        for start in range(0,len(evidence),200):
            batch = [e.model_dump() for e in evidence[start:start+200]]
            self.query(EVIDENCE, {"rows":batch})
            for status, relation in [("confirmed", "CONFIRMED_DUPLICATE_OF"), ("needs_review", "POSSIBLY_SIMILAR_TO")]:
                rows = [e for e in batch if e["status"] == status]
                if rows:
                    self.query("UNWIND $rows AS row MATCH (a:Sample {sample_id:row.a}), (b:Sample {sample_id:row.b}) "
                               f"MERGE (a)-[r:{relation} {{pair_id:row.pair_id}}]->(b) "
                               "SET r.method=row.method, r.score=row.score, r.threshold=row.threshold, r.version=row.version",
                               {"rows":rows})

    def components(self, train, evaluation):
        rows = self.query(WCC)
        groups = defaultdict(list)
        for sample_id, split, component_id in rows:
            groups[component_id].append((sample_id,split))
        components = []
        for members in groups.values():
            ids = sorted(m[0] for m in members)
            splits = sorted(set(m[1] for m in members))
            key = hashlib.sha256("|".join(ids).encode()).hexdigest()
            crosses = bool(set(splits) & set(train) and set(splits) & set(evaluation))
            component = Component(component_key=key,sample_ids=ids,splits=splits,crosses_boundary=crosses)
            components.append(component)
            self.query("CREATE (c:Component {component_key:$key, size:$size, crosses_boundary:$crosses, algorithm:'algo.wcc'})",
                       {"key":key,"size":len(ids),"crosses":crosses})
            self.query("UNWIND $ids AS id MATCH (s:Sample {sample_id:id}), (c:Component {component_key:$key}) MERGE (s)-[:IN_COMPONENT]->(c)",
                       {"ids":ids,"key":key})
        # Findings are read back from the materialized database, never guessed from text.
        findings = [Component(component_key=k,sample_ids=sorted(ids),splits=sorted(splits),crosses_boundary=True)
                    for k,ids,splits in self.query(FINDINGS)]
        return sorted(components,key=lambda c:c.component_key), findings
