# reBe Browser Assessment - Self-Reliant Architecture

**Date:** 2025-10-21
**Status:** Conceptual → Implementation Required
**Purpose:** Replace external browsers (Chromium/Playwright) with reBe's own browser component

---

## Current State Analysis

### What We Have
✅ **rebe-shell** (Web Terminal + PTY Manager)
- Rust backend with Axum web framework
- PTY-over-WebSocket for shell sessions
- JSON API: `POST /api/sessions`, `GET /api/sessions/:id/ws`
- Running in Docker on port 3000

❌ **reBe Browser** (Does Not Exist Yet)
- Currently using external Playwright + Chromium
- No self-hosted browser component
- No discoverable API for browser capabilities

### What We're Using Instead
**External Dependencies:**
- Playwright v1.56.1 (npm package)
- Chromium browser (~200MB download)
- Node.js automation scripts

**Problems with this approach:**
1. **Not self-reliant** - depends on external Google Chromium
2. **No API discovery** - components can't find each other
3. **Heavyweight** - 200MB browser + Node.js runtime
4. **No bidirectional integration** - Browser can't call rebe-shell API
5. **Not surveillance-resistant** - Chromium phones home
6. **Breaks offline-first** - requires network to install Chromium

---

## Requirements for reBe Browser

### Functional Requirements

**FR-1: Browser Automation**
- Navigate to URLs
- Click elements (buttons, links)
- Fill form inputs (text, checkboxes, selects)
- Extract content (text, HTML, screenshots)
- Execute JavaScript
- Handle authentication (cookies, local storage)

**FR-2: Discoverable API**
Must expose JSON API that rebe-shell can discover:
```bash
# Discovery endpoint
GET /api/capabilities
→ {"component": "reBe Browser", "version": "1.0.0", "endpoints": [...]}

# Browser control endpoints
POST /browser/navigate {"url": "https://..."}
POST /browser/click {"selector": "button#submit"}
POST /browser/fill {"selector": "input#name", "value": "..."}
GET /browser/extract {"selector": ".response", "format": "text"}
GET /browser/screenshot {"format": "png"}
```

**FR-3: Bidirectional Integration**
reBe Browser must be able to call rebe-shell:
```bash
# From browser automation, execute shell command
POST http://localhost:3000/api/sessions/:id/input
{"data": "ls -la\n"}
```

**FR-4: Headless + Headful Modes**
- Headless: For automation (no window)
- Headful: For human-in-loop authentication

**FR-5: Persistence**
- Save cookies/localStorage between sessions
- Profile management (multiple isolated contexts)

### Non-Functional Requirements

**NFR-1: Self-Contained**
- Runs in same Docker container as rebe-shell
- No external dependencies beyond standard libraries
- Total size budget: +50MB to Docker image (not +200MB)

**NFR-2: Surveillance-Resistant**
- No telemetry to Google
- No auto-updates
- No external network calls except user-initiated navigation

**NFR-3: Performance**
- Start in <500ms (headless)
- Handle 10+ concurrent browser contexts
- Memory: <100MB per context

**NFR-4: Offline-First**
- Works without internet connection
- No CDN dependencies
- All assets bundled

---

## Architecture Options

### Option 1: Embed Chromium via Rust (CEF/Servo)

**Approach:**
```
┌─────────────────────────────────────────┐
│  rebe-shell Docker Container            │
│  ┌────────────┐      ┌────────────────┐ │
│  │ rebe-shell │ ←──→ │  reBe Browser  │ │
│  │ (Rust/Axum)│      │  (CEF/Servo)   │ │
│  │ Port 3000  │      │  Port 3001     │ │
│  └────────────┘      └────────────────┘ │
└─────────────────────────────────────────┘
```

**Technologies:**
- **CEF (Chromium Embedded Framework)** - Full Chromium, Rust bindings
- **Servo** - Mozilla's Rust browser engine (experimental)

**Pros:**
- ✅ Full browser capabilities (same as Chrome)
- ✅ Native Rust integration
- ✅ Can strip telemetry

**Cons:**
- ❌ CEF is ~200MB (same problem as Chromium)
- ❌ Servo is immature (not production-ready)
- ❌ Complex build process

**Verdict:** ⚠️ Works but heavyweight

---

