#Requires -Version 5.1
# ==============================================================================
# AUTONOMOUS CONTENT ENGINE - INSTALADOR AUTOMATICO MINIPC (WINDOWS / POWERSHELL)
# ==============================================================================
# Equivalente en PowerShell de scripts/setup-minipc.sh. Detecta:
#   1. RAM disponible (Qwen 14B para 24GB, Qwen 32B para >=32GB)
#   2. GPU NVIDIA (nvidia-smi)
#   3. Docker Desktop y Docker Compose v2
#   4. Configuracion .env y secretos de seguridad
#   5. Despliega el stack Docker y descarga los modelos en Ollama
#
# Uso: .\setup-minipc.ps1 [-CheckOnly] [-Upgrade48gb] [-Model <nombre>] [-Yes]
# ==============================================================================
[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$Upgrade48gb,
    [string]$Model = '',
    [Alias('NonInteractive')][switch]$Yes
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$ComposeFile = 'docker-compose.minipc.yml'
$OverrideModel = if ($Upgrade48gb) { 'qwen3:32b' } else { $Model }

function Write-Step($t) { Write-Host "`n$t" -ForegroundColor Blue }
function Write-Ok($t)   { Write-Host "  [OK] $t" -ForegroundColor Green }
function Write-Info($t) { Write-Host "  [i] $t" -ForegroundColor Yellow }
function Write-Err($t)  { Write-Host $t -ForegroundColor Red }

function Test-Native([string]$cmd) {
    # Ejecuta un comando nativo en silencio y devuelve $true si sale con codigo 0
    cmd.exe /c "$cmd >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

Write-Host ''
Write-Host '========================================================================' -ForegroundColor Cyan
Write-Host '     AUTONOMOUS CONTENT ENGINE - SETUP LOCAL & MINIPC (24GB/48GB)        ' -ForegroundColor Cyan
Write-Host '========================================================================' -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. SISTEMA Y HARDWARE
# ------------------------------------------------------------------------------
Write-Step '> [1/6] Diagnosticando Sistema y Recursos de Hardware...'

$os = Get-CimInstance Win32_OperatingSystem
$TotalRamGB = [int][Math]::Floor((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Write-Ok "Sistema Operativo detectado: $($os.Caption) ($env:PROCESSOR_ARCHITECTURE)"
Write-Ok "Memoria RAM detectada:       $TotalRamGB GB"

if ($OverrideModel) {
    $ChosenModel = $OverrideModel; $TierName = "Manual Override ($ChosenModel)"
} elseif ($TotalRamGB -ge 32) {
    $ChosenModel = 'qwen3:32b'; $TierName = 'Tier Alto Rendimiento (>=32GB / 48GB RAM)'
} else {
    $ChosenModel = 'qwen3:14b'; $TierName = 'Tier Optimizado (24GB RAM)'
}
$EmbeddingModel = 'bge-m3'

Write-Ok "Perfil de IA seleccionado:   $TierName"
Write-Host "    - Modelo LLM:                $ChosenModel"
Write-Host "    - Modelo Embeddings:         $EmbeddingModel (para pgvector local)"

$HasNvidia = $false
if ((Get-Command nvidia-smi -ErrorAction SilentlyContinue) -and (Test-Native 'nvidia-smi')) {
    $HasNvidia = $true
    $GpuName = (& nvidia-smi --query-gpu=name --format=csv,noheader | Select-Object -First 1)
    Write-Ok "GPU NVIDIA detectada:        $GpuName (aceleracion CUDA disponible)"
}
if (-not $HasNvidia) { Write-Info 'Modo de computo:             CPU / RAM Host unificada (AVX2)' }

# ------------------------------------------------------------------------------
# 2. DOCKER & DOCKER COMPOSE
# ------------------------------------------------------------------------------
Write-Step '> [2/6] Verificando Docker Engine y Docker Compose...'

$DockerReady = $false
$DaemonRunning = $false
$ComposeCmd = $null

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $DockerReady = $true
    Write-Ok "Docker instalado:            $(docker --version)"
} else {
    Write-Info 'Docker no esta instalado en este equipo.'
    if ($CheckOnly) {
        Write-Host '    -> Accion requerida: instalar Docker Desktop (winget install Docker.DockerDesktop).'
    } else {
        Write-Err 'Instala Docker Desktop (https://www.docker.com/products/docker-desktop o "winget install Docker.DockerDesktop") y vuelve a ejecutar este script.'
        exit 1
    }
}

if ($DockerReady) {
    if (Test-Native 'docker info') {
        $DaemonRunning = $true
        Write-Ok 'Demonio Docker:              Activo y respondiendo'
    } else {
        Write-Info 'El demonio Docker no esta activo.'
        if (-not $CheckOnly) {
            $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (Test-Path $dd) {
                Write-Host '  -> Iniciando Docker Desktop...'
                Start-Process $dd
                for ($i = 0; $i -lt 30 -and -not $DaemonRunning; $i++) {
                    Start-Sleep -Seconds 3
                    $DaemonRunning = Test-Native 'docker info'
                }
            }
            if ($DaemonRunning) { Write-Ok 'Demonio Docker iniciado con exito.' }
            else { Write-Err 'Error: el demonio de Docker no responde. Inicia Docker Desktop y vuelve a ejecutar.'; exit 1 }
        }
    }

    if (Test-Native 'docker compose version') {
        $ComposeCmd = @('docker', 'compose')
        Write-Ok "Docker Compose:              $(docker compose version)"
    } elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        $ComposeCmd = @('docker-compose')
        Write-Ok "Docker Compose (v1 legacy):  $(docker-compose --version)"
    } else {
        Write-Info 'Docker Compose no esta instalado.'
        if (-not $CheckOnly) { Write-Err 'Error: Docker Compose es necesario (viene incluido en Docker Desktop).'; exit 1 }
    }
}

if ($CheckOnly) {
    Write-Host "`n------------------------------------------------------------------------"
    Write-Host '                     RESUMEN DE DIAGNOSTICO'
    Write-Host '------------------------------------------------------------------------'
    Write-Host "  - Hardware RAM:     $TotalRamGB GB (Recomendacion: $ChosenModel)"
    Write-Host "  - Docker Engine:    $(if ($DockerReady) { 'Disponible' } else { 'No instalado' })"
    Write-Host "  - Servicio Docker:  $(if ($DaemonRunning) { 'En ejecucion' } else { 'Inactivo o pendiente de arrancar' })"
    Write-Host "  - Docker Compose:   $(if ($ComposeCmd) { 'Disponible' } else { 'No detectado' })"
    Write-Host "`n  Para desplegar todo automaticamente en este equipo, ejecuta:"
    Write-Host '    .\setup-minipc.ps1' -ForegroundColor Yellow
    exit 0
}

# ------------------------------------------------------------------------------
# 3. CONFIGURACION .env
# ------------------------------------------------------------------------------
Write-Step '> [3/6] Configurando variables de entorno (.env)...'

$EnvFile = Join-Path $ProjectRoot '.env'
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
if (-not (Test-Path $EnvFile)) {
    Write-Info 'Archivo .env no encontrado. Generando a partir de .env.example...'
    if (Test-Path '.env.example') { Copy-Item '.env.example' $EnvFile }
    else { [IO.File]::WriteAllText($EnvFile, '', $Utf8NoBom) }
}

function Get-EnvLines { , @([IO.File]::ReadAllLines($EnvFile)) }

function Set-EnvVar([string]$Key, [string]$Value) {
    $lines = [System.Collections.Generic.List[string]](Get-EnvLines)
    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -like "$Key=*") { $idx = $i; break } }
    if ($idx -ge 0) { $lines[$idx] = "$Key=$Value" } else { $lines.Add("$Key=$Value") }
    [IO.File]::WriteAllText($EnvFile, (($lines -join "`n") + "`n"), $Utf8NoBom)
}

