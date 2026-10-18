# Leakline — Graph-Native Dataset Integrity Agent

Backend-first public text dataset audit for **Graph Hacks: Context for AI Agents**
Track 01 — Agents That Act on Connected Data (Oct 15–18, 2026). This checkpoint
implements deterministic source ingestion, evidence matching and real FalkorDB
connected components, graph-derived repair planning, independent verification and
approval-gated artifact downloads. Phase 3 adds a bounded OpenRouter agent with
real read-only FalkorDB MCP tools, persisted investigation traces, and evidence-
gated repair proposals. Phase 4 adds a responsive marketing site and a complete
local-first product workspace backed by those APIs. Semantic embeddings, hosted
authentication, and a shared run-history service are not implemented.

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

Visit http://localhost:3000 for the product site or http://localhost:3000/app for
the workspace. API docs: http://127.0.0.1:8000/docs. The web app proxies `/api/*`
and `/health/*` to `API_BASE_URL` (default `http://127.0.0.1:8000`).
FalkorDB uses localhost:6380 and its Browser uses http://localhost:3001.
Versions are pinned in uv.lock/package-lock.json and the database image digest.
Optional environment names are in `.env.example`; copy it to the gitignored root
`.env` and set `OPENROUTER_API_KEY` there for AI investigations. Python does not
automatically load `.env` files: start the API from `apps/api` with
`uv run --env-file ../../.env uvicorn leakline.main:app --app-dir . --host 127.0.0.1 --port 8000`
and configure `LEAKLINE_DATA` to the repository-level `data` directory. The
deterministic audit and repair engine needs no model API key. AI investigations
use the server-side OpenRouter setting; the verified model and live results are
listed in the Phase 3 verification record.

```powershell
uv run pytest -v
npm run typecheck
npm run build
```

## Web experience

The public site at `/` explains the dataset-integrity workflow and reads the
persisted GoEmotions example from the API when available. It does not substitute
example counts when the backend is unavailable. `Launch app` opens the workspace.

The workspace includes `/app` (overview and browser-local recent runs), `/app/new`
(inspect a public Hugging Face revision and configure an audit), and run-scoped
routes under `/app/runs/{run_id}` for overview, graph, evidence, investigation,
repair, verification, and exports. A separate `/app/audit-runs` view lists only
the run IDs saved in the current browser; there is no shared history endpoint.
Graph membership, evidence, agent traces, plan state, validation, approval, and
downloads all come from the existing backend contracts. AI investigation is
started only by the user and requires the server-side OpenRouter configuration.
See [frontend implementation](docs/frontend-implementation.md),
[frontend verification](docs/frontend-verification.md), and the
[frozen API handoff](docs/frontend-integration-contract.md).

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

## Graph and agent architecture

Each audit has a server-generated FalkorDB graph. `DatasetRevision` links through
`HAS_SPLIT` to `Split`, then `CONTAINS` to source-identified `Sample` nodes.
`PairEvidence` records matching method, threshold, score and decision reason;
accepted evidence is represented by `CONFIRMED_DUPLICATE_OF`, while review-only
edges never enter WCC. The server runs the installed FalkorDB algorithm
`algo.wcc()` on Sample/confirmed-duplicate edges. Python only groups the returned
component IDs for split-boundary analysis; production has no NetworkX fallback.
See [the tested Cypher, graph schema and matching rules](docs/algorithms.md).

The AI loop starts a run-bound read-only MCP stdio server (`mcp==1.26.0`),
discovers typed tools, and lets the OpenRouter model choose among bounded graph
investigation and deterministic repair-service actions. Graph reads use fixed
FalkorDB `GRAPH.RO_QUERY` templates. The model cannot submit arbitrary Cypher,
edit the graph or approve plans. SQLite retains the inspection trace; deterministic
WCC, repair validation and the human approval step remain authoritative.

## Real Phase 2 example

The fixed GoEmotions `simplified` audit at commit
`add492243ff905527e67aeb8b80c082af02207c3` inspected **1,500 rows each** from train,
validation and test (4,500 total; seed 42; near threshold .90). It found 7 accepted
edges in 5 non-singleton components: two train–test groups and one train–validation
group. This is a partial-scope result, not a statement about the whole dataset.
The pinned Hugging Face source card lists Apache-2.0 and describes the examples as
Reddit comments. Its privacy note warns that original usernames in the raw config
can sometimes identify people. Leakline uses the simplified config's selected
text/labels and source row index, not usernames or author metadata, but comment
text itself can still be identifying. Public availability or a card license is
not blanket permission for every downstream use. Raw text stays in the local
database; committed receipts and repair artifacts contain no sample text.
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
The backend audit, verified Track 01 mapping, graph architecture and frozen API
handoff are in [backend readiness](docs/backend-readiness-audit.md),
[Track 01 compliance](docs/track-01-compliance.md),
[FalkorDB architecture](docs/falkordb-architecture.md), and
[frontend integration contract](docs/frontend-integration-contract.md).

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
reproduce it first when its local graph is absent.
`uv run --env-file .env --project apps/api python scripts/live_agent_smoke.py`
executes a real provider call and saves a text-free receipt.
`uv run --env-file .env --project apps/api python scripts/evaluate_agent_baseline.py` runs a tool-free
baseline and compares measured completion and graph-tool activity. Both require
a running API and server-side OpenRouter credentials. See
[Phase 3 verification](docs/phase-3-verification.md) for the real tool trace,
baseline measurements, commands and remaining limitations.

Investigation routes are documented in [API documentation](docs/api.md).
Implementation and tests were created with OpenAI Codex assistance.
