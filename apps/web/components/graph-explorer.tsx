'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { api, splitLabel, splitTone, type Component, type ComponentDetail, type Run } from '../lib/api';
import { EmptyState, PageError, StatusPill } from './ui';

export default function GraphExplorer({ run, initialEvidence = false }: { run: Run; initialEvidence?: boolean }) {
  const groups = useMemo(() => run.result!.components.filter(component => component.sample_ids.length > 1), [run.result]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ComponentDetail | null>(null);
  const [selectedSample, setSelectedSample] = useState('');
  const [selectedPair, setSelectedPair] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const graphRoot = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => { if (!selectedId && groups.length) setSelectedId(groups[0].component_key); }, [groups, selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController(); setLoading(true); setError(''); setDetail(null);
    api<ComponentDetail>(`/api/v1/runs/${run.analysis_id}/components/${selectedId}`, undefined, controller.signal)
      .then(value => { setDetail(value); setSelectedSample(value.samples[0]?.sample_id ?? ''); setSelectedPair(''); })
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError((reason as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [run.analysis_id, selectedId, reloadKey]);

  useGSAP(() => {
    if (!detail || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.utils.toArray<SVGLineElement>('.graph-edge', graphRoot.current).forEach((line, index) => {
      const length = line.getTotalLength();
      gsap.fromTo(line, { strokeDasharray: length, strokeDashoffset: length }, {
        strokeDashoffset: 0, duration: .48, delay: index * .05, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset',
      });
    });
  }, { scope: graphRoot, dependencies: [detail, selectedId], revertOnUpdate: true });

  const currentSample = detail?.samples.find(sample => sample.sample_id === selectedSample);
  const currentPair = detail?.evidence.find(edge => edge.pair_id === selectedPair);
  const acceptedEdges = detail?.evidence.filter(edge => edge.status === 'confirmed') ?? [];
  const candidates = detail?.evidence.filter(edge => edge.status !== 'confirmed') ?? [];
  const positions = useMemo(() => {
    const values = detail?.samples ?? [];
    return new Map(values.map((sample, index) => {
      const angle = (Math.PI * 2 * index / Math.max(values.length, 1)) - Math.PI / 2;
      const radius = values.length <= 2 ? 125 : Math.min(160, 70 + values.length * 9);
      return [sample.sample_id, { x: 220 + Math.cos(angle) * radius, y: 170 + Math.sin(angle) * radius }];
    }));
  }, [detail]);

  function selectGroup(group: Component) { setSelectedId(group.component_key); setScale(1); setPan({ x: 0, y: 0 }); }
  function startPan(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('.graph-node-group, .graph-edge-group')) return;
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event: PointerEvent<SVGSVGElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPan({ x: start.panX + (event.clientX - start.x) * 440 / Math.max(bounds.width, 1), y: start.panY + (event.clientY - start.y) * 340 / Math.max(bounds.height, 1) });
  }
  function endPan(event: PointerEvent<SVGSVGElement>) {
    if (dragStart.current?.pointerId === event.pointerId) { dragStart.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  }

  return <div className="graph-page" ref={graphRoot}>
    <div className="workspace-page-heading"><div><p className="eyebrow">Run {run.analysis_id.slice(0, 8)} · confirmed relationships</p><h2>{initialEvidence ? 'Findings and evidence' : 'Explore connected samples across your dataset.'}</h2><p>Choose a returned component to load its real sample members, accepted edges, and bounded graph path.</p></div><StatusPill>{groups.length} non-singleton components</StatusPill></div>
    {!groups.length ? <EmptyState title="No confirmed duplicate components in this scope.">There are no connected groups with multiple samples to inspect. This does not establish absence of duplicates in uninspected rows.</EmptyState> : <>
      <div className="graph-workspace">
        <aside className="component-browser surface"><div className="component-browser-heading"><span className="eyebrow">Components</span><span className="mono">{groups.length}</span></div><ul>{groups.map((group, index) => <li key={group.component_key}><button className={selectedId === group.component_key ? 'component-picker selected' : 'component-picker'} onClick={() => selectGroup(group)} aria-pressed={selectedId === group.component_key}><span className="component-picker-top"><span className="mono">{String(index + 1).padStart(2, '0')}</span><span>{group.sample_ids.length} samples</span></span><code className="mono">{group.component_key.slice(0, 20)}…</code><span className="component-picker-splits">{group.splits.map(split => <span key={split} className={`split-tag split-${split}`}>{split}</span>)}</span><span className="component-boundary-label">{group.crosses_boundary ? 'Cross-split component' : 'Within-split component'}</span></button></li>)}</ul><p className="component-browser-note">WCC membership is from FalkorDB. The diagram only draws accepted edges returned for the selected group.</p></aside>
        <section className="graph-inspector surface" aria-label="Connected component graph and evidence">
          <div className="graph-panel-header"><div><span className="eyebrow">Selected group</span><h3 className="mono">{selectedId.slice(0, 20)}…</h3></div><div className="graph-controls"><button className="graph-control" aria-label="Zoom out" onClick={() => setScale(value => Math.max(.7, value - .1))}>−</button><span className="mono">{Math.round(scale * 100)}%</span><button className="graph-control" aria-label="Zoom in" onClick={() => setScale(value => Math.min(1.5, value + .1))}>+</button><button className="graph-control fit-control" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>Fit</button></div></div>
          {loading ? <div className="graph-loading"><i className="skeleton" /><i className="skeleton" /></div> : error ? <PageError onRetry={() => setReloadKey(value => value + 1)}>{error}</PageError> : detail && <>
            <div className="graph-canvas-wrap" role="group" aria-label="Interactive graph of accepted duplicate evidence">
              <svg className="graph-canvas" viewBox="0 0 440 340" role="img" aria-label={`${detail.samples.length} real sample nodes and ${acceptedEdges.length} returned accepted duplicate edges`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
                <g transform={`translate(${220 + pan.x} ${170 + pan.y}) scale(${scale}) translate(-220 -170)`}>
                  {acceptedEdges.map(edge => { const a = positions.get(edge.a); const b = positions.get(edge.b); return a && b ? <g key={edge.pair_id} role="button" tabIndex={0} aria-label={`Accepted ${edge.method} relationship ${edge.pair_id}`} onClick={() => setSelectedPair(edge.pair_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedPair(edge.pair_id); }} className="graph-edge-group"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedPair === edge.pair_id ? 'graph-edge selected' : 'graph-edge'} /><circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r="10" fill="transparent" /></g> : null; })}
                  {detail.samples.map(sample => { const point = positions.get(sample.sample_id)!; const tone = splitTone(sample.split); return <g key={sample.sample_id} role="button" tabIndex={0} aria-label={`${splitLabel(sample.split)} sample ${sample.sample_id}`} onClick={() => setSelectedSample(sample.sample_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedSample(sample.sample_id); }} className="graph-node-group"><circle cx={point.x} cy={point.y} r={selectedSample === sample.sample_id ? 14 : 11} className={`graph-node node-${tone} ${selectedSample === sample.sample_id ? 'node-selected' : ''}`} /><text x={point.x} y={point.y + 30} textAnchor="middle">{splitLabel(sample.split)}</text></g>; })}
                </g>
              </svg>
              <div className="graph-legend"><span><i className="split-dot train" /> Training</span><span><i className="split-dot validation" /> Validation</span><span><i className="split-dot test" /> Test</span><span><i className="legend-edge" /> Accepted edge</span></div>
            </div>
            <div className="graph-detail-grid"><section className="selected-sample"><div className="detail-subhead"><h4>Selected sample</h4>{currentSample && <span className={`split-tag split-${currentSample.split}`}>{currentSample.split}</span>}</div>{currentSample ? <><code className="mono detail-id">{currentSample.sample_id}</code><p className="sample-origin">Original row {currentSample.row_index} · label {currentSample.label ?? 'not supplied'}</p><blockquote>{currentSample.text || 'Text unavailable for this sample.'}{currentSample.text_truncated ? ' …' : ''}</blockquote></> : <p className="muted-copy">Select a node to inspect its sample.</p>}</section>
              <section><div className="detail-subhead"><h4>Relationship evidence</h4><span className="mono">{acceptedEdges.length}</span></div>{currentPair ? <div className="pair-detail"><code className="mono">{currentPair.pair_id}</code><p>{currentPair.method} · score <strong className="mono">{currentPair.score}</strong> · threshold <strong className="mono">{currentPair.threshold}</strong></p><p>{currentPair.reason}</p><span className="evidence-status">{currentPair.status}</span></div> : acceptedEdges.length ? <ul className="edge-list">{acceptedEdges.map(edge => <li key={edge.pair_id}><button onClick={() => setSelectedPair(edge.pair_id)}><span className="edge-status-dot" /><span className="mono">{edge.pair_id.slice(0, 16)}…</span><span>{edge.method} · {edge.score}</span></button></li>)}</ul> : <p className="muted-copy">No pair evidence was returned for the displayed members.</p>}{candidates.length > 0 && <p className="candidate-note">{candidates.length} review-only candidate relationship(s) returned. They are not drawn as accepted graph edges.</p>}</section></div>
            <div className="path-receipt"><div><span className="eyebrow">FalkorDB path</span><p className="mono path-sequence">{detail.path_sample_ids.length ? detail.path_sample_ids.map(id => id.slice(0, 10)).join(' → ') : 'No bounded path returned'}</p><p>{detail.path_note}</p></div><div className="path-pairs"><span>Pair IDs</span>{detail.path_pair_ids.length ? detail.path_pair_ids.map(id => <code className="mono" key={id}>{id.slice(0, 14)}…</code>) : <span>Not available</span>}</div></div>
            {detail.truncated && <p className="inline-warning">The API bounded the returned member list. WCC still determines full component membership.</p>}
          </>}
        </section>
      </div>
      <div className="accessible-members"><div><p className="eyebrow">Keyboard-accessible member list</p><h3>Samples in this component</h3></div><div className="member-table-scroll"><table><thead><tr><th>Sample ID</th><th>Original split</th><th>Source row</th><th>Inspect</th></tr></thead><tbody>{detail?.samples.map(sample => <tr key={sample.sample_id}><td className="mono">{sample.sample_id}</td><td><span className={`split-tag split-${sample.split}`}>{sample.split}</span></td><td className="mono">{sample.row_index}</td><td><button className="text-button" onClick={() => setSelectedSample(sample.sample_id)}>Select sample</button></td></tr>)}</tbody></table></div></div>
    </>}
  </div>;
}
