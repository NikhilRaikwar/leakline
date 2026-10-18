"""Independent checks: fresh database WCC, never planner predictions or booleans."""
from .repair_models import ValidationReport, RepairPlan
from .snapshot import snapshot, manifest_digest, distributions, label_tokens
from datetime import datetime, timezone


def validate(run,plan):
    report=ValidationReport(status="failed",checked_at=datetime.now(timezone.utc).isoformat(),analysis_id=run.analysis_id,
                            plan_id=plan.plan_id,manifest_sha256=plan.manifest_sha256)
    if run.result:
        report.dataset_id=run.result.source.dataset_id
        report.revision_sha=run.result.source.revision_sha
        report.coverage=run.result.coverage
        report.full_source_split_sizes=run.result.source.splits
    report.policy=plan.request.policy
    report.seed=plan.request.seed
    report.near_duplicate_threshold=run.request.threshold
    try:
        RepairPlan.model_validate(plan.model_dump())
        report.checks["schema_valid"]=True
    except ValueError:
        report.checks["schema_valid"]=False
        report.reasons=["invalid_repair_schema"]
        return report
    try:
        fresh=snapshot(run)
    except ValueError as exc:
        report.reasons=[str(exc)]
        return report
    except Exception:
        report.status="incomplete"
        report.reasons=["graph_unavailable: independent verification could not complete"]
        return report
    report.queries=fresh.queries
    report.graph_fingerprint=fresh.fingerprint
    checks=report.checks
    checks["correct_run"]=plan.analysis_id==run.analysis_id
    checks["unchanged_graph"]=fresh.fingerprint==plan.graph_fingerprint
    checks["manifest_checksum"]=manifest_digest(plan)==plan.manifest_sha256
    ids=[a.sample_id for a in plan.assignments]
    checks["unique_eligible_assignments"]=len(ids)==len(set(ids)) and set(ids)==set(fresh.samples)
    membership={id:key for key,group in fresh.groups.items() for id in group}
    checks["original_rows_unchanged"]=all(a.sample_id in fresh.samples and
        (a.original_split,a.row_index,a.label,a.component_key)==
        (fresh.samples[a.sample_id].split,fresh.samples[a.sample_id].row_index,fresh.samples[a.sample_id].label,membership[a.sample_id])
        for a in plan.assignments)
    counts,labels=distributions(plan.assignments)
    report.inspected_counts={s:sum(a.original_split==s for a in plan.assignments) for s in report.full_source_split_sizes}
    report.split_counts,report.label_counts=counts,labels
    before_counts,before_labels=distributions(plan.assignments,original=True)
    checks["reported_distributions"]=counts==plan.after_counts and labels==plan.after_labels and before_counts==plan.before_counts and before_labels==plan.before_labels
    checks["reported_movements"]=plan.excluded_rows==sum(a.assigned_split is None for a in plan.assignments) and plan.moved_rows==sum(a.assigned_split is not None and a.assigned_split!=a.original_split for a in plan.assignments)
    assigned={a.sample_id:a.assigned_split for a in plan.assignments}
    after_crossing=0
    report.remaining_cross_split_components=sum(len({assigned.get(i) for i in group}-{None})>1 for group in fresh.groups.values())
    if plan.request.policy=="preserve_test":
        protected=set(plan.request.protected_splits)
        report.protected_splits=sorted(protected)
        report.cross_boundary_components_before=sum(bool({fresh.samples[i].split for i in group}&protected and {fresh.samples[i].split for i in group}-protected) for group in fresh.groups.values())
        report.scope=f"Only the analyzed rows and accepted graph were checked: protected {sorted(protected)} versus all other retained partitions. Other split overlaps may remain; uninspected rows and undetected relationships are outside this check."
        checks["valid_protected_boundary"]=bool(protected) and protected<=set(run.request.evaluation_splits) and protected<=set(before_counts)
        checks["protected_assignments_preserved"]=all(assigned.get(id)==s.split for id,s in fresh.samples.items() if s.split in protected)
        checks["no_unrequested_reassignment"]=all(a.assigned_split is None or a.assigned_split==a.original_split for a in plan.assignments)
        checks["quarantine_only_supported_rows"]=all(a.assigned_split is not None or (a.original_split not in protected and any(fresh.samples[i].split in protected for i in fresh.groups.get(a.component_key,[]))) for a in plan.assignments)
        for group in fresh.groups.values():
            partitions={assigned.get(i) for i in group}-{None}
            after_crossing+=bool(partitions&protected and partitions-protected)
        for split in run.request.train_splits:
            checks[f"retained_training_rows:{split}"]=counts.get(split,0)>=plan.request.min_rows_per_split
            checks[f"retained_training_classes:{split}"]=set(before_labels.get(split,{}))<=set(labels.get(split,{}))
    else:
        report.all_split_boundaries_checked=True
        report.cross_boundary_components_before=len(fresh.crossing())
        for group in fresh.groups.values():
            after_crossing+=len({assigned.get(i) for i in group}-{None})>1
        checks["all_rows_retained"]=all(a.assigned_split in plan.target_ratios for a in plan.assignments)
        checks["valid_partition_set"]=set(plan.target_ratios)==set(before_counts)
        for split,target in plan.target_ratios.items():
            checks[f"partition_size:{split}"]=counts.get(split,0)>=plan.request.min_rows_per_split and abs(counts.get(split,0)/max(len(fresh.samples),1)-target)<=plan.request.size_tolerance+1e-9
        all_labels={label for s in fresh.samples.values() for label in label_tokens(s.label)}
        required=list(plan.target_ratios) if plan.request.require_all_labels_in_each_split else run.request.train_splits
        for split in required:
            checks[f"class_coverage:{split}"]=all_labels<=set(labels.get(split,{}))
        checks["no_conflicting_component_labels"]=all(len({fresh.samples[i].label for i in group}-{None,"-1"})<=1 for group in fresh.groups.values())
    checks["evidence_references"]=plan.evidence_references=={k:sorted(e.pair_id for e in fresh.evidence if e.status=="confirmed" and e.a in set(group)) for k,group in fresh.groups.items() if len(group)>1}
    report.cross_boundary_components_after=after_crossing
    checks["no_protected_component_crossing"]=after_crossing==0
    # Re-read after checks too; reject mixed snapshots if the graph changes mid-check.
    try:
        checks["stable_verification_snapshot"]=snapshot(run).fingerprint==fresh.fingerprint
    except Exception:
        report.status="incomplete"
        report.reasons=["graph_changed_or_unavailable_during_verification"]
        return report
    report.reasons=[k for k,v in checks.items() if not v]
    if report.reasons:
        report.status="failed"
    elif plan.status=="not_applicable":
        report.status="not_applicable"
        report.reasons=["No supported repair for the chosen boundary"]
    elif plan.status=="failed":
        report.status="failed"
        report.reasons=plan.warnings
    else:
        report.status="verified"
    return report
