/// Streaming Output Handler for reBe Shell
///
/// Processes command output with O(n) complexity (not O(n²) string concatenation).
/// Implements backpressure control to prevent memory exhaustion.
///
/// Extracted from src-tauri/src/stream/ - single source of truth for streaming output.
///
/// Used by:
/// - rebe-shell-backend: PTY output streaming via WebSocket
/// - rebe-shell (Tauri): Large command output handling
/// - rebe-discovery: Processing large infrastructure scan results
/// - rebe-thecy: Streaming provisioning logs
///
/// This adds +185 lines of memory-efficient streaming functionality.
///
/// # Performance
///
/// **Without StreamingHandler**: O(n²) complexity
/// ```text
/// let mut output = String::new();
/// for chunk in chunks {
///     output.push_str(&chunk);  // Reallocates every time!
/// }
/// ```
///
/// **With StreamingHandler**: O(n) complexity
/// ```text
/// let mut handler = StreamingOutputHandler::new(10 * 1024 * 1024);
/// for chunk in chunks {
///     handler.push_chunk(chunk)?;  // No reallocation
/// }
/// let output = handler.finalize();  // Single final allocation
/// ```
///
/// # Example
///
/// ```no_run
/// use rebe_core::stream::StreamingOutputHandler;
/// use bytes::Bytes;
///
/// let mut handler = StreamingOutputHandler::new(10 * 1024 * 1024); // 10MB limit
///
/// // Stream chunks without O(n²) concatenation
/// handler.push_chunk(Bytes::from("Line 1\n"))?;
/// handler.push_chunk(Bytes::from("Line 2\n"))?;
/// handler.push_chunk(Bytes::from("Line 3\n"))?;
///
/// // Single allocation to finalize
/// let output = handler.finalize_string()?;
/// # Ok::<(), anyhow::Error>(())
/// ```

use anyhow::{Context, Result};
use bytes::{Bytes, BytesMut};

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

    /// Push a chunk of data (fails if exceeds max_size)
    pub fn push_chunk(&mut self, data: Bytes) -> Result<()> {
        let data_len = data.len();

        if self.total_size + data_len > self.max_size {
            anyhow::bail!(
                "Output too large: {} bytes (max: {} bytes)",
                self.total_size + data_len,
                self.max_size
            );
        }

        self.total_size += data_len;
        self.chunks.push(data);

        tracing::trace!("Pushed chunk: {} bytes (total: {})", data_len, self.total_size);

        Ok(())
    }

    /// Get current total size
    pub fn size(&self) -> usize {
        self.total_size
    }

    /// Finalize and return complete output (single allocation)
    pub fn finalize(self) -> Bytes {
        if self.chunks.is_empty() {
            return Bytes::new();
        }

        if self.chunks.len() == 1 {
            return self.chunks.into_iter().next().unwrap();
        }

        // Single allocation for final output
        let mut output = BytesMut::with_capacity(self.total_size);
        for chunk in self.chunks {
            output.extend_from_slice(&chunk);
        }

        output.freeze()
    }

    /// Convert to string (UTF-8)
    pub fn finalize_string(self) -> Result<String> {
        let bytes = self.finalize();
        String::from_utf8(bytes.to_vec()).context("Invalid UTF-8")
    }
}

impl Default for StreamingOutputHandler {
    fn default() -> Self {
        Self::new(10 * 1024 * 1024) // 10MB default limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_handler() {
        let handler = StreamingOutputHandler::new(1024);
        let output = handler.finalize();
        assert!(output.is_empty());
    }

    #[test]
    fn test_single_chunk() {
        let mut handler = StreamingOutputHandler::new(1024);
        handler.push_chunk(Bytes::from("test")).unwrap();

        let output = handler.finalize_string().unwrap();
        assert_eq!(output, "test");
    }

    #[test]
    fn test_multiple_chunks() {
        let mut handler = StreamingOutputHandler::new(1024);

        handler.push_chunk(Bytes::from("Hello ")).unwrap();
        handler.push_chunk(Bytes::from("World")).unwrap();
        handler.push_chunk(Bytes::from("!")).unwrap();

        let output = handler.finalize_string().unwrap();
        assert_eq!(output, "Hello World!");
    }

    #[test]
    fn test_size_limit() {
        let mut handler = StreamingOutputHandler::new(10);

        handler.push_chunk(Bytes::from("12345")).unwrap();

        let result = handler.push_chunk(Bytes::from("678901"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Output too large"));
    }

    #[test]
    fn test_size_tracking() {
        let mut handler = StreamingOutputHandler::new(1024);

        handler.push_chunk(Bytes::from("abc")).unwrap();
        assert_eq!(handler.size(), 3);

        handler.push_chunk(Bytes::from("defgh")).unwrap();
        assert_eq!(handler.size(), 8);
    }
}
