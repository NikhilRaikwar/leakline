"""Run from root: uv run -- python scripts/check_falkordb_capabilities.py."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"apps"/"api"))
import uuid
from leakline.graph import Graph,WCC

g=Graph("leakline_probe_"+uuid.uuid4().hex)
try:
    g.query("CREATE (a:Sample {sample_id:'a'}), (b:Sample {sample_id:'b'}), (c:Sample {sample_id:'c'}), (d:Sample {sample_id:'d'}), (a)-[:CONFIRMED_DUPLICATE_OF]->(b), (b)-[:CONFIRMED_DUPLICATE_OF]->(c)")
    rows=g.query(WCC)
    groups={}
    for id,split,component in rows:
        groups.setdefault(component,[]).append(id)
    assert sorted(sorted(ids) for ids in groups.values())==[['a','b','c'],['d']],rows
    print("PASS: real FalkorDB filtered algo.wcc; transitive component + isolated singleton",rows)
finally:
    g.graph.delete()
