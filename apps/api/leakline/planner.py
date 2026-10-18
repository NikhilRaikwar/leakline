"""Deterministic policy decisions over server-computed connected components."""
from collections import Counter
from datetime import datetime, timezone
import random
import uuid
from .repair_models import RepairRequest, RepairPlan, Assignment
from .snapshot import snapshot, distributions, manifest_digest, label_tokens


def now():
    return datetime.now(timezone.utc).isoformat()


def propose(run, request: RepairRequest):
    snap = snapshot(run)
    plan = RepairPlan(analysis_id=run.analysis_id,plan_id=str(uuid.uuid4()),request=request,status="draft",
                      created_at=now(),graph_fingerprint=snap.fingerprint,
                      cross_split_components_before=len(snap.crossing()))
    component_of = {id:key for key,ids in snap.groups.items() for id in ids}
    plan.assignments = [Assignment(sample_id=s.sample_id,row_index=s.row_index,original_split=s.split,
                        assigned_split=s.split,component_key=component_of[s.sample_id],label=s.label,reason="unchanged")
                        for s in snap.samples.values()]
    plan.evidence_references = {key:sorted(e.pair_id for e in snap.evidence if e.status=="confirmed" and e.a in set(ids))
                                for key,ids in snap.groups.items() if len(ids)>1}
    plan.before_counts,plan.before_labels=distributions(plan.assignments,original=True)
    if any(v<1 for v in run.result.coverage.values()):
        plan.warnings.append("Partial analysis: this manifest covers only inspected rows, never the full original dataset.")
    if not any(a.label not in (None,"-1") for a in plan.assignments):
        plan.warnings.append("Labels unavailable: class representation cannot be checked.")
    if not snap.crossing():
        plan.status="not_applicable"
        plan.warnings.append("No confirmed cross-split duplicate groups were found within the analyzed scope.")
    elif request.policy=="preserve_test":
        protected=set(request.protected_splits)
        if not protected <= set(plan.before_counts) or not protected <= set(run.request.evaluation_splits):
            raise ValueError("protected_splits must be inspected evaluation splits")
        affected={key for key,ids in snap.groups.items() if any(snap.samples[i].split in protected for i in ids)
                  and any(snap.samples[i].split not in protected for i in ids)}
        for a in plan.assignments:
            if a.component_key in affected and a.original_split not in protected:
                a.assigned_split=None
                a.reason="quarantine: confirmed component overlaps protected evaluation"
        if not affected:
            plan.status="not_applicable"
            plan.warnings.append("No confirmed component crosses the chosen protected boundary; no repair proposed.")
        plan.warnings.append("Policy A preserves protected assignments and quarantines ALL other rows in overlapping components, including validation rows. Other unprotected split overlaps may remain.")
    else:
        plan.target_ratios=request.target_ratios or {s:n/len(snap.samples) for s,n in plan.before_counts.items()}
        if set(plan.target_ratios)!=set(plan.before_counts):
            raise ValueError("target_ratios must name every inspected split exactly")
        mapping,error = grouped_assignment(snap,plan.target_ratios,request,run.request.train_splits)
        if error:
            plan.status="failed"
            plan.warnings.append(error)
        else:
            for a in plan.assignments:
                a.assigned_split=mapping[a.component_key]
                a.reason="component assigned together in alternative experiment"
        plan.warnings.append("Alternative experiment only: these assignments are NOT an official benchmark replacement. Size and label distribution deviations are reported, not hidden.")
    plan.after_counts,plan.after_labels=distributions(plan.assignments)
    plan.excluded_rows=sum(a.assigned_split is None for a in plan.assignments)
    plan.moved_rows=sum(a.assigned_split is not None and a.assigned_split!=a.original_split for a in plan.assignments)
    if request.policy=="preserve_test":
        assigned={a.sample_id:a.assigned_split for a in plan.assignments}
        remaining=sum(len({assigned[i] for i in ids}-{None})>1 for ids in snap.groups.values())
        if remaining:
            plan.warnings.append(f"{remaining} components still span other original partitions; this policy does not repair those unprotected boundaries.")
    plan.manifest_sha256=manifest_digest(plan)
    return plan


def grouped_assignment(snap,ratios,req,train_splits):
    """Bounded multi-start greedy balancing; failure never claims global infeasibility.

    Components, not rows, are the indivisible items. Exact feasibility checks catch
    too few groups and giant groups; 16 deterministic attempts balance remaining
    size/label error. No connectivity algorithm is implemented here.
    """
    splits=sorted(ratios)
    n=len(snap.samples)
    if len(snap.groups)<len(splits) or n<req.min_rows_per_split*len(splits):
        return {},"infeasible_constraints: too few indivisible components or rows for nonempty partitions"
    labels={k:Counter(label for i in ids for label in label_tokens(snap.samples[i].label)) for k,ids in snap.groups.items()}
    if any(len({snap.samples[i].label for i in ids}-{None,"-1"})>1 for ids in snap.groups.values()):
        return {},"conflicting_component_labels: expert review required before alternative splitting"
    totals=sum(labels.values(),Counter())
    if req.require_all_labels_in_each_split and any(sum(label in v for v in labels.values())<len(splits) for label in totals):
        return {},"infeasible_constraints: a class has fewer components than required partitions"
    if max(map(len,snap.groups.values()))/n>max(ratios.values())+req.size_tolerance+1e-9:
        return {},"infeasible_constraints: largest component exceeds every partition's size tolerance"
    best=None
    for attempt in range(16):
        rng=random.Random(req.seed+attempt)
        keys=sorted(snap.groups)
        rng.shuffle(keys)
        keys.sort(key=lambda k:-len(snap.groups[k]))
        counts=Counter()
        lc={s:Counter() for s in splits}
        mapping={}
        required=splits if req.require_all_labels_in_each_split else sorted(set(train_splits)&set(splits))
        for split in required:
            for label in sorted(totals):
                if lc[split][label]:
                    continue
                eligible=[k for k in keys if k not in mapping and label in labels[k]]
                if not eligible:
                    continue
                key=min(eligible,key=lambda k:len(snap.groups[k]))
                mapping[key]=split
                counts[split]+=len(snap.groups[key])
                lc[split].update(labels[key])
        for k in keys:
            if k in mapping:
                continue
            size=len(snap.groups[k])
            options=splits.copy()
            rng.shuffle(options)
            def cost(s):
                target=n*ratios[s]
                size_delta=((counts[s]+size-target)**2-(counts[s]-target)**2)/max(target,1)
                class_delta=sum(((lc[s][label]+count-totals[label]*ratios[s])**2-(lc[s][label]-totals[label]*ratios[s])**2)/max(totals[label]*ratios[s],1) for label,count in labels[k].items())
                return size_delta+class_delta
            choice=min(options,key=cost)
            mapping[k]=choice
            counts[choice]+=size
            lc[choice].update(labels[k])
        feasible=all(counts[s]>=req.min_rows_per_split and abs(counts[s]/n-ratios[s])<=req.size_tolerance+1e-9 for s in splits)
        feasible=feasible and all(set(totals)<=set(lc[s]) for s in required)
        score=sum((counts[s]/n-ratios[s])**2 for s in splits)+sum((lc[s][label]/max(counts[s],1)-total/n)**2 for s in splits for label,total in totals.items())
        if feasible and (best is None or score<best[0]):
            best=(score,mapping)
    if best is None:
        return {},"no_feasible_assignment_found: bounded deterministic balancing could not satisfy the requested size/class constraints; relax constraints or review components"
    return best[1],None
