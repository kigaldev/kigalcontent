# Publicar en Instagram por la API oficial

`ig.mjs` publica carruseles, reels, reels de prueba, imágenes e historias **ya aprobados** por Kike, lee las métricas y
renueva el token. Usa solo la **API de Instagram con inicio de sesión de Instagram** (`graph.instagram.com`, v27.0) con tu
propia app de Meta: nada de navegador, contraseñas ni intermediarios.

Cómo funciona por dentro:
1. Convierte cada fichero al formato que acepta Instagram (PNG → JPEG; vídeo → H.264/AAC 1080x1920 si hace falta).
2. Lo sube a un alojamiento temporal (Vercel Blob, nombre aleatorio), porque Instagram descarga los ficheros de una
   URL pública: con este tipo de app no se pueden subir desde el ordenador.
3. Crea los contenedores, espera a que Instagram los procese, publica y **borra los temporales**.
4. Guarda el enlace en `pieza.json` (`resultado.permalink`).

Límites de Meta: 100 publicaciones por API cada 24 h, carruseles de hasta 20 elementos, pie de 2.200 caracteres y 5 hashtags.

---

## Puesta en marcha (lo haces tú, una vez · ~20 min)

### 1. Cuenta de Instagram profesional
`@kikegallego_` tiene que estar en modo **profesional** (creador o empresa) y ser **pública**.
Instagram › Configuración › Tipo de cuenta y herramientas › Cambiar a cuenta profesional.

### 2. App de Meta
1. https://developers.facebook.com › **Mis apps** › **Crear app**.
2. Nombre: `Instagram Studio`. En **Casos de uso** › **Todo** › **Administrar mensajes y contenido en Instagram**.
   No elijas «Otro»: no deja dar el permiso de publicar.
3. En **Empresa**: «Aún no quiero conectar un porfolio empresarial» › Crear app.
4. Dentro: caso de uso de Instagram › **Configuración de la API con inicio de sesión de Instagram**.
   Si solo ves «con inicio de sesión de Facebook», esa app ya es de Facebook: crea otra.
5. **Permisos**: comprueba que están `instagram_business_basic`, `instagram_business_content_publish`,
   `instagram_business_manage_insights` y `instagram_business_manage_comments` (este último, para la fase 3).

### 3. Token de la cuenta
1. En la misma pantalla: **Generar identificadores de acceso** › **Añadir cuenta** › inicia sesión con `@kikegallego_`.
   - Si pide un rol: **Roles de la app** › **Añadir personas** › **Evaluador de Instagram** › `kikegallego_`. Acepta en
     Instagram › Configuración › Apps y sitios web › Invitaciones de evaluador. Repite.
2. Copia el token y pégalo **en el fichero**, nunca en el chat:
   `C:\repos\kigalcontent\studio\proyectos\kikegallego\.env` → `IG_TOKEN=...`
   (copia antes `proyectos\kikegallego\.env.example` como `.env`).
3. Comprueba: `node meta\ig.mjs whoami --proyecto kikegallego` (debe salir `kikegallego_` y guarda `IG_USER_ID` solo).

El token dura 60 días; `tick` lo renueva cada semana.

### 4. Alojamiento temporal (Vercel Blob, gratis)
1. https://vercel.com › **Storage** › **Create** › **Blob** › nombre `instagram-studio`, acceso **Public**, región Frankfurt.
2. En el store › **.env.local** › copia `BLOB_READ_WRITE_TOKEN`.
3. Pégalo en `C:\repos\kigalcontent\studio\.env` (copia antes `.env.example` como `.env`).

Los ficheros solo existen unos minutos: se borran al publicar. Si alguno se queda (un error a medias), se ve en el store
y se puede borrar a mano.

### 5. Publicación programada
`powershell -ExecutionPolicy Bypass -File meta\programar-tarea.ps1`
Registra la tarea de Windows «InstagramStudio-tick», que cada 10 minutos publica lo aprobado cuya hora ha llegado.
Necesita el ordenador encendido y tu sesión iniciada. Registro en `meta\ig.log`.

---

## Uso diario
```powershell
node meta\ig.mjs pendientes --proyecto kikegallego     # qué hay sin publicar y en qué estado
node meta\ig.mjs validar <carpeta-de-pieza>            # comprueba formato, pie y hashtags
node meta\ig.mjs publicar <carpeta-de-pieza> --ahora   # publica ya una pieza aprobada
node meta\ig.mjs metricas --proyecto kikegallego       # guarda las métricas de los últimos 30 días
node meta\ig.mjs limite --proyecto kikegallego         # cuántas publicaciones por API llevas en 24 h
```
Lo normal es hacerlo hablando con Claude: `/publicar kikegallego`.

## pieza.json
```json
{
  "proyecto": "kikegallego",
  "tipo": "carrusel",
  "archivos": ["01.png", "02.png", "03.png"],
  "pie": "pie.md",
  "alt_text": ["Texto alternativo de la 1", "…"],
  "portada": "portada.jpg",
  "programado": "2026-12-01T20:00:00+01:00",
  "prueba": false,
  "estado": "borrador | en-revision | aprobado | publicando | publicado | error"
}
```
`tipo`: `carrusel`, `reel`, `imagen` o `historia`. En reels: `"prueba": true` lo sube como **reel de prueba** (solo lo ven
quienes no te siguen), `compartir_en_feed`, `thumb_offset_ms`, `audio_name` y `colaboradores` opcionales.

## Fase 3: respuestas a comentarios con palabra clave
Está en `../bot/` (carpeta `bot` de kigalcontent) (servidor en Vercel + Supabase, con los frenos de `docs/Como-construir-tu-propio-ManyChat.md`). Usa esta
misma app de Meta, añadiendo `instagram_business_manage_messages` y los webhooks de `comments` y `messages`. Puesta en
marcha y uso diario: `../bot/README.md`.

Si un reel o carrusel pide «comenta X», pon `"palabra_clave": "X"` en su `pieza.json`: `/publicar` comprueba que la
regla del bot existe antes de aprobarlo.
