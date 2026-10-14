# rea capabilities

> rea capabilities lists every operation with seven declared side effects, so you know before a call whether it starts a process, writes files, or edits the session database.

An agent is about to call a tool on a file you gave it. Some rea operations start a Java process, and some write a runtime directory. Three edit the names in the analysis database, and a Hopper operation would open a window. You want that list before the call, not after. `rea capabilities` prints it, and the same record reaches an agent as the MCP tool `binary_session`.

When you finish this section, you can read a capability record, name its seven effect flags, and pick the operations that change nothing.

## The command and its record

`capabilities` and `providers` are registered together, and `capabilities` is described as "List provider capabilities and side effects". Both print the session status, the same object that `binary_session` returns over MCP. With no target open it starts `open: false`:

```listing
title: the head of the status record
source: capture/out/02-capabilities.json
lang: json
note: Cut to the first target-free capability and the first fields of the ghidra candidate. The other 17 target-free capabilities and the other two candidates are cut.
---
{
  "open": false,
  "capabilities": [
    {
      "operation": "capture_native_ui_scenario",
      "available": true,
      "reason": null,
      "availability_code": null,
      "effects": {
        "mutates_artifact": false,
        "launches_process": true,
        "may_show_ui": true,
        "may_access_network": true,
        "may_write_filesystem": true,
        "changes_permissions": false,
        "requires_root": false
      },
      "limitations": [
        "Availability and textual formats depend on the installed macOS/Xcode toolchain."
      ]
    },
    …
  ],
  "analysis_provider_binding": null,
  "analysis_provider_candidates": [
    {
      "provider": {
        "id": "ghidra",
        "name": "Ghidra",
        "version": null
      },
      "availability": {
        "status": "available",
…
```

The record has eight top-level fields in the capture: `open`, `capabilities`, `analysis_provider_binding`, `analysis_provider_candidates`, `analysis_run`, `analysis_activity`, `provider_operation_health`, and `server_identity`. `capabilities` holds the 18 operations that need no bound provider, such as `inspect_artifact`, `inspect_macho`, and the managed.NET readers. `analysis_provider_candidates` holds the three deep providers with their availability and their own operation lists. `analysis_provider_binding` is `null` because no target is open, and every candidate reports `target_support.status: "unknown"` with the reason `No target is open.`.

**Capability:** one operation with its `available` flag, seven `effects` booleans, and a list of `limitations`. When the operation is not available, `reason` and `availability_code` say why. The session projects each provider's internal descriptor into this shape, so the field names are the same for every provider. [Figure](#fig-2-3) shows one.

```figure
id: fig-2-3
kind: structure
title: one capability record, analyze_function under ghidra
claim: A capability record answers four questions before any call: is the operation available, what does it start, what does it write, and what does it change.
caption: Read the field, its value for analyze_function in the ghidra candidate, and the note that says which other operations differ. From capture/out/02-capabilities.json, with the schema from src/contracts/toolOutputSchemaPrimitives.ts:79-99 at the tag.
```

## The seven effects

| Flag | Meaning | True in the capture for |
|---|---|---|
| `mutates_artifact` | the operation edits the analysis database: names or comments | 3 Ghidra operations, 6 Hopper operations |
| `launches_process` | the operation starts a program, here the Ghidra JVM or a macOS tool | every Ghidra and Hopper operation, 11 target-free ones |
| `may_show_ui` | a window can open | every Hopper operation, 2 target-free ones |
| `may_access_network` | the operation can open a connection | every IDA adapter operation, 2 target-free ones |
| `may_write_filesystem` | the operation writes files, here the runtime root and the project | every Ghidra operation, 6 Hopper operations, 5 target-free ones |
| `changes_permissions` | the operation changes file or process permissions | nothing |
| `requires_root` | the operation needs root | nothing |

Two flags need a second look. `mutates_artifact` sounds like a write to your file, and it is not. The limitation on every Ghidra operation says: "The imported Program and temporary project are ephemeral and deleted on close. Annotation operations edit session database metadata; original executable bytes are never written." (capture/out/02-capabilities.json). The three operations that set it, `annotate_native_function`, `set_address_name`, and `set_addresses_names`, rename symbols in Ghidra's database, and the edit dies with the session.

