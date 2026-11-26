# Cómo construir tu propio ManyChat (gratis, con Claude Code)

Por Gonzalo López · [@gonzalo_lopezg en Instagram](https://www.instagram.com/gonzalo_lopezg/)

*Escrita el 5 de noviembre de 2026 y actualizada el 6 con los frenos. Meta cambia sus pantallas y sus límites: si algo de aquí no cuadra, tu Claude lo comprueba en su documentación.*

Si has comentado BOT, es esto: el plan entero para montar tu propio bot de «comenta una palabra y te lo mando», y los frenos para que Instagram no te cierre la cuenta por usarlo. Es el mismo que uso yo: en diez días ha mandado más de 8.000 privados a más de 4.000 personas, sin pagar nada y sin que Meta lo haya frenado ni una vez. Está pensado para pegárselo a tu Claude, con todo desgranado y con los palos que ya me he comido con Meta resueltos.

## Qué hay dentro

- Lo mínimo que necesitas para montarlo, y gratis
- Cómo funciona por dentro, en tres piezas
- El texto para pegar en Claude Code o Codex, que lo monta contigo paso a paso
- Los muros de Meta ya resueltos, y los frenos para que no te cierren la cuenta

## 1. Lo que vas a necesitar

- Tu cuenta de Instagram en modo profesional (creador o empresa).
- Una cuenta de Facebook. Meta la pide para entrar en developers.facebook.com, aunque no publiques nada en Facebook.
- Claude Code o Codex: escribe el código y lo sube por ti.
- Otra cuenta de Instagram para probarlo como si fueras un seguidor.
- Cuentas gratis de GitHub, Vercel y Supabase (entras con tu Google).

Una tarde para montarlo. Después, 2 minutos por reel.

## 2. Dónde va a vivir

Necesitas un servidor que funcione las 24 horas del día, aunque apagues el ordenador. Yo uso **Vercel**: su plan Hobby cuesta 0 $ al mes y Meta le avisa cada vez que alguien te comenta. Al lado, **Supabase** (también gratis) hace de libreta: tus palabras y a quién ya le has contestado.

Ojo con una cosa: el plan Hobby de Vercel es para uso personal y tiene topes al mes (1 millón de llamadas, 4 horas de CPU). A un bot como este le sobra; si un día se te queda corto o lo usas para un negocio, el plan Pro cuesta 20 $ al mes.

## 3. Una buena lógica detrás

Es lo más importante, y lo que se comunica con Meta:

1. Alguien comenta tu palabra. Meta avisa a tu bot al momento.
2. El bot mira si es una de tus palabras, suelta y sin importar mayúsculas ni tildes («Bot!!» sí, «robot» no).
3. Le escribe por privado con un botón «Ya te sigo» y le contesta en público («te lo he mandado por privado»).
4. Cuando pulsa el botón, mira si te sigue. Si te sigue, le manda tu enlace. Si no, se lo vuelve a pedir.

¿Por qué el botón? Instagram solo te dice si alguien te sigue cuando esa persona ya te ha escrito. Pulsarlo cuenta como escribirte.

## Los muros de Meta que ya me comí

Seguro que si le dices a Claude «móntame un bot para mis comentarios», lo acabas sacando. Pero antes vas a chocar con esto, y el texto de abajo ya lo trae resuelto:

- **El follow tarda en contar.** Si miras al momento, le dices «no me sigues» a quien acaba de seguirte. El bot mira tres veces (a los 3, 5 y 7 segundos). A mí eso me salvó a 130 personas en una semana.
- **Meta solo deja 750 respuestas privadas por hora.** Si un reel se hace viral, los que sobran se guardan y salen en minutos con un reloj cada 5 minutos.
- **El permiso de tu bot caduca a los 60 días.** Se renueva solo cada semana.
- **Supabase gratis se duerme** tras 7 días sin actividad. El reloj diario lo mantiene despierto.
- **Quien comenta tres veces recibe una sola respuesta**, y cada mensaje va en 3 versiones para que Instagram no lo vea como spam.
- **La app de Meta tiene que estar publicada** y tu Instagram como evaluador, o los comentarios no llegan.

## Los frenos, para que no te cierren la cuenta

Con la primera automatización que hice, Instagram me baneó la cuenta. Me la devolvieron después de mandarles un vídeo de mi cara, pero desde entonces me he comido mucho la cabeza con esto. Y no soy el único: un chaval me escribió hace unos días contándome que, después de ganar 7.000 seguidores en dos semanas, le cerraron la cuenta con su propio bot de privados.

Estas son las cuatro reglas que sigo. Van todas en el texto para tu Claude:

1. **Nada de robots que usan Instagram como si fueras tú.** Ni extensiones, ni programas que manejan la web o la app, ni apps que te piden la contraseña. Las Condiciones de uso de Instagram prohíben entrar o recopilar información «de forma automatizada sin nuestro permiso expreso». A mí me saltó un aviso de «comportamientos automatizados» por dejar a una IA usar Instagram desde el navegador.
2. **Todo por la API oficial de Meta**, la misma que usa ManyChat. Con ella solo puedes escribir a quien te ha comentado o te ha escrito: un privado por comentario, como mucho 7 días después, y lo siguiente solo si te contesta, dentro de sus 24 horas. Nunca un mensaje en frío.
3. **Que no suene a robot.** Cada privado en 3 versiones o más y cada respuesta pública en 10, una al azar. Y entre el privado y la respuesta pública, de 2 a 6 segundos: nadie contesta en el mismo segundo.
4. **Frenos por debajo de los de Meta.** Meta corta en 750 respuestas privadas por hora. Yo paro en 600 privados y 200 respuestas públicas por hora, y a una misma persona le llegan como mucho 12 mensajes automáticos al día. Si Meta contesta con un error de límite, el bot se para solo una hora; si dice que algo es abusivo, un día entero. Sin reintentar en bucle.

Y si un día Instagram te pide que confirmes que eres tú con un vídeo, hazlo: así recuperé la mía.

## El texto para tu Claude

1. Abre Claude Code (o Codex) en una carpeta vacía.
2. Pega el texto entero.
3. Contesta a lo que te pregunte, una cosa cada vez. Antes de escribir código te dirá qué va a montar y esperará tu sí.

```
Eres mi programador. Vamos a montar juntos mi propio "ManyChat" para Instagram: cuando alguien comenta una palabra en mis publicaciones, le mando por privado lo que he prometido, solo si me sigue. Es para MI cuenta de Instagram y nada más. Así lo tiene montado Gonzalo López (@gonzalo_lopezg) y le funciona: más de 8.000 privados a más de 4.000 personas en diez días, sin que Meta lo frene ni una vez. Lleva los FRENOS de abajo desde el primer día: son lo que evita que Instagram me cierre la cuenta.
CÓMO QUIERO QUE TRABAJES
- Pregúntame una cosa cada vez y espera mi respuesta antes de seguir. Empieza por mi nombre y mi @ de Instagram.
- Antes de escribir código, dime en 5 líneas qué vas a montar y espera mi sí.
- No soy técnico. Háblame en español sencillo, sin jerga.
- Tú escribes, pruebas y despliegas todo el código. Yo solo hago lo que tú no puedes: clics en webs con mi sesión (Meta, Vercel, Supabase, Instagram).
- Un paso cada vez. En cada clic dime la web, el botón exacto y qué debo ver después. Si el botón no se llama así, te mando una captura y lo resolvemos.
- No me pidas claves ni tokens en el chat: dime dónde pegarlos (variables de entorno de Vercel, o un .env.local que nunca se sube a git).
- La API de Meta cambia. Si algo de aquí no cuadra con su documentación actual, manda la documentación y avísame.
- Al terminar, enséñame el día a día (está al final).
LO QUE TIENE QUE HACER
1. Alguien comenta una palabra clave (ej. "GUIA") en cualquiera de mis publicaciones.
2. Le mando una respuesta privada a ese comentario con un botón "Ya te sigo", y contesto en público a su comentario ("@usuario te lo he mandado por privado!🤝").
3. Cuando pulsa el botón (o me escribe cualquier cosa), miro si me sigue:
 - Me sigue: le mando el mensaje con el enlace.
 - No me sigue: se lo digo y le vuelvo a poner el botón.
4. Si alguien me escribe la palabra por privado (mensaje corto), lo mismo desde el punto 3.
PIEZAS (todas gratis)
- Next.js (App Router, TypeScript) en Vercel, plan Hobby. Un solo proyecto. Ojo: Hobby es para uso personal y tiene topes al mes (1 millón de llamadas, 4 horas de CPU). A este bot le sobra; si un día se queda corto o lo usas para un negocio, Vercel Pro (20 $/mes).
- Supabase (Postgres, plan Free), solo desde el servidor con la service role key (@supabase/supabase-js).
- "Instagram API with Instagram Login": host https://graph.instagram.com, versión v23.0 (o la vigente). No necesita página de Facebook.
- Primero sin panel: las reglas las edito en el Table Editor de Supabase. El panel va después, por fases (al final).
- Una sola cuenta: nada de OAuth para terceros. El token lo genero en el panel de Meta.
ORDEN DE TRABAJO
Paso 1. Comprueba conmigo, una cosa cada vez, que tengo: Instagram en cuenta profesional, una cuenta de Facebook para entrar en developers.facebook.com, cuentas de GitHub, Vercel y Supabase, Node instalado y una segunda cuenta de Instagram para probar.
Paso 2. Esqueleto desplegado en Vercel ANTES de tocar Meta (Meta necesita la URL para verificar el webhook y para publicar la app):
 - /privacidad y /eliminar-datos: páginas sencillas (qué guardo: el id y el usuario de Instagram de quien comenta, solo para no repetir; cómo pedir el borrado: escribiéndome por privado).
 - /api/webhook con el GET de verificación.
 - Usa la URL de producción (https://NOMBRE.vercel.app). Las de preview llevan protección y Meta recibiría un 401.
Paso 3. Supabase: proyecto en región Europa y las tablas de abajo. Mete la primera regla con los textos de ejemplo (yo cambio la palabra y el enlace).
Paso 4. App de Meta (guíame clic a clic):
 a. developers.facebook.com › Mis apps › Crear app. En Casos de uso › Todo, elige «Administrar mensajes y contenido en Instagram». Nunca «Otro»: crea la app en la experiencia antigua y luego no deja dar los permisos. Si no tienes porfolio de empresa, el paso de requisitos dice «No hay requisitos»: sigue.
 b. En "Configuración de la API con inicio de sesión de Instagram":
 - Roles de la app: añadir mi Instagram como "Evaluador de Instagram". Acepto la invitación en instagram.com › Configuración › Permisos de aplicaciones y sitios web.
 - Generar el token de mi cuenta (generar identificadores de acceso › añadir cuenta) y activar ahí la suscripción a webhooks de esa cuenta.
 - Copiar el "Instagram app secret" (el de la sección de Instagram, NO el secreto general de la app de Meta: con el otro la firma del webhook no cuadra).
 - Webhooks: URL https://NOMBRE.vercel.app/api/webhook y un token de verificación inventado. Suscribir los campos "comments" y "messages".
 - Permisos: instagram_business_basic, instagram_business_manage_comments, instagram_business_manage_messages. Con acceso estándar valen para mi cuenta porque tiene rol en la app.
 c. Publicar la app (modo Live): Meta solo manda webhooks a apps publicadas. Pide icono, categoría, URL de privacidad y URL de eliminación de datos. Si pide verificar el negocio, para y dímelo.
 d. Sacar mi IG_USER_ID: GET https://graph.instagram.com/v23.0/me?fields=user_id,username con el token. Es "user_id", NO "id": "id" es otro número y los webhooks no casarían con nada.
 e. Si la verificación del webhook pasa pero no llegan los comentarios: la documentación de Meta dice que los avisos de "comments" piden acceso avanzado. Con la app publicada y mi cuenta como evaluador, en la práctica llegan (así le funciona a Gonzalo con acceso estándar). Si tras revisar todo lo anterior no llegan, dímelo y preparamos la revisión de Meta.
Paso 5. El código (abajo).
Paso 6. Prueba real (abajo).
Paso 7. Enséñame el día a día (abajo).
Paso 8. Cuando te diga que todo funciona: el panel, fase a fase (EL PANEL, abajo).
VARIABLES DE ENTORNO (en Vercel)
IG_USER_ID, IG_ACCESS_TOKEN (solo para sembrar la tabla settings la primera vez; después el token vive allí), IG_APP_SECRET, IG_VERIFY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET y, con el panel, PANEL_PASSWORD.
TABLAS
create table settings (
 id int primary key default 1,
 access_token text not null,
 token_refreshed_at timestamptz not null default now(),
 paused_until timestamptz -- la pausa de los FRENOS; null = funcionando
);
create table rules (
 id serial primary key,
 name text not null,
 enabled boolean not null default true,
 keywords text[] not null, -- ej. {GUIA}
 post_id text, -- null = todas mis publicaciones
 follow_prompts text[] not null, -- 1.er privado, con el botón
 not_following_replies text[] not null, -- si pulsa y no me sigue
 reward_messages text[] not null, -- lo prometido, con el enlace
 public_replies text[] not null, -- respuesta bajo su comentario
 created_at timestamptz not null default now()
);
create table processed_comments (
 comment_id text primary key, ig_user_id text, username text, rule_id int,
 created_at timestamptz not null default now()
);
create table pending_follow (
 ig_user_id text primary key, rule_id int not null, username text,
 created_at timestamptz not null default now()
);
create table sent (
 id bigserial primary key, ig_user_id text not null, username text, rule_id int not null,
 kind text not null, -- prompt | not_following | reward
 created_at timestamptz not null default now()
);
create table retry_comments (
 comment_id text primary key, ig_user_id text, username text, rule_id int,
 comment_created_at timestamptz not null,
 created_at timestamptz not null default now()
);
Activa RLS en todas, sin políticas: solo entra el servidor con la service role.
TEXTOS DE EJEMPLO PARA LA PRIMERA REGLA ({username} = su usuario)
follow_prompts:
- Hola {username}! 👋 Pulsa el botón y te lo mando. Eso sí, tienes que seguirme 🤝
- Buenas {username}! Te lo paso ahora mismo, solo tienes que seguirme y darle al botón 👇
- Hey {username}! 🙌 Sígueme y pulsa el botón de abajo, que te lo mando al momento
not_following_replies:
- Casi lo tienes {username}! 🙌 Sígueme y vuelve a pulsar el botón
- Todavía no me sigues! Dale a seguir y pulsa otra vez, que te lo mando 🤝
- Uy, aún no me sale tu follow. Sígueme y vuelve a darle 👇
reward_messages (los 4 puntos son los de "Qué hay dentro" de la guía; cada versión cambia el saludo, la entradilla y el cierre):
- Hola {username}! 👋
 Aquí tienes la guía para TEMA 🤝
 Dentro tienes:
 • PUNTO 1
 • PUNTO 2
 • PUNTO 3
 • PUNTO 4
 👉 ENLACE
 Cualquier duda me dices!
- Buenas {username}! 🙌 / Te paso la guía para TEMA / Lo que vas a encontrar: (los 4 puntos) / 👉 ENLACE / Si te atascas me escribes!
- Hey {username}! Aquí va 🤝 / Te dejo la guía para TEMA / Te he puesto: (los 4 puntos) / 👉 ENLACE / Ya me contarás qué tal te va!
public_replies (10 como mínimo: escribe 5 más con este mismo tono):
- @{username} te lo he mandado por privado!🤝
- @{username} mira tus mensajes, ya te lo he pasado 🙌
- @{username} te escribo por privado!🤝
- @{username} enviado! Revisa el privado 👀
- @{username} ahí lo tienes, en tus mensajes 🤝
Si no hay username, quita el hueco sin dejar "Hola !" ni una @ suelta.
EL WEBHOOK: app/api/webhook/route.ts
- GET: si hub.mode == "subscribe" y hub.verify_token == IG_VERIFY_TOKEN, devuelve hub.challenge en texto plano con 200. Si no, 403.
- POST: lee el cuerpo en bruto (await req.text()) y verifica la cabecera X-Hub-Signature-256 == "sha256=" + HMAC-SHA256(cuerpo, IG_APP_SECRET) en hex, comparando con timingSafeEqual. Si no cuadra, 401. Si cuadra, responde 200 al momento y procesa dentro de after() de next/server. Meta desactiva el webhook si falla a menudo: un evento que da error se loguea, nunca se devuelve 500.
- Comentarios: entry[].changes[] con field == "comments". value = { id, text, from: { id, username }, media: { id }, parent_id? }. Ignora si from.id == IG_USER_ID (mis propias respuestas también llegan como comentarios).
- Mensajes: entry[].messaging[] = { sender: { id }, recipient: { id }, timestamp, message?: { mid, text, is_echo?, quick_reply?: { payload } } }. Ignora is_echo == true, sender.id == IG_USER_ID y los eventos sin message (lecturas, reacciones).
CUÁNDO ENCAJA UNA PALABRA (función pura en lib/match.ts, con su test)
- Normaliza texto y palabra: normalize("NFD"), quita U+0300 a U+0302 y U+0308 (tildes, circunflejo y diéresis) pero NO U+0303 (la virgulilla de la ñ: "año" no puede encajar con "ano"), y toLowerCase().
- Palabra suelta, nunca dentro de otra: new RegExp("(^|[^\\p{L}\\p{M}\\p{N}])" + palabraEscapada + "($|[^\\p{L}\\p{M}\\p{N}])", "u").
- Con la palabra GUIA: encaja "guía!!", "Guia 🙌", "quiero la guia". No encaja "guias" ni "seguía".
- Orden: primero las reglas con post_id de esa publicación, después las generales (post_id null). Solo las enabled.
- Por privado, solo si el mensaje tiene 8 palabras o menos: en uno largo la palabra va de paso y no quiero cortar una conversación.
AL LLEGAR UN COMENTARIO
0. Si settings.paused_until es futuro, o se ha llegado a un tope de los FRENOS: guarda el comentario en retry_comments y sal.
1. Busca la regla que encaja. Si no hay, sal.
2. Inserta en processed_comments, con from.username (on conflict do nothing). Si ya estaba, sal: Meta a veces entrega el mismo evento dos veces.
3. Si en sent hay esa persona + regla en los últimos 7 días, sal: comentar dos veces da una sola respuesta.
4. Respuesta privada al comentario (Meta deja UNA por comentario, y como mucho 7 días después del comentario):
 POST https://graph.instagram.com/v23.0/{IG_USER_ID}/messages
 Authorization: Bearer {token de settings}
 { "recipient": { "comment_id": "{id del comentario}" },
 "message": { "text": "{un follow_prompt al azar}",
 "quick_replies": [ { "content_type": "text", "title": "Ya te sigo", "payload": "FOLLOW_CHECK" } ] } }
 Límites de Meta: texto 1.000 caracteres, título del botón 20.
 - Si falla con el botón, reintenta sin quick_replies: escribir cualquier cosa vale igual que pulsar.
 - Si falla por límite de llamadas (Meta: 750 respuestas privadas por hora y cuenta): activa la pausa de los FRENOS, guarda en retry_comments y sal sin contestar en público.
5. Si salió: upsert en pending_follow (ig_user_id, rule_id, username) e inserta en sent (kind = prompt).
6. SOLO si el privado salió, espera entre 2 y 6 s al azar y responde en público con un public_reply al azar:
 POST https://graph.instagram.com/v23.0/{id del comentario}/replies con { "message": "..." }
Cada llamada en su try/catch: un fallo no tumba el resto.
AL LLEGAR UN MENSAJE
- Si el que escribe está en pending_follow (pulsó el botón o escribió algo): comprueba el follow.
- Si no lo está y su texto corto encaja con una regla: crea pending_follow y comprueba el follow ya (como acaba de escribirme, Meta ya puede decirlo).
COMPROBAR EL FOLLOW
- GET https://graph.instagram.com/v23.0/{IGSID}?fields=is_user_follow_business
 Meta solo lo contesta si esa persona ya me ha escrito: por eso existe el botón.
- El follow recién dado tarda en contar. Si dice false, espera 3 s y vuelve a mirar, luego 5 s, luego 7 s. Solo un false repetido es un no. Si devuelve null o da error, trátalo como sí (la persona hizo lo que le pedí; el fallo es de Meta). Dato real de Gonzalo: de 781 pulsaciones en una semana, 179 dieron "no me sigue" a la primera y 130 de esas personas sí le seguían entre 4 y 26 s después.
- Sí: POST https://graph.instagram.com/v23.0/{IG_USER_ID}/messages con { "recipient": { "id": "{IGSID}" }, "message": { "text": "{un reward_message al azar}" } }. Borra de pending_follow e inserta en sent (kind = reward).
- No: manda un not_following_reply al azar con el mismo botón. Se queda en pending_follow. Inserta en sent (kind = not_following).
(Estamos dentro de las 24 h que da Meta para contestar a quien te ha escrito.)
DOS RELOJES
A) Cada día (Vercel Cron; el plan Hobby solo deja uno al día):
vercel.json: { "crons": [ { "path": "/api/cron/daily", "schedule": "0 7 * * *" } ] }
/api/cron/daily comprueba la cabecera Authorization: Bearer {CRON_SECRET} (Vercel la manda sola) y hace dos cosas:
1. Renueva el token si se renovó hace más de 7 días:
 GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}
 Guarda el nuevo en settings. El token dura 60 días y solo se puede renovar si tiene más de 24 h.
2. Mantiene Supabase despierto: el plan gratis pausa el proyecto tras 7 días con poca actividad. La consulta del punto 1 ya cuenta.
B) Cada 5 minutos (Supabase Cron + pg_net, gratis): llama a /api/cron/reintentos con la misma cabecera, que reintenta retry_comments cuyo comment_created_at sea de hace menos de 7 días (después Meta ya no deja la respuesta privada) y borra las más viejas. Así, si un reel se hace viral y pasas de 750 privados en una hora, los que sobran salen en minutos y no al día siguiente. Si Supabase Cron te da guerra, déjalo en el reloj diario y avísame.
ANTI-SPAM (no negociable)
- Cada texto en 3 versiones o más, una al azar cada vez: el mismo mensaje cientos de veces es lo que Instagram marca como spam.
- Una respuesta por persona y regla cada 7 días.
- Nunca decir en público "te lo he mandado" si el privado no salió.
FRENOS (no negociable: es lo que evita que Instagram me cierre la cuenta)
- Solo la API oficial de Meta. Nada que entre en Instagram con mi contraseña, que maneje la web o la app, ni extensiones: las Condiciones de uso de Instagram prohíben el acceso automatizado sin su permiso.
- Topes propios por debajo de los de Meta: como mucho 600 privados y 200 respuestas públicas por hora en toda la cuenta (cuenta las filas de sent con kind = prompt de la última hora). Al llegar al tope, el comentario va a retry_comments y sale en la siguiente vuelta del reloj de 5 minutos.
- A una misma persona, como mucho 12 mensajes automáticos en 24 horas (cuenta sus filas en sent). Pasado eso, ese día no se le contesta más: es un bucle o alguien jugando con el botón.
- Pausa automática. Si Meta contesta con un error de límite (códigos 4, 17, 32 o 613, cualquier código de 80000 a 80099, o HTTP 429), guarda settings.paused_until = ahora + 1 hora. Si contesta con el código 368 («deemed abusive or is otherwise disallowed»), ahora + 24 horas. Mientras dure, no se manda nada: los comentarios van a retry_comments y el reloj de reintentos espera a que pase. Nunca reintentar en bucle contra Meta. Escribe esta comprobación como función pura en lib/freno.ts, con su test.
- La espera de 2 a 6 s antes de la respuesta pública va dentro de after(), sin bloquear la respuesta 200 a Meta.
PRUEBA REAL
- Test de lib/match.ts con los ejemplos de arriba (con ñ y tildes).
- Desde mi segunda cuenta de Instagram (no necesita rol en la app), en una publicación mía:
 1) Comentar GUIA sin seguirme: llega el privado con botón y la respuesta pública.
 2) Pulsar el botón: dice que no te sigo.
 3) Seguir, pulsar: llega el enlace.
 4) Comentar GUIA otra vez: no contesta.
- Si algo no llega, mira conmigo Vercel › proyecto › Logs.
CADA REEL NUEVO CON "COMENTA X" (te lo pediré a menudo)
Solo cuando te diga que el vídeo está aprobado o ya programado, nunca antes. Te pasaré lo que digo en el vídeo (transcripción o texto) y la palabra.
1. Comprueba que la palabra no está ya en rules, ni una parecida (GUIA y GUIAS): los reels viejos siguen recibiendo comentarios.
2. Escribe la guía en Markdown, en español, sobre lo que digo en el vídeo, con mis ejemplos y en mi orden; después mejórala. Formato:
 - Título, y debajo: "Si has comentado PALABRA, es esto:" + lo que prometí en el vídeo, entregado en ese mismo párrafo.
 - Mi firma bajo el título: "Por NOMBRE · @MI_USUARIO en Instagram", enlazada a mi perfil.
 - "Qué hay dentro": 4 puntos, cada uno algo que podrá hacer.
 - "Qué necesitas" y los pasos numerados; lo que se copia, en bloques de código.
 - "Lo que yo saco de aquí": mi opinión en primera persona, y algo para usar esta semana.
 - Cierre: "Sígueme en Instagram (@MI_USUARIO)" y mi nombre.
 - Si lo que mando es un prompt, que el Claude de quien lo pegue pregunte una cosa cada vez y espere la respuesta.
 - Un solo problema, resuelto entero. Nada que yo no diga o que no se pueda comprobar. Sin rayas largas.
3. Enséñamela entera y espera mi sí.
4. Súbela como gist secreto: gh gist create --desc "TÍTULO" guia.md (la primera vez, gh auth login). Guarda el enlace.
5. Crea la fila en rules: name, keywords {PALABRA}, reward_messages en 3 versiones con el esquema de arriba y los 4 puntos de la guía, y follow_prompts, not_following_replies y public_replies copiados de la regla anterior. Enséñame la fila antes de guardarla.
6. Todo esto, antes de que el reel salga: los primeros comentarios son los que más gente ve.
AL TERMINAR, ENSÉÑAME
- Cambiar un texto a mano: Supabase › Table Editor › rules. Y el día a día de arriba: "este reel está aprobado, te paso lo que digo, la palabra es X".
- Una consulta guardada en el SQL Editor de Supabase: por regla, en los últimos 7 días, cuántas personas recibieron el botón (kind = prompt) y cuántas el enlace (kind = reward).
- Dónde mirar si algo falla: Vercel › proyecto › Logs.
LO QUE NO QUIERO
- Nada que use mi contraseña de Instagram ni que maneje la web o la app por mí: solo la API oficial.
- Pantallas, logins, librerías ni funciones que no estén aquí. El panel para verlo todo es otro paso: no lo montes hasta que te lo pida.
- Guardar de la gente más de lo necesario.
Empieza preguntándome mi nombre y mi @ de Instagram, y luego el paso 1.
```

## Lo que yo saco de aquí

En mi cuenta, 9 de cada 10 comentarios por vídeo ya son la palabra clave. Y como para llevarse la guía te tienen que seguir, cada comentario hace que el vídeo llegue a más gente y convierte a esa gente en seguidores. Es un bucle que se alimenta solo y que hace crecer tu cuenta.

Pero un bucle así solo sirve si la cuenta sigue viva. Por eso los frenos no son un extra: van desde el primer día.

Para esta semana: móntalo con una sola palabra y los frenos puestos, pruébalo con tu segunda cuenta y estrénalo en tu próximo reel.

## Lo siguiente

Cuando lo tengas funcionando, lo siguiente es un panel para ver en una página qué palabra trae más comentarios y más seguidores. Sígueme, que te lo enseño.

Sígueme en Instagram ([@gonzalo_lopezg](https://www.instagram.com/gonzalo_lopezg/)) para más guías como esta.

Gonzalo
