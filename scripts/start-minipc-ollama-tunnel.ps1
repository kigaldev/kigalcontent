#Requires -Version 5.1
<#
.SYNOPSIS
    Exposes the MiniPC's local Ollama securely via an authenticated proxy + Cloudflare Tunnel
    and automatically registers it on KigalContent's production backend (Railway -> Supabase).
#>
[CmdletBinding()]
param(
    [string]$BackendUrl = "https://autonomous-content-engine-backend-production.up.railway.app",
    [string]$PreferredModel = "qwen3.6:27b",
    [int]$ProxyPort = 11435,
    [switch]$SkipBackendSync
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Resolve-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\cloudflared\cloudflared.exe",
        "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    throw "cloudflared not found. Install it with: winget install --id Cloudflare.cloudflared -e"
}

function Resolve-Python {
    $venvPy = Join-Path $RepoRoot "backend\.venv\Scripts\python.exe"
    if (Test-Path $venvPy) { return $venvPy }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "Python not found."
}

$CloudflaredBin = Resolve-Cloudflared
$PythonBin = Resolve-Python

# 1. Verify local Ollama is running and pick installed model
$tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5
$installed = @($tags.models | ForEach-Object { $_.name })
if ($installed.Count -eq 0) {
    throw "Ollama is running on 127.0.0.1:11434 but has no models installed."
}
$ChosenModel = if ($installed -contains $PreferredModel) { $PreferredModel } else { $installed[0] }
Write-Host "[OK] Local Ollama detected ($($installed.Count) models). Active model: $ChosenModel" -ForegroundColor Green

# 2. Load or generate persistent Bearer token (.ollama_tunnel_token, gitignored)
$TokenFile = Join-Path $RepoRoot ".ollama_tunnel_token"
if (Test-Path $TokenFile) {
    $Token = (Get-Content -Raw $TokenFile).Trim()
} else {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Token = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    [IO.File]::WriteAllText($TokenFile, $Token, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "[OK] Generated new 256-bit Bearer token in .ollama_tunnel_token" -ForegroundColor Green
}

# 3. Stop any previous proxy/tunnel processes started for this repo
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "ollama_tunnel_proxy\.py" -or $_.CommandLine -match "cloudflared.*:$ProxyPort"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

# 4. Start authenticated proxy on 127.0.0.1:$ProxyPort
$ProxyScript = Join-Path $RepoRoot "scripts\ollama_tunnel_proxy.py"
$ProxyLog = Join-Path $RepoRoot "ollama_proxy.log"
$env:OLLAMA_TUNNEL_TOKEN = $Token
$env:OLLAMA_PROXY_PORT = "$ProxyPort"
$proxyProc = Start-Process -FilePath $PythonBin -ArgumentList @($ProxyScript) -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $ProxyLog -RedirectStandardError (Join-Path $RepoRoot "ollama_proxy.err.log") -PassThru

$proxyReady = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:$ProxyPort/proxy-health" -TimeoutSec 2
        if ($h.status -eq "ok") { $proxyReady = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $proxyReady) { throw "Authenticated Ollama proxy failed to start on port $ProxyPort." }
Write-Host "[OK] Authenticated Ollama proxy listening on 127.0.0.1:$ProxyPort (PID $($proxyProc.Id))" -ForegroundColor Green

# 5. Start Cloudflare Quick Tunnel pointing to the authenticated proxy
$TunnelLog = Join-Path $RepoRoot "ollama_tunnel.log"
if (Test-Path $TunnelLog) { Remove-Item $TunnelLog -Force }
$tunnelProc = Start-Process -FilePath $CloudflaredBin -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$ProxyPort", "--logfile", $TunnelLog) -WorkingDirectory $RepoRoot -WindowStyle Hidden -PassThru

$TunnelUrl = $null
for ($i = 0; $i -lt 40; $i++) {
    if (Test-Path $TunnelLog) {
        $content = Get-Content -Raw $TunnelLog -ErrorAction SilentlyContinue
        if ($content -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $TunnelUrl = $Matches[1]
            break
        }
    }
    Start-Sleep -Milliseconds 500
}
if (-not $TunnelUrl) { throw "Cloudflare Tunnel did not publish a URL within 20s. Check $TunnelLog." }

[IO.File]::WriteAllText((Join-Path $RepoRoot ".ollama_tunnel_url"), $TunnelUrl, (New-Object System.Text.UTF8Encoding $false))
Write-Host "[OK] Cloudflare Tunnel live: $TunnelUrl (PID $($tunnelProc.Id))" -ForegroundColor Cyan

# Wait briefly for Cloudflare edge DNS propagation and verify Bearer auth
Start-Sleep -Seconds 3
$verified = $false
for ($i = 0; $i -lt 8; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "$TunnelUrl/api/tags" -Headers @{ Authorization = "Bearer $Token" } -TimeoutSec 6
        if ($resp.models.Count -gt 0) { $verified = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}
if (-not $verified) {
    Write-Warning "Tunnel URL created ($TunnelUrl) but edge DNS is still propagating; continuing..."
} else {
    Write-Host "[OK] End-to-end authenticated tunnel verified ($($installed.Count) models reachable)." -ForegroundColor Green
}

# 6. Register on Railway production backend (persisted in Supabase PostgreSQL)
if (-not $SkipBackendSync) {
    $cleanBackend = $BackendUrl.TrimEnd("/")
    $payload = @{
        active_provider = "auto"
        ollama_base_url = $TunnelUrl
        ollama_model    = $ChosenModel
        ollama_api_key  = $Token
    } | ConvertTo-Json
    try {
        $cfg = Invoke-RestMethod -Uri "$cleanBackend/api/v1/llm/config" -Method Put -ContentType "application/json" -Body $payload -TimeoutSec 15
        Write-Host "[OK] Backend updated ($cleanBackend) -> provider=$($cfg.active_provider), model=$($cfg.ollama_model), reachable=$($cfg.ollama_reachable)" -ForegroundColor Green
    } catch {
        Write-Warning "Could not sync to backend yet ($cleanBackend): $($_.Exception.Message)"
    }
}
