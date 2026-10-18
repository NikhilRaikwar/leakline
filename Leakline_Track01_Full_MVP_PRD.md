# LEAKLINE
## Full MVP Product Requirements Document — Graph Hacks / FalkorDB / Track 01

**Product:** Leakline — The Graph-Native Dataset Integrity Engineer  
**One-line pitch:** *“Your AI benchmark may be lying. Leakline finds connected train–evaluation contamination, proposes a traceable correction, and verifies it on your real dataset.”*  
**Document status:** Build-ready engineering specification, not an implementation-complete claim  
**Version:** 1.0 · **Prepared:** 18 October 2026 (IST)  
**Target submission:** **Track 01 — Agents That Act on Connected Data, ONLY**  
**Event window per current user-supplied brief:** 15 October 2026, 12:01 AM → 18 October 2026, 11:59 PM IST  
**Primary sponsor / required technology:** FalkorDB. **Sponsor-is-hero rule:** graph connectivity must decide whether, where, and how repairs occur.

> **Source discrepancy / verify before submitting:** The user-provided **current October 2026** Graph Hacks challenge says “Context for AI Agents,” Track 01 “Agents That Act on Connected Data,” and a $20,000 prize pool. At document authoring time, publicly indexed pages under the identical WeMakeDevs URL still displayed an **older September 2026 “Building Next-Gen RAG”** version with different track names and $10,000. This PRD targets the **October brief given by the participant**, and carries forward only general rules independently visible in the older rules page (FalkorDB central, new work, permitted data, repo/README/demo/setup, AI-coding disclosure). **Reconfirm the authoritative live submission form and rules before submitting; do not select the old track name.** See sources [S1–S3].

---

# 0. EXECUTIVE BUILD CONTRACT

Leakline is a working browser-based product for ML engineers who have **real text-classification datasets** and need to know whether samples in `train`, `validation`, and `test` are related closely enough to make evaluation misleading. It imports an actual public Hugging Face dataset **at a recorded revision**, discovers exact and near-duplicate relationships, stores those relationships as a **FalkorDB property graph**, computes **weakly connected components on approved relationship types**, and finds components spanning evaluation boundaries. Its agent uses graph-returned evidence to **choose what to investigate**, decide when review is needed, propose an **immutable, policy-controlled repair**, and run deterministic post-repair checks. The browser shows every step and exports a reproducible artifact bundle.

**What is unusual:** The unit of protection is a **connected component of related examples**, not an independent duplicate pair. If A≈B and B≈C are approved links, Leakline makes a **group-level** decision even when A and C do not match directly. Graph topology changes the permissible split assignment. The app must not compute components privately in Python then use FalkorDB as a drawing store. A separate local reference implementation is permitted **only in tests / benchmark ablation**.

**Working product pledge:** No fake contamination counts, invented reviews, fabricated charts, scripted LLM tool traces, seeded conclusions, or made-up success notifications. Use real public rows for the judge flow. Tiny deterministic test fixtures are allowed **only in automated testing**, visibly separate from public user demos. A clean public dataset is a valid outcome.

## 0.1 The one-sentence customer job

“As an ML engineer, I can submit a public text-classification dataset, inspect which specific related sample groups contaminate my train–evaluation boundary, and export a reproducible corrected protocol without silently altering an official benchmark.”

## 0.2 Acceptance definition (all P0 gates)

1. A first-time visitor can **scan a different, supported public Hugging Face dataset URL** without code changes or demo fixtures.
2. Source dataset ID, commit/revision, config, sample count, analyzed coverage, split names and licensing notices are retained.
3. Exact and verified near-duplicate pairs, with methods/scores/evidence, become real `:CONFIRMED_DUPLICATE_OF` edges in **FalkorDB**; weak embedding-only suggestions must not be promoted automatically.
4. `algo.wcc` is genuinely called in FalkorDB on the approved edge type; isolated sample nodes are included; returned groups are reified into persisted analysis results.
5. Cross-split contamination is computed from those groups; a clicked finding reveals sample-level evidence and a concrete multi-hop connection where one exists.
6. A real agent with structured tool calls uses a **genuine MCP interface** to inspect findings and select the next meaningful action; traces are captured from execution, not generated for the UI.
7. User reviews a policy-preserving proposal. No original source row or official split is changed in place.
8. The generated manifest passes `no approved component crosses train vs evaluation partitions` for **the analyzed scope**. If infeasible, the system declines safely and explains why.
9. A real, deterministic baseline evaluation or explicitly marked “evaluation not run” state exists; no invented model accuracy or synthetic success claim.
10. The product exports a traceable report bundle and passes the graph-off ablation / independent verification tests.
11. Landing page, import wizard, live run screen, graph investigation screen, repair review, evaluation and downloads exist and work responsively.
12. Public repo, README with graph schema and exact tested Cypher, runnable Docker setup, at least one recorded live demo video, and AI-assistance disclosure are present.

## 0.3 Explicitly out of scope for the hackathon MVP

Image/audio/video data; private/gated/login-protected datasets; datasets containing sensitive personal records; arbitrary uploaded executables; unlimited corpus ingestion; automatic legal assertions; publishing new splits back to third-party hubs; training expensive LLMs; inference-time retrieval memorization claims; automatic approval of semantic similarity; autonomous destructive edits; unbounded multi-agent swarm; proprietary RAG stack recreation; Jev as a required dependency; cloud training orchestration; fully general DLP/compliance certification.

## 0.4 Track 01 line-by-line mapping

| Official October Track 01 focus | Leakline proof in running app |
|---|---|
| Multi-hop reasoning | Paths A→B→C form one protected group; an indirect train→test conflict is traced to its pair evidence. |
| Graph queries and algorithms as agent tools | `algo.wcc` runs inside FalkorDB; Cypher traces and counts split-spanning components. |
| Tool selection through MCP | Agent chooses `inspect_dataset_graph`, `find_cross_split_components`, `inspect_component_evidence` and subsequent tools through an MCP server, with visible protocol/tool records. |
| Actions based on graph results | Graph components determine an approved split-repair manifest, which the user reviews and the backend validates. |
| Explainable results | Every flag links to original split/row, relation type, similarity method, thresholds, and the executed query/tool trace. |

This is **not** primarily Track 02 agent-memory and coordination. Graph history is for reproducibility and audit, not a claim of multi-agent coordination.

---

# 1. CUSTOMER, PROBLEM, POSITIONING

## 1.1 Target users

- **Primary:** ML engineers, LLM eval builders, data scientists training text classifiers or maintaining text benchmarks.
- **Secondary:** open-source dataset maintainers and AI assurance / reliability teams inspecting evaluation quality.
- **Recruiter-facing engineering story:** graph modeling, algorithms, provenance, approximate retrieval, LLM/tool orchestration, deterministic guardrails, testing, reproducibility, observability, secured data handling, product design.

## 1.2 Pain in real engineering terms

- Identical text may accidentally appear in different splits.
- Lightly edited / overlapping passages can form **chains** across splits even when the endpoints are not directly similar.
- Rows might share a source, author, conversation or document ID if the dataset provides such metadata; row-wise splits can violate that independence.
- A classifier can appear better on an evaluation distribution closely related to training observations.
- An audit must distinguish **confirmed contamination according to a stated rule** from **semantic similarity candidates** and **unknown provenance**.
- A new split can be wrong if it optimizes leakage away but destroys label balance or overrides official evaluation semantics without disclosure.

**No overclaim:** Detecting similarity is not proof of actual training-data memorization; a graph-clean split is only clean relative to the configured evidence graph and analyzed coverage. Leakage causes and model-score changes require careful interpretation.

## 1.3 Value proposition

- **Detect**: explainable relationship chains rather than one-number “duplicate score.”
- **Decide**: compute allowable grouping and protected evaluation policy using FalkorDB.
- **Act**: make a reviewable, non-destructive repair proposal.
- **Verify**: check invariant after repair and optionally retrain a cheap local classifier under comparable protocols.
- **Export**: manifest + edge evidence + provenance + instructions any engineer can reproduce.

## 1.4 Competitive differentiation / falsifiable claim

Hash deduplication, MinHash, datasets tooling, grouped splitting, and LLM eval frameworks all exist. Leakline does **not** invent them. The claim is the **assembled closed loop** of `real public data → typed evidence graph → FalkorDB WCC as the decisive grouping operation → policy-controlled repair → executable integrity verification → source-linked audit`. Test it against pairwise-only logic and a graph-disabled condition. If the system cannot show this difference, the claim must be weakened publicly.

---

# 2. RESEARCH BASIS AND DESIGN PRECEDENTS

## 2.1 What the sponsor docs substantiate

- FalkorDB supports OpenCypher, named graphs and Python client use [S4–S5].
- **WCC** is documented as `CALL algo.wcc([config])` with `nodeLabels` and `relationshipTypes` filters; it yields `node`, `componentId` [S6].
- FalkorDB's MCP server supports read-only graph queries; `FALKORDB_DEFAULT_READONLY=true` is documented for restricting writes [S7–S8].
- Docker official combined image provides graph service port `6379` and Browser port `3000` in container [S9].
- Single-query writes are atomic; writes to the same graph are serialized, while reads may proceed concurrently [S10].
- FalkorDB provides other graph algorithms (BFS, shortest-path, centrality), but **do not use them decoratively**. WCC and typed Cypher are required; a path expansion for displayed evidence is useful if tested [S4, S11].

**Correct implementation stance:** Documentation examples establish intended API shape; pinned container/library versions and integration tests establish actual compatibility. Copy/paste from docs is not proof a query executed successfully.

## 2.2 WeMakeDevs winning-project lessons — applied to UI and proof, not copied

Official winner gallery confirms:

- **Lethe**: landing headline promises one observable behavior; its landing embeds interactive graph/preview, live entry point, “ask → forget → ask again” flip, actual output receipts, and benchmark proof. Its README/demo tie the UI to real graph state, and it publishes working code + demo [S12–S13].
- **Classroom Memory**: first-time user gets a concrete `start quiz` interaction, **live graph panel**, report view, teacher action, persistence and real integration verification—not a static product screenshot [S12, S14].

**Leakline translation:** one visible hero interaction (“Audit dataset”), one **graph changes a repair** moment, an executable integrity receipt, live source row inspection, and a reproducible baseline. **Do not reuse their artwork, copy, or unverified numerical results.** We did inspect public product landing markup/content, not the video frames; don't claim to have audited every visual frame.

## 2.3 External docs guiding real data and evaluation

- Hugging Face Dataset Viewer `/splits`, `/first-rows`, `/rows` (100 rows maximum per `/rows` call) and API base path [S15].
- `huggingface_hub.HfApi.repo_info(repo_type='dataset')` can resolve dataset metadata / revision, while `datasets.load_dataset(..., revision=<commit>)` loads a pinned source [S16–S17].
- `GroupShuffleSplit`, `GroupKFold` and `StratifiedGroupKFold` preserve non-overlapping groups; class balance needs to be checked, not assumed [S18].
- Rotten Tomatoes dataset is a **valid public technical smoke-test** with `text`, `label`, `train`, `validation`, `test`; **its displayed license is “unknown,” so review permitted use and avoid redistributing dataset content in released artifacts** [S19]. **No claim that it actually contains leakage.**

