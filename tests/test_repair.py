"""Synthetic approved-edge fixtures exist ONLY here, against actual FalkorDB.
These outcomes are never supplied as public-source demo results.
"""
import csv
import io
import json
import hashlib
import uuid
import pytest
from fastapi.testclient import TestClient
from leakline import main
from leakline.graph import Graph, WCC
from leakline.ingest import digest
from leakline.models import AuditRequest, Run, Result, Source, Evidence
from leakline.repair_models import RepairRequest
from leakline.snapshot import snapshot, manifest_digest
from leakline.planner import propose
from leakline.validator import validate
from test_matching import sample


@pytest.fixture
def audited(tmp_path,monkeypatch):
    monkeypatch.setattr(main,"DB",tmp_path/"runs.sqlite3")
    graphs=[]
    def build(edges=True,all_connected=False):
        id=str(uuid.uuid4())
        definitions=[("a","train","0"),("b","validation","0"),("c","test","0"),
                     ("d","train","0"),("e","train","1"),("v","validation","1"),("t","test","1")]
        samples=[]
        for index,(name,split,label) in enumerate(definitions):
            s=sample(digest(name),"Automated repair test fixture "+name,split,label)
            s.row_index=index
            samples.append(s)
        evidence=[]
        pairs=[("a","b"),("b","c")] if edges else []
        if all_connected:
            pairs=[(definitions[i][0],definitions[i+1][0]) for i in range(len(definitions)-1)]
        for a,b in pairs:
            a,b=sorted([digest(a),digest(b)])
            evidence.append(Evidence(pair_id=digest(a+b),a=a,b=b,method="minhash_jaccard",score=.95,threshold=.9,
                                     status="confirmed",reason="Explicit synthetic graph fixture — tests only"))
        src=Source(dataset_id="tests/repair_fixture",revision_sha="f"*40,config="default",configs=["default"],
                   columns={"text":"string","label":"string"},splits={"train":3,"validation":2,"test":2},license="test-only synthetic")
        g=Graph("leakline_test_"+uuid.uuid4().hex)
        graphs.append(g)
        g.store(src,samples,evidence)
        components,findings=g.components(["train"],["validation","test"])
        run=Run(analysis_id=id,status="complete",request=AuditRequest(dataset=src.dataset_id,revision=src.revision_sha,
                evaluation_splits=["validation","test"]),result=Result(source=src,coverage={s:1.0 for s in src.splits},
                inspected_counts=src.splits,analyzed_samples=len(samples),accepted_edges=len(evidence),review_edges=0,
                components=components,findings=findings,cross_split_components=[c for c in components if len(c.splits)>1],
                evidence=evidence,graph_name=g.graph.name,queries=g.queries))
        main.save(run)
        return run,g
    yield build
    for g in graphs:
        g.graph.delete()


def test_preserve_test_transitive_exclusion_and_immutable_source(audited):
    run,g=audited()
    before=snapshot(run)
    plan=propose(run,RepairRequest())
    assert plan.status=="draft"
    excluded={a.sample_id for a in plan.assignments if a.assigned_split is None}
    assert excluded=={digest("a"),digest("b")}
    assert all(a.assigned_split=="test" for a in plan.assignments if a.original_split=="test")
    assert all(a.assigned_split==a.original_split for a in plan.assignments if a.sample_id in {digest("d"),digest("e"),digest("v"),digest("t")})
    report=validate(run,plan)
    assert report.status=="verified",report
    assert report.cross_boundary_components_after==0
    assert WCC in report.queries
    assert report.split_counts=={"train":2,"validation":1,"test":2}
    assert snapshot(run).fingerprint==before.fingerprint


def test_alternative_split_deterministic_groups_together(audited):
    run,g=audited()
    req=RepairRequest(policy="alternative_split",seed=91)
    plan=propose(run,req)
    again=propose(run,req)
    assert plan.status=="draft",plan.warnings
    assert plan.assignments==again.assignments
    group={a.assigned_split for a in plan.assignments if a.sample_id in {digest("a"),digest("b"),digest("c")}}
    assert len(group)==1
    assert all(a.assigned_split for a in plan.assignments)
    report=validate(run,plan)
    assert report.status=="verified",report
    assert "NOT an official benchmark" in " ".join(plan.warnings)