Set-EnvVar 'OLLAMA_MODEL' $ChosenModel
Set-EnvVar 'OLLAMA_EMBEDDING_MODEL' $EmbeddingModel
Set-EnvVar 'LLM_PROVIDER' 'auto'
Set-EnvVar 'OLLAMA_BASE_URL' 'http://ollama:11434'

$hmacLine = (Get-EnvLines) | Where-Object { $_ -like 'HITL_HMAC_SECRET=*' } | Select-Object -First 1
if (-not $hmacLine -or -not $hmacLine.Substring('HITL_HMAC_SECRET='.Length)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Set-EnvVar 'HITL_HMAC_SECRET' (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
    Write-Ok 'Generada clave segura HITL_HMAC_SECRET.'
}

New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot 'media_workspace') | Out-Null
Write-Ok "Archivo .env verificado y alineado con el perfil $ChosenModel."

# ------------------------------------------------------------------------------
# 4. STACK DOCKER
# ------------------------------------------------------------------------------
Write-Step '> [4/6] Levantando los Contenedores del MiniPC...'
Write-Host '  Servicios: [1] Ollama LLM  [2] FastAPI Backend + FFmpeg  [3] Next.js Frontend  [4] n8n Automation'

$composeArgs = @()
if ($ComposeCmd.Count -gt 1) { $composeArgs += $ComposeCmd[1..($ComposeCmd.Count - 1)] }
& $ComposeCmd[0] @composeArgs -f $ComposeFile up -d --build
if ($LASTEXITCODE -ne 0) { Write-Err 'Error levantando los contenedores.'; exit $LASTEXITCODE }
Write-Ok 'Contenedores levantados en segundo plano.'

