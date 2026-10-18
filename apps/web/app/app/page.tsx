'use client';
import {useEffect,useState} from 'react';
import RepairPanel, {type AuditResult} from './repair-panel';

type Source={dataset_id:string;revision_sha:string;config:string;configs:string[];splits:Record<string,number>;columns:Record<string,string>;license:string};
type Run={analysis_id:string;status:string;events:string[];error:string|null;result:AuditResult|null};

async function api(path:string,body?:unknown){
  const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));
  return data;
}

export default function Audit(){
  const [dataset,setDataset]=useState('');
  const [config,setConfig]=useState('');
  const [source,setSource]=useState<Source|null>(null);
  const [text,setText]=useState('text');
  const [label,setLabel]=useState('label');
  const [train,setTrain]=useState('train');
  const [evaluation,setEvaluation]=useState('test');
  const [limit,setLimit]=useState(200);
  const [run,setRun]=useState<Run|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('run')||localStorage.getItem('leakline_run');if(id)api(`/api/v1/runs/${encodeURIComponent(id)}`).then(r=>{setRun(r);localStorage.setItem('leakline_run',id);}).catch(e=>setError(e.message));},[]);
  const active=run && !['complete','failed','interrupted'].includes(run.status);
  const report=run?.result?Object.fromEntries(Object.entries(run.result).filter(([key])=>key!=='components')):null;
  useEffect(()=>{
    if(!active || !run)return;
    const timer=setInterval(()=>api(`/api/v1/runs/${run.analysis_id}`).then(setRun).catch(e=>setError(e.message)),1500);
    return ()=>clearInterval(timer);
  },[active,run?.analysis_id]);
  async function inspect(){
    setBusy(true);setError('');setSource(null);
    try {
      const s=await api('/api/v1/datasets/inspect',{dataset,config:config||null});setSource(s);
      setText('text' in s.columns?'text':'sentence' in s.columns?'sentence':Object.keys(s.columns)[0]);
      setLabel('label' in s.columns?'label':'labels' in s.columns?'labels':'');
      const training='train' in s.splits?'train':Object.keys(s.splits)[0];setTrain(training);
      const evaluation=['validation','test'].filter(name=>name in s.splits && name!==training);
      setEvaluation((evaluation.length?evaluation:Object.keys(s.splits).filter(name=>name!==training)).join(','));
    }
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function start(){
    if(!source)return;
    setBusy(true);setError('');
    try{
      const r=await api('/api/v1/runs',{dataset:source.dataset_id,revision:source.revision_sha,config:source.config,text_column:text,label_column:label||null,train_splits:train.split(',').map(s=>s.trim()),evaluation_splits:evaluation.split(',').map(s=>s.trim()),limit_per_split:limit});
      localStorage.setItem('leakline_run',r.analysis_id);setRun(r);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="max-w-4xl mx-auto p-6 md:p-12">
    <p className="text-sm tracking-widest mb-6">LEAKLINE / PHASE 2</p>
    <h1 className="text-3xl font-semibold mb-3">Audit a public text dataset</h1>
    <p>Real source rows → deterministic evidence → FalkorDB connected components.</p>
    <p className="text-sm mt-3 text-gray-600">Partial coverage can miss duplicates. A clean result applies only to the audited scope. Original datasets remain unchanged.</p>
    <section className="border border-gray-200 bg-white rounded p-5 my-8">
      <label>Hugging Face dataset URL or owner/name<input placeholder="https://huggingface.co/datasets/owner/name" value={dataset} onChange={e=>{setDataset(e.target.value);setSource(null);}}/></label>
      <label>Configuration (optional)<input value={config} onChange={e=>{setConfig(e.target.value);setSource(null);}}/></label>
      <button disabled={busy||!!active||!dataset} onClick={inspect}>Inspect dataset</button>
      {source&&<>
        <h2 className="text-lg font-semibold mt-6">Pinned source</h2>
        <pre>{JSON.stringify(source,null,2)}</pre>
        <p className="text-sm my-3">License: {source.license}. Review source terms before use; this app does not grant redistribution rights.</p>
        <div className="grid md:grid-cols-2 gap-x-4">
          <label>Text column<input value={text} onChange={e=>setText(e.target.value)}/></label>
          <label>Label column (optional)<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
          <label>Training splits (comma separated)<input value={train} onChange={e=>setTrain(e.target.value)}/></label>
          <label>Evaluation splits (comma separated)<input value={evaluation} onChange={e=>setEvaluation(e.target.value)}/></label>
          <label>Maximum rows per selected split<input type="number" min={1} max={2000} value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label>
        </div>
        <button disabled={busy||!!active} onClick={start}>Start Audit</button>
      </>}
    </section>
    {error&&<p role="alert" className="text-red-800 mb-5">{error}</p>}
    {run&&<section aria-live="polite">
      <h2 className="text-xl font-semibold">Run status: {run.status}</h2>
      <p className="break-all text-sm my-2">{run.analysis_id}</p>
      <p>{run.events.join(' → ')}</p>
      {run.error&&<p role="alert">{run.error}</p>}
      {run.status==='complete'&&run.result&&<RepairPanel key={run.analysis_id} runId={run.analysis_id} result={run.result}/>}
      <h3 className="font-semibold mt-6 mb-2">Raw findings and provenance</h3>
      <pre className="bg-white border border-gray-200 p-4 rounded">{report?JSON.stringify(report,null,2):'Results are not available yet.'}</pre>
      {run.result&&<p className="text-sm mt-3">Complete component membership is available in the <a className="underline" href={`/api/v1/runs/${run.analysis_id}`}>run JSON</a>.</p>}
    </section>}
  </main>;
}
