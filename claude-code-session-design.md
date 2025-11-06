# Claude Code Session Management in reBe Shell

## Overview

Integration of Claude Code as a managed session within reBe Shell, providing subprocess lifecycle management, PTY integration, and Thing-native execution.

## Architecture

### 1. Session Type: Claude Code

Add `claude-code` as a new session type alongside `local` and `ssh`:

```rust
// rebe-core/src/protocol/mod.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionType {
    Local,
    SSH { host: String, port: u16 },
    ClaudeCode {
        model: String,
        cost_limit: Option<f64>,
        context_limit: Option<u64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeConfig {
    pub model: String,
    pub working_dir: PathBuf,
    pub cost_limit: Option<f64>,      // USD
    pub context_limit: Option<u64>,   // tokens
    pub stream_output: bool,
}
```

### 2. Claude Code Session Manager

```rust
// rebe-core/src/claude_code/mod.rs

use std::process::{Child, Command, Stdio};
use std::io::{BufReader, BufRead, Write};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

pub struct ClaudeCodeSession {
    session_id: String,
    config: ClaudeCodeConfig,
    process: Arc<Mutex<Option<Child>>>,
    stdin_tx: mpsc::UnboundedSender<String>,
    output_rx: mpsc::UnboundedReceiver<OutputChunk>,
    cost_tracker: CostTracker,
}

#[derive(Debug)]
pub struct OutputChunk {
    pub content: String,
    pub tokens: u64,
    pub cost: f64,
    pub timestamp: SystemTime,
}

impl ClaudeCodeSession {
    pub fn new(session_id: String, config: ClaudeCodeConfig) -> Result<Self> {
        let (stdin_tx, stdin_rx) = mpsc::unbounded_channel();
        let (output_tx, output_rx) = mpsc::unbounded_channel();

        let process = Self::spawn_process(&config)?;

        // Spawn thread to handle stdin
        let stdin_handle = Self::spawn_stdin_handler(process.stdin.take().unwrap(), stdin_rx);

        // Spawn thread to handle stdout/stderr
        let stdout_handle = Self::spawn_output_handler(
            process.stdout.take().unwrap(),
            output_tx.clone(),
            config.cost_limit,
            config.context_limit,
        );

        Ok(Self {
            session_id,
            config,
            process: Arc::new(Mutex::new(Some(process))),
            stdin_tx,
            output_rx,
            cost_tracker: CostTracker::new(),
        })
    }

    fn spawn_process(config: &ClaudeCodeConfig) -> Result<Child> {
        let child = Command::new("claude")
            .arg("--model")
            .arg(&config.model)
            .arg("--stream")
            .current_dir(&config.working_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        Ok(child)
    }

    fn spawn_stdin_handler(
        mut stdin: std::process::ChildStdin,
        mut rx: mpsc::UnboundedReceiver<String>,
    ) -> std::thread::JoinHandle<()> {
        std::thread::spawn(move || {
            while let Some(input) = rx.blocking_recv() {
                if let Err(e) = stdin.write_all(input.as_bytes()) {
                    eprintln!("Failed to write to claude stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush() {
                    eprintln!("Failed to flush claude stdin: {}", e);
                    break;
                }
            }
        })
    }

    fn spawn_output_handler(
        stdout: std::process::ChildStdout,
        tx: mpsc::UnboundedSender<OutputChunk>,
        cost_limit: Option<f64>,
        context_limit: Option<u64>,
    ) -> std::thread::JoinHandle<()> {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut total_tokens = 0u64;
            let mut total_cost = 0.0f64;

            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("Error reading claude output: {}", e);
                        break;
                    }
                };

                // Estimate tokens (rough: 1 token ~= 4 characters)
                let tokens = (line.len() / 4) as u64;
                total_tokens += tokens;

                // Calculate cost (Sonnet 4.5: $3/$15 per M tokens)
                let chunk_cost = (tokens as f64) * (15.0 / 1_000_000.0);
                total_cost += chunk_cost;

                // Check limits
                if let Some(limit) = cost_limit {
                    if total_cost > limit {
                        eprintln!("Cost limit ${:.4} exceeded (${:.4})", limit, total_cost);
                        break;
                    }
                }

                if let Some(limit) = context_limit {
                    if total_tokens > limit {
                        eprintln!("Context limit {} exceeded ({})", limit, total_tokens);
                        break;
                    }
                }

                let chunk = OutputChunk {
                    content: line,
                    tokens,
                    cost: total_cost,
                    timestamp: SystemTime::now(),
                };

                if tx.send(chunk).is_err() {
                    break;
                }
            }
        })
    }

    pub fn send_input(&self, input: String) -> Result<()> {
        self.stdin_tx.send(input)
            .map_err(|e| anyhow::anyhow!("Failed to send input: {}", e))
    }

    pub async fn recv_output(&mut self) -> Option<OutputChunk> {
        self.output_rx.recv().await
    }

    pub fn kill(&self) -> Result<()> {
        let mut process = self.process.lock().unwrap();
        if let Some(ref mut child) = *process {
            child.kill()?;
        }
        Ok(())
    }

    pub fn cost_summary(&self) -> CostSummary {
        self.cost_tracker.summary()
    }
}

pub struct CostTracker {
    total_input_tokens: Arc<Mutex<u64>>,
    total_output_tokens: Arc<Mutex<u64>>,
    total_cost: Arc<Mutex<f64>>,
}

impl CostTracker {
    pub fn new() -> Self {
        Self {
            total_input_tokens: Arc::new(Mutex::new(0)),
            total_output_tokens: Arc::new(Mutex::new(0)),
            total_cost: Arc::new(Mutex::new(0.0)),
        }
    }

    pub fn summary(&self) -> CostSummary {
        CostSummary {
            input_tokens: *self.total_input_tokens.lock().unwrap(),
            output_tokens: *self.total_output_tokens.lock().unwrap(),
            total_cost: *self.total_cost.lock().unwrap(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CostSummary {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_cost: f64,
}
```

