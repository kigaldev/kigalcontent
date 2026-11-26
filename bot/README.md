# Bot de comentarios · «comenta PALABRA y te lo mando»

Parte del estudio de kigalcontent (`studio/`). Cuando alguien comenta una palabra clave (p. ej. `GUIA`) en una publicación, el bot:

1. le manda un privado con un botón «Ya te sigo» y contesta en público a su comentario;
2. cuando pulsa el botón (o escribe cualquier cosa), mira si te sigue;
3. si te sigue, le manda el enlace con UTM (`utm_source=instagram&utm_medium=dm`); si no, se lo vuelve a pedir.

También funciona si alguien te escribe la palabra por privado (mensaje de 8 palabras o menos).

**Multicuenta:** una sola instalación sirve para todas las cuentas del estudio. Cada aviso de Meta trae el id de la
cuenta y el bot usa su token y sus reglas.

Basado en la guía `docs/Como-construir-tu-propio-ManyChat.md`, con sus frenos desde el primer día:
- Solo la **API oficial** (graph.instagram.com, v27.0). Nada de navegador ni contraseñas.
- Topes propios por debajo de los de Meta: **600 privados y 200 respuestas públicas por hora** por cuenta, como mucho
  **12 mensajes automáticos por persona y día**, y una respuesta por persona y regla cada 7 días.
- Si Meta devuelve un error de límite, el bot se **pausa 1 hora**; si dice «abusivo» (368), **24 horas**. Nunca reintenta en bucle.
- Cada texto en 3 versiones (las respuestas públicas, en 10), una al azar, y de 2 a 6 s de espera antes de contestar en público.
- Nunca dice «te lo he mandado» si el privado no salió.

Piezas: Next.js en **Vercel** (plan Hobby) + **Supabase** (el de kigalcontent). Coste extra: 0 €.

---

## Puesta en marcha (una vez)

### 1. Supabase
No se crea un proyecto nuevo: el bot usa el proyecto Supabase de kigalcontent (el mismo de `DATABASE_URL`), en el esquema
`public`, con tablas de prefijo `bot_` (`bot_accounts`, `bot_rules`, `bot_processed_comments`, `bot_pending_follow`,
`bot_sent`, `bot_retry_comments` y la vista `bot_embudo_7d`). Así el panel de kigalcontent puede leerlas.
1. En ese proyecto, SQL Editor → ejecuta `supabase/migrations/0001_init.sql` (idempotente; no toca las tablas de kigalcontent).
2. Project Settings → API: copia la **URL** y la **service_role key** de ese mismo proyecto.

### 2. Vercel
1. Proyecto de Vercel propio con *Root Directory* = `bot` (`cd bot; npx vercel --prod` o desde el panel). No se añade a los
   `services` del `vercel.json` de la raíz: el de la raíz reescribe todo al frontend y el bot necesita sus crons propios.
2. Variables de entorno (Production), ver `.env.example`: `IG_APP_SECRET`, `IG_VERIFY_TOKEN`, `IG_API_VERSION`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Vuelve a desplegar.
3. Usa la **URL de producción** (`https://<proyecto>.vercel.app`): las de preview llevan protección y Meta recibiría un 401.

### 3. App de Meta «Reel Studio» (la misma que publica)
En *Configuración de la API con inicio de sesión de Instagram*:
1. Permisos: añade `instagram_business_manage_messages` y `instagram_business_manage_comments`.
2. Copia el **Instagram app secret** (el de la sección de Instagram, NO el secreto general de la app) → `IG_APP_SECRET`.
3. **Webhooks**: URL `https://<proyecto>.vercel.app/api/webhook`, token de verificación = `IG_VERIFY_TOKEN`.
   Suscribe los campos `comments` y `messages`.
4. En *Generar identificadores de acceso*, activa la **suscripción a webhooks** de la cuenta `@kikegallego_`.
5. La app tiene que estar **publicada (Live)**: Meta solo manda webhooks a apps publicadas. Pide icono, categoría y estas
   dos URL: `https://<proyecto>.vercel.app/privacidad` y `https://<proyecto>.vercel.app/eliminar-datos`.
6. Si la verificación pasa pero los comentarios no llegan: Meta documenta que el webhook de `comments` pide acceso
   avanzado. Con la app publicada y tu cuenta como evaluador suele bastar; si no, toca la revisión de la app (con el
   porfolio empresarial «Kigaldev Market» ya hecho, es el camino).

### 4. Conectar la cuenta y crear la primera regla (desde la raíz de kigalcontent)
Añade a `studio/.env` (la URL y la service_role key del proyecto de kigalcontent): `BOT_SUPABASE_URL` y `BOT_SUPABASE_SERVICE_ROLE_KEY`. Después:
```powershell
node bot\scripts\cuenta.mjs conectar --proyecto kikegallego
node bot\scripts\regla.mjs crear --proyecto kikegallego --palabra GUIA --tema "usar Claude en tu negocio" `
  --enlace https://kigaldev.com/recursos/guia-claude-para-negocios `
  --puntos "48 fichas por área|Prompts listos para copiar|Qué no delegar en la IA|Un kit para empezar hoy"
# revisa la fila que enseña y repite con --si para guardarla
```
Los textos de los puntos tienen que coincidir con lo que promete el reel y con lo que hay de verdad en la página.

### 5. Reloj de reintentos (cada 5 minutos)
SQL Editor → `supabase/migrations/0002_cron_reintentos.sql`, sustituyendo el `CRON_SECRET` y la URL. Si un reel se hace
viral y se pasa del tope, los comentarios que sobran salen en minutos. El reloj diario (Vercel Cron, 7:00 UTC) renueva
los tokens y limpia, y de paso mantiene despierto Supabase.

### 6. Prueba real
Desde una segunda cuenta de Instagram, en una publicación de `@kikegallego_`:
1. Comenta `GUIA` sin seguir → llega el privado con botón y la respuesta pública.
2. Pulsa el botón → «todavía no me sigues».
3. Sigue y pulsa → llega el enlace.
4. Comenta `GUIA` otra vez → no contesta.
Si algo no llega: Vercel → proyecto → Logs.

---

## Día a día
- **Cada reel con «comenta X»**: antes de publicarlo, crea la regla (`regla.mjs crear … --si`). Los primeros comentarios
  son los que más se ven. `/publicar` lo comprueba si la pieza lleva `"palabra_clave"` en `pieza.json`.
- `node bot\scripts\regla.mjs embudo`: por regla, cuántos recibieron el botón y cuántos el enlace en 7 días.
- `node bot\scripts\regla.mjs listar --proyecto kikegallego` · `desactivar --id N`.
- `node bot\scripts\cuenta.mjs pausar --proyecto kikegallego --horas 24` si quieres parar el bot.
- Petición de borrado de datos: `node bot\scripts\cuenta.mjs borrar-usuario --proyecto kikegallego --usuario <user>`.
- Tests: `cd bot; npm test` (palabras, frenos, firma del webhook).

El token vive en dos sitios (el `.env` del proyecto para publicar y la tabla `bot_accounts` del bot) y cada uno se renueva
solo. Si generas uno nuevo en Meta, actualiza los dos: el `.env` y `cuenta.mjs conectar`.
