from typing import Literal
from pydantic import BaseModel, Field, model_validator


class InspectRequest(BaseModel):
    dataset: str
    config: str | None = None
    revision: str = "main"


class Source(BaseModel):
    dataset_id: str
    revision_sha: str
    config: str
    configs: list[str]
    splits: dict[str, int]
    columns: dict[str, str]
    license: str


class AuditRequest(InspectRequest):
    text_column: str = "text"
    label_column: str | None = "label"
    train_splits: list[str] = Field(default_factory=lambda: ["train"])
    evaluation_splits: list[str] = Field(default_factory=lambda: ["test"])
    limit_per_split: int = Field(default=200, ge=1, le=2000)
    seed: int = 42
    threshold: float = Field(default=.9, ge=.8, le=1)

    @model_validator(mode="after")
    def boundary(self):
        if not self.train_splits or not self.evaluation_splits or set(self.train_splits) & set(self.evaluation_splits):
            raise ValueError("Training and evaluation splits must be nonempty and disjoint")
        return self


class Sample(BaseModel):
    sample_id: str
    split: str
    row_index: int
    text: str
    label: str | None
    raw_hash: str
    text_hash: str


class Evidence(BaseModel):
    pair_id: str
    a: str
    b: str
    method: Literal["exact_sha256", "minhash_jaccard"]
    score: float
    threshold: float
    status: Literal["confirmed", "needs_review"]
    reason: str
    version: str = "strict-v1-char5-minhash128-seed42"


class Component(BaseModel):
    component_key: str
    sample_ids: list[str]
    splits: list[str]
    crosses_boundary: bool


class Result(BaseModel):
    source: Source
    coverage: dict[str, float]
    inspected_counts: dict[str, int] = Field(default_factory=dict)
    analyzed_samples: int
    accepted_edges: int
    review_edges: int
    components: list[Component]
    findings: list[Component]
    cross_split_components: list[Component] = Field(default_factory=list)
    evidence: list[Evidence]
    graph_name: str
    queries: list[str]
    scope_note: str = "Only audited rows and confirmed edges are covered; MinHash may miss candidates. Original source is read-only."


class Run(BaseModel):
    analysis_id: str
    status: Literal["queued", "ingesting", "matching", "graph", "complete", "failed", "interrupted"]
    request: AuditRequest
    events: list[str] = Field(default_factory=list)
    result: Result | None = None
    error: str | None = None
