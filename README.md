# Leakline — Graph-Native Dataset Integrity Agent

Backend-first public text dataset audit for Graph Hacks Track 01. This checkpoint
implements deterministic source ingestion, evidence matching and real FalkorDB
connected components, graph-derived repair planning, independent verification and
approval-gated artifact downloads. Phase 3 adds a bounded OpenRouter agent with
real read-only FalkorDB MCP tools, persisted investigation traces, and evidence-
gated repair proposals. The web surface remains `/app`; semantic embeddings and
a full marketing landing page are not implemented.

## Run locally

Requirements: Docker Desktop, Python 3.13 + uv, Node.js >=20.9 + npm.

```powershell
docker compose up -d
uv sync --locked
uv run python scripts/check_falkordb_capabilities.py
uv run uvicorn leakline.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
# another terminal
npm ci
npm run dev
```

Visit http://localhost:3000/app. API docs: http://127.0.0.1:8000/docs.
FalkorDB uses localhost:6380 and its Browser uses http://localhost:3001.
Versions are pinned in uv.lock/package-lock.json and the database image digest.
Optional environment names are in `.env.example`; configure shell environment
or `.env.local` for Next.js. Python does not automatically load `.env` files.
The deterministic audit and repair engine needs no model API key. AI investigations
require the server-side OpenRouter settings described below.

```powershell
uv run pytest -v
npm run typecheck
npm run build
```

Tests require the actual database and public Hugging Face connectivity. They do
not silently skip unavailable services. Synthetic graph fixtures exist only under
tests, explicitly separated from live public-data tests. Tests delete only their
own randomly named graphs. Live API tests retain their audit graph and local run.

## API

- `GET /health/ready`: real Redis connection check.
- `POST /api/v1/datasets/inspect`: `{ "dataset": "owner/name", "config": null, "revision": "main" }`.
  Returns resolved commit SHA, configs, real split sizes, feature schema and card license.
- `POST /api/v1/runs`: same source fields plus `text_column`, optional
  `label_column`, `train_splits`, `evaluation_splits`, `limit_per_split` (1–2000),
  `seed`, `threshold`. Use the inspected commit as `revision` for reproducibility.
  Returns 202 immediately; one worker processes at most three queued/active audits.
- `GET /api/v1/runs/{id}`: persisted typed status, events, provenance, coverage,
  graph components, pair evidence, executed queries and raw findings.
- `GET /api/v1/runs/{id}/findings`: complete findings, or 409 before completion.
- `GET /api/v1/runs/{id}/components/{component_key}`: original excerpts, row IDs,
  evidence and an actual bounded FalkorDB path.
- `POST /api/v1/runs/{id}/repair-plans`: draft using fresh database WCC.
- `GET /api/v1/runs/{id}/repair-plans`: reload persisted plans.
- `GET /api/v1/runs/{id}/repair-plans/{plan_id}`: inspect assignments and warnings.
- `POST .../{plan_id}/validate`: independent graph and assignment verification.
- `POST .../{plan_id}/approve`: prior successful validation and explicit
  `{ "approve": true, "manifest_sha256": "<reviewed checksum>" }`; verifies again.
- `GET .../{plan_id}/artifacts`: four files with byte sizes and SHA-256 hashes.
- `GET .../{plan_id}/artifacts/{filename}`: controlled, approval-gated download.

Full contracts, policy semantics and transitions: [API documentation](docs/api.md).

## Real Phase 2 example

The fixed GoEmotions `simplified` audit at commit
`add492243ff905527e67aeb8b80c082af02207c3` inspected **1,500 rows each** from train,
validation and test (4,500 total; seed 42; near threshold .90). It found 7 accepted
edges in 5 non-singleton components: two train–test groups and one train–validation
group. This is a partial-scope result, not a statement about the whole dataset.
The source card lists Apache-2.0; only text-free evidence/provenance is committed.
GoEmotions has multilabel class IDs: class counts are marginal per-class counts,
not the number of unique label combinations. Source usernames are not imported.

