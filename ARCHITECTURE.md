# rebe-shell Architecture

**Technical architecture and design patterns for the execution substrate.**

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Execution Modes](#execution-modes)
5. [Reliability Patterns](#reliability-patterns)
6. [Scalability Architecture](#scalability-architecture)
7. [Security Model](#security-model)
8. [API Design](#api-design)
9. [Performance Optimization](#performance-optimization)
10. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         rebe-shell                               │
│                    (Tauri Application)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Frontend (WebView)                        │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐│ │
│  │  │  xterm.js    │  │   React UI   │  │  WASM Plugins   ││ │
│  │  │  (Terminal)  │  │  (Settings)  │  │  (Extensions)   ││ │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘│ │
│  │         │                  │                    │         │ │
│  │         └──────────────────┼────────────────────┘         │ │
│  │                            │                              │ │
│  │                    ┌───────▼────────┐                     │ │
│  │                    │  Tauri Bridge  │                     │ │
│  │                    │  (IPC Channel) │                     │ │
│  │                    └───────┬────────┘                     │ │
│  └────────────────────────────┼──────────────────────────────┘ │
│                                │                                │
│  ┌────────────────────────────▼──────────────────────────────┐ │
│  │                   Rust Backend                            │ │
│  │                                                            │ │
│  │  ┌──────────────────┐  ┌─────────────────┐              │ │
│  │  │  Shell Core      │  │  WASM Runtime   │              │ │
│  │  │  ┌────────────┐  │  │  (Wasmtime)     │              │ │
│  │  │  │ PTY Manager│  │  │  - Sandbox      │              │ │
│  │  │  │ - zsh/bash │  │  │  - Plugins      │              │ │
│  │  │  │ - fish     │  │  │  - Preview      │              │ │
│  │  │  └────────────┘  │  └─────────────────┘              │ │
│  │  │                  │                                     │ │
│  │  │  ┌────────────┐  │  ┌─────────────────┐              │ │
│  │  │  │SSH Pool    │  │  │ Circuit Breaker │              │ │
│  │  │  │- Reuse     │  │  │ - Fault Detect  │              │ │
│  │  │  │- Multiplex │  │  │ - Auto Retry    │              │ │
│  │  │  └────────────┘  │  └─────────────────┘              │ │
│  │  │                  │                                     │ │
│  │  │  ┌────────────┐  │  ┌─────────────────┐              │ │
│  │  │  │Stream      │  │  │  Work Queue     │              │ │
│  │  │  │Handler     │  │  │  - Parallel     │              │ │
│  │  │  │- No concat │  │  │  - Priority     │              │ │
│  │  │  └────────────┘  │  └─────────────────┘              │ │
│  │  └──────────────────┘                                    │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │              Command Protocol Layer                  │ │ │
│  │  │  (Structured JSON API - no text parsing)            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- **xterm.js**: Terminal emulation (DOM-based rendering)
- **React/Solid.js**: UI framework (settings, configuration)
- **WebAssembly**: Plugin runtime (portable extensions)

**Backend**:
- **Rust**: Core application logic (memory safety, performance)
- **Tauri**: Cross-platform app framework (native APIs)
- **Wasmtime**: WASM runtime (sandboxed execution)
- **Tokio**: Async runtime (concurrency)
- **ssh2**: SSH client library (remote execution)

---

## Core Components

### 1. PTY Manager

**Purpose**: Manages pseudoterminals for native shell execution.

**Implementation**:
```rust
pub struct PtyManager {
    sessions: HashMap<SessionId, PtySession>,
    default_shell: PathBuf,
}

pub struct PtySession {
    pty: portable_pty::MasterPty,
    reader: BufReader<Box<dyn Read + Send>>,
    writer: Box<dyn Write + Send>,
}

impl PtyManager {
    pub async fn spawn(&mut self, shell: &str) -> Result<SessionId> {
        let pty_pair = portable_pty::native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })?;

        let cmd = CommandBuilder::new(shell);
        let child = pty_pair.slave.spawn_command(cmd)?;

        let session = PtySession {
            pty: pty_pair.master,
            reader: BufReader::new(child.stdout.unwrap()),
            writer: child.stdin.unwrap(),
        };

        let id = SessionId::new();
        self.sessions.insert(id, session);
        Ok(id)
    }

    pub async fn write(&mut self, id: SessionId, data: &[u8]) -> Result<()> {
        let session = self.sessions.get_mut(&id)
            .ok_or(Error::SessionNotFound)?;
        session.writer.write_all(data)?;
        Ok(())
    }

    pub async fn read(&mut self, id: SessionId) -> Result<Vec<u8>> {
        let session = self.sessions.get_mut(&id)
            .ok_or(Error::SessionNotFound)?;

        let mut buffer = Vec::new();
        session.reader.read_until(b'\n', &mut buffer)?;
        Ok(buffer)
    }
}
```

**Key Features**:
- Multiple concurrent sessions
- Shell agnostic (bash, zsh, fish, etc.)
- Platform abstraction (Unix PTY, Windows ConPTY)

---

### 2. SSH Connection Pool

**Purpose**: Reuse SSH connections to avoid handshake overhead.

**Implementation**:
```rust
pub struct SSHPool {
    connections: Arc<Mutex<HashMap<HostKey, Vec<SSHConnection>>>>,
    config: PoolConfig,
}

pub struct PoolConfig {
    max_connections_per_host: usize,
    idle_timeout: Duration,
    connection_timeout: Duration,
}

pub struct SSHConnection {
    session: ssh2::Session,
    last_used: Instant,
    in_use: bool,
}

impl SSHPool {
    pub async fn acquire(&self, host: &Host) -> Result<PooledConnection> {
        let key = HostKey::from(host);
        let mut connections = self.connections.lock().await;

        // Try to reuse existing connection
        if let Some(conns) = connections.get_mut(&key) {
            for conn in conns.iter_mut() {
                if !conn.in_use && !conn.is_expired(self.config.idle_timeout) {
                    conn.in_use = true;
                    conn.last_used = Instant::now();
                    return Ok(PooledConnection::new(conn, self.clone()));
                }
            }
        }

        // Create new connection if under limit
        let conn_list = connections.entry(key.clone()).or_insert_with(Vec::new);

        if conn_list.len() < self.config.max_connections_per_host {
            let session = self.create_connection(host).await?;
            let conn = SSHConnection {
                session,
                last_used: Instant::now(),
                in_use: true,
            };
            conn_list.push(conn);
            return Ok(PooledConnection::new(conn_list.last_mut().unwrap(), self.clone()));
        }

        // Wait for available connection
        self.wait_for_connection(key).await
    }

    async fn create_connection(&self, host: &Host) -> Result<ssh2::Session> {
        let tcp = timeout(
            self.config.connection_timeout,
            TcpStream::connect((host.ip, host.port))
        ).await??;

        let mut session = ssh2::Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        // Authenticate
        match &host.auth {
            Auth::Key(path) => {
                let key = std::fs::read(path)?;
                session.userauth_pubkey_memory(&host.user, None, &key, None)?;
            }
            Auth::Password(pw) => {
                session.userauth_password(&host.user, pw)?;
            }
        }

        Ok(session)
    }
}

// RAII wrapper that returns connection to pool on drop
pub struct PooledConnection<'a> {
    conn: &'a mut SSHConnection,
    pool: SSHPool,
}

impl Drop for PooledConnection<'_> {
    fn drop(&mut self) {
        self.conn.in_use = false;
    }
}
```

**Key Features**:
- Automatic connection reuse
- Configurable pool size per host
- Idle timeout and cleanup
- RAII pattern for safe release

**Performance Impact**:
- Without pooling: 2-3s per SSH handshake
- With pooling: ~10ms per command (200x faster)

---

### 3. Streaming Output Handler

**Purpose**: Process command output without string concatenation (O(n) not O(n²)).

**Implementation**:
```rust
pub struct StreamingOutputHandler {
    chunks: Vec<Bytes>,
    total_size: usize,
    max_size: usize,
}

impl StreamingOutputHandler {
    pub fn new(max_size: usize) -> Self {
        Self {
            chunks: Vec::new(),
            total_size: 0,
            max_size,
        }
    }

    pub fn push_chunk(&mut self, data: Bytes) -> Result<()> {
        if self.total_size + data.len() > self.max_size {
            return Err(Error::OutputTooLarge {
                max: self.max_size,
                actual: self.total_size + data.len(),
            });
        }

        self.total_size += data.len();
        self.chunks.push(data);
        Ok(())
    }

    pub fn finalize(self) -> Bytes {
        if self.chunks.len() == 1 {
            return self.chunks.into_iter().next().unwrap();
        }

        let mut output = BytesMut::with_capacity(self.total_size);
        for chunk in self.chunks {
            output.extend_from_slice(&chunk);
        }
        output.freeze()
    }
}

// Usage in command execution
pub async fn execute_command(cmd: &str) -> Result<CommandOutput> {
    let mut handler = StreamingOutputHandler::new(MAX_OUTPUT_SIZE);

    let mut stream = ssh_conn.exec(cmd)?;

    loop {
        let mut buffer = BytesMut::with_capacity(4096);
        let n = stream.read_buf(&mut buffer).await?;

        if n == 0 { break; }

        handler.push_chunk(buffer.freeze())?;
    }

    let output = handler.finalize();
    Ok(CommandOutput::from_bytes(output))
}
```

**Key Features**:
- No string concatenation (avoids O(n²))
- Backpressure control (max size limit)
- Efficient single allocation at end
- Handles binary data (not just UTF-8)

**Performance Comparison**:
```rust
// ❌ Bad: O(n²) string concatenation
let mut output = String::new();
for chunk in chunks {
    output.push_str(&chunk);  // Creates new string each time!
}

// ✅ Good: O(n) buffering
let mut chunks = Vec::new();
for chunk in chunks {
    chunks.push(chunk);  // Just stores reference
}
let output = chunks.concat();  // Single allocation
```

---

### 4. WASM Runtime

**Purpose**: Sandboxed execution for command preview and plugins.

**Implementation**:
```rust
pub struct WasmRuntime {
    engine: wasmtime::Engine,
    linker: wasmtime::Linker<WasmContext>,
}

pub struct WasmContext {
    filesystem: ReadOnlyFilesystem,
    network: NoNetwork,
    stdio: CapturedStdio,
}

impl WasmRuntime {
    pub fn new() -> Result<Self> {
        let mut config = wasmtime::Config::new();
        config.wasm_simd(true);
        config.wasm_bulk_memory(true);
        config.consume_fuel(true);  // CPU time limiting

        let engine = wasmtime::Engine::new(&config)?;
        let mut linker = wasmtime::Linker::new(&engine);

        // WASI interface with restrictions
        wasmtime_wasi::add_to_linker(&mut linker, |ctx| &mut ctx.wasi)?;

        Ok(Self { engine, linker })
    }

    pub async fn execute_preview(&self, cmd: &str) -> Result<PreviewResult> {
        let module = self.compile_command(cmd)?;

        let mut store = wasmtime::Store::new(&self.engine, WasmContext {
            filesystem: ReadOnlyFilesystem::new(),
            network: NoNetwork,
            stdio: CapturedStdio::new(),
        });

        // Limit CPU time
        store.add_fuel(1_000_000)?;  // ~1 second of execution

        let instance = self.linker.instantiate_async(&mut store, &module).await?;
        let main = instance.get_typed_func::<(), ()>(&mut store, "_start")?;

        main.call_async(&mut store, ()).await?;

        let ctx = store.data();
        Ok(PreviewResult {
            stdout: ctx.stdio.stdout().to_vec(),
            stderr: ctx.stdio.stderr().to_vec(),
            filesystem_changes: ctx.filesystem.changes(),
        })
    }
}

pub struct ReadOnlyFilesystem {
    snapshot: HashMap<PathBuf, Vec<u8>>,
    changes: Vec<FilesystemChange>,
}

pub enum FilesystemChange {
    Write { path: PathBuf, content: Vec<u8> },
    Delete { path: PathBuf },
    Mkdir { path: PathBuf },
}

impl ReadOnlyFilesystem {
    fn open(&mut self, path: &Path) -> Result<File> {
        // Return snapshot data
        self.snapshot.get(path)
            .map(|data| File::from_snapshot(data))
            .ok_or(Error::FileNotFound)
    }

    fn write(&mut self, path: &Path, data: Vec<u8>) -> Result<()> {
        // Don't actually write, just record the intent
        self.changes.push(FilesystemChange::Write {
            path: path.to_owned(),
            content: data,
        });
        Ok(())
    }

    pub fn changes(&self) -> &[FilesystemChange] {
        &self.changes
    }
}
```

**Key Features**:
- CPU time limiting (prevent infinite loops)
- Read-only filesystem (safe preview)
- No network access (prevent data exfiltration)
- Captured stdio (observe output without side effects)

**Use Case Example**:
```rust
// User types: rm -rf /data
let preview = wasm_runtime.execute_preview("rm -rf /data").await?;

// Show user what would be deleted
println!("This command would delete:");
for change in preview.filesystem_changes {
    match change {
        FilesystemChange::Delete { path } => {
            println!("  ❌ {}", path.display());
        }
        _ => {}
    }
}

// Ask for confirmation
if user_confirms() {
    pty_manager.execute_native("rm -rf /data").await?;
}
```

---

### 5. Circuit Breaker

**Purpose**: Prevent cascading failures by detecting and stopping repeated errors.

**Implementation**:
```rust
pub struct CircuitBreaker {
    state: Arc<Mutex<BreakerState>>,
    config: CircuitBreakerConfig,
}

pub struct CircuitBreakerConfig {
    failure_threshold: usize,
    success_threshold: usize,
    timeout: Duration,
}

enum BreakerState {
    Closed { failures: usize },
    Open { opened_at: Instant },
    HalfOpen { successes: usize },
}

impl CircuitBreaker {
    pub async fn call<F, T>(&self, operation: F) -> Result<T>
    where
        F: Future<Output = Result<T>>,
    {
        let mut state = self.state.lock().await;

        match &*state {
            BreakerState::Open { opened_at } => {
                if opened_at.elapsed() > self.config.timeout {
                    // Transition to half-open
                    *state = BreakerState::HalfOpen { successes: 0 };
                } else {
                    return Err(Error::CircuitBreakerOpen);
                }
            }
            _ => {}
        }

        drop(state);  // Release lock before executing

        let result = operation.await;

        let mut state = self.state.lock().await;
        match result {
            Ok(value) => {
                *state = match *state {
                    BreakerState::HalfOpen { successes } => {
                        if successes + 1 >= self.config.success_threshold {
                            BreakerState::Closed { failures: 0 }
                        } else {
                            BreakerState::HalfOpen { successes: successes + 1 }
                        }
                    }
                    _ => BreakerState::Closed { failures: 0 },
                };
                Ok(value)
            }
            Err(e) => {
                *state = match *state {
                    BreakerState::Closed { failures } => {
                        if failures + 1 >= self.config.failure_threshold {
                            BreakerState::Open { opened_at: Instant::now() }
                        } else {
                            BreakerState::Closed { failures: failures + 1 }
                        }
                    }
                    BreakerState::HalfOpen { .. } => {
                        BreakerState::Open { opened_at: Instant::now() }
                    }
                    s => s,
                };
                Err(e)
            }
        }
    }
}
```

**State Transitions**:
```
Closed (normal operation)
   │
   │ failure_threshold exceeded
   ▼
Open (reject all requests)
   │
   │ timeout elapsed
   ▼
Half-Open (test if recovered)
   │
   ├─ success_threshold reached → Closed
   └─ any failure → Open
```

**Usage**:
```rust
let breaker = CircuitBreaker::new(CircuitBreakerConfig {
    failure_threshold: 5,     // Open after 5 failures
    success_threshold: 2,     // Close after 2 successes
    timeout: Duration::from_secs(60),
});

let result = breaker.call(async {
    ssh_pool.acquire(host).await?.exec(cmd).await
}).await?;
```

---

## Data Flow

### Command Execution Flow

```
User Input → Command Parser → Risk Analyzer → Execution Router
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
              High Risk                          Low Risk
         (destructive command)                (safe command)
                    │                                 │
                    ▼                                 │
            WASM Preview                              │
                    │                                 │
            Show Diff to User                         │
                    │                                 │
           User Confirms? ────No───> Cancel          │
                    │                                 │
                   Yes                                │
                    │                                 │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                          Execution Mode?
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
                 Native        SSH        WASM
                   PTY       Remote     Sandbox
                    │            │            │
                    └────────────┼────────────┘
                                 │
                                 ▼
                        Streaming Handler
                                 │
                                 ▼
                          Output Parser
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
                  JSON         Plain       Binary
              (structured)    (text)      (raw bytes)
                    │            │            │
                    └────────────┼────────────┘
                                 │
                                 ▼
                          Terminal Display
```

### SSH Execution with Retry

```
Command Request
     │
     ▼
Circuit Breaker Check
     │
     ├─ Open → Return Error Immediately
     │
     └─ Closed/Half-Open
          │
          ▼
     Acquire SSH Connection (from pool)
          │
          ▼
     Execute with Timeout
          │
     ┌────┴────┐
     │         │
  Success   Failure
     │         │
     │         ▼
     │    Retry Logic
     │         │
     │    ┌────┴────┐
     │    │         │
     │  Retry    Give Up
     │    │         │
     │    └─────────┤
     │              │
     ▼              ▼
  Record        Record
  Success       Failure
     │              │
     └──────┬───────┘
            │
            ▼
   Return Connection to Pool
            │
            ▼
      Return Result
```

---

## Execution Modes

### 1. Native PTY Mode

**When**: Local shell commands
**How**: Direct process spawn via PTY
**Isolation**: None (full system access)

```rust
pty_manager.spawn("/bin/zsh").await?;
pty_manager.write(session_id, b"ls -la\n").await?;
let output = pty_manager.read(session_id).await?;
```

### 2. SSH Remote Mode

**When**: Remote server operations
**How**: SSH connection pool
**Isolation**: Network boundary

```rust
let conn = ssh_pool.acquire(&host).await?;
let output = conn.exec_with_timeout(cmd, Duration::from_secs(30)).await?;
```

### 3. WASM Sandbox Mode

**When**: Command preview, untrusted code
**How**: Wasmtime with WASI restrictions
**Isolation**: Full (no network, readonly FS, CPU limited)

```rust
let preview = wasm_runtime.execute_preview(cmd).await?;
println!("Would affect: {:?}", preview.filesystem_changes);
```

### 4. Hybrid Mode

**When**: Plugins with controlled access
**How**: WASM + explicit capability grants
**Isolation**: Partial (specific permissions)

```rust
let mut permissions = Permissions::none();
permissions.grant_read("/home/user/docs");
permissions.grant_write("/tmp/output");

let result = wasm_runtime.execute_with_permissions(plugin, permissions).await?;
```

---

## Reliability Patterns

### Timeout Pattern

```rust
pub async fn with_timeout<F, T>(
    operation: F,
    duration: Duration,
) -> Result<T>
where
    F: Future<Output = Result<T>>,
{
    tokio::time::timeout(duration, operation)
        .await
        .map_err(|_| Error::Timeout)?
}
```

### Retry with Exponential Backoff

```rust
pub async fn with_retry<F, T>(
    mut operation: F,
    policy: RetryPolicy,
) -> Result<T>
where
    F: FnMut() -> Future<Output = Result<T>>,
{
    let mut attempt = 1;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt >= policy.max_attempts => return Err(e),
            Err(_) => {
                let delay = policy.base_delay * 2_u32.pow(attempt - 1);
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
        }
    }
}
```

### Combined: Timeout + Retry + Circuit Breaker

```rust
pub async fn execute_with_resilience<F, T>(
    operation: F,
    config: ResilienceConfig,
) -> Result<T>
where
    F: Fn() -> Future<Output = Result<T>>,
{
    config.circuit_breaker.call(async {
        with_retry(|| {
            with_timeout(operation(), config.timeout)
        }, config.retry_policy).await
    }).await
}
```

---

## Scalability Architecture

### Single-Node Architecture (1-1000 nodes)

```
┌──────────────────────────┐
│   rebe-shell (Desktop)   │
│  ┌────────────────────┐  │
│  │  100 Workers       │  │
│  │  (Parallel Exec)   │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  SSH Pool          │  │
│  │  (Connection Reuse)│  │
│  └────────────────────┘  │
└────────┬─────────────────┘
         │
         ▼
   Target Nodes (1-1000)
```

**Performance**:
- 100 parallel workers
- 1000 nodes in ~20 seconds

### Multi-Region Architecture (1K-1M nodes)

```
┌───────────────────────────────┐
│  Global Coordinator           │
│  - Work distribution          │
│  - Result aggregation         │
└─────────┬─────────────────────┘
          │
    ┌─────┼─────┐
    │     │     │
    ▼     ▼     ▼
┌─────┐ ┌─────┐ ┌─────┐
│ US  │ │ EU  │ │APAC │
│Agent│ │Agent│ │Agent│
│     │ │     │ │     │
│100  │ │100  │ │100  │
│work │ │work │ │work │
│ers  │ │ers  │ │ers  │
└──┬──┘ └──┬──┘ └──┬──┘
   │       │       │
   ▼       ▼       ▼
10K nodes  10K     10K
per region nodes   nodes
```

**Performance**:
- 300 parallel workers (100 per region)
- 30K nodes in ~20 seconds

### Planetary Architecture (1M-20M nodes)

```
┌─────────────────────────────────────┐
│  Global Orchestration Coordinator   │
│  - Policy enforcement               │
│  - Capacity planning                │
│  - Audit trail                      │
└────────────┬────────────────────────┘
             │
     ┌───────┴───────┐
     │  Work Queue   │
     │  (Redis/NATS) │
     └───────┬───────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
┌────────┐ ┌───────┐ ┌────────┐
│Region 1│ │Region2│ │Region N│
│ (2000  │ │(2000  │ │ (2000  │
│ agents)│ │agents)│ │ agents)│
└───┬────┘ └───┬───┘ └───┬────┘
    │          │          │
    ▼          ▼          ▼
10K nodes   10K nodes  10K nodes
per agent   per agent  per agent

Total: 2000 agents × 10K nodes = 20M nodes
```

**Performance**:
- 2000 regional agents
- 100 workers per agent = 200K concurrent operations
- 20M nodes in ~100 seconds

---

## Security Model

### Principle: Defense in Depth

**Layer 1: WASM Sandbox**
- CPU time limits (prevent DoS)
- Memory limits (prevent OOM)
- No network access (prevent exfiltration)
- Readonly filesystem (prevent persistence)

**Layer 2: Capability-Based Permissions**
```rust
pub struct Capabilities {
    filesystem: FilesystemCapabilities,
    network: NetworkCapabilities,
    system: SystemCapabilities,
}

impl Capabilities {
    pub fn minimal() -> Self {
        Self {
            filesystem: FilesystemCapabilities::readonly(&["/tmp"]),
            network: NetworkCapabilities::none(),
            system: SystemCapabilities::none(),
        }
    }
}
```

**Layer 3: Command Risk Analysis**
```rust
pub fn analyze_risk(cmd: &str) -> RiskLevel {
    match cmd {
        _ if cmd.contains("rm -rf") => RiskLevel::Destructive,
        _ if cmd.contains("curl") && cmd.contains("| sh") => RiskLevel::Dangerous,
        _ if cmd.contains("sudo") => RiskLevel::Elevated,
        _ => RiskLevel::Safe,
    }
}
```

**Layer 4: Audit Trail**
```rust
pub struct AuditLog {
    timestamp: DateTime<Utc>,
    user: String,
    command: String,
    execution_mode: ExecutionMode,
    risk_level: RiskLevel,
    user_confirmed: bool,
    result: ExecutionResult,
}
```

---

## API Design

### Structured Command Protocol

```json
{
  "version": "1.0",
  "command": {
    "type": "system_info",
    "fields": ["hostname", "cpu_info", "memory_info"]
  },
  "execution": {
    "mode": "ssh",
    "host": "10.20.31.5",
    "timeout_ms": 30000,
    "retry_policy": {
      "max_attempts": 3,
      "backoff_ms": 1000
    }
  }
}
```

**Response**:
```json
{
  "version": "1.0",
  "result": {
    "status": "success",
    "data": {
      "hostname": "node1.example.com",
      "cpu_info": {
        "model": "AMD EPYC 7543",
        "cores": 32,
        "threads": 64,
        "frequency_ghz": 2.8
      },
      "memory_info": {
        "total_bytes": 137438953472,
        "available_bytes": 103079215104,
        "used_percent": 25.0
      }
    }
  },
  "metadata": {
    "duration_ms": 234,
    "attempts": 1,
    "cached": false
  }
}
```

**Error Response**:
```json
{
  "version": "1.0",
  "result": {
    "status": "error",
    "error": {
      "code": "CONNECTION_TIMEOUT",
      "message": "Could not connect to server at 10.20.31.5",
      "details": {
        "host": "10.20.31.5",
        "port": 22,
        "timeout_ms": 30000,
        "attempts": 3
      },
      "user_message": "The server may be offline or the network is unreachable. Would you like to retry?"
    }
  }
}
```

---

## Performance Optimization

### Connection Pooling Metrics

| Metric | Without Pool | With Pool | Improvement |
|--------|-------------|-----------|-------------|
| SSH handshake | 2-3s | 10ms | 200-300x |
| Memory per conn | 50KB | 50KB | - |
| Concurrent limit | 100 | 1000+ | 10x |

### Streaming vs Concatenation

| Output Size | Concatenation | Streaming | Memory Saved |
|-------------|---------------|-----------|--------------|
| 1KB | 1KB | 1KB | 0% |
| 100KB | 5MB | 100KB | 98% |
| 10MB | 50GB | 10MB | 99.98% |

### Parallel vs Serial Execution

| Node Count | Serial | Parallel (100x) | Speedup |
|------------|--------|-----------------|---------|
| 10 | 20s | 0.2s | 100x |
| 100 | 200s | 2s | 100x |
| 1000 | 2000s | 20s | 100x |
| 10000 | 5.5hrs | 3.3min | 100x |

---

## Deployment Architecture

### Desktop Application (Phase 1)

- **Platform**: macOS, Windows, Linux
- **Distribution**: DMG, MSI, AppImage
- **Auto-update**: Tauri updater
- **Config**: `~/.config/rebe-shell/`

### Regional Agent (Phase 2)

- **Platform**: Docker container
- **Distribution**: Docker Hub, private registry
- **Orchestration**: Docker Swarm, Kubernetes
- **Config**: Environment variables, ConfigMap

### Cloud Service (Phase 3+)

- **Platform**: AWS ECS, GCP Cloud Run
- **Distribution**: Container image
- **Scaling**: Auto-scaling groups
- **Config**: AWS Secrets Manager, Parameter Store

---

**Document Status**: Living document
**Last Updated**: 2025-10-20
**Next Review**: Weekly during Phase 1
