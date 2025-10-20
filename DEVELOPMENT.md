# Development Guide

**How to contribute to rebe-shell.**

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Code Style](#code-style)
6. [Documentation](#documentation)
7. [Pull Request Process](#pull-request-process)
8. [Release Process](#release-process)

---

## Getting Started

### Prerequisites

**Required**:
```bash
# Rust (latest stable)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (18+ LTS)
# Download from https://nodejs.org/

# Tauri CLI
cargo install tauri-cli
```

**Optional**:
```bash
# cargo-watch (auto-rebuild on file changes)
cargo install cargo-watch

# cargo-audit (security vulnerability scanner)
cargo install cargo-audit

# wasm-pack (for building WASM plugins)
cargo install wasm-pack
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/rebe-shell.git
cd rebe-shell

# Install JavaScript dependencies
npm install

# Build Rust backend
cargo build

# Run in development mode
cargo tauri dev
```

---

## Project Structure

```
rebe-shell/
├── src/                      # Frontend (JavaScript/TypeScript)
│   ├── components/           # React components
│   ├── hooks/                # Custom React hooks
│   ├── terminal/             # xterm.js integration
│   └── main.tsx              # Application entry point
│
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── main.rs           # Tauri application entry
│   │   ├── pty/              # PTY manager module
│   │   ├── ssh/              # SSH connection pool
│   │   ├── wasm/             # WASM runtime
│   │   ├── stream/           # Streaming output handler
│   │   ├── circuit_breaker/  # Fault tolerance
│   │   └── protocol/         # Command protocol
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
│
├── plugins/                  # WASM plugin examples
│   ├── prompt-enhancer/      # Custom prompt plugin
│   └── system-monitor/       # System metrics plugin
│
├── docs/                     # Additional documentation
│   ├── DECISIONS.md          # Architecture decision records
│   ├── API.md                # API documentation
│   └── PLUGINS.md            # Plugin development guide
│
├── tests/                    # Integration tests
├── benchmarks/               # Performance benchmarks
├── README.md                 # Project overview
├── ARCHITECTURE.md           # Technical architecture
├── VISION.md                 # Long-term vision
├── DEVELOPMENT.md            # This file
└── LICENSE                   # MIT license
```

---

## Development Workflow

### Daily Development

```bash
# Start development mode (hot reload)
cargo tauri dev

# In separate terminal: watch Rust tests
cargo watch -x test

# Run specific test
cargo test test_name -- --nocapture

# Check code without building
cargo check

# Format code
cargo fmt

# Lint code
cargo clippy -- -D warnings
```

### Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write tests first (TDD)**
   ```bash
   # Create test file
   touch src-tauri/src/your_module/tests.rs

   # Write failing test
   # Implement feature until test passes
   cargo test
   ```

3. **Implement feature**
   - Follow [Code Style](#code-style)
   - Update documentation
   - Add architecture decision if needed

4. **Verify changes**
   ```bash
   # Run all tests
   cargo test

   # Check for warnings
   cargo clippy -- -D warnings

   # Format code
   cargo fmt

   # Run benchmarks (if performance-critical)
   cargo bench
   ```

5. **Create pull request**
   - See [Pull Request Process](#pull-request-process)

---

## Testing

### Unit Tests

```rust
// In src-tauri/src/ssh/pool.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_connection_pool_reuse() {
        let pool = SSHPool::new(PoolConfig {
            max_connections_per_host: 10,
            idle_timeout: Duration::from_secs(300),
            connection_timeout: Duration::from_secs(10),
        });

        let host = Host {
            ip: "10.20.31.5".parse().unwrap(),
            port: 22,
            user: "test".to_string(),
            auth: Auth::Password("test".to_string()),
        };

        // First connection creates new
        let conn1 = pool.acquire(&host).await.unwrap();
        drop(conn1);

        // Second connection reuses
        let start = Instant::now();
        let conn2 = pool.acquire(&host).await.unwrap();
        let elapsed = start.elapsed();

        // Should be <100ms (not 2-3s for new connection)
        assert!(elapsed < Duration::from_millis(100));
    }
}
```

### Integration Tests

```rust
// In tests/integration/command_execution.rs

#[tokio::test]
async fn test_end_to_end_ssh_command() {
    let config = test_config();
    let shell = RebeShell::new(config).await.unwrap();

    let result = shell.execute(Command {
        type_: CommandType::SystemInfo,
        fields: vec!["hostname".to_string()],
        execution: ExecutionConfig {
            mode: ExecutionMode::SSH,
            host: Some("10.20.31.5".to_string()),
            timeout_ms: 30000,
            retry_policy: RetryPolicy::default(),
        },
    }).await.unwrap();

    assert_eq!(result.status, "success");
    assert!(result.data.contains_key("hostname"));
}
```

### Running Tests

```bash
# All tests
cargo test

# Unit tests only
cargo test --lib

# Integration tests only
cargo test --test integration

# Specific test
cargo test test_connection_pool_reuse

# With output (see println!)
cargo test -- --nocapture

# With coverage (requires tarpaulin)
cargo tarpaulin --out Html
```

---

## Code Style

### Rust

**Follow Rust conventions**:
```rust
// ✅ Good: Descriptive names, clear types
pub struct SSHConnection {
    session: ssh2::Session,
    last_used: Instant,
    in_use: bool,
}

impl SSHConnection {
    /// Creates a new SSH connection to the specified host.
    ///
    /// # Arguments
    /// * `host` - The host to connect to
    /// * `timeout` - Connection timeout duration
    ///
    /// # Returns
    /// A new connection or an error if connection fails
    pub async fn connect(host: &Host, timeout: Duration) -> Result<Self> {
        // Implementation
    }
}

// ❌ Bad: Unclear names, missing docs
pub struct Conn {
    s: ssh2::Session,
    t: Instant,
    u: bool,
}
```

**Error Handling**:
```rust
// ✅ Good: Use Result, provide context
pub async fn execute_command(cmd: &str) -> Result<Output> {
    let conn = self.acquire_connection()
        .await
        .context("Failed to acquire SSH connection")?;

    let output = conn.exec_with_timeout(cmd, TIMEOUT)
        .await
        .context(format!("Failed to execute command: {}", cmd))?;

    Ok(output)
}

// ❌ Bad: Unwrap, no context
pub async fn execute_command(cmd: &str) -> Output {
    let conn = self.acquire_connection().await.unwrap();
    conn.exec_with_timeout(cmd, TIMEOUT).await.unwrap()
}
```

**Async Functions**:
```rust
// ✅ Good: Explicit cancellation handling
pub async fn execute_with_cancel(
    cmd: &str,
    cancel_token: CancellationToken,
) -> Result<Output> {
    tokio::select! {
        result = self.execute(cmd) => result,
        _ = cancel_token.cancelled() => {
            Err(Error::Cancelled)
        }
    }
}
```

### TypeScript

**React Components**:
```typescript
// ✅ Good: Typed props, clear interface
interface TerminalProps {
  sessionId: string;
  onCommand: (cmd: string) => Promise<void>;
  theme: TerminalTheme;
}

export const Terminal: React.FC<TerminalProps> = ({
  sessionId,
  onCommand,
  theme
}) => {
  // Component implementation
};

// ❌ Bad: Any types, unclear props
export const Terminal = (props: any) => {
  // Implementation
};
```

### Formatting

```bash
# Rust (automatic via rustfmt)
cargo fmt

# TypeScript/JavaScript (via Prettier)
npm run format
```

### Linting

```bash
# Rust (Clippy)
cargo clippy -- -D warnings

# TypeScript (ESLint)
npm run lint
```

---

## Documentation

### Code Documentation

**Every public API must be documented**:

```rust
/// Executes a command with automatic retry and timeout.
///
/// This function will attempt to execute the command up to `max_attempts`
/// times, with exponential backoff between attempts. Each attempt is
/// subject to the specified timeout.
///
/// # Arguments
/// * `command` - The command to execute
/// * `policy` - Retry policy configuration
///
/// # Returns
/// The command output on success, or an error if all attempts fail.
///
/// # Errors
/// Returns `Error::Timeout` if the command exceeds the timeout duration.
/// Returns `Error::MaxRetriesExceeded` if all retry attempts fail.
///
/// # Examples
/// ```
/// let policy = RetryPolicy {
///     max_attempts: 3,
///     timeout: Duration::from_secs(30),
///     backoff: BackoffStrategy::Exponential { base_ms: 1000 },
/// };
///
/// let output = execute_with_retry("ls -la", policy).await?;
/// println!("Output: {}", output);
/// ```
pub async fn execute_with_retry(
    command: &str,
    policy: RetryPolicy,
) -> Result<Output> {
    // Implementation
}
```

### Architecture Decisions

**Document significant decisions in `docs/DECISIONS.md`**:

```markdown
## ADR-001: Use WASM for Command Preview

**Date**: 2025-10-20
**Status**: Accepted

### Context
Users need to preview destructive commands before execution. Native execution
provides no isolation and could cause actual damage during preview.

### Decision
Use WebAssembly (WASM) with Wasmtime for command preview. WASM provides:
- Filesystem isolation (readonly snapshot)
- CPU time limits (prevent infinite loops)
- No network access (prevent data exfiltration)

### Consequences
**Positive**:
- Safe preview of any command
- Cross-platform portability
- Plugin ecosystem opportunity

**Negative**:
- Increased complexity
- ~20-30MB binary size increase
- Learning curve for plugin authors

### Alternatives Considered
1. **Docker containers**: Too heavy (500MB+), requires Docker daemon
2. **chroot jails**: Unix-only, root required, less isolated
3. **No preview**: Unacceptable for autonomous systems
```

### Inline Comments

```rust
// ✅ Good: Explain WHY, not WHAT
// Use exponential backoff to avoid thundering herd problem
// when many clients retry simultaneously after a transient failure
let delay = base_delay * 2_u32.pow(attempt);

// ❌ Bad: Obvious WHAT
// Multiply base_delay by 2 to the power of attempt
let delay = base_delay * 2_u32.pow(attempt);
```

---

## Pull Request Process

### Before Creating PR

1. **Update documentation**
   - [ ] Code comments for public APIs
   - [ ] README if user-facing changes
   - [ ] ARCHITECTURE if design changes
   - [ ] Create ADR if significant decision

2. **Write tests**
   - [ ] Unit tests for new functions
   - [ ] Integration tests for new features
   - [ ] Benchmarks for performance-critical code

3. **Verify quality**
   ```bash
   cargo test              # All tests pass
   cargo clippy -- -D warnings  # No warnings
   cargo fmt               # Code formatted
   cargo audit             # No vulnerabilities
   ```

### PR Template

```markdown
## Description
Brief description of changes.

## Motivation
Why is this change necessary? What problem does it solve?

## Changes
- Bullet list of specific changes

## Testing
How was this tested?
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Documentation
- [ ] Code comments added
- [ ] README updated (if needed)
- [ ] ARCHITECTURE updated (if needed)
- [ ] ADR created (if significant decision)

## Checklist
- [ ] Tests pass locally
- [ ] No clippy warnings
- [ ] Code formatted (cargo fmt)
- [ ] No security vulnerabilities (cargo audit)
```

### Review Process

1. **Automated checks must pass**:
   - CI build succeeds
   - All tests pass
   - No clippy warnings
   - Code coverage ≥ 80%

2. **At least one approving review** required

3. **Documentation review**:
   - Code is well-documented
   - Architecture decisions explained
   - User-facing changes documented

4. **Squash and merge** (clean git history)

---

## Release Process

### Versioning

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features, backward compatible (e.g., 1.0.0 → 1.1.0)
- **PATCH**: Bug fixes, backward compatible (e.g., 1.0.0 → 1.0.1)

### Release Checklist

1. **Update version numbers**
   - [ ] `src-tauri/Cargo.toml`
   - [ ] `src-tauri/tauri.conf.json`
   - [ ] `package.json`

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.2.0] - 2025-10-25

   ### Added
   - SSH connection pooling for 200x faster operations
   - WASM sandbox for command preview

   ### Changed
   - Improved error messages (now plain English)

   ### Fixed
   - Memory leak in streaming output handler
   ```

3. **Create release branch**
   ```bash
   git checkout -b release/v1.2.0
   git commit -am "Bump version to 1.2.0"
   git push origin release/v1.2.0
   ```

4. **Run full test suite**
   ```bash
   cargo test --release
   cargo bench
   ```

5. **Build release artifacts**
   ```bash
   cargo tauri build
   # Generates:
   # - macOS: .dmg
   # - Windows: .msi
   # - Linux: .AppImage, .deb
   ```

6. **Create GitHub release**
   - Tag: `v1.2.0`
   - Title: `rebe-shell v1.2.0`
   - Description: Copy from CHANGELOG.md
   - Attach build artifacts

7. **Update documentation site** (future)

---

## Development Tips

### Debugging

```rust
// Enable debug logs
RUST_LOG=debug cargo tauri dev

// Specific module logging
RUST_LOG=rebe_shell::ssh=debug cargo tauri dev

// Use dbg! macro (remember to remove before commit)
dbg!(&connection_pool.stats());
```

### Performance Profiling

```bash
# CPU profiling with flamegraph
cargo install flamegraph
cargo flamegraph --bin rebe-shell

# Memory profiling with heaptrack
heaptrack cargo run --release
heaptrack_gui heaptrack.rebe-shell.*.gz
```

### Benchmarking

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench ssh_pool

# Compare before/after
cargo bench --baseline before
# Make changes
cargo bench --baseline after
```

---

## Getting Help

- **Documentation**: Start with [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Issues**: Check [GitHub Issues](https://github.com/your-org/rebe-shell/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/rebe-shell/discussions)
- **Chat**: Discord server (link TBD)

---

**Document Status**: Living document
**Last Updated**: 2025-10-20
**Next Review**: Monthly
