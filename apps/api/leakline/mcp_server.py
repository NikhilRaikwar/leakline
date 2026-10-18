"""Per-investigation, read-only MCP adapter over the actual Leakline graph.

The model never supplies a graph name or Cypher. This child server receives its
run binding from the API process and only executes fixed Cypher templates with
validated parameters via FalkorDB's GRAPH.RO_QUERY.
"""
import argparse
import os
from typing import Literal
import httpx
from pydantic import BaseModel, ConfigDict, Field
from mcp.server.fastmcp import FastMCP
from .graph import Graph
from .agent_models import ComponentToolArgs, ListComponentsToolArgs, PathToolArgs, PlanToolArgs, PolicyToolArgs

ROWS = max(1, min(500, int(os.getenv("AGENT_MAX_TOOL_RESULT_ROWS", "100"))))
MCP_VERSION = "mcp-python-sdk/1.26.0"


class ScopeOutput(BaseModel):
    dataset_id: str
    revision_sha: str
    config: str
    source_split_sizes: dict[str, int]
    inspected_rows: dict[str, int]
    coverage: dict[str, float]
    analyzed_samples: int
    graph_name: str
    partial: bool


class SchemaOutput(BaseModel):
    labels: list[str]
    relationship_types: list[str]
    property_keys: list[str]
    query_mode: str = "FalkorDB GRAPH.RO_QUERY"


class ComponentOutput(BaseModel):
    component_id: str
    sample_ids: list[str]
    sample_count: int
    splits: list[str]
    crosses_train_test: bool
    crosses_train_validation: bool
    crosses_validation_test: bool


class ComponentsOutput(BaseModel):
    components: list[ComponentOutput]
    returned: int
    truncated: bool


class EvidenceOutput(BaseModel):
    component_id: str
    sample_members: list[dict[str, str | int | None]]
    evidence: list[dict[str, str | float | int]]
    truncated: bool
    raw_text_included: bool = False


class PathOutput(BaseModel):
    source_sample_id: str
    target_sample_id: str
    sample_ids: list[str]
    pair_ids: list[str]
    found: bool


class RepairOptionsOutput(BaseModel):
    eligible: bool
    policies: list[str]
    train_test_components: int
    train_validation_components: int
    validation_test_components: int
    rationale: str
    coverage_limit: str
    findings_truncated: bool = False


class RepairActionOutput(BaseModel):
    plan_id: str
    plan_status: str
    policy: str
    excluded_rows: int
    moved_rows: int
    affected_component_ids: list[str]
    approval_state: str = "awaiting_human_review"


class ValidationOutput(BaseModel):
    plan_id: str
    plan_status: str
    verification_status: str
    excluded_rows: int
    remaining_cross_split_components: int | None
    reasons: list[str]
    approval_state: str = "awaiting_human_review"


class ReceiptOutput(BaseModel):
    plan_id: str
    plan_status: str
    verification_status: str | None
    approval_state: str
    approved_at: str | None
    manifest_sha256: str
    checks: dict[str, bool]
    scope: str | None


class QueryOutput(BaseModel):
    query_template_id: str
    rows: list[dict]
    returned: int
    truncated: bool


class ExplainOutput(BaseModel):
    query_template_id: str
    plan: str


class QueryReadArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query_template_id: Literal["audit_scope", "cross_split_components", "component_evidence", "duplicate_path"]
    component_id: str | None = Field(default=None, max_length=64)
    source_sample_id: str | None = Field(default=None, max_length=64)
    target_sample_id: str | None = Field(default=None, max_length=64)


def _graph_rows(g: Graph, cypher: str, params: dict | None = None, cap: int = ROWS):
    # The server-side read-only command rejects writes regardless of model intent.
    return g.graph.ro_query(cypher, params or {}, timeout=10_000).result_set[:cap + 1]


