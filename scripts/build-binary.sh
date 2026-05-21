#!/usr/bin/env bash
set -euo pipefail

echo "=== DevDash Build ==="
echo ""

# Step 1: Build UI
echo "→ Building UI..."
cd "$(dirname "$0")/.."
cd ui && npm run build && cd ..
echo "  ✓ UI built to ui/dist/"
echo ""

# Step 2: Check for Bun
if command -v bun &> /dev/null; then
  echo "→ Compiling binary with Bun..."
  bun build server/index.ts --compile --outfile devdash --target=bun-darwin-arm64
  echo "  ✓ Binary created: ./devdash"
  ls -lh devdash
else
  echo "→ Bun not found. Skipping binary compilation."
  echo "  Install Bun: curl -fsSL https://bun.sh/install | bash"
  echo ""
  echo "  Alternative: run directly with Node/tsx:"
  echo "    npx tsx server/index.ts"
fi

echo ""
echo "=== Done ==="
