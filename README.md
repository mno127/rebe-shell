# rebe-shell

**A WASM-powered, cross-platform terminal built for autonomous infrastructure orchestration at planetary scale.**

## What is rebe-shell?

rebe-shell is not just another terminal emulator. It is the execution substrate for the reBe robot army - a system designed to manage infrastructure at scale (2 nodes to 20 million+) for technically illiterate users through fully autonomous agents.

### The Problem

Current shell/SSH execution patterns are fundamentally unsuitable for autonomous systems:

- **Unreliable output capture**: String concatenation, race conditions, memory exhaustion
- **Silent failures**: Complex pipe chains fail without errors
- **No fault tolerance**: No timeouts, retries, or circuit breakers
- **Serial execution**: Cannot scale beyond ~1000 nodes
- **Unsafe operations**: No sandboxing, preview, or rollback capabilities
- **Brittle parsing**: Text-based command output is fragile and locale-dependent

**Traditional approach at 20M nodes:**
- 2 seconds per node × 20M = **46 days** for single discovery pass
- String concatenation creates O(n²) memory complexity
- Pipe failures produce corrupt data with no error indication
- No recovery from transient network failures

### The Solution

rebe-shell provides:

1. **WASM isolation** - Safe command preview and sandboxed execution
2. **Structured APIs** - No text parsing, typed data structures
3. **Streaming architecture** - Constant memory usage, backpressure control
4. **Fault tolerance** - Timeouts, retries, circuit breakers
5. **Parallel execution** - 100+ concurrent workers per agent
6. **Cross-platform** - Same binary, plugins, and config on Mac/Windows/Linux
7. **User-friendly** - Claude Code integration for AI-assisted workflows

**rebe-shell at 20M nodes:**
- 100 parallel workers × 2000 regional agents = 200K concurrent operations
- **20M nodes in 100 seconds** (not 46 days)
- Structured data eliminates parsing failures
- Automatic retry on transient failures
- WASM sandbox prevents destructive command accidents

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    rebe-shell (Tauri/Rust)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Frontend (WebView)                                      │ │
│  │  ├─ xterm.js (Terminal UI)                             │ │
│  │  ├─ React/Solid.js (Configuration UI)                  │ │
│  │  └─ WASM modules (plugins, themes)                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Rust Backend                                            │ │
│  │  ├─ PTY Manager (native shell execution)               │ │
│  │  ├─ SSH Connection Pool (multiplexed, reused)          │ │
│  │  ├─ WASM Runtime (Wasmtime - sandboxed execution)      │ │
│  │  ├─ Streaming Output Handler (no string concat)        │ │
│  │  ├─ Circuit Breaker Registry (fault tolerance)         │ │
│  │  ├─ Work Queue (parallel execution)                    │ │
│  │  └─ Command Protocol (structured JSON API)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Execution Modes                                         │ │
│  │  ├─ Native (full system access via PTY)                │ │
│  │  ├─ WASM Sandbox (read-only, safe preview)             │ │
│  │  ├─ Remote SSH (connection-pooled, timeout-protected)  │ │
│  │  └─ Hybrid (WASM + explicit permissions)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Hierarchical Orchestration (20M+ nodes)

```
┌─────────────────────────────────────────────────────────┐
│ Global Orchestration Coordinator                        │
│ - Assigns work to regional agents                       │
│ - Aggregates realm-wide statistics                      │
│ - Capacity planning and resource optimization           │
└────────────────────┬────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼─────┐  ┌─────▼────┐  ┌──────▼─────┐
│ Regional │  │ Regional │  │ Regional   │
│ Agent    │  │ Agent    │  │ Agent      │
│ (US)     │  │ (EU)     │  │ (APAC)     │
│          │  │          │  │            │
│ 10K nodes│  │ 10K nodes│  │ 10K nodes  │
│ 100      │  │ 100      │  │ 100        │
│ workers  │  │ workers  │  │ workers    │
└──────────┘  └──────────┘  └────────────┘
```

## Core Beliefs & Philosophy

### 1. Reliability Through Structure

**Belief**: Text parsing is inherently unreliable for autonomous systems.

**Implementation**: All commands return structured data (JSON/typed structures), not text to be parsed.

