#!/usr/bin/env bash
# ==============================================================================
# AUTONOMOUS CONTENT ENGINE — INSTALADOR AUTOMÁTICO MINIPC & LOCAL
# ==============================================================================
# Detecta automáticamente:
#   1. Sistema Operativo (Linux Ubuntu/Debian, macOS, etc.)
#   2. Docker Engine y Docker Compose v2 (instala Docker si falta en Linux)
#   3. Memoria RAM disponible (asigna Qwen 14B para 24GB o Qwen 32B para 48GB)
#   4. Aceleración hardware (NVIDIA GPU / Metal / CPU AVX2)
#   5. Configuración .env y secretos de seguridad
#   6. Despliega stack Docker completo y descarga los modelos en Ollama
# ==============================================================================

set -eo pipefail

# Colores para salida interactiva
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Directorio raíz del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.minipc.yml"
OVERRIDE_MODEL=""
CHECK_ONLY=false
NON_INTERACTIVE=false

# Procesar argumentos CLI
while [[ $# -gt 0 ]]; do
  case $1 in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --upgrade-48gb)
      OVERRIDE_MODEL="qwen3:32b"
      shift
      ;;
    --model)
      OVERRIDE_MODEL="$2"
      shift 2
      ;;
    -y|--yes|--non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    --help|-h)
      echo -e "${BOLD}Uso:${NC} ./setup-minipc.sh [OPCIONES]"
      echo ""
      echo "Opciones:"
      echo "  --check-only          Verifica requisitos, Docker y RAM sin arrancar contenedores."
      echo "  --upgrade-48gb        Fuerza la configuración para 48GB de RAM (modelo Qwen 32B)."
      echo "  --model <nombre>      Especifica un modelo LLM concreto (ej: qwen3:14b, llama3.1:8b)."
      echo "  -y, --non-interactive Ejecuta sin solicitar confirmaciones interactivas."
      echo "  -h, --help            Muestra esta ayuda."
      exit 0
      ;;
    *)
      echo -e "${RED}Opción desconocida: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║       AUTONOMOUS CONTENT ENGINE — SETUP LOCAL & MINIPC (24GB/48GB)     ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ------------------------------------------------------------------------------
