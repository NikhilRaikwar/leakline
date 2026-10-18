import json
import logging
import os
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from .models import InspectRequest, Source, AuditRequest, Run, Result, Component
from .ingest import inspect, ingest, dataset_id
from .matching import match
from .graph import Graph

DATA = Path(os.getenv("LEAKLINE_DATA", "data"))
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / "runs.sqlite3"
executor = ThreadPoolExecutor(max_workers=1)
log = logging.getLogger(__name__)


def connection():
    db = sqlite3.connect(DB, timeout=30)
    db.execute("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
    return db


def save(run):
    with connection() as db:
        db.execute("INSERT OR REPLACE INTO runs VALUES (?,?)", (run.analysis_id, run.model_dump_json()))


def read(run_id):
    with connection() as db:
        row = db.execute("SELECT payload FROM runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(404, "run_not_found")
    return Run.model_validate_json(row[0])


def work(run):
    def phase(status):
        run.status = status
        run.events.append(status)
        save(run)
    try:
        phase("ingesting")
        source = inspect(run.request)
        # Record resolved source before rows; all subsequent loads use this commit.
        run.request.revision = source.revision_sha
        run.request.config = source.config
        save(run)
        samples = ingest(run.request,source)
        phase("matching")
        edges = match(samples,run.request.threshold)
        phase("graph")
        graph_name = "leakline_" + run.analysis_id.replace("-", "")
        graph = Graph(graph_name)
        graph.store(source,samples,edges)
        components,findings = graph.components(run.request.train_splits,run.request.evaluation_splits)
        run.result = Result(source=source,coverage={s:sum(x.split==s for x in samples)/n for s,n in source.splits.items()},
                            analyzed_samples=len(samples),accepted_edges=sum(e.status=="confirmed" for e in edges),
                            review_edges=sum(e.status=="needs_review" for e in edges),components=components,
                            findings=findings,evidence=edges,graph_name=graph_name,queries=graph.queries)
        phase("complete")
    except Exception as exc:
        log.exception("Audit failed: %s",run.analysis_id)
        run.error = f"{type(exc).__name__}: audit failed during {run.status}; check server logs"
        phase("failed")


@asynccontextmanager
async def lifespan(app):
    # A killed single-process worker cannot claim an old run is still progressing.
    with connection() as db:
        rows = db.execute("SELECT payload FROM runs").fetchall()
    for (payload,) in rows:
        run = Run.model_validate_json(payload)
        if run.status not in ("complete","failed","interrupted"):
            run.status = "interrupted"
            run.error = "Worker restarted; submit a new audit"
            save(run)
    yield
    executor.shutdown(wait=True)


app = FastAPI(title="Leakline Phase 1",version="0.1.0",lifespan=lifespan)


@app.get("/health/ready")
def ready():
    try:
        graph = Graph("leakline_health")
        if not graph.db.connection.ping():
            raise RuntimeError("No PONG")
        return {"status":"ready","database":"FalkorDB"}
    except Exception:
        raise HTTPException(503,"graph_unavailable")


@app.post("/api/v1/datasets/inspect",response_model=Source)
def inspect_source(req: InspectRequest):
    try:
        return inspect(req)
    except ValueError as exc:
        raise HTTPException(422,str(exc))
    except Exception:
        raise HTTPException(502,"source_unavailable")


@app.post("/api/v1/runs",response_model=Run,status_code=202)
def start(req: AuditRequest):
    try:
        dataset_id(req.dataset)
    except ValueError:
        raise HTTPException(422,"invalid_dataset_url")
    with connection() as db:
        pending = [Run.model_validate_json(row[0]) for row in db.execute("SELECT payload FROM runs")]
    if sum(r.status in ("queued","ingesting","matching","graph") for r in pending) >= 3:
        raise HTTPException(429,"audit_queue_full")
    run = Run(analysis_id=str(uuid.uuid4()),status="queued",request=req)
    save(run)
    executor.submit(work,run.model_copy(deep=True))
    return run


@app.get("/api/v1/runs/{run_id}",response_model=Run)
def get_run(run_id: str):
    return read(run_id)


@app.get("/api/v1/runs/{run_id}/findings",response_model=list[Component])
def findings(run_id: str):
    run = read(run_id)
    if run.status != "complete":
        raise HTTPException(409,"run_not_complete")
    return run.result.findings
