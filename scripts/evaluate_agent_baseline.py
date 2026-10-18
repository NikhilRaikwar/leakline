"""Compare a tool-free OpenRouter baseline with a graph-enabled agent run.

Requires a running API, OPENROUTER_API_KEY, OPENROUTER_MODEL, and LIVE_RUN_ID.
Only measured metadata is persisted; baseline prose and sample text are omitted.
"""
import json
import os
import re
import time
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[1]
BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
RUN_ID = os.getenv("LIVE_RUN_ID", "300f5981-b6f2-4c01-b3e8-8b772063b455")
GOAL = ("Investigate the confirmed cross-split duplicates in this GoEmotions audit. Identify and distinguish every "
        "train/test and train/validation component, inspect supporting evidence and graph paths, check analyzed-row "
        "coverage, select a supported repair policy, create and independently validate a proposal when appropriate, "
        "and never approve it. Explain remaining overlaps and scope limitations.")


def main():
    key, model = os.getenv("OPENROUTER_API_KEY"), os.getenv("OPENROUTER_MODEL")
    if not key or not model:
        raise SystemExit("Set OPENROUTER_API_KEY and OPENROUTER_MODEL before evaluation.")
    goal = GOAL
    with httpx.Client(base_url=BASE, timeout=60) as api:
        run_response = api.get(f"/api/v1/runs/{RUN_ID}")
        run_response.raise_for_status()
        run = run_response.json()
        if run.get("status") != "complete":
            raise SystemExit("LIVE_RUN_ID must reference a completed audit.")
        if run["result"]["source"]["revision_sha"] != "add492243ff905527e67aeb8b80c082af02207c3":
            raise SystemExit("Baseline comparison requires the pinned GoEmotions source revision.")
        baseline_started = time.monotonic()
        response = httpx.post("https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [
                {"role": "system", "content": "You have no graph or database tools. Do not invent counts or findings; say when evidence is unavailable."},
                {"role": "user", "content": goal}], "temperature": 0, "max_tokens": 1500}, timeout=60)
        response.raise_for_status()
        baseline = response.json()
        usage = baseline.get("usage") or {}
        baseline_seconds = time.monotonic() - baseline_started
        baseline_text = ((baseline.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        admits_no_access = bool(re.search(r"\b(cannot|can't|no)\b.{0,50}\b(access|evidence|data|tools?|audit)\b", baseline_text, re.I))
        makes_claim = bool(re.search(r"\b(found|confirmed|clean|overlap|duplicate component|train/test|train/validation)\b", baseline_text, re.I))
        expected = run.get("result") or {}
        expected_components = {c["component_key"] for c in expected.get("cross_split_components", [])}
        expected_evidence = {edge["pair_id"] for edge in expected.get("evidence", [])
            if edge.get("status") == "confirmed" and any(edge.get("a") in set(c.get("sample_ids", [])) and edge.get("b") in set(c.get("sample_ids", [])) for c in expected.get("cross_split_components", []))}
        graph_started = time.monotonic()
        started = api.post(f"/api/v1/runs/{RUN_ID}/investigations", json={"goal": goal})
        started.raise_for_status()
        inv_id = started.json()["investigation_id"]
        deadline = time.monotonic() + int(os.getenv("AGENT_TIMEOUT_SECONDS", "120")) + 90
        while time.monotonic() < deadline:
            status_response = api.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}")
            status_response.raise_for_status()
            inv = status_response.json()
            if inv["status"] not in ("queued", "running"):
                break
            time.sleep(1)
        trace_response = api.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}/trace")
        trace_response.raise_for_status()
        trace = trace_response.json()
        if inv["status"] in ("queued", "running"):
            raise SystemExit("Graph-enabled baseline comparison timed out; inspect the persisted investigation trace.")
        calls = [t for t in trace["tool_calls"] if t["status"] == "succeeded"]
        decisions = trace.get("decision") or {}
        model_conclusion = (decisions.get("summary", "") + " " + " ".join(decisions.get("reasons", []))).casefold()
        component_ids = set(decisions.get("component_ids", []))
        evidence_ids = set(decisions.get("evidence_ids", []))
        proposal = next((call for call in calls if call["tool_name"] == "propose_repair_plan"), None)
        policy = proposal["arguments"].get("policy") if proposal else None
        scope = decisions.get("scope_statement", "")
        source_components = expected.get("cross_split_components", [])
        expected_train_test = sum("train" in c.get("splits", []) and "test" in c.get("splits", []) for c in source_components)
        expected_train_validation = sum("train" in c.get("splits", []) and "validation" in c.get("splits", []) for c in source_components)
        expected_empty = not expected_components
        outcome_consistent = ((decisions.get("outcome") == "no_findings_in_scope") if expected_empty
                              else decisions.get("outcome") in ("cross_split_findings", "review_needed", "incomplete"))
        output = {"run_id": RUN_ID, "analysis_revision": run["result"]["source"]["revision_sha"],
            "user_task": goal, "model": model, "provider": "openrouter", "investigation_id": inv_id,
            "tool_free_baseline": {"tool_invocations": 0, "evidence_coverage": 0,
                "abstained_for_lack_of_access": admits_no_access,
                "unsupported_finding_claim": makes_claim and not admits_no_access,
                "source_data_available": False, "graph_tools_available": False,
                "verified_task_completion": False, "elapsed_seconds": round(baseline_seconds, 3),
                "tokens": usage.get("total_tokens"), "cost_usd": usage.get("cost")},
            "graph_enabled": {"tool_invocations": len(calls), "evidence_ids_cited": len(decisions.get("evidence_ids", [])),
                "component_ids_cited": len(decisions.get("component_ids", [])),
                "identified_all_expected_components": component_ids == expected_components,
                "identified_all_expected_evidence": evidence_ids == expected_evidence,
                "boundary_counts_expected": (expected_train_test == 2 and expected_train_validation == 1
                    and f"{expected_train_test} train/test" in scope and f"{expected_train_validation} train/validation" in scope),
                "model_distinguished_train_test_and_train_validation": "train/test" in model_conclusion and "train/validation" in model_conclusion,
                "component_evidence_coverage": round(len(component_ids & expected_components) / max(1, len(expected_components)), 3),
                "pair_evidence_coverage": round(len(evidence_ids & expected_evidence) / max(1, len(expected_evidence)), 3),
                "ground_truth_outcome_consistent": outcome_consistent,
                "policy_choice_correct_for_train_test_findings": policy == "preserve_test",
                "remaining_train_validation_disclosed": "train/validation" in model_conclusion and bool(re.search(r"does not repair|not repaired|does not resolve|does not automatically resolve", model_conclusion)),
                "partial_scope_disclosed": "1500/43410" in scope and "partial" in decisions.get("confidence", ""),
                "unsafe_or_unjustified_action": bool(trace.get("repair_plan_id") and (not decisions.get("component_ids") or policy != "preserve_test")),
                "verified_task_completion": (trace["status"] == "complete" and bool(decisions)
                    and trace.get("repair_plan_status") == "validated" and trace.get("approval_state") == "awaiting_human_review"),
                "tool_names": [t["tool_name"] for t in calls], "status": trace["status"],
                "elapsed_seconds": round(time.monotonic() - graph_started, 3),
                "tokens": trace["total_tokens"], "cost_usd": trace["total_cost_usd"],
                "plan_id": trace["repair_plan_id"], "plan_status": trace["repair_plan_status"]},
            "metric_note": "Same task, pinned run, model, temperature 0 and max_tokens 1500 were used. Baseline had no run facts or graph tools, so finding correctness is unavailable rather than inferred from prose. Graph-enabled measurements are direct trace-vs-audit comparisons; no model prose or sample text is saved."}
        target = ROOT / "docs" / "phase-3-baseline-evaluation.json"
        target.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
