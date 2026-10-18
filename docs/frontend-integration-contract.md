# Frontend integration contract (implemented backend)

This describes the API currently implemented at `/api/v1`; it does not propose routes or promise frontend behavior that is absent. Local single-user only: there is no authentication or tenant identity. Keep API credentials server-side. The Next.js proxy forwards `/api/*` to `API_BASE_URL` (default `http://127.0.0.1:8000`). OpenAPI is available at `/openapi.json` and Swagger UI at `/docs`.

IDs and values below are illustrative; no sample text is included. Pydantic/OpenAPI is authoritative for fields. Common error body is FastAPI JSON `{"detail":"..."}` (some verification/duplicate-state details use structured objects).

## Routes

| Method / route | Request | Response / behavior | Errors, empty/partial, retries and transitions |
|---|---|---|---|
| `GET /health/ready` | none | `{"status":"ready","database":"FalkorDB"}` only after a real database ping | 503 `graph_unavailable`; safe to poll as readiness. |
| `POST /api/v1/datasets/inspect` | `InspectRequest`: `dataset` (HF owner/name or canonical `https://huggingface.co/datasets/owner/name`), optional `config`, `revision` default `main` | `Source`: `{dataset_id,revision_sha,config,configs,splits,columns,license}`; revision is resolved commit SHA and split sizes come from source metadata | 422 invalid/private/gated/unsupported source or config; 502 source unavailable. Retry transient 502 manually. No job is created. |
| `POST /api/v1/runs` | `AuditRequest`: Inspect fields plus `text_column`, nullable `label_column`, `train_splits`, `evaluation_splits`, `limit_per_split` 1–2000, `seed`, `threshold` .8–1 | 202 typed `Run` with UUID `analysis_id` and `status:"queued"`; one worker streams rows and persists status | 422 invalid split/schema/budget; 429 queue at 3 active/queued. Do not blindly retry POST: it creates a new run. Poll GET every ~1.5s. Statuses: queued/ingesting/matching/graph/complete/failed/interrupted. A failure/interruption is not a clean audit. |
| `GET /api/v1/runs/{run_id}` | UUID path | Typed `Run`; completed result has source revision, full source split sizes, per-split `inspected_counts` and `coverage`, edges/evidence, WCC components, findings, actual query strings and scope note | 404 unknown ID. Partial coverage is normal and explicit; unselected splits have zero coverage. Poll while status is active. On restart active audits become interrupted; retrieve completed runs without rerunning. |
| `GET /api/v1/runs/{run_id}/findings` | UUID path | Array of configured train/evaluation-boundary `Component` objects `{component_key,sample_ids,splits,crosses_boundary}` | 409 until run complete. A complete empty array is a valid no-finding result only for analyzed scope and accepted matching evidence. |
| `GET /api/v1/runs/{run_id}/components/{component_id}` | Optional `source_id`, `target_id`; `limit` 2–150, default 50 | `ComponentDetail`: stable component key, bounded sample snippets/IDs/splits/row indices, evidence, actual path sample/pair IDs, note, member count and `truncated` | 404 stale/unknown run/component; 409 stale source/graph; 422 endpoints outside component; 503 graph unavailable. Path display is capped at eight hops; missing displayed path does not disprove WCC connectivity. The endpoint returns actual source text to the local UI, so do not forward it to an LLM or commit it. |
| `POST /api/v1/runs/{run_id}/repair-plans` | `RepairRequest`: policy `preserve_test` or `alternative_split`, protected splits, seed, optional ratios, tolerance, minimum rows and class constraints | 201 `RepairPlan` with assignments, excluded/moved counts, before/after counts, labels, evidence references, graph fingerprint/checksum, warnings and state | 404 unknown run; 409 run incomplete; 422 invalid/unsupported request; 429 max 20 plans/run; 503 graph/receipt failure. No-op is `not_applicable`; infeasible/unsafe is `failed`. Repeating POST creates a distinct plan ID; plan creation is not idempotent. |
| `GET /api/v1/runs/{run_id}/repair-plans` | none | Array of persisted plans, newest first | 404 unknown run; empty array before any plan. SQLite survives API restart. |
| `GET /api/v1/runs/{run_id}/repair-plans/{plan_id}` | none | Typed `RepairPlan`, including assignment manifest and current validation | 404 run/plan mismatch or missing plan. State values: draft, validated, approved, not_applicable, failed, incomplete. |
| `POST /api/v1/runs/{run_id}/repair-plans/{plan_id}/validate` | Empty JSON object | Plan with fresh `ValidationReport` (`verified`, `incomplete`, `not_applicable`, `failed`), checks, scope, coverage, WCC queries and residual overlap counts | 404 unknown/mismatched; database outage yields incomplete, not verified. Safe to repeat; each call re-queries database. `verified` is scoped to inspected rows, accepted edges and declared boundary. |
| `POST /api/v1/runs/{run_id}/repair-plans/{plan_id}/approve` | `{"approve":true,"manifest_sha256":"<64 lowercase hex>"}` | Plan becomes approved only after another fresh successful validation | 422 missing/false approval; 409 checksum mismatch, prior verification missing, or fresh verification fails. Repeated approval with unchanged manifest is idempotent. This must be a deliberate human UI action. |
| `GET /api/v1/runs/{run_id}/repair-plans/{plan_id}/artifacts` | none | Array `{filename,sha256,bytes,url}` for four controlled artifacts | 409 unless approved and verified; fresh revalidation runs before listing. 413 over configured byte cap. |
| `GET /api/v1/runs/{run_id}/repair-plans/{plan_id}/artifacts/{filename}` | Fixed filename only | JSON or CSV download; Content-Disposition and nosniff header | Only `repair-manifest.json`, `split-assignments.csv`, `validation-report.json`, `audit-provenance.json`; 409 approval/verification/stale graph, 413 byte cap. Artifacts contain identifiers/evidence, not full source text. |
| `POST /api/v1/runs/{run_id}/investigations` | `InvestigationRequest`: `{"goal":"..."}` 8–1600 chars, extra fields forbidden | 202 `InvestigationAccepted`: `{investigation_id,run_id,status:"queued"}` | 404 unknown run; 409 unless complete; 429 active queue (2) or 10 investigation records per run. Never reset/bypass the quota; submit a new audit to start a new per-run allowance. POST retry can create another investigation. |
| `GET /api/v1/runs/{run_id}/investigations/{investigation_id}` | UUID paths | `Investigation`: current status/activity, typed decision if complete, model/provider, usage, events and repair reference | 404 unknown or run-mismatched investigation. Poll while queued/running (~1.8s UI interval). Missing key/provider/MCP error/timeout/budget exhaustion is failed or incomplete with no fabricated decision. |
| `GET /api/v1/runs/{run_id}/investigations/{investigation_id}/events` | UUID paths | Persisted event array | 404 mismatch. Poll or reload; trace persists across API restart. |
| `GET /api/v1/runs/{run_id}/investigations/{investigation_id}/trace` | UUID paths | `InvestigationTrace`: actual provider/model requests, MCP calls and bounded previews/digests, IDs, timings, errors, decision, plan state, approval, usage | 404 mismatch. A completed prior trace may be retrieved when DB is down; it is historical, not a new successful graph query. Raw sample text and secrets are excluded. |

