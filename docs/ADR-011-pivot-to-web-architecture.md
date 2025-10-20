# ADR-011: Pivot from Desktop to Web Architecture

**Date**: 2025-10-20
**Status**: Accepted
**Supersedes**: ADR-001 (Tauri desktop app)

---

## Context

Initial architecture decision (ADR-001) chose Tauri for cross-platform desktop application. This decision was made with the assumption that rebe-shell would be installed by users.

### Critical Realization

During architecture review, a fundamental contradiction was discovered:

**VISION.md states:**
> "Enable technically illiterate users to manage complex infrastructure"
> "reBe users that are technically illiterate"

**But GETTING_STARTED.md requires:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js, Tauri CLI, etc.
cargo install tauri-cli
npm install
npm run tauri dev
```

**This is completely inaccessible to technically illiterate users.**

### Clarification of User Base

rebe-shell is **NOT** for end-users (3M technically illiterate humans).

rebe-shell **IS** for:
- Developers building reBe applications
- DoG platform operators/maintainers
- System architects
- Platform engineers

**BUT**: Even developers need zero-friction access across devices (mobile, laptop, desktop, server console).

### Scale Context

```
1M realms × 3 humans × 3 devices = 9M managed entities
Plus: oneNetwork, theCy, oneConsciousness, reBe, oneThing

System must be accessible from:
- Browser on mobile device
- Browser on laptop
- Browser on desktop PC
- Browser on gaming rig
- Browser on server console
- Cloud service as fallback
```

---

## Decision

**Pivot to web-based architecture:**

1. **Frontend**: Browser-based single-page application
   - No installation required
   - Works on any device with browser
   - Multiple sessions via browser tabs
   - Mobile-responsive

2. **Backend**: Rust WebSocket server
   - Reuse existing PTY, SSH, Stream, Circuit Breaker modules
   - Deploy as Docker container
   - Self-hosted or cloud-hosted

3. **Access**: URL-based
   - `https://shell.rebe.dog` or `https://shell.rebe.com`
   - Bookmark = instant access
   - No CLI installation required

---

## Architecture (5 Components - Compliance with 5±2 Rule)

```
rebe-shell (Developer Environment)

1. FRONTEND (Browser Interface)
   - React/Solid.js + xterm.js
   - Multiple sessions (tabs)
   - Mobile-responsive

2. BACKEND (API Server)
   - Axum (Rust web framework)
   - WebSocket for terminal I/O
   - REST API for management

3. EXECUTION ENGINE
   - PTY Manager (existing)
   - SSH Pool (existing)
   - WASM Runtime (existing)
   - Circuit Breaker (existing)

4. DOG INTEGRATION
   - Prometheus, Grafana (observability)
   - Consul, mDNS (discovery)
   - Vault (secrets)
   - Traefik, FRR (routing)

5. INTELLIGENCE
   - Claude Code integration
   - Natural language parsing
   - Intent translation
```

---

## Consequences

### Positive

1. **Zero Installation**: Open browser → Start using immediately
2. **True Cross-Platform**: Same experience on mobile, desktop, server
3. **Multi-Device**: Developer can switch devices seamlessly
4. **Session Sharing**: Share terminal session URLs with team
5. **Consistent UX**: Browser provides familiar environment
6. **Easy Updates**: Deploy once, all users get updates
7. **Scalability**: Deploy multiple instances, load balance
8. **Cost**: Free tier hosting available (Vercel, Fly.io, Railway)

### Negative

1. **Network Dependency**: Requires internet connection
   - **Mitigation**: Can run locally via Docker
2. **Browser Limitations**: Some browser APIs restricted
   - **Mitigation**: Progressive enhancement, document requirements
3. **Security**: Web application security concerns
   - **Mitigation**: HTTPS required, Vault integration, authentication
4. **Latency**: Network round-trip adds latency
   - **Mitigation**: WebSocket compression, regional deployment

### Trade-offs Accepted

- **Give Up**: Native desktop performance, offline access
- **Gain**: Zero installation, true cross-platform, multi-device access
- **Rationale**: Accessibility > Performance for developer tool

---

## Implementation Plan

### Phase 1: Web MVP (Week 1)
- [ ] React frontend with xterm.js
- [ ] Rust WebSocket server (Axum)
- [ ] PTY integration (reuse existing code)
- [ ] Single session support
- [ ] Deploy to Fly.io (free tier)

### Phase 2: Multi-Session (Week 2)
- [ ] Session management
- [ ] Multiple tabs = multiple sessions
- [ ] Session persistence (reconnect after disconnect)
- [ ] Session sharing (shareable URLs)

### Phase 3: DoG Integration (Week 3)
- [ ] Prometheus metrics display
- [ ] Grafana dashboard embed
- [ ] Consul service discovery
- [ ] Vault secrets integration

### Phase 4: Intelligence (Week 4)
- [ ] Claude Code API integration
- [ ] Natural language command parsing
- [ ] Intent translation to shell commands
- [ ] Automated workflows

