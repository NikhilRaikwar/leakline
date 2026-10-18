from typing import Literal
import math
from pydantic import BaseModel, ConfigDict, Field, model_validator


class RepairRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy: Literal["preserve_test", "alternative_split"] = "preserve_test"
    protected_splits: list[str] = Field(default_factory=lambda: ["test"], min_length=1, max_length=8)
    seed: int = 42
    target_ratios: dict[str, float] | None = None
    size_tolerance: float = Field(default=.15, ge=0, le=.5)
    min_rows_per_split: int = Field(default=1, ge=1, le=1000)
    require_all_labels_in_each_split: bool = False

    @model_validator(mode="after")
    def ratios(self):
        if self.target_ratios is not None:
            if len(self.target_ratios) < 2 or len(self.target_ratios) > 8 or any(not math.isfinite(v) or v <= 0 or v >= 1 for v in self.target_ratios.values()) or abs(sum(self.target_ratios.values())-1) > 1e-8:
                raise ValueError("target_ratios must contain 2–8 positive fractions summing to 1")
        return self


class Assignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_id: str
    row_index: int
    original_split: str
    assigned_split: str | None
    component_key: str
    label: str | None
    reason: str


class ValidationReport(BaseModel):
    status: Literal["verified", "incomplete", "not_applicable", "failed"]
    checked_at: str
    analysis_id: str
    plan_id: str
    manifest_sha256: str
    dataset_id: str | None = None
    revision_sha: str | None = None
    policy: str | None = None
    seed: int | None = None
    near_duplicate_threshold: float | None = None
    coverage: dict[str, float] = Field(default_factory=dict)
    inspected_counts: dict[str, int] = Field(default_factory=dict)
    full_source_split_sizes: dict[str, int] = Field(default_factory=dict)
    graph_fingerprint: str | None = None
    checks: dict[str, bool] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)
    cross_boundary_components_before: int | None = None
    cross_boundary_components_after: int | None = None
    remaining_cross_split_components: int | None = None
    protected_splits: list[str] = Field(default_factory=list)
    all_split_boundaries_checked: bool = False
    split_counts: dict[str, int] = Field(default_factory=dict)
    label_counts: dict[str, dict[str, int]] = Field(default_factory=dict)
    queries: list[str] = Field(default_factory=list)
    scope: str = "Only accepted evidence and analyzed rows are covered; uninspected rows and undetected relationships are outside this check."


class RepairPlan(BaseModel):
    schema_version: str = "repair-v1"
    analysis_id: str
    plan_id: str
    request: RepairRequest
    status: Literal["draft", "validated", "approved", "not_applicable", "failed", "incomplete"]
    created_at: str
    approved_at: str | None = None
    graph_fingerprint: str
    manifest_sha256: str = ""
    assignments: list[Assignment] = Field(default_factory=list)
    evidence_references: dict[str, list[str]] = Field(default_factory=dict)
    target_ratios: dict[str, float] = Field(default_factory=dict)
    before_counts: dict[str, int] = Field(default_factory=dict)
    after_counts: dict[str, int] = Field(default_factory=dict)
    before_labels: dict[str, dict[str, int]] = Field(default_factory=dict)
    after_labels: dict[str, dict[str, int]] = Field(default_factory=dict)
    excluded_rows: int = 0
    moved_rows: int = 0
    cross_split_components_before: int = 0
    warnings: list[str] = Field(default_factory=list)
    validation: ValidationReport | None = None


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approve: Literal[True]
    manifest_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class ArtifactInfo(BaseModel):
    filename: str
    sha256: str
    bytes: int
    url: str


class ComponentDetail(BaseModel):
    component_key: str
    samples: list[dict]
    evidence: list[dict]
    path_sample_ids: list[str]
    path_pair_ids: list[str]
    path_note: str
    total_samples: int
    truncated: bool