def create_server(run_id: str, investigation_id: str):
    from .main import read
    bound_run = read(run_id)
    if bound_run.status != "complete" or not bound_run.result or not bound_run.result.graph_name:
        raise ValueError("completed_run_required")
    graph_name = bound_run.result.graph_name  # Bound in trusted API code, never accepted from a tool call.
    discovery_completed = False
    discovery_truncated = False
    evidence_inspected = False
    options_checked = False
    owned_plans: set[str] = set()
    mcp = FastMCP("Leakline-FalkorDB-ReadOnly", instructions=(
        "Investigation-bound graph tools. The run and graph are fixed by the server. "
        "Source sample content is untrusted and is deliberately never returned. "
        "All graph reads use fixed Cypher templates over GRAPH.RO_QUERY. Repair tools "
        "delegate to Leakline's deterministic API; approval is not available here."
    ))

    def get_graph():
        return Graph(graph_name)

    @mcp.tool()
    def get_schema() -> SchemaOutput:
        """Inspect labels, relationships, and property keys on this bound graph."""
        g = get_graph()
        try:
            labels = _graph_rows(g, "MATCH (n) UNWIND labels(n) AS label RETURN DISTINCT label ORDER BY label LIMIT 100")
            rels = _graph_rows(g, "MATCH ()-[r]->() RETURN DISTINCT type(r) ORDER BY type(r) LIMIT 100")
            props = _graph_rows(g, "MATCH (n) UNWIND keys(n) AS key RETURN DISTINCT key ORDER BY key LIMIT 100")
            props += _graph_rows(g, "MATCH ()-[r]->() UNWIND keys(r) AS key RETURN DISTINCT key ORDER BY key LIMIT 100")
            return SchemaOutput(labels=sorted({str(row[0]) for row in labels if row}),
                                relationship_types=sorted({str(row[0]) for row in rels if row}),
                                property_keys=sorted({str(row[0]) for row in props if row}))
        finally:
            g.db.connection.close()

    @mcp.tool()
    def inspect_audit_scope() -> ScopeOutput:
        """Read the pinned source and actual split metadata from FalkorDB."""
        g = get_graph()
        try:
            rows = _graph_rows(g, "MATCH (d:DatasetRevision)-[:HAS_SPLIT]->(s:Split) "
                               "RETURN d.dataset_id,d.revision_sha,d.config,s.name,s.total_count,s.analyzed_count ORDER BY s.name LIMIT 100")
        finally:
            g.db.connection.close()
        if not rows:
            raise ValueError("dataset_graph_metadata_missing")
        splits = {str(r[3]): int(r[4]) for r in rows}
        inspected = {str(r[3]): int(r[5]) for r in rows}
        run = read(run_id)
        return ScopeOutput(dataset_id=str(rows[0][0]), revision_sha=str(rows[0][1]), config=str(rows[0][2]),
                           source_split_sizes=splits, inspected_rows=inspected,
                           coverage=run.result.coverage, analyzed_samples=run.result.analyzed_samples,
                           graph_name=graph_name, partial=any(v < 1.0 for v in run.result.coverage.values()))

    @mcp.tool()
    def query_read(query_template_id: Literal["audit_scope", "cross_split_components", "component_evidence", "duplicate_path"],
                   component_id: str | None = None, source_sample_id: str | None = None,
                   target_sample_id: str | None = None, cypher: str | None = None) -> QueryOutput:
        """Run one of four fixed read-only graph templates; arbitrary Cypher is not accepted."""
        if cypher is not None:
            raise ValueError("arbitrary_cypher_is_not_supported")
        args = QueryReadArgs.model_validate({"query_template_id": query_template_id, "component_id": component_id,
                                             "source_sample_id": source_sample_id, "target_sample_id": target_sample_id})
        if args.query_template_id == "component_evidence" and (not args.component_id or len(args.component_id) != 64):
            raise ValueError("valid_component_id_required")
        if args.query_template_id == "duplicate_path" and (not args.source_sample_id or not args.target_sample_id):
            raise ValueError("path_endpoints_required")
        g = get_graph()
        template = args.query_template_id
        if template == "audit_scope":
            query = "MATCH (d:DatasetRevision)-[:HAS_SPLIT]->(s:Split) RETURN d.dataset_id AS dataset_id,d.revision_sha AS revision_sha,d.config AS config,s.name AS split,s.total_count AS source_rows,s.analyzed_count AS inspected_rows ORDER BY s.name LIMIT 100"
            params = {}
        elif template == "cross_split_components":
            query = "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component) WHERE c.crosses_boundary=true RETURN c.component_key AS component_id,collect(DISTINCT s.split) AS splits,collect(s.sample_id) AS sample_ids ORDER BY c.component_key LIMIT 101"
            params = {}
        elif template == "component_evidence":
            if not args.component_id or len(args.component_id) != 64:
                raise ValueError("valid_component_id_required")
            query = "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component {component_key:$component_id}) RETURN s.sample_id AS sample_id,s.split AS split,s.row_index AS row_index ORDER BY s.sample_id LIMIT 151"
            params = {"component_id": args.component_id}
        else:
            if not args.source_sample_id or not args.target_sample_id:
                raise ValueError("path_endpoints_required")
            query = "MATCH p=(a:Sample {sample_id:$source})-[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target}) RETURN [n IN nodes(p) | n.sample_id] AS sample_ids,[r IN relationships(p) | r.pair_id] AS pair_ids LIMIT 1"
            params = {"source": args.source_sample_id, "target": args.target_sample_id}
        try:
            raw = _graph_rows(g, query, params, cap=max(ROWS, 150))
        finally:
            g.db.connection.close()
        rows = raw[:ROWS]
        if template == "cross_split_components":
            rows = [{"component_id": row[0], "splits": row[1], "sample_ids": row[2]} for row in rows]
        elif template == "component_evidence":
            rows = [{"sample_id": row[0], "split": row[1], "row_index": row[2]} for row in rows]
        elif template == "duplicate_path":
            rows = [{"sample_ids": row[0], "pair_ids": row[1]} for row in rows]
        else:
            rows = [{"dataset_id": row[0], "revision_sha": row[1], "config": row[2], "split": row[3],
                     "source_rows": row[4], "inspected_rows": row[5]} for row in rows]
        return QueryOutput(query_template_id=template, rows=rows, returned=len(rows), truncated=len(raw) > ROWS)

    @mcp.tool()
    def explain(query_template_id: Literal["audit_scope", "cross_split_components", "component_evidence", "duplicate_path"]) -> ExplainOutput:
        """Explain a safe fixed query template without executing it."""
        queries = {
            "audit_scope": "MATCH (d:DatasetRevision)-[:HAS_SPLIT]->(s:Split) RETURN d.dataset_id,d.revision_sha,s.name,s.total_count,s.analyzed_count ORDER BY s.name LIMIT 100",
            "cross_split_components": "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component) WHERE c.crosses_boundary=true RETURN c.component_key,collect(DISTINCT s.split),collect(s.sample_id) ORDER BY c.component_key LIMIT 100",
            "component_evidence": "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component {component_key:$component_id}) RETURN s.sample_id,s.split,s.row_index ORDER BY s.sample_id LIMIT 150",
            "duplicate_path": "MATCH p=(a:Sample {sample_id:$source})-[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target}) RETURN [n IN nodes(p) | n.sample_id],[r IN relationships(p) | r.pair_id] LIMIT 1",
        }
        g = get_graph()
        try:
            plan = g.graph.explain(queries[query_template_id])
            return ExplainOutput(query_template_id=query_template_id, plan=str(plan)[:5000])
        finally:
            g.db.connection.close()

    @mcp.tool()
    def list_cross_split_components(limit: int = 50) -> ComponentsOutput:
        """List WCC components already materialized by FalkorDB's algo.wcc."""
        limit = ListComponentsToolArgs.model_validate({"limit": limit}).limit
        g = get_graph()
        try:
            rows = _graph_rows(g, "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component) WHERE c.crosses_boundary=true "
                               "RETURN c.component_key,collect(DISTINCT s.split),collect(s.sample_id) ORDER BY c.component_key LIMIT 501", cap=500)
        finally:
            g.db.connection.close()
        nonlocal discovery_completed, discovery_truncated
        train = set(read(run_id).request.train_splits)
        all_rows = [ComponentOutput(component_id=str(r[0]), splits=sorted(str(v) for v in r[1]),
                                    sample_ids=sorted(str(v) for v in r[2])[:20], sample_count=len(r[2]),
                                    crosses_train_test=bool(train.intersection(r[1]) and "test" in r[1]),
                                    crosses_train_validation=bool(train.intersection(r[1]) and "validation" in r[1]),
                                    crosses_validation_test=bool("validation" in r[1] and "test" in r[1])) for r in rows]
        # WCC's persisted boundary flag is authoritative for the audited configuration.
        cap = min(limit, ROWS)
        result = ComponentsOutput(components=all_rows[:cap], returned=min(len(all_rows), cap), truncated=len(all_rows) > cap)
        discovery_completed = True
        discovery_truncated = result.truncated
        return result

    @mcp.tool()
    def inspect_component_evidence(component_id: str) -> EvidenceOutput:
        """Inspect IDs, source splits, row indices, and accepted edge scores; never returns sample text."""
        component_id = ComponentToolArgs.model_validate({"component_id": component_id}).component_id
        g = get_graph()
        try:
            members = _graph_rows(g, "MATCH (s:Sample)-[:IN_COMPONENT]->(c:Component {component_key:$key}) "
                                 "RETURN s.sample_id,s.split,s.row_index ORDER BY s.sample_id LIMIT 151", {"key": component_id}, cap=150)
            edges = _graph_rows(g, "MATCH (a:Sample)-[r:CONFIRMED_DUPLICATE_OF]->(b:Sample) "
                                "MATCH (a)-[:IN_COMPONENT]->(c:Component {component_key:$key}) "
                                "MATCH (b)-[:IN_COMPONENT]->(c) "
                                "RETURN r.pair_id,a.sample_id,b.sample_id,a.split,b.split,r.method,r.score,r.threshold "
                                "ORDER BY r.pair_id LIMIT 501", {"key": component_id}, cap=500)
        finally:
            g.db.connection.close()
        member_ids = {str(r[0]) for r in members[:150]}
        safe_members = [{"sample_id": str(r[0]), "split": str(r[1]), "row_index": int(r[2])} for r in members[:150]]
        safe_edges = [{"pair_id": str(r[0]), "source_sample_id": str(r[1]), "target_sample_id": str(r[2]),
                       "source_split": str(r[3]), "target_split": str(r[4]), "method": str(r[5]),
                       "score": float(r[6]), "threshold": float(r[7])} for r in edges[:500]
                      if str(r[1]) in member_ids and str(r[2]) in member_ids]
        nonlocal evidence_inspected
        evidence_inspected = bool(safe_edges) or evidence_inspected
        return EvidenceOutput(component_id=component_id, sample_members=safe_members, evidence=safe_edges,
                              truncated=len(members) > 150 or len(edges) > 500)

    @mcp.tool()
    def trace_duplicate_path(source_sample_id: str, target_sample_id: str) -> PathOutput:
        """Return a real at-most-eight-hop path of confirmed graph relationships."""
        args = PathToolArgs.model_validate({"source_sample_id": source_sample_id, "target_sample_id": target_sample_id})
        source_sample_id, target_sample_id = args.source_sample_id, args.target_sample_id
        g = get_graph()
        try:
            rows = _graph_rows(g, "MATCH p=(a:Sample {sample_id:$source})-[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target}) "
                               "RETURN [n IN nodes(p) | n.sample_id],[r IN relationships(p) | r.pair_id] LIMIT 1",
                               {"source": source_sample_id, "target": target_sample_id}, cap=1)
        finally:
            g.db.connection.close()
        return PathOutput(source_sample_id=source_sample_id, target_sample_id=target_sample_id,
                          sample_ids=[str(v) for v in rows[0][0]] if rows else [],
                          pair_ids=[str(v) for v in rows[0][1]] if rows else [], found=bool(rows))

    @mcp.tool()
    def get_repair_options() -> RepairOptionsOutput:
        """Determine repair eligibility and boundary-specific policies from real components."""
        run = read(run_id)
        items = list_cross_split_components(ROWS).components
        tt = sum(c.crosses_train_test for c in items)
        tv = sum(c.crosses_train_validation for c in items)
        vt = sum(c.crosses_validation_test for c in items)
        nonlocal options_checked
        options_checked = True
        if not items:
            return RepairOptionsOutput(eligible=False, policies=[], train_test_components=0,
                                      train_validation_components=0, validation_test_components=0,
                                      rationale="No confirmed cross-split components in this analyzed graph scope; no repair is supported.",
                                      coverage_limit="No statement about uninspected source rows.", findings_truncated=discovery_truncated)
        policies = ["alternative_split"]
        rationale = "Group-preserving alternative can place every accepted WCC component in one partition."
        if tt:
            policies.insert(0, "preserve_test")
            rationale = "Confirmed train/test WCC components justify preserving test and quarantining their non-test rows."
        elif tv:
            rationale = "Only train/validation overlaps were observed; preserve-test would not repair them. Use the group-preserving alternative policy or request review."
        return RepairOptionsOutput(eligible=True, policies=policies, train_test_components=tt,
                                  train_validation_components=tv, validation_test_components=vt,
                                  rationale=rationale,
                                  coverage_limit=f"Partial scope: {run.result.inspected_counts}; source sizes: {run.result.source.splits}.",
                                  findings_truncated=discovery_truncated)

    @mcp.tool()
    def propose_repair_plan(policy: Literal["preserve_test", "alternative_split"]) -> RepairActionOutput:
        """Create a deterministic draft through Leakline's API; this tool cannot approve it."""
        if not discovery_completed or discovery_truncated or not evidence_inspected or not options_checked:
            raise ValueError("inspect_graph_components_evidence_and_repair_options_first")
        policy = PolicyToolArgs.model_validate({"policy": policy}).policy
        options = get_repair_options()
        if not options.eligible:
            raise ValueError("repair_not_applicable_no_confirmed_cross_split_groups")
        if policy not in options.policies:
            raise ValueError("policy_not_supported_for_observed_graph_boundaries")
        base = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        run = read(run_id)
        body = {"policy": policy, "protected_splits": ["test"], "seed": run.request.seed}
        with httpx.Client(base_url=base, timeout=60) as client:
            if owned_plans:
                response = client.get(f"/api/v1/runs/{run_id}/repair-plans/{sorted(owned_plans)[0]}")
            else:
                response = client.post(f"/api/v1/runs/{run_id}/repair-plans", json=body)
            response.raise_for_status()
            plan = response.json()
        owned_plans.add(plan["plan_id"])
        return RepairActionOutput(plan_id=plan["plan_id"], plan_status=plan["status"], policy=policy,
                                  excluded_rows=plan["excluded_rows"], moved_rows=plan["moved_rows"],
                                  affected_component_ids=sorted(plan["evidence_references"]),
                                  approval_state="awaiting_human_review")

    @mcp.tool()
    def validate_repair_plan(plan_id: str) -> ValidationOutput:
        """Run the existing independent database validator; never approves the plan."""
        plan_id = PlanToolArgs.model_validate({"plan_id": plan_id}).plan_id
        if plan_id not in owned_plans:
            raise ValueError("plan_not_proposed_in_this_investigation")
        with httpx.Client(base_url=os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/"), timeout=90) as client:
            response = client.post(f"/api/v1/runs/{run_id}/repair-plans/{plan_id}/validate")
            response.raise_for_status()
            plan = response.json()
        v = plan.get("validation") or {}
        return ValidationOutput(plan_id=plan_id, plan_status=plan["status"],
                                verification_status=v.get("status", "incomplete"), excluded_rows=plan["excluded_rows"],
                                remaining_cross_split_components=v.get("remaining_cross_split_components"),
                                reasons=v.get("reasons", []), approval_state="awaiting_human_review")

    @mcp.tool()
    def get_verification_receipt(plan_id: str) -> ReceiptOutput:
        """Read a persisted repair plan and its actual independent verification state."""
        plan_id = PlanToolArgs.model_validate({"plan_id": plan_id}).plan_id
        if plan_id not in owned_plans:
            raise ValueError("plan_not_proposed_in_this_investigation")
        with httpx.Client(base_url=os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/"), timeout=30) as client:
            response = client.get(f"/api/v1/runs/{run_id}/repair-plans/{plan_id}")
            response.raise_for_status()
            plan = response.json()
        validation = plan.get("validation") or {}
        return ReceiptOutput(plan_id=plan_id, plan_status=plan["status"], verification_status=validation.get("status"),
                             approval_state="human_approved" if plan.get("approved_at") else ("awaiting_human_review" if plan["status"] in ("draft", "validated") else "none"),
                             approved_at=plan.get("approved_at"), manifest_sha256=plan["manifest_sha256"],
                             checks=validation.get("checks", {}), scope=validation.get("scope"))

    return mcp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_id")
    parser.add_argument("investigation_id")
    args = parser.parse_args()
    # stdout belongs exclusively to the MCP protocol. FastMCP logs to stderr.
    create_server(args.run_id, args.investigation_id).run(transport="stdio")


if __name__ == "__main__":
    main()
