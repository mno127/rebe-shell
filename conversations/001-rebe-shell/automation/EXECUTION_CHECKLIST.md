# AI Peer Review Execution Checklist

**Date:** 2025-10-21
**Status:** ✅ Ready for Execution

---

## Pre-Flight Check

### ✅ System Ready
- [x] Node.js v22.17.1 installed
- [x] npm 10.9.2 installed
- [x] Playwright v1.56.1 installed
- [x] Chromium browser downloaded
- [x] 68 npm packages installed
- [x] Results directory created
- [x] Docker container running (rebe-shell)
- [x] All 6 automation scripts present

### 📋 User Configuration Required
- [ ] API keys configured in `.env` file (optional, for API submissions)

---

## Execution Plan

### Phase 1: Test Run (30-60 minutes)

**Objective:** Verify automation works with one AI system

```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/automation

# Run Microsoft Copilot submission
npm run submit-copilot
```

**Expected behavior:**
1. ✅ Browser opens to https://copilot.microsoft.com/
2. ✅ Script detects authentication status
3. ✅ You log in (if needed) within 5 minutes
4. ✅ Script submits 40-page prompt
5. ✅ Script waits for AI response (up to 10 minutes)
6. ✅ Response extracted and saved to `results/copilot_browser_response.md`
7. ✅ Browser closes automatically

**Validation:**
```bash
# Check output exists
ls -lh results/copilot_browser_response.md

# Preview response
head -n 50 results/copilot_browser_response.md

# Check file size (should be 10KB+)
du -h results/copilot_browser_response.md
```

**Success criteria:**
- ✅ File created
- ✅ Contains AI response (not error message)
- ✅ Includes metadata (timestamp, model, etc.)
- ✅ Response is substantive (10KB+)

---

### Phase 2: Full Browser Automation (2-4 hours)

**Objective:** Collect ecosystem-optimized responses from all AI systems

```bash
npm run submit-all
```

**Timeline:**
- 0:00 → Start Copilot submission
- 0:30 → Copilot complete, start Grok
- 1:00 → Grok complete, start Gemini
- 1:30 → Gemini complete, start DeepSeek
- 2:00 → All complete

