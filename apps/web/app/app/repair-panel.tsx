'use client';
import {useEffect,useState} from 'react';

type Component={component_key:string;sample_ids:string[];splits:string[];crosses_boundary:boolean};
export type AuditResult={source:{dataset_id:string;revision_sha:string;splits:Record<string,number>};coverage:Record<string,number>;inspected_counts?:Record<string,number>;components:Component[];findings:Component[];cross_split_components?:Component[];[key:string]:unknown};
type Assignment={sample_id:string;row_index:number;original_split:string;assigned_split:string|null;label:string|null;reason:string};
type Validation={status:string;scope:string;reasons:string[];checks:Record<string,boolean>;cross_boundary_components_after:number|null};
type Plan={plan_id:string;status:string;manifest_sha256:string;request:{policy:string;seed:number;protected_splits:string[]};target_ratios:Record<string,number>;assignments:Assignment[];warnings:string[];excluded_rows:number;moved_rows:number;before_counts:Record<string,number>;after_counts:Record<string,number>;before_labels:Record<string,Record<string,number>>;after_labels:Record<string,Record<string,number>>;validation:Validation|null};
type Detail={samples:{sample_id:string;row_index:number;split:string;text:string;label:string|null;text_truncated:boolean}[];evidence:{pair_id:string;a:string;b:string;method:string;score:number;threshold:number;status:string;reason:string}[];path_sample_ids:string[];path_pair_ids:string[];path_note:string;total_samples:number;truncated:boolean};
type Artifact={filename:string;sha256:string;bytes:number;url:string};

