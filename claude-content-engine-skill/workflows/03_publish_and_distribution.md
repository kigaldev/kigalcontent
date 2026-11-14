# Workflow 03: Publicación Asistida, Conexión a Redes Sociales y Distribución Multicanal

Este flujo describe la conexión directa del sistema con las plataformas de redes sociales para publicar el contenido, optimizar descripciones y verificar la autorización humana de forma segura [cite: 3, 4, 8].

---

## Fases del Flujo de Publicación

### 1. Ingesta del Master Validado y Contexto
- El agente `PublisherDistributor` recibe el archivo audiovisual final de `./media_workspace/processed/master_video.mp4` certificado por el reporte de control de calidad `qc_report.json` [cite: 4, 8].
- Lee `./config/creator_profile.json` para recuperar el objetivo de conversión y los parámetros de marca [cite: 3].

### 2. Generación de la Matriz de Copycrafting Algorítmico (`scripts/social_publisher.py`)
- Se ejecutan los generadores específicos por plataforma aplicando las reglas de viralización:
  * **YouTube:** Título <60 caracteres, marcas de tiempo, SEO en primeros 150 caracteres [cite: 2, 20].
  * **Instagram:** Hook <125 caracteres antes de "...más", llamada a enviar por DM (*Sends per Reach*) y automatización de Lead Magnet [cite: 4, 12].
  * **TikTok:** Intención de búsqueda de TikTok Search y pregunta polarizante para la primera media hora [cite: 5, 16].
  * **LinkedIn:** Formato de espaciado limpio para *dwell time*, cero enlaces en el cuerpo principal y enlace en el 1er comentario [cite: 14, 15, 19].

### 3. Validación de Pre-Vuelo (Preflight Checks)
- Comprobación de que no existan enlaces en el cuerpo de LinkedIn [cite: 15].
- Verificación de longitudes de títulos y primeras líneas en YouTube e Instagram [cite: 11, 26].
- Verificación de que el video cumple con la relación de aspecto de la plataforma (9:16 vertical o 16:9 horizontal).

### 4. Puerta de Seguridad Humana (Tier 3 HITL)
- El orquestador pausa la ejecución y presenta al usuario la matriz de copys y medios listos.
- La FSM entra en estado `HITL_PENDING_PUBLISH`.
- El usuario revisa en consola y emite el comando:
  ```text
  /publish-approve TOKEN=HITL_AUTH_CREATOR_OK_[ID]
  ```

### 5. Despliegue Mediante Servidores MCP
Una vez validado el token, el sistema ejecuta las llamadas nativas:
- **YouTube:** Invocación de `upload_video` en el servidor MCP `youtube_data`, estableciendo estado inicial `unlisted` o `scheduled` [cite: 11, 25].
- **Instagram:** Invocación de `publish_reel` en `meta_graph` adjuntando la portada y el copy generado [cite: 4, 12].
- **TikTok:** Invocación de `upload_tiktok_video` en `tiktok_marketing` con parámetros de duetos y comentarios activos [cite: 5, 16].
- **LinkedIn:** Invocación de `create_ugc_post` en `linkedin_api` y posterior ejecución de `add_comment` con el recurso destacado [cite: 15, 19].

### 6. Registro de Auditoría y Transición a Escucha Analítica
- Se guardan los IDs de publicación y las URLs canónicas en `.content_engine/logs/audit_trail.log` [cite: 3].
- La FSM transiciona a `PUBLISHED_LIVE`.
- Se programan las alertas de auditoría automática a las 24 horas, 7 días y 30 días para alimentar el bucle cerrado del agente analítico [cite: 4, 10].
