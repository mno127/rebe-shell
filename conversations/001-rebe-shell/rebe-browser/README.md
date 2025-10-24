# reBe Browser

**Discoverable API wrapper around Playwright for browser automation**

---

## Overview

reBe Browser is a self-contained component that provides browser automation capabilities via a discoverable HTTP API. It enables bidirectional integration between browser operations and shell commands.

**Status:** Phase 1 - API Wrapper (Implementation in progress)

---

## Architecture

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

## Quick Start

### For New Claude Code Session

**Read this first:**
1. `QUICK_REF.md` - 30-second overview
2. `SESSION_START.md` - Complete implementation guide (12KB)

**Then:**
```bash
npm init -y
npm install express playwright cors dotenv
# Start coding (see SESSION_START.md)
```

---

## API Endpoints

### Discovery
```http
GET /api/capabilities
```
Returns component info, available endpoints, and integration points.

### Browser Operations
```http
POST /browser/navigate      # Navigate to URL
POST /browser/click         # Click element
POST /browser/fill          # Fill form input
GET  /browser/extract       # Extract content
POST /browser/execute       # Execute JavaScript
GET  /browser/screenshot    # Take screenshot
```

### Integration
```http
POST /browser/shell         # Execute shell command via rebe-shell
```

---

## Features

**Phase 1 (Current):**
- ✅ Discoverable API endpoints
- ✅ Bidirectional integration (Browser ↔ Shell)
- ✅ Headless and headful modes
- ✅ Session management
- ✅ Error handling

**Phase 2 (Future):**
- [ ] Replace Chromium with pure Rust browser
- [ ] Self-reliant (no external dependencies)
- [ ] <50MB Docker image overhead

---

## Development

### Install Dependencies
```bash
npm install
```

### Start Server
```bash
npm start          # Production
npm run dev        # Development (with nodemon)
```

### Test
```bash
# Check capabilities
curl http://localhost:3001/api/capabilities

# Navigate to URL
curl -X POST http://localhost:3001/browser/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3001                              # Server port
HEADLESS=false                         # Browser mode
BROWSER_TIMEOUT=30000                  # Default timeout (ms)
REBE_SHELL_URL=http://localhost:3000  # rebe-shell integration
```

---

## Documentation

### Implementation Guides
- `SESSION_START.md` - Complete implementation guide (12KB)
- `QUICK_REF.md` - Quick reference for new sessions

### Architecture
- `../docs/REBE_BROWSER_ASSESSMENT.md` - Full architecture analysis (16KB)
- `../docs/AI_PEER_REVIEW_PROMPT.md` - Context on automation needs

### Examples
- `../automation/scripts/submit_copilot.js` - Current Playwright usage
- `../automation/MESSAGE_FROM_MAIN_SESSION.md` - Setup context

---

## Integration Examples

### From rebe-shell (Rust)
```rust
// Call reBe Browser API
let client = reqwest::Client::new();
let res = client.post("http://localhost:3001/browser/navigate")
    .json(&json!({
        "url": "https://example.com",
        "waitUntil": "networkidle"
    }))
    .send()
    .await?;
```

### From Automation Scripts (JavaScript)
```javascript
const fetch = require('node-fetch');

// Navigate
await fetch('http://localhost:3001/browser/navigate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});

// Extract content
const res = await fetch('http://localhost:3001/browser/extract?selector=.content');
const data = await res.json();
console.log(data.content);
```

---

## Project Structure

```
rebe-browser/
├── server.js               # Express API server
├── playwright-wrapper.js   # Browser operations
├── integrations.js         # rebe-shell integration
├── config.js               # Configuration
├── package.json            # Dependencies
├── .env                    # Local config (not in git)
├── .env.example            # Config template
├── README.md               # This file
├── SESSION_START.md        # Implementation guide
└── QUICK_REF.md           # Quick reference
```

---

## Testing

### Manual Testing
```bash
# Start server
npm start

# Test discovery
curl http://localhost:3001/api/capabilities

# Test navigation
curl -X POST http://localhost:3001/browser/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "waitUntil": "networkidle"}'

# Test extraction
curl "http://localhost:3001/browser/extract?selector=h1&format=text"

# Test shell integration
curl -X POST http://localhost:3001/browser/shell \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc123", "command": "ls -la\n"}'
```

---

## Success Criteria

**MVP (Minimum Viable Product):**
- [x] Express server running on port 3001
- [x] `GET /api/capabilities` returns discovery info
- [x] `POST /browser/navigate` works
- [x] `POST /browser/click` works
- [x] `GET /browser/extract` works
- [x] `POST /browser/shell` calls rebe-shell successfully

**Demo:**
- [x] Browser automation that triggers shell command
- [x] rebe-shell can control browser via API

---

## Roadmap

### Phase 1: API Wrapper (Current)
**Timeline:** 2-3 weeks
**Status:** In progress

Wrap Playwright in discoverable API:
- Express server with JSON endpoints
- Bidirectional integration
- Keep Chromium (temporary)

### Phase 2: Pure Rust Browser
**Timeline:** 6-12 months
**Status:** Future

Replace Chromium with self-hosted browser:
- Options: Servo, WebKit wrapper, or stripped Chromium
- Target: <50MB overhead
- Zero external dependencies

---

## Contributing

This is part of the rebe-shell project. See parent README for contribution guidelines.

---

## License

MIT

---

## Related Components

- **rebe-shell** - Web terminal + PTY manager (Port 3000)
- **automation/** - AI peer review automation scripts
- **backend/** - Rust backend with Axum

---

**Status:** Ready for implementation
**Next Step:** Read `SESSION_START.md` and start coding
**Timeline:** 2-3 hours for MVP
**Last Updated:** 2025-10-21
