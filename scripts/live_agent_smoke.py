"""Run a real OpenRouter tool-calling investigation against a persisted Leakline run.

Requires API_BASE_URL, OPENROUTER_API_KEY and OPENROUTER_MODEL. No model calls are
made by tests; this script intentionally uses the configured live provider.
"""
import json
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
RUN_ID = os.getenv("LIVE_RUN_ID", "300f5981-b6f2-4c01-b3e8-8b772063b455")
BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def main():
    if not os.getenv("OPENROUTER_API_KEY") or not os.getenv("OPENROUTER_MODEL"):
        raise SystemExit("Set OPENROUTER_API_KEY and OPENROUTER_MODEL to run a live smoke test.")
    with httpx.Client(base_url=BASE, timeout=30) as client:
        run_response = client.get(f"/api/v1/runs/{RUN_ID}")
        run_response.raise_for_status()
        run = run_response.json()
        if run["status"] != "complete":
            raise SystemExit("The selected audit run must already be complete.")
        start = client.post(f"/api/v1/runs/{RUN_ID}/investigations", json={
            "goal": "Investigate cross-split duplicate components, distinguish test from validation overlaps, inspect evidence and coverage, and choose a supported repair next step. Never approve a repair."
        })
        start.raise_for_status()
        inv_id = start.json()["investigation_id"]
        deadline = time.monotonic() + int(os.getenv("AGENT_TIMEOUT_SECONDS", "120")) + 90
        while time.monotonic() < deadline:
            response = client.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}")
            response.raise_for_status()
            inv = response.json()
            if inv["status"] not in ("queued", "running"):
                break
            time.sleep(1)
        else:
            raise SystemExit("Timed out polling the live investigation; inspect its API record.")
        if inv["status"] != "complete" or not inv.get("decision"):
            raise SystemExit(f"Live run did not complete: status={inv['status']} error={inv.get('error_code')}")
        trace = client.get(f"/api/v1/runs/{RUN_ID}/investigations/{inv_id}/trace")
        trace.raise_for_status()
        trace = trace.json()
        names = [t["tool_name"] for t in trace["tool_calls"] if t["status"] == "succeeded"]
        required = {"get_schema", "inspect_audit_scope", "list_cross_split_components"}
        if not required.issubset(names):
            raise SystemExit(f"Live run did not execute required graph calls: {names}")
        # Store metadata and evidence identifiers only; no raw dataset text or secrets.
        receipt = {
            "run_id": RUN_ID, "investigation_id": inv_id, "provider": trace["provider"],
            "model": trace["model"], "status": trace["status"], "mcp_server": inv.get("mcp_server"),
            "mcp_protocol_version": inv.get("mcp_protocol_version"),
            "tools_discovered": inv.get("mcp_tools_discovered", []),
            "tool_invocations": [{"name": t["tool_name"], "status": t["status"],
                                  "query_template_id": t["query_template_id"], "elapsed_ms": t["elapsed_ms"],
                                  "result_summary": t["result_summary"]} for t in trace["tool_calls"]],
            "decision": inv["decision"], "repair_plan_id": trace["repair_plan_id"],
            "repair_plan_status": trace["repair_plan_status"], "approval_state": trace["approval_state"],
            "model_calls": trace["model_calls"], "tokens": trace["total_tokens"], "cost_usd": trace["total_cost_usd"],
        }
        target = ROOT / "docs" / "phase-3-live-smoke.json"
        target.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": receipt["status"], "model": receipt["model"],
                          "tool_names": names, "output": str(target)}, indent=2))


if __name__ == "__main__":
    main()
