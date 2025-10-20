# rebe-simulations

**A structured workspace for building, evolving, and simulating the theCy+reBe ecosystem through concurrent conversations.**

---

## Overview

`rebe-simulations` is a development workspace supporting up to **7 concurrent conversations** for designing, implementing, testing, and deploying components of the theCy+reBe platform.

**Cognitive Design**: Following Miller's Law (5±2 rule), the workspace maintains 3-7 active conversations to ensure:
- Clear focus per conversation
- Manageable context switching
- Complete documentation capture
- Systematic progress tracking

---

## What is theCy+reBe?

**theCy** (The Consciousness Yielded): The distributed substrate providing compute, storage, and network infrastructure across 1M+ realms.

**reBe** (Reality Being): The platform enabling 3M technically illiterate humans to manage complex infrastructure through autonomous robot agents.

**Together**: A planetary-scale system where humans express intent in natural language, and autonomous agents execute operations across millions of nodes with 100% reliability.

---

## Repository Structure

```
rebe-simulations/
├── conversations/          # Up to 7 concurrent development conversations
│   ├── 001-rebe-shell/     # Developer terminal environment (ACTIVE)
│   ├── 002-dog-platform/   # DoG observability and governance (PLANNED)
│   ├── 003-realm-governance/   # Multi-realm coordination (PLANNED)
│   ├── 004-thecy-substrate/    # Infrastructure substrate (PLANNED)
│   ├── 005-rebe-economy/       # Resource marketplace (PLANNED)
│   ├── 006-one-network/        # Unified network layer (PLANNED)
│   └── 007-rebe-applications/  # End-user applications (PLANNED)
│
├── components/             # Shared libraries used across conversations
│   ├── protocol/           # Shared protocol definitions
│   ├── types/              # Common type definitions
│   └── utils/              # Utility functions
│
├── assemblies/             # Built artifacts (binaries, containers, bundles)
│   ├── binaries/
│   ├── containers/
│   └── bundles/
│
├── deployments/            # Deployment configurations
│   ├── docker-compose/
│   ├── kubernetes/
│   └── nomad/
│
├── shared/                 # Common scripts and configurations
│   ├── scripts/            # Build, test, deploy automation
│   └── configs/            # Shared configuration templates
│
├── meta/                   # Meta documentation
│   ├── VERSIONING.md       # 5-layer versioning strategy
│   ├── CONVERSATIONS.md    # Conversation tracking and lifecycle
│   ├── BLOCKCHAIN.md       # Thing's Blockchain integration
│   └── ARTIFACTS.md        # 5-stage artifact lifecycle
│
├── README.md               # This file
├── VISION.md               # Strategic vision for theCy+reBe ecosystem
├── LICENSE                 # MIT license
└── .gitignore              # VCS exclusions
```

---

## Active Conversations

### 001: rebe-shell 🟢
**Status**: Active | **Phase**: Foundation → Web Architecture Pivot

Web-based terminal environment for developers to interact with the DoG (Distributed Observing Governor) and manage infrastructure at scale (20M+ nodes).

