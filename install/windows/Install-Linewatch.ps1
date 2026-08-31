# Linewatch — Chris Decker
# Right-click → Run with PowerShell. This PC becomes house DNS.
Set-Location (Join-Path $PSScriptRoot "..\..")
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $MyInvocation.MyCommand.Path))
  exit
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Install Node.js from https://nodejs.org then run again."
  exit 1
}
$node = (Get-Command node).Source
$root = (Get-Location).Path
$collector = Join-Path $root "collector\linewatch-collector.mjs"
$action = New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $collector) -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'Linewatch Collector' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Linewatch Collector'
node install/setup.mjs --desk-only
