#!/usr/bin/env node
/**
 * Submit to Google Gemini via rebe-browser API
 * MIGRATED: Uses rebe-browser API instead of direct Playwright
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const REBE_BROWSER_URL = process.env.REBE_BROWSER_URL || 'http://localhost:8080';
const GEMINI_URL = 'https://gemini.google.com/';
const PROMPT_FILE = '../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../VISION_COMPREHENSIVE.md';
const OUTPUT_FILE = '../automation/results/gemini_browser_response.md';

async function submitToGemini() {
  const spinner = ora('Reading prompt...').start();

  const promptPath = path.join(__dirname, PROMPT_FILE);
  const visionPath = path.join(__dirname, VISION_FILE);

  const prompt = await fs.readFile(promptPath, 'utf-8');
  const vision = await fs.readFile(visionPath, 'utf-8');
  const fullPrompt = `${prompt}\n\n---\n\n## VISION DOCUMENT\n\n${vision}`;

  spinner.succeed('Documents loaded');

  try {
    spinner.start('Connecting to rebe-browser...');

    const browserScript = `
      // Check for Google sign-in
      const signInLink = document.querySelector('a[href*="accounts.google.com"]');
      if (signInLink) {
        return { authRequired: true, message: 'Please authenticate in browser' };
      }

      // Wait for chat input (Gemini uses contenteditable)
      const chatInput = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Chat input timeout')), 30000);
        const interval = setInterval(() => {
          const input = document.querySelector('[contenteditable="true"], textarea[placeholder*="Enter"], .ql-editor');
          if (input) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(input);
          }
        }, 500);
      });

      // Submit prompt (Gemini uses contenteditable divs)
      const promptText = ${JSON.stringify(fullPrompt)};

      chatInput.focus();
      chatInput.textContent = promptText;
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Find and trigger send button
      await new Promise(resolve => setTimeout(resolve, 1000));

      const sendButton = document.querySelector('button[aria-label*="Send"], button:has-text("Send")');
      if (sendButton) {
        sendButton.click();
      } else {
        // Fallback to Enter key
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        });
        chatInput.dispatchEvent(enterEvent);
      }

      // Wait for response
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 600000);
        const interval = setInterval(() => {
          const selectors = [
            '[data-response]',
            '.model-response',
            '.response-container',
            '.message-content'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.length > 100) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve(element.innerText);
              return;
            }
          }
        }, 1000);
      });

      return { response, url: window.location.href };
    `;

    spinner.text = 'Executing Gemini automation via rebe-browser...';

    const response = await fetch(`${REBE_BROWSER_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: GEMINI_URL,
        script: browserScript,
        options: {
          waitForNetworkIdle: true,
          timeout: 600000,
          headless: false,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`rebe-browser API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.authRequired) {
      console.log(chalk.yellow('\n⚠️  Google Sign-in Required'));
      console.log(chalk.yellow('🔐 Please sign in to Google in the browser window...\n'));
      process.exit(1);
    }

    spinner.succeed('Response received!');

    spinner.start('Saving response...');
    await fs.ensureDir(path.dirname(path.join(__dirname, OUTPUT_FILE)));

    const output = `# Google Gemini AI Peer Review Response

**Submitted:** ${new Date().toISOString()}
**Method:** rebe-browser API (Browser Automation)
**Model:** Gemini 1.5 Pro

---

${result.response}

---

**Metadata:**
- Prompt Length: ${fullPrompt.length} characters
- Response Length: ${result.response.length} characters
- URL: ${result.url}
- Method: rebe-browser API
`;

    await fs.writeFile(path.join(__dirname, OUTPUT_FILE), output, 'utf-8');
    spinner.succeed(`Response saved to ${OUTPUT_FILE}`);

    console.log(chalk.green('\n✅ Gemini peer review complete!\n'));

  } catch (error) {
    spinner.fail('Error during submission');

    if (error.code === 'ECONNREFUSED') {
      console.error(chalk.yellow('\n⚠️  Could not connect to rebe-browser service'));
      console.error(chalk.gray('   Make sure rebe-browser is running on'), chalk.cyan(REBE_BROWSER_URL));
    }

    throw error;
  }
}

if (require.main === module) {
  submitToGemini()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { submitToGemini };
