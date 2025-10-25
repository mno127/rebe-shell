# Action Plan - Priority Tasks for LLM Coordination

**Generated**: 2025-10-25
**For**: LLM task assignment and coordination
**Status**: Ready for execution

---

## Priority Matrix

| Task | Priority | Effort | Impact | Blocks |
|------|----------|--------|--------|--------|
| Create rebe-core | CRITICAL | 17-25h | High | All consolidation |
| Implement rebe-browser | HIGH | 2-3 weeks | High | Automation improvements |
| Migrate SSH pool | HIGH | 2-3h | High | Remote execution |
| Integrate streaming | MEDIUM | 2-3h | Medium | Memory efficiency |
| Integrate circuit breaker | MEDIUM | 2-3h | High | Resilience |
| Extract terminal UI | MEDIUM | 3-4h | Medium | Consistency |
| Adopt command protocol | LOW | 4-6h | Medium | Type safety |

---

## Immediate Actions (This Week)

### Task 1: Create rebe-core Workspace ⚡ CRITICAL

**Goal**: Shared Rust library for common code

**Steps**:
```bash
# 1. Create directory
mkdir -p rebe-core/src

# 2. Create Cargo.toml
cat > rebe-core/Cargo.toml <<EOF
[package]
name = "rebe-core"
version = "0.1.0"
edition = "2021"

[dependencies]
portable-pty = "0.8"
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
thiserror = "1.0"
uuid = { version = "1.6", features = ["v4"] }
tracing = "0.1"
bytes = "1.5"
ssh2 = "0.9"
EOF

# 3. Create lib.rs
cat > rebe-core/src/lib.rs <<EOF
pub mod pty;
pub mod ssh;
pub mod stream;
pub mod circuit_breaker;
pub mod protocol;
EOF

# 4. Update workspace Cargo.toml
```

**Time**: 30 minutes

**Blocks**: All other consolidation tasks

---

### Task 2: Extract PTY Manager ⚡ CRITICAL

**Goal**: Single PTY implementation in rebe-core

**Steps**:
1. Copy `backend/src/pty.rs` to `rebe-core/src/pty/mod.rs`
2. Merge test suites from both src-tauri and backend
3. Update `backend/src/main.rs`: `use rebe_core::pty;`
4. Delete `backend/src/pty.rs`
5. Test: `cargo test -p rebe-core`

**Time**: 2-3 hours

**Impact**: Removes 450 lines of duplication

**Detailed Guide**: See `../synthesis/eyesears/03-architectural-patterns-analysis.md` Section "1. PTY Manager"

---

### Task 3: Move SSH Pool to rebe-core 🔥 HIGH

**Goal**: Enable SSH execution in backend

**Steps**:
1. Create `rebe-core/src/ssh/mod.rs`
2. Create `rebe-core/src/ssh/pool.rs`
3. Copy from `src-tauri/src/ssh/pool.rs`
4. Update imports, test

**Time**: 1-2 hours

**Impact**: +268 lines of functionality

**Next**: Add SSH endpoint to backend (Task 7)

---

### Task 4: Move Streaming Handler 🔥 HIGH

**Goal**: O(n) memory complexity in backend

**Steps**:
1. Copy `src-tauri/src/stream/mod.rs` to `rebe-core/src/stream/`
2. Update `backend/src/main.rs` to use for PTY reads
3. Test with large outputs (>10MB)

**Time**: 2-3 hours

**Impact**: Prevents memory explosion

---

### Task 5: Move Circuit Breaker 🔥 HIGH

**Goal**: Fault tolerance in production

**Steps**:
1. Copy to `rebe-core/src/circuit_breaker/`
2. Wrap SSH operations in backend
3. Test: Circuit opens after failures

**Time**: 2-3 hours

**Impact**: Production resilience

---

## Short-Term Actions (Next 2 Weeks)

### Task 6: Implement rebe-browser MVP 🚀 CRITICAL

**Goal**: Browser automation API

**Steps**:
```bash
cd rebe-browser

# Initialize
npm init -y
npm install express playwright cors dotenv

# Create server.js (see SESSION_START.md for template)

# Implement endpoints:
# - GET /api/capabilities
# - POST /browser/navigate
# - POST /browser/click
# - POST /browser/fill
# - GET /browser/extract
# - POST /browser/shell

# Test integration with rebe-shell
```

