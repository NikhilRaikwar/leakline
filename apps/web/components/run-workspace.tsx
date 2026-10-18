'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { api, type Run } from '../lib/api';
import { saveRecentRun } from '../lib/history';
import { Arrow, EmptyState, PageError, StatusPill } from './ui';
import InvestigationPanel from './investigation-panel';
import RepairWorkspace from './repair-workspace';

const GraphExplorer = dynamic(() => import('./graph-explorer'), {
  loading: () => <div className="run-loading" aria-label="Loading graph explorer"><i className="skeleton" /><i className="skeleton" /></div>,
});

export type RunSection = 'overview' | 'graph' | 'evidence' | 'investigation' | 'repair' | 'verification' | 'exports';

const sectionNames: Record<RunSection, string> = {
  overview: 'Audit overview', graph: 'Graph explorer', evidence: 'Evidence inspector', investigation: 'AI investigation', repair: 'Repair review', verification: 'Verification', exports: 'Artifacts & exports',
};

export default function RunWorkspace({ runId, section }: { runId: string; section: RunSection }) {
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadRun = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await api<Run>(`/api/v1/runs/${encodeURIComponent(runId)}`, undefined, signal);
      setRun(next); setError(''); saveRecentRun(next);
      return next;
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError((reason as Error).message);
      return null;
    } finally { setLoading(false); }
  }, [runId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRun(controller.signal);
    return () => controller.abort();
  }, [loadRun]);

  useEffect(() => {
    if (!run || !['queued', 'ingesting', 'matching', 'graph'].includes(run.status)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cancelled) return;
      const next = await loadRun();
      if (!cancelled && next && ['queued', 'ingesting', 'matching', 'graph'].includes(next.status)) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [run?.analysis_id, run?.status, loadRun]);

  if (loading) return <div className="run-loading"><span className="eyebrow">Loading saved audit</span><i className="skeleton" /><i className="skeleton" /><i className="skeleton" /></div>;
  if (error && !run) return <div className="run-not-found"><PageError onRetry={() => { setLoading(true); void loadRun(); }}>{error}</PageError><Link className="btn-secondary" href="/app/audit-runs">Open local run history</Link></div>;
  if (!run) return null;

  const result = run.result;
  const routeBase = `/app/runs/${encodeURIComponent(runId)}`;
  const tabs: { title: string; slug: string }[] = [
    { title: 'Overview', slug: '' }, { title: 'Graph', slug: '/graph' }, { title: 'Evidence', slug: '/evidence' },
    { title: 'AI investigation', slug: '/investigation' }, { title: 'Repair', slug: '/repair' }, { title: 'Verification', slug: '/verification' }, { title: 'Exports', slug: '/exports' },
  ];

  if (run.status !== 'complete' || !result) return <div className="run-progress-page">
    <div className="workspace-page-heading"><div><p className="eyebrow">{run.request.dataset}</p><h1>Audit in progress</h1><p className="mono">Run {run.analysis_id}</p></div><StatusPill tone={run.status === 'failed' || run.status === 'interrupted' ? 'bad' : 'warning'}>{run.status}</StatusPill></div>
    <div className="progress-panel surface"><div className="progress-heading"><div><span className="eyebrow">Source revision</span><p className="mono">{run.request.revision}</p></div><button className="btn-secondary" onClick={() => { setLoading(true); void loadRun(); }}>Refresh status</button></div>
      {['queued', 'ingesting', 'matching', 'graph'].includes(run.status) ? <><div className="indeterminate-track" aria-label="Audit processing, completion percentage is not reported"><i /></div><p className="progress-honesty">The backend does not report a percentage. Status refreshes while the audit is active.</p></> : <PageError onRetry={() => { setLoading(true); void loadRun(); }}>{run.error ?? `Audit ended with status ${run.status}. It was not treated as a successful or clean run.`}</PageError>}
      <div className="actual-stages">{(run.events.length ? run.events : [run.status]).map((stage, index) => <div key={`${stage}-${index}`} className={`stage-row ${stage === run.status ? 'current' : ''}`}><span className={`stage-mark ${stage === run.status ? 'stage-active' : ''}`} /><span>{stageLabel(stage)}</span><span className="stage-real">reported by API</span></div>)}</div>
    </div>
  </div>;

  return <div className="run-detail-page">
    <div className="run-header"><div><div className="breadcrumb"><Link href="/app">Workspace</Link><span>/</span><span>{sectionNames[section]}</span></div><p className="eyebrow">{result.source.dataset_id} · {result.source.config}</p><h1>{sectionNames[section]}</h1><p className="run-header-meta"><span>Revision <code className="mono">{result.source.revision_sha}</code></span><span>Run <code className="mono">{run.analysis_id}</code></span></p></div><div className="run-state-actions"><StatusPill tone="good">Audit complete</StatusPill><Link className="btn-secondary" href="/app/new">New audit <Arrow /></Link></div></div>
    <nav className="run-tabs" aria-label="Audit sections">{tabs.map(tab => { const href = `${routeBase}${tab.slug}` || routeBase; const active = section === 'overview' ? tab.slug === '' : tab.slug === `/${section}`; return <Link key={tab.title} href={href} aria-current={active ? 'page' : undefined}>{tab.title}</Link>; })}</nav>
    {error && <PageError onRetry={() => { setLoading(true); void loadRun(); }}>{error}</PageError>}
    {section === 'overview' && <AuditOverview run={run} />}
    {(section === 'graph' || section === 'evidence') && <GraphExplorer run={run} initialEvidence={section === 'evidence'} />}
    {section === 'investigation' && <InvestigationPanel run={run} />}
    {(section === 'repair' || section === 'verification' || section === 'exports') && <RepairWorkspace run={run} mode={section} />}
  </div>;
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = { queued: 'Queued', ingesting: 'Fetching source and inspecting selected rows', matching: 'Detecting duplicates and checking similarity evidence', graph: 'Writing graph and running connected components', complete: 'Audit complete', failed: 'Audit failed', interrupted: 'Audit interrupted' };
  return labels[stage] ?? stage;
}

