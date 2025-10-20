# Getting Started with rebe-shell

**Quick start guide for development and contribution.**

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

**1. Rust (latest stable)**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

**2. Node.js 18+ LTS**

macOS (via Homebrew):
```bash
brew install node
```

Or download from: https://nodejs.org/

Verify installation:
```bash
node --version
npm --version
```

**3. Tauri CLI**
```bash
cargo install tauri-cli
```

### Platform-Specific Requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10+)

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/rebe-shell.git
cd rebe-shell
```

### 2. Install Dependencies

```bash
# Install JavaScript dependencies
npm install

# Download Rust dependencies (this will take a few minutes the first time)
cd src-tauri
cargo fetch
cd ..
```

### 3. Run in Development Mode

```bash
# This will:
# - Start the Vite dev server (frontend)
# - Compile the Rust backend
# - Launch the Tauri window
npm run tauri dev
```

First compile takes 5-10 minutes. Subsequent runs are much faster (~10 seconds).

---

## Project Structure Overview

```
rebe-shell/
├── src/                        # Frontend (TypeScript)
│   ├── main.ts                 # Application entry point
│   └── style.css               # Global styles
│
├── src-tauri/                  # Backend (Rust)
│   ├── src/
│   │   ├── main.rs             # Tauri app entry
│   │   ├── pty/                # PTY manager (✅ implemented)
│   │   ├── ssh/                # SSH connection pool (✅ implemented)
│   │   ├── stream/             # Streaming output handler (✅ implemented)
│   │   ├── circuit_breaker/    # Fault tolerance (✅ implemented)
│   │   ├── wasm/               # WASM runtime (🚧 placeholder)
│   │   └── protocol/           # Command protocol (✅ implemented)
│   └── Cargo.toml              # Rust dependencies
│
├── docs/                       # Documentation
├── README.md                   # Project overview
├── ARCHITECTURE.md             # Technical architecture
├── VISION.md                   # Long-term vision
├── DEVELOPMENT.md              # Contribution guide
└── GETTING_STARTED.md          # This file
```

---

## Development Workflow

### Running the Application

```bash
# Development mode (hot reload)
npm run tauri dev

# Production build
npm run tauri build
```

### Testing

```bash
# Run Rust tests
cd src-tauri
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Test with code coverage (requires cargo-tarpaulin)
cargo install cargo-tarpaulin
cargo tarpaulin --out Html
```

### Formatting and Linting

```bash
# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy -- -D warnings

# Format TypeScript code
npm run format

# Lint TypeScript code
npm run lint
```

---

## Current Implementation Status

### ✅ Completed (Phase 1 - Foundation)

1. **Project Structure**
   - Git repository initialized
   - Comprehensive documentation (README, VISION, ARCHITECTURE, DEVELOPMENT)
   - Architecture Decision Records (10 ADRs documented)

2. **Backend Modules**
   - PTY Manager: Spawn and manage shell sessions
   - SSH Connection Pool: 200x faster operations via connection reuse
   - Streaming Output Handler: O(n) memory complexity (not O(n²))
   - Circuit Breaker: Fault tolerance pattern implemented
   - Structured Protocol: JSON-based command API

3. **Frontend**
   - xterm.js terminal integration
   - Basic UI with Vite dev server
   - Tauri IPC communication setup

### 🚧 In Progress

1. **WASM Runtime**: Placeholder created, needs Wasmtime integration
2. **Parallel Execution**: Work queue and parallel workers
3. **End-to-End Integration**: Connect all modules

### 📅 Planned (Phase 2+)

- Retry logic with exponential backoff
- Health check system
- Regional agent architecture
- Claude Code integration
- Plugin marketplace

---

## Quick Commands Reference

```bash
# Development
npm run tauri dev          # Start dev server
npm run build              # Build frontend only
npm run tauri build        # Build complete application

# Testing
cargo test                 # Run all tests
cargo test --lib           # Unit tests only
cargo bench                # Run benchmarks

# Quality
cargo fmt                  # Format code
cargo clippy               # Lint code
cargo audit                # Check security vulnerabilities

# Frontend
npm run format             # Format TypeScript
npm run lint               # Lint TypeScript
```

---

## Troubleshooting

### "command not found: cargo"

Rust is not installed or not in PATH. Install via:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### "error: linker `cc` not found"

Missing C compiler. Install build tools:

macOS: `xcode-select --install`
Linux: `sudo apt install build-essential`
Windows: Install Visual Studio C++ Build Tools

### "failed to run custom build command for `openssl-sys`"

Missing OpenSSL development headers:

macOS: `brew install openssl`
Linux: `sudo apt install libssl-dev`

### Slow first compile

First Rust compilation downloads and compiles ~200 dependencies. This is normal and takes 5-10 minutes. Subsequent builds are much faster.

### "WebView2 not found" (Windows)

Install WebView2 Runtime:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Next Steps

1. **Explore the codebase**
   - Read [ARCHITECTURE.md](./ARCHITECTURE.md) for technical deep-dive
   - Review [VISION.md](./VISION.md) for long-term goals
   - Check [docs/DECISIONS.md](./docs/DECISIONS.md) for design rationale

2. **Run the tests**
   ```bash
   cd src-tauri
   cargo test
   ```

3. **Make your first contribution**
   - See [DEVELOPMENT.md](./DEVELOPMENT.md) for contribution guidelines
   - Look for issues tagged "good first issue"

4. **Join the community**
   - GitHub Discussions: https://github.com/your-org/rebe-shell/discussions
   - Discord: (link TBD)

---

## Getting Help

- **Documentation**: Start with README.md and ARCHITECTURE.md
- **Issues**: https://github.com/your-org/rebe-shell/issues
- **Discussions**: https://github.com/your-org/rebe-shell/discussions

---

**Welcome to rebe-shell!** 🚀

We're building the execution substrate for autonomous infrastructure management at planetary scale. Your contributions help make reliable infrastructure automation accessible to everyone.
