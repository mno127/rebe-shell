# reBe Browser - Session Start Context

**Date:** 2025-10-21
**Session:** Claude Code implementation of reBe Browser component
**Parent Project:** rebe-shell

---

## Your Mission

Implement **Phase 1 of reBe Browser**: API wrapper around Playwright that provides:
1. ✅ Discoverable API (`GET /api/capabilities`)
2. ✅ Bidirectional integration (Browser ↔ Shell)
3. ✅ Self-contained component with clear API contract

**Timeline:** 2-3 hours
**Status:** Starting from scratch

---

## Context: What reBe Browser Is

**Problem:** rebe-shell currently uses external Playwright + Chromium directly
- ❌ No API discoverability
- ❌ No bidirectional integration
- ❌ Not self-reliant (depends on Google Chromium)

**Solution (Phase 1):** Wrap Playwright in a discoverable API server
- ✅ Express.js server exposing browser operations
- ✅ Components discover each other via `/api/capabilities`
- ✅ reBe Browser can call rebe-shell API
- ✅ rebe-shell can call reBe Browser API

**Architecture:**
```
┌────────────────┐ HTTP    ┌───────────────────┐
│  rebe-shell    │────────→│  reBe Browser     │
│  (Rust/Axum)   │         │  (Node/Express)   │
│  Port 3000     │←────────│  Port 3001        │
│  PTY Sessions  │         │  Browser Control  │
└────────────────┘         └─────────┬─────────┘
                                     ↓
                              Playwright+Chromium
```

---

## What You Need to Build

### 1. Express API Server

**File:** `server.js`

**Endpoints:**
```javascript
GET  /api/capabilities      // Discovery endpoint
POST /browser/navigate      // Navigate to URL
POST /browser/click         // Click element
POST /browser/fill          // Fill form input
GET  /browser/extract       // Extract content
POST /browser/execute       // Execute JavaScript
POST /browser/shell         // Execute shell command via rebe-shell
GET  /browser/screenshot    // Take screenshot
POST /browser/close         // Close browser context
```

### 2. Playwright Wrapper

**File:** `playwright-wrapper.js`

**Responsibilities:**
- Manage browser lifecycle (launch, contexts, pages)
- Handle authentication (cookies, localStorage)
- Execute browser operations (navigate, click, fill, extract)
- Error handling and timeouts

### 3. Integration Layer

**File:** `integrations.js`

**Responsibilities:**
- Call rebe-shell API: `POST http://localhost:3000/api/sessions/:id/input`
- Discover rebe-shell capabilities
- Health checks

### 4. Configuration

**File:** `config.js`

**Settings:**
- Browser launch options (headless/headful)
- Timeouts and retries
- Port configuration
- rebe-shell URL

---

## Implementation Checklist

### Phase 1.1: Basic Server (30 min)

- [ ] Initialize npm project: `npm init -y`
- [ ] Install dependencies: `express`, `playwright`, `cors`, `dotenv`
- [ ] Create `server.js` with Express app
- [ ] Implement `GET /api/capabilities` endpoint
- [ ] Test: `curl http://localhost:3001/api/capabilities`

### Phase 1.2: Browser Operations (60 min)

- [ ] Create `playwright-wrapper.js`
- [ ] Implement `POST /browser/navigate`
- [ ] Implement `POST /browser/click`
- [ ] Implement `POST /browser/fill`
- [ ] Implement `GET /browser/extract`
- [ ] Test each endpoint with curl/Postman

### Phase 1.3: Shell Integration (30 min)

- [ ] Create `integrations.js`
- [ ] Implement `POST /browser/shell` (calls rebe-shell API)
- [ ] Test bidirectional communication
- [ ] Demo: Browser automation triggers shell command

### Phase 1.4: Documentation (30 min)

- [ ] Create `API.md` with endpoint documentation
- [ ] Create `README.md` with setup instructions
- [ ] Create `EXAMPLES.md` with usage examples
- [ ] Update parent `docker-compose.yml` to include rebe-browser

---

## Key Design Principles

### 1. API Discoverability

Every component exposes `/api/capabilities`:
```json
{
  "component": "reBe Browser",
  "version": "1.0.0",
  "status": "ready",
  "endpoints": [...],
  "integrations": {
    "rebe-shell": "http://localhost:3000"
  }
}
```

### 2. Bidirectional Integration

Both components can call each other:
- rebe-shell → reBe Browser: "Navigate to URL and extract content"
- reBe Browser → rebe-shell: "Execute this shell command in a PTY session"

### 3. Stateless Operations

Each request is independent:
- No session state stored in API server
- Browser contexts created/destroyed per operation
- Allows horizontal scaling later

### 4. Error Handling

Consistent error format:
```json
{
  "success": false,
  "error": "ElementNotFoundError",
  "message": "Could not find element with selector 'button#submit'",
  "details": {...}
}
```

---

## API Contract (Reference)

### Discovery Endpoint

```http
GET /api/capabilities

Response 200 OK:
{
  "component": "reBe Browser",
  "version": "1.0.0",
  "status": "ready",
  "endpoints": [
    {
      "path": "/browser/navigate",
      "method": "POST",
      "description": "Navigate to URL",
      "parameters": {
        "url": "string (required)",
        "waitUntil": "string (optional: 'load'|'domcontentloaded'|'networkidle')"
      }
    },
    // ... other endpoints
  ],
  "integrations": {
    "rebe-shell": {
      "url": "http://localhost:3000",
      "endpoints": ["/api/sessions", "/api/sessions/:id/input"]
    }
  }
}
```

### Navigation Endpoint

