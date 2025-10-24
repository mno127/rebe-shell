# Quick Reference - reBe Browser

**New Session? Start here:**

---

## 📋 Your Mission
Build Phase 1 of reBe Browser: API wrapper around Playwright with discoverable endpoints.

**Timeline:** 2-3 hours
**Status:** Starting from scratch

---

## 🚀 Quick Start

```bash
# Initialize
npm init -y
npm install express playwright cors dotenv

# Create server.js and start coding
# See SESSION_START.md for full implementation guide
```

---

## 🎯 Must-Have Endpoints

```
GET  /api/capabilities      # Discovery
POST /browser/navigate      # Go to URL
POST /browser/click         # Click element
GET  /browser/extract       # Get content
POST /browser/shell         # Call rebe-shell
```

---

## 📚 Full Context

Read `SESSION_START.md` for:
- Complete architecture
- API contract
- Implementation checklist
- Code examples
- Integration patterns

---

## 🔗 Related Docs

- `../docs/REBE_BROWSER_ASSESSMENT.md` - Architecture analysis
- `../automation/scripts/submit_copilot.js` - Current usage
- `../automation/MESSAGE_FROM_MAIN_SESSION.md` - What main session did

---

## ✅ Success Criteria

- [ ] Server running on port 3001
- [ ] Discovery endpoint works
- [ ] Can navigate to URLs
- [ ] Can click elements
- [ ] Can extract content
- [ ] Can call rebe-shell API

**Test:**
```bash
curl http://localhost:3001/api/capabilities
```

---

**Start reading:** `SESSION_START.md`
