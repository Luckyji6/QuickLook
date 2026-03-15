# QuickLook - Windows Uninstaller
$ErrorActionPreference = "Stop"
$INSTALL_DIR = if ($env:QUICKLOOK_HOME) { $env:QUICKLOOK_HOME } else { Join-Path $env:USERPROFILE ".quicklook" }
$BIN_DIR = if ($env:QUICKLOOK_BIN) { $env:QUICKLOOK_BIN } else { Join-Path $env:USERPROFILE ".local\bin" }
$LAUNCHER = Join-Path $BIN_DIR "quicklook.cmd"

function Log-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }

Log-Info "QuickLook - Uninstaller"

if (Test-Path $LAUNCHER) {
  Remove-Item -Force $LAUNCHER
  Log-Info "Removed launcher: $LAUNCHER"
} else {
  Log-Warn "Launcher not found: $LAUNCHER"
}

if (Test-Path $INSTALL_DIR) {
  Remove-Item -Recurse -Force $INSTALL_DIR
  Log-Info "Removed install directory: $INSTALL_DIR"
} else {
  Log-Warn "Install directory not found: $INSTALL_DIR"
}

Log-Info "Uninstall complete."
Log-Warn "You may remove the PATH entry in System Properties -> Environment Variables if you added it."
