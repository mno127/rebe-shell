#!/usr/bin/env node
/**
 * Submit AI Peer Review to Microsoft Copilot
 * Uses Playwright for browser automation with human-in-loop for auth
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

// Configuration
const COPILOT_URL = 'https://copilot.microsoft.com/';
const PROMPT_FILE = '../../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../../VISION_COMPREHENSIVE.md';
const OUTPUT_FILE = '../results/copilot_browser_response.md';
const AUTH_TIMEOUT = 300000; // 5 minutes for user to authenticate

async function submitToCopilot() {
  console.log(chalk.blue('\n🤖 rebe-shell AI Peer Review Automation'));
  console.log(chalk.blue('==========================================\n'));

  const spinner = ora('Reading prompt and vision documents...').start();

  // Read documents
  const promptPath = path.join(__dirname, PROMPT_FILE);
  const visionPath = path.join(__dirname, VISION_FILE);

  const prompt = await fs.readFile(promptPath, 'utf-8');
  const vision = await fs.readFile(visionPath, 'utf-8');

  const fullPrompt = `${prompt}\n\n---\n\n## VISION DOCUMENT\n\n${vision}`;

  spinner.succeed('Documents loaded');

  // Launch browser
  spinner.start('Launching browser (Playwright)...');
  const browser = await chromium.launch({
    headless: false, // Show browser so user can authenticate
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  spinner.succeed('Browser launched');

  try {
    // Navigate to Copilot
    spinner.start('Navigating to Microsoft Copilot...');
    await page.goto(COPILOT_URL, { waitUntil: 'networkidle' });
    spinner.succeed('Loaded Copilot');

    // Check if authentication is needed
    const signInButton = await page.$('button:has-text("Sign in")');
    if (signInButton) {
      console.log(chalk.yellow('\n⚠️  Authentication Required'));
      console.log(chalk.yellow('🔐 Please sign in to Microsoft Copilot in the browser window...'));
      console.log(chalk.gray('   (Script will wait up to 5 minutes)\n'));

      // Wait for user to authenticate
      await page.waitForSelector('textarea[aria-label*="Ask"]', {
        timeout: AUTH_TIMEOUT
      });

      console.log(chalk.green('✅ Authentication successful!\n'));
    }

    // Find chat input
    spinner.start('Locating chat input...');
    const chatInput = await page.waitForSelector(
      'textarea[aria-label*="Ask"], textarea[placeholder*="Ask"]',
      { timeout: 30000 }
    );
    spinner.succeed('Chat input ready');

    // Submit prompt
    console.log(chalk.cyan('\n📤 Submitting prompt...'));
    console.log(chalk.gray(`   Prompt length: ${fullPrompt.length} characters\n`));

    await chatInput.fill(fullPrompt);
    await chatInput.press('Enter');

    spinner.start('Waiting for Copilot to respond...');

    // Wait for response (this could take several minutes)
    // Look for response container with markdown content
    await page.waitForSelector('[data-content*="response"], .response-container', {
      timeout: 600000 // 10 minutes
    });

    // Give it extra time to finish streaming
    await page.waitForTimeout(5000);

    spinner.succeed('Response received!');

    // Extract response
    spinner.start('Extracting response text...');
    const response = await page.evaluate(() => {
      // Try multiple selectors for response content
      const selectors = [
        '[data-content="response"]',
        '.response-container',
        '[role="article"]',
        '.markdown-content'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.innerText || element.textContent;
        }
      }

      // Fallback: get all text after the prompt
      return document.body.innerText;
    });

    spinner.succeed('Response extracted');

    // Save response
    spinner.start('Saving response to file...');
    await fs.ensureDir(path.dirname(path.join(__dirname, OUTPUT_FILE)));

    const timestamp = new Date().toISOString();
    const output = `# Microsoft Copilot AI Peer Review Response

**Submitted:** ${timestamp}
**Method:** Browser Automation (Playwright)
**Model:** Copilot (GPT-4 Turbo with think deeper)

---

${response}

---

**Metadata:**
- Prompt Length: ${fullPrompt.length} characters
- Response Length: ${response.length} characters
- URL: ${page.url()}
`;

    await fs.writeFile(path.join(__dirname, OUTPUT_FILE), output, 'utf-8');
    spinner.succeed(`Response saved to ${OUTPUT_FILE}`);

    console.log(chalk.green('\n✅ Success! Copilot peer review complete.\n'));
    console.log(chalk.gray(`Response preview (first 500 chars):`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(response.substring(0, 500) + '...');
    console.log(chalk.gray('─'.repeat(60)));

  } catch (error) {
    spinner.fail('Error during submission');
    console.error(chalk.red('\n❌ Error:'), error.message);
    throw error;
  } finally {
    await browser.close();
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
