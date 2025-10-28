# rebe-shell Deployment Guide

Complete guide for deploying rebe-shell in development, staging, and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Development Deployment](#development-deployment)
4. [Production Deployment](#production-deployment)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Scaling](#scaling)
10. [Security](#security)

---

## Prerequisites

### System Requirements

**Minimum**:
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB
- OS: Linux, macOS, or Windows (WSL2)

**Recommended (Production)**:
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB SSD
- OS: Linux (Ubuntu 22.04 LTS, Rocky Linux 9)

### Software Dependencies

#### Required
- **Rust**: 1.70+ (MSRV: 1.70.0)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Node.js**: 18+ LTS
  ```bash
  # Using nvm (recommended)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 18
  nvm use 18
  ```

- **npm**: 9+ (comes with Node.js)

#### Optional (for full functionality)
- **SSH Server**: For SSH pooling tests/features
- **rebe-browser**: For browser automation (see rebe-browser repository)
- **Docker**: 20.10+ (for containerized deployment)
- **docker-compose**: 2.0+ (for multi-container orchestration)

---

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/your-org/rebe-shell.git
cd rebe-shell/conversations/001-rebe-shell
```

### 2. Build Backend
```bash
cd backend
cargo build --release
```

### 3. Build Frontend
```bash
cd ..  # Back to project root
npm install
npm run build
```

### 4. Start Backend
```bash
cd backend
./target/release/rebe-shell-backend
# Or in debug mode:
cargo run
```

### 5. Open Frontend
```bash
# Development server (with hot reload)
npm run dev

# Or serve production build
npx serve -s dist
```

### 6. Access Application
- **Frontend**: http://localhost:5173 (dev) or http://localhost:3000 (prod)
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

---

## Development Deployment

### Backend (Cargo Watch for Auto-Reload)

```bash
# Install cargo-watch
cargo install cargo-watch

# Run with auto-reload
cd backend
cargo watch -x run
```

### Frontend (Vite Dev Server)

```bash
npm run dev
# Access at http://localhost:5173
```

### Environment Configuration

Create `.env` file in project root:

```bash
# Backend
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3000

# SSH Configuration
SSH_KEY_PATH=~/.ssh/id_rsa
SSH_POOL_MAX_CONNECTIONS=10
SSH_POOL_IDLE_TIMEOUT=300

# Browser Service
REBE_BROWSER_URL=http://localhost:8080

# Logging
RUST_LOG=info,rebe_shell_backend=debug,rebe_core=debug

# Frontend
VITE_BACKEND_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Running Tests

```bash
# Backend tests
cd backend
cargo test

# Integration tests (requires backend running)
cd ..
node tests/integration.test.js

# Self-test
./tests/self_test.sh
```

---

## Production Deployment

### Build for Production

#### 1. Backend (Optimized Release)

```bash
cd backend
cargo build --release --locked

# Binary will be at: target/release/rebe-shell-backend
# Size: ~10-15 MB (optimized with LTO)
```

#### 2. Frontend (Production Build)

```bash
npm run build

# Output directory: dist/
# Contents: Optimized HTML, CSS, JS, and assets
```

### Deployment Options

#### Option 1: Direct Binary Deployment

```bash
# 1. Copy backend binary
scp backend/target/release/rebe-shell-backend user@server:/opt/rebe-shell/

# 2. Copy frontend build
scp -r dist/* user@server:/var/www/rebe-shell/

# 3. SSH into server
ssh user@server

# 4. Set up systemd service (see below)
sudo systemctl enable rebe-shell
sudo systemctl start rebe-shell

# 5. Configure nginx (see below)
sudo systemctl reload nginx
```

#### Option 2: Docker Deployment

**Dockerfile (Backend)**:

```dockerfile
# backend/Dockerfile
FROM rust:1.75-slim as builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY ../rebe-core ../rebe-core

RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rebe-shell-backend /usr/local/bin/

ENV RUST_LOG=info
ENV BACKEND_PORT=3000

EXPOSE 3000

CMD ["rebe-shell-backend"]
```

**Dockerfile (Frontend)**:

```dockerfile
# Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - RUST_LOG=info
      - SSH_KEY_PATH=/root/.ssh/id_rsa
      - REBE_BROWSER_URL=http://rebe-browser:8080
    volumes:
      - ~/.ssh:/root/.ssh:ro
    networks:
      - rebe-network
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - rebe-network
    restart: unless-stopped

  rebe-browser:
    image: rebe-browser:latest  # Assuming rebe-browser has a Docker image
    ports:
      - "8080:8080"
    networks:
      - rebe-network
    restart: unless-stopped

networks:
  rebe-network:
    driver: bridge
```

**Deploy**:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Option 3: Kubernetes Deployment

**k8s/deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rebe-shell-backend
  namespace: rebe
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rebe-shell-backend
  template:
    metadata:
      labels:
        app: rebe-shell-backend
    spec:
      containers:
      - name: backend
        image: your-registry/rebe-shell-backend:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: RUST_LOG
          value: "info"
        - name: SSH_KEY_PATH
          value: "/ssh-keys/id_rsa"
        volumeMounts:
        - name: ssh-keys
          mountPath: /ssh-keys
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: ssh-keys
        secret:
          secretName: ssh-keys
          defaultMode: 0400

---
apiVersion: v1
kind: Service
metadata:
  name: rebe-shell-backend
  namespace: rebe
spec:
  selector:
    app: rebe-shell-backend
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rebe-shell-frontend
  namespace: rebe
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rebe-shell-frontend
  template:
    metadata:
      labels:
        app: rebe-shell-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/rebe-shell-frontend:v2.0.0
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"

---
apiVersion: v1
kind: Service
metadata:
  name: rebe-shell-frontend
  namespace: rebe
spec:
  selector:
    app: rebe-shell-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

**Deploy**:

```bash
# Create namespace
kubectl create namespace rebe

# Create SSH key secret
kubectl create secret generic ssh-keys \
  --from-file=id_rsa=$HOME/.ssh/id_rsa \
  -n rebe

# Deploy
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n rebe
kubectl get svc -n rebe

# View logs
kubectl logs -f deployment/rebe-shell-backend -n rebe
```

---

## Configuration

### Backend Configuration

**Environment Variables**:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BACKEND_HOST` | Bind address | `127.0.0.1` | No |
| `BACKEND_PORT` | Port to listen on | `3000` | No |
| `SSH_KEY_PATH` | Path to SSH private key | `~/.ssh/id_rsa` | Yes (for SSH) |
| `SSH_POOL_MAX_CONNECTIONS` | Max SSH connections per host | `10` | No |
| `SSH_POOL_IDLE_TIMEOUT` | Idle connection timeout (seconds) | `300` | No |
| `REBE_BROWSER_URL` | rebe-browser service URL | `http://localhost:8080` | Yes (for browser) |
| `RUST_LOG` | Log level | `info` | No |
| `CIRCUIT_BREAKER_THRESHOLD` | Failures before opening | `5` | No |
| `CIRCUIT_BREAKER_TIMEOUT` | Recovery timeout (seconds) | `60` | No |

**Example Production Config**:

```bash
BACKEND_HOST=0.0.0.0
BACKEND_PORT=3000
SSH_KEY_PATH=/opt/rebe-shell/ssh/id_rsa
SSH_POOL_MAX_CONNECTIONS=50
SSH_POOL_IDLE_TIMEOUT=600
REBE_BROWSER_URL=http://rebe-browser-service:8080
RUST_LOG=info,rebe_shell_backend=info,rebe_core=info
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_TIMEOUT=120
```

### Frontend Configuration

**Vite Config** (`vite.config.ts`):

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,  // WebSocket proxy
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,  // Disable in production
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'xterm': ['xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
        }
      }
    }
  }
});
```

### Nginx Configuration

**/etc/nginx/sites-available/rebe-shell**:

```nginx
upstream rebe_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name rebe-shell.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rebe-shell.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rebe-shell.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rebe-shell.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend
    root /var/www/rebe-shell;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://rebe_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health check
    location /health {
        proxy_pass http://rebe_backend;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

**Enable and reload**:

```bash
sudo ln -s /etc/nginx/sites-available/rebe-shell /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Systemd Service

**/etc/systemd/system/rebe-shell.service**:

```ini
[Unit]
Description=reBe Shell Backend
After=network.target

[Service]
Type=simple
User=rebe
Group=rebe
WorkingDirectory=/opt/rebe-shell
Environment="RUST_LOG=info"
Environment="SSH_KEY_PATH=/opt/rebe-shell/ssh/id_rsa"
Environment="BACKEND_PORT=3000"
Environment="REBE_BROWSER_URL=http://localhost:8080"
ExecStart=/opt/rebe-shell/rebe-shell-backend
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/rebe-shell/logs

[Install]
WantedBy=multi-user.target
```

**Enable and start**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rebe-shell
sudo systemctl start rebe-shell
sudo systemctl status rebe-shell
```

---

## Verification

### 1. Backend Health Check

```bash
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "version": "2.0.0",
  "features": {
    "pty": true,
    "ssh_pooling": true,
    "browser": true,
    "circuit_breaker": true
  }
}
```

### 2. Create PTY Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response:
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. SSH Execution

```bash
curl -X POST http://localhost:3000/api/ssh/execute \
  -H "Content-Type: application/json" \
  -d '{
    "host": "your-server.com",
    "user": "youruser",
    "command": "echo test"
  }'

# Expected response:
{
  "output": "test\n",
  "exit_code": 0,
  "execution_time_ms": 123
}
```

### 4. Run Integration Tests

```bash
node tests/integration.test.js

# All tests should pass
```

### 5. Frontend Access

Open browser: `http://localhost:5173` (dev) or `http://your-domain.com` (prod)

Expected features:
- Terminal loads and accepts input
- SSH panel visible with connection form
- Browser panel visible with URL/script inputs
- Status panel shows "Healthy" with green indicators

---

## Monitoring

### Logs

**Backend Logs** (systemd):

```bash
journalctl -u rebe-shell -f
journalctl -u rebe-shell --since "1 hour ago"
```

**Backend Logs** (Docker):

```bash
docker-compose logs -f backend
```

**Log Levels**:

```bash
# Debug (verbose)
RUST_LOG=debug cargo run

# Info (default)
RUST_LOG=info cargo run

# Production (minimal)
RUST_LOG=warn,rebe_shell_backend=info cargo run
```

### Metrics

**Health Endpoint** (`/health`):

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime_seconds": 3600,
  "features": {
    "pty": true,
    "ssh_pooling": true,
    "browser": true,
    "circuit_breaker": true
  },
  "stats": {
    "active_sessions": 5,
    "ssh_pool_size": 10,
    "circuit_breakers_open": 0
  }
}
```

### Prometheus Integration

**metrics.rs** (add to backend):

```rust
use prometheus::{Encoder, TextEncoder, Counter, Gauge};