---

# 3. PRODUCT SURFACE AND NAVIGATION

## 3.1 Information architecture

Public routes:

- `/` — visually polished, honest landing page with real explain-the-method interaction.
- `/methodology` — precise definitions, edge types, coverage, scoring and limitations.
- `/examples` — public dataset URLs offered as **sample inputs**, never claims of known contamination or fake canned scans.
- `/docs` — how to run and reproduce; supported inputs and output schemas.

App routes:

- `/app` — investigations / datasets home; new audit entry point.
- `/app/new` — dataset import + config discovery + column/policy selection.
- `/app/runs/[id]` — real analysis pipeline status, tool trace and results overview.
- `/app/runs/[id]/graph` — evidence graph and component investigation.
- `/app/runs/[id]/repair` — repair options, review, immutable manifest, validation.
- `/app/runs/[id]/evaluation` — detector/model evaluations and ablation.
- `/app/runs/[id]/exports` — artifacts, source revision, checksums.
- `/app/settings` — optional model access status, compute limits and provenance policy; keys remain server-side.

## 3.2 Design direction (implement, don't merely render)

- **Premium minimalist, warm-white / cream UI** inspired by high-quality developer-tool startups; not a dark cyber dashboard.
- Palette tokens: `--background: #FBFAF7`, `--surface: #FFFFFF`, `--surface-2: #F6F5F1`, `--text: #202A25`, `--muted: #69756E`, `--brand: #164B3A`, `--brand-hover: #0E392C`, `--border: #E5E8E2`, `--warning: #9F631E`, `--danger: #A5483B`, `--success: #357252`.
- Fonts: Inter / Geist for body and UI; optional restrained serif display headings. No bundled custom font files required.
- App desktop: 240px left navigation + main workspace + optional collapsible right inspector. Mobile: nav drawer, vertical views, tabs instead of side-by-side inspector.
- Real diagrams in React Flow or Cytoscape (choose one); never depend on a generated image pretending to be the graph.
- Skeleton loading, clear disabled states, run status, retry buttons, empty states, keyboard focus, ARIA labels, responsive tables.
- No synthetic stats (“10M rows scanned”) or invented user logos/testimonials. Actual benchmark results are read from data and display run ID, timestamp and dataset revision.

## 3.3 Landing page — exact content architecture

**Header:** LEAKLINE wordmark left; `How it works`, `Methodology`, `GitHub`, `Docs`; right CTA `Audit a dataset`.

**Hero eyebrow:** `DATA INTEGRITY FOR AI EVALUATIONS`.

**Hero headline:** “The evaluation looked clean. The relationships weren't.”

**Subhead:** “Leakline traces related examples across training and test splits, uses FalkorDB to find connected contamination, and produces a reviewable, verified repair.”

**Primary CTA:** `Audit a public dataset` → `/app/new`. **Secondary:** `See how it works` → method section. No fake “Live now” badge until deployed.

**Hero visual (real UI component):** Three steps side-by-side: `Dataset splits` → `Related samples (A—B—C)` → `Validated repair`; an interactive 3-node conceptual explanation can run without backend and must be labeled `Illustration, not dataset analysis`. The visual does not display a fabricated scan result.

**Section 2: What goes wrong.** A single split-conflict story: A in train related to B, B related to C in test, grouped together by WCC. Explain that individually checking only train↔test direct pairs can miss transitive structure.

**Section 3: The actual engine.** Five compact cards: `Ingest`, `Match`, `Traverse`, `Repair`, `Verify` with a plain-language line and actual technology label under each.

**Section 4: See the evidence.** Screenshot/component of **real app UI after implementation**; otherwise wireframe explicitly described as product preview, not as completed metrics. Show clickable sample evidence, threshold provenance, and named graph algorithm.

**Section 5: Who it's for.** ML engineers, dataset maintainers, AI evaluation teams, with grounded jobs-to-be-done and no invented endorsement.

**Section 6: Honest constraints.** “Similarity is not definitive leakage. We never overwrite your dataset, and every scan records its coverage.”

**Section 7: Final CTA.** “Know what your evaluation is connected to.” `Start audit`.

**Footer:** docs, open-source repo when available, methodology, source-code link, privacy/data scope, built with FalkorDB, no deceptive sponsor endorsement.

**Landing quality gates:** first meaningful content fast; no layout overflow at 320px; actual CTA works; keyboard navigable; no screenshot pretending to be a real run; OG metadata, favicon, readable mobile nav.

---

# 4. FIRST-TIME USER JOURNEY — SCREEN BY SCREEN

## 4.1 Journey A: visitor with a real supported public dataset

1. Visitor lands on `/`, clicks **Audit a public dataset**.
2. `/app/new`: paste `https://huggingface.co/datasets/<owner>/<name>` or `owner/name` (not arbitrary URLs); click **Inspect dataset**.
3. Backend fetches **metadata only**: exact dataset ID, HEAD commit SHA, available configurations/splits, schema, data license and estimated sizes. Never begin a long download before confirmation.
4. UI shows `Dataset found` with origin link, pinned SHA, split counts and prominent `Data license: unknown` where applicable; user chooses config, text column, optional label column, train and evaluation partitions, and audit cap.
5. User confirms **Run leakage audit**. A real server-side run starts; UI receives progress through polling or SSE.
6. Live timeline: `metadata verified → rows streamed → normalized → candidates generated → edges accepted → FalkorDB components → cross-split checks → report ready`. Each phase records actual counts/errors and duration.
7. Summary: scanned rows, analysis coverage, confirmed cross-split components **as computed**, candidate pairs for review, no fabricated numbers; chart with actual counts only.
8. User clicks a flagged component: graph reveals connected sample nodes; side inspector shows original split, truncated text and evidence method/score; copyable original row URL if available.
9. User requests **Propose repair**. Agent queries graph first; generates one of the available safe strategies based on official-split policy, group size, label distribution and constraints.
10. Repair page previews `kept / removed / reassigned` counts, group invariant, label distribution changes, before/after conflicts, policy rationale.
11. User clicks **Approve and verify**. Backend generates an immutable proposal bundle; deterministic validator must pass before status becomes `verified`.
12. Evaluation page can run reproducible cheap baseline if enough data/classes exist; otherwise shows exact reason evaluation wasn't run.
13. User downloads a ZIP or individual `report.json`, `manifest.csv`, `edges.csv`, `validation.json`, `run_config.json`, `reproduce.py`, `README.txt`; a dataset-card licensing warning prevents redistributing original text by default.
14. Refresh `/app/runs/[id]` and observe persistent run results recovered from FalkorDB / audit metadata store. The original public dataset is untouched.

## 4.2 Journey B: clean dataset

Scan completes; return `No confirmed cross-split component detected within N audited rows under method/version/thresholds`. No repair CTA as if contamination existed. Offer evidence inspection, semantic-candidate review and an integrity report export. This is a **first-class success state**, not an error or blank screen.

## 4.3 Journey C: incomplete / unsuitable dataset

Clear state and instructions for unsupported columns, no train/test split, protected data, unknown permission, unavailable source, API rate limit, empty class, too many rows, group splitting infeasible, graph failure, model API failure. Preserve partial analysis as `incomplete`; never display “verified clean” for partial scans.

## 4.4 Page: `/app` — Dataset Audit Home

Top area `New audit` button and intro. Real recent runs list: dataset, revision prefix, method, analyzed rows, status, updated timestamp. Empty state teaches how to paste a dataset URL. No fake pre-populated run history.

## 4.5 Page: `/app/new` — Configuration Wizard

**Step 1 Source:** text input, metadata lookup, provenance preview, license badge with explicit source. Validate HF hostname / normalized `owner/name`, not arbitrary SSRF URLs.

**Step 2 Shape:** config/split selectors; text column autodetect (editable); label column optional; optional `group_id` / `document_id` / `source_id` selectors when genuinely present.

**Step 3 Analysis:** `Fast: exact + near` default; `Extended: add semantic candidates` optional; current row limit and coverage, privacy/API note, normalization policy, threshold summary.

**Step 4 Confirm:** show which partitions count as training and evaluation, official benchmark protection policy, expected work, and `Start analysis`.

## 4.6 Page: `/app/runs/[id]` — Analysis Overview

Header: dataset name + revision + run ID, status and `View original dataset`.

Metrics with honest labels: `Analyzed samples`, `Coverage by split`, `Confirmed cross-split components`, `Accepted duplicate relationships`, `Review candidates`, `Run duration`.

Primary action depends on state: `Explore component` if conflicts; `Download clean-scope audit` if clean; `Resolve config error` if blocked; `Inspect partial audit` if incomplete.

**Timeline and tool trace:** selectable timeline events, actual MCP tool names/validated arguments, truncated safe responses, FalkorDB query excerpt, duration, fallback/retries, pending step. LLM narrative must be derived from structured tool results.

## 4.7 Page: `/graph` — Core Wow Screen

Three-column desktop layout:

- **Left:** filters `cross-split`, `same-split`, `needs review`, split types, edge methods, component size, search sample ID; sortable component list.
- **Center:** performant force/controlled-layout graph for the **selected component only**, train nodes forest-green, validation amber, test burgundy; edges styled by method with legend; zoom, fit, keyboard selection; use aggregate for components over configured node limit.
- **Right:** evidence inspector: sample IDs, original source/revision, split, normalized vs source text (controlled, truncated), pair method/hash/Jaccard score and threshold, shortest concrete evidence chain, audit status, report/explanation.

**Do not render all 5,000+ nodes at once**; list/query components server-side and draw 20–150 nodes with pagination/aggregation. Big graph should remain responsive.

## 4.8 Page: `/repair` — Human-approved Action

Two policy tabs:

- **Default / protect official evaluation:** preserve originally designated `test` and `validation` records; remove colliding **train** records from the proposed training manifest. Do not reassign authoritative test rows. If train/train or eval/eval duplicates remain, report them separately; the core cross-boundary invariant is enforced.
- **Alternative evaluation split (opt-in):** group-preserving repartition of *all eligible analyzed samples*, with explicit `Not an official benchmark split` warning. Preserve expected train/val/test proportions and class distribution as feasible, or fail with explanation.

Show per-component proposed action, impacted original row IDs, before/after totals, remaining conflicts, ability to exclude ambiguous edges from auto-repair, and approve button. Never overwrite original HF data.

## 4.9 Page: `/evaluation` — Proof, Not Hype

Tabs:

- **Integrity:** original conflicts vs post-repair conflicts, untouched data assurance, invariant proof and coverage.
- **Detector quality:** reviewed pair confusion table, precision/recall where ground truth exists; don't invent ground truth.
- **Model baseline:** for supported labeled text tasks, original protocol vs audited protocol, same model family/hyperparameters/seeds, all relevant sample counts, evaluation metrics and caveats.
- **Ablation:** exact-hash baseline vs pairwise logic vs graph-group-aware repair; actual wall times and results.

If no training was executed, present `Not run` with reason; avoid empty zero lines.

## 4.10 Page: `/exports` — Reproducible Artifacts

