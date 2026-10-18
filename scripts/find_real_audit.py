"""Public-data search: fixed whole seeded scopes, unchanged .90 matching policy.
No fixtures or pair selection. Receipts omit raw source text.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"apps"/"api"))
import uuid
import json
from leakline.main import work, read, save
from leakline.models import Run, AuditRequest

for dataset,config,label in [("google-research-datasets/go_emotions","simplified","labels")]:
    req=AuditRequest(dataset=dataset,config=config,text_column="text",label_column=label,
                     revision="add492243ff905527e67aeb8b80c082af02207c3",
                     evaluation_splits=["validation","test"],limit_per_split=1500,seed=42,threshold=.90)
    run=Run(analysis_id=str(uuid.uuid4()),request=req,status="queued")
    save(run)
    print("Starting public audit",run.analysis_id,dataset,flush=True)
    work(run)
    result=read(run.analysis_id)
    if result.status!="complete":
        print(result.model_dump_json(),flush=True)
        continue
    report={"analysis_id":run.analysis_id,"request":result.request.model_dump(),"result":result.result.model_dump()}
    Path("docs/real-analysis-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"analysis_id":run.analysis_id,"rows":result.result.analyzed_samples,
                      "edges":result.result.accepted_edges,"findings":len(result.result.findings),
                      "cross_split":len(result.result.cross_split_components),"source":result.result.source.model_dump()}),flush=True)
