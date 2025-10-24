#!/usr/bin/env node
/**
 * Submit AI Peer Review via Direct APIs
 * Compare results to browser automation submissions
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Configuration
const PROMPT_FILE = '../docs/AI_PEER_REVIEW_PROMPT.md';
const VISION_FILE = '../VISION_COMPREHENSIVE.md';
const RESULTS_DIR = '../automation/results';

// API configs
const CONFIG = {
  openai: {
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
    max_tokens: 16000
  },
  gemini: {
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxOutputTokens: 16000
  },
  // xAI Grok - assuming they have an API (may need to update)
  grok: {
    url: 'https://api.x.ai/v1/chat/completions',  // Hypothetical
    model: 'grok-1',
    temperature: 0.7,
    max_tokens: 16000
  },
  // DeepSeek
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',  // Hypothetical
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 16000
  }
};

async function loadPrompt() {
  const promptPath = path.join(__dirname, PROMPT_FILE);
  const visionPath = path.join(__dirname, VISION_FILE);

  const prompt = await fs.readFile(promptPath, 'utf-8');
  const vision = await fs.readFile(visionPath, 'utf-8');

  return `${prompt}\n\n---\n\n## VISION DOCUMENT\n\n${vision}`;
}

async function submitToOpenAI(prompt) {
  const spinner = ora('Submitting to OpenAI (GPT-4 Turbo)...').start();

  if (!process.env.OPENAI_API_KEY) {
    spinner.fail('OPENAI_API_KEY not found in environment');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: CONFIG.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a critical technical reviewer specializing in distributed systems, AI/ML infrastructure, and large-scale software architecture. Provide brutally honest, rigorous analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: CONFIG.openai.temperature,
      max_tokens: CONFIG.openai.max_tokens
    });

    const content = response.choices[0].message.content;
    spinner.succeed('OpenAI response received');

    return {
      content,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    spinner.fail(`OpenAI error: ${error.message}`);
    return null;
  }
}

async function submitToGemini(prompt) {
  const spinner = ora('Submitting to Google Gemini...').start();

  if (!process.env.GOOGLE_API_KEY) {
    spinner.fail('GOOGLE_API_KEY not found in environment');
    return null;
  }

  try {
    const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genai.getGenerativeModel({
      model: CONFIG.gemini.model
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: CONFIG.gemini.temperature,
        maxOutputTokens: CONFIG.gemini.maxOutputTokens
      }
    });

    const content = result.response.text();
    spinner.succeed('Gemini response received');

    return {
      content,
      model: CONFIG.gemini.model,
      usage: result.response.usageMetadata
    };
  } catch (error) {
    spinner.fail(`Gemini error: ${error.message}`);
    return null;
  }
}

async function submitToGrok(prompt) {
  const spinner = ora('Submitting to xAI Grok...').start();

  if (!process.env.XAI_API_KEY) {
    spinner.warn('XAI_API_KEY not found - skipping Grok API submission');
    return null;
  }

  try {
    const response = await axios.post(
      CONFIG.grok.url,
      {
        model: CONFIG.grok.model,
        messages: [
          {
            role: 'system',
            content: 'You are Grok, a critical AI reviewer with access to real-time data and the X platform ecosystem.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: CONFIG.grok.temperature,
        max_tokens: CONFIG.grok.max_tokens
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    spinner.succeed('Grok response received');
    return {
      content: response.data.choices[0].message.content,
      model: response.data.model,
      usage: response.data.usage
    };
  } catch (error) {
    spinner.fail(`Grok error: ${error.message}`);
    return null;
  }
}

async function submitToDeepSeek(prompt) {
  const spinner = ora('Submitting to DeepSeek...').start();

  if (!process.env.DEEPSEEK_API_KEY) {
    spinner.warn('DEEPSEEK_API_KEY not found - skipping DeepSeek API submission');
    return null;
  }

  try {
    const response = await axios.post(
      CONFIG.deepseek.url,
      {
        model: CONFIG.deepseek.model,
        messages: [
          {
            role: 'system',
            content: 'You are DeepSeek, an AI reviewer with deep understanding of the Chinese tech ecosystem and global distributed systems.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: CONFIG.deepseek.temperature,
        max_tokens: CONFIG.deepseek.max_tokens
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    spinner.succeed('DeepSeek response received');
    return {
      content: response.data.choices[0].message.content,
      model: response.data.model,
      usage: response.data.usage
    };
  } catch (error) {
    spinner.fail(`DeepSeek error: ${error.message}`);
    return null;
  }
}

async function saveResult(name, result, prompt) {
  if (!result) return;

  const timestamp = new Date().toISOString();
  const filename = `${name}_api_response.md`;
  const filepath = path.join(__dirname, RESULTS_DIR, filename);

  const output = `# ${name} AI Peer Review Response (API)

**Submitted:** ${timestamp}
**Method:** Direct API Call
**Model:** ${result.model}

---

${result.content}

---

**Metadata:**
- Prompt Length: ${prompt.length} characters
- Response Length: ${result.content.length} characters
- Usage: ${JSON.stringify(result.usage, null, 2)}
`;

  await fs.ensureDir(path.dirname(filepath));
  await fs.writeFile(filepath, output, 'utf-8');

  console.log(chalk.gray(`   Saved to ${filename}`));
}

async function main() {
  console.log(chalk.blue('\n🤖 rebe-shell AI Peer Review - API Submissions'));
  console.log(chalk.blue('=================================================\n'));

  // Load prompt
  const spinner = ora('Loading prompt and vision documents...').start();
  const prompt = await loadPrompt();
  spinner.succeed(`Loaded prompt (${prompt.length} characters)`);

  console.log(chalk.cyan('\n📡 Submitting to APIs in parallel...\n'));

  // Submit to all APIs in parallel
  const [openaiResult, geminiResult, grokResult, deepseekResult] = await Promise.all([
    submitToOpenAI(prompt),
    submitToGemini(prompt),
    submitToGrok(prompt),
    submitToDeepSeek(prompt)
  ]);

  // Save results
  console.log(chalk.cyan('\n💾 Saving results...\n'));

  await Promise.all([
    saveResult('openai', openaiResult, prompt),
    saveResult('gemini', geminiResult, prompt),
    saveResult('grok', grokResult, prompt),
    saveResult('deepseek', deepseekResult, prompt)
  ]);

  // Summary
  console.log(chalk.green('\n✅ API Submissions Complete!\n'));
  console.log(chalk.gray('Results saved to:'));
  console.log(chalk.gray(`   ${RESULTS_DIR}/\n`));

  const successful = [openaiResult, geminiResult, grokResult, deepseekResult].filter(r => r !== null).length;
  console.log(chalk.blue(`📊 ${successful}/4 APIs responded successfully`));

  if (successful < 4) {
    console.log(chalk.yellow('\n⚠️  Some APIs failed. Check environment variables:'));
    if (!openaiResult) console.log(chalk.gray('   - OPENAI_API_KEY'));
    if (!geminiResult) console.log(chalk.gray('   - GOOGLE_API_KEY'));
    if (!grokResult) console.log(chalk.gray('   - XAI_API_KEY'));
    if (!deepseekResult) console.log(chalk.gray('   - DEEPSEEK_API_KEY'));
  }

  console.log();
}

// Run
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    });
}

module.exports = {
  submitToOpenAI,
  submitToGemini,
  submitToGrok,
  submitToDeepSeek
};