Manifest with SHA256 checksums for each generated file; versioned source commit; detector thresholds; active graph edge types; run metadata; copied Cypher procedure; downloadable ZIP; one-click copy of reproducibility command; README instructions.

---

# 5. MVP FEATURE MATRIX AND PRIORITIES

| Feature | Priority | Must be demonstrated? | Owner |
|---|---|---|---|
| Landing page, navigation, responsive app shell | P0 | Yes | Frontend |
| HF public dataset discovery and pinned revision | P0 | Yes | Ingestion |
| Split/column mapping + coverage | P0 | Yes | Full stack |
| Exact hashes, near-duplicate candidate confirmation | P0 | Yes | Data engineering |
| Real FalkorDB nodes, accepted/candidate typed edges | P0 | Yes | Graph |
| FalkorDB WCC and cross-split finding query | P0 | Yes | Graph |
| Real MCP tool calls and agent decision trace | P0 | Yes | Agent |
| Component graph view + source evidence | P0 | Yes | Frontend/graph |
| Default preserve-official-split repair | P0 | Yes | Integrity |
| Independent verification + exports | P0 | Yes | Integrity |
| TF-IDF + logistic regression baseline (dataset permitting) | P0 if enough labeled data; explicit skip otherwise | Yes on chosen valid example | Evaluation |
| CI, Docker, typed schemas, README, tests | P0 | Yes | Platform |
| Alternative group-preserving repartition | P1 | Optional | Integrity |
| NVIDIA semantic candidates + review | P1 | Optional | Embeddings |
| Advanced Langfuse/Phoenix tracing | P1 | Optional | Platform |
| Dataset license-aware original-row export | P1 | Optional | Platform |
| OAuth, team collaboration, private data, cloud GPU | Out | No | — |

---
# 6. GRAPH ENGINEERING — FALKORDB MUST BE THE HERO

## 6.1 Graph tenancy and partition design

**One FalkorDB graph per analysis run** for MVP, named `leakline_<server_generated_short_id>`; frontend never supplies a raw graph name. This prevents WCC traversing unrelated datasets or analyses and preserves user-level isolation without relying on `WHERE` filters (which many graph algorithms do not apply to the internal traversal). A separate metadata/authorization index maps `(workspace_id, analysis_id)` to graph name. The actual analysis graph stays in FalkorDB.

Do **not** combine all users' `Sample` nodes into one giant graph and then call `algo.wcc({nodeLabels:['Sample'], relationshipTypes:['CONFIRMED_DUPLICATE_OF']})`—that would risk mixed components across runs if IDs/relationships were faulty. For a hosted multi-tenant deployment, harden graph ACLs and scope database credentials; graph naming alone is not an authentication boundary.

**Graph ownership:** per-run graph holds original source descriptors, sample nodes, relation edges, accepted reviewer decisions, component snapshots, repair plan, evaluation records and tool-action audit. Binary/full dataset tables and downloads live in controlled artifact storage, not arbitrarily on graph properties. Store abbreviated source excerpts only if permitted by license/policy. No ingestion of personally identifying content.

## 6.2 Typed graph ontology

**Nodes**

| Label | Required attributes | Purpose |
|---|---|---|
| `DatasetRevision` | `dataset_id`, `revision_sha`, `config`, `source_url`, `license_status` | Immutable imported source context |
| `Split` | `name`, `role`, `total_count`, `analyzed_count` | Original split and analysis coverage |
| `Sample` | `sample_id`, `row_index`, `split`, `text_hash`, `label_value`, `normalized_len` | One auditable source row |
| `PairEvidence` | `pair_id`, `method`, `score`, `threshold`, `version`, `status`, `reviewer`, `created_at` | Exact basis for a pair judgment |
| `Component` | `component_key`, `size`, `split_roles`, `crosses_boundary`, `computed_at`, `algorithm_version` | Snapshot of algorithm results |
| `AnalysisRun` | `analysis_id`, `status`, `started_at`, `completed_at`, `source_sha`, `config_hash`, `coverage` | Audit and reproducibility |
| `RepairPlan` | `plan_id`, `policy`, `status`, `approved_at`, `manifest_checksum` | Proposed/approved immutable repair |
| `AgentStep` | `step_id`, `tool`, `arguments_digest`, `result_digest`, `status`, `duration_ms`, `started_at` | Tool-use trace and decision evidence |
| `EvaluationRun` | `evaluation_id`, `protocol`, `seed`, `status`, `metrics_uri`, `code_hash` | Reproducible verification |

**Edges**

| Relation | From → To | Semantics |
|---|---|---|
| `HAS_SPLIT` | DatasetRevision → Split | Source dataset membership |
| `CONTAINS` | Split → Sample | Immutable original row split |
| `HAS_PAIR_EVIDENCE` | Sample → PairEvidence | Pair evidence anchor; evidence node also points to second sample |
| `CONCERNS` | PairEvidence → Sample | The second endpoint of an evaluated pair |
| `CONFIRMED_DUPLICATE_OF` | Sample → Sample | **Only approved / deterministic** similarity/provenance rule; traversed by WCC |
| `POSSIBLY_SIMILAR_TO` | Sample → Sample | Candidate-only; **never included in WCC repair eligibility** |
| `IN_COMPONENT` | Sample → Component | Materialized WCC result; recalculated if accepted edge state changes |
| `GENERATED` | AnalysisRun → PairEvidence/Component | Provenance of graph computation |
| `PROPOSES` | AnalysisRun → RepairPlan | Action derived from this run |
| `AFFECTS` | RepairPlan → Component | Which protected groups drive a proposed change |
| `EXECUTED_TOOL` | AnalysisRun → AgentStep | Actual agent tool trail |
| `VERIFIED_BY` | RepairPlan → EvaluationRun | Validation result |

**Optimization note:** The `PairEvidence` node and the direct `CONFIRMED_DUPLICATE_OF` edge are deliberate duplication with different jobs: WCC operates on **only Sample-to-Sample accepted edges**, while evidence nodes retain scores/rationale/review history. The edge carries `pair_id`, `method`, `policy_version` for direct provenance. If review retracts one edge, create a new graph-analysis version or delete the direct accepted edge with an explicit audit event and **recompute components**; never preserve stale component assignments.

## 6.3 Stable identity and integrity rules

- Sample ID: SHA-256 of `dataset_id | revision_sha | config | split | row_index`; **not** hash of text alone (text equality is a relationship, not sample identity).
- Pair ID: SHA-256 of `min(sample_id), max(sample_id), detector_version, config_hash` under a canonical ordering.
- Analysis ID and graph name minted server-side; assert authenticated workspace ownership on every API and MCP operation.
- A sample may have zero accepted similarity edges; it must still be represented as a singleton component.
- Never connect across dataset revisions in one analysis graph unless there is an explicit version-comparison workflow (out of scope).
- Candidate edge ≠ confirmed duplicate edge. Threshold policy and review status are immutable in the run manifest.
- WCC component IDs can be implementation-dependent; don't treat returned integer IDs as stable across re-runs. Build canonical `component_key` from sorted sample IDs + policy hash.
- Original dataset rows/split designations never mutate. Proposed assignments stored in new manifest.
- Exported claims must resolve to pair methods and original sample IDs; orphan conclusions are invalid.

## 6.4 Official-documentation-shaped Python client snippet

The official FalkorDB repository illustrates this client pattern [S5]:

```python
from falkordb import FalkorDB

db = FalkorDB(host="localhost", port=6379)
graph = db.select_graph("leakline_example")  # In production, server-generated graph name.
result = graph.query("MATCH (s:Sample) RETURN count(s) AS count")
print(result.result_set)
```

**Status:** This is a **docs-derived integration sketch**, not a claim that this PRD ran the code. Pin tested `falkordb` client and Docker image version in the project lockfiles.

## 6.5 Required Cypher: ingest / exact matches / path display

**Create source and a sample (parameterized, pseudocode-compatible shape)**:

```cypher
MERGE (d:DatasetRevision {dataset_id: $dataset_id, revision_sha: $revision_sha, config: $config})
MERGE (sp:Split {name: $split})
MERGE (d)-[:HAS_SPLIT]->(sp)
MERGE (s:Sample {sample_id: $sample_id})
SET s.row_index = $row_index,
    s.split = $split,
    s.label_value = $label_value,
    s.text_hash = $text_hash,
    s.normalized_len = $normalized_len
MERGE (sp)-[:CONTAINS]->(s)
```

**Accepted pair linkage (only after deterministic confirmation / explicit review):**

```cypher
MATCH (a:Sample {sample_id: $a_id}), (b:Sample {sample_id: $b_id})
WHERE a.sample_id <> b.sample_id
MERGE (a)-[r:CONFIRMED_DUPLICATE_OF {pair_id: $pair_id}]->(b)
SET r.method = $method,
    r.score = $score,
    r.policy_version = $policy_version
```

**Critical: all pair insertions should use a canonical `a_id < b_id` ordering in Python. Query identifiers remain parameterized, and batch `UNWIND` performance should be integration-tested rather than assumed.**

**Compute WCC inside FalkorDB (docs-backed algorithm shape [S6]):**

```cypher
CALL algo.wcc({
  nodeLabels: ['Sample'],
  relationshipTypes: ['CONFIRMED_DUPLICATE_OF']
})
YIELD node, componentId
RETURN node.sample_id AS sample_id,
       node.split AS original_split,
       componentId
```

In actual implementation, the backend groups returned rows by `componentId`, includes singletons, creates canonical stable keys, stores `Component` nodes and `IN_COMPONENT` relationships, then checks whether a component contains samples on both sides of a **configured train vs evaluation** boundary. Do not infer that all multi-split overlaps represent the same harm: train/test is the primary concern; val/test or train/validation are separately reported with the chosen policy.

**Sample audit query after materialization:**

```cypher
MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component)
WHERE c.crosses_boundary = true
RETURN c.component_key AS component,
       count(s) AS size,
       collect(DISTINCT s.split) AS original_splits
ORDER BY size DESC
LIMIT $limit
```

**Evidence chains for one selected component:**

```cypher
MATCH p=(a:Sample {sample_id: $source_id})
        -[:CONFIRMED_DUPLICATE_OF*1..6]-(b:Sample {sample_id: $target_id})
RETURN p
LIMIT 1
```

This is a **bounded undirected path-pattern illustration**; Cypher variable-length path/return support must be integration-tested against the pinned FalkorDB engine. For longer components, use tested BFS or a bounded application-layer path traversal over actual FalkorDB neighbor query results; don't claim a 6-hop cap covers the entire component. The UI must distinguish `path not displayed within limit` from `not connected`.

## 6.6 The real graph-shaped product insight

**Example solely for explaining the algorithm (NOT public-demo source data):**

- Sample A in train, B in train, C in test.
- Approved relationships: A—B and B—C, but A—C has no direct edge.
- Pairwise A-vs-C-only logic can miss the broader group. WCC returns `{A,B,C}`; policy says the group cannot be split across the protected boundary.
- With protected official test C, default policy drops **both A and B from proposed train** when all three are in the same confirmed duplicate group. This is a deliberately **conservative group-level policy**, potentially removing more training data than dropping only directly matching train rows.
- The UI shows which graph path caused each removal, the scope/cost of conservative action and an alternative requiring human review. Never quietly label these all “identical.”