lazy_static! {
    static ref HTTP_REQUESTS: Counter = Counter::new(
        "http_requests_total", "Total HTTP requests"
    ).unwrap();

    static ref ACTIVE_SESSIONS: Gauge = Gauge::new(
        "active_pty_sessions", "Active PTY sessions"
    ).unwrap();

    static ref SSH_POOL_SIZE: Gauge = Gauge::new(
        "ssh_pool_connections", "SSH pool connections"
    ).unwrap();
}

// Endpoint: GET /metrics
async fn metrics_handler() -> impl IntoResponse {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    buffer
}
```

**Prometheus Config** (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'rebe-shell'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard

Create dashboard with panels:
- Active PTY sessions (gauge)
- SSH pool size (gauge)
- Circuit breakers status (gauge)
- HTTP requests rate (graph)
- Response time (graph)
- Error rate (graph)

---

## Troubleshooting

### Backend Won't Start

**Issue**: `Error: Address already in use`

**Solution**:

```bash
# Find process using port 3000
lsof -i :3000
sudo kill -9 <PID>

# Or change port
BACKEND_PORT=3001 cargo run
```

---

**Issue**: `SSH key not found`

**Solution**:

```bash
# Generate SSH key if missing
ssh-keygen -t ed25519 -f ~/.ssh/id_rsa -N ""

