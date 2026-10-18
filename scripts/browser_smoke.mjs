import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const runId = process.env.LIVE_RUN_ID || "300f5981-b6f2-4c01-b3e8-8b772063b455";
const investigationId = process.env.LIVE_INVESTIGATION_ID;
const baseUrl = process.env.WEB_BASE_URL || "http://127.0.0.1:3002";
const apiBaseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
if (!investigationId) throw new Error("Set LIVE_INVESTIGATION_ID to a persisted completed investigation.");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function cdp(socket) {
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result || {});
  });
  socket.addEventListener("close", () => {
    for (const [id, item] of pending) {
      clearTimeout(item.timer);
      item.reject(new Error(`CDP connection closed before response ${id}`));
    }
    pending.clear();
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout for ${method}`));
    }, 15_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const apiResponse = await fetch(`${apiBaseUrl}/api/v1/runs/${runId}/investigations/${investigationId}/trace`);
  if (!apiResponse.ok) throw new Error(`Persisted investigation trace returned HTTP ${apiResponse.status}.`);
  const persistedTrace = await apiResponse.json();
  if (persistedTrace.status !== "complete" || !persistedTrace.repair_plan_id
      || persistedTrace.repair_plan_status !== "validated" || persistedTrace.approval_state !== "awaiting_human_review") {
    throw new Error("The API did not return a complete, independently verified, unapproved investigation trace.");
  }
  const edge = process.env.EDGE_EXE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\155.0.4283.62\\msedge.exe";
  const profile = mkdtempSync(path.join(tmpdir(), `leakline-edge-${randomUUID()}-`));
  const port = await freePort();
  const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-crash-reporter", "--disable-breakpad", "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { windowsHide: true, stdio: "ignore" });
  let socket;
  let browserSocket;
  let closeBrowser;
  try {
    const deadline = Date.now() + 20_000;
    let targets;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        targets = await response.json();
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    const page = targets?.find(target => target.type === "page");
    if (!page) throw new Error("Headless Edge DevTools page did not start.");
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    browserSocket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      browserSocket.addEventListener("open", resolve, { once: true });
      browserSocket.addEventListener("error", reject, { once: true });
    });
    closeBrowser = cdp(browserSocket);
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const send = cdp(socket);
    await send("Page.enable");
    await send("Runtime.enable");
    const storageKey = `leakline-investigation-${runId}`;
    const init = `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(investigationId)});`;
    await send("Page.addScriptToEvaluateOnNewDocument", { source: init });
    await send("Page.navigate", { url: `${baseUrl}/app?run=${encodeURIComponent(runId)}` });

    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error("Browser page evaluation failed.");
      return result.result?.value;
    };
    const appDeadline = Date.now() + 25_000;
    let status;
    while (Date.now() < appDeadline) {
      status = await evaluate(`(() => { const t=document.body?.innerText||''; return {
        investigationPanel:t.includes('AI Investigation'), button:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Show persisted trace')),
        model:t.includes(${JSON.stringify(persistedTrace.model)}), scope:t.includes('does not automatically resolve the remaining train/validation overlap'),
        status:t.includes('complete'), plan:t.includes(${JSON.stringify(persistedTrace.repair_plan_id)})
      }})()`);
      if (status?.button && status?.model && status?.scope && status?.plan) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!status?.investigationPanel || !status?.button || !status?.model || !status?.scope || !status?.plan) {
      throw new Error(`Persisted investigation did not render in /app: ${JSON.stringify(status)}`);
    }
    await evaluate(`(() => [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Show persisted trace'))?.click())()`);
    let traceVisible = false;
    const traceDeadline = Date.now() + 15_000;
    while (Date.now() < traceDeadline) {
      traceVisible = await evaluate(`(() => { const t=document.body?.innerText||''; return t.includes('Persisted model and MCP trace') && t.includes('get_schema') && t.includes('validate_repair_plan') && t.includes(${JSON.stringify(persistedTrace.repair_plan_id)}); })()`);
      if (traceVisible) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!traceVisible) throw new Error("The persisted model/MCP trace did not open in the browser.");
    const userAgent = await evaluate("navigator.userAgent");
    console.log(JSON.stringify({ status: "passed", browser: "Microsoft Edge headless", user_agent: userAgent,
      route: `${baseUrl}/app?run=${runId}`, investigation_id: investigationId,
      investigation_panel: true, persisted_conclusion_and_scope: true, persisted_tool_trace: true,
      plan_id: persistedTrace.repair_plan_id, approval_state: persistedTrace.approval_state }, null, 2));
  } finally {
    try {
      if (closeBrowser) await Promise.race([closeBrowser("Browser.close"), new Promise(resolve => setTimeout(resolve, 1000))]);
    } catch { /* Browser may already have exited. */ }
    socket?.close();
    browserSocket?.close();
    if (browser.exitCode === null) {
      await Promise.race([new Promise(resolve => browser.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    }
    if (browser.exitCode === null && browser.pid) {
      try { execFileSync("taskkill.exe", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* Already closed. */ }
      await Promise.race([new Promise(resolve => browser.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    }
    const tempRoot = path.resolve(tmpdir());
    const resolved = path.resolve(profile);
    if (resolved.startsWith(tempRoot + path.sep)) {
      try { rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
      catch { /* Edge can briefly retain Crashpad files after the page has closed. */ }
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