## 6.7 Graph tests and failure proof

1. WCC receives only `CONFIRMED_DUPLICATE_OF` type (never `POSSIBLY_SIMILAR_TO`).
2. Four samples with A—B—C, isolated D: WCC yields a group of 3 and singleton D (fixture in automated test only).
3. Two separate run graphs with same source dataset but distinct policies never contaminate one another.
4. Retracting an approved edge invalidates and recomputes component materialization before any repair approval.
5. Graph down ⇒ run blocks at `graph_unavailable`, **not** fallback to a Python-only repair masquerading as FalkorDB.
6. Cypher output stable enough for same evidence graph and policy; canonical component key stable across algorithm numerical IDs.
7. Evidence graph query returns the actual nodes/edges used by agent decisions, including provenance references.
8. Heavy component query has max node/edge/timeout budget; no arbitrary prompt-controlled Cypher writes.

---

# 7. DATA INGESTION, DEDUPLICATION AND EVIDENCE ENGINE

## 7.1 HF dataset discovery contract

Support `https://huggingface.co/datasets/owner/name` and canonical `owner/name` only. Normalize owner/repo carefully; reject unexpected domains, paths, protocols, embedded credentials and redirects to unsafe destinations. Metadata calls use Hugging Face official API. Resolve requested branch/tag to **a commit SHA**, record it, and download from **that exact revision**. For Dataset Viewer API, `/splits` discovers configs; `/first-rows` previews columns; `/rows` supports up to 100 rows per call [S15]. For robust pinned loading, use `datasets.load_dataset(repo_id, name=config, revision=sha)` [S17], with strict loading format policy. Never allow executing remote dataset loading scripts or untrusted code. For a hosted MVP, disallow datasets needing remote scripts and unsupported formats.

Data access constraints: public, permitted and non-sensitive content only; cannot promise that every publicly downloadable dataset is legally redistributable. Display source license and user confirmation. The Rotten Tomatoes card currently labels its license `unknown` [S19]; permit technical inspection where allowed by policy but do not assume redistribution rights. By default exported manifest references rows by source ID and includes hashes only, not all raw text.

## 7.2 Coverage and sampling

- Recommended hackathon cap: **5,000 total rows per run** configurable to machine capacity; maximum selected **per split** and overall explicitly shown.
- If source exceeds cap, choose **reproducible stratified-by-split sampling** with a fixed seed where supported, record exact selected row IDs and per-split fraction. Never describe partial sample as “full dataset clean.”
- Recognize that sampling can miss cross-split relationships. For demos with modest source size, allow full coverage when compute permits; **do not claim zero contamination on unexamined rows**.
- For source changes, new revision ⇒ new run graph. No silent mixing.
- Stream metadata / limit preview before materializing; enforce memory/time caps and cancellation.

## 7.3 Normalization v1

Provide named deterministic versions:

- `strict-v1`: Unicode NFKC, normalize whitespace, trim; preserve punctuation and case for hash depending on source policy.
- `lenient-v1`: strict plus casefold and whitespace normalization; flag any aggressive transform.
- Do not strip numbers/negation, translate or stem by default. For sentiment data, removing “not” can turn opposite labels into apparently same observations.
- Save both `sha256(raw bytes/text)` and `sha256(normalized text)`, char length, token count, normalization version and source index.

## 7.4 Duplicate evidence acceptance policy

**Tier A — exact deterministic**

- Same normalized SHA-256 (`strict-v1`) ⇒ accepted exact relation. Preserve raw hash and original length to diagnose normalization collisions and mismatches.
- Exact same normalized text with **conflicting labels** ⇒ especially valuable quality flag; do not silently pick a label. Repair/evaluation strategy can quarantine affected group.

**Tier B — confirmed high-overlap near duplicates**

- Candidate retrieval: 5-character shingle MinHash LSH (`datasketch`) with seeded permutations; pipeline quality depends on recall, so store candidate coverage/method and evaluation set.
- Candidate confirmation: direct deterministic shingle Jaccard ≥ configurable **0.90 by default** with minimum meaningful text length and minimum shingle count, plus review exceptions. Threshold is a product policy to evaluate, **not a universally correct scientific definition**.
- Edge accepted only after deterministic threshold and guardrails, or explicit human review; store score, detector version, evidence and policy.
- Negation-sensitive or conflicting-label candidate gets **needs review**, even with high Jaccard, unless exact text and explicit deterministic duplicate policy permit grouping; never automatically rewrite the ground truth label.

**Tier C — semantic candidates (P1)**

- Optional NVIDIA NIM embedding model; record provider, exact model, dimensions, request metadata, score, threshold, and sample budget.
- Embedding similarity produces `POSSIBLY_SIMILAR_TO` only. LLM may suggest whether to review; it is not final arbiter. Semantic links never enter protected WCC unless a human explicitly approves a new reviewable edge, with an audit reason and new analysis version.

**Tier D — explicit source provenance (P1 if fields exist)**

- If dataset supplies stable `document_id`, `conversation_id`, `record_group`, or original source URI, use user-approved grouping rules and record exact metadata origin.
- A shared document ID may warrant grouping even if text content differs; report its separate provenance category rather than implying text duplication.

## 7.5 Performance strategy

- Compute exact hashes O(n), index hash→row IDs; generate candidate pairs from duplicate buckets.
- MinHash LSH reduces quadratic candidate enumeration but may miss matches; evaluate recall on a sampled independently labeled set when feasible.
- Deduplicate pair IDs before writing; batch writes; retry with idempotent MERGE.
- Use WCC on the accepted-similarity projection; benchmark graph operations separately from ingestion and embeddings.
- Isolate graph algorithm workloads per run; never share mutable computed components across policy versions.

## 7.6 Edge review and re-evaluation

UI actions: `Accept pair`, `Reject pair`, `Needs review`, `Revert decision`. Reviewer decision changes accepted edge set only after backend validation, appends an audit event, marks component snapshot `stale`, runs WCC again, recomputes contamination findings and invalidates any pending repair proposal. Rejected candidate edges remain in evidence/audit history but are ineligible for repair.

## 7.7 Definition of “leakage found”

The phrase `confirmed cross-split duplicate component` applies only when at least one **accepted deterministic or explicitly reviewed relationship** links source samples across the configured train↔eval partition (directly or transitively). Phrasing `potential semantic overlap` is reserved for unapproved semantic candidates. These are different statuses in both API and UI.

---

# 8. AGENT ENGINEERING AND MCP — REAL, BOUNDED AUTONOMY

## 8.1 Architecture principle

Let the LLM decide **which investigation tool to call next, what question to resolve, whether a review is needed and how to explain observed evidence**. Do **not** give it control over mathematical definitions, original data, raw graph writes, deleting rows, arbitrary code execution or evaluation scores. Deterministic Python enforces all grouping/repair policies. Agent is meaningful because different observed graph conditions lead to different tool choices and user actions.

## 8.2 Agent state machine

`NEW → SOURCE_VERIFIED → INGESTED → CANDIDATES_READY → GRAPH_READY → COMPONENTS_COMPUTED → FINDINGS_READY → AGENT_REVIEWING → (AWAITING_HUMAN_REVIEW | REPAIR_ELIGIBLE | CLEAN_SCOPE | INCOMPLETE) → PROPOSED → APPROVED → VALIDATING → VERIFIED | VALIDATION_FAILED → EVALUATED | EVAL_SKIPPED → EXPORTED`.

A run record stores bounded retries, tool call log, model/prompt version and decision trace. Allowed states are enforced server-side. Partial failures never advance to “complete” based on LLM prose.

## 8.3 MCP architecture

**Recommended MVP:** a dedicated Leakline MCP server exposing **named, typed, narrowly scoped high-level tools** that call a FalkorDB adapter. This qualifies as actual MCP tool selection while restricting raw graph access. Optionally run FalkorDB's official MCP server as a separate **read-only auditor**; its `query_graph` tool supports `readOnly`, and its `FALKORDB_DEFAULT_READONLY=true` setting is documented [S7–S8]. Do not expose arbitrary `query_graph` writes or delete-graph tools to the application LLM.

- `inspect_dataset_graph(analysis_id)` → observed split counts, source revision, graph status, coverage.
- `find_cross_split_components(analysis_id, min_size, limit)` → component summary from **FalkorDB WCC/materialized result**.
- `inspect_component_evidence(analysis_id, component_key, max_nodes)` → exact accepted edges, source IDs, scores, paths, ambiguous candidates.
- `find_conflicting_labels(analysis_id, component_key?)` → groups with inconsistent labels.
- `compare_repair_policies(analysis_id, policy_set)` → read-only cost simulations and feasibility from actual groups.
- `propose_repair(analysis_id, policy)` → writes **draft plan**, not final approved manifest; validates policy.
- `validate_repair(analysis_id, plan_id)` → deterministic invariant checks and signed/hashed validation artifact.
- `run_baseline_evaluation(analysis_id, plan_id, evaluation_config)` → bounded local evaluation worker (only after explicit approval).
- `export_audit_bundle(analysis_id)` → read-only packaging of actual immutable artifacts.

**Track 01 minimal proof:** after scan, model chooses between `find_cross_split_components` and `inspect_component_evidence`, then chooses to `propose_repair` only when eligible. On clean data, it chooses `export_audit_bundle`, not fake repair. On conflict labels, it chooses review. Screenshot/video captures real MCP JSON tool traffic or derived event records.

## 8.4 Model selection

Primary provider: **OpenRouter** (user already has key) with a currently accessible model capable of tool calls and strict structured response. Record exact model identifier resolved at runtime. **AIML API** is optional fallback; **NVIDIA NIM** optional for embeddings. Model IDs/endpoints must be confirmed through provider docs/account at implementation time; don't hardcode an unavailable name or advertise an untested model.

A custom **bounded harness** is preferable to adding LangGraph, Graphiti, Cognee and multiple agents just for hype: max ~12 investigation tool calls, bounded context, request timeout, max token budget, retry/backoff, schema validation, explicit tool allowlist, no arbitrary code tool, prompt injection defense for external source text.

**Agent output schema (Pydantic example):**

```python
from typing import Literal
from pydantic import BaseModel, Field

class InvestigationDecision(BaseModel):
    action: Literal["inspect_more", "request_review", "propose_repair", "export_clean_audit", "abstain"]
    component_keys: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    confidence_label: Literal["deterministic", "review_needed", "unknown"]
```

Backend rejects any evidence IDs absent from the graph; model cannot invent component IDs. Any `propose_repair` decision still goes through deterministic preconditions and human approval.

## 8.5 Actual run trace data model

Each invocation stores `timestamp`, `run_id`, `step_id`, `tool_name`, `schema_version`, *redacted validated arguments*, `query_id`, `source_component_keys`, `elapsed_ms`, `result_digest`, `status`, `error_code`, `next_decision`, model ID where relevant. Side panel uses those records; never reconstruct a story from scratch after completion.

