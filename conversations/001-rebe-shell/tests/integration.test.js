#!/usr/bin/env node
/**
 * rebe-shell Integration Tests
 *
 * Tests the complete integrated system:
 * - Backend HTTP API endpoints
 * - WebSocket PTY communication
 * - SSH command execution with pooling
 * - Browser automation proxy
 * - Circuit breaker behavior
 * - End-to-end workflows
 *
 * Prerequisites:
 * - Backend running on http://localhost:3000
 * - rebe-browser running on http://localhost:8080 (for browser tests)
 * - SSH server for testing (optional, configurable)
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const chalk = require('chalk');
const ora = require('ora');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REBE_BROWSER_URL = process.env.REBE_BROWSER_URL || 'http://localhost:8080';
const SSH_TEST_HOST = process.env.SSH_TEST_HOST || null; // Optional SSH test
const SSH_TEST_USER = process.env.SSH_TEST_USER || null;

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  test(name, fn, options = {}) {
    this.tests.push({ name, fn, options });
  }

  async run() {
    console.log(chalk.blue.bold('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║     rebe-shell Integration Test Suite                   ║'));
    console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════╝\n'));

    for (const test of this.tests) {
      const spinner = ora(test.name).start();

      try {
        // Check prerequisites
        if (test.options.requires) {
          const missing = test.options.requires.filter(req => !this.checkPrerequisite(req));
          if (missing.length > 0) {
            spinner.warn(`${test.name} (skipped: missing ${missing.join(', ')})`);
            this.skipped++;
            continue;
          }
        }

        await test.fn();
        spinner.succeed(chalk.green(test.name));
        this.passed++;
      } catch (error) {
        spinner.fail(chalk.red(`${test.name}: ${error.message}`));
        if (process.env.VERBOSE) {
          console.error(chalk.gray(error.stack));
        }
        this.failed++;
      }
    }

    this.printSummary();
  }

  checkPrerequisite(req) {
    switch (req) {
      case 'ssh':
        return SSH_TEST_HOST && SSH_TEST_USER;
      case 'browser':
        // Will be checked by test itself
        return true;
      default:
        return true;
    }
  }

  printSummary() {
    console.log(chalk.blue('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║                   Test Results                           ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════╝\n'));

    const total = this.passed + this.failed + this.skipped;
    console.log(`  Total tests:     ${total}`);
    console.log(chalk.green(`  Passed:          ${this.passed}`));
    console.log(chalk.red(`  Failed:          ${this.failed}`));
    console.log(chalk.yellow(`  Skipped:         ${this.skipped}`));

    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    console.log(`\n  Pass rate:       ${passRate}%\n`);

    if (this.failed === 0) {
      console.log(chalk.green.bold('✓ All tests passed!\n'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold('✗ Some tests failed\n'));
      process.exit(1);
    }
  }
}

// HTTP helpers
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test suite
const runner = new TestRunner();

// ========================================
// Backend API Tests
// ========================================

runner.test('Backend health endpoint returns 200', async () => {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!res.data) throw new Error('No response data');
});

runner.test('Health endpoint returns feature flags', async () => {
  const res = await fetch(`${BACKEND_URL}/health`);
  const data = res.data;

  if (!data.status) throw new Error('Missing status field');
  if (typeof data.features !== 'object') throw new Error('Missing features object');
  if (typeof data.features.pty !== 'boolean') throw new Error('Missing PTY feature flag');
  if (typeof data.features.ssh_pooling !== 'boolean') throw new Error('Missing SSH pooling flag');
  if (typeof data.features.browser !== 'boolean') throw new Error('Missing browser flag');
  if (typeof data.features.circuit_breaker !== 'boolean') throw new Error('Missing circuit breaker flag');
});

runner.test('Create PTY session returns session ID', async () => {
  const res = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shell: '/bin/bash' })
  });

  if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
  if (!res.data || !res.data.session_id) throw new Error('Missing session_id');
  if (typeof res.data.session_id !== 'string') throw new Error('session_id should be string');
});

// ========================================
// WebSocket PTY Tests
// ========================================

runner.test('WebSocket PTY connection establishes', async () => {
  // Create session first
  const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  const sessionId = sessionRes.data.session_id;
  const wsUrl = `${BACKEND_URL.replace('http', 'ws')}/api/sessions/${sessionId}/ws`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
});

runner.test('WebSocket PTY receives output', async () => {
  // Create session
  const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  const sessionId = sessionRes.data.session_id;
  const wsUrl = `${BACKEND_URL.replace('http', 'ws')}/api/sessions/${sessionId}/ws`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('No output received within timeout'));
    }, 10000);

    let receivedOutput = false;

    ws.on('open', () => {
      // Send echo command
      const command = 'echo "rebe-shell-test"\n';
      ws.send(JSON.stringify({
        type: 'input',
        data: Buffer.from(command).toString('base64')
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'output') {
        const output = Buffer.from(msg.data, 'base64').toString('utf8');
        if (output.includes('rebe-shell-test')) {
          receivedOutput = true;
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      if (!receivedOutput) {
        reject(new Error('WebSocket closed before receiving output'));
      }
    });
  });
});

// ========================================
// SSH Integration Tests
// ========================================

runner.test('SSH execute endpoint exists', async () => {
  const res = await fetch(`${BACKEND_URL}/api/ssh/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: 'invalid-host-for-test',
      user: 'testuser',
      command: 'echo test'
    })
  });

  // Expect error (no valid host) but endpoint should exist
  if (res.status === 404) throw new Error('SSH endpoint not found');
  // Accept 400, 500, 503 (various error conditions)
  if (![400, 500, 503].includes(res.status)) {
    throw new Error(`Unexpected status: ${res.status}`);
  }
});

runner.test('SSH execute with valid host', async () => {
  if (!SSH_TEST_HOST || !SSH_TEST_USER) {
    throw new Error('SSH test requires SSH_TEST_HOST and SSH_TEST_USER env vars');
  }

  const res = await fetch(`${BACKEND_URL}/api/ssh/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: SSH_TEST_HOST,
      user: SSH_TEST_USER,
      command: 'echo "ssh-pool-test"'
    })
  });

  if (res.status !== 200) throw new Error(`SSH execution failed: ${res.status}`);
  if (!res.data.output) throw new Error('No output from SSH command');
  if (!res.data.output.includes('ssh-pool-test')) {
    throw new Error('SSH output does not match expected');
  }
}, { requires: ['ssh'] });

runner.test('SSH connection pooling performance', async () => {
  if (!SSH_TEST_HOST || !SSH_TEST_USER) {
    throw new Error('SSH test requires SSH_TEST_HOST and SSH_TEST_USER env vars');
  }

  // First connection (cold)
  const start1 = Date.now();
  await fetch(`${BACKEND_URL}/api/ssh/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: SSH_TEST_HOST,
      user: SSH_TEST_USER,
      command: 'echo "pool-test-1"'
    })
  });
  const time1 = Date.now() - start1;

  // Second connection (should be pooled)
  const start2 = Date.now();
  await fetch(`${BACKEND_URL}/api/ssh/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: SSH_TEST_HOST,
      user: SSH_TEST_USER,
      command: 'echo "pool-test-2"'
    })
  });
  const time2 = Date.now() - start2;

  // Second connection should be at least 2x faster
  if (time2 > time1 / 2) {
    throw new Error(`Connection pooling not effective (first: ${time1}ms, second: ${time2}ms)`);
  }
}, { requires: ['ssh'] });

// ========================================
// Circuit Breaker Tests
// ========================================

runner.test('Circuit breaker opens after failures', async () => {
  const badHost = 'definitely-not-a-real-host-12345.invalid';
  const requests = [];

  // Send 6 requests to trigger circuit breaker (threshold is 5)
  for (let i = 0; i < 6; i++) {
    requests.push(
      fetch(`${BACKEND_URL}/api/ssh/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: badHost,
          user: 'testuser',
          command: 'echo test'
        })
      })
    );
  }

  const results = await Promise.all(requests);

  // Last request should get 503 (circuit open)
  const lastStatus = results[results.length - 1].status;
  if (lastStatus !== 503) {
    throw new Error(`Expected 503 (circuit open), got ${lastStatus}`);
  }
});

// ========================================
// Browser Integration Tests
// ========================================

runner.test('Browser execute endpoint exists', async () => {
  const res = await fetch(`${BACKEND_URL}/api/browser/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com',
      script: 'return document.title'
    })
  });

  // Accept 200 or 500+ (rebe-browser might not be running)
  if (res.status === 404) throw new Error('Browser endpoint not found');
}, { requires: ['browser'] });

runner.test('Browser execute proxies to rebe-browser', async () => {
  // First check if rebe-browser is available
  try {
    await fetch(`${REBE_BROWSER_URL}/health`);
  } catch (e) {
    throw new Error('rebe-browser service not available (required for this test)');
  }

  const res = await fetch(`${BACKEND_URL}/api/browser/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com',
      script: 'return document.title'
    })
  });

  if (res.status !== 200) {
    throw new Error(`Browser execution failed: ${res.status}`);
  }

  if (!res.data) {
    throw new Error('No response from browser execution');
  }
}, { requires: ['browser'] });

// ========================================
// End-to-End Workflow Tests
// ========================================

runner.test('Complete PTY workflow: create → write → read → close', async () => {
  // Create session
  const createRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  const sessionId = createRes.data.session_id;
  const wsUrl = `${BACKEND_URL.replace('http', 'ws')}/api/sessions/${sessionId}/ws`;

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Workflow timeout'));
    }, 10000);

    ws.on('open', () => {
      // Write command
      ws.send(JSON.stringify({
        type: 'input',
        data: Buffer.from('ls\n').toString('base64')
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'output') {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', reject);
  });
});

runner.test('Health check reflects all features', async () => {
  const res = await fetch(`${BACKEND_URL}/health`);
  const features = res.data.features;

  // Should have all 4 features
  const expectedFeatures = ['pty', 'ssh_pooling', 'browser', 'circuit_breaker'];
  for (const feature of expectedFeatures) {
    if (!(feature in features)) {
      throw new Error(`Missing feature flag: ${feature}`);
    }
  }
});

// ========================================
// Run Tests
// ========================================

console.log(chalk.gray('\nConfiguration:'));
console.log(chalk.gray(`  Backend URL:      ${BACKEND_URL}`));
console.log(chalk.gray(`  Browser URL:      ${REBE_BROWSER_URL}`));
console.log(chalk.gray(`  SSH Test Host:    ${SSH_TEST_HOST || '(not configured)'}`));
console.log(chalk.gray(`  SSH Test User:    ${SSH_TEST_USER || '(not configured)'}`));

if (!SSH_TEST_HOST || !SSH_TEST_USER) {
  console.log(chalk.yellow('\n⚠️  SSH tests will be skipped (set SSH_TEST_HOST and SSH_TEST_USER to enable)'));
}

runner.run().catch((error) => {
  console.error(chalk.red('\n✗ Test runner error:'), error);
  process.exit(1);
});
