# rebe-shell Backend

Web-based terminal backend using Axum + WebSocket + PTY.

## Prerequisites

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env  # or restart your terminal
```

Verify installation:
```bash
cargo --version
```

## Build

```bash
cd backend
cargo build --release
```

## Run

```bash
cargo run --release
```

The server will start on `http://localhost:3000`

## Usage

### Open in Browser

```bash
open http://localhost:3000
```

You'll see a web-based terminal. You can now:

1. **Clone a repository**:
   ```bash
   git clone https://github.com/your-repo/rebe-simulations.git
   cd rebe-simulations
   ```

2. **Navigate to a conversation**:
   ```bash
   cd conversations/002-dog-platform
   ```

3. **Run claude**:
   ```bash
   claude
   ```

## Architecture

```
┌─────────────────────────────────────────────┐
│ Browser                                      │
│  ├─ index.html (xterm.js terminal UI)      │
│  └─ WebSocket connection                    │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ Axum Backend (Rust)                         │
│  ├─ POST /api/sessions     (create session) │
│  ├─ WS /api/sessions/:id/ws (PTY I/O)      │
│  └─ GET /health            (health check)   │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ PTY Manager                                  │
│  ├─ Spawn shell (bash, zsh, etc)           │
│  ├─ Read/Write PTY                          │
│  └─ Resize terminal                         │
└─────────────────────────────────────────────┘
```

## WebSocket Protocol

### Client → Server

**Input** (send keystrokes):
```json
{
  "type": "input",
  "data": "ZWNobyBoZWxsbw==" // base64 encoded
}
```

**Resize** (terminal size changed):
```json
{
  "type": "resize",
  "rows": 24,
  "cols": 80
}
```

### Server → Client

**Output** (shell output):
```json
{
  "type": "output",
  "data": "JCBlY2hvIGhlbGxvCg==" // base64 encoded
}
```

**Error** (PTY error):
```json
{
  "type": "error",
  "message": "PTY read error: ..."
}
```

**Connected** (session established):
```json
{
  "type": "connected",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## API Endpoints

### POST /api/sessions

Create a new PTY session.

**Request**:
```json
{
  "rows": 24,
  "cols": 80
}
```

**Response**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /api/sessions/:id/ws

WebSocket endpoint for PTY I/O. Connect after creating a session.

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "rebe-shell-backend",
  "version": "1.0.0"
}
```

## Development

### Build for Development

```bash
cargo build
```

### Run in Development Mode

```bash
cargo run
```

### Run Tests

```bash
cargo test
```

### Enable Debug Logging

```bash
RUST_LOG=debug cargo run
```

## Project Structure

```
backend/
├── Cargo.toml          # Rust dependencies
├── src/
│   ├── main.rs         # Axum server + WebSocket handler
│   └── pty.rs          # PTY manager (portable-pty)
└── README.md           # This file
```

## Dependencies

- **axum** - Web framework
- **tokio** - Async runtime
- **tower-http** - HTTP middleware (CORS, static files)
- **portable-pty** - Cross-platform PTY support
- **serde** - JSON serialization
- **uuid** - Session IDs
- **base64** - Binary data encoding
- **tracing** - Logging

## Deployment

### Docker

Create `Dockerfile`:
```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/rebe-shell-backend /usr/local/bin/
COPY ../dist /app/dist
WORKDIR /app
CMD ["rebe-shell-backend"]
```

Build and run:
```bash
docker build -t rebe-shell-backend .
docker run -p 3000:3000 rebe-shell-backend
```

### Fly.io

```bash
fly launch
fly deploy
```

## Troubleshooting

### "Connection refused"

Make sure the backend is running:
```bash
cargo run
```

### "Session not found"

The PTY session may have timed out. Refresh the browser to create a new session.

### "No shell found"

Make sure you have bash, zsh, or sh installed:
```bash
which bash zsh sh
```

## Next Steps

- [ ] Add session persistence (survive page refresh)
- [ ] Add authentication (Vault integration)
- [ ] Add multiple tabs/sessions
- [ ] Add command history
- [ ] Add DoG platform integration

---

**Status**: Phase 2 MVP Complete
**Last Updated**: 2025-10-20
**Version**: 1.0.0
