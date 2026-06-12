# Mobile E2E Tester — Requirements & Benchmark

## Project Goal

Build a **multi-agent orchestrator** using `kiro-cli` that can run E2E mobile tests in **parallel** across multiple Android emulators. This replaces the current single-agent Kiro IDE approach to solve session limits and speed issues.

---

## Current State (What Exists)

### Working
- ✅ Kiro IDE hooks: Generate from Codebase, Generate from Requirements, Generate from Excel, Execute Test Scripts
- ✅ Kiro Power (mobile-e2e-tester) with steering files
- ✅ mobile-mcp integration (tap, type, swipe, assert, screenshot)
- ✅ YAML test script generation per module
- ✅ Excel report with Executive Summary + per-module sheets
- ✅ Auto-resume across sessions (Excel-based progress tracking)
- ✅ prompt/ folder auto-generation (prerequisites, testable/untestable flows, navigation, known issues)

### Current Limitations
- ❌ Single agent = single device (sequential only)
- ❌ 1000 step session limit → forced batching (10 test cases per session)
- ❌ Manual trigger needed per batch (no auto-continue)
- ❌ Terminal commands hang intermittently (Kiro terminal detection issue)
- ❌ ~30 min for 10 test cases (slow due to real-time AI decision per step)
- ❌ No parallel execution

---

## Target State (What to Build)

### Architecture

```
wizard.sh (entry point)
    │
    ▼
wizard.ts (orchestrator — TypeScript + Clack prompts)
    │
    ├── STEP 1: Setup
    │   ├── Detect/start emulators (N emulators for N modules)
    │   ├── Install APK on all emulators
    │   ├── Read e2e-tests/ for modules + module-order.yaml
    │   └── Read prompt/ for context
    │
    ├── STEP 2: Assign modules to agents
    │   ├── Module A → emulator-5554 → kiro-cli session 1
    │   ├── Module B → emulator-5556 → kiro-cli session 2
    │   ├── Module C → emulator-5558 → kiro-cli session 3
    │   └── Module D → emulator-5560 → kiro-cli session 4
    │
    ├── STEP 3: Spawn agents (parallel)
    │   ├── spawn("kiro-cli", ["chat", "--prompt", "execute-module-A.md"])
    │   ├── spawn("kiro-cli", ["chat", "--prompt", "execute-module-B.md"])
    │   ├── spawn("kiro-cli", ["chat", "--prompt", "execute-module-C.md"])
    │   └── spawn("kiro-cli", ["chat", "--prompt", "execute-module-D.md"])
    │
    ├── STEP 4: Monitor progress
    │   ├── Watch each agent's output (stdout)
    │   ├── Display progress per module (✔/✖/◐)
    │   └── Handle agent failures (retry or mark failed)
    │
    └── STEP 5: Merge results
        ├── Collect Excel reports from each agent
        ├── Merge into 1 combined Excel (Executive Summary + all module sheets)
        └── Output final report
```

### Key Components to Build

| Component | Description | Effort |
|-----------|-------------|--------|
| `wizard.sh` | Entry point shell script (runs wizard.ts via tsx) | Low |
| `wizard.ts` | Interactive orchestrator (Clack prompts, emulator management, agent spawning) | High |
| `prompts/execute-module.md` | Template prompt for each agent (parameterized with module name + device ID) | Medium |
| `scripts/merge-reports.ts` | Merge per-module Excel outputs into 1 combined report | Medium |
| `scripts/setup-emulators.ts` | Start N emulators, install APK, wait for boot | Medium |
| `.kiro/agents/e2e-runner.json` | Agent config with lifecycle hooks (if needed) | Low |

---

## Functional Requirements

### FR-1: Multi-Emulator Support
- System can start N Android emulators (configurable, default 2-4)
- Each emulator runs on different port (5554, 5556, 5558, ...)
- APK installed on all emulators before test execution
- Each emulator assigned to 1 module

### FR-2: Parallel Agent Execution
- Orchestrator spawns N `kiro-cli chat` processes simultaneously
- Each agent receives: module name, device ID, prompt context
- Agents run independently (no shared state)
- If 1 agent fails, others continue

### FR-3: Module Assignment Strategy
- Read `module-order.yaml` for dependency info
- Independent modules run in parallel
- Dependent modules run sequentially on same device (e.g., login → then home on same emulator)
- User can override: `--modules "Search,Profile"` or `--workers 2`

