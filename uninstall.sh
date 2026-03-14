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

main() {
  log_info "QuickLook - Uninstaller"

  # Remove launcher
  if [ -f "$BIN_LINK/$LAUNCHER" ]; then
    rm -f "$BIN_LINK/$LAUNCHER"
    log_info "Removed launcher: $BIN_LINK/$LAUNCHER"
  else
    log_warn "Launcher not found at $BIN_LINK/$LAUNCHER"
  fi

  # Remove install directory
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    log_info "Removed install directory: $INSTALL_DIR"
  else
    log_warn "Install directory not found: $INSTALL_DIR"
  fi

  log_info "Uninstall complete."
  log_info "You may remove PATH entry from ~/.bashrc or ~/.zshrc if you added it."
}

main "$@"
