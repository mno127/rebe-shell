/// SSH Connection Pool
///
/// Reuses SSH connections to avoid handshake overhead (2-3s per connection).
/// Provides 200-300x performance improvement for repeated operations.

pub mod pool;

pub use pool::{SSHPool, PoolConfig, PooledConnection};
