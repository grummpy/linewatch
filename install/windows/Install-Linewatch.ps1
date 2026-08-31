# Linewatch — Chris Decker
# Right-click → Run with PowerShell. This PC becomes house DNS.
Set-Location (Join-Path $PSScriptRoot "..\..")
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Install Node.js from https://nodejs.org then run again."
  exit 1
}
node install/setup.mjs
