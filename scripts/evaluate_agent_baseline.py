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


def main():
    key, model = os.getenv("OPENROUTER_API_KEY"), os.getenv("OPENROUTER_MODEL")
    if not key or not model:
        raise SystemExit("Set OPENROUTER_API_KEY and OPENROUTER_MODEL before evaluation.")
    goal = "Report confirmed duplicate groups crossing dataset splits, distinguish train/test from train/validation, state scope limits, and recommend a safe action."
    with httpx.Client(base_url=BASE, timeout=60) as api:
        run = api.get(f"/api/v1/runs/{RUN_ID}").json()
        if run.get("status") != "complete":
            raise SystemExit("LIVE_RUN_ID must reference a completed audit.")
        baseline_started = time.monotonic()
        response = httpx.post("https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [
                {"role": "system", "content": "You have no graph or database tools. Do not invent counts or findings; say when evidence is unavailable."},
                {"role": "user", "content": goal}], "temperature": 0, "max_tokens": 800}, timeout=60)
        response.raise_for_status()
        baseline = response.json()
        usage = baseline.get("usage") or {}
        baseline_seconds = time.monotonic() - baseline_started
        baseline_text = ((baseline.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        admits_no_access = bool(re.search(r"\b(cannot|can't|no)\b.{0,30}\b(access|evidence|data|tools?)\b", baseline_text, re.I))
        makes_claim = bool(re.search(r"\b(found|confirmed|clean|overlap|duplicate component)\b", baseline_text, re.I))
        expected = run.get("result") or {}
        expected_components = {c["component_key"] for c in expected.get("cross_split_components", [])}
        expected_evidence = {edge["pair_id"] for edge in expected.get("evidence", [])
            if edge.get("status") == "confirmed" and any(edge.get("a") in set(c.get("sample_ids", [])) and edge.get("b") in set(c.get("sample_ids", [])) for c in expected.get("cross_split_components", []))}
        started = api.post(f"/api/v1/runs/{RUN_ID}/investigations", json={"goal": goal})
        started.raise_for_status()
        inv_id = started.json()["investigation_id"]
        deadline = time.monotonic() + int(os.getenv("AGENT_TIMEOUT_SECONDS", "120")) + 90
        while time.monotonic() < deadline:
            inv = api.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}").json()
            if inv["status"] not in ("queued", "running"):
                break
            time.sleep(1)
        trace = api.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}/trace").json()
        calls = [t for t in trace["tool_calls"] if t["status"] == "succeeded"]
        decisions = trace.get("decision") or {}
        component_ids = set(decisions.get("component_ids", []))
        evidence_ids = set(decisions.get("evidence_ids", []))
        expected_empty = not expected_components
        outcome_consistent = ((decisions.get("outcome") == "no_findings_in_scope") if expected_empty
                              else decisions.get("outcome") in ("cross_split_findings", "review_needed", "incomplete"))
        output = {"run_id": RUN_ID, "model": model,
            "tool_free_baseline": {"tool_invocations": 0, "evidence_coverage": 0,
                "abstained_for_lack_of_access": admits_no_access,
                "unsupported_finding_claim": makes_claim and not admits_no_access,
                "verified_task_completion": False, "elapsed_seconds": round(baseline_seconds, 3),
                "tokens": usage.get("total_tokens"), "cost_usd": usage.get("cost")},
            "graph_enabled": {"tool_invocations": len(calls), "evidence_ids_cited": len(decisions.get("evidence_ids", [])),
                "component_ids_cited": len(decisions.get("component_ids", [])),
                "component_evidence_coverage": round(len(component_ids & expected_components) / max(1, len(expected_components)), 3),
                "pair_evidence_coverage": round(len(evidence_ids & expected_evidence) / max(1, len(expected_evidence)), 3),
                "ground_truth_outcome_consistent": outcome_consistent,
                "unsafe_or_unjustified_action": bool(trace.get("repair_plan_id") and not decisions.get("component_ids")),
                "verified_task_completion": trace["status"] == "complete" and bool(decisions),
                "tool_names": [t["tool_name"] for t in calls], "status": trace["status"],
                "tokens": trace["total_tokens"], "cost_usd": trace["total_cost_usd"]},
            "metric_note": "The baseline lacks tools and cannot verify graph facts. Counts above are direct API trace measurements; no model prose is saved."}
        target = ROOT / "docs" / "phase-3-baseline-evaluation.json"
        target.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
