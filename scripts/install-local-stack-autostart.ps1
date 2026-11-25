#Requires -Version 5.1
<#
.SYNOPSIS
    Installs (or restarts / uninstalls) the 100% local KigalContent MiniPC stack
    (FastAPI Backend :8000 + Next.js Frontend :3001 + FFmpeg + native Ollama GPU)
    as a silent Windows Scheduled Task at login.
#>
[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$StartNow,
    [switch]$RebuildFrontend
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "KigalContent-Local-Stack"
$Pythonw = Join-Path $RepoRoot "backend\.venv\Scripts\pythonw.exe"
if (-not (Test-Path $Pythonw)) {
    $Pythonw = (Get-Command pythonw.exe).Source
}
$Runner = Join-Path $RepoRoot "scripts\kigalcontent_local_runner.py"

function Stop-LocalStackProcesses {
    Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match "kigalcontent_local_runner\.py" -or
        ($_.CommandLine -match "uvicorn.*app\.main:app.*8000") -or
        ($_.CommandLine -match "kigalcontent\\frontend.*(3001|standalone\\server\.js)")
    } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 700
}

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Stop-LocalStackProcesses
    Write-Host "[OK] Local stack autostart removed ($TaskName)." -ForegroundColor Green
    exit 0
}

if ($RebuildFrontend) {
    Stop-LocalStackProcesses
    Push-Location (Join-Path $RepoRoot "frontend")
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
        $standaloneDir = Join-Path (Get-Location) ".next\standalone"
        $staticSrc = Join-Path (Get-Location) ".next\static"
        $staticDst = Join-Path $standaloneDir ".next\static"
        if (Test-Path $staticSrc) {
            New-Item -ItemType Directory -Force -Path $staticDst | Out-Null
            Copy-Item -Path "$staticSrc\*" -Destination $staticDst -Recurse -Force
        }
        $pubSrc = Join-Path (Get-Location) "public"
        $pubDst = Join-Path $standaloneDir "public"
        if (Test-Path $pubSrc) {
            New-Item -ItemType Directory -Force -Path $pubDst | Out-Null
            Copy-Item -Path "$pubSrc\*" -Destination $pubDst -Recurse -Force
        }
        Write-Host "[OK] Frontend production standalone build ready." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

$action = New-ScheduledTaskAction -Execute $Pythonw -Argument "`"$Runner`"" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "[OK] Windows Scheduled Task registered: $TaskName (AtLogOn, silent, auto-restart)." -ForegroundColor Green

if ($StartNow) {
    Stop-LocalStackProcesses
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "[OK] Started Scheduled Task '$TaskName' (Backend :8000 + Frontend :3001)." -ForegroundColor Green
}