**Time**: 2-3 hours for MVP, 1-2 weeks for production

**Impact**: Unblocks automation improvements

**Detailed Guide**: `conversations/001-rebe-shell/rebe-browser/SESSION_START.md`

---

### Task 7: Add SSH Endpoint to Backend

**Goal**: Remote execution capability

**Steps**:
```rust
// In backend/src/main.rs

use rebe_core::ssh::SSHPool;

// Add to AppState
struct AppState {
    pty_manager: Arc<PtyManager>,
    ssh_pool: Arc<SSHPool>,  // ← Add this
}

// Add endpoint
#[derive(Deserialize)]
struct SSHExecuteRequest {
    host: String,
    port: u16,
    user: String,
    key_path: String,
    command: String,
}

async fn ssh_execute(
    State(state): State<AppState>,
    Json(req): Json<SSHExecuteRequest>,
) -> Result<Json<CommandOutput>, StatusCode> {
    let conn = state.ssh_pool.acquire(&Host { /* ... */ }).await?;
    let output = conn.exec(&req.command).await?;
    Ok(Json(output))
}

// Register route
.route("/api/ssh/execute", post(ssh_execute))
```

**Time**: 3-4 hours

**Impact**: Enables remote command execution

---

### Task 8: Migrate Automation Scripts

**Goal**: Use rebe-browser API instead of direct Playwright

**Steps**:
1. Start with `automation/scripts/submit_copilot.js`
2. Replace Playwright calls with HTTP API calls
3. Test functionality unchanged
4. Document migration pattern
5. Apply to remaining 5 scripts

**Time**: 2-3 days

**Impact**: Proves rebe-browser API is usable

---

## Medium-Term Actions (Months 2-3)

### Task 9: Docker Compose Integration

**Goal**: Single command deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  rebe-shell:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - REBE_BROWSER_URL=http://rebe-browser:3001

  rebe-browser:
    build: ./rebe-browser
    ports:
      - "3001:3001"
    environment:
      - REBE_SHELL_URL=http://rebe-shell:3000
      - HEADLESS=true
```

**Time**: 1-2 hours

**Impact**: Easy deployment

---

### Task 10: Production Hardening

**Checklist**:
- [ ] Add health checks (`/health` endpoints)
- [ ] Add metrics (Prometheus format)
- [ ] Add structured logging (JSON)
- [ ] Add circuit breakers around external calls
- [ ] Add retry logic with exponential backoff
- [ ] Add request timeouts
- [ ] Add rate limiting
- [ ] Document deployment guide

**Time**: 1-2 weeks

**Impact**: Production readiness

---

## Long-Term Actions (Months 3-6)

### Task 11: Scale Testing

**Goal**: Validate 20M node target

**Steps**:
1. Deploy regional agents (Kubernetes)
2. Test with 100K nodes
3. Test with 1M nodes
4. Validate: <100 seconds for 20M nodes (math)
5. Measure: actual performance vs predictions

**Time**: 2-4 weeks

**Impact**: Planetary-scale validation

---

### Task 12: Phase 2 - Pure Rust Browser

**Goal**: Self-reliance (no Chromium)

**Options**:
1. Servo (Mozilla Rust engine) - Monitor maturity
2. WebKit wrapper - Prototype
3. Stripped Chromium - Fallback

**Decision Point**: Q1 2026

**Time**: 6-12 months

**Impact**: Full self-reliance, <50MB overhead

---

## Quick Reference: File Paths

### Code to Create

```
rebe-core/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── pty/mod.rs       ← From backend/src/pty.rs
    ├── ssh/
    │   ├── mod.rs
    │   └── pool.rs      ← From src-tauri/src/ssh/pool.rs
    ├── stream/mod.rs    ← From src-tauri/src/stream/mod.rs
    ├── circuit_breaker/mod.rs  ← From src-tauri/
    └── protocol/mod.rs  ← From src-tauri/

