//! rebe-core
//!
//! Shared substrate library for reBe ecosystem
//!
//! This library provides common primitives and execution infrastructure
//! used across rebe-shell components (backend and src-tauri).
//!
//! # Modules
//!
//! - `pty`: Terminal emulation and PTY session management
//! - `ssh`: SSH connection pooling and remote execution
//! - `stream`: Memory-efficient streaming handlers (O(n) complexity)
//! - `circuit_breaker`: Fault tolerance and resilience patterns
//! - `protocol`: Communication protocols and message formats

// Public module exports
pub mod pty;
pub mod ssh;
pub mod stream;
pub mod circuit_breaker;
pub mod protocol;

// Re-export commonly used types for convenience
pub use pty::{PtyManager, PtySession, SessionId};
pub use ssh::{SSHPool, SSHConnection, PooledConnection, HostKey, PoolConfig};
pub use stream::StreamingOutputHandler;
pub use circuit_breaker::{CircuitBreaker, CircuitBreakerConfig, CircuitBreakerError};
pub use protocol::{
    CommandRequest, CommandResponse, CommandResult, Command, ExecutionConfig,
    ExecutionMode, RetryPolicy, ErrorInfo, ResponseMetadata, FileOperation,
};