---

## Versioning Strategy (5-Layer Model)

### Layer 1: PLATFORM CODE (Git)
```
Repository: rebe-platform/rebe-shell
Branch: main
Version: v1.0.0 (web rewrite, breaking change from v0.x desktop)
```

### Layer 2: CONFIGURATION (Consul KV)
```
/rebe-shell/config/backend-url
/rebe-shell/config/dog-platform-endpoints
/rebe-shell/config/feature-flags
```

### Layer 3: STATE (Prometheus + PostgreSQL)
```
Active sessions: session_active{user="dev1", realm="000001"}
Resource usage: rebe_shell_memory_bytes, rebe_shell_cpu_seconds
```

### Layer 4: EVENTS (Kafka)
```
Topics:
- shell-session-events (SessionStarted, SessionEnded)
- shell-command-events (CommandExecuted, CommandFailed)
- shell-auth-events (UserLoggedIn, UserLoggedOut)
```

### Layer 5: DECISIONS (Audit Log)
```
Tables:
- command_audit (every command executed)
- session_audit (every session created/destroyed)
- access_audit (every authentication attempt)
```

---

## Migration from Desktop (Tauri) to Web

### What to Keep (Reuse)
- ✅ PTY Manager (`src-tauri/src/pty/`)
- ✅ SSH Connection Pool (`src-tauri/src/ssh/`)
- ✅ Streaming Handler (`src-tauri/src/stream/`)
- ✅ Circuit Breaker (`src-tauri/src/circuit_breaker/`)
- ✅ Protocol (`src-tauri/src/protocol/`)
- ✅ WASM Runtime (`src-tauri/src/wasm/`) - placeholder

### What to Replace
- ❌ Tauri framework → Axum web framework
- ❌ Desktop window → Browser interface
- ❌ IPC bridge → WebSocket
- ❌ Native menus → Web UI
- ❌ `tauri.conf.json` → Web deployment config

### What to Add
- ➕ WebSocket handler (terminal I/O)
- ➕ REST API (session management)
- ➕ Authentication (Vault integration)
- ➕ Session persistence (PostgreSQL)
- ➕ Frontend (React + xterm.js)

---

## Deployment Options

### Option 1: Self-Hosted (Docker)
```bash
docker run -p 443:443 \
  -e DOG_PROMETHEUS_URL=http://prometheus:9090 \
  -e DOG_GRAFANA_URL=http://grafana:3000 \
  ghcr.io/rebe-platform/rebe-shell:latest
```

Access: `https://localhost`

### Option 2: Cloud-Hosted (Managed)
```
Frontend: Vercel (CDN, free tier)
Backend: Fly.io or Railway (free tier)
Database: Supabase (PostgreSQL, free tier)
```

Access: `https://shell.rebe.dog`

### Option 3: Hybrid
```
Frontend: Cloud CDN (fast, global)
Backend: User's own infrastructure (data stays local)
```

Access: `https://shell.rebe.dog` → connects to user's backend

---

## Alternatives Considered

### Alternative 1: Progressive Web App (PWA)
- ✅ Installable like desktop app
- ✅ Offline support
- ❌ Limited API access
- ❌ Still requires initial web visit

**Decision**: Start with web, add PWA later if needed

### Alternative 2: Electron (instead of Tauri)
- ✅ More mature than Tauri
- ❌ Still requires installation
- ❌ Large binary size (100-200MB)
- ❌ Doesn't solve accessibility problem

**Decision**: Rejected - same issues as Tauri

### Alternative 3: SSH-based TUI (like tmux)
- ✅ Zero UI development
- ✅ Works over SSH
- ❌ Requires SSH access
- ❌ No graphical dashboards
- ❌ Poor mobile experience

**Decision**: Rejected - too limited

### Alternative 4: VS Code Extension
- ✅ Integrated into developer workflow
- ✅ Large existing user base
- ❌ Requires VS Code installation
- ❌ Not accessible from mobile
- ❌ Doesn't integrate with DoG platform

**Decision**: Rejected - consider as complementary tool later

---

## Success Criteria

Web architecture is successful if:

1. ✅ Developer can access from mobile phone
2. ✅ Zero installation required (open URL = working terminal)
3. ✅ Multiple concurrent sessions (browser tabs)
4. ✅ Integrates with DoG platform (Prometheus, Grafana, etc)
5. ✅ Sub-100ms latency for command execution
6. ✅ Supports 1000+ concurrent users per backend instance
7. ✅ Session persistence (survive browser refresh)

---

## References

- **Previous ADR**: ADR-001 (Tauri decision - now superseded)
- **Related**: ADR-004 (SSH pooling - still applicable)
- **Related**: ADR-005 (Streaming handler - still applicable)
- **Related**: ADR-006 (Circuit breaker - still applicable)

---

**Approved By**: DoG (Distributed Observing Governor)
**Implementation Start**: 2025-10-20
**Target Completion**: 2025-11-20 (4 weeks)
