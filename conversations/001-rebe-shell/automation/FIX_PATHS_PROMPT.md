# Fix File Path Issues in All Automation Scripts

## Problem
All 6 automation scripts have incorrect file paths. They're looking for files 2 levels up when they should only go 1 level up.

## Root Cause
Scripts are in `automation/scripts/` directory, so `__dirname` resolves to that location.
- Current paths: `../../docs/` and `../../VISION_COMPREHENSIVE.md` (wrong - goes too far up)
- Correct paths: `../docs/` and `../VISION_COMPREHENSIVE.md` (correct - goes to parent)

## Files to Fix
Update these 6 scripts in `automation/scripts/`:
1. `submit_copilot.js`
2. `submit_grok.js`
3. `submit_gemini.js`
4. `submit_deepseek.js`
5. `submit_all.js`
6. `api_submit_all.js`

## Required Changes

In each file, change:
```javascript
// OLD (incorrect):
const PROMPT_FILE = '../../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../../VISION_COMPREHENSIVE.md';

// NEW (correct):
const PROMPT_FILE = '../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../VISION_COMPREHENSIVE.md';
```

## Verification

After fixing, verify the files exist:
```bash
cd /Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/automation/scripts
node -e "const path = require('path'); console.log(path.join(__dirname, '../docs/AI_PEER_REVIEW_PROMPT.md')); console.log(path.join(__dirname, '../VISION_COMPREHENSIVE.md'));"
ls -lh ../docs/AI_PEER_REVIEW_PROMPT.md
ls -lh ../VISION_COMPREHENSIVE.md
```

Both files should be found at:
- `/Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/docs/AI_PEER_REVIEW_PROMPT.md`
- `/Users/mnichols/Development/rebe-shell/conversations/001-rebe-shell/VISION_COMPREHENSIVE.md`

## Action Required
Use the Edit tool to update all 6 scripts with the correct paths.