rebe-browser/
├── package.json
├── server.js            ← NEW
├── playwright-wrapper.js  ← NEW
├── integrations.js      ← NEW
└── config.js            ← NEW
```

### Code to Delete (After Migration)

```
backend/src/pty.rs       → Delete after moving to rebe-core
src-tauri/src/ssh/       → Delete after moving to rebe-core
src-tauri/src/stream/    → Delete after moving to rebe-core
src-tauri/src/circuit_breaker/  → Delete after moving
src-tauri/src/protocol/  → Delete after moving
```

### Documentation to Update

```
conversations/001-rebe-shell/README.md           → Update architecture
conversations/001-rebe-shell/ARCHITECTURE.md     → Add rebe-core section
rebe-browser/README.md                           → Update status
rebe/thecy/distillation/00-QUICK-START.md       → Update progress
```

---

## Success Criteria

### Week 1-2 Complete

- [ ] rebe-core workspace exists
- [ ] PTY manager extracted (0 duplication)
- [ ] SSH, streaming, circuit breaker, protocol in rebe-core
- [ ] Backend uses rebe-core
- [ ] All tests passing

**Metric**: 0 lines of PTY duplication, +803 lines functionality

### Month 1 Complete

- [ ] rebe-browser MVP operational
- [ ] Bidirectional integration working
- [ ] One automation script migrated
- [ ] Docker compose deployment

**Metric**: rebe-browser 100% implemented

### Month 2-3 Complete

- [ ] All automation scripts migrated
- [ ] Production monitoring added
- [ ] Health checks operational
- [ ] Deployment documented

**Metric**: Production-ready

### Month 3-6 Complete

- [ ] 100K node scale test passed
- [ ] Performance validated
- [ ] Phase 2 decision made

**Metric**: Scale proven

---

## Risk Mitigation

### Risk 1: Breaking Changes During Migration

**Mitigation**:
- Keep old code until new code is tested
- Run tests after each step
- Use feature flags for gradual rollout

### Risk 2: rebe-browser Integration Issues

**Mitigation**:
- Start with simplest endpoint (GET /api/capabilities)
- Test each endpoint independently
- Write integration tests before migrating scripts

### Risk 3: Performance Regressions

**Mitigation**:
- Benchmark before and after
- Monitor memory usage
- Load test with realistic data

---

## Coordination Protocol

### For LLMs Working on This

**Before Starting**:
1. Read `00-QUICK-START.md`
2. Read relevant synthesis document
3. Check this action plan for your task
4. Verify no one else is working on it

**During Work**:
1. Follow task steps exactly
2. Test after each step
3. Document any deviations
4. Update progress in comments

**After Completion**:
1. Mark task complete in this file
2. Update `00-QUICK-START.md` status
3. Document any issues encountered
4. Notify next dependent task

---

## Task Dependencies

```
Task 1 (rebe-core) ─┬─→ Task 2 (PTY) ────→ All consolidation complete
                    ├─→ Task 3 (SSH) ────→ Task 7 (SSH endpoint)
                    ├─→ Task 4 (Stream)
                    ├─→ Task 5 (Circuit)
                    └─→ Protocol

Task 6 (rebe-browser) ────→ Task 8 (Migrate scripts)

Task 7 + Task 8 ────→ Task 9 (Docker)

Task 9 ────→ Task 10 (Production)

Task 10 ────→ Task 11 (Scale test)
```

---

## Current Status

**Last Updated**: 2025-10-25

| Task | Status | Assignee | ETA |
|------|--------|----------|-----|
| Task 1: rebe-core | ⚪ Not started | - | - |
| Task 2: PTY extract | ⚪ Not started | - | - |
| Task 3: SSH move | ⚪ Not started | - | - |
| Task 4: Stream move | ⚪ Not started | - | - |
| Task 5: Circuit move | ⚪ Not started | - | - |
| Task 6: rebe-browser | ⚪ Not started | - | - |
| Task 7: SSH endpoint | ⚪ Not started | - | - |
| Task 8: Migrate scripts | ⚪ Not started | - | - |

---

**End of Action Plan**

For detailed technical guidance, see:
- `../synthesis/eyesears/03-architectural-patterns-analysis.md` (code consolidation)
- `conversations/001-rebe-shell/rebe-browser/SESSION_START.md` (browser implementation)
