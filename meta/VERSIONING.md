# Versioning Strategy

**Purpose**: Document the 5-layer versioning model for theCy+reBe ecosystem

---

## Overview

The versioning strategy follows a 5-layer model where each layer has a distinct source of truth and versioning mechanism. This provides complete traceability from code changes to operational decisions.

**Compliance**: 5±2 Rule (Miller's Law) - Exactly 5 layers for cognitive manageability

---

## Layer 1: PLATFORM CODE (Git)

**Source of Truth**: Git repository (currently GitHub, future: Gitea on theCy substrate)

**What It Tracks**:
- Source code (Rust, TypeScript, etc)
- Configuration files
- Documentation
- Architecture Decision Records (ADRs)
- Test suites

**Versioning Scheme**: Semantic Versioning (SemVer)

```
v1.0.0 (web rewrite, breaking change from v0.x desktop)
v0.3.0 (desktop architecture with Tauri)
v0.2.0 (initial foundation)
v0.1.0 (project setup)
```

**Repository Structure**:
```
rebe-simulations/
├── conversations/           # Up to 7 concurrent development conversations
│   ├── 001-rebe-shell/
│   ├── 002-dog-platform/
│   ├── 003-realm-governance/
│   ├── 004-thecy-substrate/
│   ├── 005-rebe-economy/
│   ├── 006-one-network/
│   └── 007-rebe-applications/
├── components/              # Shared libraries (source)
├── assemblies/              # Built artifacts (binaries, containers)
├── deployments/             # Deployment configurations
├── shared/                  # Common scripts and configs
└── meta/                    # Meta documentation (this file)
```

**Branching Strategy**:
- `main` - Stable, production-ready code
- `develop` - Integration branch for conversations
- `conversation/NNN-name` - Individual conversation branches

**Tagging**:
- `v1.0.0` - Release tags (SemVer)
- `conversation-001-phase-2` - Conversation milestones

---

## Layer 2: CONFIGURATION (Consul KV)

**Source of Truth**: Consul Key-Value store

**What It Tracks**:
- Runtime configuration
- Feature flags
- Service endpoints
- Environment-specific settings

**Versioning Scheme**: Key-based with timestamps

```
/rebe-shell/config/backend-url               → "https://shell.rebe.dog"
/rebe-shell/config/dog-platform-endpoints    → {"prometheus": "...", "grafana": "..."}
/rebe-shell/config/feature-flags             → {"wasm-preview": true, "claude-integration": false}
/rebe-shell/config/version                   → "1.0.0"
/rebe-shell/config/updated-at                → "2025-10-20T18:00:00Z"
```

**Change Tracking**:
- Consul watches detect configuration changes
- Changes trigger service reloads (zero-downtime)
- Historical values stored with timestamps
- Rollback via restoring previous key values

**Access Control**:
- Read: All services
- Write: DoG and authorized operators only
- ACL tokens via Vault

---

## Layer 3: STATE (Prometheus + PostgreSQL)

**Source of Truth**: Time-series database (Prometheus) + Relational database (PostgreSQL/CockroachDB)

**What It Tracks**:
- Active sessions
- Resource usage (CPU, memory, network)
- Service health
- Performance metrics

**Versioning Scheme**: Time-series with timestamps

### Prometheus Metrics
```
# Active sessions
session_active{user="dev1", realm="000001", conversation="001"} 1

# Resource usage
rebe_shell_memory_bytes{instance="shell-backend-1"} 524288000
rebe_shell_cpu_seconds_total{instance="shell-backend-1"} 3600.5

# Request metrics
rebe_shell_requests_total{method="execute", status="success"} 12543
rebe_shell_request_duration_seconds{method="execute", quantile="0.99"} 0.095
```

### PostgreSQL State
```sql
-- Session state
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255),
    realm_id VARCHAR(255),
    conversation_id VARCHAR(255),
    created_at TIMESTAMP,
    last_active_at TIMESTAMP,
    state JSONB
);

-- Connection pool state
CREATE TABLE ssh_connections (
    id UUID PRIMARY KEY,
    host VARCHAR(255),
    port INTEGER,
    state VARCHAR(50),  -- idle, active, closed
    created_at TIMESTAMP,
    last_used_at TIMESTAMP
);
```

**Retention Policy**:
- Prometheus: 30 days (raw), 1 year (downsampled)
- PostgreSQL: Indefinite with archival to S3/GCS

---

## Layer 4: EVENTS (Kafka)

**Source of Truth**: Event stream (Kafka topics)

**What It Tracks**:
- Session lifecycle events
- Command execution events
- Authentication events
- System events

**Versioning Scheme**: Event stream with offsets and timestamps

### Topics and Schema

#### Topic: `shell-session-events`
```json
{
  "version": "1.0",
  "timestamp": "2025-10-20T18:00:00Z",
  "event_type": "SessionStarted",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "dev1",
  "realm_id": "000001",
  "conversation_id": "001",
  "metadata": {
    "client_ip": "10.20.31.42",
    "user_agent": "Mozilla/5.0..."
  }
}
```

#### Topic: `shell-command-events`
```json
{
  "version": "1.0",
  "timestamp": "2025-10-20T18:00:05Z",
  "event_type": "CommandExecuted",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "command": {
    "type": "system_info",
    "fields": ["hostname", "cpu_info"]
  },
  "execution": {
    "mode": "ssh",
    "host": "10.20.31.5",
    "duration_ms": 45,
    "status": "success"
  },
  "metadata": {
    "output_size_bytes": 2048,
    "from_cache": false
  }
}
```

#### Topic: `shell-auth-events`
```json
{
  "version": "1.0",
  "timestamp": "2025-10-20T17:59:55Z",
  "event_type": "UserLoggedIn",
  "user_id": "dev1",
  "realm_id": "000001",
  "auth_method": "vault_token",
  "success": true,
  "metadata": {
    "client_ip": "10.20.31.42",
    "mfa_used": true
  }
}
```

**Retention Policy**:
- 90 days in Kafka (configurable)
- Indefinite in S3/GCS (archival)

**Consumer Groups**:
- `analytics` - Real-time analytics and dashboards
- `audit` - Compliance and audit logging
- `alerting` - Anomaly detection and alerts

---

## Layer 5: DECISIONS (Audit Log)

**Source of Truth**: Immutable audit log (PostgreSQL + S3/GCS)

**What It Tracks**:
- Every command executed
- Every session created/destroyed
- Every authentication attempt
- Every configuration change
- Every deployment

**Versioning Scheme**: Append-only log with sequential IDs

### Schema

#### Table: `command_audit`
```sql
CREATE TABLE command_audit (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    session_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    realm_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255),
    command JSONB NOT NULL,
    execution JSONB NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_command_audit_user ON command_audit(user_id);
CREATE INDEX idx_command_audit_realm ON command_audit(realm_id);
CREATE INDEX idx_command_audit_timestamp ON command_audit(timestamp);
```

#### Table: `session_audit`
```sql
CREATE TABLE session_audit (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    session_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    realm_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- created, ended, failed
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Table: `access_audit`
```sql
CREATE TABLE access_audit (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    realm_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,  -- login, logout, auth_failed
    auth_method VARCHAR(50),
    success BOOLEAN NOT NULL,
    client_ip INET,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Immutability Guarantees**:
- No UPDATE or DELETE allowed (database triggers prevent)
- Append-only inserts
- Regular snapshots to S3/GCS (encrypted)
- Integration with Thing's Blockchain for cryptographic proofs

**Retention Policy**:
- PostgreSQL: 1 year (hot storage)
- S3/GCS: Indefinite (cold storage)
- Thing's Blockchain: Permanent (proofs only)

---

## Cross-Layer Correlation

Every event/action can be traced across all 5 layers:

### Example: Command Execution Trace

**Layer 1 (Git)**: Code version
```
Commit: a1b2c3d4
Tag: v1.0.0
File: src-tauri/src/protocol/mod.rs:142
```

**Layer 2 (Consul)**: Configuration
```
/rebe-shell/config/dog-platform-endpoints → {"prometheus": "http://prometheus:9090"}
/rebe-shell/config/feature-flags → {"wasm-preview": true}
```

**Layer 3 (Prometheus)**: State
```
session_active{session_id="550e8400"} 1
rebe_shell_requests_total{method="execute", status="success"} 12543
```

**Layer 4 (Kafka)**: Event
```json
{
  "event_type": "CommandExecuted",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-20T18:00:05Z"
}
```

**Layer 5 (Audit)**: Decision
```sql
INSERT INTO command_audit (session_id, user_id, command, result)
VALUES ('550e8400...', 'dev1', '{"type": "system_info"}', '{"status": "success"}')
```

**Correlation ID**: `550e8400-e29b-41d4-a716-446655440000` (session ID)

All layers can be queried using this ID to get complete trace of what happened, when, why, and by whom.

---

## Migration Strategy

### Current State
- Git: GitHub (private repositories)
- Configuration: Not yet implemented
- State: Not yet implemented
- Events: Not yet implemented
- Audit: Not yet implemented

### Target State (6-12 months)
- Git: Gitea on theCy substrate
- Configuration: Consul KV
- State: Prometheus + CockroachDB
- Events: Kafka
- Audit: CockroachDB + S3 + Thing's Blockchain

### Migration Phases

**Phase 1: Foundation (Current)**
- Git on GitHub
- Local development and testing

**Phase 2: Observability (Months 1-2)**
- Deploy Prometheus
- Implement metrics collection
- Set up Grafana dashboards

**Phase 3: Configuration Management (Months 2-3)**
- Deploy Consul
- Migrate configuration to Consul KV
- Implement watches and reloads

**Phase 4: Event Streaming (Months 3-4)**
- Deploy Kafka
- Implement event publishers
- Set up consumer groups

**Phase 5: Audit Logging (Months 4-6)**
- Deploy PostgreSQL/CockroachDB
- Implement audit logging
- S3/GCS archival

**Phase 6: Blockchain Integration (Months 6-12)**
- Integrate Thing's Blockchain
- Cryptographic proofs of audit logs
- Immutable reference layer

**Phase 7: Self-Hosting (Months 12+)**
- Migrate from GitHub to Gitea
- Full stack on theCy substrate
- Complete autonomy

---

## References

- **Related Meta Docs**: CONVERSATIONS.md, BLOCKCHAIN.md, ARTIFACTS.md
- **Architecture Docs**: conversations/001-rebe-shell/ARCHITECTURE.md
- **ADRs**: conversations/001-rebe-shell/docs/DECISIONS.md

---

**Last Updated**: 2025-10-20
**Version**: 1.0
**Status**: Living document
