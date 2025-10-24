/// rebe-shell Backend Server
///
/// Axum-based web server providing WebSocket PTY access

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::{stream::StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tower_http::{
    cors::CorsLayer,
    services::ServeDir,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod pty;
use pty::{PtyManager, SessionId};

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    pty_manager: Arc<PtyManager>,
}

/// WebSocket message from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "input")]
    Input { data: String },
    #[serde(rename = "resize")]
    Resize { rows: u16, cols: u16 },
}

/// WebSocket message to client
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "output")]
    Output { data: String },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "connected")]
    Connected { session_id: String },
}

/// Request to create new session
#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    rows: Option<u16>,
    cols: Option<u16>,
}

/// Response with session ID
#[derive(Debug, Serialize)]
struct CreateSessionResponse {
    session_id: String,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rebe_shell_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Create PTY manager
    let pty_manager = Arc::new(PtyManager::new().expect("Failed to create PTY manager"));

    let app_state = AppState { pty_manager };

    // Build router
    let app = Router::new()
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/:id/ws", get(websocket_handler))
        .route("/health", get(health_check))
        .fallback_service(ServeDir::new("./dist").fallback(tower_http::services::ServeFile::new("./dist/index.html")))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start server
    let addr = "0.0.0.0:3000";
    tracing::info!("Starting rebe-shell backend on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "rebe-shell-backend",
        "version": "1.0.0"
    }))
}

/// Create new PTY session
async fn create_session(
    State(state): State<AppState>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, StatusCode> {
    let rows = req.rows.unwrap_or(24);
    let cols = req.cols.unwrap_or(80);

    match state.pty_manager.spawn(None, rows, cols).await {
        Ok(session_id) => {
            tracing::info!("Created session {}", session_id);
            Ok(Json(CreateSessionResponse {
                session_id: session_id.to_string(),
            }))
        }
        Err(e) => {
            tracing::error!("Failed to create session: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// WebSocket handler for PTY I/O
async fn websocket_handler(
    ws: WebSocketUpgrade,
    Path(session_id): Path<String>,
    State(state): State<AppState>,
) -> Response {
    // Parse session ID
    let session_id = match Uuid::parse_str(&session_id) {
        Ok(id) => id,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid session ID").into_response();
        }
    };

    // Upgrade to WebSocket
    ws.on_upgrade(move |socket| handle_websocket(socket, session_id, state))
}

/// Handle WebSocket connection
async fn handle_websocket(socket: WebSocket, session_id: SessionId, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Send connected message
    let connected_msg = ServerMessage::Connected {
        session_id: session_id.to_string(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = sender.send(Message::Text(json)).await;
    }

    // Spawn task to read from PTY and send to WebSocket
    let pty_manager = state.pty_manager.clone();
    let mut read_interval = interval(Duration::from_millis(50));

    let mut send_task = tokio::spawn(async move {
        loop {
            read_interval.tick().await;

            match pty_manager.read(session_id).await {
                Ok(data) if !data.is_empty() => {
                    // Convert bytes to base64 for safe JSON transmission
                    let base64_data = base64_encode(&data);

                    let msg = ServerMessage::Output { data: base64_data };
                    if let Ok(json) = serde_json::to_string(&msg) {
                        if sender.send(Message::Text(json)).await.is_err() {
                            break;
                        }
                    }
                }
                Ok(_) => {
                    // No data available, continue
                }
                Err(e) => {
                    tracing::error!("PTY read error: {}", e);
                    let err_msg = ServerMessage::Error {
                        message: format!("PTY read error: {}", e),
                    };
                    if let Ok(json) = serde_json::to_string(&err_msg) {
                        let _ = sender.send(Message::Text(json)).await;
                    }
                    break;
                }
            }
        }

        tracing::info!("PTY read task ended for session {}", session_id);
    });

    // Handle incoming WebSocket messages
    let pty_manager = state.pty_manager.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // Parse client message
                    match serde_json::from_str::<ClientMessage>(&text) {
                        Ok(ClientMessage::Input { data }) => {
                            // Decode base64 and write to PTY
                            if let Ok(bytes) = base64_decode(&data) {
                                if let Err(e) = pty_manager.write(session_id, &bytes).await {
                                    tracing::error!("PTY write error: {}", e);
                                    break;
                                }
                            }
                        }
                        Ok(ClientMessage::Resize { rows, cols }) => {
                            if let Err(e) = pty_manager.resize(session_id, rows, cols).await {
                                tracing::error!("PTY resize error: {}", e);
                            }
                        }
                        Err(e) => {
                            tracing::error!("Failed to parse client message: {}", e);
                        }
                    }
                }
                Message::Close(_) => {
                    tracing::info!("WebSocket closed for session {}", session_id);
                    break;
                }
                _ => {}
            }
        }

        tracing::info!("WebSocket receive task ended for session {}", session_id);
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }

    // Clean up session
    if let Err(e) = state.pty_manager.close(session_id).await {
        tracing::error!("Failed to close session {}: {}", session_id, e);
    }
}

/// Base64 encode bytes
fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

/// Base64 decode string
fn base64_decode(data: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(data)
}
