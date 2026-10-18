"""Live HTTP audit; writes only measured, text-free summary to docs.

uv run python scripts/smoke_api.py
"""
import json
import time
from pathlib import Path
from datetime import datetime, timezone
import httpx

summaries=[]
with httpx.Client(base_url="http://127.0.0.1:8000",timeout=180) as client:
    for dataset,text,label,config in [
        ("cornell-movie-review-data/rotten_tomatoes","text","label","default"),
        ("stanfordnlp/sst2","sentence","label","default"),
    ]:
        response=client.post("/api/v1/datasets/inspect",json={"dataset":dataset,"config":config})
        response.raise_for_status()
        src=response.json()
        response=client.post("/api/v1/runs",json={"dataset":dataset,"revision":src["revision_sha"],"config":src["config"],
            "text_column":text,"label_column":label,"limit_per_split":200})
        response.raise_for_status()
        id=response.json()["analysis_id"]
        deadline=time.monotonic()+600
        while time.monotonic()<deadline:
            response=client.get(f"/api/v1/runs/{id}")
            response.raise_for_status()
            run=response.json()
            if run["status"] in ("complete","failed","interrupted"):
                break
            time.sleep(2)
        assert run["status"]=="complete",run
        result=run["result"]
        summary={"recorded_at":datetime.now(timezone.utc).isoformat(),"analysis_id":id,
                 "source":result["source"],"coverage":result["coverage"],"analyzed_samples":result["analyzed_samples"],
                 "accepted_edges":result["accepted_edges"],"review_edges":result["review_edges"],
                 "component_count":len(result["components"]),"finding_count":len(result["findings"]),
                 "graph_name":result["graph_name"]}
        summaries.append(summary)
        print(json.dumps(summary),flush=True)
        Path("docs/live-audits.json").write_text(json.dumps(summaries,indent=2),encoding="utf-8")
