# REA Clean-Room Architecture Specification: Metricool Publishing Engine & LinkedIn Ads Hub

> **Metodología:** Clean-Room Engineering (`rea-agents` pattern): Deconstrucción funcional por evidencia de interfaz/protocolo → Contrato de datos estricto → Reimplementación limpia sobre FastAPI + PostgreSQL + Next.js 15 + Meta Astryx UI + KigalContent HITL Tier 3.

---

## 1. Deconstrucción Funcional de Metricool (Planning & Autolists)

### 1.1 Superficies Principales Observadas
1. **Connected Channels Status Strip (Barra de Redes Conectadas)**
   - Muestra de un vistazo qué redes tienen credenciales activas (`En Vivo`, cuenta identificada, URN/ID) frente a canales en `Sandbox`.
   - Permite filtrar el calendario con un clic por plataforma (`LinkedIn`, `Instagram`, `TikTok`, `YouTube`).
2. **Planning Calendar (Planificador Multivista)**
   - Vistas conmutables: **Semana** (matriz 7 días × franjas horarias `08:00–22:00`, por defecto), **Mes** (grid mensual compacto) y **Lista** (cola cronológica).
   - **Drag & Drop Directo:** Arrastrar cualquier tarjeta de publicación a otro día u hora ejecuta una actualización parcial (`PATCH /publishing/schedule/{post_id}`) recalculando su `scheduled_at` UTC sin recargar la página.
   - **Click-to-Create en Celda Horaria:** Hacer clic en cualquier celda vacía abre el Compositor pre-configurado con la fecha, hora y zona horaria de esa celda.
   - **Diferenciación Visual por Estado:**
     - `SCHEDULED` + `auto_publish=true`: Badge cyan/emerald **Auto** (se despacha vía worker/cron).
     - `MANUAL_REMINDER` / `auto_publish=false`: Badge amber **Manual** (recordatorio para publicar a mano / copiar con formato).
     - `DRAFT`: Borrador editable sin fecha bloqueada.
     - `PUBLISHED`: Publicado en vivo con enlace canónico al post real.
     - `FAILED`: Error devuelto por la API oficial registrado en `publish_error` para corrección sin pérdida de copy.
     - **Slots Proyectados de Autolista:** Borde discontinuo violeta `♻️ Autolista` mostrando cuándo caerán las publicaciones evergreen si el hueco está libre.
3. **Best Time to Post Engine (Heatmap de Audiencia)**
   - Matriz `7 días × 24 horas` con puntuación `0–100`.
   - En KigalContent combina dos fuentes:
     - **Datos reales** de `PerformanceSnapshot` históricos registrados por el bucle cerrado RMT-A cuando existen.
     - **Curvas B2B / Creador calibradas por red** cuando aún no hay suficientes snapshots (p. ej. LinkedIn picos Mar–Jue `08:00–10:00` y `12:00–14:00`; Instagram `12:00–14:00` y `19:00–21:00`; TikTok `18:00–22:00`; YouTube Jue–Dom `17:00–21:00`).
   - El botón **"⚡ Próxima Mejor Hora"** selecciona automáticamente el siguiente slot con mayor puntuación futura respetando `timezone` IANA (`Europe/Madrid` por defecto).
4. **Split-Screen Post Composer (Modal `<dialog>` nativo)**
   - **Columna Izquierda (Editor):** Selector multicanal, toggle `Personalizar texto por red` (master copy vs variantes por canal), `RichTextToolbar` (negritas/cursivas Unicode, viñetas, emojis), selector de modo visual (`Solo Texto`, `Carrusel PDF`, `Imagen / Infografía`, `Video 9:16`), campo dedicado **Primer Comentario Automático de LinkedIn** (protección Zero-Link -60% alcance), y barra inferior de programación (`Programar`, `Guardar Borrador`, `Recordatorio Manual`, `Publicar Ahora`) + PIN HITL Tier 3.
   - **Columna Derecha (Vista Previa Nativa):** Previsualización Desktop / Móvil en tiempo real por plataforma con indicador de corte (`...ver más` a los 135 caracteres en LinkedIn y 120 en Instagram) y botón **Copiar con Formato** (`copyPreservingLineBreaks`).
5. **Autolists (Colas Evergreen Cíclicas)**
   - Repositorios temáticos con canales objetivo, franjas semanales configurables (`day_of_week` + `HH:MM`), switch `Activa` y switch `Modo Bucle (Repeat Loop)`.
   - Los elementos se pueden redactar desde cero o importar con 1 clic desde cualquier proyecto existente en KigalContent.

---

## 2. Mapeo Arquitectónico Clean-Room sobre KigalContent

| Componente Metricool | Implementación Clean-Room en KigalContent | Garantía / Seguridad |
| :--- | :--- | :--- |
| Scheduled Post Storage | Extensión de `social_posts` (`auto_publish`, `timezone`, `publish_error`, `autolist_id`) | Idempotente SQLite + PostgreSQL |
| Scheduler / Cron Worker | `publishing_scheduler.py` (`scheduler_background_loop` + `/publishing/scheduler/tick`) | Verifica firma **HITL Tier 3** con TTL largo (`scheduled_at + 7200s`, máx. 180 días) |
| LinkedIn First Comment | `LinkedInUGCConnector` llama `/rest/socialActions/{urn}/comments` si hay `first_comment` | Degradación segura si el token no tiene scope de comentarios |
| LinkedIn Ads & Ad Library | `linkedin_ads.py` consulta `GET https://api.linkedin.com/rest/adLibrary?q=criteria` + generador B2B | Nunca fabrica anuncios falsos como datos en vivo; 1 clic convierte anuncio en Idea Kanban |
| UI Design System | Meta **Astryx** (`@astryxdesign/core` + `@astryxdesign/theme-neutral`) + Tailwind v4 OLED Dark | Cero compilador StyleX obligatorio vía CSS precompilado + wrapper `AstryxPrimitives` |

---

## 3. Reglas de Seguridad HITL en Publicación Diferida

1. Toda publicación automática programada (`publish_mode="SCHEDULED"` con `auto_publish=true`) exige PIN HITL Nivel 3 en el momento en que el creador la programa.
2. El backend emite y firma un token HMAC-SHA256 (`HITL_AUTH_CREATOR_OK_<PID>_T3_<EXP>_<SIG>`) con expiración ajustada a `max(3600, min(180 * 86400, delta_hasta_scheduled + 7200))`.
3. Al llegar `scheduled_at`, el dispatcher valida criptográficamente el token antes de invocar al conector OAuth2 y registra el evento en `audit_logs`.
4. Si una prueba automatizada o cuenta en Sandbox ejecuta el tick, los conectores sin token real responden en `sandbox_verified` sin emitir tráfico externo de escritura.
