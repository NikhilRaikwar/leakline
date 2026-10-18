# Phase 3 live verification

Recorded 2026-10-18 (Asia/Calcutta). This receipt documents a real OpenRouter
model call, MCP stdio session, read-only FalkorDB investigation, deterministic
repair proposal and independent validation. Raw dataset text and credentials are
not stored here. The local ignored `.env` supplied the provider key; the recorded
trace contains no key.

## Live acceptance result

- Provider: OpenRouter. Exact requested/returned model: `deepseek/deepseek-v4.1-flash`.
  The model was selected from the current [OpenRouter model catalog](https://openrouter.ai/deepseek/deepseek-v4.1-flash),
  whose model capability listing exposes tool calling. The returned route/provider
  varied across individual calls (InferenceNet and DigitalOcean); this is visible
  in the saved model traces. OpenRouter authentication and live function/tool-call
  parsing succeeded, including parallel requests for multiple tools, actual tool
  result messages returned into the model conversation, and a final structured
  decision. Seven provider calls were recorded in this acceptance run. Provider
  usage reported 34,718 tokens and USD 0.003406734; wall time was 63.266 seconds.
- Run: `300f5981-b6f2-4c01-b3e8-8b772063b455`; investigation:
  `ee747d1e-8b13-44d5-a9df-f6b80f079d7b`. MCP handshake negotiated protocol
  `2025-11-25`, discovered 11 tools from `Leakline-FalkorDB-ReadOnly/1.26.0`.
  The model actually called: `get_schema`, `inspect_audit_scope`,
  `list_cross_split_components`, `inspect_component_evidence` (3),
  `trace_duplicate_path` (3), `get_repair_options`, `propose_repair_plan`,
  `validate_repair_plan`, and `get_verification_receipt` (13 successful MCP
  invocations). Each graph read used the run-bound allowlisted FalkorDB query
  template through the MCP server; the model could not submit arbitrary Cypher.
- The live graph query returned three crossing WCC components: two train/test and
  one train/validation. The evidence inspection returned five accepted exact
  duplicate pair IDs supporting those components, and three actual confirmed
  graph paths were inspected. Component IDs and evidence IDs are in the sanitized
  [live receipt](phase-3-live-smoke.json). The GoEmotions graph contained seven
  accepted duplicate edges overall; five edges are in the three crossing groups.
- `get_repair_options` recommended `preserve_test`. The model chose that returned
  policy. Deterministic services created plan
  `c8361336-bec0-46d9-a448-aee4a4ad8bd0`, quarantining two inspected training
  rows; fresh independent validation returned `verified`, plan status `validated`,
  and one remaining cross-split component. That is the train/validation overlap:
  Policy A protects test and does not automatically fix train/validation. The
  plan remains `awaiting_human_review`; the model did not approve it.
- The graph covers `google-research-datasets/go_emotions`, config `simplified`,
  revision `add492243ff905527e67aeb8b80c082af02207c3` (source card: Apache-2.0).
  Source split sizes are train 43,410, validation 5,426, test 5,427; inspected
  scope is exactly 1,500 rows per split (4,500/54,263 total, about 8.3%). The
  saved conclusion says results cover confirmed duplicate evidence in this
  analyzed scope only. MinHash can miss candidates; this is not a claim that the
  full dataset is clean or free of all leakage/memorization.
- Trace persistence was checked through the API after starting a fresh API
  process against the existing local data directory. The production Next.js
  `/app?run=300f5981-b6f2-4c01-b3e8-8b772063b455` UI was then opened in headless
  Microsoft Edge 155. The browser smoke loaded the persisted investigation,
  displayed its conclusion/scope and opened the persisted model/MCP trace. Receipt:
  `scripts/browser_smoke.mjs`; actual result was passed, with the above plan ID
  and approval state.

The first acceptance attempts exposed provider behavior where the model emitted
semantically understandable but schema-invalid enum aliases (for example,
`human_review_and_approval`) despite requesting strict JSON schema. They failed
closed and produced no decision. The final path reconciles only categorical
decision fields and cited IDs against the already-observed graph, plan and
coverage state; the narrative remains model-authored and is checked against the
same deterministic guardrails. A regression test covers this behavior. Earlier
failed attempts remain recorded as failures in local SQLite and are not presented
as successful traces.

## Baseline comparison

`scripts/evaluate_agent_baseline.py` ran the same user task, pinned source run,
model, temperature 0 and `max_tokens=1500` for both conditions. The text-free
[measurement receipt](phase-3-baseline-evaluation.json) reports:

| Measure | Restricted tool-free baseline | Graph-enabled investigation |
|---|---:|---:|
| Tool invocations | 0 | 12 |
| Source/run facts available | No | Yes, through MCP |
| Evidence IDs / components cited | 0 / 0 | 5 / 3; all expected |
| Evidence coverage | 0 (no access) | 1.0 for expected pair/component evidence |
| Correct boundary distinction / policy | Unavailable; abstained | Yes; preserve test, disclosed remaining train/validation |
| Unsupported finding claim / unsafe action | No / no | No / no |
| Verified task completion | No | Yes; validated plan, still awaiting human approval |
| Latency | 6.379 s | 80.463 s |
| Tokens / provider-reported cost | 1,617 / USD 0.0018351 | 34,549 / USD 0.004784686 |

This is one paired run, not a statistically meaningful model benchmark. The
baseline was deliberately denied source facts and graph tools, so its abstention
is appropriate and finding correctness is unavailable, not a zero-accuracy
result. The graph condition's evidence measurements are a direct comparison
with the persisted audit, not a human-rated general capability score.

## Checks and commands

Commands were run from the repository root unless otherwise indicated; the
ignored `.env` was loaded only by the server/smoke processes.

```powershell
uv run --env-file .env --project apps/api pytest -q
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
$env:LIVE_INVESTIGATION_ID='ee747d1e-8b13-44d5-a9df-f6b80f079d7b'
$env:API_BASE_URL='http://127.0.0.1:8001'
$env:WEB_BASE_URL='http://127.0.0.1:3003'
node scripts/browser_smoke.mjs
uv run --env-file .env --project apps/api python scripts/live_agent_smoke.py
uv run --env-file .env --project apps/api python scripts/evaluate_agent_baseline.py
```

Executed results on this checkpoint:

- `uv run --env-file .env --project apps/api pytest -q`: **42 passed, 0 failed,
  0 skipped in 353.36s**. The single warning is the existing upstream
  Starlette/AnyIO `BlockingPortal` deprecation. This includes real-service tests
  against FalkorDB and public HF ingestion plus synthetic-only graph fixtures.
- `npm run typecheck --workspace apps/web`: passed.
- `npm run build --workspace apps/web`: passed; Next.js 16.4.2 compiled and
  statically generated `/app`.
- `node --check scripts/browser_smoke.mjs`: passed. Headless Edge 155 browser
  smoke against production `/app` on port 3003: passed; persisted plan and MCP
  trace were visible.
- `uv run --env-file .env --project apps/api python scripts/live_agent_smoke.py`:
  passed against the real stored audit; generated the linked receipt above.
- `uv run --env-file .env --project apps/api python scripts/evaluate_agent_baseline.py`:
  a completed paired run is saved in the baseline receipt. A subsequent rerun
  after acceptance returned HTTP 429 because that run had reached the API's
  intentional ten-investigations-per-run quota; no records were deleted or quota
  bypassed. The retained measured comparison is the earlier genuine paired run.
- After stopping and restarting the API with the same local `LEAKLINE_DATA`, a
  fresh trace GET returned status `complete`, 13 tool calls, the same model and
  plan ID, validated status, `awaiting_human_review`, and the partial-scope
  statement. This confirms persistence across API restart.

Real MCP/FalkorDB smoke is also part of the pytest suite; it handshakes with the
pinned SDK, queries actual FalkorDB schema/components/evidence, and rejects
write-shaped input. Synthetic graph data in tests is clearly test-only and is
not used as the GoEmotions demo.

## Reproduction and limitations

1. Start Docker Desktop and `docker compose up -d`.
2. Copy `.env.example` to ignored root `.env`; set `OPENROUTER_API_KEY` locally.
   Keep the exact model identifier `deepseek/deepseek-v4.1-flash` in
   `OPENROUTER_MODEL`. Never put credentials in `NEXT_PUBLIC_*` variables.
3. From `apps/api`, run
   `uv run --env-file ../../.env uvicorn leakline.main:app --host 127.0.0.1 --port 8000`
   with `LEAKLINE_DATA` pointing at the repository `data` directory. Run the
   frontend with `API_BASE_URL` set to that API. Fresh clones need to reproduce
   the pinned audit using `uv run python scripts/reproduce_real_audit.py`; local
   FalkorDB graph contents and SQLite run records are intentionally not committed.
4. Run `uv run --env-file .env --project apps/api python scripts/live_agent_smoke.py`
   and then the baseline script. Both create new provider calls and plans, and
   the smoke writes a text-free receipt to `docs/phase-3-live-smoke.json`.

The app is still local single-user software without hosted authentication.
Provider latency/routes and costs can vary. The model can fail or return invalid
output; the API records a failed/incomplete state and does not synthesize a
successful investigation. The deterministic duplicate rules, graph queries,
repair validation, and human approval remain authoritative. Analysis is bounded
by sampled rows and the existing configured matching thresholds. Public dataset
availability does not imply redistribution permission; raw samples stay local
in FalkorDB and are not committed.