```rust
// ❌ Old way: Brittle text parsing
let output = exec("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2")?;
let model = output.split(":").nth(1).ok_or("parse error")?;

// ✅ New way: Structured API
let cpu_info: CpuInfo = system::get_cpu_info()?;
println!("Model: {}", cpu_info.model_name);
```

### 2. Safety Through Isolation

**Belief**: Destructive commands should be previewable before execution.

**Implementation**: WASM sandbox allows dry-run mode with read-only filesystem.

```rust
// User types: rm -rf /data
// rebe-shell:
match analyze_command(cmd) {
    Risk::Destructive => {
        // Run in WASM sandbox first
        let preview = wasm_runtime.preview(cmd)?;
        show_diff_to_user(preview);
        if user_confirms() {
            pty.execute(cmd)?;  // Then run natively
        }
    }
    Risk::Safe => pty.execute(cmd)?,
}
```

### 3. Scalability Through Parallelism

**Belief**: Serial execution is a non-starter for millions of nodes.

**Implementation**: Work queue with parallel workers and connection pooling.

```rust
let work_queue = WorkQueue::new(nodes);
let workers = (0..100).map(|_| {
    tokio::spawn(async move {
        while let Some(node) = work_queue.pop().await {
            execute_with_retry(node).await?;
        }
        Ok(())
    })
});
futures::future::join_all(workers).await
```

### 4. Resilience Through Redundancy

**Belief**: Every external operation will fail eventually. Design for it.

**Implementation**: Timeout + retry + circuit breaker pattern.

```rust
pub async fn execute_with_resilience<F, T>(
    operation: F,
    policy: ResiliencePolicy,
) -> Result<T>
where
    F: Fn() -> Future<Output = Result<T>>,
{
    let mut circuit_breaker = CircuitBreaker::new(policy.failure_threshold);

    for attempt in 1..=policy.max_retries {
        if circuit_breaker.is_open() {
            return Err(Error::CircuitBreakerOpen);
        }

        match timeout(policy.timeout, operation()).await {
            Ok(Ok(result)) => {
                circuit_breaker.record_success();
                return Ok(result);
            }
            Ok(Err(e)) | Err(_) => {
                circuit_breaker.record_failure();
                if attempt < policy.max_retries {
                    sleep(policy.backoff_duration(attempt)).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
}
```

### 5. Accessibility Through Abstraction

**Belief**: Non-technical users should never see error codes or stack traces.

**Implementation**: Plain English feedback via Claude Code integration.

```rust
// Technical error
Error: ECONNREFUSED 10.20.31.5:22

// User sees
"⚠️ Could not connect to server at 10.20.31.5
   The server may be offline or the network is unreachable.

   What would you like to do?
   1. Retry in 30 seconds
   2. Skip this server
   3. Stop the operation"
```

## Purpose & Intentions

### Primary Purpose

Enable technically illiterate users to manage complex infrastructure through natural language intent, executed by autonomous robot agents with 100% reliability.

### Design Intentions

1. **Cognitive Capture**: Every design decision, tradeoff, and rationale is documented
2. **Artifact Preservation**: All code, configs, and documentation versioned together
3. **Consequence Awareness**: Document the aftermath of architectural choices
4. **Capability Evolution**: Track what the system can and cannot do over time
5. **Utility Optimization**: Measure and improve real-world usefulness
6. **Belief Transparency**: Make assumptions explicit and challengeable

### User Stories

**Story 1: Cross-platform Developer**
> "I work on Mac, Windows, and Linux. I want identical terminal functionality and plugins across all systems without maintaining separate configs."

**Story 2: reBe Infrastructure Owner**
> "I don't know what SSH is. I just want to tell my robots 'make sure all servers have Docker' and have it happen safely and automatically."

**Story 3: Robot Developer**
> "I'm building the TrueNAS robot. I need to execute hundreds of API calls and SSH commands across dozens of storage servers, with automatic retry on failures and validation of every change."

**Story 4: Security Engineer**
> "Before running this deployment script from the internet, I want to see exactly what it will do to my filesystem without actually doing it."

**Story 5: Platform Architect**
> "I need to discover the state of 20 million nodes every 5 minutes and aggregate the results for capacity planning, without melting my infrastructure."

## Capabilities (Current & Planned)

### Phase 1: Foundation (Weeks 1-2) ✨ IN PROGRESS
- [ ] Tauri app with native PTY support
- [ ] Basic xterm.js terminal UI
- [ ] SSH connection pool with timeout
- [ ] Streaming output handler (no string concatenation)
- [ ] WASM runtime integration (Wasmtime)
- [ ] Simple plugin system

