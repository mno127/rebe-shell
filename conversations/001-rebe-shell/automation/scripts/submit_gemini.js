#!/usr/bin/env node
/**
 * Submit to Google Gemini via browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

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

  spinner.start('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  spinner.succeed('Browser launched');

  try {
    spinner.start('Navigating to Gemini...');
    await page.goto(GEMINI_URL, { waitUntil: 'networkidle' });
    spinner.succeed('Loaded Gemini');

    // Check for Google sign-in
    if (await page.$('a[href*="accounts.google.com"]')) {
      console.log(chalk.yellow('\n⚠️  Google Sign-in Required'));
      console.log(chalk.yellow('🔐 Please sign in to Google in the browser window...\n'));
      await page.waitForSelector('[contenteditable="true"], textarea, .ql-editor', {
        timeout: 300000
      });
      console.log(chalk.green('✅ Authentication successful!\n'));
    }

    spinner.start('Locating Gemini chat input...');
    const chatInput = await page.waitForSelector(
      '[contenteditable="true"], textarea[placeholder*="Enter"], .ql-editor',
      { timeout: 30000 }
    );
    spinner.succeed('Chat input ready');

    console.log(chalk.cyan('\n📤 Submitting prompt to Gemini...\n'));

    // Gemini may use contenteditable div instead of textarea
    await chatInput.click();
    await page.keyboard.type(fullPrompt);

    // Find and click send button
    const sendButton = await page.locator('button[aria-label*="Send"], button:has-text("Send")').first();
    await sendButton.click();

    spinner.start('Waiting for Gemini response...');
    await page.waitForSelector('[data-response], .model-response, .response-container', {
      timeout: 600000
    });
    await page.waitForTimeout(5000);
    spinner.succeed('Response received!');

    spinner.start('Extracting response...');
    const response = await page.evaluate(() => {
      const selectors = [
        '[data-response]',
        '.model-response',
        '.response-container',
        '.message-content'
      ];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element.innerText || element.textContent;
      }
      return document.body.innerText;
    });
    spinner.succeed('Response extracted');

    spinner.start('Saving response...');
    await fs.ensureDir(path.dirname(path.join(__dirname, OUTPUT_FILE)));

    const output = `# Google Gemini AI Peer Review Response

**Submitted:** ${new Date().toISOString()}
**Method:** Browser Automation
**Model:** Gemini 1.5 Pro

---

${response}

---

**Metadata:**
- Prompt Length: ${fullPrompt.length} characters
- Response Length: ${response.length} characters
`;

    await fs.writeFile(path.join(__dirname, OUTPUT_FILE), output, 'utf-8');
    spinner.succeed(`Response saved to ${OUTPUT_FILE}`);

    console.log(chalk.green('\n✅ Gemini peer review complete!\n'));

  } catch (error) {
    spinner.fail('Error during submission');
    throw error;
  } finally {
    await browser.close();
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
