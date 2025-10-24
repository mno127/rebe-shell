#!/usr/bin/env node
/**
 * Submit to xAI Grok via browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const GROK_URL = 'https://x.com/i/grok';  // Grok on X/Twitter
const PROMPT_FILE = '../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../VISION_COMPREHENSIVE.md';
const OUTPUT_FILE = '../automation/results/grok_browser_response.md';

async function submitToGrok() {
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
    spinner.start('Navigating to Grok...');
    await page.goto(GROK_URL, { waitUntil: 'networkidle' });
    spinner.succeed('Loaded Grok');

    // Check for X/Twitter login
    if (await page.$('a[href="/login"]')) {
      console.log(chalk.yellow('\n⚠️  X/Twitter Login Required'));
      console.log(chalk.yellow('🔐 Please log in to X in the browser window...\n'));
      await page.waitForSelector('[data-testid="grok-input"], textarea[placeholder*="Ask"]', {
        timeout: 300000
      });
      console.log(chalk.green('✅ Authentication successful!\n'));
    }

    spinner.start('Locating Grok chat input...');
    const chatInput = await page.waitForSelector(
      '[data-testid="grok-input"], textarea[placeholder*="Ask"], textarea[aria-label*="message"]',
      { timeout: 30000 }
    );
    spinner.succeed('Chat input ready');

    console.log(chalk.cyan('\n📤 Submitting prompt to Grok...\n'));
    await chatInput.fill(fullPrompt);
    await chatInput.press('Enter');

    spinner.start('Waiting for Grok response...');
    await page.waitForSelector('[data-testid="grok-response"], .response-text', {
      timeout: 600000
    });
    await page.waitForTimeout(5000);
    spinner.succeed('Response received!');

    spinner.start('Extracting response...');
    const response = await page.evaluate(() => {
      const selectors = [
        '[data-testid="grok-response"]',
        '.response-text',
        '[role="article"]'
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

    const output = `# xAI Grok AI Peer Review Response

**Submitted:** ${new Date().toISOString()}
**Method:** Browser Automation
**Model:** Grok-1

---

${response}

---

**Metadata:**
- Prompt Length: ${fullPrompt.length} characters
- Response Length: ${response.length} characters
`;

    await fs.writeFile(path.join(__dirname, OUTPUT_FILE), output, 'utf-8');
    spinner.succeed(`Response saved to ${OUTPUT_FILE}`);

    console.log(chalk.green('\n✅ Grok peer review complete!\n'));

  } catch (error) {
    spinner.fail('Error during submission');
    throw error;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  submitToGrok()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { submitToGrok };
