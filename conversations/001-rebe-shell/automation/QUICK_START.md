# Quick Start Guide - AI Peer Review Automation

**Status:** ✅ Ready to Execute
**Duration:** 3-5 hours total
**Location:** `automation/`

---

## TL;DR - Run Everything

```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/automation

# 1. Configure API keys (one time)
cp .env.example .env
nano .env  # Add your API keys

# 2. Run browser automation (human-in-loop, ~2-4 hours)
npm run submit-all

# 3. Run API submissions (automated, ~10 min)
npm run api-submit-all

# 4. Compare results
npm run compare

# 5. Review outputs
ls -la results/
```

---

## Option 1: Individual Browser Submissions (Recommended for First Time)

**Run one at a time to understand the workflow:**

### Microsoft Copilot (GPT-5 with "think deeper")
```bash
npm run submit-copilot
```

**What happens:**
1. Browser opens to https://copilot.microsoft.com/
2. Script checks if authentication needed
3. **YOU authenticate** (5 min window)
4. Script submits 40-page prompt
5. Waits for response (10 min timeout)
6. Extracts and saves to `results/copilot_browser_response.md`
7. Browser closes

**Estimated time:** 30-60 minutes (includes AI response time)

---

### xAI Grok
```bash
npm run submit-grok
```

**URL:** https://x.com/i/grok
**Auth:** X/Twitter login required
**Output:** `results/grok_browser_response.md`
**Time:** 30-60 minutes

---

### Google Gemini
```bash
npm run submit-gemini
```

**URL:** https://gemini.google.com/
**Auth:** Google login required
**Output:** `results/gemini_browser_response.md`
**Time:** 30-60 minutes

---

### DeepSeek
```bash
npm run submit-deepseek
```

**URL:** https://chat.deepseek.com/
**Auth:** DeepSeek login required
**Output:** `results/deepseek_browser_response.md`
**Time:** 30-60 minutes

---

## Option 2: All Browser Submissions (Sequential)

**Run all at once (waits for you at each authentication step):**

```bash
npm run submit-all
```

**Process:**
1. Copilot → authenticate → submit → extract
2. Grok → authenticate → submit → extract
3. Gemini → authenticate → submit → extract
4. DeepSeek → authenticate → submit → extract

**Total time:** 2-4 hours

**Summary report at end:**
```
Results:
  Copilot: ✓
  Grok:    ✓
  Gemini:  ✓
  DeepSeek: ✓

📊 4/4 submissions successful
```

---

## Option 3: API Submissions (Fully Automated)

**Requires API keys in `.env` file.**

```bash
# Configure API keys first
nano .env

# Run parallel API submissions
npm run api-submit-all
```

**APIs used:**
- OpenAI API (GPT-4 Turbo) - replaces Copilot
- Google Generative AI API (Gemini 1.5 Pro)
- xAI API (Grok) - if available
- DeepSeek API - if available

**Total time:** 10-20 minutes (parallel execution)

**Outputs:**
- `results/copilot_api_response.md`
- `results/gemini_api_response.md`
- `results/grok_api_response.md`
- `results/deepseek_api_response.md`

---

## The Prompt Being Sent

**Source files:**
- `docs/AI_PEER_REVIEW_PROMPT.md` - Main prompt (13KB)
- `VISION_COMPREHENSIVE.md` - Technical architecture

**Combined length:** ~40 pages

**Structure:**
```
# AI Peer Review Request: rebe-shell Architecture

## Section A: What We're Building
- Evolution: Web terminal → Shell-as-a-Service → Cognitive Infrastructure
- Current state vs 10-year vision
- Core capabilities and architecture

## Section B: Comparison to Alternatives
- FOSS: tmux, screen, Cockpit, Guacamole, Ansible, K8s, etc.
- Commercial: AWS SSM, Azure Bastion, Tailscale SSH, etc.
- Why rebe-shell is differentiated

## Section C: Ten-Year Horizon (2025-2035)
- Year 1 (2025): Foundation
- Year 2 (2026): Distributed substrate
- Year 3 (2027): Autonomous orchestration
- Years 4-10: Swarms, 6G, cognitive infrastructure

## Section D: Hyper-Distributed Networks
- Capability discovery protocol
- Fractal orchestration (5±2 decomposition)
- Cognitive flow management
- Chronicle-based learning
- VNF/6G/IPv6 architecture
- Mission-critical scenarios

## System-Specific Questions
- Grok: Real-time dynamics, decentralization
- Gemini: Large-scale orchestration
- Copilot: Developer experience
- DeepSeek: Technical depth, failure modes
```

---

## Comparison Analysis

**After collecting both browser and API responses:**

```bash
npm run compare
```

