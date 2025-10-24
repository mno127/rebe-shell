/// PTY (Pseudoterminal) Manager for Web Backend
///
/// Manages shell sessions with bidirectional I/O using portable-pty.
/// Adapted for WebSocket-based communication.

use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

pub type SessionId = Uuid;

/// PTY session with master PTY handle
pub struct PtySession {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
}

/// Manages multiple PTY sessions
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<SessionId, PtySession>>>,
    default_shell: PathBuf,
}

impl PtyManager {
    /// Create a new PTY manager with the default system shell
    pub fn new() -> Result<Self> {
        let default_shell = Self::detect_default_shell()?;

        Ok(Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            default_shell,
        })
    }

    /// Detect the default shell for the current platform
    fn detect_default_shell() -> Result<PathBuf> {
        #[cfg(unix)]
        {
            // Try to get shell from environment
            if let Ok(shell) = std::env::var("SHELL") {
                return Ok(PathBuf::from(shell));
            }

            // Fallback to common shells
            for shell in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
                if PathBuf::from(shell).exists() {
                    return Ok(PathBuf::from(shell));
                }
            }

            anyhow::bail!("No shell found");
        }

        #[cfg(windows)]
        {
            // Use PowerShell on Windows
            Ok(PathBuf::from("powershell.exe"))
        }
    }

    /// Spawn a new shell session
    pub async fn spawn(&self, shell: Option<PathBuf>, rows: u16, cols: u16) -> Result<SessionId> {
        let shell_path = shell.unwrap_or_else(|| self.default_shell.clone());

        let pty_system = NativePtySystem::default();

        let pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to open PTY")?;

        let cmd = CommandBuilder::new(&shell_path);
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;

        let mut master = pty_pair.master;
        let writer = Arc::new(Mutex::new(master.take_writer().context("Failed to get writer")?));
        let reader = Arc::new(Mutex::new(master.try_clone_reader().context("Failed to get reader")?));

        let session = PtySession { child, master, writer, reader };

        let id = SessionId::new_v4();
        self.sessions.lock().await.insert(id, session);

        tracing::info!("Spawned PTY session {} with shell {:?}", id, shell_path);

        Ok(id)
    }

    /// Write data to a PTY session
    pub async fn write(&self, id: SessionId, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions.get(&id).context("Session not found")?;
        let writer = session.writer.clone();
        drop(sessions);

        let data_vec = data.to_vec();
        let data_len = data_vec.len();

        tokio::task::spawn_blocking(move || {
            let mut writer_lock = writer.blocking_lock();
            writer_lock.write_all(&data_vec)?;
            writer_lock.flush()?;
            Ok::<(), anyhow::Error>(())
        }).await??;

        tracing::debug!("Wrote {} bytes to session {}", data_len, id);

        Ok(())
    }

    /// Read available data from a PTY session (non-blocking)
    pub async fn read(&self, id: SessionId) -> Result<Vec<u8>> {
        let sessions = self.sessions.lock().await;
        let session = sessions.get(&id).context("Session not found")?;
        let reader = session.reader.clone();
        drop(sessions);

        let result = tokio::task::spawn_blocking(move || -> anyhow::Result<Vec<u8>> {
            let mut reader_lock = reader.blocking_lock();
            let mut buffer = vec![0u8; 4096];

            match reader_lock.read(&mut buffer) {
                Ok(0) => {
                    Ok(Vec::new())
                }
                Ok(n) => {
                    buffer.truncate(n);
                    Ok(buffer)
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available
                    Ok(Vec::new())
                }
                Err(e) => Err(e.into()),
            }
        }).await??;

        if !result.is_empty() {
            tracing::debug!("Read {} bytes from session {}", result.len(), id);
        }

        Ok(result)
    }

    /// Resize a PTY session
    pub async fn resize(&self, id: SessionId, rows: u16, cols: u16) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions.get_mut(&id).context("Session not found")?;

        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        tracing::info!("Resized session {} to {}x{}", id, cols, rows);

        Ok(())
    }

    /// Close a PTY session
    pub async fn close(&self, id: SessionId) -> Result<()> {
        let mut sessions = self.sessions.lock().await;

        if let Some(mut session) = sessions.remove(&id) {
            // Try to kill the child process
            let _ = session.child.kill();
            tracing::info!("Closed PTY session {}", id);
        }

        Ok(())
    }

    /// List all active sessions
    pub async fn list_sessions(&self) -> Vec<SessionId> {
        self.sessions.lock().await.keys().copied().collect()
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new().expect("Failed to create PTY manager")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spawn_session() {
        let manager = PtyManager::new().unwrap();
        let id = manager.spawn(None, 24, 80).await.unwrap();
        assert!(manager.list_sessions().await.contains(&id));
    }

    #[tokio::test]
    async fn test_write_read() {
        let manager = PtyManager::new().unwrap();
        let id = manager.spawn(None, 24, 80).await.unwrap();

        manager.write(id, b"echo test\n").await.unwrap();

        // Give shell time to process
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let output = manager.read(id).await.unwrap();
        assert!(!output.is_empty());
    }

    #[tokio::test]
    async fn test_close_session() {
        let manager = PtyManager::new().unwrap();
        let id = manager.spawn(None, 24, 80).await.unwrap();

        manager.close(id).await.unwrap();

        assert!(!manager.list_sessions().await.contains(&id));
    }
}
