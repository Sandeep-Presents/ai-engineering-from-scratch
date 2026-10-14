# inspect-wasm-artifact in rea 6.4.0

> The published 6.4.0 build has no WebAssembly tool, so the module you built is read with wabt 1.0.42 directly, and that output is not an Evidence record.

You wrote `capture/fixtures/wasm/ledger.wat` by hand, with the same four functions as `ledger.c`, and assembled it to `ledger.wasm` with `wat2wasm`. You ask rea 6.4.0 to inspect the module, on the CLI and over MCP, and both answers are refusals. When you finish this section, you can recognize the two error envelopes and say what the release lacks and what the main branch added. You can also read the module's sections with wabt.

## Two refusals

The CLI does not know the command. `rea` answers with `COMMAND_NOT_FOUND` and suggests the nearest command it has.

```listing
title: the CLI refusal
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: Nothing is cut.
---
{
  "code": "COMMAND_NOT_FOUND",
  "message": "'inspect-wasm-artifact' is not a command for 'rea'. Did you mean 'inspect-artifact'?",
  "cta": {
    "description": "Suggested commands:",
    "commands": [
      {
        "command": "rea inspect-artifact $CAPTURE/fixtures/wasm/ledger.wasm --format json"
      },
      {
        "command": "rea --help",
        "description": "see all available commands"
      }
    ]
  }
}
```

The MCP server does not know the tool either. The answer is a JSON-RPC error with no `isError` tool result, because the request never reached a tool.

```listing
title: the MCP refusal
source: capture/out/10-mcp-24-inspect-wasm-artifact.json
lang: json
note: Nothing is cut.
---
{
  "request": {
    "jsonrpc": "2.0",
    "id": 24,
    "method": "tools/call",
    "params": {
      "name": "inspect_wasm_artifact",
      "arguments": {
        "path": "$CAPTURE/fixtures/wasm/ledger.wasm"
      }
    }
  },
  "response": {
    "jsonrpc": "2.0",
    "id": 24,
    "error": {
      "code": -32602,
      "message": "Tool inspect_wasm_artifact not found"
    }
  }
}
```

The source at the tag agrees with both answers. The 6.4.0 source has no WebAssembly module, the CLI command table has no WebAssembly entry, and the server checks for no WABT variable. The 170 tools in `10-mcp-02-tools-list.json` include none with `wasm` in the name. The `REA_WABT_BIN_DIRECTORY` variable that the capture kit set has no effect on this build. The architectures rea recognizes are `x86`, `x86_64`, `arm`, `arm64`, and `mips`, and a WebAssembly module is none of them.

## What main added after the release

Two days after the release, the main branch at `6e25cc3` has an `inspect_wasm_artifact` tool and a CLI command of that name. None of it is in 6.4.0, so this manual describes it in two paragraphs only.

On main the tool runs three caller-supplied WABT programs on a private copy of the module. They are `wasm-validate --enable-all`, `wasm-objdump -h -x`, and `wasm2wat --enable-all`, from the directory named by `REA_WABT_BIN_DIRECTORY`. Each program must print exactly `1.0.42` as its version, or the tool refuses to run.

The result on main is an Evidence record. Its `normalized_result` holds the sections parsed from the objdump rows and the imports and exports lifted from the WAT text. It also holds the whole WAT as text with its digest, and a tool profile with the three command lines. Function bodies, types, globals, and memories are not separate fields. The limits are 8 MiB of input, 30 s per program, and 32 MiB of output.