## 8.6 Security and trust boundaries

- Dataset text is **untrusted data** and never interpreted as app/system instructions.
- User-supplied URLs constrained to Hugging Face dataset identifiers and official API hostname; protect against SSRF.
- Prefer not to transmit full raw sample text to external LLM providers; pass hashes/short excerpts only when user explicitly opts in and dataset permits it.
- Rate-limit each run/workspace; max rows/tokens/graph size; quota-aware errors.
- No user secrets in tool logs or browser JSON; env vars server-side only.
- Human-gated repair and evaluations; never auto-publish or delete originals.
- MCP tools receive server-bound graph name from authorization layer, never prompt-bound graph names.
- Validate prompts/outputs against actual graph schema; don't allow model-authored Cypher string execution in production.

## 8.7 Why NOT required in core stack

- **GraphRAG/RAGAS:** dataset-pair integrity is not retrieval-augmented answer QA; optional documentation chat only.
- **Jev:** decision classification convenience, not essential to correctness; add only if real measured benefit.
- **Multiple agent personalities:** no demonstrated benefit; one bounded investigator is more reliable.
- **LLM-as-judge:** optional review aid; not acceptance oracle or scientific ground truth.
- **NVIDIA embeddings:** P1 candidate discovery; never substitute cosine score for verified leakage.
- **Langfuse/Phoenix:** optional deep traces; app must already store reliable native tool traces.

---

# 9. REPAIR ENGINE — RULES BEFORE LANGUAGE MODELS

## 9.1 Repair contract

Inputs: immutable original source indices, accepted connected-component mapping from FalkorDB, original split roles, label values, repair strategy, policy version and explicit user approval. Outputs: immutable new row assignment manifest, approval record, constraints/cost report, deterministic validation receipt. No mutation to the original dataset.

## 9.2 Policy A — protect original test/validation (P0 recommended)

1. Identify every accepted WCC component containing at least one original `train` and at least one protected evaluation sample (`test`, or `validation` if selected).
2. Preserve **all original protected evaluation samples** at their original roles and indices.
3. Mark **all train rows in those components** excluded from the proposed training manifest. Explain that this is a **conservative group-level** policy; compare cost versus pairwise-only removal.
4. Components with training-only samples remain train (subject to separate dedup policy out of scope). `test` and `validation` overlapping each other remain an explicitly reported concern; we must not claim all evaluation-to-evaluation overlap was repaired if only train/eval separation was enforced.
5. For any component containing both `train`, `validation` and `test`, show the exact retained status and residual val/test overlap; do not say “all splits clean” unless the chosen broader constraint has been checked.
6. If removing training rows makes training impossible (empty class or too few samples), mark `infeasible`, propose review or alternative evaluation protocol; do not fake a clean model run.

**Guarantee:** Under the accepted edge graph, no component containing a protected eval row also retains any proposed training row. This is a graph-relative invariant, not a global proof of independence.

## 9.3 Policy B — alternate grouped repartition (P1)

- Treat entire WCC component as indivisible group; singletons as groups of one.
- Use group-aware splitting with fixed seed; strive for label balance using `StratifiedGroupKFold` or a custom constrained group assignment, with reported deviations.
- Mark scores **alternative benchmark / not comparable to original leaderboard**.
- If a group has mutually contradictory labels or is too big to distribute feasibly, require review or fail deterministically.
- Never assert `GroupShuffleSplit` automatically stratifies labels; test class balance explicitly.

## 9.4 Approval and immutable versions

Draft plan obtains config/graph version stamp. On user approval, backend verifies the graph version has not changed since draft. If a reviewer changes any edge, invalidate proposal and ask to recalculate. Persist artifact checksums, approval timestamp, policy rules and affected group IDs. Treat click approval as consent to export a manifest, **not** to modify source dataset.

## 9.5 Verification receipt

`validation.json` contains at least:

```json
{
  "analysis_id": "<server-generated>",
  "source_dataset_id": "<real-dataset-id>",
  "source_revision_sha": "<actual-commit-sha>",
  "analyzed_row_count": "<integer>",
  "coverage_by_split": "<actual-fractions>",
  "edge_policy_hash": "<sha256>",
  "graph_algorithm": "algo.wcc",
  "repair_policy": "protect_original_evaluation_v1",
  "approved_at": "<timestamp-or-null>",
  "cross_boundary_components_before": "<integer>",
  "cross_boundary_components_after": "<integer>",
  "invariant_pass": "<boolean>",
  "license_and_scope_notes": "<text>",
  "manifest_sha256": "<sha256>"
}
```

Placeholders intentionally indicate **schema design, not fabricated output**. Numeric fields in actual JSON must have numeric types, not strings; use concrete Pydantic schemas. A `verified=true` status requires a persisted, independently executed validation result with an actual zero for the chosen invariant.

---
# 10. ML EVALUATION AND SCIENTIFIC VALIDITY

## 10.1 What to measure — and what never to imply

- **Primary actual invariant:** approved graph components crossing configured train→protected-evaluation boundary before and after a proposed manifest.
- **Scope:** report audited row count by split, fractional coverage, excluded rows, accepted/candidate edges, singleton components and graph computation time.
- **Detector assessment:** where human-labeled pairs exist, measure pair-level precision and recall; a few visually convincing examples do not establish detection accuracy.
- **Downstream classifier:** report measured train/test performance under explicit protocols; do not claim the difference is entirely caused by leakage.
- **Test-only fixtures:** deterministic tiny graph examples to validate algorithms; never blend them into the externally sourced demonstration dataset or claim they are discovered cases.
- **Reproducibility:** same source commit, sampled row IDs, preprocessing, threshold version, split policy, seed, library lockfile and training configuration.

## 10.2 Evaluation protocol 1 — protected official test, retrain (preferred)

For a public **binary text classification** dataset with sufficient data:

1. Load and pin the original source revision and actual train/test rows.
2. Train **Model A**: `TfidfVectorizer` + `LogisticRegression` with an explicit fixed random seed, fixed hyperparameters, pipeline fitting only on original train. Evaluate on untouched original test.
3. Produce Policy A safe manifest from FalkorDB groups; **retain exactly the original test rows**.
4. Train **Model B from scratch** with identical model/pipeline hyperparameters and seeds, on the proposed decontaminated train manifest. Evaluate on the same untouched original test.
5. Record class distribution, sample counts, accuracy, macro-F1, precision/recall when applicable, and elapsed time.
6. Label difference honestly: training data quantity/composition changed and may explain some/all metric differences; do **not** assert a causal reduction in memorization without supporting experiments.
7. If audited training loses an entire class or source labels are insufficient, abort model evaluation with a typed reason; integrity audit can still complete.

**Why this is scientifically better than changing both sides:** Both models are judged on the *same official test distribution*. This does not eliminate all confounders—model training data changes—but makes the comparison much clearer than silently replacing the test split.

## 10.3 Evaluation protocol 2 — alternate group split (optional)

Retrain baseline under a **new group-preserving** split using exactly documented group allocations; compare against a random-row split performed on the same scoped pool, and report that evaluation sets differ. Do not represent alternative-split score as comparable to official leaderboard scores. Recommended only after Policy A ships.

## 10.4 Evaluation protocol 3 — detection / graph ablations

Three separate ablations:

**A. Method ablation:** hash-only vs verified near-duplicate edges, same source/sampling scope. Measures added detection *evidence*; not solely graph quality.

**B. Graph ablation:** use the **same accepted pair edges** for both pair-only and WCC algorithms. Pair-only model must be specified, e.g. treats each detected pair independently without transitive closure, and can violate group-preservation; WCC does not. Report conflicts under each strategy using an **independent graph-invariant validator**; do not cherry-pick mismatched inputs.

**C. Agent ablation:** graph tool results enabled vs a no-graph state. Without FalkorDB, Leakline must decline a group-based repair; compare completeness, tool selection, and audit trace—not model-generated confidence scores.

## 10.5 Benchmarks and artifact versioning

- Pin hardware class, CPU/RAM, source sample counts, `falkordb` server image digest, client/library versions and warm/cold run condition.
- Track ingestion time, candidate generation time, graph insertion time, WCC execution time, agent overhead, repair verification time and ML evaluation time separately.
- Do not promise sub-millisecond end-to-end run times because FalkorDB documentation discusses traversal performance only, not complete ingestion pipeline timings.
- Give the judge downloadable `benchmarks.json` or `metrics.csv` with actual timestamped runs, not a fabricated impact infographic.

---

# 11. API AND DATA CONTRACTS — FASTAPI

All endpoints are prefixed `/api/v1`; timestamps UTC ISO-8601, server-trace `request_id`, consistent error codes, authorization / rate limit / validation at API boundary. `run_id` server-generated. **Do not accept arbitrary FalkorDB graph name or local file path in API payloads.**

## 11.1 REST resources

| Method | Endpoint | Purpose | Notes |
|---|---|---|---|
| `POST` | `/datasets/inspect` | Validate HF dataset ID, discover config/splits/schema/commit/license | metadata only, safe source allowlist |
| `POST` | `/runs` | Create queued run using pinned source/config, analysis policy | idempotency key; body validated |
| `GET` | `/runs` | List actual user/workspace runs | cursor pagination |
| `GET` | `/runs/{id}` | Status, coverage, real metrics, links | never fake defaults |
| `GET` | `/runs/{id}/events` | Incremental progress/trace | SSE or cursor-based polling |
| `GET` | `/runs/{id}/components` | WCC-derived component pagination | filters, sort, top-K |
| `GET` | `/runs/{id}/components/{key}` | Component evidence, bounded graph nodes/edges | source row IDs + method |
| `POST` | `/runs/{id}/pairs/{pair_id}/review` | Accept/reject candidate edge | invalidates current snapshot |
| `POST` | `/runs/{id}/repair-proposals` | Draft policy-specific plan | graph version precondition |
| `GET` | `/runs/{id}/repair-proposals/{plan_id}` | Review impact/cost/constraints | read-only |
| `POST` | `/runs/{id}/repair-proposals/{plan_id}/approve` | Human approval + validation | if-match graph version |
| `POST` | `/runs/{id}/evaluations` | Run bounded ML baseline after approval | concurrency-limited |
| `GET` | `/runs/{id}/evaluations/{eval_id}` | Real results/skip/error | version-specific |
| `GET` | `/runs/{id}/exports` | List files and checksums | provenance |
| `GET` | `/runs/{id}/exports/{filename}` | Authorized artifact download | fixed allowlist filenames |
| `POST` | `/runs/{id}/cancel` | Best-effort stop pending work | preserve partial results |
| `GET` | `/health/ready` | Health & FalkorDB dependency check | no key leakage |

## 11.2 Request/response examples — contracts, NOT example live results

```json
// POST /api/v1/datasets/inspect request
{
  "dataset": "cornell-movie-review-data/rotten_tomatoes"
}
```

