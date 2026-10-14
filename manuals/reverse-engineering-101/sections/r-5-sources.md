# Sources

> One pinned source tree, its documentation pages, one recorded capture, and the specifications, papers, and statutes, ranked by authority.

The pin is `rea-agents` 6.4.0, the npm package published on 2026-10-11, whose tag `rea-agents-6.4.0` is commit `a56f7bb668ab23fec8d33f7af353ac7ed2fe1895` of `github.com/morluto/rea`. The provider is Ghidra 12.1.4 with OpenJDK 21.0.12.1. The facts were verified on 2026-10-13 against a read-only checkout of that commit, and the files in each Sources line are paths in it. The main branch of the repository is ahead of the tag, and a section says so where main differs.

## The ranked sources

When two sources disagree, the higher one wins and the section says so.

| Rank | Source | Used for | Cited as |
|---|---|---|---|
| 1 | the rea source at `a56f7bb` | every claim about how rea works | the file, in the Sources line |
| 2 | the rea documentation at `a56f7bb` | documented behaviour, limits, and the responsible use rules | `{{mcp ...}}`, `{{cli ...}}`, `{{install ...}}`, and the other keys below |
| 3 | the capture, `capture/out/`, recorded on 2026-10-13 | every listing and every number in a figure | the file name |
| 4 | the format and architecture specifications | ELF, Mach-O, x86-64, AArch64, calling conventions | `{{spec ...}}` |
| 5 | papers on program analysis and decompiler evaluation | disassembly, lifting, type recovery, and the 2026 measurements | `{{paper ...}}` and a link |
| 6 | statutes and court decisions | the law of analysis and interoperability | `{{law ...}}` |
| 7 | tool release notes | Ghidra and other tool versions | the file |

Every quote key is declared `null` in `manual.json`, because no source file is copied into this repository. The quotes were checked against the pinned tag when the manual was written, and the tag does not change.

## The rea documentation

Each quote key names one page of the rea repository at tag `rea-agents-6.4.0`. The repository is under the MIT license, copyright 2026 morluto.

| Key | Path in the rea repository |
|---|---|
| `readme` | `README.md` |
| `cli` | `docs/cli.md` |
| `mcp` | `docs/mcp-contracts.md` |
| `ghidra` | `docs/ghidra-provider.md` |
| `native` | `docs/native-investigation.md` |
| `install` | `docs/installation.md` |
| `readiness` | `docs/reconstruction-readiness.md` |
| `ledgers` | `docs/reconstruction-obligation-ledgers.md` |
| `jsgraph` | `docs/javascript-application-graph.md` |
| `design` | `docs/tool-design.md` |

`DISCLAIMER.md` is on the main branch at `6e25cc3`. The tag does not have it.

## The capture

The capture kit in `capture/` drove rea 6.4.0 and its MCP server on one Apple silicon Mac and wrote 65 files to `capture/out/`. The host ran macOS 26.2, Node 22.22.0, Ghidra 12.1.4 from Homebrew, OpenJDK 21.0.12.1, Apple clang 17.0.0, and WABT 1.0.42 (capture/out/00-versions.txt). The targets are programs written for this manual under `capture/fixtures/`, and `capture/out/00-fixtures.txt` holds the SHA-256 of each.

`python3 capture/run.py --check` recorded the whole set again into a temporary directory and compared it with `capture/out/`. The comparison masks timestamps, durations, ids, and temporary paths, and the 65 files matched. Evidence ids are content hashes and were compared unmasked. The `17-*` files are not rea output: they hold the two proofs of [lesson 36](phases/13-tools-and-protocols/36-rebuild-and-prove-equal), run by the kit over `ledger-x86_64-O1.o` with the host clang.

## Outside sources

Two external studies are cited in Parts 7 and 8 with their URLs. The first is Liu, Raff, and Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026. The second is Santos-Grueiro, When Binaries Talk Back, arXiv 2607.12507, 2026. Part 7 cites two specifications. They are the Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, and the Arm Architecture Reference Manual for A-profile, DDI 0487.

Sources: manual.json (pin, sources, quoteSources, capture); rea LICENSE; capture/README.md; capture/out/00-versions.txt, 00-fixtures.txt
