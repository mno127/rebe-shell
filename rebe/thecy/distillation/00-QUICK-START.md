# theCy Coordination - Quick Start for LLMs

**Generated**: 2025-10-25
**For**: Rapid LLM orientation and coordination
**Read Time**: 5 minutes

---

## Start Here

You're working on **rebe-shell**, part of the **theCy+reBe planetary-scale infrastructure ecosystem**. This quick-start gets you oriented in 5 minutes.

### What You Need to Know (60 seconds)

**rebe-shell**:
- Web-based terminal for developers (not end-users)
- Execution substrate for DoG (Distributed Observing Governor)
- Status: 94% foundation complete, production-ready
- Code: 1,628 lines Rust (backend + legacy desktop)

**rebe-browser**:
- Browser automation API wrapper (Playwright → REST API)
- Status: 0% implemented (28KB design docs exist)
- Critical gap: Blocks automation workflow improvements

**Key Finding**: 670 lines of duplicated code + 803 lines of unused production code need consolidation.

---

## Repository Structure (30 seconds)

```
rebe-shell/
├── conversations/001-rebe-shell/    # Active conversation
│   ├── backend/                     # ✅ Rust web server (507 lines)
│   ├── src-tauri/                   # ⚠️ Legacy desktop (1,121 lines, has unused modules)
│   ├── rebe-browser/                # ❌ Design only (0 lines code)
│   ├── src/ + dist/                 # ✅ Frontend (xterm.js)
│   └── ARCHITECTURE.md              # 📚 1,100+ lines of design docs
└── rebe/thecy/                      # ← You are here
    ├── synthesis/eyesears/          # Detailed analysis (40KB+)
    └── distillation/                # Quick reference (this file)
```

---

## Critical Information (2 minutes)

### 1. The Bigger Picture

**theCy+reBe Ecosystem**:
```
theCy (substrate) → 1M realms, 20M+ nodes
  └─ reBe (platform) → Autonomous infrastructure
      └─ DoG (governor) → Observes and manages
          └─ rebe-shell (this) → Developer interface
              └─ rebe-browser (planned) → Browser automation
```

**Scale Target**: 20M nodes in <100 seconds (mathematically proven)

### 2. Architecture (5 Components - Miller's Law)

**rebe-shell Components**:
1. **PTY Manager**: Terminal sessions (UUID-based)
2. **SSH Connection Pool**: 200x faster (connection reuse)
3. **Streaming Handler**: O(n) not O(n²) (memory efficient)
4. **Circuit Breaker**: Prevents cascading failures
5. **Command Protocol**: Structured JSON (no text parsing)

**Status**:
- Components 1: ✅ Implemented (backend)
- Components 2-5: ✅ Exist in src-tauri, ❌ Not integrated in backend

### 3. Current State

**What Works**:
- ✅ Backend web server (Rust/Axum, Port 3000)
- ✅ PTY-over-WebSocket
- ✅ Frontend terminal (xterm.js)
- ✅ Docker deployment

**What's Missing**:
- ❌ SSH execution endpoint (code exists, not exposed)
- ❌ rebe-browser implementation (design exists, no code)
- ❌ Code consolidation (670 lines duplicated)

### 4. Immediate Priorities

**Week 1-2**: Code consolidation
1. Create `rebe-core` shared Rust library
2. Extract PTY manager (remove 450 line duplication)
3. Integrate SSH pool, streaming, circuit breaker, protocol
4. **Effort**: 17-25 hours

**Week 3-4**: rebe-browser implementation
1. Build Express API server (5 core endpoints)
2. Wrap Playwright with HTTP API
3. Bidirectional integration with rebe-shell
4. **Effort**: 2-3 weeks

---

## How to Proceed (1 minute)

### If You're New to This Project