def test_no_finding_not_applicable_and_no_export(audited):
    run,g=audited(edges=False)
    client=TestClient(main.app)
    base=f"/api/v1/runs/{run.analysis_id}/repair-plans"
    plan=client.post(base,json={}).json()
    assert plan["status"]=="not_applicable"
    assert not plan["excluded_rows"] and not plan["moved_rows"]
    assert client.post(f"{base}/{plan['plan_id']}/validate").json()["validation"]["status"]=="not_applicable"
    assert client.get(f"{base}/{plan['plan_id']}/artifacts").status_code==409


def test_independent_validator_rejects_tampered_assignments(audited):
    run,g=audited()
    plan=propose(run,RepairRequest())
    for a in plan.assignments:
        a.assigned_split=a.original_split
    # Even recomputing a malicious checksum cannot replace independent WCC checks.
    plan.manifest_sha256=manifest_digest(plan)
    report=validate(run,plan)
    assert report.status=="failed"
    assert not report.checks["no_protected_component_crossing"]
    assert report.cross_boundary_components_after==1


def test_unique_and_eligible_rows_are_independently_checked(audited):
    run,g=audited()
    plan=propose(run,RepairRequest())
    plan.assignments.append(plan.assignments[0].model_copy())
    plan.manifest_sha256=manifest_digest(plan)
    report=validate(run,plan)
    assert report.status=="failed" and not report.checks["unique_eligible_assignments"]
    plan.assignments[-1].sample_id="invented-sample"
    plan.manifest_sha256=manifest_digest(plan)
    assert validate(run,plan).status=="failed"


def test_stale_graph_and_outage_reject_validation(audited,monkeypatch):
    run,g=audited()
    plan=propose(run,RepairRequest())
    g.query("MATCH (s:Sample {sample_id:$id}) SET s.label='changed'",{"id":digest("d")})
    report=validate(run,plan)
    assert report.status=="failed" and not report.checks["unchanged_graph"]
    monkeypatch.setenv("FALKORDB_PORT","1")
    assert validate(run,plan).status=="incomplete"


def test_impossible_alternative_and_missing_training_class_rejected(audited):
    run,g=audited(all_connected=True)
    plan=propose(run,RepairRequest(policy="alternative_split"))
    assert plan.status=="failed"
    assert validate(run,plan).status=="failed"
    plan=propose(run,RepairRequest())
    report=validate(run,plan)
    assert report.status=="failed" and not report.checks["retained_training_rows:train"]


def test_strict_size_constraints_rejected(audited):
    run,g=audited()
    plan=propose(run,RepairRequest(policy="alternative_split",target_ratios={"train":.5,"test":.25,"validation":.25},size_tolerance=0))
    assert plan.status=="failed"
    assert validate(run,plan).status=="failed"