function AuditOverview({ run }: { run: Run }) {
  const result = run.result!;
  const fullSplits = Object.entries(result.source.splits);
  const findings = result.cross_split_components ?? [];
  const train = run.request.train_splits;
  const trainTest = findings.filter(group => train.some(split => group.splits.includes(split)) && group.splits.includes('test')).length;
  const trainValidation = findings.filter(group => train.some(split => group.splits.includes(split)) && group.splits.includes('validation')).length;
  return <div className="audit-overview-content">
    <div className="audit-conclusion"><div className="conclusion-mark" aria-hidden="true">{findings.length ? '!' : 'i'}</div><div><span className="eyebrow">Finding scope</span><h2>{findings.length ? `${findings.length} confirmed cross-split component${findings.length === 1 ? '' : 's'} in the analyzed rows.` : 'No confirmed cross-split duplicate groups were found within the analyzed scope.'}</h2><p>{result.scope_note} This result does not establish that uninspected rows are free of duplicates.</p></div></div>
    <div className="metric-strip"><Metric label="Rows inspected" value={result.analyzed_samples.toLocaleString()} caption="Across selected splits" /><Metric label="Confirmed edges" value={result.accepted_edges.toLocaleString()} caption="Accepted duplicate relationships" /><Metric label="Review candidates" value={result.review_edges.toLocaleString()} caption="Not included in confirmed WCC" /><Metric label="Cross-split groups" value={findings.length.toLocaleString()} caption="FalkorDB connected components" /></div>
    <section className="coverage-panel surface"><div className="section-row"><div><p className="eyebrow">Source coverage</p><h2>Inspected rows by split</h2></div><StatusPill>Seed {run.request.seed}</StatusPill></div><div className="coverage-table"><div className="coverage-table-heading"><span>Split</span><span>Inspected / source rows</span><span>Coverage</span></div>{fullSplits.map(([split, sourceCount]) => { const inspected = result.inspected_counts[split] ?? 0; const coverage = result.coverage[split] ?? 0; return <div className="coverage-table-row" key={split}><span className={`split-tag split-${split}`}>{split}</span><strong className="mono">{inspected.toLocaleString()} <span>/ {sourceCount.toLocaleString()}</span></strong><div className="coverage-cell"><div className="coverage-track"><i style={{ width: `${Math.max(coverage > 0 ? 1 : 0, coverage * 100)}%` }} /></div><span className="mono">{(coverage * 100).toFixed(2)}%</span></div></div>; })}</div><p className="scope-caveat">Partial sampling can miss duplicates. Findings apply only to this pinned revision, inspected rows, matching rules, and accepted evidence.</p></section>
    <section className="boundary-section"><div><p className="eyebrow">Boundary findings</p><h2>Where confirmed groups cross</h2><p>Counts are derived from the returned component memberships and this run’s configured training/evaluation splits.</p></div><div className="boundary-counts"><div><span>Train / test</span><strong className="mono">{trainTest}</strong></div><div><span>Train / validation</span><strong className="mono">{trainValidation}</strong></div><div><span>Other split boundaries</span><strong className="mono">{Math.max(0, findings.length - trainTest - trainValidation)}</strong></div></div></section>
    <section className="method-panel"><p className="eyebrow">Method and provenance</p><div className="method-grid"><div><span>Text column</span><strong>{run.request.text_column}</strong></div><div><span>Label column</span><strong>{run.request.label_column || 'Not selected'}</strong></div><div><span>Similarity threshold</span><strong className="mono">{run.request.threshold}</strong></div><div><span>Source revision</span><strong className="mono">{result.source.revision_sha}</strong></div></div></section>
    <div className="run-primary-links"><Link className="btn-primary" href={`/app/runs/${run.analysis_id}/graph`}>Inspect graph <Arrow /></Link><Link className="btn-secondary" href={`/app/runs/${run.analysis_id}/investigation`}>Investigate with AI <Arrow /></Link><Link className="btn-secondary" href={`/app/runs/${run.analysis_id}/repair`}>Review repair options <Arrow /></Link></div>
  </div>;
}

function Metric({ label, value, caption }: { label: string; value: string; caption: string }) {
  return <div className="metric-item"><span>{label}</span><strong className="mono">{value}</strong><small>{caption}</small></div>;
}