# ------------------------------------------------------------------------------
# 5. OLLAMA Y MODELOS
# ------------------------------------------------------------------------------
Write-Step '> [5/6] Verificando Motor Ollama y Descarga de Modelos Locales...'

Write-Host -NoNewline '  Esperando a que Ollama este listo...'
$OllamaReady = $false
for ($i = 0; $i -lt 20; $i++) {
    if (Test-Native 'docker exec ace-ollama ollama list') { $OllamaReady = $true; break }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 2
}
Write-Host ''

if (-not $OllamaReady) {
    Write-Info "Ollama tardo mas de lo esperado en responder. Revisa: 'docker logs ace-ollama'"
} else {
    Write-Ok 'Motor Ollama activo y listo.'
    $models = (& docker exec ace-ollama ollama list) -join "`n"

    if ($models -match [regex]::Escape($ChosenModel)) {
        Write-Ok "Modelo LLM $ChosenModel ya esta disponible en cache local."
    } else {
        Write-Host "  -> Descargando modelo LLM local ($ChosenModel). Esto puede tardar unos minutos segun tu conexion..."
        & docker exec ace-ollama ollama pull $ChosenModel
        if ($LASTEXITCODE -ne 0) {
            Write-Info "Fallo la descarga de $ChosenModel. Probando fallback qwen2.5:14b..."
            & docker exec ace-ollama ollama pull 'qwen2.5:14b'
        }
    }

    if ($models -match [regex]::Escape($EmbeddingModel)) {
        Write-Ok "Modelo Embeddings $EmbeddingModel ya esta disponible."
    } else {
        Write-Host "  -> Descargando modelo embeddings ($EmbeddingModel)..."
        & docker exec ace-ollama ollama pull $EmbeddingModel
    }
}

# ------------------------------------------------------------------------------
# 6. SALUD Y RESUMEN
# ------------------------------------------------------------------------------
Write-Step '> [6/6] Verificando salud de la infraestructura...'
Start-Sleep -Seconds 3

function Test-Url([string]$Name, [string]$Url) {
    try {
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        Write-Ok "${Name}: En linea ($Url)"
    } catch {
        Write-Info "${Name}: Iniciando... ($Url)"
    }
}

Test-Url 'Backend API (FastAPI)' 'http://localhost:8000/docs'
Test-Url 'Frontend Web (Next.js)' 'http://localhost:3000'
Test-Url 'Motor IA (Ollama)' 'http://localhost:11434'
Test-Url 'Automatizacion (n8n)' 'http://localhost:5678'

Write-Host "`n========================================================================" -ForegroundColor Green
Write-Host '           INSTALACION LOCAL EN EL MINIPC COMPLETADA CON EXITO           ' -ForegroundColor Green
Write-Host '========================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Accesos Locales:'
Write-Host '  - Frontend Web:        http://localhost:3000'
Write-Host '  - API & Swagger:       http://localhost:8000/docs'
Write-Host '  - n8n Workflows:       http://localhost:5678'
Write-Host '  - Ollama Engine:       http://localhost:11434'
Write-Host ''
Write-Host "  Perfil IA Activo:         $ChosenModel ($TotalRamGB GB RAM detectados)"
Write-Host ''
Write-Host '  Comandos de Gestion Utiles:'
Write-Host "  - Ver logs en tiempo real:   docker compose -f $ComposeFile logs -f"
Write-Host "  - Detener el servidor:       docker compose -f $ComposeFile stop"
Write-Host "  - Reiniciar el servidor:     docker compose -f $ComposeFile restart"
Write-Host '  - Ampliar a 48GB (Qwen 32B): .\setup-minipc.ps1 -Upgrade48gb'
Write-Host ''
Write-Host '  Para conectar el Frontend en Vercel con este MiniPC, consulta:'
Write-Host '  docs/GUIA_INSTALACION_MINIPC.md (Seccion Cloudflare Tunnel)'
