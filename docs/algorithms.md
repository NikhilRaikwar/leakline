# Implemented database algorithms

Server: FalkorDB 6.0.2 (module 60002), image pinned by digest in compose.
The running server has executed the following query successfully. Integration tests
repeat it through the pinned Python client. No Python graph algorithm is used in production.

```cypher
CALL algo.wcc({nodeLabels: ['Sample'], relationshipTypes: ['CONFIRMED_DUPLICATE_OF']})
YIELD node, componentId
RETURN node.sample_id, node.split, componentId
```

The server computes connectivity; Python only groups the returned IDs, creates
canonical SHA-256 keys from sorted sample IDs, and checks configured split roles.
It persists Component/IN_COMPONENT snapshots before reading findings back:

```cypher
MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component)
WHERE c.crosses_boundary = true
RETURN c.component_key, collect(s.sample_id), collect(DISTINCT s.split)
ORDER BY c.component_key
```

All parameterized ingestion, evidence, component materialization and findings
queries are in `apps/api/leakline/graph.py`. A completed run returns the actual
executed query strings. Graph names are server-generated, one graph per audit.
`DatasetRevision → HAS_SPLIT → Split → CONTAINS → Sample` retains source identity.
Samples retain source text, label, row index, raw and strict-normalized hashes.
`PairEvidence` links both endpoints; accepted direct edges alone participate in WCC.
Review edges use `POSSIBLY_SIMILAR_TO` and are excluded.

Strict normalization applies Unicode NFKC and collapses whitespace, preserving
case, punctuation, numbers and negation. Exact hashes create confirmed edges even
with conflicting labels (the conflict is in the reason). MinHash uses 128
permutations, seed 42, character-5 shingles and LSH threshold .75 for candidate
discovery. A candidate is confirmed only by actual set Jaccard >= .90 (default),
40 characters and 20 distinct shingles, with equal labels and negation signatures.
Label or negation mismatches remain review-only. MinHash recall is approximate;
no claim of exhaustive near-duplicate detection is made.

Source documentation: [FalkorDB WCC](https://docs.falkordb.com/algorithms/wcc),
[HF revision loading](https://huggingface.co/docs/datasets/en/loading).

## Phase 2: fresh verification and evidence paths

`snapshot.py` runs the same real `algo.wcc` query on every planning and independent
verification request. It reads source, Sample, Split, PairEvidence and confirmed
edge properties afresh and rejects scope mismatches, orphan evidence, truncated
database result sets or edge-policy mismatches. Grouping returned component IDs
is not a local connectivity algorithm. `validator.py` checks assignments against
these returned groups and repeats the snapshot read to detect concurrent change.
No NetworkX or other Python connected-component implementation is used in production.

The following bounded path query is tested on the installed server, including a
three-node transitive fixture with two actual returned evidence IDs:

```cypher
MATCH p=(a:Sample {sample_id:$source})
  -[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target})
RETURN [n IN nodes(p) | n.sample_id], [r IN relationships(p) | r.pair_id]
LIMIT 1
```

Only the returned path is displayed. An eight-hop display limit does not limit WCC
computation or imply that longer components are disconnected. WCC and path queries
have been exercised by real FalkorDB integration tests, not inferred from syntax.

Policy B uses deterministic, bounded component assignment, not a second graph
algorithm: 16 seed-derived attempts reserve components for required class coverage,
then greedily balance squared size and marginal-label errors. Hard fraction/count
constraints are independently checked. A heuristic failure is reported as no
feasible assignment found, rather than an unsupported proof of mathematical
infeasibility. Full semantics: [API contract](api.md).