### FR-4: Progress Monitoring
- Real-time progress display in terminal (per module)
- Format: `✔ Module A — 8/8 passed | ◐ Module B — running (3/7) | ○ Module C — pending`
- Agent output can be streamed with `--verbose`

### FR-5: Result Merging
- After all agents complete, merge results into 1 Excel
- Executive Summary (combined across all modules)
- Per-module sheets (from each agent's output)
- Combined metadata.yaml

### FR-6: Resume & Retry
- If agent crashes mid-module, can be restarted for that module only
- Progress tracked per module (not global)
- `./wizard.sh --resume` continues from where it stopped

### FR-7: Error Handling
- Timeout per agent (configurable, default 30 min per module)
- If timeout hit → kill agent, mark module as incomplete
- Retry failed modules up to 2 times
- Final report shows which modules completed vs failed

---

## Non-Functional Requirements

### NFR-1: Performance Target
- 4 modules parallel on 4 emulators = **4x faster** than sequential
- Target: 40 test cases complete in <15 min (vs current ~60 min sequential)

### NFR-2: Resource Usage
- Each emulator: ~4GB RAM
- 4 emulators = 16GB RAM needed
- CPU: 2 cores per emulator recommended
- Minimum machine: 16GB RAM, 8 cores (or EC2 a1.4xlarge)

### NFR-3: Reliability
- Agent crash doesn't affect other agents
- Excel results saved incrementally (no data loss)
- Network timeout handling for mobile-mcp calls

---

## Benchmark (Current vs Target)

| Metric | Current (Kiro IDE) | Target (kiro-cli orchestrator) |
|--------|-------------------|-------------------------------|
| Devices | 1 | 2-4 configurable |
| Execution | Sequential | Parallel per module |
| 10 test cases | ~30 min | ~10 min (with setup) |
| 40 test cases | ~120 min (4 batches) | ~15 min (4 parallel) |
| Session limit | 1000 steps shared | 1000 per agent (independent) |
| Manual intervention | Click per batch | None (auto-complete) |
| Terminal hang | Frequent | Same risk per agent, but others unaffected |
| Resume | Excel-based | Module-based (more granular) |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Orchestrator | TypeScript (wizard.ts) |
| CLI framework | @clack/prompts (interactive terminal UI) |
| Process spawning | execa or child_process |
| Agent | kiro-cli (`npm install -g @anthropic/kiro-cli`) |
| MCP server | @mobilenext/mobile-mcp |
| Emulator | Android SDK command-line tools |
| Report merge | openpyxl (Python) or ExcelJS (Node) |
| Config | YAML (module-order, prompts) |

---

## Implementation Phases

### Phase 1: Single-agent CLI (1-2 days)
- Wrap current logic in `wizard.ts` + `wizard.sh`
- Interactive prompts: select modules, configure device
- Same as current but via terminal (not Kiro IDE hooks)
- No parallel yet — just validate kiro-cli works

### Phase 2: Multi-emulator setup (1-2 days)
- Script to start/stop N emulators
- Install APK on all
- Verify mobile-mcp can connect to each

### Phase 3: Parallel execution (2-3 days)
- Spawn N kiro-cli processes
- Each gets its own prompt + device
- Progress monitoring
- Handle agent completion/failure

### Phase 4: Report merging (1 day)
- Collect per-module results
- Merge into 1 combined Excel
- Executive Summary across all modules

### Phase 5: EC2 deployment (2-3 days)
- user-data.sh for EC2 instance bootstrap
- systemd service for daemon mode
- API endpoint for triggering runs remotely

---

## Open Questions

1. Does `kiro-cli` support passing MCP server config per session? (needed to assign different devices)
2. Can `kiro-cli` run with a custom prompt file? (`--prompt path/to/prompt.md`)
3. What's the token/cost per kiro-cli session? (parallel = N× cost)
4. Is there a timeout mechanism in kiro-cli? (vs Kiro IDE's 1000 step limit)
5. Can we use Claude API directly (Bedrock) instead of kiro-cli? (more control, no CLI dependency)

---

## Reference

- [test-playwright repo](https://github.com/yebology/test-playwright) — web E2E framework using same pattern
- [mobile-mcp](https://github.com/mobile-next/mobile-mcp) — device control MCP server
- Current implementation: `.kiro/hooks/` + `powers/mobile-e2e-tester/` in this repo
