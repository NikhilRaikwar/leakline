# Leakline API — Phases 1 and 2

Live OpenAPI schemas: `GET /openapi.json`, interactive documentation: `/docs`.
Local single-user deployment only, one API worker, all services bound to loopback.
No external model keys are required or exposed.

## Audits (Phase 1 preserved)

`POST /api/v1/datasets/inspect` accepts `dataset` (canonical HF URL or owner/name),
optional `config`, and `revision` (default `main`). It returns a resolved commit SHA,
actual full-source split sizes, available configs, feature columns and license.
No dataset remote code is permitted.

`POST /api/v1/runs` adds `text_column`, nullable `label_column`, `train_splits`,
`evaluation_splits`, `limit_per_split` (1–2000), `seed` and `threshold` (default .90).
It returns 202 with a generated `analysis_id`. All selected splits are sampled;
splits are the deduplicated union of the requested training/evaluation split lists.
The default 200 rows from train plus 200 from test explains the old 400-row runs.
To audit validation too, explicitly include it in `evaluation_splits`; the UI now
selects validation and test when those actual split names exist.

`GET /api/v1/runs/{id}` returns persisted status, request, events and typed results:
source revision, full-source sizes, per-split `inspected_counts` and `coverage`,
actual sample/edge counts, database-derived components and pair evidence.
`findings` preserves the configured train-versus-evaluation meaning;
`cross_split_components` additionally lists every component spanning original splits.
Unselected source splits have inspected count zero and coverage zero. Older saved
Phase 1 results remain readable; their counts can be reconstructed from coverage.

`GET /api/v1/runs/{id}/findings` returns the Phase 1 findings snapshot, or 409 if
the audit is incomplete. Audit states: queued, ingesting, matching, graph, complete,
failed, interrupted. Restart marks unfinished jobs interrupted; it does not invent
completed results. GETs recover completed runs without rerunning ingestion.

## Evidence inspection

`GET /api/v1/runs/{id}/components/{component_key}` re-queries actual FalkorDB WCC,
samples and evidence; stale/incorrect keys return 404. Optional `source_id` and
`target_id` must belong to that component (422 otherwise). `limit` is 2–150,
default 50. Excerpts are capped at 2,000 characters per row and evidence at 500
displayed records. `truncated` and total member count disclose partial rendering.
The path is queried from FalkorDB over confirmed edges, at most eight hops.
No bounded path displayed does not mean the WCC members are disconnected.

## Create a repair plan

`POST /api/v1/runs/{id}/repair-plans` returns 201 and a typed `RepairPlan`.

```json
{
  "policy": "preserve_test",
  "protected_splits": ["test"],
  "seed": 42,
  "target_ratios": null,
  "size_tolerance": 0.15,
  "min_rows_per_split": 1,
  "require_all_labels_in_each_split": false
}
```

Policy A (`preserve_test`) keeps every inspected protected evaluation assignment.
Every other inspected row in a component containing protected rows is quarantined
with `assigned_split: null`. This includes validation rows when they overlap test.
Unrelated rows stay in their original split. The checked boundary is the union of
protected splits versus all other retained rows. It does **not** assert separation
between two protected splits or between two unprotected splits. Residual overlaps
are reported explicitly. Training must retain the observed classes and at least
`min_rows_per_split` rows per original training split.

Policy B (`alternative_split`) assigns all rows of each confirmed WCC to one
originally inspected partition, never dropping rows. `target_ratios` must name
every inspected split exactly with positive fractions summing to one. Blank/null
uses proportions of inspected rows, not unknowable full-corpus outcomes.
`size_tolerance` bounds absolute partition-fraction error (e.g. target .20 and
tolerance .05 allow .15–.25). The planner uses 16 deterministic greedy attempts
derived from `seed`, reserving whole components for required class coverage and
balancing squared size and marginal label errors. It is a bounded heuristic,
not a guarantee of globally optimal stratification. Exact impossible constraints
and inability to find a feasible allocation produce clear failed plans. Conflicting
label sets in an accepted component require review; no label is overwritten.
Every observed class must remain in training; the optional flag requires all
classes in every resulting partition. Multilabel integer arrays use marginal
per-class counts, so label counts can sum to more than the row count.

Plans contain one assignment per inspected stable sample ID (original split,
row index, proposed split, label, component key, reason), evidence references,
original/proposed split and label counts, movements, quarantine counts, warnings,
graph fingerprint and manifest checksum. Source rows and original graph Sample
properties are never edited by repair. Maximum 20 plans per run.

## Explicit transitions

- `draft` → `validated` only through independent verification.
- `validated` → `approved` only through an explicit approval request and another
  independent verification. Changing form inputs never modifies an existing plan.
- No supported conflict → `not_applicable`; no pretend repair or downloadable success.
- Unsafe assignment, stale graph, lost classes or infeasible constraints → `failed`.
- Database unavailable during validation → `incomplete`; no export.

