# Phase 1 verification receipt

Stopped at Phase 1. No agent/MCP, repair engine, model evaluation, report exports
or landing page is claimed to work.

## Executed checks

- `uv run python scripts/check_falkordb_capabilities.py`: PASS against module 60002.
  Filtered server-side WCC returned A/B/C together and isolated D separately.
- `uv run pytest -v --junitxml=docs/test-results.xml`: **15 passed, 1 warning in
  108.22 seconds**; zero failures, errors or skipped tests. The warning is a
  Starlette test-client AnyIO deprecation. Raw JUnit receipt: `test-results.xml`.
- `npm run typecheck`: PASS.
- `npm run build`: PASS (Next.js production build).
- Real browser: inspect source → Start Audit → observed pipeline states → completed
  400-row audit → raw findings. Reload restored the same completed run from its
  persisted ID. At 320px viewport, document width did not exceed viewport width.
- `uv run python scripts/smoke_api.py`: two successful live HTTP audits; no fixtures
  or mocked services. Text-free receipts and exact source commits: `live-audits.json`.

| Public dataset | Audited train / test rows | Accepted edges | Components | Cross-boundary findings |
| --- | --- | --- | --- | --- |
| cornell-movie-review-data/rotten_tomatoes | 200 / 200 | 0 | 400 | 0 |
| stanfordnlp/sst2 | 200 / 200 | 1 | 399 | 0 |

These are partial-scope results, not assertions that either complete dataset is
clean. Validation rows were not audited in these runs. Source cards reported an
unknown license; no source text is included in committed receipts. These two
audits predate the component-write batching optimization; the final integration
suite above verifies the optimized path through FastAPI and FalkorDB.

Direct FalkorDB inspection of the SST-2 accepted edge returned training row indices
56985 and 28785, method `minhash_jaccard`, score `0.962025316455696`, and unequal
normalized hashes. This is a real verified near-duplicate edge, not an exact-hash
match or a train–test crossing. The executed inspection query was:

```cypher
MATCH (a:Sample)-[r:CONFIRMED_DUPLICATE_OF]->(b:Sample)
RETURN a.split,b.split,a.row_index,b.row_index,r.method,r.score,a.text_hash=b.text_hash
```

## Evidence covered by tests

Real public metadata, resolved commit, pinned row ingestion, source indices,
database sample counts, independent test-only connectivity oracle, verified pair
scores, normalization, conflicting-label/negation quarantine, clean and empty
findings, transitive A—B—C plus singleton, ignored review edges, deterministic
component keys on repeated execution, original row reread equality after analysis,
SSRF-style input rejection and failure when the real database is unreachable.

## Remaining limitations

- Local single-user service; no authentication, hosted tenant controls or durable
  distributed queue. Use one API worker, bound to loopback.
- Interrupted work is marked honestly and requires a new run; no resume/cancel UI.
- Network byte budgets, total ingestion deadline and graph retention are not
  implemented. Streaming to seeded row indices can read much more than the audit cap.
- MinHash candidate recall is approximate. Default .90 shingle Jaccard is a stated
  detector policy, not proof of memorization or universal duplicate equivalence.
- Only public static text datasets with known split metadata are supported.
  License terms need source-specific review, particularly when the card is unknown.
- UI intentionally shows raw findings and provenance. Advanced graph inspection,
  review, agent actions, repairs and presentation work remain for subsequent phases.

Exact Cypher and matching policy: `algorithms.md`; implementation: `apps/api/leakline/graph.py`.
