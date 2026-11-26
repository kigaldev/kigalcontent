# Autonomous Content Engine Web (Enterprise v2)

Sistema operativo multiagente para creadores y equipos de medios que automatiza el ciclo de vida completo del contenido digital: investigación empírica, priorización ICE, guionizado AV adaptativo, edición multimedia determinista acelerada por GPU, publicación multicanal con Human-in-the-Loop (HITL) y analítica de retroalimentación de bucle cerrado RMT-A.

---

## 🚀 Despliegue en Vercel (Frontend)

El frontend está desarrollado con **Next.js 15 (App Router, React 19)**, **Tailwind CSS v4**, **Remotion** y **Zustand**.

### Pasos para desplegar en Vercel:

1. **Importar Repositorio en Vercel:**
   - Conecta tu cuenta de GitHub y selecciona el repositorio `kigalcontent`.

2. **Configuración de Proyecto (Project Settings):**
   - **Opción recomendada:** En *Root Directory*, selecciona o escribe `frontend`.
   - **Opción directa (raíz):** Si dejas el *Root Directory* por defecto (`./`), el repositorio ya incluye un `vercel.json` y `package.json` en la raíz configurados con npm workspaces para construir el frontend automáticamente.
   - **Resolución de dependencias:** Se incluyen archivos `.npmrc` con `legacy-peer-deps=true` para garantizar la compatibilidad estricta entre React 19 y `@remotion/player`.

3. **Variables de Entorno (Environment Variables en Vercel):**
   - `NEXT_PUBLIC_API_URL`: URL base de tu backend FastAPI (ej: `https://api.tu-dominio.com` o URL de Cloud Run / Railway).
   - *Nota de resiliencia:* Si no configuras la variable o tu backend aún no está online, la plataforma entra en **Modo Studio Local** automáticamente con datos semilla reactivos para que la interfaz, el editor de guiones AV y el simulador 9:16 funcionen sin caídas.

---

## 📸 Instagram: estudio de contenido y bot de comentarios

- **`studio/`**: estudio de contenido de Instagram con Claude Code (equipo de agentes, skills `/semana`, `/publicar`,
  `/nuevo-proyecto`, un proyecto por cuenta en `studio/proyectos/`). Se trabaja abriendo Claude Code en `studio\`.
  Publica solo lo que Kike aprueba y solo por la API oficial (`studio/meta/ig.mjs`). Ver `studio/CLAUDE.md`.
- **`bot/`**: bot «comenta PALABRA y te lo mando» (Next.js en Vercel, proyecto propio con Root Directory `bot`). Usa la
  misma base de datos Supabase que el backend, en tablas `bot_*`, y su actividad se ve en el panel KigalChat. Ver
  `bot/README.md`.

---

## 🏗️ Topología del Repositorio

```
.
├── frontend/               # Next.js 15 + React 19 + Tailwind CSS v4 + Remotion
│   ├── src/app/            # App Router (layout, page, providers)
│   ├── src/components/     # Kanban FSM, Script Studio AV, Simulador 9:16, HITL Tier 3, RMT-A
│   ├── src/store/          # Zustand reactive state store
│   └── vercel.json         # Configuración Vercel específica de frontend
├── backend/                # Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2
│   ├── app/core/           # Seguridad HITL (HMAC-SHA256 tokens Tier 2/3) y settings
│   ├── app/workers/        # Media pipeline FFmpeg (EBU R128 -14 LUFS, silencedetect) + Whisper
│   ├── app/workflows/      # Flujos duraderos Temporal.io con compensación Saga
│   ├── app/services/       # Context Engine, ICE Scorer, Hook Vault, Conectores sociales
│   └── alembic/            # Migraciones PostgreSQL + pgvector
├── infra/                  # Kubernetes (KEDA GPU scaling), Cloud Run, LocalStack S3, Postgres
├── docker-compose.yml      # Entorno local multi-contenedor
├── vercel.json             # Configuración Vercel monorepo a nivel raíz
└── README.md
```

---

## 🖥️ Despliegue Local en MiniPC (24GB / 48GB RAM — Coste 0€)

Para ejecutar la plataforma en tu propio MiniPC como servidor 24/7 sin pagar cuotas por token a OpenAI ni Claude:

```bash
# Instalador automático en 1 comando (detecta RAM, Docker y descarga modelos Qwen + BGE-M3):
chmod +x setup-minipc.sh
./setup-minipc.sh
```

- **Guía completa paso a paso:** Consulta [`docs/GUIA_INSTALACION_MINIPC.md`](docs/GUIA_INSTALACION_MINIPC.md) para ver la arquitectura, conexión remota con Vercel vía Cloudflare Tunnel y flujos de n8n.

---

## 🧪 Verificación Local

- **Tests de Frontend:** `cd frontend && npm run build`
- **Tests de Backend (FastAPI + FFmpeg + HITL):** `cd backend && ./.venv/bin/pytest tests -v`
- **Tests del Motor Canónico:** `python3 -m unittest discover -s claude-content-engine-skill/tests -p "test_*.py" -v`