## Representative response shapes

Dataset metadata response (illustrative):

```json
{"dataset_id":"owner/dataset","revision_sha":"0123456789abcdef0123456789abcdef01234567","config":"default","configs":["default"],"splits":{"train":1000,"test":100},"columns":{"text":"Value(dtype='string')"},"license":"unknown"}
```

Completed run result fields (not exhaustive):

```json
{"analysis_id":"<uuid>","status":"complete","request":{"dataset":"owner/dataset","revision":"<pinned SHA>","config":"default","text_column":"text","label_column":"label","train_splits":["train"],"evaluation_splits":["test"],"limit_per_split":200,"seed":42,"threshold":0.9},"result":{"source":{"dataset_id":"owner/dataset","revision_sha":"<pinned SHA>","config":"default","splits":{"train":1000,"test":100}},"coverage":{"train":0.2,"test":1.0},"inspected_counts":{"train":200,"test":100},"analyzed_samples":300,"accepted_edges":0,"review_edges":0,"components":[],"findings":[],"cross_split_components":[],"evidence":[],"graph_name":"<server-created graph>","queries":["CALL algo.wcc(...)"]}}
```

Validation response includes `{status,analysis_id,plan_id,manifest_sha256,coverage,inspected_counts,full_source_split_sizes,graph_fingerprint,checks,reasons,cross_boundary_components_before,cross_boundary_components_after,remaining_cross_split_components,protected_splits,split_counts,label_counts,queries,scope}`. The result and scope, not a chart, are authoritative.