`may_write_filesystem` is true for every Ghidra operation, even `list_documents`. The first call writes the runtime root, the private copy, and the project ([section 1.2](#s-rea-function-end-to-end)). [Figure](#fig-2-4) counts the flags per provider.

```figure
id: fig-2-4
kind: comparison
title: declared effects by provider in the capture
claim: Every Ghidra operation declares launches_process and may_write_filesystem, three also declare mutates_artifact, and no operation in the capture declares changes_permissions or requires_root.
caption: Read one column per provider and one row per flag, and each cell counts the operations that declare the flag. Counted from capture/out/02-capabilities.json.
```

## Three candidates, one bound

```listing
title: the two candidates that are not available
source: capture/out/02-capabilities.json
lang: json
note: Cut to the provider and availability of hopper and ida. Their target support and their operation lists are cut.
---
    {
      "provider": {
        "id": "hopper",
        "name": "Hopper Disassembler",
        "version": null
      },
      "availability": {
        "status": "unavailable",
        "code": "executable_missing",
        "reason": "Hopper launcher is missing or not executable: /Applications/Hopper Disassembler.app/Contents/MacOS/hopper",
…
    {
      "provider": {
        "id": "ida",
        "name": "IDA Pro MCP adapter",
        "version": "1"
      },
      "availability": {
        "status": "unavailable",
        "code": "not_configured",
        "reason": "Set REA_IDA_MCP_CONFIG to an upstream IDA MCP JSON registration; see docs/ida-provider.md.",
…
```

The `ghidra` candidate is `available`, and its `diagnostics` repeat the eight checks of [section 2.2](#s-rea-doctor-and-the-ghidra-provider) with the same paths. `hopper` is unavailable with the code `executable_missing`, and `ida` with `not_configured`. Each unavailable candidate still lists its operations, 36 for Hopper and 12 for IDA, with `available: true` on each. Availability of the engine and availability of an operation are two different facts. The docs put the rule in one sentence: "These commands describe binary-session providers and auxiliary capabilities." {{cli Choose a provider}}. With `--provider ghidra` or `provider_id: "ghidra"`, only the Ghidra list applies.

## Limitations are part of the declaration

Every Ghidra operation carries four limitations before its own. The session serves operations only after default auto-analysis completes. The Program and the project are ephemeral. Cancelling a request terminates the database and discards annotations. Addresses are lowercase `0x` hexadecimal in the default space (capture/out/02-capabilities.json).

Then each operation adds its own, and these are the sentences to read before you trust an empty list. `list_strings` says: "an empty search does not establish that text is absent from the artifact." `procedure_callers` says that only resolved call references are returned and that "unresolved computed or indirect calls remain unknown". The design rule behind all of them is "Missing coverage is unknown, not absence." {{design Define the contract}}.

## A second vocabulary in server_identity

The same record ends with `server_identity`, and its `catalog.tools` entries describe the 170 MCP tools in another vocabulary:

```listing
title: the catalog entry for xrefs
source: capture/out/02-capabilities.json
lang: json
note: Cut to one of the 170 catalog entries. The other entries, the protocol features, and the alignment block are cut.
---
        {
          "name": "xrefs",
          "surface": "official-proxy",
          "effects": {
            "mutatesTarget": false,
            "mutatesSession": true,
            "writesFilesystem": false,
            "launchesProcess": false,
            "accessesNetwork": false,
            "changesUiState": false,
            "mayDiscardData": false,
            "idempotent": true
          },
          "annotations": {
            "read_only": false,
            "destructive": false,
            "idempotent": true,
            "open_world": false
          }
        }
```

The catalog describes the MCP tool, not the provider operation. `xrefs` has `mutatesSession: true`, because every answer is recorded in the session's Evidence ledger. So its MCP annotation `read_only` is false, even though the provider capability says `mutates_artifact: false`. The two vocabularies answer two questions. The capability says what the engine does to your machine, and the catalog says what the tool does to the MCP session. Read the one that matches your question, and do not mix them.

```takeaways
- Run `rea capabilities --format json` before the first call on a new machine.
- Treat `launches_process` and `may_write_filesystem` as the cost of every Ghidra operation.
- Avoid `annotate_native_function`, `set_address_name`, and `set_addresses_names` unless you want session renames.
- Read each operation's `limitations` before you read an empty result as absence.
```

Sources: cli Choose a provider (rea docs/cli.md); design Define the contract (rea docs/tool-design.md); rea at a56f7bb: src/cli/utilityCommands.ts, src/application/binary/BinarySessionStatus.ts, src/contracts/toolOutputSchemaPrimitives.ts, src/contracts/toolEffects.ts; capture/out/02-capabilities.json