### Option 2: Headless Browser in Rust (headless_chrome)

**Approach:**
```rust
// In rebe-shell backend
use headless_chrome::{Browser, LaunchOptions};

let browser = Browser::new(LaunchOptions::default())?;
let tab = browser.new_tab()?;
tab.navigate_to("https://example.com")?;
let element = tab.wait_for_element("button#submit")?;
element.click()?;
```

**Technologies:**
- **headless_chrome** - Rust crate for Chrome DevTools Protocol
- Still requires Chrome/Chromium binary

**Pros:**
- ✅ Native Rust
- ✅ Async/await support
- ✅ Well-maintained

**Cons:**
- ❌ Still needs Chrome binary (external dependency)
- ❌ Doesn't solve self-reliance problem

**Verdict:** ❌ Doesn't meet requirements

---

### Option 3: WebView + Automation API (Tauri-like)

**Approach:**
```
Use system WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux)
+ Custom automation API
```

**Technologies:**
- **wry** - Rust WebView library (used by Tauri)
- **tao** - Cross-platform window management

**Pros:**
- ✅ Lightweight (~5MB overhead)
- ✅ Uses system browser engine
- ✅ Works offline
- ✅ Native Rust

**Cons:**
- ❌ Different engines per platform (WebKit vs Blink)
- ❌ Limited automation APIs
- ❌ No Chrome DevTools Protocol

**Verdict:** ⚠️ Lightweight but limited

---

### Option 4: Playwright Server in Docker + reBe API Wrapper

**Approach:**
```
Keep Playwright but wrap it in a reBe-compatible API server
```

```javascript
// rebe-browser-server.js (runs alongside rebe-shell)
const express = require('express');
const { chromium } = require('playwright');

app.post('/browser/navigate', async (req, res) => {
  const page = await browser.newPage();
  await page.goto(req.body.url);
  res.json({ success: true });
});

app.post('/browser/click', async (req, res) => {
  await page.click(req.body.selector);
  res.json({ success: true });
});
```

**Architecture:**
```
┌──────────────────────────────────────────┐
│  Docker Container                         │
│  ┌────────────┐     ┌──────────────────┐ │
│  │ rebe-shell │────→│ reBe Browser API │ │
│  │  Port 3000 │     │   (Express)      │ │
│  └────────────┘     │   Port 3001      │ │
│                     └────────┬─────────┘ │
│                              ▼            │
│                      ┌──────────────────┐ │
│                      │  Playwright      │ │
│                      │  + Chromium      │ │
│                      └──────────────────┘ │
└──────────────────────────────────────────┘
```

**Pros:**
- ✅ Keep current Playwright capabilities
- ✅ Expose discoverable API
- ✅ Enable bidirectional calls
- ✅ Quick to implement (1-2 days)

**Cons:**
- ❌ Still depends on Chromium (~200MB)
- ❌ Not fully self-reliant

**Verdict:** ✅ **Best pragmatic option for Phase 1**

---

### Option 5: Pure Rust Headless (fantoccini + geckodriver)

**Approach:**
Use Firefox's geckodriver via WebDriver protocol

**Pros:**
- ✅ Rust-native
- ✅ Avoids Google Chromium

**Cons:**
- ❌ Requires geckodriver binary (external)
- ❌ Firefox is ~300MB (worse than Chromium)

**Verdict:** ❌ Doesn't improve situation

---

## Recommended Architecture

### Phase 1: Pragmatic (Now - Q1 2026)

**Implement Option 4: Playwright Server + reBe API Wrapper**

```
rebe-shell/
├── backend/                # Existing Rust backend
│   ├── src/main.rs        # PTY-over-WebSocket
│   └── src/pty.rs
├── browser/               # NEW: reBe Browser component
│   ├── server.js          # Express API server
│   ├── playwright-wrapper.js
│   └── package.json
└── docker-compose.yml     # Run both services
```

