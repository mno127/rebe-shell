#!/usr/bin/env node
/**
 * Submit to all AI systems via rebe-browser API (sequential)
 * MIGRATED: Uses rebe-browser API instead of direct Playwright
 * Human-in-loop for authentication at each service
 */

const chalk = require('chalk');
const { submitToCopilot } = require('./submit_copilot');
const { submitToGrok } = require('./submit_grok');
const { submitToGemini } = require('./submit_gemini');
const { submitToDeepSeek } = require('./submit_deepseek');

async function submitAll() {
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║  rebe-shell AI Peer Review Automation         ║'));
  console.log(chalk.blue.bold('║  Browser Automation via rebe-browser API      ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════╝\n'));

  console.log(chalk.gray('This will submit to:'));
  console.log(chalk.gray('  1. Microsoft Copilot (GPT-4 Turbo + think deeper)'));
  console.log(chalk.gray('  2. xAI Grok'));
  console.log(chalk.gray('  3. Google Gemini'));
  console.log(chalk.gray('  4. DeepSeek'));
  console.log(chalk.gray('\nUsing rebe-browser API for unified browser automation'));
  console.log(chalk.gray('Total estimated time: 2-4 hours\n'));

  const results = {
    copilot: { success: false, error: null },
    grok: { success: false, error: null },
    gemini: { success: false, error: null },
    deepseek: { success: false, error: null }
  };

  // Submit sequentially (each may require auth)
  console.log(chalk.cyan('\n━━━ Step 1/4: Microsoft Copilot ━━━\n'));
  try {
    await submitToCopilot();
    results.copilot.success = true;
  } catch (error) {
    results.copilot.error = error.message;
    console.error(chalk.red('❌ Copilot failed:', error.message));
  }

  console.log(chalk.cyan('\n━━━ Step 2/4: xAI Grok ━━━\n'));
  try {
    await submitToGrok();
    results.grok.success = true;
  } catch (error) {
    results.grok.error = error.message;
    console.error(chalk.red('❌ Grok failed:', error.message));
  }

  console.log(chalk.cyan('\n━━━ Step 3/4: Google Gemini ━━━\n'));
  try {
    await submitToGemini();
    results.gemini.success = true;
  } catch (error) {
    results.gemini.error = error.message;
    console.error(chalk.red('❌ Gemini failed:', error.message));
  }

  console.log(chalk.cyan('\n━━━ Step 4/4: DeepSeek ━━━\n'));
  try {
    await submitToDeepSeek();
    results.deepseek.success = true;
  } catch (error) {
    results.deepseek.error = error.message;
    console.error(chalk.red('❌ DeepSeek failed:', error.message));
  }

  // Summary
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║  Submission Summary                            ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════╝\n'));

  const successful = Object.values(results).filter(r => r.success).length;

  console.log(chalk.gray('Results:'));
  console.log(`  Copilot: ${results.copilot.success ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Grok:    ${results.grok.success ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Gemini:  ${results.gemini.success ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  DeepSeek: ${results.deepseek.success ? chalk.green('✓') : chalk.red('✗')}`);

  console.log(chalk.blue(`\n📊 ${successful}/4 submissions successful`));

  if (successful < 4) {
    console.log(chalk.yellow('\n⚠️  Some submissions failed:'));
    Object.entries(results).forEach(([name, result]) => {
      if (!result.success) {
        console.log(chalk.gray(`   ${name}: ${result.error}`));
      }
    });
  }

  console.log(chalk.gray('\nResults saved to: automation/results/\n'));

  return results;
}

// Run
if (require.main === module) {
  submitAll()
    .then((results) => {
      const successful = Object.values(results).filter(r => r.success).length;
      process.exit(successful === 4 ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red('\n❌ Fatal error:'), error);
      process.exit(1);
    });
}

module.exports = { submitAll };