Investigation trace shape:

```json
{"investigation_id":"<uuid>","run_id":"<uuid>","provider":"openrouter","model":"<configured model>","status":"complete","events":[{"kind":"tool_call","status":"succeeded","summary":"..."}],"tool_calls":[{"tool_name":"list_cross_split_components","arguments":{"limit":50},"query_template_id":"cross_split_components","status":"succeeded","result_digest":"<sha256>"}],"model_calls":[],"decision":{"outcome":"cross_split_findings","next_action":"review_repair_plan","component_ids":["<stable component key>"],"evidence_ids":["<pair id>"],"confidence":"partial_scope"},"repair_plan_id":"<uuid>","repair_plan_status":"validated","approval_state":"awaiting_human_review","total_tokens":0,"total_cost_usd":null}
```

## Existing backend capability → future screen map

| Future screen | Backend mapping | Status |
|---|---|---|
| 1. Landing page → Launch App | No API; `/app` is current application entry | Landing page not implemented |
| 2. Dataset import | `POST /datasets/inspect` | IMPLEMENTED |
| 3. Dataset metadata preview | `Source` metadata response | IMPLEMENTED |
| 4. Analysis in progress | `POST /runs`, poll `GET /runs/{id}` | IMPLEMENTED; local single worker and bounded queue |
| 5. Completed audit overview | Run JSON and `GET /findings` | IMPLEMENTED; coverage must stay visible |
| 6. Graph explorer | `ComponentDetail` plus bounded paths | IMPLEMENTED BUT LIMITED; no general graph browser in app |
| 7. Duplicate evidence inspector | Component endpoint with evidence/sample excerpts | IMPLEMENTED |
| 8. AI investigation and live MCP trace | Investigation start/status/events/trace routes | IMPLEMENTED; no SSE, polling only; provider quota/cost/latency limits |
| 9. Repair policy selector | `RepairRequest` to repair-plan POST | IMPLEMENTED |
| 10. Repair impact preview | `RepairPlan.assignments`, counts, warnings | IMPLEMENTED |
| 11. Human approval | Explicit checksum-bound approve POST | IMPLEMENTED |
| 12. Independent verification receipt | Plan validation report and trace receipt | IMPLEMENTED |
| 13. Artifact exports | Approved-only list and fixed-name download endpoints | IMPLEMENTED |
| 14. Run history and persistence | Read by known UUID; persisted SQLite, source graph in FalkorDB | IMPLEMENTED BUT LIMITED; no list/history endpoint, auth or multi-user isolation |
| 15. Empty/error/quota states | Typed empty arrays and HTTP 4xx/5xx/error status | IMPLEMENTED BUT LIMITED; clients must distinguish complete-empty from failed/partial and provide new-run quota recovery |

Do not treat a 200 completed response with an empty finding list as full-source cleanliness: coverage is the inspected subset. Do not retry POSTs blindly because no idempotency key is implemented. The application is unauthenticated local single-user software and should not be exposed publicly without a separate security review.
