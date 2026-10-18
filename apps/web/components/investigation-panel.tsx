'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Investigation, type Run } from '../lib/api';
import { PageError, StatusPill } from './ui';

const savedDemo = { run: '300f5981-b6f2-4c01-b3e8-8b772063b455', investigation: 'ee747d1e-8b13-44d5-a9df-f6b80f079d7b' };
const terminal = new Set(['complete', 'failed', 'incomplete', 'interrupted']);

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    review_repair_plan: 'Review the proposed repair',
    create_repair_plan: 'Create a deterministic repair plan',
    validate_repair_plan: 'Independently validate the plan',
    no_repair_needed: 'No repair is supported for this scope',
    no_repair: 'No repair is supported for this scope',
    manual_review: 'Review the evidence manually',
  };
  return labels[action] ?? action.replaceAll('_', ' ');
}

function prettyState(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'not available';
}

function visibleToolSummary(status: string, summary: string, errorCode: string | null) {
  if (status === 'failed') return errorCode ? `Call failed: ${errorCode}` : 'Call failed. Open details for the recorded error.';
  const text = summary.trim();
  if (!text) return 'Call succeeded. Open details to inspect its result.';
  if (text.length > 220 || text.startsWith('{') || text.startsWith('[')) return 'Result recorded. Open details to inspect the returned data.';
  return text;
}

function toolSequence(calls: Investigation['tool_calls']) {
  const steps: { name: string; count: number }[] = [];
  for (const call of calls) {
    const previous = steps[steps.length - 1];
    if (previous?.name === call.tool_name) previous.count += 1;
    else steps.push({ name: call.tool_name, count: 1 });
  }
  return steps;
}