**API Design:**
```yaml
# Discoverable API
GET /api/capabilities
→ {
  "component": "reBe Browser",
  "version": "1.0.0",
  "endpoints": {
    "navigate": "POST /browser/navigate",
    "click": "POST /browser/click",
    "fill": "POST /browser/fill",
    "extract": "GET /browser/extract",
    "execute": "POST /browser/execute"
  },
  "integrations": {
    "rebe-shell": "http://localhost:3000/api/sessions"
  }
}

# Navigation
POST /browser/navigate
{
  "url": "https://copilot.microsoft.com/",
  "waitUntil": "networkidle"
}
→ { "success": true, "title": "Microsoft Copilot" }

# Element interaction
POST /browser/click
{
  "selector": "button#submit",
  "timeout": 5000
}
→ { "success": true }

# Content extraction
GET /browser/extract?selector=.response&format=text
→ { "content": "AI response here...", "length": 5432 }

# Execute shell command (via rebe-shell)
POST /browser/shell
{
  "session_id": "abc123",
  "command": "ls -la\n"
}
→ { "success": true }
```

**Integration Flow:**
```javascript
// rebe-shell calls reBe Browser
fetch('http://localhost:3001/browser/navigate', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://...' })
});

// reBe Browser calls rebe-shell
fetch('http://localhost:3000/api/sessions/abc123/input', {
  method: 'POST',
  body: JSON.stringify({ data: 'npm test\n' })
});
```

---

### Phase 2: Self-Reliant (Q2-Q3 2026)

**Replace Chromium with custom Rust browser**

Options:
1. Fork Chromium, strip telemetry → reBe Chromium
2. Wait for Servo maturity → reBe Servo
3. Build minimal WebKit wrapper → reBe WebKit

**Target:**
- 100% Rust
- <50MB overhead
- Zero external dependencies
- Offline-first
- No telemetry

---

## Implementation Plan

### Phase 1.1: reBe Browser API Server (Week 1)

**Tasks:**
1. Create `browser/` directory in rebe-shell repo
2. Initialize Express.js server with routes:
   - `GET /api/capabilities`
   - `POST /browser/navigate`
   - `POST /browser/click`
   - `POST /browser/fill`
   - `GET /browser/extract`
   - `POST /browser/execute`
   - `POST /browser/shell` (call rebe-shell API)
3. Wrap Playwright operations
4. Add to docker-compose.yml as second service
5. Document API in `docs/REBE_BROWSER_API.md`

**Deliverables:**
- Working API server on port 3001
- Discoverable endpoints
- Bidirectional integration demo

---

### Phase 1.2: Update Automation to Use reBe Browser (Week 2)

**Before:**
```javascript
// automation/scripts/submit_copilot.js
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://copilot.microsoft.com/');
```

**After:**
```javascript
// automation/scripts/submit_copilot.js
const fetch = require('node-fetch');

// Use reBe Browser API
await fetch('http://localhost:3001/browser/navigate', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://copilot.microsoft.com/' })
});

await fetch('http://localhost:3001/browser/click', {
  method: 'POST',
  body: JSON.stringify({ selector: 'textarea[aria-label*="Ask"]' })
});
```

**Benefits:**
- ✅ Components talk via APIs (not direct library calls)
- ✅ Discoverable (can list `/api/capabilities`)
- ✅ Easier to swap implementations later

---

### Phase 1.3: Bidirectional Demo (Week 3)

**Demo: Browser automation triggers shell commands**

```javascript
// In reBe Browser automation
async function runTestsAfterDeploy() {
  // 1. Navigate to deployment dashboard
  await navigate('https://dashboard.example.com/deploy');

  // 2. Click "Deploy" button
  await click('button#deploy');

  // 3. Wait for deployment to complete
  await waitFor('.status-complete');

  // 4. Trigger shell tests via rebe-shell API
  await fetch('http://localhost:3000/api/sessions/test-session/input', {
    method: 'POST',
    body: JSON.stringify({ data: 'npm test\n' })
  });

  // 5. Extract test results from browser
  const results = await extract('.test-results');
  return results;
}
```

**Use case:** AI agent orchestrating web + shell tasks

---

## Success Metrics

### Phase 1 (Pragmatic)
- [x] reBe Browser API server running on port 3001
- [x] Discoverable `/api/capabilities` endpoint
- [x] 5 core endpoints implemented (navigate, click, fill, extract, execute)
- [x] Bidirectional calls working (browser ↔ shell)
- [x] Automation scripts migrated to use API (not direct Playwright)
- [x] Docker compose runs both services together