**Key Features**:
- Zero-installation access via URL (https://shell.rebe.dog)
- PTY Manager, SSH Connection Pool, Streaming Handler
- Circuit Breaker for fault tolerance
- Structured JSON protocol (no text parsing)
- O(n) memory complexity for large outputs

**Documentation**: [conversations/001-rebe-shell/README.md](conversations/001-rebe-shell/README.md)

---

### 002: dog-platform ⚪
**Status**: Planned | **Phase**: Not Started

The Distributed Observing Governor (DoG) - the autonomous entity that observes, governs, and manages distributed infrastructure.

**Planned Components**:
- Observability Stack (Prometheus + Grafana)
- Service Discovery (Consul + mDNS)
- Secrets Management (Vault)
- Traffic Routing (Traefik + FRRouting)
- Orchestration (Kubernetes/Nomad)

**Prerequisites**: conversations/001-rebe-shell

---

### 003: realm-governance ⚪
**Status**: Planned | **Phase**: Not Started

Multi-realm governance, coordination, and resource management across 1M+ realms with 3 humans and ~9 devices each.

**Scale Context**:
- 1M realms × 3 humans × 3 devices = 9M managed entities
- Distributed consensus and conflict resolution
- Resource allocation policies
- Inter-realm communication mesh

**Prerequisites**: conversations/002-dog-platform

---

### 004: thecy-substrate ⚪
**Status**: Planned | **Phase**: Not Started

The underlying substrate providing compute, storage, and network for the entire ecosystem. Includes migration from GitHub to self-hosted Gitea.

**Planned Components**:
- Compute Layer (containerization, workload management)
- Storage Layer (distributed file system, object storage)
- Network Layer (overlay networks, SDN)
- Code Hosting (Gitea on theCy)
- Blockchain Integration (Thing's Blockchain connector)

**Prerequisites**: conversations/002-dog-platform, conversations/003-realm-governance

---

### 005: rebe-economy ⚪
**Status**: Planned | **Phase**: Not Started

The CreationSubsumed economy - resource allocation, value exchange, and economic primitives for the reBe ecosystem.

**Planned Components**:
- Resource Marketplace (compute, storage, network trading)
- Value Exchange (tokens, credits, transactions)
- Work Distribution (task allocation, reward distribution)
- Economic Policies (pricing, incentives)
- Audit and Compliance

**Prerequisites**: conversations/003-realm-governance

---

### 006: one-network ⚪
**Status**: Planned | **Phase**: Not Started

The unified network layer connecting all realms, entities, and services across theCy+reBe.

**Scale Targets**:
- 1M realms interconnected
- Sub-100ms latency
- 99.99% uptime

**Planned Components**:
- Network Topology (mesh, star, hybrid)
- Routing Protocols (BGP, OSPF, custom)
- Service Mesh (Istio, Linkerd, custom)
- Network Security (zero trust, encryption)
- Performance Monitoring

**Prerequisites**: conversations/002-dog-platform, conversations/003-realm-governance

---

### 007: rebe-applications ⚪
**Status**: Planned | **Phase**: Not Started

End-user applications for the 3M technically illiterate humans. Simple, intuitive interfaces for complex infrastructure operations.

**Target Users**: 3M technically illiterate humans (NOT developers)

**Planned Components**:
- Natural Language Interface (Claude integration)
- Visual Workflows (drag-and-drop automation)
- Status Dashboards (real-time visibility)
- Notification System (alerts, updates, reports)
- Help and Learning (tutorials, AI assistance)

**Prerequisites**: All other conversations (001-006)

---

## Core Principles

### 1. Miller's Law (5±2 Rule)
All decompositions maintain 3-7 components for cognitive manageability.
- Conversations: Max 7 concurrent
- Components per conversation: 3-7
- Layers in versioning: Exactly 5
- Stages in artifact lifecycle: Exactly 5

### 2. Complete Documentation
Every conversation captures:
- **Cognition**: All design decisions and rationale
- **Being/Doing**: All entities and actions
- **Artifacts**: All code, configs, and builds
- **Beliefs**: Assumptions and principles
- **Purpose**: Why this exists
- **Intentions**: What we aim to achieve
- **Capabilities**: What it can and cannot do
- **Utility**: Real-world usefulness
- **Consequences**: Aftermath of decisions

### 3. 5-Layer Versioning

**Layer 1**: Platform Code (Git)
- Source code, documentation, ADRs

**Layer 2**: Configuration (Consul KV)
- Runtime config, feature flags, endpoints

**Layer 3**: State (Prometheus + PostgreSQL)
- Active sessions, resource usage, metrics

**Layer 4**: Events (Kafka)
- Session events, command events, auth events

**Layer 5**: Decisions (Audit Log + Thing's Blockchain)
- Immutable audit trail, cryptographic proofs

See: [meta/VERSIONING.md](meta/VERSIONING.md)

### 4. 5-Stage Artifact Lifecycle

**Stage 1**: SOURCE - Source code in conversations/
**Stage 2**: BUILT - Compiled artifacts in assemblies/
**Stage 3**: DEPLOYED - Running in production
**Stage 4**: DISCOVERED - Observed by DoG
**Stage 5**: ARCHIVED - Historical preservation

See: [meta/ARTIFACTS.md](meta/ARTIFACTS.md)

### 5. Blockchain Alignment
All critical operations recorded in Thing's Blockchain for immutability, auditability, and non-repudiation.

See: [meta/BLOCKCHAIN.md](meta/BLOCKCHAIN.md)

---

## Getting Started

### Prerequisites

**For Conversation 001 (rebe-shell)**:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js
# Visit https://nodejs.org/

# Install Tauri CLI (if using desktop version)
cargo install tauri-cli
```

### Working with Conversations

**Starting a new conversation**:
```bash
# Create conversation directory
mkdir -p conversations/NNN-name

# Create README with structure
cp conversations/001-rebe-shell/README.md conversations/NNN-name/README.md
# Edit README for new conversation

# Update meta/CONVERSATIONS.md
# Add entry for new conversation

# Commit
git add conversations/NNN-name meta/CONVERSATIONS.md
git commit -m "feat: Start conversation NNN: name"
```

**Building a conversation**:
```bash
# Build specific conversation
cd conversations/001-rebe-shell
cargo build --release  # Rust backend
npm run build          # Frontend

# Or use workspace build script
./shared/scripts/build-all.sh
```

**Testing a conversation**:
```bash
# Test specific conversation
cd conversations/001-rebe-shell
cargo test                    # Rust tests
npm test                      # Frontend tests
./tests/self_test.sh          # Integration tests

# Or use workspace test script
./shared/scripts/test-all.sh
```

---

## Development Workflow

### Workspace-Level Operations

**Build all conversations**:
```bash
./shared/scripts/build-all.sh
```

**Test all conversations**:
```bash
./shared/scripts/test-all.sh
```

**Deploy conversation**:
```bash
./shared/scripts/deploy.sh <conversation-id> <environment>
# Example: ./shared/scripts/deploy.sh 001 production
```

### Conversation-Level Operations

Each conversation is self-contained with:
- Own build system (Cargo.toml, package.json)
- Own test suite (tests/)
- Own documentation (README.md, ARCHITECTURE.md, etc.)
- Own ADRs (docs/DECISIONS.md)

**Isolation Principle**: Conversations can be built, tested, and deployed independently.

**Shared Components**: Use `/components/` for code shared across conversations.

---

## Versioning Strategy

### Git Branches
- `main` - Stable, production-ready
- `develop` - Integration branch
- `conversation/NNN-name` - Individual conversation branches

### Git Tags
- `vX.Y.Z` - Release tags (SemVer)
- `conversation-NNN-phase-N` - Conversation milestones
- `archive/conversation-NNN-vX.Y.Z` - Archived conversations

### Conversation Lifecycle
1. ⚪ **Planned**: Defined but not started
2. 🟢 **Active**: Currently being worked on
3. 🟡 **Paused**: Temporarily suspended
4. 🔵 **Complete**: Reached milestone, production-ready
5. 🔴 **Blocked**: Cannot proceed (missing dependencies)

See: [meta/CONVERSATIONS.md](meta/CONVERSATIONS.md)

---

## Architecture Documentation

### Meta Documentation
- [meta/VERSIONING.md](meta/VERSIONING.md) - 5-layer versioning strategy
- [meta/CONVERSATIONS.md](meta/CONVERSATIONS.md) - Conversation tracking
- [meta/BLOCKCHAIN.md](meta/BLOCKCHAIN.md) - Thing's Blockchain integration
- [meta/ARTIFACTS.md](meta/ARTIFACTS.md) - 5-stage artifact lifecycle

### Conversation Documentation
- [conversations/001-rebe-shell/](conversations/001-rebe-shell/) - Developer terminal
- [conversations/002-dog-platform/](conversations/002-dog-platform/) - DoG platform (planned)
- [...] - Other conversations (planned)

### Strategic Vision
- [VISION.md](VISION.md) - Long-term vision for theCy+reBe ecosystem

---

## Contributing

### Contribution Principles
1. **Documentation First**: Update docs before or with code
2. **Test Coverage**: >90% for production code
3. **Cognitive Capture**: Explain WHY, not just WHAT
4. **5±2 Compliance**: All decompositions follow Miller's Law
5. **User Focus**: Keep technically illiterate end-users in mind

### Adding to a Conversation
```bash
# Create feature branch
git checkout -b conversation/001/feature-name

# Make changes
# ... code, tests, docs ...

# Commit with descriptive message
git commit -m "feat(001): Add feature X

- Detailed description
- Why this change
- Impact and consequences"

# Push and create PR
git push origin conversation/001/feature-name
```

### Starting a New Conversation
See: [meta/CONVERSATIONS.md](meta/CONVERSATIONS.md) for detailed process

---

## Project Status

**Workspace**: Active Development
**Active Conversations**: 1 of 7 slots used
**Current Phase**: Foundation (Conversation 001)
**Production Ready**: No (Target: Q2 2026 for first production deployment)

---

## Migration Path

### Current State (2025-10-20)
- Git: GitHub (private repositories)
- Development: Local workstations
- Deployment: Not yet implemented

### Near-Term (Months 1-6)
- Deploy conversation 001 (rebe-shell) to Fly.io
- Implement DoG platform (conversation 002)
- Set up Prometheus, Grafana, Consul

### Mid-Term (Months 6-12)
- Complete conversations 003-006
- Deploy production infrastructure
- Kafka event streaming
- Audit logging to PostgreSQL

### Long-Term (Months 12+)
- Migrate from GitHub to Gitea (on theCy substrate)
- Thing's Blockchain integration
- Full autonomous operation
- 20M+ node scale

---

## Scale Targets

### Conversation 001 (rebe-shell)
- **Target**: 20M nodes discovered in <100 seconds
- **Math**: 200K parallel workers × 10ms per command = 1 second per batch
- **Reality**: 46 days → 100 seconds = **40,000x improvement**

### Overall Ecosystem
- **Realms**: 1M independent realms
- **Humans**: 3M technically illiterate users
- **Devices**: 9M managed devices (3 per human)
- **Nodes**: 20M+ infrastructure nodes
- **Operations**: 100% autonomous (no manual intervention)
- **Reliability**: 99.99% uptime requirement

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

### Technologies
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [Tokio](https://tokio.rs/) - Async runtime
- [Axum](https://github.com/tokio-rs/axum) - Web framework
- [Tauri](https://tauri.app/) - Cross-platform app framework (superseded by web)
- [xterm.js](https://xtermjs.org/) - Terminal emulation
- [React](https://react.dev/) / [Solid.js](https://www.solidjs.com/) - Frontend frameworks
- [Prometheus](https://prometheus.io/) - Metrics and monitoring
- [Consul](https://www.consul.io/) - Service discovery
- [Kafka](https://kafka.apache.org/) - Event streaming

### Inspirations
- **Miller's Law**: George A. Miller, "The Magical Number Seven, Plus or Minus Two" (1956)
- **Event Sourcing**: Martin Fowler, Greg Young
- **Circuit Breaker Pattern**: Michael Nygard, "Release It!"
- **Distributed Systems**: Leslie Lamport, Barbara Liskov

---

**Last Updated**: 2025-10-20
**Version**: 1.0.0 (workspace restructuring)
**Maintainers**: DoG (Distributed Observing Governor)

**Repository URL**: (GitHub, future: Gitea on theCy substrate)
**Workspace**: rebe-simulations
**Active Conversations**: 1 (rebe-shell)
**Status**: Foundation phase, active development