def test_approval_artifact_provenance_path_and_stale_identifiers(audited):
    run,g=audited()
    client=TestClient(main.app)
    base=f"/api/v1/runs/{run.analysis_id}/repair-plans"
    p=client.post(base,json={})
    assert p.status_code==201,p.text
    plan=p.json(); url=f"{base}/{plan['plan_id']}"
    assert client.get(url+"/artifacts").status_code==409
    approval={"approve":True,"manifest_sha256":plan["manifest_sha256"]}
    assert client.post(url+"/approve",json=approval).status_code==409
    assert client.post(url+"/validate").json()["status"]=="validated"
    assert client.post(url+"/approve",json={**approval,"manifest_sha256":"0"*64}).status_code==409
    assert client.post(url+"/approve",json={**approval,"approve":False}).status_code==422
    approved=client.post(url+"/approve",json=approval)
    assert approved.status_code==200,approved.text
    assert approved.json()["status"]=="approved"
    assert client.post(url+"/approve",json=approval).json()==approved.json()
    files=client.get(url+"/artifacts")
    assert files.status_code==200,files.text
    assert len(files.json())==4
    data={}
    for file in files.json():
        response=client.get(file["url"])
        assert response.status_code==200,response.text
        assert hashlib.sha256(response.content).hexdigest()==file["sha256"]
        data[file["filename"]]=response.content
    manifest=json.loads(data["repair-manifest.json"])
    assert manifest["revision_sha"]=="f"*40 and manifest["approved_at"]
    assert {a["sample_id"] for a in manifest["assignments"]}==set(snapshot(run).samples)
    assert "text" not in manifest["assignments"][0]
    csv_rows=list(csv.DictReader(io.StringIO(data["split-assignments.csv"].decode())))
    assert len(csv_rows)==7
    assert csv_rows[0]["revision_sha"]=="f"*40 and csv_rows[0]["analysis_id"]==run.analysis_id
    assert json.loads(data["validation-report.json"])["status"]=="verified"
    assert json.loads(data["validation-report.json"])["dataset_id"]=="tests/repair_fixture"
    provenance=json.loads(data["audit-provenance.json"])
    assert provenance["dataset"]["dataset_id"]=="tests/repair_fixture"
    assert provenance["audit_request"]["threshold"]==.9 and provenance["evidence"]
    component=run.result.findings[0]
    detail=client.get(f"/api/v1/runs/{run.analysis_id}/components/{component.component_key}",params={"source_id":digest("a"),"target_id":digest("c")})
    assert detail.status_code==200,detail.text
    assert detail.json()["path_sample_ids"]==[digest("a"),digest("b"),digest("c")]
    assert len(detail.json()["path_pair_ids"])==2
    assert client.get(base+"/incorrect").status_code==404
    assert client.get(f"/api/v1/runs/incorrect/repair-plans/{plan['plan_id']}").status_code==404
    assert client.get(url+"/artifacts/not-allowed.json").status_code==422
    # Approval cannot outlive graph changes, including at export time.
    g.query("MATCH (s:Sample {sample_id:$id}) SET s.label='changed'",{"id":digest("d")})
    assert client.get(url+"/artifacts").status_code==409
    assert client.get(url).json()["status"]=="failed"


def test_restart_recovery_persisted_plan_and_interrupted_run(audited):
    run,g=audited()
    base=f"/api/v1/runs/{run.analysis_id}/repair-plans"
    with TestClient(main.app) as client:
        plan=client.post(base,json={}).json()
        pending=run.model_copy(deep=True)
        pending.analysis_id=str(uuid.uuid4()); pending.status="queued"; pending.result=None
        main.save(pending)
    with TestClient(main.app) as restarted:
        assert restarted.get(f"{base}/{plan['plan_id']}").json()==plan
        assert restarted.get(f"/api/v1/runs/{pending.analysis_id}").json()["status"]=="interrupted"
        assert not main.executor._shutdown


def test_policy_a_reports_residual_unprotected_boundary(audited):
    run,g=audited()
    # Change only test-fixture graph: keep a↔b across train/validation,
    # remove test link, and reconcile its evidence. Recompute the audit snapshot.
    g.query("MATCH (a:Sample)-[r:CONFIRMED_DUPLICATE_OF]->(b:Sample) WHERE a.sample_id=$id OR b.sample_id=$id DELETE r",{"id":digest("c")})
    g.query("MATCH (a:Sample)-[:HAS_PAIR_EVIDENCE]->(e:PairEvidence)-[:CONCERNS]->(b:Sample) WHERE a.sample_id=$id OR b.sample_id=$id DETACH DELETE e",{"id":digest("c")})
    components,findings=g.components(["train"],["validation","test"])
    run.result.components=components;run.result.findings=findings
    plan=propose(run,RepairRequest())
    assert plan.status=="not_applicable"
    report=validate(run,plan)
    assert report.status=="not_applicable"
    assert report.cross_boundary_components_before==0
    assert report.remaining_cross_split_components==1
    assert not report.all_split_boundaries_checked


def test_multilabel_counts_are_marginal_classes(audited):
    run,g=audited()
    g.query("MATCH (s:Sample) SET s.label='[0, 1]'")
    plan=propose(run,RepairRequest())
    assert plan.before_labels["train"]=={"0":3,"1":3}
    assert plan.after_labels["train"]=={"0":2,"1":2}
    assert validate(run,plan).status=="verified"