```http
POST /browser/navigate
Content-Type: application/json

{
  "url": "https://example.com",
  "waitUntil": "networkidle",
  "timeout": 30000
}

Response 200 OK:
{
  "success": true,
  "title": "Example Domain",
  "url": "https://example.com/"
}
```

### Click Endpoint

```http
POST /browser/click
Content-Type: application/json

{
  "selector": "button#submit",
  "timeout": 5000
}

Response 200 OK:
{
  "success": true
}
```

### Extract Endpoint

```http
GET /browser/extract?selector=.response&format=text

Response 200 OK:
{
  "success": true,
  "content": "Extracted text content here...",
  "length": 1234
}
```

### Shell Integration Endpoint

```http
POST /browser/shell
Content-Type: application/json

{
  "session_id": "abc123",
  "command": "npm test\n"
}

Response 200 OK:
{
  "success": true,
  "message": "Command sent to rebe-shell session abc123"
}
```

---

## Resources Available

### Documentation

**In parent directory:**
- `docs/REBE_BROWSER_ASSESSMENT.md` - Full architecture assessment (16KB)
- `docs/AI_PEER_REVIEW_PROMPT.md` - Context on what automation needs
- `automation/scripts/submit_copilot.js` - Example of current Playwright usage

**Reference:**
- Playwright API: https://playwright.dev/docs/api/class-playwright
- Express.js: https://expressjs.com/en/guide/routing.html

### Existing Components

**rebe-shell (Port 3000):**
```bash
# Create session
POST /api/sessions → {"id": "abc123"}

# WebSocket for I/O
GET /api/sessions/:id/ws

# Send input
POST /api/sessions/:id/input
{"data": "ls -la\n"}
```

**automation scripts (Port N/A):**
- Currently use Playwright directly
- Need to be migrated to call reBe Browser API
- See `automation/scripts/` for examples

---

## Success Criteria

### Minimum Viable Product (MVP)

- [x] Express server running on port 3001
- [x] `GET /api/capabilities` returns discovery info
- [x] `POST /browser/navigate` works
- [x] `POST /browser/click` works
- [x] `GET /browser/extract` works
- [x] `POST /browser/shell` calls rebe-shell successfully
- [x] Demo: Browser automation that triggers shell command

### Nice-to-Have (If Time Permits)

- [ ] `POST /browser/execute` for custom JavaScript
- [ ] `GET /browser/screenshot` for visual debugging
- [ ] Session management (reuse browser contexts)
- [ ] Docker compose integration

---

## Development Flow

### Step 1: Initialize Project

```bash
cd rebe-browser
npm init -y
npm install express playwright cors dotenv
npm install --save-dev nodemon
```

### Step 2: Create Basic Server

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Discovery endpoint
app.get('/api/capabilities', (req, res) => {
  res.json({
    component: 'reBe Browser',
    version: '1.0.0',
    status: 'ready',
    endpoints: [...]
  });
});

app.listen(PORT, () => {
  console.log(`reBe Browser running on port ${PORT}`);
});
```

### Step 3: Add Playwright Wrapper

```javascript
// playwright-wrapper.js
const { chromium } = require('playwright');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async navigate(url, options = {}) {
    await this.page.goto(url, options);
    return {
      title: await this.page.title(),
      url: this.page.url()
    };
  }

  async click(selector, options = {}) {
    await this.page.click(selector, options);
  }

  async extract(selector) {
    const element = await this.page.$(selector);
    if (!element) throw new Error('Element not found');
    return await element.innerText();
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = BrowserManager;
```

### Step 4: Integrate with Server

```javascript
// In server.js
const BrowserManager = require('./playwright-wrapper');
const browser = new BrowserManager();

// Initialize browser on startup
browser.launch().catch(console.error);

// Navigation endpoint
app.post('/browser/navigate', async (req, res) => {
  try {
    const { url, waitUntil, timeout } = req.body;
    const result = await browser.navigate(url, { waitUntil, timeout });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Step 5: Test

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Test endpoints
curl http://localhost:3001/api/capabilities

curl -X POST http://localhost:3001/browser/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "waitUntil": "networkidle"}'
```

---

## Integration Example

Once built, automation scripts will use it like this:

```javascript
// Before: Direct Playwright
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://copilot.microsoft.com/');
await page.click('textarea');

// After: reBe Browser API
const fetch = require('node-fetch');

await fetch('http://localhost:3001/browser/navigate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://copilot.microsoft.com/',
    waitUntil: 'networkidle'
  })
});

await fetch('http://localhost:3001/browser/click', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selector: 'textarea' })
});
```

---

## Questions to Explore

1. **Session Management:** Should we maintain long-lived browser contexts or create/destroy per request?
2. **Authentication:** How to handle saved cookies/localStorage?
3. **Concurrency:** Can we handle multiple browser operations in parallel?
4. **Error Recovery:** What happens if Chromium crashes?
5. **Docker Integration:** Should reBe Browser run in same container as rebe-shell or separate?

---

## Next Steps After MVP

### Phase 1.5: Polish (If Time)
- Add more endpoints (screenshot, execute JS, cookies)
- Better error handling
- Logging and debugging
- Health checks

### Phase 2: Pure Rust Browser (Future)
- Replace Chromium with Servo/WebKit
- Native Rust integration with rebe-shell
- Full self-reliance

---

## Getting Started

**Your first command in this new session:**

```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/rebe-browser
cat SESSION_START.md
```

Then:
1. Initialize npm project
2. Install dependencies
3. Create server.js
4. Implement discovery endpoint
5. Test with curl

**Estimated time:** 2-3 hours for MVP

---

**Ready to build reBe Browser!**

**Status:** Session context ready
**Next:** Restart Claude Code in rebe-browser directory
**Goal:** Discoverable API wrapper around Playwright
