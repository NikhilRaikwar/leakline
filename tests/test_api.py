import time
from fastapi.testclient import TestClient
from leakline.main import app


def test_live_api_end_to_end():
    client=TestClient(app)
    assert client.get("/health/ready").status_code==200
    assert client.post("/api/v1/runs",json={"dataset":"https://localhost/a/b"}).status_code==422
    assert client.get("/api/v1/runs/absent").status_code==404
    req={"dataset":"cornell-movie-review-data/rotten_tomatoes","limit_per_split":8}
    inspect=client.post("/api/v1/datasets/inspect",json={"dataset":req["dataset"]})
    assert inspect.status_code==200,inspect.text
    req["revision"]=inspect.json()["revision_sha"]
    req["config"]=inspect.json()["config"]
    response=client.post("/api/v1/runs",json=req)
    assert response.status_code==202,response.text
    run_id=response.json()["analysis_id"]
    deadline=time.monotonic()+240
    while time.monotonic()<deadline:
        run=client.get(f"/api/v1/runs/{run_id}").json()
        if run["status"] in ("complete","failed"): break
        time.sleep(.25)
    assert run["status"]=="complete",run
    assert run["result"]["analyzed_samples"]==16
    assert run["result"]["source"]["revision_sha"]==req["revision"]
    assert client.get(f"/api/v1/runs/{run_id}/findings").json()==run["result"]["findings"]
