/**
 * reBe Shell - Full Integration Frontend v2.0.0
 *
 * Unified terminal with:
 * - Local shell (PTY via WebSocket)
 * - SSH with connection pooling
 * - Browser automation via rebe-browser
 * - Circuit breaker monitoring
 * - Real-time status updates
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import './style.css';

// Configuration
const BACKEND_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Global state
let terminal: Terminal | null = null;
let websocket: WebSocket | null = null;
let sessionId: string | null = null;
let fitAddon: FitAddon | null = null;

// SSH connection tracking
const sshConnections: Map<string, { host: string; user: string; status: string }> = new Map();

/**
 * Initialize the application
 */
async function init() {
  console.log('[reBe Shell] Initializing full integration v2.0.0...');

  // Setup terminal
  await setupTerminal();

  // Setup UI panels
  setupSSHPanel();
  setupBrowserPanel();
  setupStatusPanel();

  // Create PTY session
  await createSession();
}

/**
 * Setup terminal with xterm.js
 */
async function setupTerminal() {
  const terminalContainer = document.getElementById('terminal');
  if (!terminalContainer) {
    console.error('[reBe Shell] Terminal container not found');
    return;
  }

  // Create terminal
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    },
    rows: 24,
    cols: 80,
  });

  // Add addons
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  // Open terminal
  terminal.open(terminalContainer);
  fitAddon.fit();

  // Handle window resize
  window.addEventListener('resize', () => {
    fitAddon?.fit();
  });

  // Welcome message
  terminal.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════════╗\x1b[0m');
  terminal.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;32mreBe Shell - Full Integration v2.0.0\x1b[0m                    \x1b[1;36m║\x1b[0m');
  terminal.writeln('\x1b[1;36m╚════════════════════════════════════════════════════════════╝\x1b[0m');
  terminal.writeln('');
  terminal.writeln('\x1b[1;33mUnified Infrastructure Control\x1b[0m');
  terminal.writeln('');
  terminal.writeln('\x1b[1;37mFeatures:\x1b[0m');
  terminal.writeln('  \x1b[32m•\x1b[0m Local shell (PTY)');
  terminal.writeln('  \x1b[32m•\x1b[0m SSH with connection pooling (200-300x faster)');
  terminal.writeln('  \x1b[32m•\x1b[0m Browser automation (rebe-browser API)');
  terminal.writeln('  \x1b[32m•\x1b[0m Circuit breakers for fault tolerance');
  terminal.writeln('');
  terminal.writeln('\x1b[1;37mCommands:\x1b[0m');
  terminal.writeln('  \x1b[1;36mssh\x1b[0m user@host "command"     - Execute SSH command');
  terminal.writeln('  \x1b[1;36mbrowser\x1b[0m url [script]       - Browser automation');
  terminal.writeln('  \x1b[1;36mls\x1b[0m, \x1b[1;36mcd\x1b[0m, etc.               - Local shell commands');
  terminal.writeln('');
  terminal.writeln('\x1b[90mConnecting to backend...\x1b[0m');
  terminal.writeln('');
}

/**
 * Create PTY session
 */
async function createSession() {
  if (!terminal) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: terminal.rows,
        cols: terminal.cols,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    sessionId = data.session_id;

    terminal.writeln(`\x1b[32m✓ Session created: ${sessionId.substring(0, 8)}...\x1b[0m`);
    terminal.writeln('');

    // Connect WebSocket
    connectWebSocket();

  } catch (error) {
    terminal.writeln(`\x1b[31m✗ Error creating session: ${error}\x1b[0m`);
    terminal.writeln('\x1b[90mIs the backend running on port 3000?\x1b[0m');
  }
}

/**
 * Connect WebSocket for PTY I/O
 */
function connectWebSocket() {
  if (!sessionId || !terminal) return;

  const wsUrl = `${WS_URL}/api/sessions/${sessionId}/ws`;
  console.log(`[reBe Shell] Connecting WebSocket: ${wsUrl}`);

  websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    console.log('[reBe Shell] WebSocket connected');
    terminal?.writeln('\x1b[32m✓ WebSocket connected\x1b[0m');
    terminal?.writeln('');
  };

  websocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'output':
          // Decode base64 and write to terminal
          const data = atob(msg.data);
          terminal?.write(data);
          break;

        case 'connected':
          console.log(`[reBe Shell] PTY connected: ${msg.session_id}`);
          break;

        case 'error':
          terminal?.writeln(`\r\n\x1b[31m✗ Error: ${msg.message}\x1b[0m\r\n`);
          break;

        case 'status':
          terminal?.writeln(`\r\n\x1b[34mℹ ${msg.message}\x1b[0m\r\n`);
          break;

        default:
          console.warn('[reBe Shell] Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error('[reBe Shell] WebSocket message error:', error);
    }
  };

  websocket.onerror = (error) => {
    console.error('[reBe Shell] WebSocket error:', error);
    terminal?.writeln('\r\n\x1b[31m✗ WebSocket connection error\x1b[0m\r\n');
  };

  websocket.onclose = () => {
    console.log('[reBe Shell] WebSocket closed');
    terminal?.writeln('\r\n\x1b[33m⚠ Connection closed\x1b[0m\r\n');
  };

  // Send input to backend
  terminal.onData((data) => {
    if (websocket?.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'input',
        data: btoa(data), // Base64 encode
      }));
    }
  });

  // Handle resize
  terminal.onResize(({ rows, cols }) => {
    if (websocket?.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'resize',
        rows,
        cols,
      }));
    }
  });
}

