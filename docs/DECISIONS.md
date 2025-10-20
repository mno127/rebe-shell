# Architecture Decision Records (ADRs)

**Key architectural decisions and their rationale.**

## Format

Each ADR follows this structure:
- **Date**: When the decision was made
- **Status**: Proposed | Accepted | Rejected | Deprecated | Superseded
- **Context**: What is the issue we're facing?
- **Decision**: What we decided to do
- **Consequences**: What happens as a result (positive and negative)
- **Alternatives Considered**: What other options were evaluated

---

## ADR-001: Use Tauri Instead of Electron

**Date**: 2025-10-20
**Status**: Accepted

### Context

Need a cross-platform desktop framework to build rebe-shell terminal application. Primary candidates:
- Electron (Chromium + Node.js)
- Tauri (WebView + Rust)

Requirements:
- Cross-platform (Mac, Windows, Linux)
- Native system access (PTY, SSH, filesystem)
- Small binary size
- Security (sandboxing, permissions)

### Decision

Use Tauri for the desktop application framework.

### Consequences

**Positive**:
- **Small binaries**: 3-10MB (vs 100-200MB for Electron)
- **Memory efficient**: Uses native WebView instead of bundling Chromium
- **Rust backend**: Memory safety, performance, modern async ecosystem
- **Security**: Built-in capability system, isolated WebView
- **Active development**: Growing ecosystem, good documentation

**Negative**:
- **Newer ecosystem**: Fewer libraries/examples than Electron
- **WebView differences**: Must test on all platforms (Safari WebKit on Mac, Edge WebView2 on Windows)
- **Learning curve**: Team must learn Rust if coming from JavaScript
- **Plugin compatibility**: Node.js plugins won't work directly

### Alternatives Considered

**Electron**:
- ✅ Mature ecosystem, many examples
- ✅ Node.js familiar to JavaScript developers
- ❌ Large binary size (~100-200MB)
- ❌ High memory usage (full Chromium)
- ❌ Security issues (node integration risks)

**Native (Qt/GTK)**:
- ✅ Smallest binary, best performance
- ❌ Must maintain 3 separate codebases
- ❌ Limited web tech support (no xterm.js)

---

## ADR-002: Use WASM for Command Preview Sandbox

**Date**: 2025-10-20
**Status**: Accepted

### Context

Users (especially autonomous robots) need to preview destructive commands before execution. Requirements:
- Filesystem isolation (read-only)
- No network access
- CPU/memory limits
- Cross-platform

### Decision

Use WebAssembly (WASM) with Wasmtime runtime for command preview sandbox.

### Consequences

**Positive**:
- **Filesystem isolation**: Snapshot-based readonly filesystem, commands see changes without affecting real system
- **Security**: Capability-based security model, no access by default
- **CPU limits**: Fuel mechanism prevents infinite loops
- **Cross-platform**: Same WASM binary runs on Mac/Win/Linux
- **Plugin ecosystem**: Opens door for user-written plugins in any language (Rust, Go, C++)
- **Performance**: Near-native speed (~95% of native)

**Negative**:
- **Binary size**: +20-30MB for Wasmtime runtime
- **Complexity**: WASM toolchain learning curve for plugin authors
- **Limitations**: Some OS operations not available in sandbox
- **Maturity**: WASI (WASM System Interface) still evolving

### Alternatives Considered

**Docker containers**:
- ✅ Strong isolation
- ❌ Requires Docker daemon (~500MB)
- ❌ Slow startup (~1-2s per container)
- ❌ Not available by default on all systems

**chroot jails**:
- ✅ Lightweight
- ❌ Unix-only (not Windows)
- ❌ Requires root privileges
- ❌ Weak isolation (can escape with effort)

**VM (firecracker/gVisor)**:
- ✅ Strong isolation
- ❌ Too heavy for simple command preview
- ❌ Complex setup

**No sandbox (just parse AST)**:
- ✅ Simple
- ❌ Cannot preview complex scripts
- ❌ Doesn't handle dynamic behavior

---

## ADR-003: Structured Command Protocol Over Text Parsing

**Date**: 2025-10-20
**Status**: Accepted

### Context

Current reBe infrastructure uses text-based command output with complex parsing:
```javascript
const cpuinfo = await exec('cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2');
```

Problems:
- Brittle (breaks on format changes)
- Locale-dependent (different languages)
- Silent failures (empty string if grep finds nothing)
- No validation

### Decision

Define structured JSON-based command protocol with typed request/response schemas.

**Request**:
```json
{
  "type": "system_info",
  "fields": ["cpu_info", "memory_info"],
  "execution": { "mode": "ssh", "host": "10.20.31.5" }
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "cpu_info": { "model": "AMD EPYC 7543", "cores": 32 }
  }
}
```

### Consequences