# 1. DETECCIÓN DE SISTEMA OPERATIVO Y HARDWARE
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ [1/6] Diagnosticando Sistema y Recursos de Hardware...${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"
TOTAL_RAM_GB=0

if [ "$OS" = "Linux" ]; then
  if [ -f /proc/meminfo ]; then
    TOTAL_RAM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
    TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
  fi
  OS_DESC="Linux (${ARCH})"
elif [ "$OS" = "Darwin" ]; then
  RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  TOTAL_RAM_GB=$((RAM_BYTES / 1024 / 1024 / 1024))
  OS_DESC="macOS Apple (${ARCH})"
else
  OS_DESC="Entorno $OS (${ARCH})"
  TOTAL_RAM_GB=16
fi

echo -e "  ✓ Sistema Operativo detectado: ${BOLD}${OS_DESC}${NC}"
echo -e "  ✓ Memoria RAM detectada:       ${BOLD}${TOTAL_RAM_GB} GB${NC}"

# Selección automática del modelo según RAM
if [ -n "$OVERRIDE_MODEL" ]; then
  CHOSEN_MODEL="$OVERRIDE_MODEL"
  TIER_NAME="Manual Override ($CHOSEN_MODEL)"
elif [ "$TOTAL_RAM_GB" -ge 32 ]; then
  CHOSEN_MODEL="qwen3:32b"
  TIER_NAME="Tier Alto Rendimiento (≥32GB / 48GB RAM)"
else
  CHOSEN_MODEL="qwen3:14b"
  TIER_NAME="Tier Optimizado (24GB RAM)"
fi
EMBEDDING_MODEL="bge-m3"

echo -e "  ✓ Perfil de IA seleccionado:   ${GREEN}${BOLD}${TIER_NAME}${NC}"
echo -e "    • Modelo LLM:                ${BOLD}${CHOSEN_MODEL}${NC}"
echo -e "    • Modelo Embeddings:         ${BOLD}${EMBEDDING_MODEL}${NC} (para pgvector local)"

# Detección de GPU NVIDIA
HAS_NVIDIA=false
if command -v nvidia-smi >/dev/null 2>&1; then
  if nvidia-smi >/dev/null 2>&1; then
    HAS_NVIDIA=true
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
    echo -e "  ✓ GPU NVIDIA detectada:        ${GREEN}${GPU_NAME}${NC} (aceleración CUDA disponible)"
  fi
fi
if [ "$HAS_NVIDIA" = false ]; then
  echo -e "  ℹ Modo de cómputo:             ${YELLOW}CPU / RAM Host unificada (AVX2 / Metal)${NC}"
fi

# ------------------------------------------------------------------------------
# 2. DETECCIÓN Y COMPROBACIÓN DE DOCKER & DOCKER COMPOSE
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [2/6] Verificando Docker Engine y Docker Compose...${NC}"

DOCKER_CMD=""
COMPOSE_CMD=""
DOCKER_READY=true

if command -v docker >/dev/null 2>&1; then
  DOCKER_CMD="docker"
  DOCKER_VERSION=$(docker --version)
  echo -e "  ✓ Docker instalado:            ${BOLD}${DOCKER_VERSION}${NC}"
else
  echo -e "  ${YELLOW}⚠ Docker no está instalado en este equipo.${NC}"
  DOCKER_READY=false
  if [ "$CHECK_ONLY" = true ]; then
    echo -e "    → Acción requerida: Instalar Docker (en Linux: 'curl -fsSL https://get.docker.com | sh'; en macOS: Docker Desktop)."
  else
    if [ "$OS" = "Linux" ]; then
      echo -e "  ¿Deseas instalar Docker automáticamente mediante el instalador oficial?"
      if [ "$NON_INTERACTIVE" = false ]; then
        read -p "  Instalar Docker ahora? [S/n]: " -r INSTALL_DOCKER_REPLY
        INSTALL_DOCKER_REPLY=${INSTALL_DOCKER_REPLY:-S}
      else
        INSTALL_DOCKER_REPLY="S"
      fi

      if [[ "$INSTALL_DOCKER_REPLY" =~ ^[Ss]$ ]]; then
        echo -e "  → Descargando e instalando Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
        sudo usermod -aG docker "$USER" || true
        sudo systemctl enable --now docker
        DOCKER_CMD="docker"
        DOCKER_READY=true
        echo -e "  ${GREEN}✓ Docker instalado correctamente.${NC}"
      else
        echo -e "${RED}Error: Docker es imprescindible para ejecutar el stack local.${NC}"
        exit 1
      fi
    else
      echo -e "${RED}Por favor, instala Docker Desktop desde https://www.docker.com/products/docker-desktop y vuelve a ejecutar este script.${NC}"
      exit 1
    fi
  fi
fi

# Verificar si el demonio de Docker está ejecutándose
DAEMON_RUNNING=false
if [ -n "$DOCKER_CMD" ]; then
  if docker info >/dev/null 2>&1; then
    DAEMON_RUNNING=true
    echo -e "  ✓ Demonio Docker:              ${GREEN}Activo y respondiendo${NC}"
  else
    echo -e "  ${YELLOW}⚠ El demonio Docker no está activo.${NC}"
    if [ "$CHECK_ONLY" = false ]; then
      if [ "$OS" = "Linux" ]; then
        echo -e "  → Intentando iniciar el demonio de Docker (systemctl)..."
        sudo systemctl start docker || true
        sleep 2
      fi
      if docker info >/dev/null 2>&1; then
        DAEMON_RUNNING=true
        echo -e "  ✓ Demonio Docker iniciado con éxito."
      else
        echo -e "${RED}Error: El demonio de Docker no responde. Inicia Docker y vuelve a ejecutar.${NC}"
        exit 1
      fi
    fi
  fi
fi

# Verificar Docker Compose (plugin v2 o binario v1)
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  COMPOSE_VERSION=$(docker compose version)
  echo -e "  ✓ Docker Compose:              ${BOLD}${COMPOSE_VERSION}${NC}"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
  COMPOSE_VERSION=$(docker-compose --version)
  echo -e "  ✓ Docker Compose (v1 legacy):  ${BOLD}${COMPOSE_VERSION}${NC}"
else
  echo -e "  ${YELLOW}⚠ Docker Compose no está instalado.${NC}"
  if [ "$CHECK_ONLY" = false ]; then
    if [ "$OS" = "Linux" ]; then
      echo -e "  → Instalando docker-compose-plugin vía apt..."
      sudo apt-get update && sudo apt-get install -y docker-compose-plugin || true
      COMPOSE_CMD="docker compose"
    else
      echo -e "${RED}Error: Docker Compose es necesario para orquestar los contenedores.${NC}"
      exit 1
    fi
  fi
fi

if [ "$CHECK_ONLY" = true ]; then
  echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}                     RESUMEN DE DIAGNÓSTICO                             ${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  • Hardware RAM:     ${BOLD}${TOTAL_RAM_GB} GB${NC} (Recomendación: ${GREEN}${CHOSEN_MODEL}${NC})"
  if [ "$DOCKER_READY" = true ]; then
    echo -e "  • Docker Engine:    ${GREEN}Disponible${NC}"
  else
    echo -e "  • Docker Engine:    ${RED}No instalado${NC}"
  fi
  if [ "$DAEMON_RUNNING" = true ]; then
    echo -e "  • Servicio Docker:  ${GREEN}En ejecución${NC}"
  else
    echo -e "  • Servicio Docker:  ${YELLOW}Inactivo o pendiente de arrancar${NC}"
  fi
  if [ -n "$COMPOSE_CMD" ]; then
    echo -e "  • Docker Compose:   ${GREEN}Disponible${NC}"
  else
    echo -e "  • Docker Compose:   ${YELLOW}No detectado${NC}"
  fi
  echo -e "\n  Para desplegar todo automáticamente en este equipo, ejecuta:"
  echo -e "    ${YELLOW}${BOLD}./setup-minipc.sh${NC}\n"
  exit 0
fi

# ------------------------------------------------------------------------------
# 3. PREPARACIÓN DE CONFIGURACIÓN Y ARCHIVO .env
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [3/6] Configurando variables de entorno (.env)...${NC}"

if [ ! -f .env ]; then
  echo -e "  ℹ Archivo .env no encontrado. Generando a partir de .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi
fi

# Actualizar o inyectar modelos en .env
update_env_var() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" .env; then
    # Usar sed compatible tanto en Linux como en macOS
    if [ "$OS" = "Darwin" ]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${val}|" .env
    fi
  else
    echo "${key}=${val}" >> .env
  fi
}

