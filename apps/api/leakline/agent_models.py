from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InvestigationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    goal: str = Field(min_length=8, max_length=1600)


class EmptyToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ComponentToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    component_id: str = Field(pattern=r"^[a-f0-9]{64}$")


class PathToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_sample_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    target_sample_id: str = Field(pattern=r"^[a-f0-9]{64}$")


class ListComponentsToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=50, ge=1, le=500)


class QueryReadToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query_template_id: Literal["audit_scope", "cross_split_components", "component_evidence", "duplicate_path"]
    component_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    source_sample_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    target_sample_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class ExplainToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query_template_id: Literal["audit_scope", "cross_split_components", "component_evidence", "duplicate_path"]


class PolicyToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy: Literal["preserve_test", "alternative_split"]


class PlanToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str = Field(min_length=36, max_length=36)


class AgentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome: Literal["cross_split_findings", "no_findings_in_scope", "review_needed", "incomplete"]
    next_action: Literal["review_repair_plan", "choose_repair_policy", "no_repair_in_scope", "retry_later", "manual_review"]
    summary: str = Field(min_length=8, max_length=2400)
    scope_statement: str = Field(default="", max_length=2400)
    reasons: list[str] = Field(default_factory=list, max_length=8)
    component_ids: list[str] = Field(default_factory=list, max_length=50)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)
    repair_plan_id: str | None = None
    confidence: Literal["evidence_backed", "partial_scope", "uncertain"]


class InvestigationEvent(BaseModel):
    event_id: str
    timestamp: str = Field(default_factory=utc_now)
    kind: Literal["status", "model_request", "tool_call", "retry", "error", "decision"]
    status: Literal["running", "succeeded", "failed", "incomplete"]
    summary: str = Field(max_length=1200)


class AgentToolTrace(BaseModel):
    call_id: str
    step: int
    tool_name: str
    arguments: dict
    query_template_id: str | None = None
    mcp_server: str | None = None
    mcp_protocol_version: str | None = None
    status: Literal["succeeded", "failed", "rejected"]
    started_at: str = Field(default_factory=utc_now)
    elapsed_ms: int = Field(ge=0)
    result_digest: str | None = None
    result_summary: str = Field(default="", max_length=1200)
    result_preview: dict | None = None
    error_code: str | None = None
    retry_count: int = 0


class ModelTrace(BaseModel):
    step: int
    model: str
    provider: str = "openrouter"
    status: Literal["succeeded", "failed"]
    started_at: str = Field(default_factory=utc_now)
    elapsed_ms: int = Field(ge=0)
    retry_count: int = 0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    cost_usd: float | None = None
    requested_tools: list[str] = Field(default_factory=list)
    error_code: str | None = None


class Investigation(BaseModel):
    investigation_id: str
    run_id: str
    status: Literal["queued", "running", "complete", "failed", "incomplete", "interrupted"]
    request: InvestigationRequest
    model: str
    provider: str = "openrouter"
    mcp_server: str | None = None
    mcp_protocol_version: str | None = None
    mcp_tools_discovered: list[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    current_activity: str = "Queued"
    events: list[InvestigationEvent] = Field(default_factory=list)
    tool_calls: list[AgentToolTrace] = Field(default_factory=list)
    model_calls: list[ModelTrace] = Field(default_factory=list)
    decision: AgentDecision | None = None
    repair_plan_id: str | None = None
    repair_plan_status: str | None = None
    approval_state: Literal["awaiting_human_review", "not_applicable", "none"] = "none"
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_cost_usd: float | None = None
    error_code: str | None = None


class InvestigationAccepted(BaseModel):
    investigation_id: str
    run_id: str
    status: Literal["queued"]


class InvestigationTrace(BaseModel):
    investigation_id: str
    run_id: str
    provider: str
    model: str
    status: str
    events: list[InvestigationEvent]
    tool_calls: list[AgentToolTrace]
    model_calls: list[ModelTrace]
    decision: AgentDecision | None
    repair_plan_id: str | None
    repair_plan_status: str | None
    approval_state: str
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float | None
    error_code: str | None
