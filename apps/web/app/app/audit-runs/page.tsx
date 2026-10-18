'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Run } from '../../../lib/api';
import { getRecentRunIds } from '../../../lib/history';
import { Arrow, EmptyState, PageError, StatusPill } from '../../../components/ui';

export default function AuditRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true); setError('');
    const ids = getRecentRunIds();
    if (!ids.length) { setRuns([]); setLoading(false); return; }
    Promise.all(ids.map(id => api<Run>(`/api/v1/runs/${id}`).catch(() => null)))
      .then(values => setRuns(values.filter((value): value is Run => value !== null)))
      .catch(reason => setError((reason as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return <div className="audit-runs-page">
    <div className="workspace-page-heading"><div><p className="eyebrow">Browser-local history</p><h1>Audit runs</h1><p>Leakline does not expose a shared run-list endpoint. This list only reopens run IDs saved in this browser.</p></div><Link className="btn-primary" href="/app/new">New audit <Arrow /></Link></div>
    {error && <PageError onRetry={load}>{error}</PageError>}
    {loading ? <div className="run-skeleton"><i className="skeleton" /><i className="skeleton" /><i className="skeleton" /></div> : runs.length ? <div className="history-table surface"><div className="history-table-head"><span>Dataset / run</span><span>Status</span><span>Source revision</span><span>Scope</span><span /></div>{runs.map(run => <Link href={`/app/runs/${run.analysis_id}`} className="history-row" key={run.analysis_id}><span><strong>{run.request.dataset}</strong><code className="mono">{run.analysis_id}</code></span><StatusPill tone={run.status === 'complete' ? 'good' : run.status === 'failed' || run.status === 'interrupted' ? 'bad' : 'warning'}>{run.status}</StatusPill><code className="mono">{run.result?.source.revision_sha ?? run.request.revision}</code><span>{run.result ? `${run.result.analyzed_samples.toLocaleString()} inspected rows` : `Up to ${run.request.limit_per_split.toLocaleString()} per split`}</span><Arrow diagonal /></Link>)}</div> : <EmptyState title="No run IDs have been saved in this browser." action={<Link className="btn-primary" href="/app/new">Start an audit <Arrow /></Link>}>Run history is not available as a server-side list. You can reopen a known run ID directly, including the project’s saved GoEmotions demonstration if that data is present locally.</EmptyState>}
  </div>;
}
