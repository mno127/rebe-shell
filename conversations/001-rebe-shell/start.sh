#!/usr/bin/env bash
#
# rebe-shell Quick Start Script
#
# Usage: ./start.sh

set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              rebe-shell Quick Start                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop:"
    echo "   https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  docker-compose not found, trying 'docker compose'..."
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "🏗️  Building rebe-shell (this may take 5-10 minutes on first run)..."
echo ""

$COMPOSE_CMD up --build -d

echo ""
echo "✅ rebe-shell is running!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 Access rebe-shell                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Open in browser:"
echo "     http://localhost:3000"
echo ""
echo "  📊 View logs:"
echo "     $COMPOSE_CMD logs -f"
echo ""
echo "  🛑 Stop:"
echo "     $COMPOSE_CMD down"
echo ""

# Try to open browser automatically
if command -v open &> /dev/null; then
    echo "Opening browser..."
    sleep 2  # Give server time to start
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    echo "Opening browser..."
    sleep 2
    xdg-open http://localhost:3000
else
    echo "Please open http://localhost:3000 in your browser"
fi

echo ""
echo "Happy hacking! 🚀"
echo ""