update_env_var "OLLAMA_MODEL" "$CHOSEN_MODEL"
update_env_var "OLLAMA_EMBEDDING_MODEL" "$EMBEDDING_MODEL"
update_env_var "LLM_PROVIDER" "auto"
update_env_var "OLLAMA_BASE_URL" "http://ollama:11434"

# Si no hay HITL_HMAC_SECRET, generar uno seguro
CURRENT_HMAC=$(grep "^HITL_HMAC_SECRET=" .env | cut -d'=' -f2- || true)
if [ -z "$CURRENT_HMAC" ]; then
  NEW_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
  update_env_var "HITL_HMAC_SECRET" "$NEW_SECRET"
  echo -e "  ✓ Generada clave segura HITL_HMAC_SECRET."
fi

# Crear directorio de medios si no existe
mkdir -p media_workspace

echo -e "  ✓ Archivo .env verificado y alineado con el perfil ${BOLD}${CHOSEN_MODEL}${NC}."

# ------------------------------------------------------------------------------
# 4. CONSTRUCCIÓN Y DESPLIEGUE DEL STACK DOCKER
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [4/6] Levantando los Contenedores del MiniPC...${NC}"
echo -e "  Servicios: [1] Ollama LLM  [2] FastAPI Backend + FFmpeg  [3] Next.js Frontend  [4] n8n Automation"

$COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build

echo -e "  ${GREEN}✓ Contenedores levantados en segundo plano.${NC}"

# ------------------------------------------------------------------------------
# 5. ESPERA DE OLLAMA Y DESCARGA AUTOMÁTICA DE MODELOS
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [5/6] Verificando Motor Ollama y Descarga de Modelos Locales...${NC}"

echo -n "  Esperando a que Ollama esté listo..."
MAX_RETRIES=20
RETRY_COUNT=0
OLLAMA_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker exec ace-ollama ollama list >/dev/null 2>&1; then
    OLLAMA_READY=true
    break
  fi
  echo -n "."
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT + 1))
done
echo ""

