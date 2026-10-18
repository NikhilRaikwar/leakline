# Phase 4 frontend verification

This record covers the responsive product site and the API-backed workspace
implemented in Phase 4. It does not claim a hosted deployment or shared-user
history.

## Commands run

The following checks completed successfully:

```powershell
uv run pytest -q
npm run typecheck --workspace apps/web
npm run build --workspace apps/web
```

Backend result: **43 passed**, with one upstream Starlette deprecation warning
about `anyio.abc.BlockingPortal`. Frontend TypeScript checking passed. The
Next.js production build passed and emitted the landing page, workspace routes,
and dynamic run-scoped pages.

The browser smoke used the production web server at `127.0.0.1:3000`, the local
FastAPI service at `127.0.0.1:8000`, and the running FalkorDB container. No API
key was written into browser storage or the screenshots.

## Browser flows verified

- Landing page rendered at desktop and 390px mobile widths. The mobile menu
  opened and exposed the product, workflow, documentation, repository and app
  links.
- The landing-page product preview loaded real saved GoEmotions audit values
  through the API: pinned revision `add492243ff905527e67aeb8b80c082af02207c3`,
  1,500 inspected rows in each of train, validation and test, 7 accepted edges,
  and 3 cross-split components. It displayed the partial-scope limitation.
- Dataset setup inspected the public Hugging Face source, showed its resolved
  revision, license, columns and actual split sizes, then submitted a real run.
- The audit UI followed a real run through `ingesting`, `matching`, `graph`, and
  `complete`. Run ID: `649b8d1d-1f3f-4eb3-ad42-f4360e75601b`. The request
  inspected 200 rows per split (600 total) at the same pinned GoEmotions
  revision. The stored result completed with 0 accepted edges and 0 cross-split
  groups. This is an honest clean result for that sample only; its coverage is
  200/43,410 train, 200/5,426 validation and 200/5,427 test.
- The run-scoped graph explorer displayed real WCC members and accepted pair
  evidence from the earlier 1,500-row audit. The persisted AI investigation
  view showed the actual 13-call OpenRouter/MCP trace and its partial-scope and
  train/validation limitations; the UI did not trigger a new paid model call on
  page load.
- Repair review displayed the actual Policy A assignments and excluded rows.
  Independent verification showed that the test-protected boundary passed
  while a train/validation component remained outside that boundary. The
  approval control remained disabled until explicit consent was checked.
- Artifact listing for the validated but unapproved plan remained locked. A
  separately persisted, already-approved plan returned the four real artifacts
  with byte sizes and SHA-256 values. No plan was approved during this smoke.
- The workspace navigation drawer opened at mobile width. The audit overview
  remained readable at desktop width.

## Screenshots

These are captured browser outputs from the implemented site and workspace:

- [Landing page, desktop](screenshots/landing-desktop.png)
- [Landing page, full mobile page](screenshots/landing-mobile.png)
- [Landing page, mobile first viewport](screenshots/landing-mobile-viewport.png)
- [Real audit overview, desktop](screenshots/audit-overview-desktop.png)
- [Real clean 600-row audit, desktop](screenshots/audit-overview-clean-desktop.png)

## Scope and limitations

The website and workspace are local-first and single-user. Recent run IDs live
in this browser's local storage because the backend has no shared history API.
The source dataset remains read-only. Rows and labels shown in the evidence
inspector come from the local API and are not copied into these screenshots or
committed documentation. An audit with zero findings only establishes that no
accepted duplicates were found in its analyzed rows under the configured
matching policy.

AI investigation remains an explicit user action. This browser smoke reused a
previously persisted genuine trace rather than making another provider request.
The UI is not a public hosted product and has no authentication or tenant
boundary. A fresh checkout must start FalkorDB and the API before using the
workspace; saved local graph state is not shipped in the repository.