export default function InvestigationPanel({ run }: { run: Run }) {
  const runId = run.analysis_id;
  const storageKey = `leakline-investigation-${runId}`;
  const [id, setId] = useState('');
  const [goal, setGoal] = useState('Investigate confirmed cross-split components, report source coverage, and recommend a safe next action.');
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const local = localStorage.getItem(storageKey);
    const knownSaved = runId === savedDemo.run ? savedDemo.investigation : '';
    const initial = local || knownSaved;
    if (initial) { localStorage.setItem(storageKey, initial); setId(initial); }
  }, [runId, storageKey]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const current = await api<Investigation>(`/api/v1/runs/${runId}/investigations/${id}`);
        if (cancelled) return;
        setInvestigation(current); setError('');
        if (!terminal.has(current.status)) timer = setTimeout(poll, 1800);
      } catch (reason) { if (!cancelled) setError((reason as Error).message); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [runId, id]);

  async function start() {
    setBusy(true); setError('');
    try {
      const accepted = await api<{ investigation_id: string; status: string }>(`/api/v1/runs/${runId}/investigations`, { goal });
      localStorage.setItem(storageKey, accepted.investigation_id); setInvestigation(null); setId(accepted.investigation_id);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  function retryLoad() {
    setError(''); setInvestigation(null); setId(''); window.setTimeout(() => setId(localStorage.getItem(storageKey) ?? ''), 0);
  }

  const decision = investigation?.decision;
  const totalCost = investigation?.total_cost_usd;
  const groups = run.result?.cross_split_components ?? [];
  const trainSplits = run.request.train_splits;
  const boundaryCounts = run.request.evaluation_splits.map(split => ({
    split,
    count: groups.filter(group => trainSplits.some(trainSplit => group.splits.includes(trainSplit)) && group.splits.includes(split)).length,
  }));
  const coverage = run.result ? Object.entries(run.result.inspected_counts).map(([split, inspected]) => ({
    split,
    inspected,
    total: run.result!.source.splits[split],
    percent: (run.result!.coverage[split] ?? 0) * 100,
  })) : [];

  return <div className="investigation-page">
    <div className="workspace-page-heading"><div><p className="eyebrow">Graph-aware agent · run {runId.slice(0, 8)}</p><h2>Investigate with AI.</h2><p>The model can request bounded MCP tools. FalkorDB supplies the evidence; deterministic services plan and verify repairs. Approval remains yours.</p></div>{investigation && <StatusPill tone={investigation.status === 'complete' ? 'good' : investigation.status === 'failed' ? 'bad' : 'warning'}>{investigation.status}</StatusPill>}</div>
    {error && <PageError onRetry={retryLoad}>{error}</PageError>}
    <section className="investigation-start surface"><div><span className="eyebrow">Investigation request</span><h3>Ask a question about this run.</h3><p>Starting an investigation uses the configured provider and counts toward the backend’s per-run limit. Reloading this page only retrieves the saved trace.</p></div><label className="field">Investigation goal<textarea rows={3} minLength={8} maxLength={1600} value={goal} onChange={event => setGoal(event.target.value)} /></label><div className="investigation-actions"><span className="scope-caveat">Run scope: {run.result?.analyzed_samples.toLocaleString()} inspected rows. No full-dataset conclusion.</span><button className="btn-primary" disabled={busy || goal.trim().length < 8} onClick={start}>{busy ? 'Starting investigation…' : investigation && !terminal.has(investigation.status) ? 'Start another investigation' : 'Investigate with AI'} <span aria-hidden="true">→</span></button></div></section>
    {!investigation && !id && <div className="trace-empty"><p className="eyebrow">Saved execution trace</p><h3>No investigation selected for this run.</h3><p>Use the action above to start one, or reopen a run that has a saved investigation ID in this browser.</p></div>}
    {id && !investigation && !error && <div className="trace-loading"><i className="skeleton" /><i className="skeleton" /><p>Loading a saved investigation trace. No model request is being made.</p></div>}
    {investigation && <>
      <section className="investigation-result"><div className="result-heading"><div><span className="eyebrow">Saved investigation</span><h3>{investigation.status === 'complete' ? 'Evidence review complete' : investigation.status === 'running' || investigation.status === 'queued' ? 'Investigation is running' : 'Investigation ended without a complete decision'}</h3></div><div className="result-identifiers"><code className="mono">{investigation.investigation_id}</code><span>{investigation.provider} · {investigation.model}</span></div></div>
        {investigation.status === 'running' || investigation.status === 'queued' ? <div className="active-investigation" aria-live="polite"><span className="indeterminate-track"><i /></span><p>{investigation.current_activity}. The API reports no percentage-complete estimate.</p></div> : null}
        {investigation.error_code && <div role="alert" className="error-panel"><div><strong>No verified conclusion was saved.</strong><p>{investigation.error_code}. Review the recorded failures below; no fallback result was generated.</p></div></div>}
        {decision && <div className="decision-panel">
          <div className="decision-title"><span className="eyebrow">What the graph shows</span><StatusPill tone={decision.confidence === 'high' ? 'good' : 'warning'}>{prettyState(decision.confidence)}</StatusPill></div>
          <h4>{groups.length ? `${groups.length} confirmed group${groups.length === 1 ? '' : 's'} cross the analyzed splits.` : 'No confirmed cross-split groups in this run.'}</h4>
          <p className="decision-scope">Based on {run.result?.analyzed_samples.toLocaleString() ?? 'the analyzed'} inspected rows. This result does not cover uninspected examples.</p>
          <div className="investigation-facts">
            {boundaryCounts.map(({ split, count }) => <div key={split}><span>Training ↔ {split}</span><strong>{count}</strong><small>confirmed groups</small></div>)}
            <div><span>Rows inspected</span><strong>{run.result?.analyzed_samples.toLocaleString() ?? '—'}</strong><small>across selected splits</small></div>
          </div>
          {coverage.length > 0 && <div className="coverage-chips" aria-label="Inspected source coverage">{coverage.map(row => <span key={row.split}><strong>{row.split}</strong>{row.inspected.toLocaleString()} / {(row.total ?? 0).toLocaleString()} <small>{row.percent.toFixed(1)}%</small></span>)}</div>}
          <div className="decision-next"><div><span className="eyebrow">Recommended next step</span><strong>{actionLabel(decision.next_action)}</strong>{decision.repair_plan_id && <p>Plan {prettyState(investigation.repair_plan_status)} · approval {prettyState(investigation.approval_state)}. The agent did not approve it.</p>}</div><Link className="btn-secondary" href={`/app/runs/${encodeURIComponent(runId)}/${decision.repair_plan_id ? 'repair' : 'graph'}`}>{decision.repair_plan_id ? 'Review plan' : 'Inspect evidence'} <span aria-hidden="true">→</span></Link></div>
          <details className="decision-details"><summary>Read the agent’s explanation and evidence</summary><div className="decision-details-body"><h5>Agent summary</h5><p>{decision.summary}</p><h5>Scope statement</h5><p>{decision.scope_statement}</p>{decision.reasons.length > 0 && <><h5>Reasons</h5><ul>{decision.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul></>}<div className="evidence-reference-row"><div><span>Component IDs ({decision.component_ids.length})</span>{decision.component_ids.length ? decision.component_ids.map(value => <code className="mono" key={value}>{value}</code>) : <small>None cited</small>}</div><div><span>Evidence IDs ({decision.evidence_ids.length})</span>{decision.evidence_ids.length ? decision.evidence_ids.map(value => <code className="mono" key={value}>{value}</code>) : <small>None cited</small>}</div></div></div></details>
        </div>}
      </section>
      <section className="trace-section"><div className="section-row"><div><p className="eyebrow">Protocol activity</p><h3>Tool trace</h3></div><div className="trace-usage"><span>{investigation.tool_calls.length} tool calls</span><span>{investigation.tool_calls.filter(call => call.status === 'failed').length} failed</span><span>{investigation.total_tokens.toLocaleString()} tokens</span><span>{totalCost == null ? 'Cost unavailable' : `$${totalCost.toFixed(6)}`}</span></div></div>
        <div className="trace-explainer"><span>Model requested</span><i /> <span>Application validated</span><i /> <span>MCP executed</span><i /> <span>Graph evidence returned</span></div>
        {investigation.tool_calls.length ? <>
          <div className="trace-sequence"><span>Actual tool sequence</span><div>{toolSequence(investigation.tool_calls).map((step, index) => <span key={`${step.name}-${index}`}>{step.name.replaceAll('_', ' ')}{step.count > 1 ? ` ×${step.count}` : ''}</span>)}</div></div>
          <details className="full-tool-trace"><summary>Inspect all {investigation.tool_calls.length} calls, arguments, and results</summary><ol className="trace-list">{investigation.tool_calls.map((call, index) => <li key={call.call_id} className="trace-event"><span className={`trace-step-mark ${call.status === 'succeeded' ? 'success' : call.status === 'failed' ? 'failure' : ''}`}>{index + 1}</span><div className="trace-event-content"><div className="trace-event-heading"><div><strong>{call.tool_name}</strong><span>Step {call.step} · {call.query_template_id ?? 'business-specific tool'}</span></div><StatusPill tone={call.status === 'succeeded' ? 'good' : call.status === 'failed' ? 'bad' : 'warning'}>{call.status}</StatusPill></div><p>{visibleToolSummary(call.status, call.result_summary, call.error_code)}</p><details><summary>Validated arguments and result details</summary><div className="trace-details-grid"><div><span>Validated arguments</span><pre>{JSON.stringify(call.arguments, null, 2)}</pre></div><div><span>Bounded result preview</span><pre>{call.result_preview ? JSON.stringify(call.result_preview, null, 2) : call.result_summary || call.error_code || 'No preview recorded'}</pre></div></div><p className="trace-digest">{call.elapsed_ms.toLocaleString()} ms · digest {call.result_digest ?? 'not available'}</p></details></div></li>)}</ol></details>
        </> : <div className="trace-empty"><h4>No MCP tool calls were recorded.</h4><p>The model may have failed before tool selection. The interface does not invent a trace.</p></div>}
        {investigation.events.length > 0 && <details className="agent-events"><summary>Recorded investigation events ({investigation.events.length})</summary><ol>{investigation.events.map(event => <li key={event.event_id}><span className="mono">{new Date(event.timestamp).toLocaleTimeString()}</span><strong>{event.kind}</strong><StatusPill tone={event.status === 'succeeded' ? 'good' : event.status === 'failed' ? 'bad' : 'warning'}>{event.status}</StatusPill><p>{event.summary}</p></li>)}</ol></details>}
        {investigation.model_calls.length > 0 && <details className="model-call-details"><summary>Provider request receipts ({investigation.model_calls.length})</summary><div className="model-call-list">{investigation.model_calls.map(call => <div key={call.step}><span>Step {call.step} · {call.elapsed_ms} ms</span><strong>{call.status}</strong><span>Requested tools: {call.requested_tools.join(', ') || 'none'}</span><span>{call.total_tokens == null ? 'Tokens unavailable' : `${call.total_tokens.toLocaleString()} tokens`}</span><span>{call.cost_usd == null ? 'Cost unavailable' : `$${call.cost_usd.toFixed(6)}`}</span></div>)}</div></details>}
      </section>
    </>}
  </div>;
}
