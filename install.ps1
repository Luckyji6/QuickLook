# QuickLook - Windows Installer (PowerShell)
$ErrorActionPreference = "Stop"
$REPO_URL = if ($env:QUICKLOOK_REPO_URL) { $env:QUICKLOOK_REPO_URL } else { "https://github.com/Luckyji6/QuickLook.git" }
$INSTALL_DIR = if ($env:QUICKLOOK_HOME) { $env:QUICKLOOK_HOME } else { Join-Path $env:USERPROFILE ".quicklook" }
$BIN_DIR = if ($env:QUICKLOOK_BIN) { $env:QUICKLOOK_BIN } else { Join-Path $env:USERPROFILE ".local\bin" }

function Log-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Log-Err  { Write-Host "[ERR] $args"  -ForegroundColor Red }

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Log-Info "QuickLook - Windows Installer"
Log-Info "Install directory: $INSTALL_DIR"

# Check Git
if (-not (Test-Command "git")) {
  Log-Err "Git not found. Install from https://git-scm.com/download/win"
  exit 1
}

# Check Node.js
if (-not (Test-Command "node")) {
  Log-Err "Node.js not found. Install from https://nodejs.org or run: winget install OpenJS.NodeJS.LTS"
  exit 1
}
Log-Info "Node.js: $(node -v)"

# Bun (optional)
$runner = "node"
if (Test-Command "bun") {
  $runner = "bun"
  Log-Info "Using Bun: $(bun -v)"
}

# Clone or update
if (Test-Path (Join-Path $INSTALL_DIR ".git")) {
  Log-Info "Updating existing installation..."
  Set-Location $INSTALL_DIR
  git pull origin main
} else {
  Log-Info "Cloning from GitHub..."
  if (Test-Path $INSTALL_DIR) { Remove-Item -Recurse -Force $INSTALL_DIR }
  git clone $REPO_URL $INSTALL_DIR
  Set-Location $INSTALL_DIR
}

# Install dependencies
Log-Info "Installing dependencies..."
if ($runner -eq "bun") {
  bun install
} else {
  npm install
}

# Create .local\bin and launcher
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null
$launcherPath = Join-Path $BIN_DIR "quicklook.cmd"
$cmdContent = @"
@echo off
cd /d "$INSTALL_DIR"
"$runner" server.js %*
"@
Set-Content -Path $launcherPath -Value $cmdContent -Encoding ASCII

Log-Info "Launcher created: $launcherPath"

# Add to user PATH if not present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$BIN_DIR*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$BIN_DIR", "User")
  Log-Warn "Added to user PATH. Restart terminal for 'quicklook' to be available."
} else {
  Log-Info "PATH already contains $BIN_DIR"
}

Log-Info "Installation complete!"
Write-Host ""
Write-Host "  Run: quicklook C:\path\to\photos" -ForegroundColor Cyan
Write-Host "  Or:  $launcherPath C:\path\to\photos" -ForegroundColor Cyan
Write-Host ""
