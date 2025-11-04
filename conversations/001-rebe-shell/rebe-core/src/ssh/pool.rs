use anyhow::{Context, Result};
use ssh2::Session;
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct HostKey {
    pub host: String,
    pub port: u16,
    pub user: String,
}

impl HostKey {
    pub fn new(host: String, port: u16, user: String) -> Self {
        Self { host, port, user }
    }
}

pub struct PoolConfig {
    pub max_connections_per_host: usize,
    pub idle_timeout: Duration,
    pub connection_timeout: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_connections_per_host: 10,
            idle_timeout: Duration::from_secs(300),
            connection_timeout: Duration::from_secs(10),
        }
    }
}

pub struct SSHConnection {
    pub session: Session,
    pub last_used: Instant,
    pub in_use: bool,
}

impl SSHConnection {
    fn is_expired(&self, timeout: Duration) -> bool {
        self.last_used.elapsed() > timeout
    }
}

pub struct SSHPool {
    connections: Arc<Mutex<HashMap<HostKey, Vec<SSHConnection>>>>,
    config: PoolConfig,
}

impl SSHPool {
    pub fn new(config: PoolConfig) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            config,
        }
    }

    /// Acquire a connection from the pool (reuse existing or create new)
    pub async fn acquire(
        &self,
        key: HostKey,
        key_path: &Path,
    ) -> Result<PooledConnection> {
        let mut connections = self.connections.lock().await;

        // Try to reuse existing connection
        if let Some(conns) = connections.get_mut(&key) {
            // Clean up expired connections
            conns.retain(|c| !c.is_expired(self.config.idle_timeout));

            // Find available connection
            for conn in conns.iter_mut() {
                if !conn.in_use {
                    conn.in_use = true;
                    conn.last_used = Instant::now();

                    tracing::debug!("Reusing SSH connection to {}@{}:{}", key.user, key.host, key.port);

                    return Ok(PooledConnection {
                        key: key.clone(),
                        pool: self.clone(),
                    });
                }
            }
        }

        // Create new connection if under limit
        let conn_list = connections.entry(key.clone()).or_insert_with(Vec::new);

        if conn_list.len() < self.config.max_connections_per_host {
            tracing::info!("Creating new SSH connection to {}@{}:{}", key.user, key.host, key.port);

            let session = self.create_connection(&key, key_path).await?;

            let conn = SSHConnection {
                session,
                last_used: Instant::now(),
                in_use: true,
            };

            conn_list.push(conn);

            return Ok(PooledConnection {
                key: key.clone(),
                pool: self.clone(),
            });
        }

        anyhow::bail!("Connection pool exhausted for {}@{}:{}", key.user, key.host, key.port);
    }

    async fn create_connection(&self, key: &HostKey, key_path: &Path) -> Result<Session> {
        let addr = format!("{}:{}", key.host, key.port);

        let tcp = tokio::time::timeout(
            self.config.connection_timeout,
            tokio::net::TcpStream::connect(&addr),
        )
        .await
        .context("Connection timeout")?
        .context("Failed to connect")?;

        // Convert to std TcpStream (ssh2 requires std)
        let std_tcp = tcp.into_std()?;

        let mut session = Session::new()?;
        session.set_tcp_stream(std_tcp);
        session.handshake()?;

        // Authenticate with private key
        session
            .userauth_pubkey_file(&key.user, None, key_path, None)
            .context("Authentication failed")?;

        Ok(session)
    }

    /// Release a connection back to the pool
    async fn release(&self, key: HostKey) {
        let mut connections = self.connections.lock().await;

        if let Some(conns) = connections.get_mut(&key) {
            for conn in conns.iter_mut() {
                if conn.in_use {
                    conn.in_use = false;
                    tracing::debug!("Released connection to {}@{}:{}", key.user, key.host, key.port);
                    break;
                }
            }
        }
    }

    /// Get connection stats for monitoring
    pub async fn stats(&self) -> HashMap<HostKey, (usize, usize)> {
        let connections = self.connections.lock().await;

        connections
            .iter()
            .map(|(key, conns)| {
                let total = conns.len();
                let in_use = conns.iter().filter(|c| c.in_use).count();
                (key.clone(), (total, in_use))
            })
            .collect()
    }
}

impl Clone for SSHPool {
    fn clone(&self) -> Self {
        Self {
            connections: Arc::clone(&self.connections),
            config: PoolConfig {
                max_connections_per_host: self.config.max_connections_per_host,
                idle_timeout: self.config.idle_timeout,
                connection_timeout: self.config.connection_timeout,
            },
        }
    }
}

/// RAII wrapper that returns connection to pool on drop
pub struct PooledConnection {
    key: HostKey,
    pool: SSHPool,
}

impl PooledConnection {
    /// Execute a command with timeout
    pub async fn exec_with_timeout(
        &self,
        cmd: &str,
        timeout: Duration,
    ) -> Result<String> {
        tokio::time::timeout(timeout, self.exec(cmd))
            .await
            .context("Command timeout")?
    }

    /// Execute a command (internal, no timeout)
    async fn exec(&self, cmd: &str) -> Result<String> {
        let connections = self.pool.connections.lock().await;
        let conns = connections.get(&self.key).context("Connection not found")?;

        let session = &conns
            .iter()
            .find(|c| c.in_use)
            .context("No in-use connection")?
            .session;

        let mut channel = session.channel_session()?;
        channel.exec(cmd)?;

        let mut stdout = String::new();
        channel.read_to_string(&mut stdout)?;

        channel.wait_close()?;
        let exit_status = channel.exit_status()?;

        if exit_status != 0 {
            anyhow::bail!("Command failed with exit code {}", exit_status);
        }

        Ok(stdout)
    }
}

impl Drop for PooledConnection {
    fn drop(&mut self) {
        let key = self.key.clone();
        let pool = self.pool.clone();

        // Release connection back to pool
        tokio::spawn(async move {
            pool.release(key).await;
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pool_creation() {
        let pool = SSHPool::new(PoolConfig::default());
        let stats = pool.stats().await;
        assert!(stats.is_empty());
    }

    #[test]
    fn test_connection_expiry() {
        let mut conn = SSHConnection {
            session: Session::new().unwrap(),
            last_used: Instant::now() - Duration::from_secs(400),
            in_use: false,
        };

        assert!(conn.is_expired(Duration::from_secs(300)));
    }
}
