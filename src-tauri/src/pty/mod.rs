/// PTY (Pseudoterminal) Manager
///
/// Manages shell sessions with bidirectional I/O using portable-pty for
/// cross-platform compatibility (Unix PTY and Windows ConPTY).

use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

pub type SessionId = uuid::Uuid;

/// PTY session with reader/writer handles
pub struct PtySession {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
    reader: BufReader<Box<dyn Read + Send>>,
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
    pub async fn spawn(&self, shell: Option<PathBuf>) -> Result<SessionId> {
        let shell_path = shell.unwrap_or_else(|| self.default_shell.clone());

        let pty_system = NativePtySystem::default();

        let pty_pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to open PTY")?;

        let cmd = CommandBuilder::new(&shell_path);
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;

        let reader = pty_pair.master.try_clone_reader()?;
        let writer = pty_pair.master.take_writer()?;

        let session = PtySession {
            child,
            writer,
            reader: BufReader::new(reader),
        };

        let id = SessionId::new_v4();
        self.sessions.lock().await.insert(id, session);

        tracing::info!("Spawned PTY session {} with shell {:?}", id, shell_path);

        Ok(id)
    }

    /// Write data to a PTY session
    pub async fn write(&self, id: SessionId, data: &[u8]) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(&id)
            .context("Session not found")?;

        session.writer.write_all(data)?;
        session.writer.flush()?;

        Ok(())
    }

    /// Read available data from a PTY session
    pub async fn read(&self, id: SessionId) -> Result<Vec<u8>> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(&id)
            .context("Session not found")?;

        let mut buffer = Vec::new();
        let mut chunk = [0u8; 4096];

        match session.reader.read(&mut chunk) {
            Ok(0) => {
                tracing::info!("PTY session {} closed", id);
            }
            Ok(n) => {
                buffer.extend_from_slice(&chunk[..n]);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No data available
            }
            Err(e) => return Err(e.into()),
        }

        Ok(buffer)
    }

    /// Resize a PTY session
    pub async fn resize(&self, id: SessionId, rows: u16, cols: u16) -> Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions.get(&id).context("Session not found")?;

        // Note: portable-pty doesn't expose resize directly on session
        // This would require keeping a reference to the master PTY
        // For now, this is a placeholder

        tracing::info!("Resize session {} to {}x{}", id, cols, rows);

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
        let id = manager.spawn(None).await.unwrap();
        assert!(manager.list_sessions().await.contains(&id));
    }

    #[tokio::test]
    async fn test_write_read() {
        let manager = PtyManager::new().unwrap();
        let id = manager.spawn(None).await.unwrap();

        manager.write(id, b"echo test\n").await.unwrap();

        // Give shell time to process
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let output = manager.read(id).await.unwrap();
        assert!(!output.is_empty());
    }

    #[tokio::test]
    async fn test_close_session() {
        let manager = PtyManager::new().unwrap();
        let id = manager.spawn(None).await.unwrap();

        manager.close(id).await.unwrap();

        assert!(!manager.list_sessions().await.contains(&id));
    }
}
