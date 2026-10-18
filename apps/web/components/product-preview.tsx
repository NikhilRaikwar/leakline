'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Run } from '../lib/api';
import { Arrow } from './ui';

const savedAuditId = '300f5981-b6f2-4c01-b3e8-8b772063b455';

export default function ProductPreview() {
  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    api<Run>(`/api/v1/runs/${savedAuditId}`, undefined, controller.signal)
      .then(value => { if (value.status === 'complete' && value.result) { setRun(value); setState('ready'); } else setState('unavailable'); })
      .catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) setState('unavailable'); });
    return () => controller.abort();
  }, []);

  const result = run?.result ?? null;
  const coverageRows = result ? Object.entries(result.source.splits) : [];
  const groups = result?.cross_split_components ?? [];
  const exactPairs = result?.evidence.filter(edge => edge.status === 'confirmed') ?? [];

  return <div className="preview-window surface soft-shadow" aria-label="Live preview of a saved Leakline audit">
    <div className="preview-chrome"><span className="chrome-dots" aria-hidden="true"><i /><i /><i /></span><span>Leakline workspace</span><span className="preview-local">{state === 'ready' ? 'Saved analysis' : 'Live data preview'}</span></div>
    <div className="preview-app">
      <aside className="preview-sidebar"><span className="wordmark">leakline</span><span className="preview-nav-active">Audit overview</span><span>Graph explorer</span><span>AI investigation</span><span>Repair review</span></aside>
      <div className="preview-content">
        <div className="preview-heading-row"><div><p className="eyebrow">Dataset integrity</p><h2>{result ? result.source.dataset_id : 'A real audit, when your API is running'}</h2><p>{result ? `Pinned ${result.source.config} configuration · revision ${result.source.revision_sha.slice(0, 12)}…` : 'This preview reads the persisted GoEmotions run through the local API.'}</p></div><span className={`status-pill ${state === 'ready' ? '' : 'preview-loading'}`}><span className={`status-dot ${state === 'ready' ? 'ok' : ''}`} />{state === 'ready' ? 'Audit complete' : state === 'loading' ? 'Connecting to API' : 'Preview unavailable'}</span></div>
        {state === 'ready' && result ? <>
          <div className="preview-grid">
            <section className="preview-coverage"><h3>Inspected scope</h3>
              {coverageRows.map(([split, sourceRows]) => <div className="coverage-line" key={split}><span><b className={`split-dot ${split}`} />{split}</span><strong className="mono">{result.inspected_counts[split].toLocaleString()} <small>/ {sourceRows.toLocaleString()}</small></strong><span className="coverage-track"><i style={{ width: `${Math.max(2, (result.coverage[split] ?? 0) * 100)}%` }} /></span></div>)}
              <div className="preview-summary"><span>Confirmed edges</span><strong className="mono">{result.accepted_edges}</strong></div><div className="preview-summary"><span>Cross-split groups</span><strong className="mono">{groups.length}</strong></div><p className="preview-caveat">Findings apply only to these inspected rows.</p>
            </section>
            <section className="preview-graph"><div className="preview-section-head"><h3>Connected components</h3><span><i className="split-dot train" /> Training <i className="split-dot test" /> Test</span></div>
              {groups.length ? <div className="component-list">{groups.slice(0, 3).map((group, index) => <div className="component-row" key={group.component_key}><span className="component-index mono">{String(index + 1).padStart(2, '0')}</span><span className="component-key mono">{group.component_key.slice(0, 16)}…</span><span className="component-members">{group.sample_ids.length} samples</span><div className="component-splits">{group.splits.map(split => <span className={`split-tag split-${split}`} key={split}>{split}</span>)}</div></div>)}</div> : <p className="preview-empty">No confirmed cross-split groups in this analyzed scope.</p>}
              <div className="preview-evidence"><span>Evidence retained per relationship</span><span className="mono">{exactPairs.length} confirmed pair records</span></div>
            </section>
          </div>
          <div className="preview-footnote"><span>Google Research · GoEmotions · public source</span>{run && <Link href={`/app/runs/${run.analysis_id}`}>Open this saved audit <Arrow /></Link>}</div>
        </> : <div className="preview-unavailable"><span className="preview-empty-mark">↗</span><div><h3>{state === 'loading' ? 'Reading a stored run' : 'Connect your local backend to see real findings'}</h3><p>{state === 'loading' ? 'This request does not trigger a new audit or an AI investigation.' : 'No preview data is substituted here. Start the API and open the saved GoEmotions run, or create an audit of your own.'}</p></div><Link href="/app/new" className="btn-secondary">Start a new audit <Arrow /></Link></div>}
      </div>
    </div>
  </div>;
}