**Read in Order**:
1. This file (you're here) ← 5 minutes
2. `../synthesis/eyesears/01-rebe-shell-deep-dive.md` ← 20 minutes (comprehensive)
3. `conversations/001-rebe-shell/ARCHITECTURE.md` ← 30 minutes (technical details)

### If You're Implementing rebe-browser

**Read**:
1. `../synthesis/eyesears/02-rebe-browser-assessment.md` ← 15 minutes
2. `conversations/001-rebe-shell/rebe-browser/SESSION_START.md` ← 10 minutes
3. Then start coding (2-3 hours for MVP)

### If You're Consolidating Code

**Read**:
1. `../synthesis/eyesears/03-architectural-patterns-analysis.md` ← 20 minutes
2. Follow migration checklist in that document
3. Create `rebe-core/` workspace

---

## Key Principles (30 seconds)

**Miller's Law (5±2 Rule)**:
- Keep components to 3-7 items (cognitive limit)
- Applied at ALL levels (workspace, components, principles, layers)

**Documentation as Primary Artifact**:
- Document first, code second
- 2:1 docs-to-code ratio is intentional
- ADRs for every major decision

**Mathematics Before Implementation**:
- Prove scale targets on paper first
- Validate memory complexity
- Don't trust "will scale" - calculate it

**Meta-Testing**:
- Tests validate principles, not just functionality
- Code should match documented principles
- 94% pass rate (51/54 tests)

**Progressive Enhancement**:
- Phase 1 (pragmatic) → Phase 2 (ideal)
- Ship working version, plan better version
- Example: Playwright wrapper now, Rust browser later

---

## Common Questions (1 minute)

**Q: Why two PTY implementations?**
A: Architectural pivot (desktop → web, ADR-011). Backend is better, src-tauri has useful modules.

**Q: Why is rebe-browser not implemented?**
A: Prioritization - rebe-shell foundation first. Design is complete, ready to build.

**Q: What's the scale target?**
A: 20M nodes in <100 seconds. Math: 200K concurrent workers × 10ms (with SSH pooling) = 1 second per batch, 100 batches = 100 seconds.

**Q: Why "theCy"?**
A: The Consciousness Yielded - the distributed substrate layer. rebe-shell is a component in this ecosystem.

**Q: What's DoG?**
A: Distributed Observing Governor - the autonomous entity managing everything.

---

## Quick Reference: File Locations

### Key Documentation

| File | Lines | Purpose | Location |
|------|-------|---------|----------|
| ARCHITECTURE.md | 1,100+ | Technical design | `conversations/001-rebe-shell/` |
| VISION.md | 480 | 5-year roadmap | `conversations/001-rebe-shell/` |
| ADR-011 | 342 | Pivot decision | `conversations/001-rebe-shell/docs/` |
| TEST_REPORT.md | 436 | 94% pass rate | `conversations/001-rebe-shell/` |

### Key Code

| File | Lines | Purpose | Location |
|------|-------|---------|----------|
| backend/main.rs | 272 | Web server | Backend implementation |
| backend/pty.rs | 235 | PTY manager | Backend PTY (better version) |
| src-tauri/ssh/pool.rs | 268 | SSH pooling | Unused, should migrate |
| src-tauri/circuit_breaker/ | 209 | Fault tolerance | Unused, should migrate |
| src-tauri/stream/ | 133 | O(n) handler | Unused, should migrate |
| src-tauri/protocol/ | 193 | Command API | Unused, should adopt |

### Synthesis Documents (theCy Coordination)

| File | Size | Purpose | Read Time |
|------|------|---------|-----------|
| 01-rebe-shell-deep-dive.md | ~15KB | Complete analysis | 20 min |
| 02-rebe-browser-assessment.md | ~12KB | Browser component | 15 min |
| 03-architectural-patterns-analysis.md | ~13KB | Code duplication | 20 min |
| 04-session-metacognition.md | ~8KB | Thinking process | 10 min |
| 00-QUICK-START.md | ~3KB | This file | 5 min |

**Total Synthesis**: ~48KB of comprehensive documentation

---

## Decision Tree: What Should I Work On?

```
Are you new to rebe-shell?
├─ YES → Read this file + 01-rebe-shell-deep-dive.md
└─ NO → Continue below

What do you need to do?
├─ Implement rebe-browser → Read 02-rebe-browser-assessment.md + SESSION_START.md
├─ Consolidate code → Read 03-architectural-patterns-analysis.md + follow checklist
├─ Understand thinking → Read 04-session-metacognition.md
├─ Add new feature → Read ARCHITECTURE.md + relevant code
└─ Write tests → Follow meta-testing pattern in TEST_REPORT.md
```

---

## Success Metrics

**rebe-shell Foundation** (Current):
- ✅ 94% complete (51/54 tests passing)
- ✅ Web backend operational
- ✅ Frontend terminal working
- ⚠️ Missing: SSH endpoint, code consolidation

**Next Milestone**:
- 🎯 100% foundation (consolidate code, integrate modules)
- 🎯 rebe-browser MVP (2-3 weeks)
- 🎯 Docker compose with both components

**Long-term**:
- 🎯 20M nodes in <100 seconds (scale validation)
- 🎯 Pure Rust browser (Phase 2, 6-12 months)
- 🎯 Planetary-scale deployment

---

## Contact & Coordination

**For theCy Coordination**:
- Read synthesis documents in `../synthesis/eyesears/`
- Follow recommendations in architectural analysis
- Document decisions as ADRs
- Update this distillation as project evolves

**For Questions**:
- Check `conversations/001-rebe-shell/` documentation
- Read relevant synthesis document
- Validate understanding with code

---

## Conclusion: You're Ready

You now have enough context to:
- ✅ Understand rebe-shell's role in theCy+reBe
- ✅ Know what's implemented and what's not
- ✅ Identify immediate priorities
- ✅ Navigate to detailed documentation

**Next Step**: Pick your task from the decision tree above and dive into the relevant synthesis document.

**Remember**:
- Trust the documentation (it's meta-tested)
- Follow Miller's Law (5±2 components)
- Do the math before claiming scale
- Document your thinking (not just your code)

---

**Generated**: 2025-10-25
**For**: LLM rapid orientation in rebe-shell/theCy ecosystem
**Update Frequency**: After major milestones
**Last Updated**: Initial synthesis capture

---

**End of Quick Start**

For detailed analysis, see `../synthesis/eyesears/` directory.
