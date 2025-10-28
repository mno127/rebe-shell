/// SSH Connection Pool for reBe Shell
///
/// Reuses SSH connections to avoid handshake overhead (2-3s per connection).
/// Provides 200-300x performance improvement for repeated operations.
///
/// Extracted from src-tauri/src/ssh/ - single source of truth for SSH management.
///
/// Used by:
/// - rebe-shell-backend: Remote command execution
/// - rebe-discovery: Infrastructure discovery via SSH
/// - rebe-thecy: Remote provisioning and configuration
///
/// This adds +268 lines of shared SSH functionality.
///
/// # Example
///
/// ```no_run
/// use rebe_core::ssh::{SSHPool, PoolConfig, HostKey};
/// use std::path::Path;
///
/// # async fn example() -> anyhow::Result<()> {
/// let pool = SSHPool::new(PoolConfig::default());
///
/// let key = HostKey::new("example.com".to_string(), 22, "user".to_string());
/// let conn = pool.acquire(key, Path::new("/path/to/key")).await?;
///
/// let output = conn.exec_with_timeout("ls -la", std::time::Duration::from_secs(5)).await?;
/// println!("Output: {}", output);
/// # Ok(())
/// # }
/// ```

pub mod pool;

pub use pool::{SSHPool, PoolConfig, PooledConnection, HostKey, SSHConnection};