async function request<T>(url:string,body?:unknown):Promise<T>{
  const response=await fetch(url,body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const value=await response.json();
  if(!response.ok)throw new Error(typeof value.detail==='string'?value.detail:JSON.stringify(value.detail));
  return value as T;
}

export default function RepairPanel({runId,result}:{runId:string;result:AuditResult}){
  const base=`/api/v1/runs/${runId}`;
  const counts=Object.fromEntries(Object.entries(result.source.splits).map(([s,n])=>[s,result.inspected_counts?.[s]??Math.round(n*(result.coverage[s]||0))]));
  const groups=result.components.filter(c=>c.sample_ids.length>1);
  const crossing=result.cross_split_components?.length?result.cross_split_components:groups.filter(c=>c.splits.length>1);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [policy,setPolicy]=useState('preserve_test');
  const [protectedSplits,setProtectedSplits]=useState('test');
  const [seed,setSeed]=useState(42);
  const [ratios,setRatios]=useState('');
  const [tolerance,setTolerance]=useState(.15);
  const [allLabels,setAllLabels]=useState(false);
  const [plan,setPlan]=useState<Plan|null>(null);
  const [approved,setApproved]=useState(false);
  const [files,setFiles]=useState<Artifact[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    request<Plan[]>(`${base}/repair-plans`).then(plans=>{if(!cancelled)setPlan(plans[0]??null);}).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;};
  },[base]);
  async function action(work:()=>Promise<void>){
    setBusy(true);setError('');
    try{await work();}catch(e){
      setError((e as Error).message);setFiles([]);setApproved(false);
      if(plan){try{setPlan(await request<Plan>(`${base}/repair-plans/${plan.plan_id}`));}catch{/* Preserve last known record with the visible connection error. */}}
    }finally{setBusy(false);}
  }
  function create(){return action(async()=>{
    const target=ratios.trim()?JSON.parse(ratios):null;
    const next=await request<Plan>(`${base}/repair-plans`,{policy,protected_splits:protectedSplits.split(',').map(s=>s.trim()),seed,
      target_ratios:policy==='alternative_split'?target:null,size_tolerance:tolerance,require_all_labels_in_each_split:allLabels});
    setPlan(next);setFiles([]);setApproved(false);
  });}
  function check(){return action(async()=>{
    if(!plan)return;
    setPlan(await request<Plan>(`${base}/repair-plans/${plan.plan_id}/validate`,{}));setFiles([]);setApproved(false);
  });}
  function approve(){return action(async()=>{
    if(!plan||!approved)return;
    setPlan(await request<Plan>(`${base}/repair-plans/${plan.plan_id}/approve`,{approve:true,manifest_sha256:plan.manifest_sha256}));
    setFiles([]);
  });}
  const changes=plan?.assignments.filter(a=>a.assigned_split!==a.original_split)??[];
  const protectedNames=protectedSplits.split(',').map(s=>s.trim());
  const eligible=policy==='alternative_split'?crossing.length>0:crossing.some(c=>c.splits.some(s=>protectedNames.includes(s))&&c.splits.some(s=>!protectedNames.includes(s)));
  return <section className="my-8 border border-gray-200 rounded bg-white p-5">
    <h2 className="text-xl font-semibold">Evidence and repair</h2>
    <p className="my-2 text-sm break-all">{result.source.dataset_id} · revision {result.source.revision_sha}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm my-4"><caption className="text-left font-semibold">Actual source coverage</caption>
      <thead><tr><th>Split</th><th>Inspected rows</th><th>Source rows</th><th>Coverage</th></tr></thead>
      <tbody>{Object.entries(result.source.splits).map(([s,n])=><tr key={s}><td>{s}</td><td>{counts[s]}</td><td>{n}</td><td>{((result.coverage[s]||0)*100).toFixed(2)}%</td></tr>)}</tbody>
    </table></div>
    <p className="text-sm">Uninspected rows remain outside every repair and verification claim.</p>
    <h3 className="font-semibold mt-6">Accepted duplicate components ({groups.length})</h3>
    {groups.length===0?<p>No accepted duplicate components in this scope.</p>:<ul className="space-y-2 my-3">{groups.slice(0,50).map(c=><li key={c.component_key}>
      <button disabled={busy} onClick={()=>action(async()=>setDetail(await request<Detail>(`${base}/components/${c.component_key}`)))}>Inspect component {c.component_key.slice(0,10)}</button>
      <span className="text-sm ml-2">{c.sample_ids.length} rows · {c.splits.join(' / ')}</span>
    </li>)}</ul>}
    {groups.length>50&&<p>Showing the first 50 groups. Full membership is in the run JSON.</p>}
    {detail&&<section className="border-t border-gray-200 pt-4 mt-4">
      <h3 className="font-semibold">Original samples and pair evidence</h3>
      <p className="text-sm">{detail.total_samples} members. {detail.truncated?'Partial rendering (50-row limit).':'All members shown.'}</p>
      {detail.samples.map(s=><article key={s.sample_id} className="my-3 border border-gray-200 rounded p-3">
        <p className="text-sm font-semibold">{s.split} · original row {s.row_index} · label {s.label??'unavailable'}</p>
        <p className="text-xs break-all my-2">{s.sample_id}</p><p>{s.text}{s.text_truncated?'… (excerpt truncated)':''}</p>
      </article>)}
      <h4 className="font-semibold mt-4">Evidence ({detail.evidence.length} displayed)</h4>
      {detail.evidence.map(e=><div key={e.pair_id} className="my-3 text-sm">
        <p>{e.method} · score {e.score} · threshold {e.threshold} · {e.status}</p>
        <p>{e.reason}</p><p className="break-all">Pair: {e.pair_id}</p><p className="break-all">{e.a} ↔ {e.b}</p>
      </div>)}
      <h4 className="font-semibold">Graph-returned path</h4><p className="text-xs break-all my-2">{detail.path_sample_ids.join(' → ')||'No bounded path displayed.'}</p>
      <p className="text-xs break-all">Evidence IDs: {detail.path_pair_ids.join(', ')||'none displayed'}</p><p className="text-sm my-2">{detail.path_note}</p>
    </section>}
    {crossing.length===0?<p className="my-5">No confirmed cross-split duplicate groups were found within the analyzed scope.</p>:<p className="my-5 font-semibold">{crossing.length} confirmed components span original splits in this scope.</p>}
    <h3 className="font-semibold mt-6">Create an alternative manifest</h3>
    <label>Repair policy<select value={policy} onChange={e=>setPolicy(e.target.value)}>
      <option value="preserve_test">Policy A — Preserve official test assignments</option><option value="alternative_split">Policy B — Group-preserving alternative experiment</option>
    </select></label>
    {policy==='preserve_test'?<label>Protected evaluation splits (comma separated)<input value={protectedSplits} onChange={e=>setProtectedSplits(e.target.value)}/></label>:<>
      <p>Alternative experiment, never an official benchmark replacement.</p>
      <label>Target fractions as JSON (blank uses inspected split proportions)<input placeholder={'{"train":0.8,"validation":0.1,"test":0.1}'} value={ratios} onChange={e=>setRatios(e.target.value)}/></label>
      <label>Maximum absolute fraction deviation<input type="number" min={0} max={.5} step={.01} value={tolerance} onChange={e=>setTolerance(Number(e.target.value))}/></label>
      <label><input className="w-auto mr-2" type="checkbox" checked={allLabels} onChange={e=>setAllLabels(e.target.checked)}/>Require every observed class in every partition</label>
    </>}
    <label>Deterministic split seed<input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label>
    <button disabled={busy||!eligible} onClick={create}>Create repair plan</button>
    {!eligible&&crossing.length>0&&<p className="text-sm mt-3">No confirmed component crosses the chosen protected boundary. Choose an applicable policy to propose a repair.</p>}
    {error&&<p role="alert" className="text-red-800 my-4 break-all">{error}</p>}
    {plan&&<section className="mt-6 border-t border-gray-200 pt-5">
      <h3 className="font-semibold">Repair plan: {plan.status}</h3><p className="text-xs break-all my-2">{plan.plan_id}</p>
      <p className="text-sm">Plan policy: {plan.request.policy} · seed {plan.request.seed} · protected {plan.request.protected_splits.join(', ')}</p>
      <p className="text-xs break-all my-2">Manifest SHA-256: {plan.manifest_sha256}</p>
      <p>{plan.excluded_rows} quarantined rows · {plan.moved_rows} moved rows</p>
      <ul className="list-disc pl-5 my-3 text-sm">{plan.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
      <details><summary className="cursor-pointer">Split counts and label distribution changes</summary><pre>{JSON.stringify({parameters:plan.request,target_fractions:plan.target_ratios,before:plan.before_counts,after:plan.after_counts,labels_before:plan.before_labels,labels_after:plan.after_labels},null,2)}</pre></details>
      <h4 className="font-semibold mt-4">Changed rows ({changes.length})</h4>
      <div className="max-h-80 overflow-auto text-sm">{changes.slice(0,100).map(a=><div className="border-b border-gray-100 p-2" key={a.sample_id}>
        <p>{a.original_split} row {a.row_index} → {a.assigned_split??'quarantine'} · label {a.label??'unavailable'}</p><p className="text-xs break-all">{a.sample_id}</p><p>{a.reason}</p>
      </div>)}</div>
      {changes.length>100&&<p className="text-sm">Showing 100 changes. Approved downloads contain every assignment.</p>}
      <button className="mt-4" disabled={busy||['not_applicable','failed'].includes(plan.status)} onClick={check}>Run independent verification</button>
      {plan.validation&&<section className="my-4" aria-live="polite"><h4 className="font-semibold">Verification: {plan.validation.status}</h4>
        <p className="text-sm my-2">{plan.validation.scope}</p><pre>{JSON.stringify(plan.validation,null,2)}</pre></section>}
      <label><input className="w-auto mr-2" type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I approve this manifest after reviewing its changes. The original dataset will remain unchanged.</label>
      <button disabled={busy||!approved||plan.status!=='validated'} onClick={approve}>Approve repair manifest</button>
      {plan.status==='approved'&&<div className="mt-4"><button disabled={busy} onClick={()=>action(async()=>setFiles(await request<Artifact[]>(`${base}/repair-plans/${plan.plan_id}/artifacts`)))}>Load verified downloads</button>
        <ul className="my-4 space-y-3">{files.map(f=><li key={f.filename}><a className="underline" href={f.url} download>{f.filename}</a><p className="text-xs break-all">{f.bytes} bytes · SHA-256 {f.sha256}</p></li>)}</ul>
      </div>}
    </section>}
  </section>;
}
