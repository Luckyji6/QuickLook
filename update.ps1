# QuickLook - Windows Updater
$ErrorActionPreference = "Stop"
$INSTALL_DIR = if ($env:QUICKLOOK_HOME) { $env:QUICKLOOK_HOME } else { Join-Path $env:USERPROFILE ".quicklook" }
$BIN_DIR = if ($env:QUICKLOOK_BIN) { $env:QUICKLOOK_BIN } else { Join-Path $env:USERPROFILE ".local\bin" }
$LAUNCHER = Join-Path $BIN_DIR "quicklook.cmd"

function Log-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Log-Err  { Write-Host "[ERR] $args"  -ForegroundColor Red }

if (-not (Test-Path (Join-Path $INSTALL_DIR ".git"))) {
  Log-Err "QuickLook not found at $INSTALL_DIR"
  Log-Info "Run install.ps1 first."
  exit 1
}

Set-Location $INSTALL_DIR
Log-Info "QuickLook - Updater"
Log-Info "Checking for updates..."
git fetch origin
$behind = git rev-list HEAD..origin/main --count 2>$null
if ([string]::IsNullOrEmpty($behind)) { $behind = "0" }

if ($behind -eq "0") {
  Log-Info "Already up to date."
  exit 0
}

Log-Info "Pulling latest from GitHub..."
git pull origin main

Log-Info "Reinstalling dependencies..."
$runner = "node"
if (Get-Command bun -ErrorAction SilentlyContinue) { bun install; $runner = "bun" } else { npm install }

Log-Info "Updating launcher..."
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null
$cmdContent = @"
@echo off
cd /d "$INSTALL_DIR"
"$runner" server.js %*
"@
Set-Content -Path $LAUNCHER -Value $cmdContent -Encoding ASCII

Log-Info "Update complete!"