```json
// POST /api/v1/runs request
{
  "dataset_id": "cornell-movie-review-data/rotten_tomatoes",
  "revision_sha": "<sha-from-inspect-response>",
  "config": "default",
  "text_column": "text",
  "label_column": "label",
  "train_splits": ["train"],
  "protected_evaluation_splits": ["test"],
  "audit_limit": 5000,
  "audit_seed": 42,
  "normalization_policy": "strict-v1",
  "detectors": ["exact_hash", "minhash_verified"],
  "near_duplicate_jaccard_threshold": 0.90,
  "semantic_candidates_enabled": false
}
```

```json
// Representative response SHAPE only, not a recorded analysis
{
  "analysis_id": "<uuid>",
  "status": "queued",
  "dataset_id": "<dataset-id>",
  "revision_sha": "<sha>",
  "links": {
    "self": "/api/v1/runs/<uuid>",
    "events": "/api/v1/runs/<uuid>/events"
  }
}
```

**Error contract:** `source_unavailable`, `forbidden_dataset`, `license_review_required`, `invalid_dataset_url`, `no_supported_splits`, `unsupported_column`, `audit_budget_exceeded`, `partial_ingest`, `graph_unavailable`, `component_stale`, `infeasible_repair`, `missing_eval_labels`, `external_model_unavailable`, `evaluation_timeout`, `quota_exceeded`. Error responses include recoverable next action and never misreport success.

## 11.3 Backend implementation layout

```text
leakline/
  apps/
    web/                         # Next.js app router, TypeScript, Tailwind, shadcn/ui
      app/(public)/page.tsx      # Landing
      app/(public)/methodology/
      app/app/new/
      app/app/runs/[id]/
      app/app/runs/[id]/graph/
      app/app/runs/[id]/repair/
      app/app/runs/[id]/evaluation/
      app/app/runs/[id]/exports/
      components/
        landing/
        dataset-form/
        run-timeline/
        graph-canvas/
        evidence-inspector/
        repair-diff/
        evaluation-charts/
        mcp-trace/
      lib/api.ts
      lib/types.ts
  services/
    api/
      app/main.py
      app/api/{datasets,runs,components,repairs,evaluations,exports}.py
      app/schemas/{datasets,runs,graph,agent,repair,eval}.py
      app/core/{config,security,auth,rate_limit}.py
      app/data/{hf_loader,normalization,exact,near_duplicates,semantic}.py
      app/graph/{client,ontology,ingest,wcc,queries,materialize}.py
      app/agent/{harness,provider,mcp_client,tools,policies}.py
      app/repair/{planner,validator,manifest}.py
      app/eval/{classifier,protocols,ablation,metrics}.py
      app/jobs/{runner,status}.py
      app/storage/{artifacts,metadata}.py
      tests/
    mcp/                        # Named MCP tool server and schemas
      server.py
      tools.py
      tests/
  packages/
    contracts/                  # shared OpenAPI-derived frontend types
  scripts/
    smoke_dataset.py
    reproduce_run.py
    check_falkordb_capabilities.py
    verify_bundle.py
  benchmarks/
    README.md
    cases.yaml                  # only real source URLs/revisions, no fabricated outcomes
  docs/
    graph-schema.md
    algorithms.md
    scientific-limitations.md
    submission.md
    agent-and-mcp.md
    demo-script.md
  docker-compose.yml
  .env.example
  .gitignore
  README.md
  CONTRIBUTING.md
  LICENSE
```

## 11.4 Run orchestration and persistence

Do not execute ingestion, LSH, graph WCC and model training in an HTTP request handler. Use a bounded background worker *inside the running application* (e.g. durable queue + worker process, or documented lower-complexity single-worker executor) and persisted job states. Streaming/Polling reports progress; HTTP request returns accepted run ID promptly. Checkpoints permit resumable stages where safe; immutable run configuration prevents silent replay against changed dataset revision.

- **Database:** FalkorDB primary graph and decision record. **Allowed ancillary store:** SQLite (or Postgres) for session/workspace metadata, job leases, file metadata and authentication; it must **not compute duplicate components**.
- **Files:** local mounted artifact storage for hackathon. No public, anonymous raw data exports by default.
- **Events:** run status/event ledger persisted, versioned, idempotent stage completion.
- **Service limits:** default one heavy analysis at a time per workspace; safe queueing / cancellation; no unlimited external calls.

## 11.5 SSE/polling fields

`event_id`, `analysis_id`, `phase`, `status`, `observed_count`, `expected_count_or_null`, `message_code`, `tool_step_id_or_null`, `timestamp`, `error_or_null`. Browser displays exact server event state. No progress bar claiming 100% until all required steps have committed.

---

# 12. FRONTEND PRODUCT DESIGN — IMPLEMENTATION-LEVEL SPEC

## 12.1 Component blueprint

| Component | Exact behavior | Failure/empty state |
|---|---|---|
| `LandingHero` | Real CTAs + conceptual mini-graph marked illustrative | Works without backend; never claims a run |
| `DatasetSourceInput` | trim/normalize HF path; inspect on Enter/click | API offline / bad URL / private/gated handled |
| `DatasetMetadataPanel` | source revision, configs, splits, columns, license | unknown license warning |
| `AuditPolicyPicker` | exact/near default, protected splits, sampled vs full notice | invalid thresholds disabled |
| `RunProgressTimeline` | actual events with timestamps, retries, canceled state | no invented percentage |
| `AuditSummaryMetrics` | real counts and coverage, optional stats if measured | `—` for not computed; not `0` |
| `ComponentList` | paginated sorted anomalies with split summary | clean-state message |
| `GraphCanvas` | selected bounded graph; edges by evidence type; node focus | aggregation or “graph unavailable” |
| `SampleEvidenceInspector` | original split/ID, policy, matching method, path, source link | missing text due to license preserved |
| `MCPTracePanel` | actual tool names, validated params, result hashes, elapsed ms | hide secret values |
| `RepairPolicySelector` | protect official split default, alternative experimental label | infeasible explains reason |
| `RepairPreviewDiff` | actual row moves/exclusions, counts, label effects, affected components | pending approval and stale version warning |
| `ValidationReceipt` | only green when deterministic validation passed | explicit violations + JSON download |
| `EvaluationPanel` | charts for actual metrics with methodological notes | `not run` state |
| `ExportPanel` | checksums, file names, provenance | unavailable when generation failed |

## 12.2 Landing layout dimensions and polish

- Max page width 1180–1240px, generous cream negative space, 1px warm-neutral borders, pill CTA in dark forest-green, subtle background line motifs allowed.
- Hero two-column on desktop: left value proposition (~48%), right live conceptual graph/stepper (~52%). Stack on mobile, CTA stays above fold as possible.
- Nav sticky but unobtrusive; anchored sections; no looping heavy animations, autoplay particles or “fake streaming agent” effects.
- Use real product screenshots **only after the underlying workflow exists**. Before then show labeled conceptual wireframes.
- CTA as functional navigation—not decorative. All footer links resolve.
- Include a `Methodology` link near every result; credibility matters more than “AI magic.”

## 12.3 Graph interaction details

- Controlled zoom and fit; edge click opens exact provenance; node click opens sample preview; shift-select two nodes to show bounded path through *approved* edges.
- Filters never change the computed WCC/repair policy; they only change rendering. Display `view filters ≠ repair eligibility` information.
- Visual badges distinguish `Accepted exact`, `Accepted near`, `Semantic review candidate`, `Conflicting labels`, `Protected evaluation sample`.
- Clicking a candidate edge offers human-review action; accepted edge recomputes WCC and repair eligibility, with stale results clearly marked while processing.
- For component size over node cap, show component summary and sampled representative nodes, label “partial rendering”; user can page through members.
- Graph should render with server-supplied stable node IDs and no inferred layout connections. No frontend-generated fake relationship edges.

## 12.4 Accessibility, responsiveness and copy

- WCAG-friendly contrast and keyboard controls; chart alt text/accessible data table; icons with labels; non-color status indicators.
- Mobile graphs may show scrollable evidence list instead of tiny unreadable full canvas.
- Status language: `Potential overlap`, `Confirmed under rule`, `Needs review`, `Verified within audited scope`, `Incomplete`; avoid unconditional “AI eliminated leakage.”
- Plain English tooltips explain MinHash, connected components, original test preservation, and coverage.
- Error toast includes retry when safe; no infinite spinner after service failure.

## 12.5 UI quality assurance checklist

- 320 / 375 / 768 / 1024 / 1440 widths; graph inspector doesn't overflow.
- Test loading, zero issues, incomplete issues, a genuine issue, huge component, insufficient training data, model API disabled, backend unavailable.
- Verify all buttons and links; no disabled-but-styled-as-active controls.
- Sanitize source excerpts, prevent XSS, and avoid dumping raw dataset text into error messages.
- Verify graph explanation shows actual source IDs and query path.
- E2E via Playwright: public landing CTA → inspect dataset → create run → inspect real completed run → export.

---

# 13. CONFIGURATION AND REAL API CREDENTIALS

## 13.1 Required vs optional services

| Service | Need for P0 | Key needed? | Notes |
|---|---|---|---|
| FalkorDB self-hosted Docker | **Required** | local DB credentials recommended | Core WCC and query engine |
| HF public Dataset Viewer / datasets | **Required** | usually no token for public data | metadata, pinned dataset retrieval |
| OpenRouter | **Required for AI agent behavior** | **Yes — user has it** | select a tool-capable model and verify function calls |
| NVIDIA NIM | Optional P1 | **Yes — user has it** | embeddings for semantic candidate review only |
| AIML API | Optional backup | **Yes — user has it** | alternate provider |
| FalkorDB Cloud | Optional | Cloud endpoint/password | replaces local DB, not needed for MVP |
| Hugging Face token | Optional; gated data is out of scope | Usually no for public | token not needed for default path |
| Langfuse/Phoenix | Optional | varies by deployment | extra telemetry, not core |
| Jev / other router | Out of P0 | varies | not part of correctness |

## 13.2 `.env.example` contract

```dotenv
# Runtime
APP_ENV=development
PUBLIC_APP_URL=http://localhost:3000
API_PORT=8000
CORS_ALLOWED_ORIGINS=http://localhost:3000
ARTIFACT_DIR=./data/artifacts
RUN_DB_URL=sqlite:///./data/leakline.sqlite3

# FalkorDB
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_USERNAME=
FALKORDB_PASSWORD=
FALKORDB_GRAPH_PREFIX=leakline_

# Agent - real credentials injected at runtime
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AIML_API_KEY=

# Optional embeddings
ENABLE_SEMANTIC_ANALYSIS=false
NVIDIA_API_KEY=
NVIDIA_EMBED_MODEL=

# HF / policies
HF_TOKEN=
ALLOW_GATED_DATASETS=false
ALLOW_REMOTE_DATASET_CODE=false
MAX_DATASET_ROWS=5000
MAX_AGENT_TOOL_CALLS=12
MAX_GRAPH_RENDER_NODES=150
DEFAULT_NEAR_JACCARD_THRESHOLD=0.90
ANALYSIS_SEED=42

# MCP read-only access (if official FalkorDB MCP server enabled)
FALKORDB_DEFAULT_READONLY=true

# Optional traces
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

These are **Leakline configuration names**; third-party SDK names may differ. Inspect provider documentation before wiring clients. Never commit actual `.env`, API tokens, HF credentials, raw datasets or sensitive excerpts.

## 13.3 Docker dev layout

Recommended services: `falkordb` pinned version + persisted volume; `api`; `worker`; `web`; optional standalone `mcp` process. Official combined image exposes internal `6379` and Browser `3000` [S9]. Map them to different **host** ports to avoid Next.js conflict.

```yaml
# docker-compose sketch; image tag MUST be pinned after testing
services:
  falkordb:
    image: falkordb/falkordb:latest  # Replace with tested immutable version/digest before final submission
    ports:
      - "6379:6379"
      - "3001:3000"                # FalkorDB Browser at http://localhost:3001
    volumes:
      - falkordb_data:/data
  # web on host :3000; api on host :8000; worker shares app code and artifact volume.
