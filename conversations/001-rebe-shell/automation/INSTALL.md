# Installation & Setup

## Prerequisites

All automation runs **inside the rebe-shell Docker container**.

## Step 1: Install Dependencies

```bash
# In the rebe-shell web terminal (http://localhost:3000)
cd /app/automation
npm install
```

This installs:
- **playwright** - Browser automation
- **openai** - OpenAI API client
- **@google/generative-ai** - Google Gemini API
- **axios** - HTTP client for other APIs
- **chalk, ora** - CLI UI enhancements

## Step 2: Install Playwright Browsers

```bash
# Install Chromium for headless browsing
npx playwright install chromium
```

## Step 3: Configure API Keys

```bash
# Create .env file
cat > .env << 'EOF'
# OpenAI (for GPT-4 Turbo - Copilot backend)
OPENAI_API_KEY=sk-...

# Google (for Gemini)
GOOGLE_API_KEY=AIza...

# xAI (for Grok - if available)
XAI_API_KEY=xai-...

# DeepSeek (if available)
DEEPSEEK_API_KEY=...

# Anthropic (already set from docker-compose)
# ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
EOF

# Secure the file
chmod 600 .env
```

## Step 4: Verify Setup

```bash
# Check Node.js
node --version  # Should be v20.x

# Check npm packages
npm list --depth=0

# Check environment
source .env && env | grep -E "OPENAI|GOOGLE|XAI|DEEPSEEK|ANTHROPIC"
```

## Step 5: Test Browser Automation

```bash
# Test Playwright setup
node -e "const {chromium} = require('playwright'); chromium.launch().then(b => { console.log('✅ Playwright works!'); b.close(); })"
```

## Usage

### Browser Automation (Human-in-Loop for Auth)

```bash
# Submit to Microsoft Copilot
npm run submit-copilot

# Submit to Grok
npm run submit-grok

# Submit to Gemini
npm run submit-gemini

# Submit to DeepSeek
npm run submit-deepseek

# Or all at once (sequential, ~2 hours)
npm run submit-all
```

### API Submissions (Fully Automated)

```bash
# Submit to all APIs (parallel, ~10 minutes)
npm run api-submit-all
```

### Compare Results

```bash
# Generate comparison report
npm run compare
```

## Troubleshooting

### "Module not found: playwright"

```bash
cd /app/automation
npm install
```

### "Chromium not found"

```bash
npx playwright install chromium
```

### "API key not set"

```bash
# Check .env file exists
cat .env

# Source it before running
source .env
npm run api-submit-all
```

### Browser authentication fails

The script will:
1. Open browser window (you'll see it)
2. Navigate to login page
3. **Wait for YOU to authenticate** (5 min timeout)
4. Proceed once authenticated

If timeout occurs, re-run the script.

## Expected Timeline

- **Browser submissions**: ~30-60 min each (total ~2-4 hours)
  - Includes wait time for responses
  - Human-in-loop for authentication

- **API submissions**: ~10-20 min total (parallel)
  - No human interaction needed
  - Faster but lacks ecosystem context

## Output

Results saved to:
```
automation/results/
├── copilot_browser_response.md    # Browser automation
├── copilot_api_response.md        # Direct API (OpenAI)
├── grok_browser_response.md       # Browser automation
├── grok_api_response.md           # Direct API (xAI)
├── gemini_browser_response.md     # Browser automation
├── gemini_api_response.md         # Direct API (Google)
├── deepseek_browser_response.md   # Browser automation
├── deepseek_api_response.md       # Direct API (DeepSeek)
└── COMPARISON_REPORT.md           # Analysis of differences
```

## Next Steps

After collecting all responses:

1. **Review each response** individually
2. **Run comparison** (`npm run compare`)
3. **Create synthesis** (`docs/PEER_REVIEW_SYNTHESIS.md`)
4. **Update architecture** based on feedback
5. **Create risk register** from identified concerns

---

**Status:** Ready for execution
**Last Updated:** 2025-10-21