# Or specify custom path
SSH_KEY_PATH=/path/to/key cargo run
```

### WebSocket Connection Fails

**Issue**: `WebSocket connection to 'ws://localhost:3000/api/sessions/xxx/ws' failed`

**Solution**:

1. Check backend supports WebSocket:
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     http://localhost:3000/api/sessions/test/ws
   ```

2. Check nginx WebSocket proxy config (if using nginx):
   ```nginx
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

3. Check firewall allows WebSocket:
   ```bash
   sudo ufw allow 3000/tcp
   ```

### SSH Execution Fails

**Issue**: `SSH connection failed: Authentication failed`

**Solution**:

1. Check SSH key permissions:
   ```bash
   chmod 600 ~/.ssh/id_rsa
   ```

2. Add key to SSH agent:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_rsa
   ```

3. Test SSH manually:
   ```bash
   ssh -i ~/.ssh/id_rsa user@host echo test
   ```

### High Memory Usage

**Issue**: Backend using excessive memory

**Solution**:

1. Check streaming handler limits in `rebe-core/src/stream/mod.rs`
2. Reduce `SSH_POOL_MAX_CONNECTIONS`
3. Implement connection TTL:
   ```bash
   SSH_POOL_IDLE_TIMEOUT=60  # Shorter timeout
   ```

