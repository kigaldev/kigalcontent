# Por qué Instagram te cierra la cuenta por automatizarla (y cómo evitarlo)

Por Gonzalo López · [@gonzalo_lopezg en Instagram](https://www.instagram.com/gonzalo_lopezg/)

*Escrito el 7 de noviembre de 2026. Meta cambia sus límites y sus normas: si algo de aquí no cuadra, tu Claude lo comprueba en su documentación.*

Si has comentado BOT, es esto: todas las causas de baneo que conozco por automatizar Instagram, cómo evitar cada una de forma técnica y un texto para que tu Claude revise tu bot entero contra ellas. Y de regalo, al final, la guía de cómo monté el mío.

Con la primera automatización que hice, Instagram me quitó la cuenta en mitad de la noche: «Confirma que eres una persona. Tu cuenta no es visible y no puedes usarla». Tenía 180 días para demostrarlo o la borraban para siempre. Mandé un vídeo de mi cara y me la devolvieron en menos de tres horas. A un chaval que me escribió no le fue tan bien: ganó 7.000 seguidores en dos semanas, le cerraron la cuenta por su propio bot y, cuando me escribió, llevaba dos semanas intentando recuperarla.

Desde entonces mi bot ha mandado más de 8.000 privados en diez días sin un solo aviso de Meta. Esto es lo que aprendí por el camino.

## Qué hay dentro

- Las 7 causas de baneo, de la que te cierra la cuenta seguro a la que solo te deja sin bot
- Cómo evitar cada una, con los números de Meta
- Qué hacer si ya te ha pasado
- El texto para que tu Claude revise tu bot y lo arregle contigo

## 1. Entrar en Instagram como si fueras tú

Es la causa número uno, y la más fácil de cometer sin saberlo. Cualquier cosa que use tu usuario y contraseña, o que maneje la app o la web por ti:

- Apps y webs que te piden la contraseña para ganar seguidores, ver quién te ha dejado de seguir o programar.
- Extensiones del navegador que dan likes, siguen o mandan privados.
- Librerías que se hacen pasar por la app (las «API no oficiales»).
- Una IA manejando instagram.com en tu navegador. A mí eso me hizo saltar un aviso de «Sospechamos que hay comportamientos automatizados en tu cuenta».

Las Condiciones de uso de Instagram lo prohíben: no puedes acceder ni recopilar información «de forma automatizada sin nuestro permiso expreso».

**Cómo evitarlo:** solo la API oficial de Meta, ya sea con una herramienta que la use (ManyChat es socio oficial de Meta) o con tu propia app en developers.facebook.com. Con la API tu bot nunca ve tu contraseña: usa un permiso (un token) que das tú y que puedes quitar cuando quieras. Y ninguna IA ni extensión tocando instagram.com por ti.

## 2. Escribir a quien no te ha escrito

La API oficial no te deja mandar privados en frío, y buscarle la vuelta es spam. Lo que sí permite:

- A quien te comenta, una sola respuesta privada por comentario, como mucho 7 días después del comentario.
- Lo siguiente, solo si esa persona te contesta o pulsa un botón, y dentro de las 24 horas desde su último mensaje.

**Cómo evitarlo:** que cada mensaje responda a algo que esa persona acaba de hacer (un comentario, un mensaje, un botón). Guarda a quién has contestado y por qué comentario, y nunca le escribas dos veces por lo mismo.

## 3. Sonar a robot

Meta busca patrones de spam: el mismo texto palabra por palabra cientos de veces, la misma respuesta pública debajo de cada comentario o contestar en el mismo segundo.

**Cómo evitarlo:**

- Cada privado en 3 versiones o más, y cada respuesta pública en 10, una al azar cada vez.
- Entre el privado y la respuesta pública, de 2 a 6 segundos al azar.
- Una respuesta por persona y palabra: si alguien comenta tres veces, le contestas una.
- Los enlaces, mejor en un botón que pegados en el texto, y nunca con acortadores tipo bit.ly. Quienes montan bots cuentan que Meta rechaza antes los privados con enlaces sueltos y desconfía de los acortadores, que usa mucho el spam.

## 4. Pasarte de volumen

Meta publica sus topes: 750 respuestas privadas por hora a comentarios de posts y reels, por cuenta. Y avisa de que te puede frenar si mandas demasiados mensajes a una misma conversación. Si un reel explota, tu bot llega a ese techo sin que te enteres. Y lo peor no es el primer error: es reintentar en bucle contra Meta.

**Cómo evitarlo:**

- Tus topes, por debajo de los suyos. Yo paro en 600 privados y 200 respuestas públicas por hora, y a una misma persona le llegan como mucho 12 mensajes automáticos al día.
- Lo que pasa del tope se guarda en una cola y sale después, dentro de los 7 días que da Meta.
- Si Meta contesta con un error de límite, el bot se para solo una hora. Si dice que algo es abusivo, un día entero.
- No todo error es un aviso: que alguien tenga los privados cerrados o que tu token haya caducado no es un freno de Meta, y no hace falta parar el bot por eso.

## 5. Una cuenta que no parece de una persona

Meta no solo mira lo que hace tu bot, también quién hay detrás. En la práctica, cuentan en contra una cuenta recién creada que empieza a automatizar a lo grande, entrar desde muchos sitios distintos o con VPN y una cuenta en la que nunca sale una cara.

**Cómo evitarlo (mis trucos):**

- La verificación en dos pasos, activada.
- El tick azul (Meta Verified) en cuanto llegues a una cifra seria de seguidores. Meta verifica tu identidad con tu documento y te da soporte con una persona si algo falla. Es de pago. Yo me lo puse la noche que el chaval me contó lo suyo.
- Sube vídeos con tu cara de vez en cuando. Así Meta ve que no eres un robot, y si te cierran la cuenta, la recuperas antes: para devolvértela te pide un vídeo selfie y lo compara con las fotos de tu perfil. Así recuperé la mía.
- Empieza poco a poco: una palabra en un reel, y que el volumen crezca con tus seguidores.
- Entra siempre desde tus dispositivos de siempre.

## 6. Hacer trampas para crecer

Aunque tu bot vaya perfecto, esto también cierra cuentas: comprar seguidores, likes o comentarios, los grupos para darse likes entre todos, seguir y dejar de seguir en masa, o dar dinero a cambio de seguir o comentar. Las normas de la comunidad de Instagram piden no conseguir de forma artificial me gusta, seguidores ni compartidos.

**Cómo evitarlo:** que lo que das por comentar sea contenido (una guía, un recurso, una plantilla), nunca dinero ni sorteos de dinero.

## 7. Descuidar tu app de Meta

Esta no te cierra la cuenta, pero te puede dejar sin bot de un día para otro. Meta restringe las apps que no cumplen sus condiciones, como tener una política de privacidad y una forma de borrar los datos que funcionen. Y si alguien encuentra tu token, puede mandar privados en tu nombre.

**Cómo evitarlo:** política de privacidad y URL de eliminación de datos que funcionen, contesta a lo que te pida Meta desde developers.facebook.com, y el token y el secreto de tu app nunca en el código ni en GitHub.

## Si ya te ha pasado

1. Para el bot entero. Nada de reintentar.
2. Si te pide confirmar que eres una persona, hazlo con el vídeo cuanto antes, aunque te den 180 días. A mí me la devolvieron en menos de tres horas.
3. Si te la han inhabilitado, recurre desde el propio aviso que te sale al entrar. Si te la han robado, desde instagram.com/hacked.
4. Cuando la recuperes, vuelve con topes más bajos y mira qué regla de aquí te saltaste.

## El texto para tu Claude

1. Abre Claude Code (o Codex) en la carpeta de tu bot.
2. Pega el texto entero.
3. Te dirá qué cumple y qué no, y lo arregla contigo, una cosa cada vez.

```
Eres mi revisor antibaneo de Instagram. Tengo un bot que contesta comentarios y manda privados desde mi cuenta. Revisa el código de esta carpeta contra la lista de abajo, punto por punto. De cada punto dime si cumple, si no cumple (con fichero y línea) o si no aplica. Después propón los arreglos de más grave a menos, uno cada vez, y espera mi sí antes de tocar nada. Lo que no puedas comprobar en el código (la configuración de mi app de Meta, mi cuenta), pregúntamelo. Si algo de aquí no cuadra con la documentación actual de Meta, dímelo con el enlace.

1. ACCESO
- Solo la API oficial (graph.instagram.com o graph.facebook.com) con un token. Nada que use mi usuario o mi contraseña, que maneje la web o la app (Playwright, Puppeteer, Selenium, extensiones) ni librerías no oficiales que imitan la app.
- El token y el secreto de la app, solo en variables de entorno o en la base de datos. Nunca en el código ni en GitHub: revisa también el historial de git.
- Los avisos que llegan de Meta (webhooks) comprueban la firma X-Hub-Signature-256 con el secreto de la app. Si no, cualquiera puede hacer que mi bot mande privados.

2. A QUIÉN SE ESCRIBE
- El primer privado es siempre una respuesta privada a un comentario (recipient con comment_id): una por comentario, y solo si el comentario tiene menos de 7 días.
- Lo siguiente, solo si esa persona me ha escrito o ha pulsado un botón, y dentro de las 24 horas desde su último mensaje.
- Nunca mensajes en frío, a listas ni a quien no ha hecho nada.
- Se guarda a quién se contestó y por qué comentario, para no repetir. Una respuesta por persona y regla cada 7 días.

3. QUE NO SUENE A ROBOT
- Cada privado en 3 versiones o más y cada respuesta pública en 10, una al azar cada vez.
- De 2 a 6 segundos al azar entre el privado y la respuesta pública, sin retrasar la respuesta 200 al webhook.
- Los enlaces, mejor en un botón que pegados en el texto, y nunca con acortadores (bit.ly y parecidos).
- Nunca decir en público "te lo he mandado" si el privado no salió.

4. VOLUMEN Y FRENOS
- Topes propios: como mucho 600 respuestas privadas y 200 respuestas públicas por hora en toda la cuenta (Meta corta en 750 privadas por hora), y 12 mensajes automáticos al día a una misma persona.
- Lo que pasa del tope va a una cola y sale después, dentro de los 7 días del comentario.
- Pausa automática guardada en la base de datos: 1 hora si Meta contesta con un error de límite (códigos 4, 17, 32 o 613, cualquiera de 80000 a 80099, o HTTP 429) y 24 horas si contesta con el 368 ("deemed abusive or is otherwise disallowed"). Mientras dure, no sale nada.
- Nunca reintentar en bucle contra Meta. Los errores que no son frenos (privados cerrados, 2534001; token caducado, 190) no paran el bot: se apuntan y se sigue.
- El token de larga duración se renueva solo antes de que caduque (60 días).
- Los topes y la pausa, como funciones puras con su test.

5. MI APP DE META
- Pregúntame si está publicada y si tiene política de privacidad y URL de eliminación de datos que funcionen.

6. LO QUE NO ES CÓDIGO
Al terminar, recuérdame en una lista corta lo que depende de mí: verificación en dos pasos; el tick azul cuando tenga bastantes seguidores; vídeos con mi cara de vez en cuando; empezar con poco volumen; no comprar seguidores ni dar dinero por seguir o comentar; entrar siempre desde mis dispositivos de siempre; y que ninguna IA ni extensión use instagram.com por mí.

Empieza leyendo la carpeta y dime en una línea qué hace mi bot, antes de revisar nada.
```

## Lo que yo saco de aquí

Un baneo no avisa: pasas de celebrar a no tener cuenta en una noche. Casi todo se evita con dos cosas, la API oficial y unos frenos por debajo de los de Meta. Lo demás (las versiones, tu cara, el tick) es que Meta vea que detrás hay una persona.

Para esta semana: pásale el texto de arriba a tu Claude, aunque tu bot ya funcione.

## De regalo: cómo monté mi bot

[Cómo construir tu propio ManyChat (gratis, con Claude Code)](https://gist.github.com/gonzalolopezgarcia/826773715cb043d2897e921f395d439b): el plan entero para montarlo con tu Claude, con estos frenos ya dentro.

Sígueme en Instagram ([@gonzalo_lopezg](https://www.instagram.com/gonzalo_lopezg/)).

Gonzalo López