**Generates:** `results/COMPARISON_REPORT.md`

**Analyzes:**
- How ecosystem-optimized chat interfaces differ from raw APIs
- Context engineering impact
- Corpus data access differences
- Response quality and depth comparison

---

## API Key Configuration

**Required for API submissions only** (browser automation doesn't need API keys).

### OpenAI API
1. Go to https://platform.openai.com/api-keys
2. Create new key
3. Add to `.env`: `OPENAI_API_KEY=sk-...`

### Google Gemini API
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Add to `.env`: `GOOGLE_API_KEY=AIza...`

### xAI (Grok) API
1. Check https://x.ai for API access
2. May not be publicly available yet
3. Skip if unavailable

### DeepSeek API
1. Check https://www.deepseek.com
2. Look for API access
3. Skip if unavailable

---

## Outputs and Results

### Expected Files

```
results/
├── copilot_browser_response.md    # Copilot chat (ecosystem-optimized)
├── copilot_api_response.md        # OpenAI API (custom config)
├── grok_browser_response.md       # Grok chat (ecosystem-optimized)
├── grok_api_response.md           # xAI API (custom config)
├── gemini_browser_response.md     # Gemini chat (ecosystem-optimized)
├── gemini_api_response.md         # Google AI API (custom config)
├── deepseek_browser_response.md   # DeepSeek chat (ecosystem-optimized)
├── deepseek_api_response.md       # DeepSeek API (custom config)
└── COMPARISON_REPORT.md           # Analysis of differences
```

### Response Format

Each file contains:
```markdown
# [AI System] Peer Review Response

**Submitted:** 2025-10-21T...
**Method:** Browser Automation | API
**Model:** [Model name]

---

[AI response here - typically 5-15 pages]

---

**Metadata:**
- Prompt Length: X characters
- Response Length: Y characters
- Token Usage: Z tokens
```

---

## Troubleshooting

### "Module not found"
```bash
cd automation
npm install
```

### "Playwright Chromium not found"
```bash
npx playwright install chromium
```

### "API key not set"
```bash
# Check .env exists
cat .env

# Verify format
# OPENAI_API_KEY=sk-...
# (no quotes, no spaces around =)
```

### Browser doesn't open
```bash
# Test Playwright
node -e "const {chromium} = require('playwright'); chromium.launch({headless: false}).then(b => { console.log('Works!'); setTimeout(() => b.close(), 3000); })"
```

### Authentication timeout (5 min)
- Script waits 5 minutes for you to log in
- If timeout, just re-run the script
- Browser stays visible so you can interact

### Response extraction fails
- Responses saved even if extraction has issues
- Check browser console for selectors
- May need to update selectors if UI changed

---

## Performance Notes

**Browser Automation (Human-in-Loop):**
- ✅ Accesses ecosystem-optimized chat interfaces
- ✅ Benefits from corpus data engineering
- ✅ Gets context-aware responses
- ❌ Slower (30-60 min each)
- ❌ Requires authentication
- ❌ UI selector fragility

**API Submissions (Automated):**
- ✅ Fast (10-20 min total, parallel)
- ✅ Consistent structured responses
- ✅ Full control over parameters
- ❌ No ecosystem context engineering
- ❌ No corpus data access
- ❌ May need API access (not always public)

---

## Recommended Workflow

**Day 1: Browser Automation**
1. Morning: Test with Copilot (`npm run submit-copilot`)
2. Verify output saved correctly
3. Run all submissions: `npm run submit-all`
4. Review browser responses

**Day 1: API Automation**
1. Configure API keys (`.env`)
2. Run API submissions: `npm run api-submit-all`
3. Review API responses

**Day 2: Analysis**
1. Compare results: `npm run compare`
2. Create synthesis document
3. Update architecture based on feedback
4. Create risk register

---

## Success Criteria

✅ **Setup Complete:**
- Dependencies installed
- Scripts executable
- Docker container running
- Results directory ready

✅ **Browser Submissions:**
- 4/4 AI systems authenticated
- 4/4 prompts submitted
- 4/4 responses extracted
- 4/4 files saved

✅ **API Submissions:**
- API keys configured
- 2-4 APIs available
- 2-4 responses received
- 2-4 files saved

✅ **Analysis:**
- Comparison report generated
- Synthesis document created
- Architecture updated
- Risk register created

---

## Next Steps After Completion

1. **Synthesize feedback** into single document
2. **Identify consensus** across AI systems
3. **Highlight divergences** and reasoning
4. **Update architecture** based on recommendations
5. **Create risk register** from identified concerns
6. **Prioritize** Phase 1 implementation
7. **Document decisions** in ADR format

---

**Ready to start?**

```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/automation
npm run submit-copilot  # Start with Copilot
```