---

## Scaling

### Horizontal Scaling

**Load Balancer** (nginx):

```nginx
upstream rebe_backend_cluster {
    least_conn;
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    location /api {
        proxy_pass http://rebe_backend_cluster;
    }
}
```

**Kubernetes HPA**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rebe-shell-backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rebe-shell-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Scaling

Increase resources per instance:

```bash
# Systemd service
[Service]
Environment="SSH_POOL_MAX_CONNECTIONS=100"
Environment="TOKIO_WORKER_THREADS=8"

# Docker
docker run -e SSH_POOL_MAX_CONNECTIONS=100 \
  --cpus="4" --memory="8g" \
  rebe-shell-backend
```

### Performance Tuning

**Backend** (`Cargo.toml`):

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

**Linux Kernel**:

```bash
# Increase max file descriptors
ulimit -n 65536

# Increase max connections
sudo sysctl -w net.core.somaxconn=4096

# TCP tuning
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=8192
```

---

## Security

### TLS/SSL Configuration

**Let's Encrypt** (automatic):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d rebe-shell.example.com
sudo certbot renew --dry-run  # Test renewal
```

### SSH Key Management

**Best Practices**:

1. Use ED25519 keys:
   ```bash
   ssh-keygen -t ed25519 -f /opt/rebe-shell/ssh/id_rsa -N ""
   ```

2. Restrict key permissions:
   ```bash
   chmod 600 /opt/rebe-shell/ssh/id_rsa
   chown rebe:rebe /opt/rebe-shell/ssh/id_rsa
   ```

3. Use separate keys per environment
4. Rotate keys regularly
5. Store keys in secrets management (Vault, AWS Secrets Manager)

### Network Security

**Firewall** (ufw):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw deny 3000/tcp  # Backend should be behind nginx
sudo ufw enable
```

**SELinux** (RHEL/Rocky):

```bash
sudo semanage port -a -t http_port_t -p tcp 3000
sudo setsebool -P httpd_can_network_connect 1
```

### Application Security

1. **Rate Limiting** (nginx):

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api {
    limit_req zone=api burst=20 nodelay;
}
```

2. **CORS** (backend):

```rust
use tower_http::cors::CorsLayer;

let app = Router::new()
    .layer(CorsLayer::new()
        .allow_origin("https://rebe-shell.example.com".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST])
    );
```

3. **Authentication** (future):

```rust
use axum_auth::AuthBearer;

async fn protected_handler(AuthBearer(token): AuthBearer) -> impl IntoResponse {
    // Verify JWT token
}
```

---

## Summary

**Quick Deployment Checklist**:

- [ ] Install Rust and Node.js
- [ ] Clone repository
- [ ] Build backend: `cargo build --release`
- [ ] Build frontend: `npm run build`
- [ ] Configure environment variables
- [ ] Set up systemd service
- [ ] Configure nginx reverse proxy
- [ ] Enable TLS/SSL
- [ ] Run integration tests
- [ ] Monitor logs
- [ ] Set up metrics/alerting

**Production Readiness**:

- ✅ Optimized release builds
- ✅ Systemd service with auto-restart
- ✅ Nginx reverse proxy with TLS
- ✅ Health checks and monitoring
- ✅ Integration tests
- ✅ Horizontal scaling support
- ✅ Security hardening

**Support**:

- Documentation: See `/docs` directory
- Issues: https://github.com/your-org/rebe-shell/issues
- Slack: #rebe-shell channel

---

**Deployment Status**: ✅ Production Ready
