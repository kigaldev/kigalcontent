---
name: autonomous-content-engine
version: 2.0.0
description: "Sistema Multiagente de Operacion Ecosistemica de Contenido para Claude Code v2. Gestiona el ciclo completo de vida del contenido digital con seleccion parametrica de duracion, Context Engine del creador para conversion, conexion directa a redes sociales mediante MCPs, copycrafting algoritmico con tips de viralizacion, Human-in-the-Loop estricto y analitica de bucle cerrado (RMT-A)."
author: "Arquitectura Senior de Sistemas Multiagente"
entrypoint: "agents/orchestrator.md"
tags:
  - content-strategy
  - multi-agent
  - mcp-automation
  - social-publishing
  - viral-copycrafting
  - youtube
  - tiktok
  - instagram-reels
  - linkedin
---

# AUTONOMOUS CONTENT ENGINE v2: SKILL PARA CLAUDE CODE

## 1. DESCRIPCION GENERAL Y OBJETIVO
Esta Skill dota a **Claude Code** de la capacidad de operar como una productora de contenido digital autonoma y un equipo de publicacion inteligente. Transforma ideas iniciales en piezas multimedia publicadas directamente en YouTube, Instagram Reels, TikTok y LinkedIn, adaptando dinamicamente la duracion, la densidad narrativa y las llamadas a la accion segun el contexto y modelo de negocio del creador [cite: 3, 4, 12, 14].

## 2. NOVEDADES EN LA VERSION 2.0
- **Selector Parametrico de Duracion:** Modulacion automatica del ritmo, palabras objetivo e interrupciones de patron (Micro-Short 15-30s, Standard Short 45-60s, Extended Short 90-180s, Long-Form 8-12m) [cite: 11, 20].
- **Context Engine del Creador (`creator_profile.json`):** Inyeccion de nicho, avatar (ICP), lead magnets y disparadores ManyChat para alinear la CTA al objetivo comercial activo (email capture, venta B2B, shares relacionales) [cite: 1, 3].
- **Publicacion Directa en Redes Sociales (MCP):** Conectores nativos con YouTube Data API, Meta Graph API, TikTok Content Posting API y LinkedIn API con validacion de prevuelo [cite: 3, 4, 8].
- **Copycrafting Algoritmico con Tips de Viralizacion:** Generacion de descripciones especificas para maximizar métricas clave:
  * *Instagram:* Hook <125 caracteres antes del corte, palabras clave SEO, disparador en DM y fomento de Sends per Reach (>2%) [cite: 4, 12].
  * *TikTok:* Optimizacion para TikTok Search y pregunta polarizante para disparar comentarios en los primeros 30 minutos [cite: 5, 16].
  * *YouTube:* Titulos <60 caracteres sin truncamiento movil, timestamps/capitulos y SEO en primeras 2 lineas [cite: 2, 20].
  * *LinkedIn:* Formato dwell-time, 2 lineas de hook, CERO enlaces en el cuerpo principal y enlace en el 1er comentario automatizado [cite: 14, 15, 19].

## 3. COMANDOS DISPONIBLES (SLASH COMMANDS)

| Comando | Agente Responsable | Accion Principal |
| :--- | :--- | :--- |
| `/content-pipeline <idea>` | `OrchestratorAgent` | Ejecuta el ciclo integral preguntando duracion y objetivo de conversion. |
| `/content-config` | `OrchestratorAgent` | Configura o actualiza el perfil del creador y el objetivo comercial activo. |
| `/content-research <tema>` | `ResearcherStrategist` | Investigacion, TAM, calculo ICE y Boveda de Ganchos (Hook Vault). |
| `/content-direct <brief_id>` | `DirectorScriptwriter` | Brief tecnico, guion a dos columnas adaptado a duracion y empaque A/B. |
| `/content-produce <media_dir>` | `PostproducerEditor` | Transcripcion Whisper, corte de silencios >400ms, normalizacion -14 LUFS y subtitulos. |
| `/content-publish-direct <id>` | `PublisherDistributor` | Validacion prevuelo, generacion de copys de viralizacion y publicacion MCP con token HITL Tier 3. |
| `/content-audit <window>` | `AnalyticsExperimenter` | Ingesta de metricas (24h/7d/30d), curvas de retencion, clasificacion RMT-A y bucle de memoria. |

## 4. GOBERNANZA DE SEGURIDAD (HITL)
- **Tier 1 (Autonomo Seguro):** Investigacion, calculo ICE, generacion de borradores, edicion local y consultas de analitica.
- **Tier 2 (Revision Estrategica):** Aprobacion del guion de rodaje y variantes de empaque A/B.
- **Tier 3 (Critico Irreversible):** Publicacion directa en redes sociales mediante APIs o eliminacion de archivos crudos. Requiere token explicito del creador (`HITL_AUTH_CREATOR_OK`).
