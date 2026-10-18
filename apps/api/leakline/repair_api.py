import csv
import hashlib
import io
import json
import os
import threading
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, HTTPException, Response, Query
from .repair_models import RepairRequest, RepairPlan, ApprovalRequest, ArtifactInfo, ComponentDetail, Assignment
from .planner import propose
from .validator import validate
from .snapshot import snapshot, canonical
from .graph import Graph

FILENAMES=("repair-manifest.json","split-assignments.csv","validation-report.json","audit-provenance.json")
ArtifactName=Literal["repair-manifest.json","split-assignments.csv","validation-report.json","audit-provenance.json"]
lock=threading.RLock()


def install(app,read_run,connection):
    router=APIRouter(prefix="/api/v1/runs/{run_id}")

    def database():
        db=connection()
        db.execute("CREATE TABLE IF NOT EXISTS repair_plans (run_id TEXT, plan_id TEXT, payload TEXT NOT NULL, PRIMARY KEY (run_id,plan_id))")
        return db

    def save_plan(plan):
        # Keep the graph-native decision receipt alongside the source evidence.
        # An outage report must still be durably saved even when graph writes fail.
        if plan.status!="incomplete":
            try:
                graph=Graph(read_run(plan.analysis_id).result.graph_name)
                graph.query("MERGE (r:AnalysisRun {analysis_id:$run}) MERGE (p:RepairPlan {plan_id:$plan}) "
                            "SET p.status=$status,p.policy=$policy,p.manifest_sha256=$digest,p.created_at=$created,p.approved_at=$approved "
                            "MERGE (r)-[:PROPOSES]->(p)",
                            {"run":plan.analysis_id,"plan":plan.plan_id,"status":plan.status,"policy":plan.request.policy,
                             "digest":plan.manifest_sha256,"created":plan.created_at,"approved":plan.approved_at})
                affected=sorted({a.component_key for a in plan.assignments if a.assigned_split!=a.original_split})
                if affected:
                    graph.query("UNWIND $keys AS key MATCH (p:RepairPlan {plan_id:$plan}),(c:Component {component_key:key}) MERGE (p)-[:AFFECTS]->(c)",
                                {"keys":affected,"plan":plan.plan_id})
            except Exception:
                raise HTTPException(503,"repair_graph_receipt_unavailable")
        with database() as db:
            db.execute("INSERT OR REPLACE INTO repair_plans VALUES (?,?,?)",(plan.analysis_id,plan.plan_id,plan.model_dump_json()))

    def load(run_id,plan_id):
        run=read_run(run_id)
        with database() as db:
            row=db.execute("SELECT payload FROM repair_plans WHERE run_id=? AND plan_id=?",(run_id,plan_id)).fetchone()
        if not row:
            raise HTTPException(404,"repair_plan_not_found")
        return run,RepairPlan.model_validate_json(row[0])

    def check_and_save(run,plan):
        report=validate(run,plan)
        if report.status=="verified" and plan.status=="approved":
            return plan  # Keep approved receipts and downloads immutable on rechecks.
        plan.validation=report
        if report.status=="verified":
            if plan.status!="approved":
                plan.status="validated"
        else:
            plan.status=report.status
            plan.approved_at=None
        save_plan(plan)
        return plan

    @router.post("/repair-plans",response_model=RepairPlan,status_code=201)
    def create(run_id: str,request: RepairRequest):
        with lock:
            run=read_run(run_id)
            if run.status!="complete":
                raise HTTPException(409,"run_not_complete")
            with database() as db:
                count=db.execute("SELECT count(*) FROM repair_plans WHERE run_id=?",(run_id,)).fetchone()[0]
            if count>=20:
                raise HTTPException(429,"repair_plan_limit: maximum 20 plans per run")
            try:
                plan=propose(run,request)
            except ValueError as exc:
                raise HTTPException(422,str(exc))
            except Exception:
                raise HTTPException(503,"graph_unavailable")
            save_plan(plan)
            return plan

    @router.get("/repair-plans",response_model=list[RepairPlan])
    def list_plans(run_id: str):
        read_run(run_id)
        with database() as db:
            rows=db.execute("SELECT payload FROM repair_plans WHERE run_id=? ORDER BY rowid DESC",(run_id,)).fetchall()
        return [RepairPlan.model_validate_json(r[0]) for r in rows]

    @router.get("/repair-plans/{plan_id}",response_model=RepairPlan)
    def get_plan(run_id: str,plan_id: str):
        return load(run_id,plan_id)[1]

    @router.post("/repair-plans/{plan_id}/validate",response_model=RepairPlan)
    def validate_plan(run_id: str,plan_id: str):
        with lock:
            run,plan=load(run_id,plan_id)
            return check_and_save(run,plan)

    @router.post("/repair-plans/{plan_id}/approve",response_model=RepairPlan)
    def approve_plan(run_id: str,plan_id: str,request: ApprovalRequest):
        with lock:
            run,plan=load(run_id,plan_id)
            if request.manifest_sha256!=plan.manifest_sha256:
                raise HTTPException(409,"stale_manifest_checksum")
            if plan.status not in ("validated","approved"):
                raise HTTPException(409,"successful_independent_validation_required")
            plan=check_and_save(run,plan)
            if plan.validation.status!="verified":
                raise HTTPException(409,{"code":"repair_verification_failed","report":plan.validation.model_dump()})
            plan.status="approved"
            plan.approved_at=plan.approved_at or datetime.now(timezone.utc).isoformat()
            save_plan(plan)
            return plan

    def artifacts(run_id,plan_id):
        run,plan=load(run_id,plan_id)
        if plan.status!="approved" or not plan.approved_at or not plan.validation or plan.validation.status!="verified":
            raise HTTPException(409,"approved_and_verified_repair_required")
        # Fresh validation on every export gates access, while the persisted receipt
        # stays byte-stable across downloads of the approved manifest.
        report=validate(run,plan)
        if report.status!="verified":
            plan.validation=report
            plan.status=report.status
            plan.approved_at=None
            save_plan(plan)
            raise HTTPException(409,{"code":"repair_no_longer_verified","report":report.model_dump()})
        fresh=snapshot(run)
        if fresh.fingerprint!=plan.graph_fingerprint:
            raise HTTPException(409,"stale_graph")
        provenance={"analysis_id":run_id,"plan_id":plan_id,"dataset":run.result.source.model_dump(),"audit_request":run.request.model_dump(),
                    "repair_policy":plan.request.model_dump(),"manifest_sha256":plan.manifest_sha256,
                    "verification_status":plan.validation.status,
                    "coverage":run.result.coverage,"inspected_counts":{s:plan.before_counts.get(s,0) for s in run.result.source.splits},
                    "full_source_split_sizes":run.result.source.splits,"graph_name":run.result.graph_name,
                    "graph_fingerprint":plan.graph_fingerprint,"algorithm":"algo.wcc",
                    "normalization":"strict-v1","minhash_permutations":128,"minhash_seed":42,
                    "evidence":[e.model_dump() for e in fresh.evidence],
                    "source_unchanged":bool(plan.validation.checks.get("original_rows_unchanged") and plan.validation.checks.get("unchanged_graph")),
                    "source_access_mode":"read_only","scope":plan.validation.scope}
        manifest={"schema_version":plan.schema_version,"analysis_id":run_id,"plan_id":plan_id,
                  "dataset_id":run.result.source.dataset_id,"revision_sha":run.result.source.revision_sha,
                  "manifest_sha256":plan.manifest_sha256,"graph_fingerprint":plan.graph_fingerprint,
                  "policy":plan.request.model_dump(),"target_ratios":plan.target_ratios,
                  "near_duplicate_threshold":run.request.threshold,"audit_seed":run.request.seed,
                  "approved_at":plan.approved_at,"verification_status":plan.validation.status,
                  "evidence_references":plan.evidence_references,"warnings":plan.warnings,
                  "assignments":[a.model_dump() for a in plan.assignments]}
        output=io.StringIO(newline="")
        context={"dataset_id":run.result.source.dataset_id,"revision_sha":run.result.source.revision_sha,
                 "analysis_id":run_id,"plan_id":plan_id,"policy":plan.request.policy,"repair_seed":plan.request.seed,
                 "near_duplicate_threshold":run.request.threshold,"verification_status":plan.validation.status}
        fields=list(context)+list(Assignment.model_fields)
        writer=csv.DictWriter(output,fieldnames=fields,lineterminator="\n")
        writer.writeheader()
        def safe(value):
            if isinstance(value,str) and value.lstrip().startswith(("=","+","-","@")):
                return "'"+value
            return value
        for a in plan.assignments:
            writer.writerow({k:safe(v) for k,v in {**context,**a.model_dump()}.items()})
        files={"repair-manifest.json":canonical(manifest).encode(),"split-assignments.csv":output.getvalue().encode(),
               "validation-report.json":canonical(plan.validation.model_dump()).encode(),"audit-provenance.json":canonical(provenance).encode()}
        if sum(map(len,files.values()))>int(os.getenv("MAX_REPAIR_ARTIFACT_BYTES","16777216")):
            raise HTTPException(413,"artifact_budget_exceeded")
        return files

    @router.get("/repair-plans/{plan_id}/artifacts",response_model=list[ArtifactInfo])
    def list_artifacts(run_id: str,plan_id: str):
        with lock:
            files=artifacts(run_id,plan_id)
            return [ArtifactInfo(filename=name,sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),
                    url=f"/api/v1/runs/{run_id}/repair-plans/{plan_id}/artifacts/{name}") for name,body in files.items()]

    @router.get("/repair-plans/{plan_id}/artifacts/{filename}")
    def download(run_id: str,plan_id: str,filename: ArtifactName):
        with lock:
            body=artifacts(run_id,plan_id)[filename]
        return Response(body,media_type="text/csv" if filename.endswith(".csv") else "application/json",
                        headers={"Content-Disposition":f'attachment; filename="{filename}"',"X-Content-Type-Options":"nosniff"})

    @router.get("/components/{component_id}",response_model=ComponentDetail)
    def component(run_id: str,component_id: str,source_id: str|None=None,target_id: str|None=None,limit: int=Query(50,ge=2,le=150)):
        run=read_run(run_id)
        try:
            fresh=snapshot(run)
        except ValueError as exc:
            raise HTTPException(409,str(exc))
        except Exception:
            raise HTTPException(503,"graph_unavailable")
        ids=fresh.groups.get(component_id)
        if ids is None:
            raise HTTPException(404,"component_not_found_or_stale")
        source_id=source_id or ids[0]
        if target_id is None and source_id in fresh.samples:
            target_id=next((i for i in ids if fresh.samples[i].split!=fresh.samples[source_id].split),ids[-1])
        if source_id not in ids or target_id not in ids:
            raise HTTPException(422,"path_endpoint_outside_component")
        g=Graph(run.result.graph_name)
        path=[] if source_id==target_id else g.query("MATCH p=(a:Sample {sample_id:$source})-[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target}) "
                      "RETURN [n IN nodes(p) | n.sample_id], [r IN relationships(p) | r.pair_id] LIMIT 1",{"source":source_id,"target":target_id})
        shown=list(dict.fromkeys([source_id,target_id]+ids))[:limit]
        shown_set=set(shown)
        evidence=[e.model_dump() for e in fresh.evidence if e.a in shown_set and e.b in shown_set][:500]
        samples=[]
        for id in shown:
            s=fresh.samples[id].model_dump()
            s["text_truncated"]=len(s["text"])>2000
            s["text"]=s["text"][:2000]
            samples.append(s)
        return ComponentDetail(component_key=component_id,samples=samples,evidence=evidence,
                  path_sample_ids=path[0][0] if path else [source_id] if source_id==target_id else [],
                  path_pair_ids=path[0][1] if path else [],path_note="Actual FalkorDB accepted-edge path (at most 8 hops)" if path else "Path not displayed within 8-hop limit; WCC still establishes connectivity",
                  total_samples=len(ids),truncated=len(shown)<len(ids))

    app.include_router(router)
