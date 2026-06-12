#!/usr/bin/env bash
# ============================================================
# E2E Orchestrator — Entry Point
# Fully independent from Kiro IDE. Uses Claude API directly.
#
# Usage:
#   ./wizard.sh                          Interactive mode
#   ./wizard.sh --generate codebase      Generate tests from source code
#   ./wizard.sh --generate requirements  Generate tests from docs
#   ./wizard.sh --workers 4 --verbose    Execute with 4 parallel agents
#   ./wizard.sh --resume                 Resume interrupted run
#   ./wizard.sh --modules "Search,Profile" --workers 2
#
# Required:
#   export ANTHROPIC_API_KEY="sk-ant-..."
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install Node.js 18+ first."
  exit 1
fi

# Check npx
if ! command -v npx &>/dev/null; then
  echo "❌ npx not found. Install Node.js 18+ first."
  exit 1
fi

# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Install deps if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "📦 Installing dependencies..."
  (cd "$SCRIPT_DIR" && npm install)
fi

# Run the orchestrator
exec npx tsx "$SCRIPT_DIR/src/wizard.ts" "$@"