if [ "$OLLAMA_READY" = false ]; then
  echo -e "  ${YELLOW}⚠ Ollama tardó más de lo esperado en responder. Revisa: 'docker logs ace-ollama'${NC}"
else
  echo -e "  ${GREEN}✓ Motor Ollama activo y listo.${NC}"

  # Descarga del modelo principal si no existe
  if docker exec ace-ollama ollama list | grep -q "$CHOSEN_MODEL"; then
    echo -e "  ✓ Modelo LLM ${BOLD}${CHOSEN_MODEL}${NC} ya está disponible en caché local."
  else
    echo -e "  → Descargando modelo LLM local (${BOLD}${CHOSEN_MODEL}${NC}). Esto puede tardar unos minutos según tu conexión..."
    docker exec ace-ollama ollama pull "$CHOSEN_MODEL" || {
      echo -e "  ${YELLOW}⚠ Falló la descarga de ${CHOSEN_MODEL}. Probando fallback qwen2.5:14b...${NC}"
      docker exec ace-ollama ollama pull "qwen2.5:14b" || true
    }
  fi

  # Descarga del modelo de embeddings
  if docker exec ace-ollama ollama list | grep -q "$EMBEDDING_MODEL"; then
    echo -e "  ✓ Modelo Embeddings ${BOLD}${EMBEDDING_MODEL}${NC} ya está disponible."
  else
    echo -e "  → Descargando modelo embeddings (${BOLD}${EMBEDDING_MODEL}${NC})..."
    docker exec ace-ollama ollama pull "$EMBEDDING_MODEL" || true
  fi
fi

# ------------------------------------------------------------------------------
# 6. VERIFICACIÓN DE SALUD Y RESUMEN FINAL
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [6/6] Verificando salud de la infraestructura...${NC}"

sleep 3

check_url() {
  local name="$1"
  local url="$2"
  if curl -s -f -o /dev/null --connect-timeout 3 "$url" 2>/dev/null; then
    echo -e "  ✓ ${name}: ${GREEN}En línea${NC} (${url})"
  else
    echo -e "  ℹ ${name}: ${YELLOW}Iniciando...${NC} (${url})"
  fi
}

check_url "Backend API (FastAPI)" "http://localhost:8000/docs"
check_url "Frontend Web (Next.js)" "http://localhost:3000"
check_url "Motor IA (Ollama)"      "http://localhost:11434"
check_url "Automatización (n8n)"   "http://localhost:5678"

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}           ¡INSTALACIÓN LOCAL EN EL MINIPC COMPLETADA CON ÉXITO!        ${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Accesos Locales:${NC}"
echo -e "  • ${CYAN}Frontend Web:${NC}        http://localhost:3000"
echo -e "  • ${CYAN}API & Swagger:${NC}       http://localhost:8000/docs"
echo -e "  • ${CYAN}n8n Workflows:${NC}       http://localhost:5678"
echo -e "  • ${CYAN}Ollama Engine:${NC}       http://localhost:11434"
echo ""
echo -e "  ${BOLD}Perfil IA Activo:${NC}         ${GREEN}${CHOSEN_MODEL}${NC} (${TOTAL_RAM_GB} GB RAM detectados)"
echo ""
echo -e "  ${BOLD}Comandos de Gestión Útiles:${NC}"
echo -e "  • Ver logs en tiempo real:   ${YELLOW}docker compose -f docker-compose.minipc.yml logs -f${NC}"
echo -e "  • Detener el servidor:       ${YELLOW}docker compose -f docker-compose.minipc.yml stop${NC}"
echo -e "  • Reiniciar el servidor:     ${YELLOW}docker compose -f docker-compose.minipc.yml restart${NC}"
echo -e "  • Ampliar a 48GB (Qwen 32B): ${YELLOW}./setup-minipc.sh --upgrade-48gb${NC}"
echo ""
echo -e "  ${PURPLE}Para conectar el Frontend en Vercel con este MiniPC, consulta:${NC}"
echo -e "  docs/GUIA_INSTALACION_MINIPC.md (Sección Cloudflare Tunnel)"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════${NC}\n"
