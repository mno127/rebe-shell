# Artifacts

**Purpose**: Document the 5-stage artifact lifecycle and storage strategy for theCy+reBe ecosystem

---

## Overview

Artifacts progress through a **5-stage lifecycle** from source code to archived binaries. Each stage has a specific location in the repository structure and versioning strategy.

**Compliance**: 5±2 Rule (Miller's Law) - Exactly 5 stages for cognitive manageability

---

## The 5 Stages

```
SOURCE → BUILT → DEPLOYED → DISCOVERED → ARCHIVED
  ↓        ↓        ↓           ↓            ↓
 /conversations  /assemblies  /deployments  /meta  /archived
 /components                  (runtime)
```

---

## Stage 1: SOURCE (Source Code)

**Location**: `/conversations/` and `/components/`

**What It Contains**:
- Source code (Rust, TypeScript, Python, etc.)
- Configuration files
- Documentation
- Tests
- Build scripts

**Versioning**: Git commits and tags

### Structure

#### Conversations (Projects)
```
conversations/
├── 001-rebe-shell/
│   ├── src-tauri/src/          # Rust backend source
│   ├── src/                    # TypeScript frontend source
│   ├── tests/                  # Test source
│   ├── Cargo.toml              # Rust dependencies
│   ├── package.json            # JS dependencies
│   └── README.md               # Conversation documentation
├── 002-dog-platform/
├── 003-realm-governance/
└── ...
```

#### Components (Libraries)
```
components/
├── protocol/
│   ├── src/                    # Rust source
│   ├── Cargo.toml              # Dependencies
│   └── README.md               # Component documentation
├── types/
│   ├── src/
│   ├── Cargo.toml
│   └── README.md
└── utils/
    ├── src/
    ├── Cargo.toml
    └── README.md
```

**Artifact Types**:
- **Applications**: End-user programs (e.g., rebe-shell web app)
- **Components**: Reusable libraries (e.g., protocol, types)
- **Services**: Long-running processes (e.g., rebe-shell backend)
- **Scripts**: Automation and utilities (e.g., deployment scripts)

---

## Stage 2: BUILT (Compiled Artifacts)

**Location**: `/assemblies/`

**What It Contains**:
- Compiled binaries
- Container images
- JavaScript bundles
- WASM modules
- Release packages

**Versioning**: Artifact hash (SHA-256) + semantic version

### Structure

```
assemblies/
├── binaries/
│   ├── rebe-shell-backend-v1.0.0-linux-x86_64
│   ├── rebe-shell-backend-v1.0.0-darwin-arm64
│   └── rebe-shell-backend-v1.0.0-windows-x86_64.exe
├── containers/
│   ├── rebe-shell-backend-v1.0.0.tar.gz
│   ├── rebe-shell-frontend-v1.0.0.tar.gz
│   └── manifests/
│       ├── rebe-shell-backend-v1.0.0.json
│       └── rebe-shell-frontend-v1.0.0.json
├── bundles/
│   ├── rebe-shell-frontend-v1.0.0.js
│   ├── rebe-shell-frontend-v1.0.0.css
│   └── rebe-shell-frontend-v1.0.0.wasm
└── checksums/
    ├── rebe-shell-backend-v1.0.0.sha256
    └── rebe-shell-frontend-v1.0.0.sha256
```

### Build Process

**Rust Backend**:
```bash
# Build release binary
cd conversations/001-rebe-shell/src-tauri
cargo build --release --target x86_64-unknown-linux-gnu

# Copy to assemblies
cp target/release/rebe-shell-backend \
   ../../../../assemblies/binaries/rebe-shell-backend-v1.0.0-linux-x86_64

# Generate checksum
sha256sum assemblies/binaries/rebe-shell-backend-v1.0.0-linux-x86_64 \
   > assemblies/checksums/rebe-shell-backend-v1.0.0.sha256
```

**Container Image**:
```bash
# Build Docker image
docker build -t rebe-shell-backend:v1.0.0 \
   -f conversations/001-rebe-shell/Dockerfile .

# Save image
docker save rebe-shell-backend:v1.0.0 | gzip \
   > assemblies/containers/rebe-shell-backend-v1.0.0.tar.gz

# Generate manifest
docker inspect rebe-shell-backend:v1.0.0 \
   > assemblies/containers/manifests/rebe-shell-backend-v1.0.0.json
```

**Frontend Bundle**:
```bash
# Build frontend
cd conversations/001-rebe-shell
npm run build

# Copy to assemblies
cp dist/assets/*.js assemblies/bundles/rebe-shell-frontend-v1.0.0.js
cp dist/assets/*.css assemblies/bundles/rebe-shell-frontend-v1.0.0.css
cp dist/assets/*.wasm assemblies/bundles/rebe-shell-frontend-v1.0.0.wasm
```

### Artifact Metadata

**Format**: JSON manifest alongside each artifact

```json
{
  "artifact": {
    "name": "rebe-shell-backend",
    "version": "1.0.0",
    "type": "binary",
    "platform": "linux-x86_64",
    "checksum": "sha256:abcd1234...",
    "size_bytes": 15728640
  },
  "source": {
    "conversation": "001-rebe-shell",
    "git_commit": "a1b2c3d4e5f6",
    "git_tag": "v1.0.0",
    "build_date": "2025-10-20T18:00:00Z",
    "builder": "DoG CI/CD"
  },
  "dependencies": [
    {"name": "protocol", "version": "1.0.0"},
    {"name": "types", "version": "1.0.0"},
    {"name": "tokio", "version": "1.35"}
  ],
  "blockchain_proof": "0x1234abcd..."
}
```

---

## Stage 3: DEPLOYED (Running Artifacts)

**Location**: `/deployments/` (configurations) + Runtime environment

**What It Contains**:
- Deployment configurations (Docker Compose, Kubernetes, Nomad)
- Environment-specific settings
- Service definitions
- Infrastructure as Code (IaC)

**Versioning**: Configuration version + deployed artifact version

### Structure

```
deployments/
├── docker-compose/
│   ├── rebe-shell.yml
│   ├── dog-platform.yml
│   └── .env.example
├── kubernetes/
│   ├── rebe-shell/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   └── configmap.yaml
│   └── dog-platform/
│       ├── prometheus.yaml
│       ├── grafana.yaml
│       └── consul.yaml
└── nomad/
    ├── rebe-shell.hcl
    └── dog-platform.hcl
```

### Deployment Configurations

**Docker Compose**:
```yaml
# deployments/docker-compose/rebe-shell.yml
version: '3.8'
services:
  rebe-shell-backend:
    image: ghcr.io/rebe-platform/rebe-shell-backend:v1.0.0
    ports:
      - "3000:3000"
    environment:
      - DOG_PROMETHEUS_URL=http://prometheus:9090
      - DOG_GRAFANA_URL=http://grafana:3000
      - RUST_LOG=info
    volumes:
      - ./data:/data
    restart: unless-stopped

  rebe-shell-frontend:
    image: ghcr.io/rebe-platform/rebe-shell-frontend:v1.0.0
    ports:
      - "443:443"
    environment:
      - BACKEND_URL=http://rebe-shell-backend:3000
    depends_on:
      - rebe-shell-backend
    restart: unless-stopped
```

**Kubernetes**:
```yaml
# deployments/kubernetes/rebe-shell/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rebe-shell-backend
  namespace: rebe-shell
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rebe-shell-backend
  template:
    metadata:
      labels:
        app: rebe-shell-backend
        version: v1.0.0
    spec:
      containers:
      - name: backend
        image: ghcr.io/rebe-platform/rebe-shell-backend:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DOG_PROMETHEUS_URL
          valueFrom:
            configMapKeyRef:
              name: dog-config
              key: prometheus-url
        resources:
          limits:
            cpu: "2"
            memory: "4Gi"
          requests:
            cpu: "1"
            memory: "2Gi"
```

**Nomad**:
```hcl
# deployments/nomad/rebe-shell.hcl
job "rebe-shell" {
  datacenters = ["dc1"]
  type = "service"

  group "backend" {
    count = 3

    task "rebe-shell-backend" {
      driver = "docker"

      config {
        image = "ghcr.io/rebe-platform/rebe-shell-backend:v1.0.0"
        ports = ["http"]
      }

      resources {
        cpu    = 1000
        memory = 2048
      }

      env {
        DOG_PROMETHEUS_URL = "http://prometheus.service.consul:9090"
      }
    }
  }
}
```

### Runtime State

**Location**: Managed by orchestrator (Docker, Kubernetes, Nomad)

**What It Tracks**:
- Running containers/pods
- Resource allocation (CPU, memory, network)
- Health status
- Logs and metrics

**Access**: Via orchestrator CLI or API
```bash
# Docker
docker ps
docker logs rebe-shell-backend

# Kubernetes
kubectl get pods -n rebe-shell
kubectl logs -n rebe-shell deployment/rebe-shell-backend

# Nomad
nomad status rebe-shell
nomad logs rebe-shell backend rebe-shell-backend
```

---

## Stage 4: DISCOVERED (Observed Artifacts)

**Location**: `/meta/discovery/` (inventory) + Layer 3 (Prometheus + PostgreSQL)

**What It Contains**:
- Service discovery data
- Auto-discovered resources
- Dependency graphs
- Health check results
- Performance metrics

**Versioning**: Discovery timestamp + artifact version

### Structure

```
meta/
└── discovery/
    ├── services.json          # Discovered services
    ├── nodes.json             # Discovered nodes
    ├── dependencies.json      # Service dependencies
    └── topology.json          # Network topology
```

### Discovery Data

**Service Registry** (Consul):
```json
{
  "service": "rebe-shell-backend",
  "id": "rebe-shell-backend-01",
  "address": "10.20.31.42",
  "port": 3000,
  "tags": ["v1.0.0", "production", "conversation-001"],
  "meta": {
    "version": "1.0.0",
    "git_commit": "a1b2c3d4",
    "deployed_at": "2025-10-20T18:00:00Z"
  },
  "checks": [
    {
      "id": "health",
      "status": "passing",
      "output": "HTTP 200 OK"
    }
  ]
}
```

**Node Inventory**:
```json
{
  "nodes": [
    {
      "id": "node-000001",
      "hostname": "rebe-node-1.realm-000001.rebe.dog",
      "ip": "10.20.31.5",
      "realm_id": "000001",
      "services": ["rebe-shell-backend", "prometheus"],
      "resources": {
        "cpu_cores": 8,
        "memory_gb": 32,
        "storage_gb": 512
      },
      "last_seen": "2025-10-20T18:00:00Z"
    }
  ]
}
```

**Dependency Graph**:
```json
{
  "services": {
    "rebe-shell-frontend": {
      "depends_on": ["rebe-shell-backend"]
    },
    "rebe-shell-backend": {
      "depends_on": ["prometheus", "consul", "vault"]
    },
    "prometheus": {
      "depends_on": ["consul"]
    }
  }
}
```

### Discovery Process

**Service Discovery Flow**:
1. Service starts and registers with Consul
2. Consul adds service to registry
3. Health checks begin (every 10 seconds)
4. Prometheus scrapes metrics (every 15 seconds)
5. Discovery service aggregates data
6. Topology updated in meta/discovery/

**Auto-Discovery**:
```rust
// Pseudocode for discovery service
async fn discover_services() -> Result<()> {
    loop {
        // Query Consul for all services
        let services = consul.catalog().services().await?;

        // Query Prometheus for metrics
        let metrics = prometheus.query("up").await?;

        // Build dependency graph
        let dependencies = build_dependency_graph(&services).await?;

        // Write to meta/discovery/
        fs::write("meta/discovery/services.json", serde_json::to_string(&services)?)?;
        fs::write("meta/discovery/dependencies.json", serde_json::to_string(&dependencies)?)?;

        // Sleep for 60 seconds
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
```

---

## Stage 5: ARCHIVED (Historical Artifacts)

**Location**: `/archived/` (local) + S3/GCS (cold storage)

**What It Contains**:
- Deprecated artifacts
- Historical binaries
- Old configurations
- Archived conversations (>6 months stable)

**Versioning**: Archive timestamp + original version

### Structure

```
archived/
├── conversations/
│   └── 001-rebe-shell-v0.3.0-desktop/  # Deprecated Tauri version
│       ├── src-tauri/
│       ├── src/
│       └── README.md
├── assemblies/
│   └── 2025/
│       └── 10/
│           ├── rebe-shell-backend-v0.3.0-linux-x86_64
│           └── rebe-shell-backend-v0.3.0-darwin-arm64
└── deployments/
    └── 2025/
        └── 10/
            └── rebe-shell-tauri.yml
```

### Archival Process

**When to Archive**:
- Conversation complete and stable for >6 months
- No active development or usage
- Superseded by newer version
- Compliance retention period ended

**Process**:
```bash
# 1. Tag for archival
git tag archive/conversation-001-v0.3.0

# 2. Move to archived/
git mv conversations/001-rebe-shell-v0.3.0-desktop \
   archived/conversations/001-rebe-shell-v0.3.0-desktop

# 3. Compress assemblies
tar -czf archived/assemblies/2025/10/rebe-shell-v0.3.0.tar.gz \
   assemblies/binaries/rebe-shell-*-v0.3.0-*

# 4. Upload to cold storage
aws s3 cp archived/assemblies/2025/10/rebe-shell-v0.3.0.tar.gz \
   s3://rebe-artifacts-archive/2025/10/

# 5. Update blockchain
record_archival_transaction(
   "conversation-001-v0.3.0",
   "archived due to superseded by v1.0.0 web architecture"
)

# 6. Commit
git commit -m "archive: Conversation 001 v0.3.0 desktop version"
```

### Retention Policy

**By Artifact Type**:
- **Source Code**: Indefinite (git history)
- **Binaries**: 2 years (compliance), then cold storage
- **Containers**: 1 year (last 3 versions), then delete
- **Logs**: 90 days hot, 1 year warm, 7 years cold (compliance)
- **Metrics**: 30 days raw, 1 year aggregated, 5 years archived

---

## Cross-Stage Traceability

Every artifact can be traced across all 5 stages using metadata:

### Example: rebe-shell-backend v1.0.0

**Stage 1 (Source)**:
```
Location: conversations/001-rebe-shell/src-tauri/src/main.rs
Git Commit: a1b2c3d4e5f6
Git Tag: v1.0.0
```

**Stage 2 (Built)**:
```
Location: assemblies/binaries/rebe-shell-backend-v1.0.0-linux-x86_64
Checksum: sha256:abcd1234...
Build Date: 2025-10-20T18:00:00Z
```

**Stage 3 (Deployed)**:
```
Configuration: deployments/kubernetes/rebe-shell/deployment.yaml
Container: ghcr.io/rebe-platform/rebe-shell-backend:v1.0.0
Running On: node-000001.realm-000001.rebe.dog
```

**Stage 4 (Discovered)**:
```
Service ID: rebe-shell-backend-01
Consul Registration: services/rebe-shell-backend
Prometheus Metrics: rebe_shell_requests_total{instance="rebe-shell-backend-01"}
```

**Stage 5 (Archived)**:
```
Archive Location: s3://rebe-artifacts-archive/2026/10/rebe-shell-backend-v1.0.0.tar.gz
Archive Date: 2026-10-20 (1 year after deprecation)
Blockchain Proof: 0x1234abcd...
```

**Query by Correlation ID**:
```bash
# Using git commit hash
./scripts/trace-artifact.sh a1b2c3d4e5f6

# Output:
# Stage 1: conversations/001-rebe-shell commit a1b2c3d4
# Stage 2: assemblies/binaries/rebe-shell-backend-v1.0.0-linux-x86_64
# Stage 3: deployed on node-000001 as rebe-shell-backend-01
# Stage 4: discovered in Consul, healthy, serving traffic
# Stage 5: not yet archived
```

---

## Artifact Types Taxonomy

### Applications
**Definition**: End-user programs with UI

**Examples**:
- rebe-shell web app (frontend + backend)
- rebe-applications (for technically illiterate users)
- Monitoring dashboards

**Location**: `conversations/NNN-name/`

---

### Components
**Definition**: Reusable libraries (no main entry point)

**Examples**:
- protocol (shared protocol definitions)
- types (common type definitions)
- utils (utility functions)

**Location**: `components/name/`

---

### Assemblies
**Definition**: Built artifacts ready for deployment

**Examples**:
- Binaries (ELF, Mach-O, PE)
- Container images (Docker)
- JavaScript bundles
- WASM modules

**Location**: `assemblies/`

---

### Services
**Definition**: Long-running processes

**Examples**:
- rebe-shell backend (WebSocket server)
- Prometheus (metrics collection)
- Consul (service discovery)

**Location**: Source in `conversations/` or `components/`, deployed via `deployments/`

---

### Scripts
**Definition**: Automation and utilities

**Examples**:
- Build scripts (build-all.sh)
- Deployment scripts (deploy.sh)
- Testing scripts (test-all.sh)

**Location**: `shared/scripts/`

---

## Build Automation

### Workspace Build Script

```bash
#!/usr/bin/env bash
# shared/scripts/build-all.sh

set -euo pipefail

echo "Building all conversations..."

for conversation in conversations/*/; do
    echo "Building $(basename $conversation)..."

    # Build Rust backend if exists
    if [ -f "$conversation/src-tauri/Cargo.toml" ]; then
        cd "$conversation/src-tauri"
        cargo build --release
        cd ../..
    fi

    # Build frontend if exists
    if [ -f "$conversation/package.json" ]; then
        cd "$conversation"
        npm install
        npm run build
        cd ..
    fi
done

echo "Building shared components..."
cd components
for component in */; do
    echo "Building component $(basename $component)..."
    cd "$component"
    cargo build --release
    cd ..
done
cd ..

echo "All builds complete!"
```

---

## References

- **Related Meta Docs**: VERSIONING.md (Layer 1), CONVERSATIONS.md, BLOCKCHAIN.md
- **Deployment Docs**: deployments/README.md
- **Build Scripts**: shared/scripts/

---

**Last Updated**: 2025-10-20
**Version**: 1.0
**Status**: Living document
