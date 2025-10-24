#!/usr/bin/env node
/**
 * Submit to DeepSeek via browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const DEEPSEEK_URL = 'https://chat.deepseek.com/';
const PROMPT_FILE = '../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../VISION_COMPREHENSIVE.md';
const OUTPUT_FILE = '../automation/results/deepseek_browser_response.md';

async function submitToDeepSeek() {
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
    spinner.start('Navigating to DeepSeek...');
    await page.goto(DEEPSEEK_URL, { waitUntil: 'networkidle' });
    spinner.succeed('Loaded DeepSeek');

    // Check for DeepSeek login
    if (await page.$('button:has-text("Sign in"), a[href*="login"]')) {
      console.log(chalk.yellow('\n⚠️  DeepSeek Login Required'));
      console.log(chalk.yellow('🔐 Please sign in to DeepSeek in the browser window...\n'));
      await page.waitForSelector('textarea, [contenteditable="true"]', {
        timeout: 300000
      });
      console.log(chalk.green('✅ Authentication successful!\n'));
    }

    spinner.start('Locating DeepSeek chat input...');
    const chatInput = await page.waitForSelector(
      'textarea[placeholder*="message"], textarea[placeholder*="Ask"], [contenteditable="true"]',
      { timeout: 30000 }
    );
    spinner.succeed('Chat input ready');

    console.log(chalk.cyan('\n📤 Submitting prompt to DeepSeek...\n'));
    await chatInput.fill(fullPrompt);
    await chatInput.press('Enter');

    spinner.start('Waiting for DeepSeek response...');
    await page.waitForSelector('.message-content, .response, [data-message-role="assistant"]', {
      timeout: 600000
    });
    await page.waitForTimeout(5000);
    spinner.succeed('Response received!');

    spinner.start('Extracting response...');
    const response = await page.evaluate(() => {
      const selectors = [
        '[data-message-role="assistant"]',
        '.message-content',
        '.response',
        '.assistant-message'
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

    const output = `# DeepSeek AI Peer Review Response

**Submitted:** ${new Date().toISOString()}
**Method:** Browser Automation
**Model:** DeepSeek Chat

---

${response}

---

**Metadata:**
- Prompt Length: ${fullPrompt.length} characters
- Response Length: ${response.length} characters
`;

    await fs.writeFile(path.join(__dirname, OUTPUT_FILE), output, 'utf-8');
    spinner.succeed(`Response saved to ${OUTPUT_FILE}`);

    console.log(chalk.green('\n✅ DeepSeek peer review complete!\n'));

  } catch (error) {
    spinner.fail('Error during submission');
    throw error;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  submitToDeepSeek()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { submitToDeepSeek };
