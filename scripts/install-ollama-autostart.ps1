#Requires -Version 5.1
<#
.SYNOPSIS
    Installs (or removes) automatic startup on Windows login for KigalContent's
    authenticated MiniPC Ollama Cloudflare Tunnel watchdog (zero console windows,
    self-healing after reboot or sleep, auto-syncs Railway/Supabase).
#>
[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$TaskName = "KigalContent-Ollama-Tunnel"
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegName = "KigalContentOllamaTunnel"

$Pythonw = Join-Path $RepoRoot "backend\.venv\Scripts\pythonw.exe"
if (-not (Test-Path $Pythonw)) {
    $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
    if ($cmd) { $Pythonw = $cmd.Source } else { throw "pythonw.exe not found." }
}
$Watchdog = Join-Path $RepoRoot "scripts\ollama_tunnel_watchdog.py"

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match "ollama_tunnel_watchdog\.py" -or $_.CommandLine -match "cloudflared.*11435"
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "[OK] Auto-start removed ($TaskName)." -ForegroundColor Green
    exit 0
}

# Register clean Windows Scheduled Task (AtLogOn, hidden, no 72h limit, auto-restart)
$RegisteredViaTaskScheduler = $false
try {
    $action = New-ScheduledTaskAction -Execute $Pythonw -Argument "`"$Watchdog`"" -WorkingDirectory $RepoRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    $RegisteredViaTaskScheduler = $true
    # Clean any HKCU Run duplicate if Task Scheduler succeeded
    Remove-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue
    Write-Host "[OK] Windows Scheduled Task registered: $TaskName (AtLogOn, auto-restart, no time limit)." -ForegroundColor Green
} catch {
    Write-Host "[i] Task Scheduler unavailable without elevation ($($_.Exception.Message)); falling back to HKCU Run..." -ForegroundColor Yellow
    Set-ItemProperty -Path $RegPath -Name $RegName -Value "`"$Pythonw`" `"$Watchdog`""
    Write-Host "[OK] Windows user auto-start registered in Startup Apps ($RegName)." -ForegroundColor Green
}

if ($StartNow) {
    # Stop any stale proxy/tunnel/watchdog processes cleanly
    Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -match "ollama_tunnel_proxy\.py" -or
        $_.CommandLine -match "ollama_tunnel_watchdog\.py" -or
        $_.CommandLine -match "cloudflared.*11435"
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 600

    if ($RegisteredViaTaskScheduler) {
        Start-ScheduledTask -TaskName $TaskName
        Write-Host "[OK] Started Scheduled Task '$TaskName'." -ForegroundColor Green
    } else {
        Start-Process -FilePath $Pythonw -ArgumentList @("`"$Watchdog`"") -WorkingDirectory $RepoRoot -WindowStyle Hidden
        Write-Host "[OK] Started silent background watchdog." -ForegroundColor Green
    }
}
