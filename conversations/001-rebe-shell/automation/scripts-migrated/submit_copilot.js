#!/usr/bin/env node
/**
 * Submit AI Peer Review to Microsoft Copilot
 * MIGRATED: Uses rebe-browser API instead of direct Playwright
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

// Configuration
const REBE_BROWSER_URL = process.env.REBE_BROWSER_URL || 'http://localhost:8080';
const COPILOT_URL = 'https://copilot.microsoft.com/';
const PROMPT_FILE = '../../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../../VISION_COMPREHENSIVE.md';
const OUTPUT_FILE = '../results/copilot_browser_response.md';
const AUTH_TIMEOUT = 300000; // 5 minutes for user to authenticate

async function submitToCopilot() {
  console.log(chalk.blue('\n🤖 rebe-shell AI Peer Review Automation (rebe-browser)'));
  console.log(chalk.blue('==========================================================\n'));

  const spinner = ora('Reading prompt and vision documents...').start();

  // Read documents
  const promptPath = path.join(__dirname, PROMPT_FILE);
  const visionPath = path.join(__dirname, VISION_FILE);

  const prompt = await fs.readFile(promptPath, 'utf-8');
  const vision = await fs.readFile(visionPath, 'utf-8');

  const fullPrompt = `${prompt}\n\n---\n\n## VISION DOCUMENT\n\n${vision}`;

  spinner.succeed('Documents loaded');

  try {
    spinner.start('Connecting to rebe-browser...');

    // Build browser automation script
    const browserScript = `
      // This script runs in the browser context via rebe-browser

      // Check if authentication is needed
      const signInButton = document.querySelector('button:has-text("Sign in")');
      if (signInButton) {
        // Return auth required signal
        return { authRequired: true, message: 'Please authenticate in browser' };
      }

      // Wait for chat input
      const chatInput = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Chat input timeout')), 30000);
        const interval = setInterval(() => {
          const input = document.querySelector('textarea[aria-label*="Ask"], textarea[placeholder*="Ask"]');
          if (input) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(input);
          }
        }, 500);
      });

      // Submit prompt
      const promptText = ${JSON.stringify(fullPrompt)};
      chatInput.value = promptText;

      // Trigger input event
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      });
      chatInput.dispatchEvent(enterEvent);

      // Wait for response (polling approach)
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 600000);
        const interval = setInterval(() => {
          const selectors = [
            '[data-content*="response"]',
            '.response-container',
            '[role="article"]',
            '.markdown-content'
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

    spinner.text = 'Executing browser automation via rebe-browser...';

    // Call rebe-browser API
    const response = await fetch(`${REBE_BROWSER_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: COPILOT_URL,
        script: browserScript,
        options: {
          waitForNetworkIdle: true,
          timeout: 600000,
          headless: false, // Allow human authentication
        }
      })
    });

    if (!response.ok) {
      throw new Error(`rebe-browser API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.authRequired) {
      console.log(chalk.yellow('\n⚠️  Authentication Required'));
      console.log(chalk.yellow('🔐 Please sign in to Microsoft Copilot in the browser window...'));
      console.log(chalk.gray('   Then re-run this script.\n'));
      process.exit(1);
    }

    spinner.succeed('Response received!');

    // Save response
    spinner.start('Saving response to file...');
    await fs.ensureDir(path.dirname(path.join(__dirname, OUTPUT_FILE)));

    const timestamp = new Date().toISOString();
    const output = `# Microsoft Copilot AI Peer Review Response

**Submitted:** ${timestamp}
**Method:** rebe-browser API (Browser Automation)
**Model:** Copilot (GPT-4 Turbo with think deeper)

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

    console.log(chalk.green('\n✅ Success! Copilot peer review complete.\n'));
    console.log(chalk.gray(`Response preview (first 500 chars):`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(result.response.substring(0, 500) + '...');
    console.log(chalk.gray('─'.repeat(60)));

  } catch (error) {
    spinner.fail('Error during submission');
    console.error(chalk.red('\n❌ Error:'), error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error(chalk.yellow('\n⚠️  Could not connect to rebe-browser service'));
      console.error(chalk.gray('   Make sure rebe-browser is running on'), chalk.cyan(REBE_BROWSER_URL));
      console.error(chalk.gray('   Start it with: cargo run --bin rebe-browser\n'));
    }

    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  submitToCopilot()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { submitToCopilot };