Reproduce this audit with `uv run python scripts/find_real_audit.py`.
It records a new server-generated run ID and measured report. Inspect the local
recorded run at `/app?run=300f5981-b6f2-4c01-b3e8-8b772063b455` on this machine;
fresh checkouts must reproduce the audit because raw graphs are not committed.
Select Policy A, create a plan, run independent verification, review the changes,
explicitly approve and load the four downloads. The test-preserving plan quarantines
two inspected train rows. One train–validation component remains disclosed outside
the protected test boundary. Alternative splitting can refuse conflicting label
sets rather than silently resolve annotations.

The [measured analysis](docs/real-analysis-report.json),
[search receipts](docs/dataset-search.json) and
[verification report](docs/phase-2-verification.md) document the evidence.

Examples of source inputs (no pre-written outcome):
`cornell-movie-review-data/rotten_tomatoes` (card license unknown),
`stanfordnlp/sst2` (check source license and label semantics). The source and
all of its split assignments are read-only. Every row is identified by repo,
commit, config, split and original index, separately from its text hash.

## Scope and operating limits

Metadata is inspected at a resolved commit, then rows are streamed from that exact
commit with remote dataset code disabled and anonymous access (`token=False`).
Only public, ungated datasets with actual split counts and string text are supported.
Per-split seeded index sampling records original row IDs; coverage of unselected
splits is zero. Runs allow at most 5,000 analyzed rows, 100,000 characters per row,
100,000 evidence pairs and 10 million total analyzed characters. Streaming may read a large portion of a source to reach selected
indices; the row cap bounds analysis size, not network bytes. Large datasets should
be avoided in this local MVP. Public availability does not grant redistribution rights.
Raw samples are stored locally in FalkorDB. Repair downloads reference source row
IDs and hashes and do not contain full sample text. The original remains read-only.

This is a **local single-user** app: bind API/web/database to loopback. No hosted
authentication or tenant authorization is implemented. One API worker only; SQLite
persists statuses, not graph computations. Restart marks unfinished runs interrupted;
there is no automatic job resume. Failed or partial audits never report clean.
Graph connection failure has no fallback to NetworkX. Queueing and read-timeout
limits exist; cancellation, global download budgets and graph retention controls
remain future work. Similarity is evidence under a policy, not proof of memorization.

See [database queries and matching policy](docs/algorithms.md).

## AI investigations (Phase 3)

Completed runs expose a bounded, server-side OpenRouter tool-calling investigator.
Set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (a tool-calling model), and the
`AGENT_*` limits from `.env.example`. It launches a run-bound MCP subprocess using
the pinned Python MCP SDK (`mcp==1.26.0`). Its graph tools execute fixed queries
through FalkorDB `GRAPH.RO_QUERY`; arbitrary Cypher and approval are unavailable.
Repair proposals and validation delegate to the existing deterministic API.
The agent trace is stored in SQLite and contains tool names, validated arguments,
bounded summaries, digests, evidence references, timings, provider usage and the
human approval state. Raw sample text is excluded from model context and traces.
This is a protocol-compatible, app-specific server built on the maintained
[Model Context Protocol Python SDK](https://github.com/modelcontextprotocol/python-sdk),
with read-only query behavior aligned to the
[FalkorDB MCP integration](https://github.com/FalkorDB/falkordb-mcp).

Use **Investigate with AI** on a completed audit. The default run for a local live
smoke is the recorded GoEmotions analysis `300f5981-b6f2-4c01-b3e8-8b772063b455`;
reproduce it first when its local graph is absent. `uv run python
scripts/live_agent_smoke.py` executes a real provider call and saves a text-free
receipt. `uv run python scripts/evaluate_agent_baseline.py` runs a tool-free
baseline and compares measured completion and graph-tool activity. Both require
a running API and server-side OpenRouter credentials. See
[Phase 3 verification](docs/phase-3-verification.md) for executed checks and
remaining acceptance gaps.

Investigation routes are documented in [API documentation](docs/api.md).
Implementation and tests were created with OpenAI Codex assistance.
