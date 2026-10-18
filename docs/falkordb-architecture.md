# FalkorDB architecture and verification

## Runtime pin

Compose pins `falkordb/falkordb:6.0.2` by immutable image digest (`docker-compose.yml:2-16`). `pyproject.toml` and `uv.lock` pin `falkordb==1.2.0`; MCP uses `mcp==1.26.0`. The configured deployment is local and loopback-bound. The repo’s capability script and real integration suite execute against that service. Official references: [FalkorDB docs](https://docs.falkordb.com/), [Docker operations](https://docs.falkordb.com/operations/docker.html), [WCC](https://docs.falkordb.com/algorithms/wcc.html), [BFS](https://docs.falkordb.com/algorithms/bfs.html), [shortest paths](https://docs.falkordb.com/algorithms/sppath.html), [MCP server](https://docs.falkordb.com/genai-tools/mcpserver/), [MCP quickstart](https://docs.falkordb.com/genai-tools/mcpserver/quickstart.html), [official FalkorDB MCP repository](https://github.com/FalkorDB/falkordb-mcp).

The installed-version query contract is tested with FalkorDB 6.0.2, not inferred from current docs:

```cypher
CALL algo.wcc({nodeLabels: ['Sample'], relationshipTypes: ['CONFIRMED_DUPLICATE_OF']})
YIELD node, componentId
RETURN node.sample_id, node.split, componentId
```

This query includes isolated `Sample` vertices. It traverses confirmed relationships as undirected connectivity for WCC. Only after returned records are grouped by FalkorDB component ID does Python derive a stable key as SHA-256 of sorted sample IDs. WCC numeric IDs are transient and do not enter identifiers or plan fingerprints. Candidate-only `POSSIBLY_SIMILAR_TO` edges are excluded.

## Graph schema

Each audit gets a server-generated graph name `leakline_<analysis UUID without dashes>`.

```text
DatasetRevision -[:HAS_SPLIT]-> Split -[:CONTAINS]-> Sample
Sample -[:HAS_PAIR_EVIDENCE]-> PairEvidence -[:CONCERNS]-> Sample
Sample -[:CONFIRMED_DUPLICATE_OF {pair_id,method,score,threshold,version}]-> Sample
Sample -[:POSSIBLY_SIMILAR_TO {...}]-> Sample       (review only)
Sample -[:IN_COMPONENT]-> Component                 (derived materialization)
AnalysisRun -[:PROPOSES]-> RepairPlan -[:AFFECTS]-> Component
```

`DatasetRevision` stores dataset/config/revision/license. `Split` stores source and inspected counts. `Sample` stores stable row identity, original split/index, text, label and hashes. Pair evidence stores matcher method, exact/verified score, threshold, decision status/reason and algorithm version. No source sample or split assignment is changed by planning/export. Schema source: `apps/api/leakline/graph.py:41-85`, `apps/api/leakline/snapshot.py:34-83`; fuller inventory is [graph-schema.md](graph-schema.md).

## Queries that produce findings and evidence

1. **Accepted evidence edges** are written only for `status == confirmed`; review-only edges have a different relationship type (`graph.py:52-58`).
2. **WCC** uses only `Sample` and `CONFIRMED_DUPLICATE_OF` (`graph.py:7`). Its result populates component keys and boundary flags (`graph.py:60-85`). Findings are read from the materialized graph, not synthesized from text.
3. **Fresh independent snapshot** checks one source identity, all expected sample IDs, pair evidence, accepted-edge/evidence consistency, thresholds, split totals, and then executes WCC again (`snapshot.py:34-83`). It returns canonical groups and a graph fingerprint.
4. **Bounded evidence path** is actual accepted-edge Cypher, with at most eight hops:

```cypher
MATCH p=(a:Sample {sample_id:$source})-[:CONFIRMED_DUPLICATE_OF*1..8]-(b:Sample {sample_id:$target})
RETURN [n IN nodes(p) | n.sample_id], [r IN relationships(p) | r.pair_id]
LIMIT 1
```

The bounded display path does not bound WCC. The persisted finding identity is based on full WCC membership even when no ≤8-hop path is displayed.

## MCP boundary and graph dependence

The agent launches a run/investigation-bound MCP stdio subprocess using the pinned Python MCP SDK. The server reads `graph_name` from the trusted persisted run, never from model arguments. Handshake, tool discovery and tools are actual MCP protocol operations. It is a purpose-built compatible server, not the separately maintained FalkorDB Rust MCP server; app-specific functions make it possible to bind each run and use exact safe business templates.

Graph reads call FalkorDB’s `GRAPH.RO_QUERY` through the client `ro_query` method (`mcp_server.py:134-136`), with fixed templates for audit scope, materialized cross-split components, member/evidence and confirmed paths; Cypher values are parameterized. `get_schema`, `explain`, `inspect_audit_scope`, `list_cross_split_components`, `inspect_component_evidence`, `trace_duplicate_path`, and `get_repair_options` return bounded evidence. `query_read` accepts only a template ID and typed parameters; a supplied Cypher string is explicitly rejected. Tool results cap rows via `AGENT_MAX_TOOL_RESULT_ROWS` (1–500), return no raw sample text, and are Pydantic-validated by the API before being shown to the model.

Repair tools call the existing deterministic HTTP services. The agent has no graph write or approval tool. Repair receipt writes are performed by server code, and explicit approval remains in the user API.

If the graph is unavailable during a new agent tool call, that invocation is recorded failed and the agent cannot pass the required observation checks to save a new conclusion. Existing completed traces may still be retrieved from SQLite; that is retrieval of old evidence, not a newly completed graph investigation. The regression test `tests/test_agent.py::test_graph_outage_does_not_produce_new_authoritative_agent_decision` covers this fail-closed boundary. The read-only test attempts a write-shaped `query_read` argument and verifies an MCP error plus unchanged database node count.

## Official algorithm docs and project deviations

The project uses WCC. The official [BFS](https://docs.falkordb.com/algorithms/bfs.html) and [shortest-path](https://docs.falkordb.com/algorithms/sppath.html) algorithms are not needed for grouping; bounded path inspection uses Cypher variable-length traversal so it returns evidence pair IDs along the actual path. No NetworkX or Python connected-components fallback exists. The server algorithms are part of the primary product flow: findings, plan scope, independent validation and MCP recommendations depend on their data.
