# Leakline — Phase 1

Backend-first public text dataset audit for Graph Hacks Track 01. This checkpoint
implements deterministic source ingestion, evidence matching and real FalkorDB
connected components. The only web surface is `/app`. Agent/MCP, repairs,
evaluation, exports and a full landing page belong to later phases and are absent.

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
No model API key is needed for deterministic Phase 1.

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
and 100,000 evidence pairs. Streaming may read a large portion of a source to reach selected
indices; the row cap bounds analysis size, not network bytes. Large datasets should
be avoided in this local MVP. Public availability does not grant redistribution rights.
Raw samples are stored locally in FalkorDB; no public text export is implemented.

This is a **local single-user** app: bind API/web/database to loopback. No hosted
authentication or tenant authorization is implemented. One API worker only; SQLite
persists statuses, not graph computations. Restart marks unfinished runs interrupted;
there is no automatic job resume. Failed or partial audits never report clean.
Graph connection failure has no fallback to NetworkX. Queueing and read-timeout
limits exist; cancellation, global download budgets and graph retention controls
remain future work. Similarity is evidence under a policy, not proof of memorization.

See [database queries and matching policy](docs/algorithms.md).
Implementation and tests were created with OpenAI Codex assistance.
