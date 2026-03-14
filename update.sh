#!/bin/bash
set -e

INSTALL_DIR="${QUICKLOOK_HOME:-$HOME/.quicklook}"
BIN_LINK="${QUICKLOOK_BIN:-$HOME/.local/bin}"
LAUNCHER="quicklook"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

main() {
  log_info "QuickLook - Updater"

  if [ ! -d "$INSTALL_DIR/.git" ]; then
    log_err "QuickLook not found at $INSTALL_DIR"
    log_info "Run install.sh first: curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.sh | bash"
    exit 1
  fi

  cd "$INSTALL_DIR"
  log_info "Checking for updates..."
  git fetch origin
  behind=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  if [ "$behind" = "0" ]; then
    log_info "Already up to date."
    exit 0
  fi

  log_info "Pulling latest from GitHub..."
  git pull origin main

  log_info "Reinstalling dependencies..."
  if command -v bun >/dev/null 2>&1; then
    bun install
    runner="bun"
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm install
    runner="node"
  elif command -v yarn >/dev/null 2>&1; then
    yarn install
    runner="node"
  else
    npm install
    runner="node"
  fi

  # Recreate launcher (to get latest auto-update logic)
  log_info "Updating launcher..."
  mkdir -p "$BIN_LINK"
  cat > "$BIN_LINK/$LAUNCHER" << LAUNCHER
#!/bin/bash
cd "$INSTALL_DIR"
# Auto-update on startup (only when behind)
if [ -d ".git" ]; then
  git fetch origin 2>/dev/null
  behind=\$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  if [ "\$behind" != "0" ] && [ "\$behind" != "" ]; then
    echo "QuickLook: updating..."
    git pull origin main
    if command -v bun >/dev/null 2>&1; then bun install
    elif command -v pnpm >/dev/null 2>&1; then pnpm install
    elif command -v yarn >/dev/null 2>&1; then yarn install
    else npm install; fi
    echo "QuickLook: updated."
  fi
fi
exec $runner server.js "\$@"
LAUNCHER
  chmod +x "$BIN_LINK/$LAUNCHER"

  log_info "Update complete!"
}

main "$@"