`GET /api/v1/runs/{id}/repair-plans` lists persisted plans (latest first).
`GET /api/v1/runs/{id}/repair-plans/{plan_id}` returns a specific plan.
SQLite durably stores immutable assignment manifests and transition records.
FalkorDB also records `AnalysisRun-[:PROPOSES]->RepairPlan-[:AFFECTS]->Component`
decision receipts with status, policy, checksum and approval timestamp.
Graph receipts must succeed before successful transitions are saved. Incomplete
outage reports are still persisted locally when the graph cannot be written.

`POST .../{plan_id}/validate` re-reads source identity, every scoped sample,
confirmed edge/evidence consistency, split metadata and actual database WCC.
It checks schema, exact eligible-row coverage, uniqueness, immutable source fields,
partition rules, reported counts, class representation, references, manifest digest
and graph fingerprint. It reads the graph again at the end to reject a mixed
verification snapshot. It never trusts the planner's connectivity or success flag.
Validation status is one of verified/incomplete/not_applicable/failed. `verified`
always carries an explicit scope and boundary; partial coverage is never described
as full-dataset cleanliness. The persisted approved receipt stays immutable on
successful rechecks; any later failed check revokes approval and blocks exports.

`POST .../{plan_id}/approve` requires:

```json
{"approve": true, "manifest_sha256": "<exact reviewed plan checksum>"}
```

Missing/false approval returns 422, missing prior validation or a mismatched
checksum returns 409. Approval is consent to a new manifest, never a source edit.
Repeated approval is idempotent if the source graph still verifies unchanged.

## Four controlled downloads

`GET .../{plan_id}/artifacts` lists filename, byte size, SHA-256 and download URL.
`GET .../{plan_id}/artifacts/{filename}` serves only these fixed names:

- `repair-manifest.json`: all assignments, source identity, policy, seed, graph
  fingerprint, reviewed checksum, evidence references and approval metadata.
- `split-assignments.csv`: all inspected IDs, original indices/splits, proposed
  assignments, labels, component keys and reasons. Empty target means quarantine.
  Cells beginning with spreadsheet formula characters are prefixed with an
  apostrophe; JSON preserves the authoritative exact strings.
- `validation-report.json`: actual independent checks, before/after protected
  crossings, remaining other overlaps, scope and executed Cypher.
- `audit-provenance.json`: actual source ID/config/commit/license, full split sizes,
  inspected counts/coverage, thresholds, seeds, evidence and detector versions.

Every listing/download requires an approved plan and re-runs independent graph
validation. Stale or revoked plans return 409. No client paths or arbitrary filenames
are accepted; invalid names return 422. Files are built in memory, contain no raw
sample text, and have a default combined 16 MiB cap (`MAX_REPAIR_ARTIFACT_BYTES`).
This is a manifest export, not an uploaded or rewritten Hugging Face dataset.

Unknown run/plan IDs or a plan requested under another run return 404. Source
inspection errors use 422/502, incomplete audits 409, graph outages 503, quota
limits 429 and oversized artifacts 413. The local app is not authenticated for
public hosting. Full ingestion byte/deadline controls and distributed transactions
against out-of-band database edits are not implemented.

## AI investigations

These routes are available only for completed runs:

- `POST /api/v1/runs/{run_id}/investigations` accepts `{"goal":"..."}` and
  returns 202 with `investigation_id` and `status: queued`.
- `GET /api/v1/runs/{run_id}/investigations/{investigation_id}` returns current
  state, activity, typed conclusion, repair proposal reference and usage totals.
- `GET .../{investigation_id}/events` returns persisted status and tool events.
- `GET .../{investigation_id}/trace` returns actual provider calls, validated MCP
  arguments, text-free bounded evidence previews, result digests, timings, errors
  and approval state.

Poll the status endpoint while queued/running. Invalid run/investigation pairings
return 404. Per-run and active queue limits return 429. OpenRouter missing/failure,
MCP errors, timeouts and step exhaustion produce explicit failed/incomplete
statuses and never a fabricated decision. Trace summaries exclude dataset text.
The server does not expose a tool to approve a repair; approval remains the
existing explicit human API action. All graph reads are run-bound and use a small
allowlist of parameterized query templates over `GRAPH.RO_QUERY`.

The validated live configuration is `OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash`
with provider tool calling. Credentials stay in the API process; for a root `.env`
file, start the server from `apps/api` with
`uv run --env-file ../../.env uvicorn leakline.main:app --host 127.0.0.1 --port 8000`
and set `LEAKLINE_DATA` to the repository data directory. The default action
budget is 16 calls, request deadline 120 seconds, and MCP list cap 100 rows;
environment overrides are clamped by the backend. Missing provider settings are
an explicit failure, not a deterministic or mocked success. The live model,
MCP, baseline, browser and validation evidence is recorded in
[`docs/phase-3-verification.md`](phase-3-verification.md).

The agent starts an app-specific MCP server over stdio using the pinned maintained
Python SDK. It is a real MCP protocol integration (initialize handshake, discovery,
and tool invocations), with FalkorDB-specific fixed read queries and no model
write tool; it does not shell out to the separate upstream Rust server. References:
[MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) and
[FalkorDB MCP](https://github.com/FalkorDB/falkordb-mcp).
