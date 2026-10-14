# rea mcp: initialize, tools/list, and the startup deadline

> rea mcp serves 170 tools over stdio after one initialize handshake, and the first Ghidra-backed call pays for the import under a server deadline the client does not share.

You added rea to the MCP configuration of your agent and asked it for the dossier of `_grade`. The client reported a timeout after one minute while a Java process kept running. Nothing was wrong with rea or with Ghidra. Two deadlines with two owners had crossed.

The capture kit drove `rea mcp` with a small client of its own and recorded 25 exchanges. This section reads the first ones and the log beside them. When you finish this section, you can read the `initialize` reply and the `tools/list` answer and register the server with one exact version. You can also set the client deadline that the first Ghidra call needs.

## Starting the server

The published way to register the server is one `mcpServers` entry that runs the package through `npx` with the `mcp` command:

```listing
title: the registration shape this manual uses
source: examples/mcp-registration.json
lang: json
note: Nothing is cut. The shape follows the install docs {{install MCP registry}}. rea setup writes the same shape for the clients it knows and pins the version that ran it.
---
{
  "mcpServers": {
    "rea": {
      "command": "npx",
      "args": ["-y", "rea-agents@6.4.0", "mcp"]
    }
  }
}
```

The docs ask for one exact version in a persistent registration {{install MCP registry}}. A client that supports registry discovery finds the same stdio server under `io.github.morluto/rea`. `rea setup` writes this shape for Claude Code, Codex, Cursor, and the other clients it lists. `rea doctor --client <id>` reports whether a registration is aligned, stale, missing, or invalid ([Section 2.2](#s-rea-doctor-and-the-ghidra-provider)).

The `rea.mjs` dispatcher routes the single argument `mcp` to `dist/main.js`. `run()` there parses the environment into a configuration and exits 1 with the projected error when a value is invalid. It then creates the logger and the one `BinarySession`, opens an initial target only when `HOPPER_TARGET_PATH` is set, and starts the stdio transport. Shutdown is bound to `SIGINT`, `SIGTERM`, and the end of stdin. An unexpected startup failure prints one fixed sentence and hides its cause: "REA could not start. Run `rea doctor`, then restart REA from your MCP client.".

The transport is newline-delimited JSON-RPC 2.0 on stdin and stdout, and stderr carries one pino JSON line per tool call. The capture kit started the server as `node.../scripts/rea.mjs mcp` with `GHIDRA_INSTALL_DIR` and `JAVA_HOME` set, as capture/README.md describes, and kept the stderr lines as `10-mcp-server.log`.

## initialize

The client sends `initialize` with the protocol version it speaks, its capabilities, and its name. The server answers with the version it negotiated, its own capabilities, its identity, and an instruction string for the model:

```listing
title: the initialize reply
source: capture/out/10-mcp-01-initialize.json
lang: json
note: The request is cut. It carried protocolVersion 2025-06-18, empty capabilities, and clientInfo re101-capture 1.0.0.
---
  "response": {
    "result": {
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "tools": {
          "listChanged": true
        },
        "completions": {},
        "prompts": {
          "listChanged": true
        }
      },
      "serverInfo": {
        "name": "rea",
        "version": "6.4.0"
      },
      "instructions": "REA provides reverse-engineering tools for local artifacts, native binaries, managed code, browser pages, and runtimes. Use the tool that directly answers the question; discover targets or inspect inventory only when needed. Tool results include inline Evidence and report their coverage and limitations."
    },
```

The instruction string is the target-free one of two constants in `createServer.ts`. With an active target the server sends the other, which names `analyze_function` as the dossier tool and the procedure tools as its facets. Neither sentence tells the model how to treat text that comes from the analyzed file. The main branch of rea adds a third sentence about that, and 6.4.0 does not have it. [Section 8.2](#s-an-agent-investigation) puts the rule in the agent's own instructions.

After the reply the client sends `notifications/initialized`, and the connection is established. `binary_session` later reports the negotiated version, the SDK version `2.3.1` on both sides, the client name, and the catalog digests (capture/out/10-mcp-04-binary-session.json).

## tools/list

**Tool catalog:** the complete list of tools the server advertises, 170 in 6.4.0. Each entry has a name, a title, a description, an input schema, an output schema, and four annotation hints. `tools/list` returns every tool whether or not the current target supports it {{mcp Identity and discovery}}. Opening or closing a target leaves the list unchanged and sends no `notifications/tools/list_changed`. The session's own view is the authority. `binary_session` reports `tool_availability` for the open target, with a reason and a remediation for each unavailable tool, and the catalog counts.

```listing
title: the first tool of 170
source: capture/out/10-mcp-02-tools-list.json
lang: json
note: The description is cut after its second sentence, and the schemas were cut by the capture kit for the tools the session did not call.
---
{
  "request": {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  },
  "response": {
    "result": {
      "tools": [
        {
          "name": "annotate_native_function",
          "title": "Annotate Native Function",
          "description": "Atomically update one function name and/or entry comments, read them back, and return a refreshed complete function dossier. Ghidra changes its ephemeral session analysis database only; original executable bytes remain unchanged. …",
          "inputSchema": "<cut by run.py: schemas are kept only for the tools this session calls>",
          "annotations": {
            "readOnlyHint": false,
            "destructiveHint": false,
            "idempotentHint": true,
            "openWorldHint": true
          },
          "outputSchema": "<cut by run.py: schemas are kept only for the tools this session calls>"
        },
```

The annotations describe effects and are hints, never authorization. `readOnlyHint` counts session state, so `analyze_function` is marked non-read-only because it records Evidence, although it never changes the file {{mcp Request scope and local effects}}. Five tools of the 170 carry `readOnlyHint: true` in the capture: `binary_session`, `get_evidence_bundle`, `list_unknowns`, `verify_unknown_resolution`, and `evaluate_reconstruction_coverage`. Seven carry `destructiveHint: true`, among them `export_evidence_bundle`, which can overwrite a file, and `close_binary`, which discards the session.

```listing
title: the catalog counts the session reports
source: capture/out/10-mcp-04-binary-session.json
lang: json
note: Six lines of the server_identity object. The digests that follow identify this exact catalog.
---
              "counts": {
                "cli_commands": 127,
                "mcp_tools": 170,
                "mcp_prompts": 6
              },
```

Of the 170 tools, 53 have no CLI command, among them `open_binary`, `list_procedures`, `compare_functions`, and `verify_reconstruction`. The six prompts are `investigate_feature`, `compare_application_versions`, `verify_reconstruction`, `trace_crash`, `audit_residual_unknowns`, and `prepare_bounded_process_capture`, and each asks the agent to keep observations, inferences, and unknowns apart. A client that rejects large tool schemas can start the server with `REA_MCP_INPUT_SCHEMA_PROFILE=compact` {{mcp Compact input schema profile}}. That profile renders every input schema within 13,312 bytes and leaves the validation unchanged.

## The startup deadline against the client default

**Startup deadline:** the time rea allows for Ghidra to import the target, run default auto-analysis, connect the bridge, and report healthy. It is 330,000 ms by default and set with `REA_GHIDRA_STARTUP_TIMEOUT_MS`. `open_binary` does not start that clock. It validates the file, binds the provider, and returns in milliseconds. The first Ghidra-backed call starts the engine and waits, and the client's own per-call deadline runs at the same time {{mcp Ghidra first-query deadlines and recovery}}.

| Deadline | Owner | Value |
|---|---|---|
| `initialize` | the client | before any target query |
| Ghidra startup | rea | 330,000 ms by default, `REA_GHIDRA_STARTUP_TIMEOUT_MS` from 1 to 2,147,483,647 ms |
| one tool call | the client | 60,000 ms in the pinned SDK 2.3.1, which is `DEFAULT_REQUEST_TIMEOUT_MSEC` in `@modelcontextprotocol/server` |

The capture shows both clocks. `open_binary` took 44 ms and started no process. `list_procedures`, the first Ghidra-backed call, took 6,711 ms, and every later call on the same target took 100 ms or less:

```listing
title: the first three tool calls in the server log
source: capture/out/10-mcp-server.log
lang: jsonl
note: Lines 1 to 3 of 16. The time field is epoch milliseconds.
---
{"level":30,"time":1791922233948,"application":"rea","mode":"mcp","layer":"server","tool":"open_binary","durationMs":41.16,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":1791922240857,"application":"rea","mode":"mcp","layer":"server","tool":"list_procedures","durationMs":6707.84,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":1791922240865,"application":"rea","mode":"mcp","layer":"server","tool":"procedure_assembly","durationMs":3.42,"status":"ok","msg":"MCP tool execution completed"}
```

Seven seconds fit under a 60 s default on this Mac, for a 33,872-byte executable. The docs record a cold first overview of about 64 s on a Linux x64 host under WSL2 {{mcp Ghidra first-query deadlines and recovery}}. On Windows x64 it took about 163 s with Ghidra 12.1.4 and a small fixture, and the default client request timed out there. A larger target, a slower disk, or a smaller heap moves the number. The client deadline is a request option, the second argument of `callTool` in the SDK. The docs use 240,000 ms as a measured example and not as a rule, and progress notifications do not extend the deadline.

```figure
id: fig-8-1
kind: sequence
title: one connection from initialize to close_binary
claim: open_binary returns in 44 ms without a Ghidra process, and list_procedures pays 6,711 ms for the import before the session answers in milliseconds.
caption: Read top down. The grey lifeline is the capture client, blue is rea mcp, and violet is Ghidra. Solid plum is the import and analysis that rea waits for under its 330,000 ms deadline. From capture/out/10-mcp-session.txt and 10-mcp-server.log.
```

```figure
id: fig-8-2
kind: timeline
title: two deadlines and three measured first calls
claim: The 60 s client default covers the 6.7 s first call on this Mac, the 64 s Linux call fails it, and rea waits up to 330 s.
caption: Read left to right in seconds. The grey bar is the client default and the dashed grey bar is the 240 s example setting from the docs. The blue bar is the rea startup deadline. Numbered marks are the three measured first calls. From capture/out/10-mcp-session.txt and the rea MCP contracts page at the tag.
```

When the client gives up during startup, the pending query can have been interrupted. A second `open_binary` on the same target reuses the current client instead of starting fresh. The documented recovery stays on the same connection {{mcp Ghidra first-query deadlines and recovery}}. Export a bundle if retained records matter, then call `close_binary` and check its result. Then call `open_binary` with the same path and `provider_id: "ghidra"`, and retry the first query with a longer client deadline.

The docs add that "No macOS cold-start recovery was exercised." {{mcp Ghidra first-query deadlines and recovery}}, so the Mac that recorded this manual has no recorded recovery run either. `close_binary` itself took 548 ms here and shut the Ghidra process down with the ephemeral project.

```takeaways
- Register `npx -y rea-agents@6.4.0 mcp` with one exact version and restart the client.
- Read binary_session for the tools the open target supports, because tools/list lists all 170.
- Set the client's per-call deadline above the first Ghidra call before you make that call.
- After a client timeout during startup, call close_binary, then open_binary, then retry.
```

Sources: examples/mcp-registration.json; capture/out/10-mcp-01-initialize.json, 10-mcp-02-tools-list.json, 10-mcp-03-open-binary-O1.json, 10-mcp-04-binary-session.json, 10-mcp-05-list-procedures.json, 10-mcp-15-close-binary-O1.json, 10-mcp-session.txt, 10-mcp-server.log, 00-fixtures.txt; capture/README.md; rea docs/installation.md (MCP registry), docs/mcp-contracts.md (Identity and discovery, Compact input schema profile, Ghidra first-query deadlines and recovery, Request scope and local effects); rea at a56f7bb: scripts/rea.mjs, src/main.ts, src/main/messages.ts, src/server/createServer.ts, src/config/ghidraStartupTimeout.ts, src/config/environment.ts, src/cliCommandNames.ts, docs/mcp-prompts.md; @modelcontextprotocol/server 2.3.1 as installed in the npx cache