### 3. Integration with Existing rebe-shell

```rust
// rebe-core/src/lib.rs

pub mod pty;
pub mod ssh;
pub mod claude_code;  // NEW
pub mod stream;
pub mod circuit_breaker;
pub mod protocol;

pub use claude_code::{ClaudeCodeSession, ClaudeCodeConfig, CostSummary};
```

```rust
// backend/src/main.rs (or src-tauri/src/main.rs)

use rebe_core::{ClaudeCodeSession, ClaudeCodeConfig};

#[tauri::command]
async fn create_claude_code_session(
    model: String,
    cost_limit: Option<f64>,
    context_limit: Option<u64>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    let config = ClaudeCodeConfig {
        model,
        working_dir: PathBuf::from(format!("/tmp/claude-code/{}", session_id)),
        cost_limit,
        context_limit,
        stream_output: true,
    };

    // Create working directory
    std::fs::create_dir_all(&config.working_dir)
        .map_err(|e| format!("Failed to create working dir: {}", e))?;

    let session = ClaudeCodeSession::new(session_id.clone(), config)
        .map_err(|e| format!("Failed to create session: {}", e))?;

    // Store session in global manager
    SESSION_MANAGER.lock().unwrap().insert(session_id.clone(), session);

    Ok(session_id)
}

#[tauri::command]
async fn send_to_claude(session_id: String, input: String) -> Result<(), String> {
    let sessions = SESSION_MANAGER.lock().unwrap();
    let session = sessions.get(&session_id)
        .ok_or("Session not found")?;

    session.send_input(input)
        .map_err(|e| format!("Failed to send input: {}", e))
}

#[tauri::command]
async fn get_claude_output(session_id: String) -> Result<Option<OutputChunk>, String> {
    let mut sessions = SESSION_MANAGER.lock().unwrap();
    let session = sessions.get_mut(&session_id)
        .ok_or("Session not found")?;

    Ok(session.recv_output().await)
}

#[tauri::command]
async fn kill_claude_session(session_id: String) -> Result<CostSummary, String> {
    let mut sessions = SESSION_MANAGER.lock().unwrap();
    let session = sessions.remove(&session_id)
        .ok_or("Session not found")?;

    let summary = session.cost_summary();
    session.kill().map_err(|e| format!("Failed to kill session: {}", e))?;

    Ok(summary)
}
```

