# AI Peer Review Automation

This directory contains scripts and configurations for submitting the vision document to multiple AI systems for peer review.

## Approach

We submit the same prompt to 4 AI systems via two methods:

1. **Browser Automation** (via reBe Browser)
   - Microsoft Copilot Chat (GPT-5 with think deeper)
   - Grok Chat (xAI)
   - Gemini Chat (Google)
   - DeepSeek Chat

2. **Direct API Calls** (with custom configs)
   - OpenAI API (GPT-4 Turbo - Copilot backend)
   - xAI API (Grok)
   - Google AI API (Gemini 1.5 Pro)
   - DeepSeek API

## Why Both Methods?

**Hypothesis:** Results will differ because:
- **Browser chat interfaces** have access to each company's proprietary context engineering, corpus data, and fine-tuning
- **Direct APIs** give us control over system instructions, temperature, and token limits, but lack the ecosystem-specific optimizations

**Goal:** Compare and contrast to understand where each approach excels.

## Files

- `prompts/copilot_prompt.txt` - Prompt for Copilot
- `prompts/grok_prompt.txt` - Prompt for Grok
- `prompts/gemini_prompt.txt` - Prompt for Gemini
- `prompts/deepseek_prompt.txt` - Prompt for DeepSeek
- `configs/api_configs.json` - API parameters (temp, max_tokens, etc)
- `scripts/browser_automation.py` - reBe browser automation script
- `scripts/api_submission.py` - Direct API submission script
- `results/` - Where responses will be saved

## Prerequisites

### For Browser Automation (reBe)

```bash
# Check if reBe browser automation is available
# (Replace with actual reBe CLI/SDK commands)
rebe --version
rebe browser --help
```

### For API Submissions

```bash
# Install dependencies
pip install openai google-generativeai anthropic requests

# Set API keys
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="AIza..."
export XAI_API_KEY="xai-..."  # If Grok has an API
export DEEPSEEK_API_KEY="..."
```

## Execution

### Step 1: Prepare Prompts

```bash
# Generate prompt files with vision document embedded
./scripts/prepare_prompts.sh
```

### Step 2: Browser Automation

```bash
# Submit via reBe browser automation
python scripts/browser_automation.py --all

# Or submit individually
python scripts/browser_automation.py --copilot
python scripts/browser_automation.py --grok
python scripts/browser_automation.py --gemini
python scripts/browser_automation.py --deepseek
```

### Step 3: API Submissions

```bash
# Submit via APIs
python scripts/api_submission.py --all

# Or submit individually
python scripts/api_submission.py --openai
python scripts/api_submission.py --grok-api
python scripts/api_submission.py --gemini-api
python scripts/api_submission.py --deepseek-api
```

### Step 4: Compare Results

```bash
# Generate comparison report
python scripts/compare_results.py

# Output: results/COMPARISON_REPORT.md
```

## Authentication

### Microsoft Copilot

- URL: https://copilot.microsoft.com/
- Auth: Microsoft Account (saved in reBe Browser profile)
- Human-in-loop: If re-authorization needed, script will pause

### Grok Chat

- URL: https://grok.x.ai/ (or https://x.com/i/grok)
- Auth: X/Twitter account
- Human-in-loop: If login needed

### Gemini Chat

- URL: https://gemini.google.com/
- Auth: Google Account
- Human-in-loop: If login needed

### DeepSeek Chat

- URL: https://chat.deepseek.com/
- Auth: DeepSeek account
- Human-in-loop: If login needed

## Expected Timeline

- Browser submissions: ~30-60 min (includes wait for responses)
- API submissions: ~10-20 min (parallel execution)
- Total: ~1-2 hours for all 8 submissions

## Output Format

Each result saved as:
```
results/
├── copilot_browser_response.md
├── copilot_api_response.md
├── grok_browser_response.md
├── grok_api_response.md
├── gemini_browser_response.md
├── gemini_api_response.md
├── deepseek_browser_response.md
├── deepseek_api_response.md
└── COMPARISON_REPORT.md
```

## Status

- [ ] Browser automation scripts written
- [ ] API submission scripts written
- [ ] Prompts prepared
- [ ] API keys configured
- [ ] reBe browser profiles configured
- [ ] Submissions executed
- [ ] Results collected
- [ ] Comparison report generated

---

**Last Updated:** 2025-10-21
**Status:** Awaiting clarification on reBe browser automation interface
