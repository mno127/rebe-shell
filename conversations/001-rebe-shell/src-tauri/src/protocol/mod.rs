/// Structured Command Protocol
///
/// JSON-based protocol for reliable command execution (no text parsing).
/// All requests and responses are typed and validated.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRequest {
    pub version: String,
    pub command: Command,
    pub execution: ExecutionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    SystemInfo {
        fields: Vec<String>,
    },
    Execute {
        script: String,
    },
    FileOperation {
        operation: FileOperation,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FileOperation {
    Read { path: String },
    Write { path: String, content: Vec<u8> },
    Delete { path: String },
    List { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
    pub mode: ExecutionMode,
    pub host: Option<String>,
    pub timeout_ms: u64,
    pub retry_policy: Option<RetryPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionMode {
    Native,
    SSH,
    WASM,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: usize,
    pub backoff_ms: u64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            backoff_ms: 1000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    pub version: String,
    pub result: CommandResult,
    pub metadata: ResponseMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum CommandResult {
    Success {
        data: HashMap<String, serde_json::Value>,
    },
    Error {
        error: ErrorInfo,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
    pub details: HashMap<String, serde_json::Value>,
    pub user_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetadata {
    pub duration_ms: u64,
    pub attempts: usize,
    pub cached: bool,
}

impl CommandResponse {
    pub fn success(data: HashMap<String, serde_json::Value>, metadata: ResponseMetadata) -> Self {
        Self {
            version: "1.0".to_string(),
            result: CommandResult::Success { data },
            metadata,
        }
    }

    pub fn error(error: ErrorInfo, metadata: ResponseMetadata) -> Self {
        Self {
            version: "1.0".to_string(),
            result: CommandResult::Error { error },
            metadata,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_request_serialization() {
        let request = CommandRequest {
            version: "1.0".to_string(),
            command: Command::SystemInfo {
                fields: vec!["hostname".to_string(), "cpu_info".to_string()],
            },
            execution: ExecutionConfig {
                mode: ExecutionMode::SSH,
                host: Some("10.20.31.5".to_string()),
                timeout_ms: 30000,
                retry_policy: Some(RetryPolicy::default()),
            },
        };

        let json = serde_json::to_string_pretty(&request).unwrap();
        assert!(json.contains("system_info"));
        assert!(json.contains("hostname"));

        let deserialized: CommandRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(request.version, deserialized.version);
    }

    #[test]
    fn test_success_response() {
        let mut data = HashMap::new();
        data.insert(
            "hostname".to_string(),
            serde_json::Value::String("test.local".to_string()),
        );

        let response = CommandResponse::success(
            data,
            ResponseMetadata {
                duration_ms: 234,
                attempts: 1,
                cached: false,
            },
        );

        let json = serde_json::to_string_pretty(&response).unwrap();
        assert!(json.contains("success"));
        assert!(json.contains("test.local"));
    }

    #[test]
    fn test_error_response() {
        let error = ErrorInfo {
            code: "CONNECTION_TIMEOUT".to_string(),
            message: "Could not connect to server".to_string(),
            details: HashMap::new(),
            user_message: "The server may be offline".to_string(),
        };

        let response = CommandResponse::error(
            error,
            ResponseMetadata {
                duration_ms: 30000,
                attempts: 3,
                cached: false,
            },
        );

        let json = serde_json::to_string_pretty(&response).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("CONNECTION_TIMEOUT"));
    }
}
