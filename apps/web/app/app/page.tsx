'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Run } from '../../lib/api';
import { getRecentRunIds } from '../../lib/history';
import { Arrow, EmptyState, PageError, StatusPill } from '../../components/ui';

const savedAuditId = '300f5981-b6f2-4c01-b3e8-8b772063b455';

export default function WorkspaceHome() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingDemo, setOpeningDemo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const ids = getRecentRunIds().slice(0, 5);
    if (!ids.length) { setLoading(false); return () => controller.abort(); }
    Promise.all(ids.map(id => api<Run>(`/api/v1/runs/${id}`, undefined, controller.signal).catch(() => null)))
      .then(values => setRuns(values.filter((value): value is Run => value !== null)))
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError((reason as Error).message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function openSavedAudit() {
    setOpeningDemo(true); setError('');
    try { await api<Run>(`/api/v1/runs/${savedAuditId}`); window.location.href = `/app/runs/${savedAuditId}`; }
    catch (reason) { setError((reason as Error).message); setOpeningDemo(false); }
  }

  return <div className="overview-page">
    <div className="workspace-page-heading"><div><p className="eyebrow">Dataset integrity workspace</p><h1>Welcome to Leakline.</h1><p>Start with a pinned source revision. Follow the evidence through FalkorDB, then review any proposed changes.</p></div><Link className="btn-primary" href="/app/new">Start a dataset audit <Arrow /></Link></div>
    <section className="welcome-band"><div><span className="welcome-rule" /><div><h2>One connected view of your evaluation data.</h2><p>Inspect public Hugging Face splits, find accepted duplicate relationships, and verify a repair manifest without modifying the source.</p></div></div><div className="welcome-meta"><StatusPill tone="good">FalkorDB-backed</StatusPill><span>Local single-user workspace</span></div></section>
    {error && <PageError>{error}</PageError>}
    <section className="recent-section"><div className="section-row"><div><p className="eyebrow">Your browser history</p><h2>Recent audits</h2><p>Run IDs are stored in this browser only; the backend has no shared history-list endpoint.</p></div><Link href="/app/audit-runs" className="text-link">View local history <Arrow /></Link></div>
      {loading ? <div className="run-skeleton"><i className="skeleton" /><i className="skeleton" /></div> : runs.length ? <div className="recent-list">{runs.map(run => <Link className="recent-row" href={`/app/runs/${run.analysis_id}`} key={run.analysis_id}><span className="recent-dataset">{run.request.dataset}</span><span className="mono recent-id">{run.analysis_id.slice(0, 8)}…</span><StatusPill tone={run.status === 'complete' ? 'good' : run.status === 'failed' || run.status === 'interrupted' ? 'bad' : 'warning'}>{run.status}</StatusPill><Arrow diagonal /></Link>)}</div> : <EmptyState title="No recent audits in this browser." action={<Link className="btn-secondary" href="/app/new">Inspect a public dataset <Arrow /></Link>}>Audit history is local to this browser. Completed runs can still be reopened with their run ID.</EmptyState>}
    </section>
    <section className="overview-actions"><article><span className="action-index">01</span><h3>Start with a source</h3><p>Inspect available configs, columns, split sizes, and the resolved source revision before you run an audit.</p><Link className="text-link" href="/app/new">Inspect a dataset <Arrow /></Link></article><article><span className="action-index">02</span><h3>Inspect a saved demonstration</h3><p>Try opening the real GoEmotions audit recorded for this project. It will be fetched from the local API; no result is seeded in the interface.</p><button className="btn-secondary" disabled={openingDemo} onClick={openSavedAudit}>{openingDemo ? 'Checking saved run…' : 'Open saved GoEmotions audit'} <Arrow /></button></article></section>
  </div>;
}
