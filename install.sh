#!/bin/bash
set -e

REPO_URL="https://github.com/Luckyji6/QuickLook.git"
INSTALL_DIR="${QUICKLOOK_HOME:-$HOME/.quicklook}"
BIN_LINK="${QUICKLOOK_BIN:-$HOME/.local/bin}"
LAUNCHER="quicklook"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos";;
    Linux)  echo "linux";;
    *)      echo "unknown";;
  esac
}

# Check if command exists
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# Install Bun (preferred - no npm)
install_bun() {
  if has_cmd bun; then
    log_info "Bun already installed: $(bun --version)"
    return 0
  fi
  log_info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if [ -x "$BUN_INSTALL/bin/bun" ]; then
    log_info "Bun installed successfully"
    return 0
  fi
  return 1
}

# Install Node.js if not present
install_node() {
  if has_cmd node; then
    log_info "Node.js already installed: $(node -v)"
    return 0
  fi
  local os=$(detect_os)
  log_info "Installing Node.js..."
  if [ "$os" = "macos" ]; then
    if has_cmd brew; then
      brew install node
    else
      log_err "Homebrew not found. Install from https://brew.sh"
      return 1
    fi
  elif [ "$os" = "linux" ]; then
    if has_cmd apt-get; then
      sudo apt-get update && sudo apt-get install -y nodejs npm
    elif has_cmd dnf; then
      sudo dnf install -y nodejs npm
    elif has_cmd yum; then
      sudo yum install -y nodejs npm
    else
      log_err "Unsupported package manager. Install Node.js manually from https://nodejs.org"
      return 1
    fi
  else
    log_err "Unsupported OS. Install Node.js from https://nodejs.org"
    return 1
  fi
  return 0
}

# Install dependencies (prefer Bun, fallback to pnpm/yarn/npm)
install_deps() {
  cd "$INSTALL_DIR"
  # Ensure bun in PATH after install
  [ -x "$HOME/.bun/bin/bun" ] && export PATH="$HOME/.bun/bin:$PATH"
  if has_cmd bun; then
    log_info "Installing dependencies with Bun..."
    bun install
    echo "bun"
    return 0
  fi
  if has_cmd pnpm; then
    log_info "Installing dependencies with pnpm..."
    pnpm install
    echo "pnpm"
    return 0
  fi
  if has_cmd yarn; then
    log_info "Installing dependencies with yarn..."
    yarn install
    echo "yarn"
    return 0
  fi
  if has_cmd npm; then
    log_info "Installing dependencies with npm..."
    npm install
    echo "npm"
    return 0
  fi
  log_err "No package manager found. Install Bun, pnpm, yarn, or npm."
  return 1
}

# Create launcher script (with auto-update on startup)
create_launcher() {
  local runner="$1"
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
  log_info "Launcher created: $BIN_LINK/$LAUNCHER (with auto-update)"
}

# Main
main() {
  log_info "QuickLook Photo - Installer"
  log_info "Install directory: $INSTALL_DIR"

  # Try Bun first (no npm)
  if install_bun; then
    :
  elif ! has_cmd node; then
    install_node || exit 1
  fi

  # Clone or update
  if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    log_info "Cloning from GitHub..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  # Install deps
  local pm=$(install_deps) || exit 1

  # Create launcher
  case "$pm" in
    bun)  create_launcher "bun";;
    *)    create_launcher "node";;
  esac

  # Check PATH
  if [[ ":$PATH:" != *":$BIN_LINK:"* ]]; then
    log_warn "Add to PATH: export PATH=\"$BIN_LINK:\$PATH\""
    log_warn "Add to ~/.bashrc or ~/.zshrc for persistence"
  fi

  log_info "Installation complete!"
  echo ""
  echo "  Run: $LAUNCHER /path/to/photos"
  echo "  Or:  $BIN_LINK/$LAUNCHER /path/to/photos"
  echo ""
}

main "$@"