The main documentation adds that the WAT is a decoded representation and not the original source. [Figure](#fig-6-2) sets the two refusals beside what wabt returns.

## Reading the module with wabt directly

The capture ran those three programs on the module without rea. `wasm-validate --enable-all` printed nothing and exited 0. `wasm-objdump -h -x` printed the section table.

```listing
title: the seven sections of ledger.wasm
source: capture/out/16-wabt.txt
lang: text
note: The command line and the section details that follow are cut.
---
ledger.wasm:	file format wasm 0x1

Sections:

     Type start=0x0000000a end=0x0000001a (size=0x00000010) count: 3
   Import start=0x0000001c end=0x00000027 (size=0x0000000b) count: 1
 Function start=0x00000029 end=0x0000002e (size=0x00000005) count: 4
   Memory start=0x00000030 end=0x00000033 (size=0x00000003) count: 1
   Export start=0x00000035 end=0x0000006e (size=0x00000039) count: 5
     Code start=0x00000071 end=0x0000010f (size=0x0000009e) count: 4
     Data start=0x00000111 end=0x00000122 (size=0x00000011) count: 1
```

The file is 290 bytes (`00-fixtures.txt`). Eight bytes of magic and version come first. The seven sections follow, each with a one-byte id and a length before its payload. That is why `Type` starts at offset `0x0a` and not at 8. The export and code details name the four functions and their body sizes. The data segment holds the five grade labels, two bytes apart, at address 1024.

```listing
title: exports, code sizes, and the data segment
source: capture/out/16-wabt.txt
lang: text
note: The Type, Import, Function, and Memory details are cut.
---
Export[5]:
 - memory[0] -> "memory"
 - func[1] <percent_change> -> "percent_change"
 - func[2] <grade> -> "grade"
 - func[3] <total> -> "total"
 - func[4] <grade_label> -> "grade_label"
Code[4]:
 - func[1] size=23 <percent_change>
 - func[2] size=63 <grade>
 - func[3] size=44 <total>
 - func[4] size=23 <grade_label>
Data[1]:
 - segment[0] memory=0 size=10 - init i32=1024
  - 0000400: 4600 4400 4300 4200 4100                 F.D.C.B.A.
```

`wasm2wat --enable-all` prints the text form. The body of `percent_change` is the C function in stack form. It tests the first parameter for zero, then either pushes 0 or computes the subtraction, the multiplication by 100, and the signed division.

```listing
title: percent_change in the text form
source: capture/out/16-wabt.txt
lang: text
note: The other three function bodies are cut.
---
  (func (;1;) (type 1) (param i32 i32) (result i32)
    local.get 0
    i32.eqz
    if (result i32)  ;; label = @1
      i32.const 0
    else
      local.get 1
      local.get 0
      i32.sub
      i32.const 100
      i32.mul
      local.get 0
      i32.div_s
    end)
```

Two things in the text form echo Part 4. The `grade` body is a `br_table` with twelve targets, the WebAssembly form of the jump table that clang built for the same `switch` in `ledger-x86_64-O1.o`. The `grade_label` body calls function 2, then function 0, which is the imported `env.log`. It then adds twice the grade to 1024, the address of the data segment above, two bytes per label. You can read that from the WAT without a decompiler, because the module has no stripped symbols and no relocations. That is one reason the format is a good first target for a reader built from scratch.

What is missing is everything Part 5 described. The wabt output has no `evidence_id`, no `confidence`, no `authority`, no `limitations`, and no ledger to hold it. If you want those, write them yourself. Record the module digest `699f6ff7…` from `00-fixtures.txt`, the tool name and version `1.0.42` from `00-versions.txt`, and the exact command line. Mark the row `observed` with `shipped-artifact` as its authority, because the bytes on disk are the source. [Lesson 35](phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns) gives those rows a record shape.

```figure
id: fig-6-2
kind: comparison
title: WebAssembly on rea 6.4.0 and with wabt directly
claim: Both rea 6.4.0 entry points refuse the module, while wasm-objdump reads its seven sections with their offsets and counts.
caption: Read each column top to bottom. Dashed rose arrows are refusals. From capture/out/16-inspect-wasm-artifact.json, 10-mcp-24-inspect-wasm-artifact.json, and 16-wabt.txt.
```

```takeaways
- Expect `COMMAND_NOT_FOUND` and JSON-RPC `-32602` for WebAssembly on rea 6.4.0.
- Run `wasm-validate --enable-all` before `wasm-objdump` and `wasm2wat`.
- Read the Export and Code details first, then one function body in the WAT.
- Write your own evidence row for every wabt output, with the file digest and the tool version.
```

Sources: src/cliCommandNames.ts, src/server/createServer.ts, src/domain/binaryTargetTypes.ts at rea-agents-6.4.0 (a56f7bb); capture/README.md; capture/fixtures/wasm/ledger.wat, capture/fixtures/ledger.c; capture/out/16-inspect-wasm-artifact.json, 10-mcp-24-inspect-wasm-artifact.json, 10-mcp-02-tools-list.json, 16-wabt.txt, 00-fixtures.txt, 00-versions.txt; phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns; rea 6.4.0 at a56f7bb: src/domain/binaryTargetTypes.ts
