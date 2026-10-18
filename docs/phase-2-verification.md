# Phase 2 verification

Recorded 2026-10-18 (Asia/Calcutta). This checkpoint completes the local Phase 2
repair and verification loop on the FalkorDB 6.0.2 deployment. The exact tool
versions are pinned in `uv.lock` and `package-lock.json`.

## Results

- Python integration suite: **29 passed, 0 failed, 0 skipped** (pytest JUnit receipt: [`phase-2-test-results.xml`](phase-2-test-results.xml); 333 seconds). One upstream Starlette/AnyIO deprecation warning was reported. The suite includes real public Hugging Face ingestion and FalkorDB WCC, API repair transitions, artifacts, restart recovery, and deterministic synthetic graph cases. The public ingestion test and live API test both use real services; synthetic rows are test-only.
- Frontend TypeScript check: `npm run typecheck` passed.
- Production frontend build: `npm run build` passed; `/app` is statically generated.
- Browser smoke: the existing real run was opened at `/app?run=300f5981-b6f2-4c01-b3e8-8b772063b455`. A graph finding was opened to inspect real sample excerpts, pair evidence, and a bounded FalkorDB path. Policy A created a plan, fresh validation returned `verified`, explicit approval succeeded, and the UI showed the four downloadable artifacts.
- The recorded GoEmotions run is reproducible by `uv run python scripts/reproduce_real_audit.py`. Its receipt compares pinned revision, coverage, split counts, crossing component membership and accepted evidence against the actual recorded run. The receipt omits raw sample text.

## Real audit scope and result

Source: `google-research-datasets/go_emotions`, `simplified`, Apache-2.0 card,
revision `add492243ff905527e67aeb8b80c082af02207c3`. Full source sizes were
train 43,410, validation 5,426 and test 5,427. The seeded audit inspected 1,500
rows in each split (4,500 total, seed 42), with the existing 0.90 verified
near-duplicate threshold. This is 3.46% of train, 27.64% of validation and
27.64% of test. It found 7 accepted relationships and 5 non-singleton WCC groups;
3 groups crossed a split boundary (2 train/test, 1 train/validation). Finding
component keys and the exact request are in [`real-analysis-report.json`](real-analysis-report.json).

Policy A protected test unchanged and quarantined 2 inspected training rows from
test-overlapping components. Independent validation re-ran WCC from FalkorDB and
verified the proposal. One train/validation crossing remained and is explicitly
reported because it does not touch the protected test split. The source dataset
was read only. This repair makes no assertion about uninspected rows or all
possible leakage.

## FalkorDB checks

The connected-component query is `CALL algo.wcc({nodeLabels: ['Sample'],
relationshipTypes: ['CONFIRMED_DUPLICATE_OF']}) YIELD node, componentId RETURN
node.sample_id, node.split, componentId`. This is run against the installed
FalkorDB algorithm; no local graph algorithm fallback is used. Validation takes
a fresh snapshot and executes WCC independently from planning. It checks the
database-derived component fingerprint before and after its checks, then tests
whether assignments leave a component crossing the protected boundary.

The graph schema, evidence acceptance rules, paths and repair queries are
documented in [`graph-schema.md`](graph-schema.md) and [`algorithms.md`](algorithms.md).
The full API contract, policy semantics, transitions, resource caps and artifact
allowlist are in [`api.md`](api.md).

## Remaining limits

- The sample caps mean the real audit is partial and cannot establish a clean full dataset.
- MinHash is a candidate generator; similar pairs not retrieved by it are outside the measured evidence.
- Policy B uses a deterministic seeded greedy component assignment with label and size constraints. It can reject a feasible assignment if its bounded search cannot find one; it does not claim a general optimal solution.
- The app is a local, single-user service. Repair payloads persist in local SQLite and graph receipts in FalkorDB. Artifact bytes are generated from persisted plan state on request and capped at 16 MiB.
- Raw source text exists in the local graph for inspection. The committed real report and downloadable repair artifacts contain identifiers/evidence references rather than sample text.
