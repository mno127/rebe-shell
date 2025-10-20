import { invoke } from "@tauri-apps/api/tauri";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import "./style.css";

let terminal: Terminal;
let fitAddon: FitAddon;

async function setupTerminal() {
  const terminalContainer = document.querySelector("#terminal");
  if (!terminalContainer) {
    throw new Error("Terminal container not found");
  }

  // Create terminal instance
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
    },
    rows: 24,
    cols: 80,
  });

  // Add fit addon for auto-sizing
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // Add web links addon
  terminal.loadAddon(new WebLinksAddon());

  // Open terminal in container
  terminal.open(terminalContainer as HTMLElement);

  // Fit terminal to container
  fitAddon.fit();

  // Handle window resize
  window.addEventListener("resize", () => {
    fitAddon.fit();
  });

  // Welcome message
  terminal.writeln("╔══════════════════════════════════════════════════════════╗");
  terminal.writeln("║                    rebe-shell v0.1.0                     ║");
  terminal.writeln("║                                                          ║");
  terminal.writeln("║  WASM-powered cross-platform terminal for autonomous    ║");
  terminal.writeln("║  infrastructure orchestration at planetary scale        ║");
  terminal.writeln("╚══════════════════════════════════════════════════════════╝");
  terminal.writeln("");

  // Test Tauri backend connection
  try {
    const greeting = await invoke<string>("greet", { name: "Developer" });
    terminal.writeln(greeting);
    terminal.writeln("");
  } catch (error) {
    terminal.writeln(`Error connecting to backend: ${error}`);
  }

  terminal.writeln("Terminal ready. Backend integration in progress...");
  terminal.writeln("");
  terminal.write("$ ");

  // Handle user input
  terminal.onData((data) => {
    terminal.write(data);
  });
}

// Initialize when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  setupTerminal();
});