volumes:
  falkordb_data:
```

**This snippet is a topology sketch, not the full functioning compose file**. Implement actual service network hostnames, health checks, authentication, restart policy, persisted graph volume path matching pinned image, limited resource settings and durable artifact mount. The project README must show the final successfully executed commands.

## 13.4 Model provider validation

- Use provider-supported JSON/schema tool calling, not brittle string parsing.
- Smoke-test at startup: `list tools → call inspect_dataset_graph` on a real completed analysis; verify expected schema, refusal behavior, cost and timeouts.
- If agent API unavailable, run deterministic audit as a degraded mode but **clearly label `AI investigation unavailable`**; do not claim Track 01 MCP demo passed.
- Use NVIDIA NIM embeddings only when enabled and provider model availability confirmed; don't invent model IDs.

---
# 14. BUILD ORDER — CODEX-READY IMPLEMENTATION PLAN

**Engineering principle:** Vertical slice first. A real dataset imported, a real FalkorDB component computed, and a real manifest validated are worth more than a beautiful but static dashboard. Codex High can parallelize coding, not substitute for integration testing or architecture review.

## Milestone 0 — Environment and live FalkorDB proof

**Tasks:** Create monorepo, `.env.example`, Docker, FastAPI health, Next.js shell; connect Python client to a **pinned** FalkorDB image. Write `scripts/check_falkordb_capabilities.py` to create a temporary graph, insert A—B—C + singleton D, run documented WCC with relationship filter, verify expected grouping, tear down temporary graph. Test official or custom MCP call and record tool trace.

**Exit gate:** `docker compose up` + Python graph test + MCP tool smoke test pass from a clean checkout. Capture actual output in CI logs. If WCC fails on pinned version, **fix compatibility or pin a supported version**; do not silently switch to NetworkX in production.

## Milestone 1 — Real source ingestion and exact duplicate graph

**Tasks:** HF inspect endpoint, commit pinning, column selection, safe loading, coverage, exact hashes, `Sample` nodes and `CONFIRMED_DUPLICATE_OF` accepted edges, WCC, component snapshots, cross-split summaries, real run API. Test on public dataset. Do not manufacture conflict results.

**Exit gate:** A second arbitrary compatible public dataset works; `Sample` count matches actual read rows; graph WCC and independent small-case reference agree.

## Milestone 2 — Near-duplicate evidence + repair

**Tasks:** MinHash candidate generation, exact Jaccard confirmation, evidence nodes, conflict label quarantine, `PairEvidence` panel data, `protect_original_evaluation_v1` group-level repair, approval, deterministic validation, manifest export.

**Exit gate:** For tested accepted-edge graph, every retained proposed train row belongs to a component without protected eval nodes. Original HF rows remain unchanged. Re-review of edge invalidates stale plan.

## Milestone 3 — MCP agent and live trace

**Tasks:** Implement typed named MCP tools, bounded investigator loop, OpenRouter connector with tool-calling smoke tests, graph-sourced narrative, source-linked tool trace, clear error behavior. Ensure real MCP protocol requests occur—no application function called “MCP” without an MCP client/server interaction.

**Exit gate:** Actual tool traces visible for both contaminated and clean cases, with correct action differences. If no observed contamination exists in a public dataset, the agent chooses honest clean-scope report.

## Milestone 4 — Landing + complete app UI

**Tasks:** Responsive cream landing; import wizard; actual run timeline; overview; component graph inspector; repair review; evaluation; exports. Wire all screens to implemented API, not JSON fixtures in production.

**Exit gate:** A fresh user can complete the public-source workflow through browser, refresh and recover run history, view original source provenance and download verification.

## Milestone 5 — Model baseline + ablation + release

**Tasks:** TF-IDF/logistic regression training protocol, model metrics, detector/graph ablation, export verifier, Playwright E2E, Docker clean-install check, docs and README, real demo recording.

**Exit gate:** Model metrics are actual executed calculations or explicitly `not run`; two independent public dataset inputs exercised; no critical error in production demo path.

## 14.1 Suggested agentic coding split (even if one person operates Codex)

- **Codex task A:** graph ontology, client, WCC and independent test suite.
- **Codex task B:** HF ingestion, normalization, MinHash evidence, version pinning.
- **Codex task C:** immutable repair policy, integrity validator, baseline evaluator.
- **Codex task D:** API, MCP harness and real provider smoke test.
- **Codex task E:** landing, dashboard UI and graph inspector.
- **Human integration owner:** cross-package contracts, security, source provenance, final demo verification and release documentation.

Each task should use separate branch/worktree and a written shared API contract. Integrate after deterministic P0 graph behavior is reliable; don't merge multiple disconnected dashboards. Never submit code the team cannot explain.

## 14.2 Practical deadline priority

The event closes **18 October 2026, 11:59 PM IST** per the participant's October event brief. As of preparation (18 October), scope freeze is critical. Build and record a *working graph-first vertical slice* before P1 semantic embeddings, auth, advanced visual effects or a big agent framework. If only part of the PRD can ship, label nonfunctional features honestly in README; do not record a misleading polished narrative as though they were live.

---

# 15. TEST PLAN — WINNER-LEVEL REPRODUCIBILITY

Tests below are acceptance requirements; none are claimed passed by this PRD. Automated fixtures can be synthetic **only inside tests**, never a substituted public-dataset demo. Test names are suggestions for `pytest`/Playwright.

## 15.1 Source ingestion and security (T01–T08)

- **T01:** Accept canonical supported public HF dataset URL/ID; resolve actual revision SHA.
- **T02:** Reject arbitrary host and SSRF-like internal/metadata URLs; do not fetch redirect targets outside official host.
- **T03:** Reject unsupported/gated source without leaked backend credentials and with a clear response.
- **T04:** Dataset Viewer `/rows` pagination respects max 100 per API call; source row indices do not drift.
- **T05:** For capped analysis, source revision, seed, selected IDs, per-split coverage and limits are stable/reproducible.
- **T06:** Mixed/unsupported schema produces `unsupported_column`, not fake empty result.
- **T07:** License unknown appears on-screen and data exports omit full text by default.
- **T08:** Data text with prompt-injection phrases remains inert source data, never graph/system instruction.

## 15.2 Matching and graph (T09–T20)

- **T09:** Same normalized text with different source row indices produces separate `Sample` nodes and accepted exact edge.
- **T10:** Different text with identical semantic topic does not automatically become accepted edge.
- **T11:** Canonical pair ordering prevents double graph edges on duplicate candidate reports.
- **T12:** Exact and MinHash-verified accepted edges include real evidence method/policy/score or hash identifier.
- **T13:** WCC A—B—C + isolated D returns one 3-member and one singleton component.
- **T14:** `POSSIBLY_SIMILAR_TO` edge doesn't affect WCC; accepted status does.
- **T15:** Different analysis graphs never share a component or leak other workspaces' samples.
- **T16:** Same accepted edge topology yields same canonical component key on repeat WCC even if integer `componentId` differs.
- **T17:** Cross-split conflict uses configured roles and treats `train`↔`test` separately from `validation`↔`test` if policy says so.
- **T18:** Edge review invalidates component snapshot/repair plan and causes actual WCC recompute.
- **T19:** FalkorDB outage blocks repair; app doesn't generate fake path data from UI cache.
- **T20:** Graph inspector edges/nodes and source panel exactly match queried persisted IDs.

## 15.3 Repair and scientific validity (T21–T32)

- **T21:** Protected original test row assignments and counts remain unchanged in Policy A export.
- **T22:** All retained train IDs have components disjoint from every protected eval ID after repair.
- **T23:** For transitive A—B—C conflict, conservative repair respects the whole group, not only direct train↔test pairs.
- **T24:** Only candidate semantic edges cannot cause automatic training-row exclusion.
- **T25:** Conflict labels report a review warning; no silent label overwrite.
- **T26:** Infeasible training (e.g., one class entirely excluded) returns `infeasible_repair` and does not claim successful evaluation.
- **T27:** Stale graph version rejected on plan approval; regenerate before validation.
- **T28:** Same manifest + source+seed+policy yields reproducible checksums and same partition invariant.
- **T29:** ML train pipeline fits vectorizer **only on train**; never leak eval/test documents into vocabulary fitting.
- **T30:** Model A and B retrain independently with identical configurable hyperparameters and recorded seeds.
- **T31:** Changes in sample count and class balance are disclosed next to metrics, not hidden by graph UI.
- **T32:** Partial coverage / incomplete job never receives `verified clean` status.

## 15.4 Agent, MCP, concurrency and frontend (T33–T43)

- **T33:** Actual MCP round-trip runs at least one graph-backed named tool and records tool ID, timestamp, result digest.
- **T34:** Model-suggested nonexistent sample/component/evidence IDs are rejected by backend.
- **T35:** On clean scope the agent does **not** propose repair; on conflict it may propose only valid policy choices.
- **T36:** MCP destructive operations unavailable to model; FalkorDB official MCP optional instance remains read-only.
- **T37:** Max tool budget and timeouts block runaway loops; UI surfaces `incomplete` honestly.
- **T38:** Double click/duplicate request with same idempotency key creates one run/approval.
- **T39:** Two simultaneous edge decisions/repair approvals use version compare-and-set; stale approval rejected.
- **T40:** Browser refresh restores analysis metadata + computed graph state without rerunning a fake animation.
- **T41:** Landing CTA→inspect→run→evidence→approval→export E2E works on at least one permitted public dataset.
- **T42:** UI 320px–1440px has no overflow, source code/truncated text safe and accessible interactions.
- **T43:** Clean checkout `docker compose up` + actual FalkorDB capability test and README reproduction succeed.

## 15.5 Two real-data release tests

- **Dataset A:** `cornell-movie-review-data/rotten_tomatoes` at recorded commit. Validate ingestion, splits and correct *whatever* actual findings occur. Do not claim it has leakage. License appears unknown on its card; avoid redistribution assumptions [S19].
- **Dataset B:** Pick a second legitimately usable public **text classification dataset** with explicit splits and known accessible revision after inspecting its license/terms. Record exactly why chosen and compare reproducibility. **Do not pre-write outcomes.**

The live demo must use one of these tested real datasets **with verified actual data**. If neither yields a noteworthy contamination group, tell judges the truth: show the successful clean-scope audit and a separate clearly marked deterministic graph-algorithm **test fixture** in the technical unit-test section, never as a supposed real-world discovery.

## 15.6 Independent verification program

Provide `scripts/verify_bundle.py /path/to/leakline-bundle.zip`. It checks manifest checksum, source/revision, unique row IDs, original protected evaluation invariants, group mapping, no crossed accepted components after repair, and evaluation report consistency. This verifier must not trust the web UI's `success` flag. In CI, run against both a tiny fixture and the produced real-public-run artifact bundle.

---

# 16. JUDGE DEMO — ACTUAL VIDEO, NOT A FIGMA STORY

## 16.1 Hero claim the judge must see

**The “aha” is that a graph algorithm turns separate suspicious pairs into one decision-relevant contaminated group, and the final artifact demonstrates that the proposed split respects that connected group.**

This is distinct from a duplicate table because *membership is transitive*, the repair operates on groups, and verification checks those groups instead of only raw pair counts.

## 16.2 Recommended 2-minute video script (only show features after they're implemented)

| Time | Show on screen | What to say | Required proof |
|---|---|---|---|
| 0:00–0:12 | Landing + one-sentence product problem | “A model can look impressive when training and evaluation examples are connected.” | Working CTA, not static mockup |
| 0:12–0:30 | Paste actual HF dataset URL; show detected SHA/splits | “This is a real public dataset, at a pinned revision—not seeded example records.” | Source link and actual split metadata |
| 0:30–0:52 | Real analysis run timeline and graph algorithm query | “Leakline finds exact/near duplicate evidence and asks FalkorDB to compute connected components.” | Actual executed `algo.wcc` query/tool log |
| 0:52–1:15 | Click an actual result or clean-state report | “Every warning is traceable to original rows; here is the specific multi-hop relationship when it exists.” | Real pair evidence; no invented path |
| 1:15–1:35 | Policy A repair preview and approve | “We preserve the official test and exclude colliding training groups in a new manifest.” | Reviewable actual row IDs and cost |
| 1:35–1:49 | Validation panel / metrics if executed | “The independent validator verifies the accepted graph boundary; model evaluation is reported with proper caveats.” | Real receipt + evaluation state |
| 1:49–2:00 | Export + repo/README + graph in FalkorDB Browser | “Any engineer can reproduce the result and inspect the Cypher.” | Download and source code |

**Video flexibility:** if real selected dataset is clean, focus on correct clean-scope reporting, source coverage and validation rather than falsely displaying a repair. A separate unit-test demo of a true transitive case can be clearly labeled as a **test fixture**, alongside the real dataset scan. The video should be one verified recording, not edited to impersonate an executed result.

## 16.3 Three possible honest “wow moments”

1. **Live graph retrieval:** user clicks accepted edge, revealing two original source row IDs and exact matching evidence.
2. **Algorithm makes a different decision:** indirect A—B—C component means the agent protects a larger group than a pairwise-only decision; if absent in live data, show this in the openly labeled algorithm test as a verification feature.
3. **Proof receipt:** after approval, downloadable report shows actual original/test unchanged, excluded train IDs, coverage and post-repair invariants; evaluator runs actual protocol or says `not run`.

## 16.4 Judge interaction checklist

- Judges can paste a **new** supported public dataset URL.
- Statuses are accurate even under network/provider outage.
- Technical inspector shows query and algorithm names, graph/source IDs.
- Both graph and evidence view are usable without reading entire PRD.
- The same result is reproducible from repo commands on another machine.
- The video mentions zero guaranteed accuracy uplift or “100% leakage removed” statements.

---

# 17. ACCEPTANCE / RELEASE GATES

## 17.1 P0 release blockers

No release if any of these are true:

- Graph algorithm is computed only using NetworkX or custom Python while FalkorDB is cosmetic.
- Dataset scan results are hardcoded or generated by an LLM.
- MCP is merely a named Python function or static trace without a real MCP call.
- Dataset rows come from synthetic showcase fixtures but UI implies a real HF dataset.
- Repair silently changes the canonical test set.
- Post-repair check only scans direct pairs and ignores accepted transitive components.
- All semantic embedding similarities treated as confirmed duplicates.
- Model metrics are narrated without actual train/evaluation execution.
- Historical run status vanishes on refresh and results are reconstructed with fake state.
- Public dataset license / data protection rules are ignored.
- The project cannot start from a fresh README run with FalkorDB.
- Submission track is taken from the stale September page instead of verified October Track 01 form.

## 17.2 Must-have documented artifacts

- Public GitHub repo (or other publicly accessible source repository).
- Functional `README.md` with overview, architecture, stack, requirements, diagram, setup, model keys, sample public URLs, reproducible commands and limitations.
- `docs/graph-schema.md`: all node/edge types; graph per run and tenant policy.
- `docs/algorithms.md`: exact tested WCC query, indexes as implemented, version/capability notes, all important queries and explainability.
- `docs/agent-and-mcp.md`: actual tool schemas, provider/model selection, guardrails, trace shape.
- `docs/scientific-limitations.md`: similarity vs leakage, sampling effects, evaluation comparability and licensing.
- Tests and logs; at least one real artifact bundle; no proprietary/user-sensitive data in repo.
- Demo video with real behavior and concise explanation.
- Live deployment OR full reproducible local Docker setup.
- Disclosure of Codex/AI assistance and participant architectural/testing contributions.
- Track 01 chosen in currently authoritative submission form.

## 17.3 Recruiter-facing evidence (without inflating claims)

Your public README/project case study can show:

- A complete typed graph schema with an actual database algorithm controlling a decision.
- Reproducible public data ingestion at pinned revisions and efficient approximate matching.
- MCP-based agent/tool execution with typed validation, budget limits and trusted boundaries.
- Scientific model evaluation with group-based split controls and reproducibility manifests.
- Real web product including robust async job monitoring, evidence inspection, approval and exports.
- Failure-case testing, ablation, security and CI.

Use **measured results** only: actual row counts/latency/test cases; never claim to have “eliminated data leakage” universally.

---

# 18. OPTIONAL POST-HACKATHON ROADMAP (NOT P0)

- Analyze real dataset provenance groups across multiple releases and vendors; version-to-version contamination deltas.
- Build a more sophisticated active-review system for borderline pairs with expert labeling and calibrated detector performance.
- Opt-in hosted embedding candidate expansion, multilingual matching, document-family matching and image/audio modalities.
- Open pull request against a user-owned **dataset manifest** after explicit permission; publish no unlicensed raw content.
- Dataset integrity CI action to block merges that introduce newly confirmed cross-split connected components.
- Team workspaces, SSO/tenant controls, full audit retention and SOC-ready artifacts.
- Source-aware LLM eval corpus leakage checks (prompts/reference answers/grounding sources), only with a well-specified definition and reproducible protocols.
- Compare graph grouping with scalable alternative algorithms and report benchmark/cost tradeoffs honestly.

---

# 19. OFFICIAL DOCUMENTATION AND VERIFIED RESEARCH REFERENCES

These are direct URLs to documentation and prior-winner pages researched for the specification. Source-derived API syntax is tagged in relevant sections. Some pages may be updated independently; record pinned tool versions and reconfirm the current event submission interface. **The PRD is a design artifact, not proof that any example integration or dataset scan has been executed.**

- **[S1]** Current participant-provided event brief: *Graph Hacks: Context for AI Agents*, Oct 15–18 2026, October Track 01 definition (included in this conversation; not independently visible in older indexed public pages).
- **[S2]** WeMakeDevs public overview — currently surfaced older September variant: https://www.wemakedevs.org/hackathons/falkordb
- **[S3]** WeMakeDevs rules — general eligibility/technical and submission rules, currently surfaced older September variant: https://www.wemakedevs.org/hackathons/falkordb/rules
- **[S4]** FalkorDB official documentation index and algorithms: https://docs.falkordb.com/ and https://docs.falkordb.com/algorithms
- **[S5]** FalkorDB source repository and Python client example: https://github.com/FalkorDB/FalkorDB
- **[S6]** FalkorDB WCC procedure, config and output schema: https://docs.falkordb.com/algorithms/wcc.html
- **[S7]** FalkorDB MCP server documentation: https://docs.falkordb.com/genai-tools/mcpserver/
- **[S8]** FalkorDB MCP quickstart and read-only `query_graph`: https://docs.falkordb.com/genai-tools/mcpserver/quickstart.html
- **[S9]** FalkorDB Docker images and ports: https://docs.falkordb.com/operations/docker.html
- **[S10]** FalkorDB atomicity/concurrency: https://docs.falkordb.com/design/concurrency.html
- **[S11]** FalkorDB BFS and shortest paths: https://docs.falkordb.com/algorithms/bfs.html and https://docs.falkordb.com/algorithms/sppath.html
- **[S12]** WeMakeDevs Cognee official winners page / Lethe and Classroom Memory behavior: https://archive.wemakedevs.org/hackathons/cognee/projects
- **[S13]** Lethe public landing (headline, interactive preview, proof): https://vinayaksonthalia-lethe.hf.space/
- **[S14]** Classroom Memory public product experience (quiz, live graph, teacher dashboard): https://classroom-memory.vercel.app/
- **[S15]** Hugging Face Dataset Viewer API (`/splits`, `/rows`, `/first-rows`, pagination): https://huggingface.co/docs/dataset-viewer/en/quick_start
- **[S16]** Hugging Face Hub `HfApi.repo_info`: https://huggingface.co/docs/huggingface_hub/main/en/package_reference/hf_api
- **[S17]** Hugging Face Datasets loading, revision and streaming: https://huggingface.co/docs/datasets/en/loading
- **[S18]** scikit-learn group splitters: https://scikit-learn.org/stable/api/sklearn.model_selection.html and https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html
- **[S19]** Hugging Face Rotten Tomatoes text dataset and its current license/source metadata: https://huggingface.co/datasets/cornell-movie-review-data/rotten_tomatoes
- **[S20]** FalkorDB CodeGraph (existing product, supports differentiating Leakline from generic code graph): https://github.com/FalkorDB/code-graph

---

# 20. THE FINAL STANDARD

Leakline should be judged by **what the real system does under scrutiny**, not by its claims:

1. An unfamiliar real dataset can be imported.
2. Data-derived evidence exists for every accepted duplicate relationship.
3. FalkorDB actually computes groups and the repair is determined by those groups.
4. An agent actually calls tools through MCP and presents a grounded decision.
5. The repair is non-destructive, human-approved and versioned.
6. Independent validation proves the declared invariant **within its documented scope**.
7. ML metrics, when displayed, come from actual retraining and evaluation.
8. The output can be downloaded and independently reproduced.
9. The app still communicates clearly when there is no issue, no source license, no model key or no suitable data.
10. The browser experience makes those technical properties obvious in less than two minutes.

**No guarantee of a prize is possible.** What this spec supports is a serious, reproducible, judge-inspectable Track 01 application and a credible AI engineering portfolio project, provided the implementation and tests are actually completed.

**Build mantra:** **REAL SOURCE → VERIFIED PAIR EVIDENCE → FALKORDB WCC → GRAPH-DRIVEN AGENT ACTION → APPROVED NON-DESTRUCTIVE REPAIR → INDEPENDENT PROOF.**
