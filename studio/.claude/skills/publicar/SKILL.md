---
name: publicar
description: Kike revisa y aprueba piezas de Instagram ya producidas y se publican o programan por la API oficial de Meta (meta/ig.mjs). Úsala con «/publicar <proyecto>», «aprueba la 01 y la 03», «publica la pieza X ahora», «qué tengo pendiente de publicar».
argument-hint: "<proyecto> [pieza…] [ahora]"
---

# /publicar · revisión de Kike y publicación oficial

Solo publica lo que **Kike ha aprobado en esta conversación**, pieza a pieza. Nunca por iniciativa propia.

## 1. Qué hay pendiente
`node meta/ig.mjs pendientes --proyecto <p>` (desde la raíz del estudio). Enseña la lista con estado y hora.

## 2. Revisión
Para cada pieza que Kike quiera ver: muestra la portada o las diapositivas (Read de las imágenes), el pie entero y la hora
programada. Si pide cambios, aplícalos (o encárgaselos al agente que corresponda), vuelve a validar y vuelve a enseñar.

## 3. Aprobación
Solo con un sí explícito de Kike para esa pieza («aprobada», «publica la 02»…):
- `node meta/ig.mjs validar <carpeta>` sin errores.
- **Si el pie pide «comenta X»** (o `pieza.json` trae `"palabra_clave"`): comprueba con
  `node ../bot/scripts/regla.mjs listar --proyecto <p>` que hay una regla activa con esa palabra. Si no la hay, propón el
  `regla.mjs crear …` (tema, enlace real y 3-4 puntos que existan de verdad en la página), enséñale la fila a Kike y
  guárdala con `--si` solo si dice que sí. Sin regla no se aprueba: los comentarios se quedarían sin respuesta. Si el
  bot aún no está desplegado (`../bot/README.md`), avísalo y que Kike decida si publica igual.
- En `pieza.json`: `"estado": "aprobado"`, `"aprobado_por": "Kike"`, `"aprobado_en": "<ISO ahora>"`. Si cambia la hora, `programado`.
- Añade lo que haya corregido Kike a `proyectos/<p>/voz.md` («Ejemplos aprobados» o «No»), para que el equipo aprenda.

## 4. Publicación
- **Programada**: no hagas nada más. La tarea de Windows «InstagramStudio-tick» ejecuta `node meta/ig.mjs tick` cada
  10 minutos y la publica a su hora (el ordenador tiene que estar encendido). Si la tarea no existe, avisa y ofrece
  `meta\programar-tarea.ps1`.
- **Ahora** (Kike lo pide así): `node meta/ig.mjs publicar <carpeta> --ahora`.
- Devuelve el enlace (`resultado.permalink` de `pieza.json`) o el error tal cual.

## Si algo falla
- Token caducado o ausente: `meta/README.md`, paso 3. No pidas el token en el chat: va en `proyectos/<p>/.env`.
- Límite o bloqueo de Meta: el publicador se pausa solo (1 h o 24 h). No reintentes en bucle.
- Contenedor en ERROR: el mensaje trae el motivo de Meta; suele ser el formato del vídeo (el publicador ya recomprime).
