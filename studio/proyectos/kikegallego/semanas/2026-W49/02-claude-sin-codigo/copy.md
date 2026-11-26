# 02 · claude-sin-codigo · copy del carrusel

- Formato: carrusel 4:5 (1080 x 1350), 7 diapositivas.
- Pilar: P2 · Automatiza lo que toca (y no lo que no).
- Acento de marca: **implementación** (fondo papel `#F5F6FA`, texto tinta `#141627`, **acento acción `#4F46E5`**, bloques destacados en acción suave `#EEF0FF`). En este acento el papel de «señal» lo hace el color **acción**: una sola palabra o frase por diapositiva.
- Tipografía: titulares en Space Grotesk; cuerpo en IBM Plex Sans; las frases que se le piden a Claude, en IBM Plex Mono dentro de un bloque `#EEF0FF`, como si fuera lo que se teclea. Monograma KG pequeño en una esquina.
- Regla de esta pieza: «sin coste» significa «sin coste extra sobre Claude». No se escribe «gratis».

---

## Diapositiva 1 · portada
- **Titular:** Tres cosas que pedirle a Claude mañana
- **Cuerpo:** En la oficina y sin tocar una línea de código.
- **Acento (acción):** «sin tocar una línea de código»
- **Visual:** solo texto, grande. Se tiene que leer en la miniatura.
- **Fuente:** gancho del `plan.md` (pieza 02); nivel `1` = «Sin código» en `guia-claude.ts` (`LEVEL_LABELS`).

## Diapositiva 2 · correo
- **Etiqueta (mono):** 1 · Gmail
- **Titular:** Lo que sigue sin contestar
- **Bloque de frase:** «Resúmeme los correos de clientes de esta semana que siguen sin respuesta.»
- **Cuerpo:** Claude busca, lee y resume tu correo.
- **Acento (acción):** «sin respuesta»
- **Fuente:** `guia-claude.ts`, entrada `gmail` (`example` y `what`).

## Diapositiva 3 · agenda
- **Etiqueta:** 2 · Google Calendar
- **Titular:** Un hueco sin ir y venir
- **Bloque de frase:** «Búscame una hora libre el jueves por la mañana para ver al gestor.»
- **Cuerpo:** Consulta tu agenda, encuentra huecos y crea o mueve citas.
- **Acento (acción):** «hora libre»
- **Fuente:** `guia-claude.ts`, entrada `google-calendar`.

## Diapositiva 4 · documentos
- **Etiqueta:** 3 · Google Drive
- **Titular:** El dato dentro del contrato
- **Bloque de frase:** «Busca el último contrato con este cliente y dime cuándo vence y con cuánto preaviso.»
- **Cuerpo:** Te contesta con lo que pone en tus documentos.
- **Acento (acción):** «cuándo vence»
- **Fuente:** `guia-claude.ts`, entrada `google-drive`. He quitado el final de su `what` («no con generalidades») para no caer en el giro «no es X, es Y».

## Diapositiva 5 · cómo se activa
- **Titular:** Ajustes → Conectores → Conectar
- **Cuerpo:** En claude.ai, busca Gmail, Calendar o Drive e inicia sesión. Acepta solo los permisos que vayas a usar.
- **Acento (acción):** «solo los permisos que vayas a usar»
- **Pie de diapositiva (pequeño):** Los tres, sin coste extra sobre Claude.
- **Visual:** los tres pasos como una ruta de botones (Ajustes, Conectores, Conectar), dibujados en el estilo de la marca. Nada de capturas de pantalla de claude.ai salvo que las haga Kike con su cuenta.
- **Fuente:** `guia-claude.ts`, `CONNECTOR_STEPS`; `cost: 'sin-coste'` en las tres entradas y `COST_LABELS` («Sin coste extra»).

## Diapositiva 6 · el límite (la de guardar)
- **Titular:** Lo mandas tú, después de leerlo
- **Cuerpo:** Claude te deja las respuestas preparadas para que las revises antes de mandarlas.
- **Acento (acción):** «las revises»
- **Pie de diapositiva (pequeño):** Guárdalo y pruébalo mañana con una de las tres.
- **Fuente:** `guia-claude.ts`, entrada `gmail` (`what`).

## Diapositiva 7 · cierre y llamada a la acción
- **Titular:** 48 fichas como estas, en 9 categorías
- **Cuerpo:** Es mi guía de Claude para negocios, explicada sin jerga. Escríbeme GUIA por privado y te la paso.
- **Acento (acción):** «GUIA»
- **Visual:** GUIA en mayúsculas, en color acción y en mono.
- **Fuente:** `guia-claude.ts` (48 entradas en `GUIDE_ENTRIES`, 9 en `GUIDE_CATEGORIES`, revisada el 17/11/2026); «sin jerga» de la descripción de `src/app/recursos/guia-claude-para-negocios/page.tsx`.

---

## Lo que no lleva esta pieza
Ni precios de Claude ni de sus planes (la guía no los da a propósito), ni la palabra «gratis», ni promesas de tiempo ahorrado.