**What to expect:**
1. **Microsoft Copilot** (https://copilot.microsoft.com/)
   - Auth: Microsoft account
   - Time: 30-60 min
   - Output: `results/copilot_browser_response.md`

2. **xAI Grok** (https://x.com/i/grok)
   - Auth: X/Twitter account
   - Time: 30-60 min
   - Output: `results/grok_browser_response.md`

3. **Google Gemini** (https://gemini.google.com/)
   - Auth: Google account
   - Time: 30-60 min
   - Output: `results/gemini_browser_response.md`

4. **DeepSeek** (https://chat.deepseek.com/)
   - Auth: DeepSeek account
   - Time: 30-60 min
   - Output: `results/deepseek_browser_response.md`

**Validation:**
```bash
# Check all files created
ls -lh results/*_browser_response.md

# Quick summary of file sizes
du -h results/*_browser_response.md

# Count total responses
ls results/*_browser_response.md | wc -l
# Expected: 4
```

**Success criteria:**
- ✅ 4 files created
- ✅ Each file 10KB+
- ✅ No error messages in files
- ✅ Each contains AI response content

---

### Phase 3: API Submissions (10-20 minutes)

**Objective:** Collect custom-configured API responses for comparison

**Prerequisites:**
```bash
# Create .env file
cp .env.example .env

# Edit with your API keys
nano .env
```

Required keys:
```env
OPENAI_API_KEY=sk-...          # https://platform.openai.com/api-keys
GOOGLE_API_KEY=AIza...         # https://makersuite.google.com/app/apikey
XAI_API_KEY=xai-...            # https://x.ai (if available)
DEEPSEEK_API_KEY=...           # https://www.deepseek.com (if available)
```

**Execute:**
```bash
npm run api-submit-all
```

**Timeline:**
- All APIs run in parallel (~10 minutes)
- No human interaction needed

**Validation:**
```bash
# Check API response files
ls -lh results/*_api_response.md

# Count API responses
ls results/*_api_response.md | wc -l
# Expected: 2-4 (depending on API availability)
```

**Success criteria:**
- ✅ At least 2 API responses (OpenAI + Google)
- ✅ Each file 10KB+
- ✅ Includes token usage metadata
- ✅ Response quality comparable to browser

---

### Phase 4: Comparison Analysis (30 minutes)

**Objective:** Compare ecosystem vs API responses

```bash
npm run compare
```

**Generates:** `results/COMPARISON_REPORT.md`

**Analyzes:**
- Response length differences
- Content depth differences
- Specific recommendations
- Tone and style variations
- Ecosystem context impact

**Validation:**
```bash
# Check comparison report exists
ls -lh results/COMPARISON_REPORT.md

# Preview report
head -n 100 results/COMPARISON_REPORT.md
```

**Success criteria:**
- ✅ Report generated
- ✅ Compares browser vs API for each system
- ✅ Highlights key differences
- ✅ Provides insights on ecosystem impact

---

### Phase 5: Synthesis & Analysis (2-3 hours)

**Objective:** Create comprehensive synthesis of all feedback

**Manual tasks:**

1. **Read all responses:**
   ```bash
   # Browser responses
   cat results/copilot_browser_response.md
   cat results/grok_browser_response.md
   cat results/gemini_browser_response.md
   cat results/deepseek_browser_response.md

   # API responses
   cat results/copilot_api_response.md
   cat results/gemini_api_response.md
   ```

2. **Create synthesis document:**
   ```bash
   nano docs/PEER_REVIEW_SYNTHESIS.md
   ```

   **Structure:**
   ```markdown
   # AI Peer Review Synthesis

   ## Executive Summary
   [Consensus across all AI systems]

   ## Common Themes
   [Issues raised by 3+ systems]

   ## Unique Insights
   [Valuable points from individual systems]

   ## Critical Flaws Identified
   [Dealbreakers mentioned]

   ## Moderate Concerns
   [Issues to address]

   ## Surprising Strengths
   [Positive feedback]

   ## Contradictions
   [Where AI systems disagree]

   ## Consensus Recommendations
   [Actions agreed upon by multiple systems]

   ## Alternative Architectures Proposed
   [Radically different approaches suggested]

   ## Adjacent Research
   [Papers, projects, companies mentioned]

   ## Timeline Revisions
   [Suggested changes to 10-year roadmap]

   ## Open Questions
   [Research gaps identified]
   ```

3. **Create revised architecture:**
   ```bash
   nano docs/ARCHITECTURE_REVISED.md
   ```

   **Address:**
   - Critical flaws from synthesis
   - Moderate concerns
   - Incorporate alternative architectures
   - Update based on consensus recommendations

4. **Create risk register:**
   ```bash
   nano docs/RISK_REGISTER.md
   ```

   **Format:**
   ```markdown
   # Risk Register

   | ID | Risk | Severity | Likelihood | Impact | Mitigation |
   |----|------|----------|------------|--------|------------|
   | R-001 | Chronicle storage at 10M writes/sec | High | High | Blockchain too slow | Use append-only log (Kafka/Pulsar) instead |
   | R-002 | PTY-over-WebSocket scale limits | Medium | Medium | May not reach 20M concurrent | Benchmark early, plan sharding strategy |
   | ... | ... | ... | ... | ... | ... |
   ```

**Success criteria:**
- ✅ Synthesis document created
- ✅ Revised architecture documented
- ✅ Risk register with 15+ risks
- ✅ Mitigation strategies defined
- ✅ Priorities assigned

---

## Troubleshooting Guide

### Problem: Browser doesn't open

**Diagnosis:**
```bash
# Test Playwright
node -e "const {chromium} = require('playwright'); chromium.launch({headless: false}).then(b => { console.log('✅ Works'); setTimeout(() => b.close(), 3000); })"
```

**Fix:**
```bash
# Reinstall Chromium
npx playwright install chromium --force
```

---

### Problem: Authentication timeout

**Symptoms:**
- Script says "Waiting for authentication..."
- 5 minutes pass
- Script exits with timeout error

**Fix:**
- Re-run the script
- Be ready to authenticate immediately
- Keep browser window visible

---

### Problem: Response extraction fails

**Symptoms:**
- Browser shows AI response
- Script saves file but it's empty or contains error

**Diagnosis:**
```bash
# Check error message in output file
cat results/copilot_browser_response.md
```

**Fix:**
- UI selectors may have changed
- Open issue with selector details
- Manually copy response and save

---

### Problem: API key error

**Symptoms:**
- "Invalid API key"
- "API key not set"

**Diagnosis:**
```bash
# Check .env exists
cat .env

# Verify format (no quotes, no spaces)
# CORRECT:   OPENAI_API_KEY=sk-abc123
# INCORRECT: OPENAI_API_KEY="sk-abc123"
# INCORRECT: OPENAI_API_KEY = sk-abc123
```

**Fix:**
```bash
# Re-create .env
rm .env
cp .env.example .env
nano .env  # Add keys carefully
```

---

### Problem: Response too short

**Symptoms:**
- AI response is only 1-2 paragraphs
- Expected 5-15 pages

**Possible causes:**
1. AI system rate-limited the response
2. Context window exceeded
3. Prompt wasn't fully submitted

**Fix:**
- Check browser console for errors
- Verify prompt length: `wc -c docs/AI_PEER_REVIEW_PROMPT.md`
- Try splitting prompt into parts

---

## Success Metrics Summary

### Quantitative Goals
- [x] ✅ Setup complete (100%)
- [ ] 📋 4/4 browser submissions complete
- [ ] 📋 2-4 API submissions complete
- [ ] 📋 Comparison report generated
- [ ] 📋 Synthesis document created (10+ pages)
- [ ] 📋 Revised architecture documented
- [ ] 📋 Risk register created (15+ risks)

### Qualitative Goals
- [ ] 📋 Identified 3+ critical flaws
- [ ] 📋 Received 10+ specific technical recommendations
- [ ] 📋 Discovered 2+ alternative architectures
- [ ] 📋 Found 10+ adjacent research papers/projects
- [ ] 📋 Revised timeline with rationale
- [ ] 📋 Open questions list for future research

---

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Test Run** | 30-60 min | Single submission (Copilot) |
| **Browser Automation** | 2-4 hours | All 4 AI systems via browser |
| **API Submissions** | 10-20 min | All APIs in parallel |
| **Comparison** | 30 min | Generate comparison report |
| **Synthesis** | 2-3 hours | Create synthesis + risk register |
| **Total** | ~6-8 hours | Complete peer review cycle |

---

## Next Steps

### Immediate (Do Now)
```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/automation

# Test with one submission
npm run submit-copilot

# Verify output
cat results/copilot_browser_response.md
```

### Today (If Test Succeeds)
```bash
# Run all browser submissions
npm run submit-all

# Configure API keys
cp .env.example .env
nano .env

# Run API submissions
npm run api-submit-all

# Compare results
npm run compare
```

### This Week
- Create synthesis document
- Revise architecture
- Build risk register
- Update roadmap

---

## Resources

### Documentation
- `README_AUTOMATION.md` - Complete system overview
- `QUICK_START.md` - Quick reference
- `SETUP_COMPLETE.md` - Installation summary
- `INSTALL.md` - Detailed installation

### Scripts
- `scripts/submit_copilot.js`
- `scripts/submit_grok.js`
- `scripts/submit_gemini.js`
- `scripts/submit_deepseek.js`
- `scripts/submit_all.js`
- `scripts/api_submit_all.js`

### Prompts
- `docs/AI_PEER_REVIEW_PROMPT.md`
- `VISION_COMPREHENSIVE.md`

---

**Status:** Ready for execution
**Next Command:** `npm run submit-copilot`
**Estimated Total Time:** 6-8 hours
**Last Updated:** 2025-10-21
