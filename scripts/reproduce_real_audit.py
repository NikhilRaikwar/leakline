"""Re-run the recorded public scope through real HTTP; compare text-free receipts.

Start the API, then: uv run python scripts/reproduce_real_audit.py
Never selects individual pairs or changes the recorded request/threshold.
"""
import json
import time
from pathlib import Path
import httpx

reference=json.loads(Path("docs/real-analysis-report.json").read_text(encoding="utf-8"))
with httpx.Client(base_url="http://127.0.0.1:8000",timeout=180) as client:
    response=client.post("/api/v1/runs",json=reference["request"])
    response.raise_for_status()
    id=response.json()["analysis_id"]
    print("Reproducing pinned public scope via HTTP",id,flush=True)
    deadline=time.monotonic()+600
    while time.monotonic()<deadline:
        response=client.get(f"/api/v1/runs/{id}")
        response.raise_for_status()
        run=response.json()
        if run["status"] in ("complete","failed","interrupted"):
            break
        time.sleep(2)
    assert run["status"]=="complete",run
    actual=run["result"]
    expected=reference
    crossing=lambda values: sorted((tuple(sorted(x["sample_ids"])),tuple(sorted(x["splits"]))) for x in values)
    evidence=lambda values: sorted((e["pair_id"],e["a"],e["b"],e["method"],e["score"],e["threshold"],e["status"]) for e in values if e["status"]=="confirmed")
    checks={"same_pinned_revision":actual["source"]["revision_sha"]==expected["source"]["revision_sha"],
            "same_scope_counts":actual["inspected_counts"]==expected["scope"]["inspected_counts"] and actual["analyzed_samples"]==expected["scope"]["analyzed_samples"],
            "same_coverage":actual["coverage"]==expected["scope"]["coverage"],
            "same_accepted_edge_count":actual["accepted_edges"]==expected["scope"]["accepted_edges"],
            "same_crossing_components":crossing(actual["cross_split_components"])==crossing(expected["scope"]["cross_split_components"]),
            "same_confirmed_evidence":evidence(actual["evidence"])==evidence(expected["scope"]["confirmed_evidence"])}
    receipt={"reference_analysis_id":reference["analysis_id"],"reproduced_analysis_id":id,
             "request":run["request"],"checks":checks,"rows":actual["analyzed_samples"],
             "accepted_edges":actual["accepted_edges"],"cross_split_groups":len(actual["cross_split_components"]),
             "cross_split_components":actual["cross_split_components"],
             "confirmed_evidence":[{k:e[k] for k in ("pair_id","a","b","method","score","threshold","status")} for e in actual["evidence"] if e["status"]=="confirmed"]}
    Path("docs/reproducibility-receipt.json").write_text(json.dumps(receipt,indent=2),encoding="utf-8")
    print(json.dumps(receipt),flush=True)
    assert all(checks.values()),receipt
