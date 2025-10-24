# Multi-stage build for rebe-shell backend
FROM rust:1.75-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Cargo files
COPY backend/Cargo.toml ./Cargo.toml

# Create dummy main.rs to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source
COPY backend/src ./src

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies including Node.js setup
RUN apt-get update && apt-get install -y \
    ca-certificates \
    bash \
    zsh \
    git \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rebe-shell-backend /usr/local/bin/rebe-shell-backend

# Copy frontend
COPY dist ./dist

# Expose port
EXPOSE 3000

# Run backend
CMD ["rebe-shell-backend"]