**Positive**:
- **Type safety**: Validation at compile time and runtime
- **No parsing**: Direct deserialization to structs
- **Locale-independent**: Not affected by language settings
- **Explicit errors**: Failed field = explicit error, not empty string
- **Versioning**: Protocol version in every message
- **Testability**: Easy to mock, validate schemas

**Negative**:
- **Legacy compatibility**: Must provide adapters for text-based tools
- **Development overhead**: Must define schemas for all commands
- **Binary size**: JSON parsing library adds ~100KB

### Alternatives Considered

**Continue text parsing**:
- ✅ Works with all existing tools
- ❌ Fundamentally unreliable (breaks silently)

**Binary protocol (Protocol Buffers/FlatBuffers)**:
- ✅ Smaller, faster than JSON
- ❌ Less human-readable
- ❌ Requires code generation
- Decision: JSON for v1, can add binary later

**GraphQL**:
- ✅ Flexible querying
- ❌ Overkill for point-to-point communication
- ❌ Large runtime overhead

---

## ADR-004: SSH Connection Pooling with Tokio

**Date**: 2025-10-20
**Status**: Accepted

### Context

Current serial SSH execution spends 80-90% of time in connection handshakes:
- SSH handshake: 2-3 seconds
- Command execution: 100-500ms
- Result: ~85% wasted time

At scale (20M nodes), this is **completely unacceptable**.

### Decision

Implement SSH connection pool that:
1. Reuses connections across commands
2. Maintains max N connections per host
3. Expires idle connections after timeout
4. Uses async I/O (Tokio)

### Consequences

**Positive**:
- **200-300x faster**: 10ms vs 2-3s per command
- **Concurrent operations**: Support 1000+ simultaneous connections
- **Resource efficiency**: Shared connections reduce server load
- **Automatic cleanup**: Idle connections expire, no manual management

**Negative**:
- **Complexity**: Must handle connection failures, timeouts, cleanup
- **Memory usage**: ~50KB per pooled connection
- **State management**: Must track in-use vs idle connections
- **Testing**: Concurrent code is harder to test

### Alternatives Considered

**OpenSSH ControlMaster**:
- ✅ Battle-tested, zero code
- ❌ Requires external ssh binary
- ❌ Platform-specific (Unix-only)
- ❌ Hard to monitor/control programmatically

**No pooling (connect per command)**:
- ✅ Simplest implementation
- ❌ Unacceptably slow at scale

---

## ADR-005: Streaming Output Handler (No String Concatenation)

**Date**: 2025-10-20
**Status**: Accepted

### Context

Current output capture uses string concatenation:
```javascript
let stdout = '';
stream.on('data', (data) => {
  stdout += data.toString();  // O(n²) complexity!
});
```

For 10MB output:
- Creates ~10,000 intermediate strings
- Allocates ~50GB total memory (copies on copies)
- Result: O(n²) memory complexity

### Decision

Use buffer array with single final concatenation:

```rust
let mut chunks = Vec::new();
while let Some(chunk) = stream.next().await {
    chunks.push(chunk);
}
let output = chunks.concat();  // Single allocation
```

### Consequences

**Positive**:
- **O(n) instead of O(n²)**: Linear memory usage
- **Memory savings**: 99%+ reduction for large outputs
- **Backpressure**: Can pause stream if buffer too large
- **Binary support**: Works with non-UTF8 data

**Negative**:
- **Slightly more code**: Must manage Vec instead of String
- **Final allocation**: Still needs to allocate full output at end

### Alternatives Considered

**Ring buffer with streaming consumer**:
- ✅ True constant memory
- ❌ Requires redesign of output consumption
- Decision: Future optimization if needed

**Memory-mapped file**:
- ✅ Handles unlimited output
- ❌ Disk I/O overhead
- ❌ Cleanup complexity

---

## ADR-006: Circuit Breaker Pattern for Fault Tolerance

**Date**: 2025-10-20
**Status**: Accepted

### Context

When a host is down, we continue trying to connect repeatedly:
```javascript
for (const node of nodes) {
  await discover(node);  // Hangs for 30s if node offline
}
```

Result: Cascading failures, wasted time.

### Decision

Implement circuit breaker pattern:
- **Closed** (normal): Allow operations
- **Open** (failing): Reject immediately, no waiting
- **Half-Open** (testing): Try one operation to check recovery

### Consequences

**Positive**:
- **Fast failure**: Detect problems in seconds, not minutes
- **Prevent cascade**: Don't waste resources on failing hosts
- **Automatic recovery**: Periodically test if host recovered
- **User feedback**: "Host X is unavailable" immediately

**Negative**:
- **False positives**: Transient failures may open circuit too quickly
- **Configuration**: Must tune thresholds for different scenarios
- **Complexity**: More state to manage and test

### Alternatives Considered

**No circuit breaker (retry forever)**:
- ✅ Eventually succeeds if host recovers
- ❌ Wastes resources on down hosts
- ❌ Slow to detect permanent failures