### 4. Frontend Integration (TypeScript)

```typescript
// src/lib/claudeCodeSession.ts

export interface ClaudeCodeConfig {
  model: string;
  costLimit?: number;
  contextLimit?: number;
}

export interface OutputChunk {
  content: string;
  tokens: number;
  cost: number;
  timestamp: number;
}

export interface CostSummary {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export class ClaudeCodeSession {
  private sessionId: string | null = null;
  private outputBuffer: OutputChunk[] = [];
  private listeners: ((chunk: OutputChunk) => void)[] = [];

  constructor(private config: ClaudeCodeConfig) {}

  async start(): Promise<string> {
    const sessionId = await invoke<string>('create_claude_code_session', {
      model: this.config.model,
      costLimit: this.config.costLimit,
      contextLimit: this.config.contextLimit,
    });

    this.sessionId = sessionId;

    // Start polling for output
    this.pollOutput();

    return sessionId;
  }

  async send(input: string): Promise<void> {
    if (!this.sessionId) throw new Error('Session not started');

    await invoke('send_to_claude', {
      sessionId: this.sessionId,
      input,
    });
  }

  onOutput(callback: (chunk: OutputChunk) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private async pollOutput() {
    while (this.sessionId) {
      try {
        const chunk = await invoke<OutputChunk | null>('get_claude_output', {
          sessionId: this.sessionId,
        });

        if (chunk) {
          this.outputBuffer.push(chunk);
          this.listeners.forEach(l => l(chunk));
        } else {
          // No more output, wait a bit
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.error('Error polling output:', err);
        break;
      }
    }
  }

  async stop(): Promise<CostSummary> {
    if (!this.sessionId) throw new Error('Session not started');

    const summary = await invoke<CostSummary>('kill_claude_session', {
      sessionId: this.sessionId,
    });

    this.sessionId = null;
    return summary;
  }

  getOutputBuffer(): OutputChunk[] {
    return [...this.outputBuffer];
  }
}
```

### 5. UI Component

```typescript
// src/components/ClaudeCodeTerminal.tsx

import { useState, useEffect, useRef } from 'react';
import { ClaudeCodeSession, OutputChunk, CostSummary } from '../lib/claudeCodeSession';

export function ClaudeCodeTerminal() {
  const [session, setSession] = useState<ClaudeCodeSession | null>(null);
  const [output, setOutput] = useState<OutputChunk[]>([]);
  const [input, setInput] = useState('');
  const [cost, setCost] = useState(0);
  const [tokens, setTokens] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  const startSession = async () => {
    const newSession = new ClaudeCodeSession({
      model: 'claude-sonnet-4.5',
      costLimit: 1.00,
      contextLimit: 100_000,
    });

    newSession.onOutput(chunk => {
      setOutput(prev => [...prev, chunk]);
      setCost(chunk.cost);
      setTokens(prev => prev + chunk.tokens);

      // Auto-scroll
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    });

    await newSession.start();
    setSession(newSession);
  };

  const stopSession = async () => {
    if (!session) return;

    const summary = await session.stop();
    console.log('Session ended:', summary);
    setSession(null);
  };

  const sendInput = async () => {
    if (!session || !input.trim()) return;

    await session.send(input);
    setInput('');
  };

  return (
    <div className="claude-code-terminal">
      <div className="toolbar">
        <button onClick={startSession} disabled={!!session}>
          Start Claude Code
        </button>
        <button onClick={stopSession} disabled={!session}>
          Stop
        </button>

        <div className="stats">
          <span>Tokens: {tokens.toLocaleString()}</span>
          <span>Cost: ${cost.toFixed(4)}</span>
        </div>
      </div>

      <div className="terminal" ref={terminalRef}>
        {output.map((chunk, i) => (
          <div key={i} className="output-line">
            {chunk.content}
          </div>
        ))}
      </div>

      <div className="input-bar">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendInput()}
          placeholder="Type a message..."
          disabled={!session}
        />
        <button onClick={sendInput} disabled={!session}>
          Send
        </button>
      </div>
    </div>
  );
}
```

