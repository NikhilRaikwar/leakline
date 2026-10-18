'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, type Artifact, type RepairPlan, type Run } from '../lib/api';
import { Arrow, EmptyState, PageError, StatusPill } from './ui';
import type { RunSection } from './run-workspace';

type Mode = Extract<RunSection, 'repair' | 'verification' | 'exports'>;

export default function RepairWorkspace({ run, mode }: { run: Run; mode: Mode }) {
  const base = `/api/v1/runs/${run.analysis_id}`;
  const [plans, setPlans] = useState<RepairPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<'preserve_test' | 'alternative_split'>('preserve_test');
  const [protectedSplits, setProtectedSplits] = useState<string[]>(run.request.evaluation_splits.filter(split => split === 'test').length ? ['test'] : run.request.evaluation_splits.slice(0, 1));
  const [ratios, setRatios] = useState('');
  const [tolerance, setTolerance] = useState(.15);
  const [allLabels, setAllLabels] = useState(false);
  const [approvedByUser, setApprovedByUser] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  async function reloadPlans() {
    setError('');
    try {
      const values = await api<RepairPlan[]>(`${base}/repair-plans`);
      setPlans(values);
      setPlanId(current => values.some(item => item.plan_id === current) ? current : values[0]?.plan_id ?? '');
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reloadPlans(); }, [base]);
  const plan = plans.find(value => value.plan_id === planId) ?? null;
  const groups = run.result?.cross_split_components ?? [];
  const eligibleA = groups.some(group => protectedSplits.some(split => group.splits.includes(split)) && group.splits.some(split => !protectedSplits.includes(split)));
  const eligibleB = groups.length > 0;
  const eligible = policy === 'preserve_test' ? eligibleA : eligibleB;
  const changes = useMemo(() => plan?.assignments.filter(item => item.assigned_split !== item.original_split) ?? [], [plan]);
  const eligibleCount = plan?.assignments.length ?? 0;

  function toggleProtected(split: string) {
    setProtectedSplits(current => current.includes(split) ? current.filter(value => value !== split) : [...current, split]);
  }

  async function mutate(work: () => Promise<RepairPlan | void>) {
    setBusy(true); setError(''); setArtifacts([]);
    try {
      const updated = await work();
      if (updated) { setPlans(current => [updated, ...current.filter(item => item.plan_id !== updated.plan_id)]); setPlanId(updated.plan_id); }
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function createPlan() {
    if (!eligible || !protectedSplits.length) return;
    let target_ratios: Record<string, number> | null = null;
    if (policy === 'alternative_split' && ratios.trim()) {
      try { target_ratios = JSON.parse(ratios); }
      catch { setError('Target ratios must be valid JSON, for example {"train":0.8,"validation":0.1,"test":0.1}.'); return; }
    }
    await mutate(() => api<RepairPlan>(`${base}/repair-plans`, { policy, protected_splits: policy === 'preserve_test' ? protectedSplits : run.request.evaluation_splits, seed: run.request.seed, target_ratios, size_tolerance: tolerance, require_all_labels_in_each_split: allLabels }));
  }

  async function validate() {
    if (!plan) return;
    await mutate(() => api<RepairPlan>(`${base}/repair-plans/${plan.plan_id}/validate`, {}));
  }

  async function approve() {
    if (!plan || !approvedByUser || plan.status !== 'validated' || plan.validation?.status !== 'verified') return;
    await mutate(() => api<RepairPlan>(`${base}/repair-plans/${plan.plan_id}/approve`, { approve: true, manifest_sha256: plan.manifest_sha256 }));
    setApprovedByUser(false);
  }

  async function loadArtifacts() {
    if (!plan || plan.status !== 'approved') return;
    setBusy(true); setError('');
    try { setArtifacts(await api<Artifact[]>(`${base}/repair-plans/${plan.plan_id}/artifacts`)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="run-loading"><i className="skeleton" /><i className="skeleton" /></div>;

  return <div className="repair-workspace">
    <div className="workspace-page-heading"><div><p className="eyebrow">Deterministic repair · run {run.analysis_id.slice(0, 8)}</p><h2>{modeTitle(mode)}</h2><p>{mode === 'repair' ? 'Review what the planner proposes before you validate it.' : mode === 'verification' ? 'A fresh graph check determines validation status. Approval is a separate human decision.' : 'Downloads are available only after independent verification and explicit approval.'}</p></div>{plan && <StatusPill tone={plan.status === 'approved' ? 'good' : plan.status === 'failed' ? 'bad' : plan.status === 'validated' ? 'good' : 'warning'}>{plan.status}</StatusPill>}</div>
    {error && <PageError>{error}</PageError>}
    {plans.length > 0 && <div className="plan-selector"><label className="field">Saved plans<select value={planId} onChange={event => { setPlanId(event.target.value); setArtifacts([]); setApprovedByUser(false); }}>{plans.map(item => <option key={item.plan_id} value={item.plan_id}>{item.request.policy} · {item.status} · {item.plan_id.slice(0, 8)}</option>)}</select></label><button className="btn-secondary" disabled={busy} onClick={() => { setLoading(true); void reloadPlans(); }}>Refresh plans</button></div>}
    {!plan && mode !== 'repair' && <EmptyState title="No repair plan has been saved for this run." action={<Link className="btn-primary" href={`/app/runs/${run.analysis_id}/repair`}>Review repair options <Arrow /></Link>}>Plan creation is separate from audit findings. No validation, approval, or download state is implied.</EmptyState>}
    {!plan && mode === 'repair' && <>
      {groups.length === 0 ? <EmptyState title="There is nothing supported to repair in this analyzed scope.">No confirmed cross-split components were returned. A clean result only describes inspected rows and accepted evidence; no no-op plan will be created.</EmptyState> : <section className="repair-create-layout"><div className="repair-form-panel surface"><div className="panel-title"><span className="eyebrow">Policy selection</span><h3>Choose how to handle connected groups.</h3></div>
          <div className="policy-options"><button className={policy === 'preserve_test' ? 'policy-option chosen' : 'policy-option'} onClick={() => setPolicy('preserve_test')}><span className="policy-radio" /><span><strong>Policy A · Preserve protected splits</strong><small>Keep selected evaluation assignments unchanged. Quarantine connected non-protected rows in the proposed manifest.</small></span></button><button className={policy === 'alternative_split' ? 'policy-option chosen' : 'policy-option'} onClick={() => setPolicy('alternative_split')}><span className="policy-radio" /><span><strong>Policy B · Group-preserving alternative</strong><small>Keep each accepted component in one partition. This is an alternative experiment, never an official benchmark replacement.</small></span></button></div>
          {policy === 'preserve_test' ? <fieldset className="protected-splits"><legend>Protected source splits</legend>{Object.keys(run.result!.source.splits).map(split => <label key={split}><input type="checkbox" checked={protectedSplits.includes(split)} onChange={() => toggleProtected(split)} /><span>{split}</span><small>{run.result!.source.splits[split].toLocaleString()} source rows</small></label>)}</fieldset> : <div className="alternative-controls"><label className="field">Target fractions (JSON, optional)<textarea rows={2} value={ratios} onChange={event => setRatios(event.target.value)} placeholder="Leave blank to use inspected proportions" /><small>When supplied, fractions must cover every inspected split and sum to 1.</small></label><label className="field">Size tolerance<input type="number" min={0} max={.5} step={.01} value={tolerance} onChange={event => setTolerance(Math.max(0, Math.min(.5, Number(event.target.value))))} /></label><label className="checkbox-row"><input type="checkbox" checked={allLabels} onChange={event => setAllLabels(event.target.checked)} />Require every observed label in every partition</label><p className="inline-warning">The planner uses a bounded deterministic heuristic. Label counts for multi-label rows are marginal counts.</p></div>}
          <p className="scope-caveat">Seed {run.request.seed} · all assignments are proposals based on analyzed rows only. Original source rows remain unchanged.</p><button className="btn-primary" disabled={busy || !eligible || !protectedSplits.length} onClick={createPlan}>{busy ? 'Creating deterministic plan…' : 'Create repair plan'} <Arrow /></button>{!eligible && <p className="inline-warning">The selected policy boundary does not cross a confirmed component in this run; a plan would be a no-op.</p>}
        </div><aside className="repair-findings"><p className="eyebrow">Graph-backed findings</p><h3>{groups.length} cross-split component{groups.length === 1 ? '' : 's'}</h3><ul>{groups.map(group => <li key={group.component_key}><code className="mono">{group.component_key.slice(0, 16)}…</code><span>{group.splits.join(' / ')} · {group.sample_ids.length} samples</span></li>)}</ul><p>Policy A can address train/test crossings while a train/validation component remains outside the protected test boundary.</p></aside></section>}
    </>}
    {plan && <>
      <section className="plan-summary surface"><div className="plan-summary-head"><div><span className="eyebrow">Saved deterministic proposal</span><h3>{plan.request.policy === 'preserve_test' ? 'Preserve protected assignments' : 'Alternative grouped split'}</h3><code className="mono">{plan.plan_id}</code></div><StatusPill tone={plan.status === 'approved' || plan.status === 'validated' ? 'good' : plan.status === 'failed' ? 'bad' : 'warning'}>{plan.status}</StatusPill></div><div className="plan-provenance"><span>Policy <strong>{plan.request.policy}</strong></span><span>Seed <strong className="mono">{plan.request.seed}</strong></span><span>Protected <strong>{plan.request.protected_splits.join(', ') || 'none'}</strong></span><span>Manifest SHA-256 <code className="mono">{plan.manifest_sha256}</code></span></div><div className="plan-impact-grid"><Impact title="Rows quarantined" value={plan.excluded_rows} /><Impact title="Rows moved" value={plan.moved_rows} /><Impact title="Cross-split components before" value={plan.cross_split_components_before} /><Impact title="Assignments in manifest" value={eligibleCount} /></div>
        <div className="split-count-comparison"><div><span className="eyebrow">Before</span>{Object.entries(plan.before_counts).map(([split, count]) => <p key={split}><span className={`split-tag split-${split}`}>{split}</span><strong className="mono">{count.toLocaleString()}</strong></p>)}</div><div><span className="eyebrow">Proposed</span>{Object.entries(plan.after_counts).map(([split, count]) => <p key={split}><span className={`split-tag split-${split}`}>{split}</span><strong className="mono">{count.toLocaleString()}</strong></p>)}</div></div>
        {plan.warnings.length > 0 && <div className="plan-warnings"><strong>Planner warnings</strong><ul>{plan.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div>}
      </section>
      {mode === 'repair' && <section className="assignment-panel surface"><div className="section-row"><div><p className="eyebrow">Assignment impact</p><h3>Rows changed by this plan</h3></div><span className="mono">{changes.length} changes shown</span></div>{changes.length ? <AssignmentTable assignments={changes} /> : <p className="muted-copy">This plan has no row movement or quarantine assignments.</p>}<details className="label-distribution"><summary>Label distribution before and after</summary><div className="distribution-grid"><div><strong>Before</strong><pre>{JSON.stringify(plan.before_labels, null, 2)}</pre></div><div><strong>Proposed</strong><pre>{JSON.stringify(plan.after_labels, null, 2)}</pre></div></div></details><Link className="btn-primary" href={`/app/runs/${run.analysis_id}/verification`}>Continue to independent verification <Arrow /></Link></section>}
      {mode === 'verification' && <section className="verification-panel surface"><div className="section-row"><div><p className="eyebrow">Independent graph verification</p><h3>Check the proposal against the current graph.</h3></div><StatusPill tone={plan.validation?.status === 'verified' ? 'good' : plan.validation?.status === 'failed' ? 'bad' : 'warning'}>{plan.validation?.status ?? 'not run'}</StatusPill></div><p className="muted-copy">Every validation request re-queries FalkorDB, checks the stored graph fingerprint and assignment manifest, and reports remaining crossings. A verified status is limited to its returned scope.</p><button className="btn-primary" disabled={busy || ['not_applicable', 'failed'].includes(plan.status)} onClick={validate}>{busy ? 'Checking FalkorDB…' : 'Run independent validation'} <Arrow /></button>{plan.validation && <><div className="verification-receipt"><div className="receipt-head"><span>Verification receipt</span><code className="mono">{plan.validation.checked_at}</code></div><p>{plan.validation.scope}</p><div className="check-grid">{Object.entries(plan.validation.checks).map(([name, passed]) => <div className={`validation-check ${passed ? 'passed' : 'failed'}`} key={name}><span aria-hidden="true">{passed ? '✓' : '×'}</span><span>{formatCheck(name)}</span><strong>{passed ? 'Passed' : 'Failed'}</strong></div>)}</div><div className="residual-row"><span>Crossings before <strong className="mono">{plan.validation.cross_boundary_components_before ?? 'Unavailable'}</strong></span><span>Protected-boundary crossings after <strong className="mono">{plan.validation.cross_boundary_components_after ?? 'Unavailable'}</strong></span><span>Other cross-split groups remaining <strong className="mono">{plan.validation.remaining_cross_split_components ?? 'Unavailable'}</strong></span></div>{plan.validation.reasons.map((reason, index) => <p className="validation-reason" key={`${index}-${reason}`}>{reason}</p>)}</div><div className="approval-panel"><div><span className="eyebrow">Human decision</span><h4>{plan.status === 'approved' ? 'This manifest has been approved.' : plan.status === 'validated' ? 'Validation passed; approval is still required.' : 'Approval is unavailable until verification succeeds.'}</h4><p>Approval does not change the source dataset. It authorizes this exact checksum-bound manifest for artifact downloads.</p></div>{plan.status !== 'approved' && <><label className="approval-consent"><input type="checkbox" checked={approvedByUser} onChange={event => setApprovedByUser(event.target.checked)} disabled={plan.status !== 'validated' || plan.validation.status !== 'verified'} /><span>I reviewed the assignments and approve this manifest.</span></label><button className="btn-primary" disabled={busy || !approvedByUser || plan.status !== 'validated' || plan.validation.status !== 'verified'} onClick={approve}>{busy ? 'Recording approval…' : 'Approve this manifest'} <Arrow /></button></>}{plan.status === 'approved' && <StatusPill tone="good">Approved by explicit user action</StatusPill>}</div></>}
      </section>}
      {mode === 'exports' && <section className="exports-panel surface"><div className="section-row"><div><p className="eyebrow">Controlled downloads</p><h3>Verified artifacts</h3></div><StatusPill tone={plan.status === 'approved' ? 'good' : 'warning'}>{plan.status === 'approved' ? 'Available' : 'Approval required'}</StatusPill></div><p className="muted-copy">Only the backend can create the artifacts, after approval and fresh verification. Downloads contain assignments, evidence references, and provenance—not source sample text.</p>{plan.status === 'approved' ? <button className="btn-primary" disabled={busy} onClick={loadArtifacts}>{busy ? 'Checking export gate…' : 'Load available artifacts'} <Arrow /></button> : <p className="export-lock-note">Current plan state: {plan.status}. Complete verification and explicit approval before downloading.</p>}{error && <PageError>{error}</PageError>}{artifacts.length > 0 && <ul className="artifact-list">{artifacts.map(file => <li key={file.filename}><div><strong>{file.filename}</strong><span>{file.bytes.toLocaleString()} bytes · SHA-256 <code className="mono">{file.sha256}</code></span></div><a className="btn-secondary" href={file.url} download>Download file <Arrow /></a></li>)}</ul>}</section>}
    </>}
  </div>;
}

function Impact({ title, value }: { title: string; value: number }) { return <div><span>{title}</span><strong className="mono">{value.toLocaleString()}</strong></div>; }

function AssignmentTable({ assignments }: { assignments: RepairPlan['assignments'] }) {
  return <div className="assignment-table-scroll"><table><thead><tr><th>Sample ID</th><th>Source</th><th>Proposed assignment</th><th>Reason</th></tr></thead><tbody>{assignments.slice(0, 200).map(item => <tr key={item.sample_id}><td><code className="mono">{item.sample_id}</code></td><td><span className={`split-tag split-${item.original_split}`}>{item.original_split}</span> · row {item.row_index}</td><td>{item.assigned_split ? <span className={`split-tag split-${item.assigned_split}`}>{item.assigned_split}</span> : <span className="quarantine-tag">Quarantined</span>}</td><td>{item.reason}</td></tr>)}</tbody></table>{assignments.length > 200 && <p className="table-limit-note">Showing 200 changed rows; approved downloads include the full manifest.</p>}</div>;
}

function formatCheck(value: string) { return value.replaceAll('_', ' ').replace(/:([a-z])/g, ' · $1').replace(/\b\w/g, char => char.toUpperCase()); }

function modeTitle(mode: Mode) { return mode === 'repair' ? 'Repair review' : mode === 'verification' ? 'Verification & approval' : 'Artifacts & exports'; }
