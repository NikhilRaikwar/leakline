'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, type Run, type Source } from '../../../lib/api';
import { saveRecentRun } from '../../../lib/history';
import { Arrow, PageError, StatusPill } from '../../../components/ui';

export default function NewAuditPage() {
  const [dataset, setDataset] = useState('');
  const [config, setConfig] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [train, setTrain] = useState('train');
  const [evaluation, setEvaluation] = useState<string[]>([]);
  const [textColumn, setTextColumn] = useState('text');
  const [labelColumn, setLabelColumn] = useState('label');
  const [limit, setLimit] = useState(200);
  const [threshold, setThreshold] = useState(.9);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const splitNames = useMemo(() => Object.keys(source?.splits ?? {}), [source]);
  const estimate = source ? Object.fromEntries(splitNames.map(split => [split, Math.min(limit, source.splits[split])])) : {};

  async function inspect() {
    setBusy(true); setError(''); setSource(null);
    try {
      const inspected = await api<Source>('/api/v1/datasets/inspect', { dataset: dataset.trim(), config: config.trim() || null });
      setSource(inspected);
      const names = Object.keys(inspected.splits);
      const trainName = names.includes('train') ? 'train' : names[0];
      setTrain(trainName);
      setEvaluation(names.filter(name => name !== trainName && (name === 'validation' || name === 'test')).length
        ? names.filter(name => name !== trainName && (name === 'validation' || name === 'test'))
        : names.filter(name => name !== trainName).slice(0, 1));
      setTextColumn('text' in inspected.columns ? 'text' : 'sentence' in inspected.columns ? 'sentence' : Object.keys(inspected.columns)[0] ?? 'text');
      setLabelColumn('labels' in inspected.columns ? 'labels' : 'label' in inspected.columns ? 'label' : '');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  function toggleEvaluation(name: string) {
    setEvaluation(current => current.includes(name) ? current.filter(value => value !== name) : [...current, name]);
  }

  async function startAudit(event: React.FormEvent) {
    event.preventDefault();
    if (!source || !evaluation.length) return;
    setWorking(true); setError('');
    try {
      const run = await api<Run>('/api/v1/runs', {
        dataset: source.dataset_id, revision: source.revision_sha, config: source.config,
        text_column: textColumn, label_column: labelColumn || null,
        train_splits: [train], evaluation_splits: evaluation, limit_per_split: limit, threshold,
      });
      saveRecentRun(run);
      window.location.assign(`/app/runs/${run.analysis_id}`);
    } catch (reason) { setError((reason as Error).message); setWorking(false); }
  }

  return <div className="new-audit-page">
    <div className="workspace-page-heading"><div><p className="eyebrow">New analysis</p><h1>Choose your source.</h1><p>Leakline reads public Hugging Face datasets at a pinned revision. The original dataset is never changed.</p></div><Link href="/app" className="text-link">Back to overview <Arrow /></Link></div>
    {error && <PageError>{error}</PageError>}
    <div className="new-audit-layout">
      <section className="form-panel surface"><div className="panel-title"><span className="step-number compact">1</span><div><h2>Inspect a Hugging Face dataset</h2><p>Use an owner/name or canonical dataset URL. Private and gated sources are not supported.</p></div></div>
        <div className="source-form"><label className="field">Dataset URL or owner/name<input autoComplete="url" value={dataset} onChange={event => { setDataset(event.target.value); setSource(null); }} placeholder="google-research-datasets/go_emotions" /><small>Only public datasets served by the Hugging Face datasets API.</small></label><label className="field">Configuration <span className="field-optional">Optional</span><input value={config} onChange={event => { setConfig(event.target.value); setSource(null); }} placeholder="Auto-select source default" /></label><button type="button" disabled={busy || !dataset.trim()} onClick={inspect} className="btn-primary">{busy ? 'Inspecting source…' : 'Inspect dataset'} <Arrow /></button></div>
        {source && <div className="source-metadata" aria-live="polite"><div className="metadata-heading"><div><span className="eyebrow">Resolved source</span><h3>{source.dataset_id}</h3></div><StatusPill tone="good">Revision pinned</StatusPill></div><dl><div><dt>Configuration</dt><dd>{source.config}</dd></div><div><dt>Revision SHA</dt><dd className="mono">{source.revision_sha}</dd></div><div><dt>License metadata</dt><dd>{source.license || 'Not supplied by source'}</dd></div></dl><div className="split-table"><div className="split-table-head"><span>Source split</span><span>Available rows</span></div>{Object.entries(source.splits).map(([name, count]) => <div className="split-table-row" key={name}><span className={`split-tag split-${name}`}>{name}</span><strong className="mono">{count.toLocaleString()}</strong></div>)}</div><p className="rights-note">Review the source card and terms before use. Public access or license metadata does not grant unrestricted redistribution rights.</p></div>}
      </section>
      <aside className="scope-panel surface"><div className="panel-title"><span className="step-number compact">2</span><div><h2>Set the audit scope</h2><p>Choose the text and split roles used by the existing audit endpoint.</p></div></div>
        {!source ? <div className="scope-placeholder"><span className="placeholder-line" /><span className="placeholder-line short" /><p>Inspect a dataset first to load its actual columns and splits.</p></div> : <form onSubmit={startAudit} className="scope-form">
          <label className="field">Text column<select value={textColumn} onChange={event => setTextColumn(event.target.value)}>{Object.keys(source.columns).map(name => <option key={name} value={name}>{name} · {source.columns[name]}</option>)}</select></label>
          <label className="field">Label column<select value={labelColumn} onChange={event => setLabelColumn(event.target.value)}><option value="">No label column</option>{Object.keys(source.columns).map(name => <option key={name} value={name}>{name} · {source.columns[name]}</option>)}</select><small>Multi-label source arrays are counted as marginal per-label observations.</small></label>
          <label className="field">Training split<select value={train} onChange={event => { setTrain(event.target.value); setEvaluation(current => current.filter(name => name !== event.target.value)); }}>{splitNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <fieldset className="split-options"><legend>Evaluation splits</legend>{splitNames.filter(name => name !== train).map(name => <label key={name}><input type="checkbox" checked={evaluation.includes(name)} onChange={() => toggleEvaluation(name)} /><span>{name}</span><small className="mono">{source.splits[name].toLocaleString()} source rows</small></label>)}</fieldset>
          {!evaluation.length && <p role="alert" className="inline-warning">Choose at least one evaluation split.</p>}
          <div className="scope-controls"><label className="field">Max rows per split<input type="number" min={1} max={2000} value={limit} onChange={event => setLimit(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} /><small>Backend limit: 1–2,000 inspected rows per split.</small></label><label className="field">Near-duplicate threshold<input type="number" min={0.8} max={1} step={0.01} value={threshold} onChange={event => setThreshold(Math.max(.8, Math.min(1, Number(event.target.value))))} /><small>Exact matching remains separately confirmed.</small></label></div>
          <div className="scope-estimate"><span className="eyebrow">Requested maximum · not a progress estimate</span>{Object.entries(estimate).map(([name, count]) => <span key={name}>{name}: <strong className="mono">{count.toLocaleString()}</strong> / {source.splits[name].toLocaleString()}</span>)}</div>
          <div className="partial-warning"><strong>Partial-scope warning</strong><p>A clean finding can only describe the inspected rows and accepted evidence. Uninspected samples and missed candidates remain outside the result.</p></div>
          <button className="btn-primary start-audit-button" type="submit" disabled={working || !evaluation.length}>{working ? 'Starting audit…' : 'Start audit'} <Arrow /></button>
        </form>}
      </aside>
    </div>
    <p className="local-notice">Leakline is a local, single-user workspace. Do not expose this API publicly without an enforced authentication boundary.</p>
  </div>;
}