**Static blacklist**:
- ✅ Simple
- ❌ No automatic recovery
- ❌ Manual intervention required

---

## ADR-007: Exponential Backoff for Retry Logic

**Date**: 2025-10-20
**Status**: Accepted

### Context

Network operations fail transiently. Need retry strategy that:
- Doesn't overwhelm servers (thundering herd)
- Eventually gives up (don't retry forever)
- Recovers quickly if transient

### Decision

Use exponential backoff: delay = base_delay × 2^attempt

Example:
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds (give up)

### Consequences

**Positive**:
- **Avoids thundering herd**: Clients retry at different times
- **Fast recovery**: Transient failures recover in ~1s
- **Bounded time**: Max retry time is predictable
- **Industry standard**: Well-understood pattern

**Negative**:
- **Longer recovery**: Permanent failures take ~15s to detect
- **Configuration**: Must choose max attempts, base delay

### Alternatives Considered

**Fixed retry interval**:
- ✅ Simpler
- ❌ Thundering herd problem

**Linear backoff**:
- ✅ More predictable timing
- ❌ Still causes thundering herd

**Jittered exponential backoff**:
- ✅ Even better distribution
- Decision: Add jitter in future if needed

---

## ADR-008: Rust for Backend, TypeScript for Frontend

**Date**: 2025-10-20
**Status**: Accepted

### Context

Need to choose languages for:
- Backend: System integration, SSH, WASM runtime
- Frontend: Terminal UI, settings

### Decision

- **Backend**: Rust
- **Frontend**: TypeScript + React

### Consequences

**Backend (Rust)**:

**Positive**:
- **Memory safety**: No segfaults, data races
- **Performance**: Zero-cost abstractions, compiled
- **Async ecosystem**: Tokio, async-ssh, etc.
- **WASM support**: First-class WASM tooling
- **Type safety**: Catch bugs at compile time

**Negative**:
- **Learning curve**: Borrow checker, lifetimes
- **Compile times**: 1-2 minutes for full rebuild
- **Ecosystem gaps**: Some libraries immature

**Frontend (TypeScript)**:

**Positive**:
- **Type safety**: Catch errors before runtime
- **Rich ecosystem**: xterm.js, React, mature libraries
- **Developer experience**: Hot reload, familiar tools
- **Team familiarity**: More developers know JS than Rust

**Negative**:
- **Runtime errors**: Type system has gaps
- **Performance**: Not as fast as native

### Alternatives Considered

**Go backend**:
- ✅ Simpler than Rust
- ❌ No WASM support
- ❌ Less safe (null pointers, data races)

**C++ backend**:
- ✅ Maximum performance
- ❌ No memory safety
- ❌ Harder to maintain

**Full Rust (including UI)**:
- ✅ Single language
- ❌ Immature UI ecosystem
- ❌ Longer development time

---

## ADR-009: PTY via portable-pty Crate

**Date**: 2025-10-20
**Status**: Accepted

### Context

Need to spawn shells (bash, zsh, fish) with bidirectional I/O. Platform differences:
- Unix: POSIX PTY (`posix_openpt`, `grantpt`, `unlockpt`)
- Windows: ConPTY (Windows 10 1809+)

### Decision

Use `portable-pty` crate which abstracts platform differences.

### Consequences

**Positive**:
- **Cross-platform**: Same API for Unix and Windows
- **Well-tested**: Used by WezTerm terminal
- **Feature-complete**: Resize, colors, raw mode
- **Maintained**: Active development

**Negative**:
- **Dependency**: Relies on external crate
- **Windows limitation**: Requires Win10 1809+ (released 2018)

### Alternatives Considered

**Custom PTY implementation**:
- ✅ Full control
- ❌ Must maintain platform-specific code
- ❌ High complexity, easy to get wrong

**nix crate (Unix only)**:
- ✅ Thin wrapper over libc
- ❌ Doesn't support Windows

---

## ADR-010: xterm.js for Terminal Emulation

**Date**: 2025-10-20
**Status**: Accepted

### Context

Need browser-based terminal emulator for Tauri WebView.

### Decision

Use xterm.js library.

### Consequences

**Positive**:
- **Industry standard**: Used by VS Code, Hyper, AWS Cloud9
- **Feature-complete**: Colors, Unicode, mouse, resize
- **Addons**: Fit, WebGL renderer, search, links
- **Performance**: Handles 10K+ lines
- **Active**: Regular releases, good docs

**Negative**:
- **Bundle size**: ~200KB (acceptable)
- **DOM-based**: Slower than native rendering

### Alternatives Considered

**Custom terminal rendering**:
- ✅ Potentially faster
- ❌ Months of development
- ❌ Hard to match xterm.js features

**term.js**:
- ❌ Abandoned (last update 2016)

---

**Document Status**: Living document
**Last Updated**: 2025-10-20
**Next Review**: Weekly during active development
