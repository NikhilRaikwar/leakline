export type Source = {
  dataset_id: string;
  revision_sha: string;
  config: string;
  configs: string[];
  splits: Record<string, number>;
  columns: Record<string, string>;
  license: string;
};

export type Component = {
  component_key: string;
  sample_ids: string[];
  splits: string[];
  crosses_boundary: boolean;
};

export type Evidence = {
  pair_id: string;
  a: string;
  b: string;
  method: string;
  score: number;
  threshold: number;
  status: string;
  reason: string;
};

export type AuditResult = {
  source: Source;
  coverage: Record<string, number>;
  inspected_counts: Record<string, number>;
  analyzed_samples: number;
  accepted_edges: number;
  review_edges: number;
  components: Component[];
  findings: Component[];
  cross_split_components: Component[];
  evidence: Evidence[];
  graph_name: string;
  queries: string[];
  scope_note: string;
};

export type Run = {
  analysis_id: string;
  status: 'queued' | 'ingesting' | 'matching' | 'graph' | 'complete' | 'failed' | 'interrupted';
  request: {
    dataset: string;
    config: string | null;
    revision: string;
    text_column: string;
    label_column: string | null;
    train_splits: string[];
    evaluation_splits: string[];
    limit_per_split: number;
    seed: number;
    threshold: number;
  };
  events: string[];
  result: AuditResult | null;
  error: string | null;
};

export type ComponentDetail = {
  component_key: string;
  samples: { sample_id: string; split: string; row_index: number; text: string; label: string | null; text_truncated?: boolean }[];
  evidence: Evidence[];
  path_sample_ids: string[];
  path_pair_ids: string[];
  path_note: string;
  total_samples: number;
  truncated: boolean;
};

export type Assignment = {
  sample_id: string;
  row_index: number;
  original_split: string;
  assigned_split: string | null;
  component_key: string;
  label: string | null;
  reason: string;
};

export type Validation = {
  status: 'verified' | 'incomplete' | 'not_applicable' | 'failed';
  checked_at: string;
  scope: string;
  reasons: string[];
  checks: Record<string, boolean>;
  remaining_cross_split_components: number | null;
  cross_boundary_components_before: number | null;
  cross_boundary_components_after: number | null;
  coverage: Record<string, number>;
  queries: string[];
};

export type RepairPlan = {
  analysis_id: string;
  plan_id: string;
  request: {
    policy: 'preserve_test' | 'alternative_split';
    protected_splits: string[];
    seed: number;
  };
  status: 'draft' | 'validated' | 'approved' | 'not_applicable' | 'failed' | 'incomplete';
  created_at: string;
  approved_at: string | null;
  graph_fingerprint: string;
  manifest_sha256: string;
  assignments: Assignment[];
  evidence_references: Record<string, string[]>;
  target_ratios: Record<string, number>;
  before_counts: Record<string, number>;
  after_counts: Record<string, number>;
  before_labels: Record<string, Record<string, number>>;
  after_labels: Record<string, Record<string, number>>;
  excluded_rows: number;
  moved_rows: number;
  cross_split_components_before: number;
  warnings: string[];
  validation: Validation | null;
};

export type Artifact = { filename: string; sha256: string; bytes: number; url: string };

export type Investigation = {
  investigation_id: string;
  run_id: string;
  status: string;
  request: { goal: string };
  model: string;
  provider: string;
  current_activity: string;
  events: { event_id: string; timestamp: string; kind: string; status: string; summary: string }[];
  tool_calls: {
    call_id: string; step: number; tool_name: string; arguments: Record<string, unknown>;
    query_template_id: string | null; status: string; elapsed_ms: number; result_digest: string | null;
    result_summary: string; result_preview: Record<string, unknown> | null; error_code: string | null;
  }[];
  model_calls: { step: number; status: string; elapsed_ms: number; requested_tools: string[]; total_tokens: number | null; cost_usd: number | null }[];
  decision: {
    outcome: string; next_action: string; summary: string; scope_statement: string; reasons: string[];
    component_ids: string[]; evidence_ids: string[]; repair_plan_id: string | null; confidence: string;
  } | null;
  repair_plan_id: string | null;
  repair_plan_status: string | null;
  approval_state: string;
  total_tokens: number;
  total_cost_usd: number | null;
  error_code: string | null;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, body === undefined
      ? { cache: 'no-store', signal }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('The local API could not be reached. Check that the Leakline backend is running.', 0);
  }
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof value.detail === 'string' ? value.detail : Array.isArray(value.detail)
      ? value.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(' · ')
      : `Request failed with HTTP ${response.status}.`;
    throw new ApiError(detail || `Request failed with HTTP ${response.status}.`, response.status);
  }
  return value as T;
}

export function splitLabel(split: string) {
  if (split === 'train') return 'Training';
  if (split === 'test') return 'Test';
  if (split === 'validation' || split === 'valid') return 'Validation';
  return split;
}

export function splitTone(split: string) {
  if (split === 'test') return 'test';
  if (split === 'validation' || split === 'valid') return 'validation';
  return 'train';
}