### Phase 2: Reliability (Weeks 3-6)
- [ ] Circuit breaker pattern
- [ ] Exponential backoff retry logic
- [ ] Command timeout mechanism
- [ ] Health check system
- [ ] Structured command protocol (JSON API)
- [ ] Error translation to plain English

### Phase 3: Scale (Weeks 7-14)
- [ ] Parallel execution engine (100+ workers)
- [ ] Work queue (Redis or in-memory)
- [ ] Connection multiplexing (SSH ControlMaster)
- [ ] Regional agent architecture
- [ ] Distributed coordination
- [ ] Time-series result storage

### Phase 4: User Experience (Weeks 15-18)
- [ ] Claude Code native integration
- [ ] Command preview/explanation UI
- [ ] Automatic error recovery
- [ ] Rollback mechanism
- [ ] WASM sandbox with diff preview
- [ ] Plugin marketplace

### Phase 5: Orchestration (Weeks 19-24)
- [ ] Robot agent SDK
- [ ] Multi-node workflow engine
- [ ] Policy enforcement (pre-flight checks)
- [ ] Audit trail and compliance logging
- [ ] Real-time monitoring dashboard
- [ ] Capacity planning analytics

## Utility & Consequences

### Utility Delivered

**For Individual Users:**
- Single terminal works identically on all platforms
- AI-powered command assistance
- Safe preview of dangerous operations
- Portable configuration via WASM plugins

**For reBe Robot Army:**
- 100x faster infrastructure discovery (100s vs 46 days)
- Zero data loss from pipe failures
- Automatic recovery from transient failures
- Scales to planetary infrastructure (20M+ nodes)

**For Platform Operators:**
- Structured data enables analytics
- Audit trail for compliance
- Policy enforcement prevents mistakes
- Distributed architecture scales horizontally

### Consequences & Tradeoffs

**Positive Consequences:**
1. **Reliability**: Structured APIs eliminate 90%+ of parsing failures
2. **Performance**: Parallel execution enables million-node operations
3. **Safety**: WASM sandbox prevents destructive command accidents
4. **Maintainability**: WASM plugins allow community contributions

**Negative Consequences:**
1. **Complexity**: More sophisticated than simple bash script
2. **Learning Curve**: Plugin authors must understand WASM
3. **Binary Size**: Tauri + WASM runtime = ~30-50MB (vs ~5MB for Alacritty)
4. **Maturity**: New codebase vs battle-tested terminals

**Acceptable Tradeoffs:**
- Accept larger binary size for cross-platform reliability
- Accept WASM learning curve for safety and portability
- Accept initial complexity for long-term scalability
- Accept new codebase risk for architectural correctness

## Getting Started

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js (for frontend)
# Visit https://nodejs.org/

# Install Tauri CLI
cargo install tauri-cli
```

### Build & Run

```bash
# Clone repository
git clone <repo-url>
cd rebe-shell

# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

### Architecture Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture and design patterns
- [VISION.md](./VISION.md) - Long-term vision and strategic direction
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide and contribution workflow
- [DECISIONS.md](./docs/DECISIONS.md) - Architecture decision records (ADRs)

## Project Status

**Current Phase**: Foundation (Phase 1)
**Development Model**: Active prototyping
**Stability**: Pre-alpha, API will change
**Production Ready**: No (Target: Q2 2025)

## Contributing

We welcome contributions! This project values:

1. **Documentation**: Every PR should update docs to match code
2. **Testing**: Automated tests for all new functionality
3. **Cognitive Capture**: Explain WHY, not just WHAT
4. **User Focus**: Keep technically illiterate users in mind

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed contribution guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Acknowledgments

Built on the shoulders of giants:
- [Tauri](https://tauri.app/) - Cross-platform app framework
- [Wasmtime](https://wasmtime.dev/) - WASM runtime
- [xterm.js](https://xtermjs.org/) - Terminal UI
- [ssh2](https://docs.rs/ssh2/) - SSH client library
- [tokio](https://tokio.rs/) - Async runtime

---

**Last Updated**: 2025-10-20
**Version**: 0.1.0-alpha
**Maintainers**: reBe Infrastructure Team