## Thing Monad Preservation

Claude Code sessions become Things:

```rust
// rebe-core/src/claude_code/thing.rs

use crate::protocol::Thing;

impl Thing for ClaudeCodeSession {
    fn identifier(&self) -> String {
        format!("claude_code_session_{}", self.session_id)
    }

    fn thing_type(&self) -> String {
        "claude_code_session".to_string()
    }

    fn attest_state(&self) -> serde_json::Value {
        let summary = self.cost_summary();
        serde_json::json!({
            "session_id": self.session_id,
            "model": self.config.model,
            "cost": summary.total_cost,
            "tokens": summary.input_tokens + summary.output_tokens,
            "working_dir": self.config.working_dir,
            "limits": {
                "cost": self.config.cost_limit,
                "context": self.config.context_limit
            }
        })
    }

    fn list_capabilities(&self) -> Vec<String> {
        vec![
            "send_input".to_string(),
            "recv_output".to_string(),
            "track_cost".to_string(),
            "stream_output".to_string(),
        ]
    }
}
```

## Benefits

1. **Subprocess Management** - Proper lifecycle, cleanup, error handling
2. **PTY Integration** - Fits naturally into rebe-shell architecture
3. **Cost Tracking** - Built-in, real-time cost monitoring
4. **Circuit Breaker** - Automatic kill on limit violation
5. **Thing-Native** - Claude Code sessions are discoverable Things

## Comparison: Conversations vs Shell

| Aspect | reBe Conversations | reBe Shell |
|--------|-------------------|-----------|
| Use Case | Long-running orchestration | Interactive development |
| Cost Control | Pre-flight + streaming | Subprocess limits + kill |
| Output Mgmt | Database + pagination | Terminal buffer + scroll |
| User Experience | Async conversation | Real-time terminal |
| Best For | Production infra ops | Prototyping, debugging |

## Recommended Approach

**Use both:**

1. **reBe Shell** for development:
   - Quick iteration
   - Direct terminal feedback
   - Local file access

2. **reBe Conversations** for production:
   - Long-running operations
   - Multi-node orchestration
   - Audit trails and replay

## Implementation Plan

1. Add `ClaudeCodeSession` to `rebe-core`
2. Implement subprocess management with cost tracking
3. Add Tauri commands for session lifecycle
4. Build frontend terminal component
5. Test with bounded tasks (e.g., single file operations)
6. Scale to multi-file operations
7. Document usage patterns

## Example Usage

```typescript
// Create session
const session = new ClaudeCodeSession({
  model: 'claude-sonnet-4.5',
  costLimit: 0.50,  // 50 cents
  contextLimit: 50_000,
});

await session.start();

// Send discovery task
await session.send(`
  Discover all nodes in the rebe substrate that implement the Thing protocol.
  For each node, show:
  - identifier
  - capabilities
  - current state
`);

// Stream output
session.onOutput(chunk => {
  console.log(chunk.content);
  console.log(`Cost so far: $${chunk.cost.toFixed(4)}`);
});

// Stop when done
const summary = await session.stop();
console.log(`Total: ${summary.outputTokens} tokens, $${summary.totalCost}`);
```

## Next Steps

- Implement core `ClaudeCodeSession` in Rust
- Add Tauri integration
- Build terminal UI component
- Test with real claude-code CLI
- Document patterns and best practices