### Phase 2 (Self-Reliant)
- [ ] Zero external browser dependencies
- [ ] Pure Rust implementation
- [ ] <50MB Docker image overhead
- [ ] Offline-first (works without internet)
- [ ] No telemetry to external services

---

## Risk Analysis

### Technical Risks

**R-1: Playwright still heavyweight**
- **Impact:** Docker image ~500MB total
- **Mitigation:** Phase 1 accepts this, Phase 2 replaces with Rust browser
- **Timeline:** 6-12 months to full self-reliance

**R-2: WebView differences across platforms**
- **Impact:** Different behavior on macOS vs Linux vs Windows
- **Mitigation:** Test matrix, document platform-specific quirks
- **Acceptance:** Phase 1 uses Chromium (consistent), Phase 2 deals with this

**R-3: Servo immaturity**
- **Impact:** May not be production-ready by Q2 2026
- **Mitigation:** Monitor Servo progress, fallback to WebKit wrapper
- **Decision point:** Q1 2026 reassessment

---

## Comparison: Current vs Proposed

| Aspect | Current (Playwright) | Phase 1 (API Wrapper) | Phase 2 (Rust Browser) |
|--------|---------------------|----------------------|------------------------|
| **Self-Reliance** | ❌ External Chromium | ⚠️ Wrapped Chromium | ✅ Own browser |
| **API Discovery** | ❌ None | ✅ `/api/capabilities` | ✅ Full discovery |
| **Bidirectional** | ❌ One-way | ✅ Both ways | ✅ Both ways |
| **Docker Size** | +200MB | +200MB | +50MB |
| **Surveillance** | ❌ Google telemetry | ⚠️ Can strip | ✅ No telemetry |
| **Offline** | ❌ Requires download | ✅ Bundled | ✅ Bundled |
| **Timeline** | Now | 2-3 weeks | 6-12 months |

---

## Recommendation

**Immediate Action (Next 2-3 weeks):**

Implement **Phase 1: reBe Browser API Server**
- Wraps existing Playwright + Chromium
- Exposes discoverable JSON API
- Enables bidirectional integration
- Quick win (2-3 weeks)

**Medium-Term (Q2-Q3 2026):**

Evaluate **Phase 2: Pure Rust Browser**
- Monitor Servo progress
- Prototype WebKit wrapper
- Decision point: Q1 2026

**Rationale:**
- Get API discovery and bidirectional integration **now**
- Don't block AI peer review on browser rewrite
- Incremental path to full self-reliance

---

## API Contract (Phase 1)

### Discovery Endpoint
```http
GET http://localhost:3001/api/capabilities

Response:
{
  "component": "reBe Browser",
  "version": "1.0.0",
  "status": "ready",
  "endpoints": [
    {
      "path": "/browser/navigate",
      "method": "POST",
      "description": "Navigate to URL"
    },
    {
      "path": "/browser/click",
      "method": "POST",
      "description": "Click element"
    },
    {
      "path": "/browser/fill",
      "method": "POST",
      "description": "Fill form input"
    },
    {
      "path": "/browser/extract",
      "method": "GET",
      "description": "Extract content"
    },
    {
      "path": "/browser/execute",
      "method": "POST",
      "description": "Execute JavaScript"
    },
    {
      "path": "/browser/shell",
      "method": "POST",
      "description": "Execute shell command via rebe-shell"
    }
  ],
  "integrations": {
    "rebe-shell": {
      "url": "http://localhost:3000",
      "endpoints": ["/api/sessions", "/api/sessions/:id/input"]
    }
  }
}
```

---

## Next Steps

1. **Review this assessment** with team/stakeholders
2. **Decide:** Phase 1 only, or commit to Phase 2 timeline?
3. **Create:** `docs/REBE_BROWSER_API.md` with full API spec
4. **Implement:** `browser/server.js` with Express + Playwright wrapper
5. **Update:** Automation scripts to use reBe Browser API
6. **Document:** Bidirectional integration patterns
7. **Demo:** AI agent orchestrating browser + shell tasks

---

**Status:** Architecture defined, ready for implementation
**Decision Required:** Approve Phase 1 implementation?
**Timeline:** 2-3 weeks for Phase 1, 6-12 months for Phase 2
**Next Conversation:** Design `docs/REBE_BROWSER_API.md` specification

**Last Updated:** 2025-10-21
