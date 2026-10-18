# Implemented graph schema

One server-generated `leakline_<UUID without dashes>` graph per audit.

- `DatasetRevision {dataset_id,revision_sha,config,license}`
  `-[:HAS_SPLIT]-> Split {name,total_count,analyzed_count}`.
- `Split-[:CONTAINS]->Sample {sample_id,split,row_index,text,label,raw_hash,text_hash}`.
  Samples and original assignments remain immutable during repair. Scalar labels
  are strings; multi-label integer IDs are retained as JSON list strings.
- `Sample-[:HAS_PAIR_EVIDENCE]->PairEvidence-[:CONCERNS]->Sample`.
  Evidence stores pair_id, method, score, threshold, status, reason, version.
- `Sample-[:CONFIRMED_DUPLICATE_OF {pair_id,method,score,threshold,version}]->Sample`.
  This is the **only** relationship type used by WCC. Review-only links use
  `POSSIBLY_SIMILAR_TO`. Snapshots verify that every confirmed edge resolves to
  accepted evidence with matching properties and the recorded audit threshold.
- `Sample-[:IN_COMPONENT]->Component {component_key,size,crosses_boundary,algorithm}`.
  Components are a replaceable materialized audit view; old nodes/memberships are
  deleted before recomputation to prevent stale findings. Canonical keys hash
  sorted stable row IDs, not the server's incidental numeric WCC IDs.
- `AnalysisRun {analysis_id}-[:PROPOSES]->RepairPlan {plan_id,status,policy,
  manifest_sha256,created_at,approved_at}-[:AFFECTS]->Component`.
  Phase 2 adds graph-native decision receipts. AFFECTS refers to components with
  actual changed/quarantined rows, not every inspected group.

The planner, validator and inspector query fresh WCC and source evidence; they do
not trust Component nodes. Plan and validation records, with complete assignments,
are persisted in SQLite keyed by both analysis ID and plan ID. Graph receipt writes
precede successful metadata transitions; on graph outage, an incomplete validation
record can still be saved in SQLite. Cross-store transactions and hostile concurrent
manual graph writes are outside this local single-worker deployment's guarantees.

The content fingerprint covers source identity, full inspected sample properties,
split sizes/counts, pair evidence, accepted edges and fresh canonical WCC groups.
It intentionally excludes derived Component and RepairPlan nodes so storing or
approving a plan does not make its own immutable source snapshot stale.
