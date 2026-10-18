# Phase 3 verification

Recorded 2026-10-18 (Asia/Calcutta). This is an implementation checkpoint, not
the Phase 3 definition-of-done receipt. Live OpenRouter acceptance remains
incomplete because `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are not configured
in this environment. No provider call, live model identifier, latency, or cost is
claimed. The installed browser automation surface is also disabled in Work
settings; the production route was checked over HTTP instead.

## Implemented path

- The API exposes typed POST/GET/events/trace investigation endpoints. SQLite
  persists model calls, actual MCP tool calls, digest summaries, evidence
  identifiers, statuses and provider usage. Startup converts unfinished work to
  `interrupted`; it does not invent a completion or resume a possibly duplicated
  action.
- `mcp==1.26.0` is pinned in `pyproject.toml` and `uv.lock`. Each investigation
  starts a subprocess over MCP stdio, performs initialize and tool discovery,
  then calls allowlisted business tools. The server binds graph/run IDs from
  trusted API storage. Graph reads execute fixed queries through FalkorDB
  `GRAPH.RO_QUERY`; the model cannot submit arbitrary Cypher. Repair proposal and
  verification use existing deterministic API services; no approval tool exists.
- Tool arguments and results are Pydantic validated. The agent enforces a model
  step limit, elapsed deadline, per-call timeout, bounded graph row counts,
  output-size cap, and a single retry only for a provider connection error before
  a response. Provider errors and missing credentials result in explicit failed
  states with no decision. It records returned model/provider, token usage and
  cost when available.
- No source sample text enters MCP results, the model context, or persisted
  text-free evidence previews. Prompt injection in sample text is not actionable because the
  tools do not return it. Coverage limitations are appended by the backend, and
  partial coverage requires `partial_scope` confidence. Decision component and
  evidence identifiers must have appeared in actual graph tool results.
- The `/app` page adds a polling investigation panel and persisted trace view.
  The repair plan remains an unapproved draft until the existing explicit human
  approval control is used.

## Executed checks

- Phase 2 baseline before Phase 3 edits: **29 passed** (recorded in
  `phase-2-verification.md`).
- Final combined pytest suite: **39 passed, 0 failed, 0 skipped in 382.32s**.
  This includes all 29 prior tests and 10 new agent tests, including the real
  public ingestion/API and FalkorDB integration tests. One upstream
  Starlette/AnyIO deprecation warning remains.
- New `tests/test_agent.py`: **10 passed**. One test launches the pinned MCP
  server as a subprocess against real FalkorDB, negotiates the protocol, lists
  the tools, and reads actual schema, WCC component and edge evidence. It also
  sends write-shaped input and confirms it is rejected without changing graph
  node count. Additional controlled-provider checks cover multiple tool calls,
  step-limit and timeout behavior. Other checks cover invalid tool names and
  arguments, train/test versus train/validation findings, graph-grounded
  decisions, partial-scope limits, no-provider behavior, text-free evidence
  previews, restart recovery and run isolation. Synthetic rows are test-only.
- The test MCP session completed an initialize handshake, discovered 11 tools,
  and made six protocol tool calls: `get_schema`, `query_read` (twice, including
  rejected write-shaped input), `explain`, `list_cross_split_components`, and
  `inspect_component_evidence`. Real FalkorDB test graph reads returned two
  components: one crossing train/validation/test and one train/validation-only.
  These are synthetic test fixtures, not GoEmotions findings or demo evidence.
- `npm run typecheck`: passed.
- `npm run build`: passed; `/app` is statically generated.
- `python -m py_compile` passed for the new agent, MCP server and live scripts.
- Production UI smoke: Next.js production server started locally and
  `GET http://127.0.0.1:3000/app` returned **200**. Browser automation was not
  available in the current Codex Work settings, so no interactive browser test
  is claimed here.
- OpenRouter live tool-calling smoke: **not run**. The reproducible command is
  `uv run python scripts/live_agent_smoke.py`; it uses a completed stored audit
  (default GoEmotions run `300f5981-b6f2-4c01-b3e8-8b772063b455`) and persists
  only a text-free receipt to `docs/phase-3-live-smoke.json` after real provider
  tools and actual graph evidence are observed.
- Baseline comparison: harness is `scripts/evaluate_agent_baseline.py`; **not
  run** because the OpenRouter provider is not configured. It compares a real
  tool-free model response against actual graph ground truth and an API agent
  trace, measuring evidence coverage, ground-truth consistency, unsupported
  claims, actions and verified completion. It saves measured metadata only. No
  baseline accuracy or completion numbers are claimed.

## Evaluation and acceptance gaps

No real model identifier, live agent tool-call count, selected repair policy,
train/test versus train/validation decision, independent plan validation result,
token/time or cost measurement can be reported until the live smoke succeeds.
The automated MCP integration used test-only graph rows and does not constitute
real GoEmotions agent evidence. The live smoke and baseline scripts should be run with
`OPENROUTER_API_KEY`, a compatible `OPENROUTER_MODEL`, the API started with the
same local data directory, and the recorded GoEmotions graph available.

The agent summarizes evidence rather than retaining full raw tool output. This
reduces text exposure but limits retrospective display of every returned edge;
the API trace preserves call arguments, a bounded text-free evidence preview,
summary and digest, while the
run's existing findings and component endpoints remain the source for detailed
evidence. The app is still local single-user software without hosted auth.

## Reproduction

```powershell
uv run pytest -q
cd apps/web
npm run typecheck
npm run build
cd ../..
uv run python scripts/live_agent_smoke.py
uv run python scripts/evaluate_agent_baseline.py
```

Live smoke and baseline require real OpenRouter credentials and are deliberately
not substituted with mocked responses.