/**
 * Setup SSH Panel
 */
function setupSSHPanel() {
  const sshPanel = document.getElementById('ssh-panel');
  if (!sshPanel) return;

  sshPanel.innerHTML = `
    <div class="panel">
      <h3>SSH Connections</h3>
      <div class="panel-content">
        <div class="ssh-form">
          <input type="text" id="ssh-user" placeholder="user" class="input-field" />
          <input type="text" id="ssh-host" placeholder="host" class="input-field" />
          <input type="text" id="ssh-command" placeholder="command" class="input-field" />
          <button id="ssh-execute" class="btn btn-primary">Execute</button>
        </div>
        <div id="ssh-connections" class="connections-list"></div>
      </div>
    </div>
  `;

  const executeButton = document.getElementById('ssh-execute');
  executeButton?.addEventListener('click', executeSshCommand);

  // Allow Enter key to execute
  ['ssh-user', 'ssh-host', 'ssh-command'].forEach(id => {
    document.getElementById(id)?.addEventListener('keypress', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        executeSshCommand();
      }
    });
  });
}

/**
 * Execute SSH command
 */
async function executeSshCommand() {
  const userInput = document.getElementById('ssh-user') as HTMLInputElement;
  const hostInput = document.getElementById('ssh-host') as HTMLInputElement;
  const commandInput = document.getElementById('ssh-command') as HTMLInputElement;

  const user = userInput?.value.trim();
  const host = hostInput?.value.trim();
  const command = commandInput?.value.trim();

  if (!user || !host || !command) {
    alert('Please fill in all fields');
    return;
  }

  const connKey = `${user}@${host}`;
  terminal?.writeln(`\r\n\x1b[36m[SSH]\x1b[0m Executing on ${connKey}...`);

  // Track connection
  sshConnections.set(connKey, { host, user, status: 'executing' });
  updateSSHConnectionsList();

  try {
    const response = await fetch(`${BACKEND_URL}/api/ssh/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, user, command }),
    });

    if (response.ok) {
      const data = await response.json();
      terminal?.writeln(`\x1b[32m${data.output}\x1b[0m`);
      sshConnections.set(connKey, { host, user, status: 'connected' });
    } else if (response.status === 503) {
      terminal?.writeln(`\x1b[31m✗ Circuit breaker OPEN for ${host}\x1b[0m`);
      terminal?.writeln(`\x1b[90m  (Host marked as failing - will retry in 60s)\x1b[0m`);
      sshConnections.set(connKey, { host, user, status: 'circuit_open' });
    } else {
      terminal?.writeln(`\x1b[31m✗ Error: ${response.statusText}\x1b[0m`);
      sshConnections.set(connKey, { host, user, status: 'error' });
    }
  } catch (error) {
    terminal?.writeln(`\x1b[31m✗ Error: ${error}\x1b[0m`);
    sshConnections.set(connKey, { host, user, status: 'error' });
  }

  updateSSHConnectionsList();
}

/**
 * Update SSH connections list display
 */
function updateSSHConnectionsList() {
  const connectionsList = document.getElementById('ssh-connections');
  if (!connectionsList) return;

  if (sshConnections.size === 0) {
    connectionsList.innerHTML = '<div class="empty-state">No SSH connections yet</div>';
    return;
  }

  connectionsList.innerHTML = Array.from(sshConnections.entries())
    .map(([key, conn]) => {
      const statusClass = conn.status === 'connected' ? 'status-ok' :
                          conn.status === 'circuit_open' ? 'status-warning' :
                          conn.status === 'executing' ? 'status-pending' : 'status-error';
      const statusIcon = conn.status === 'connected' ? '✓' :
                         conn.status === 'circuit_open' ? '⚠' :
                         conn.status === 'executing' ? '⋯' : '✗';

      return `
        <div class="connection-item ${statusClass}">
          <span class="connection-key">${key}</span>
          <span class="connection-status">${statusIcon} ${conn.status}</span>
        </div>
      `;
    })
    .join('');
}

/**
 * Setup Browser Panel
 */
function setupBrowserPanel() {
  const browserPanel = document.getElementById('browser-panel');
  if (!browserPanel) return;

  browserPanel.innerHTML = `
    <div class="panel">
      <h3>Browser Automation</h3>
      <div class="panel-content">
        <div class="browser-form">
          <input type="text" id="browser-url" placeholder="URL (e.g., https://example.com)" class="input-field" />
          <textarea id="browser-script" placeholder="JavaScript (optional)" rows="4" class="input-field"></textarea>
          <button id="browser-execute" class="btn btn-primary">Execute</button>
        </div>
        <div id="browser-status" class="status-display"></div>
      </div>
    </div>
  `;

  const executeButton = document.getElementById('browser-execute');
  executeButton?.addEventListener('click', executeBrowserCommand);

  // Show example on focus
  const urlInput = document.getElementById('browser-url') as HTMLInputElement;
  urlInput?.addEventListener('focus', () => {
    if (!urlInput.value) {
      document.getElementById('browser-status')!.innerHTML = `
        <div class="info-box">
          <strong>Examples:</strong><br/>
          URL: https://example.com<br/>
          Script: <code>await page.waitForSelector('h1'); return await page.title();</code>
        </div>
      `;
    }
  });
}

/**
 * Execute browser command
 */
async function executeBrowserCommand() {
  const urlInput = document.getElementById('browser-url') as HTMLInputElement;
  const scriptInput = document.getElementById('browser-script') as HTMLTextAreaElement;
  const statusDiv = document.getElementById('browser-status');

  const url = urlInput?.value.trim();
  const script = scriptInput?.value.trim();

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  terminal?.writeln(`\r\n\x1b[35m[Browser]\x1b[0m Executing on ${url}...`);

  if (statusDiv) {
    statusDiv.innerHTML = '<div class="status-pending">⋯ Executing...</div>';
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/browser/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        script: script || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      terminal?.writeln(`\x1b[32m✓ Success: ${JSON.stringify(data, null, 2)}\x1b[0m`);

      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="status-ok">
            ✓ Success<br/>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      }
    } else if (response.status === 502) {
      terminal?.writeln(`\x1b[31m✗ rebe-browser not available (Bad Gateway)\x1b[0m`);
      terminal?.writeln(`\x1b[90m  Is rebe-browser running on port 8080?\x1b[0m`);

      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="status-error">
            ✗ rebe-browser not available<br/>
            <small>Start rebe-browser on port 8080</small>
          </div>
        `;
      }
    } else {
      terminal?.writeln(`\x1b[31m✗ Error: ${response.statusText}\x1b[0m`);

      if (statusDiv) {
        statusDiv.innerHTML = `<div class="status-error">✗ Error: ${response.statusText}</div>`;
      }
    }
  } catch (error) {
    terminal?.writeln(`\x1b[31m✗ Error: ${error}\x1b[0m`);

    if (statusDiv) {
      statusDiv.innerHTML = `<div class="status-error">✗ Error: ${error}</div>`;
    }
  }
}

/**
 * Setup Status Panel
 */
function setupStatusPanel() {
  const statusPanel = document.getElementById('status-panel');
  if (!statusPanel) return;

  statusPanel.innerHTML = `
    <div class="panel">
      <h3>System Status</h3>
      <div class="panel-content">
        <div id="status-content" class="status-grid">
          <div class="status-item">
            <span class="status-label">Backend:</span>
            <span id="status-backend" class="status-value">Checking...</span>
          </div>
          <div class="status-item">
            <span class="status-label">Version:</span>
            <span id="status-version" class="status-value">-</span>
          </div>
          <div class="status-item">
            <span class="status-label">PTY:</span>
            <span id="status-pty" class="status-value">-</span>
          </div>
          <div class="status-item">
            <span class="status-label">SSH Pooling:</span>
            <span id="status-ssh" class="status-value">-</span>
          </div>
          <div class="status-item">
            <span class="status-label">Browser:</span>
            <span id="status-browser" class="status-value">-</span>
          </div>
          <div class="status-item">
            <span class="status-label">Circuit Breaker:</span>
            <span id="status-circuit" class="status-value">-</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Check health immediately and periodically
  checkHealth();
  setInterval(checkHealth, 5000); // Every 5 seconds
}

/**
 * Check backend health
 */
async function checkHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();

    // Update backend status
    const backendStatus = document.getElementById('status-backend');
    if (backendStatus) {
      if (data.status === 'healthy') {
        backendStatus.textContent = '✓ Healthy';
        backendStatus.className = 'status-value status-ok';
      } else {
        backendStatus.textContent = '✗ Unhealthy';
        backendStatus.className = 'status-value status-error';
      }
    }

    // Update version
    const versionStatus = document.getElementById('status-version');
    if (versionStatus) {
      versionStatus.textContent = data.version || 'Unknown';
      versionStatus.className = 'status-value';
    }

    // Update features
    if (data.features) {
      const updateFeature = (id: string, enabled: boolean) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = enabled ? '✓ Enabled' : '✗ Disabled';
          element.className = `status-value ${enabled ? 'status-ok' : 'status-error'}`;
        }
      };

      updateFeature('status-pty', data.features.pty);
      updateFeature('status-ssh', data.features.ssh_pooling);
      updateFeature('status-browser', data.features.browser);
      updateFeature('status-circuit', data.features.circuit_breaker);
    }

  } catch (error) {
    const backendStatus = document.getElementById('status-backend');
    if (backendStatus) {
      backendStatus.textContent = '✗ Offline';
      backendStatus.className = 'status-value status-error';
    }

    // Reset all features to unknown
    ['status-version', 'status-pty', 'status-ssh', 'status-browser', 'status-circuit'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '-';
        element.className = 'status-value';
      }
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
