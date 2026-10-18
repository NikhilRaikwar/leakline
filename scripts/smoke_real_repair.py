"""Create and independently verify Policy A on the recorded local live run.

Start the API and reproduce the dataset run first on a fresh checkout.
No approval transition is performed by this script.
"""
import json
from pathlib import Path
import httpx

reference=json.loads(Path("docs/real-analysis-report.json").read_text(encoding="utf-8"))
run_id=reference["analysis_id"]
with httpx.Client(base_url="http://127.0.0.1:8000",timeout=180) as client:
    run=client.get(f"/api/v1/runs/{run_id}")
    run.raise_for_status()
    assert run.json()["status"]=="complete", "reproduce the audit before testing its repair"
    plan=client.post(f"/api/v1/runs/{run_id}/repair-plans",json={"policy":"preserve_test","protected_splits":["test"]})
    plan.raise_for_status()
    plan=plan.json()
    validation=client.post(f"/api/v1/runs/{run_id}/repair-plans/{plan['plan_id']}/validate")
    validation.raise_for_status()
    result=validation.json()
    receipt={"analysis_id":run_id,"plan_id":plan["plan_id"],"status":result["status"],
             "validation_status":result["validation"]["status"],"excluded_rows":result["excluded_rows"],
             "before_counts":result["before_counts"],"after_counts":result["after_counts"],
             "remaining_cross_split_components":result["validation"]["remaining_cross_split_components"],
             "warnings":result["warnings"]}
    print(json.dumps(receipt,indent=2))
    assert result["status"]=="validated" and result["validation"]["status"]=="verified",receipt
