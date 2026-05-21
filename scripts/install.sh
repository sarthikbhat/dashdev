#!/usr/bin/env bash
set -euo pipefail

echo "=== DevDash Install ==="
echo ""

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

# Check if running from repo
if [ -f "package.json" ] && grep -q '"devdash"' package.json 2>/dev/null; then
  echo "→ Installing from local repo..."
  npm install
  cd ui && npm install && npm run build && cd ..

  # Create launcher script
  cat > "$INSTALL_DIR/devdash" << 'LAUNCHER'
#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0")")/../Desktop/code/tm/devdash" 2>/dev/null || cd "$HOME/Desktop/code/tm/devdash"
exec npx tsx server/index.ts "$@"
LAUNCHER
  chmod +x "$INSTALL_DIR/devdash"

  echo "  ✓ Installed to $INSTALL_DIR/devdash"
  echo ""
  echo "  Make sure $INSTALL_DIR is in your PATH:"
  echo '    export PATH="$HOME/.local/bin:$PATH"'
else
  echo "  Run this script from the devdash repo root."
  exit 1
fi

echo ""
echo "  Usage: devdash"
echo "  Then open: http://localhost:3847"
