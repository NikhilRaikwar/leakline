# Frontend implementation

Phase 4 provides the public product site and an API-backed Leakline workspace.
The UI consumes the contracts in [the frontend integration handoff](frontend-integration-contract.md);
it does not create alternate audit, graph, agent, repair, or verification logic.

## Routes

| Route | Purpose | Backend behavior |
| --- | --- | --- |
| `/` | Product overview, workflow, evidence and FAQ | Reads the saved GoEmotions run by ID for the product preview. If unavailable, renders an explicit unavailable state without demo values. |
| `/app` | Workspace start and recent local runs | Uses browser-local run IDs; opens the real persisted run when requested. |
| `/app/new` | Dataset inspection and audit setup | Calls dataset inspection, renders returned source revision, license metadata, feature columns and actual source split sizes, then starts a real run. |
| `/app/audit-runs` | Recent runs on this browser | Re-fetches each saved ID. There is no server-wide run-history endpoint. |
| `/app/runs/{id}` | Audit overview and coverage | Reads persisted run status/result; displays source sizes, inspected rows, coverage, confirmed edges and cross-split groups. |
| `/app/runs/{id}/graph` | Graph explorer | Loads component members, sample excerpts, pair evidence and bounded graph path from the component endpoint. Candidate-only evidence is disclosed separately. |
| `/app/runs/{id}/evidence` | Evidence inspector | Shares the graph-backed member/evidence inspector with a focused evidence heading. |
| `/app/runs/{id}/investigation` | AI investigation and persisted trace | Loads saved investigation records; only the explicit user action starts an OpenRouter investigation. Shows actual calls/events and the server's decision/limitations. |
| `/app/runs/{id}/repair` | Repair policy and plan review | Lists persisted plans or creates a deterministic plan using the backend repair API. Displays assignments, exclusions, warnings and distributions. |
| `/app/runs/{id}/verification` | Independent validation and human approval | Calls backend validation and requires a separate checked consent before approval. |
| `/app/runs/{id}/exports` | Approved artifacts | Lists/downloads backend-generated files only for an approved plan. |

## Interaction and data handling

The marketing preview is non-blocking and requests the known GoEmotions run only;
it never launches an audit or an AI call. The landing-page illustrations are
labelled conceptual where they do not visualize API data. Real audit, component,
repair, trace, and verification values are rendered from typed API responses.

`/app/new` inspects first. The selected revision is the resolved source SHA, the
user chooses actual returned columns/splits, and the app submits the existing run
request. Progress uses backend lifecycle states and does not invent a percentage.
Polling stops for terminal states. Retry buttons repeat read requests; mutation
buttons disable while a request is active.

Run IDs are saved in browser `localStorage` (last eight) because the API has no
shared history endpoint. No credentials are stored by the browser. OpenRouter
keys stay in the API process. The UI does not approve on behalf of the user and
does not infer that a partial clean run proves dataset-wide cleanliness.

## Responsive and accessibility details

The warm paper/forest-green design uses a responsive navigation menu, stacked
mobile cards and tables that retain horizontal scroll where IDs/assignments need
full visibility. Graph members and accepted edges are keyboard operable and have
text equivalents; the member table is an accessible alternative to the graph.
FAQ items use native `details` elements. Motion is limited to section reveals and
accepted graph-edge drawing, and respects `prefers-reduced-motion`.

## Local use and limits

Run the API, FalkorDB, and web app as described in the README. The web proxy reads
`API_BASE_URL` at startup. The app is for local, single-user use: it has no login,
tenant isolation, shared run history, or public deployment security boundary.
Source row text is shown only in the local evidence inspector using the API's
bounded excerpts; it is not copied into committed frontend assets. AI traces omit
raw source text under the existing backend contract.
