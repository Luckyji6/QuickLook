# QuickLook - Windows Uninstaller
$ErrorActionPreference = "Stop"
$INSTALL_DIR = if ($env:QUICKLOOK_HOME) { $env:QUICKLOOK_HOME } else { Join-Path $env:USERPROFILE ".quicklook" }
$BIN_DIR = if ($env:QUICKLOOK_BIN) { $env:QUICKLOOK_BIN } else { Join-Path $env:USERPROFILE ".local\bin" }
$LAUNCHER = Join-Path $BIN_DIR "quicklook.cmd"

function Log-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Remove-PathWithRetry($TargetPath) {
  for ($i = 0; $i -lt 5; $i++) {
    try {
      if (-not (Test-Path $TargetPath)) { return $true }
      Remove-Item -Recurse -Force $TargetPath
      return $true
    } catch {
      if ($i -eq 4) { throw }
      Start-Sleep -Milliseconds 400
    }
  }
  return (-not (Test-Path $TargetPath))
}

Log-Info "QuickLook - Uninstaller"

$safeDir = [System.IO.Path]::GetTempPath()
try {
  $currentPath = (Get-Location).Path
  if ($currentPath -and $currentPath.StartsWith($INSTALL_DIR, [System.StringComparison]::OrdinalIgnoreCase)) {
    Set-Location $safeDir
  }
} catch {
  Set-Location $safeDir
}

if (Test-Path $LAUNCHER) {
  Remove-Item -Force $LAUNCHER
  Log-Info "Removed launcher: $LAUNCHER"
} else {
  Log-Warn "Launcher not found: $LAUNCHER"
}

if (Test-Path $INSTALL_DIR) {
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
  Remove-PathWithRetry $INSTALL_DIR | Out-Null
  Log-Info "Removed install directory: $INSTALL_DIR"
} else {
  Log-Warn "Install directory not found: $INSTALL_DIR"
}

Log-Info "Uninstall complete."
Log-Warn "You may remove the PATH entry in System Properties -> Environment Variables if you added it."
