# Revisión interna · @kikegallego_ · semana 2026-W49

> Revisor, 25/11/2026, con contexto limpio. He leído `proyecto.md`, `marca.md`, `voz.md`, `memoria/`, `plan.md`,
> `investigacion.md` y las tres carpetas. He contrastado cada dato con `kigalweb/data/revisor.ts`, `enlaces.ts`,
> `pageLayers.ts`, `routes.tsx`, `seo.ts` y `kigaldevWeb/src/data/guia-claude.ts`, `checklist.ts`, la página de la guía,
> `KitTool.tsx`, `ChecklistTool.tsx` y `ChecklistLeadForm.tsx`. He abierto los 15 PNG y he pasado `node meta/ig.mjs validar`.
> No he tocado ninguna pieza.

## Resumen

| Pieza | Veredicto | Motivo principal |
|---|---|---|
| 01 · presupuesto-6-preguntas | **CAMBIOS** | `pie.md` se publicaría entero, notas internas incluidas |
| 02 · claude-sin-codigo | **BLOQUEADA** | «57 fichas» es falso: `GUIDE_ENTRIES` tiene **48** entradas. Además, el mismo problema de `pie.md` |
| 03 · lo-que-no-automatizaria (guion) | **CAMBIOS** | el mismo problema de `pie.md` y un texto en pantalla que exagera la fuente |

---

## Problema común a las tres: `pie.md` no es solo el pie

`meta/ig.mjs` (función `leerPie`, líneas 180-186) manda como pie **el fichero `pie.md` entero**, sin recortarlo. Hoy cada
`pie.md` lleva el título `# 0X · … · pie`, el `## Texto del pie (copiar tal cual)`, el separador y toda la sección «Para
el director y para Kike (no se publica)», con las respuestas por privado, las UTM y las notas de fuentes. Resultado de
`validar`:

- 01: «Válida», pero publicaría las notas internas (el fichero entero ocupa 2.193 caracteres y entra por poco en el límite).
- 02: «NO VÁLIDA: el pie tiene 2489 caracteres».
- 03: «NO VÁLIDA: el pie tiene 2612 caracteres» (y «archivos está vacío», esperable porque aún no hay vídeo).

Los pies de verdad miden 789 (01), 834 (02) y 1.009 (03) caracteres, con 5 hashtags cada uno: dentro de límites.

**Cambio exacto, en las tres carpetas:** dejar en `pie.md` solo el bloque que hay entre `## Texto del pie (copiar tal
cual)` y el `---` (sin el título ni el encabezado), y mover la sección «Para el director y para Kike (no se publica)» a un
fichero nuevo `notas.md` en la misma carpeta. Después, volver a pasar `node meta/ig.mjs validar <carpeta>`.

Recomendado (no bloquea): añadir `"alt_text"` en `pieza.json` de 01 y 02, una entrada por PNG, con el texto de la
diapositiva (lo admite `ig.mjs`, ver `meta/README.md`).

---

## 01 · presupuesto-6-preguntas · CAMBIOS

**Verdad: OK.** Contrastado frase a frase:
- Las seis etiquetas y las seis preguntas resumen son literales de `REVISOR_BLOCKS` (`revisor.ts`).
- Los cuerpos de las diapositivas 2-7 salen de q1, q4, q5, q7, q9 y q11, recortados sin cambiar el sentido.
- «12 preguntas, 6 bloques»: `QUESTION_IDS` y `REVISOR_BLOCKS`.
- «sin jerga», «un semáforo claro y qué preguntarle a tu proveedor», «Gratis»: los tres en `enlaces.ts`, entrada `revisor`.
- «Decidir mal en tecnología sale más caro que decidir despacio.» es literal de `pageLayers.ts:102`.
- La ruta `/revisor-de-presupuesto` existe (`routes.tsx:60`) y el dominio canónico es `https://www.kikegallego.com`.
  Ojo: está en `data/seo.ts`, no en `site.ts` como dice el plan; no afecta a la pieza.

**Reglas propias: OK.** No hay precios, clientes, ayudas públicas ni ningún CTA a un pago. «Es gratis» en el pie lo
permite `voz.md` («salvo lo que lo es de verdad»), y la fuente lo dice tal cual. Si Kike prefiere no usar la palabra en
el arranque de la cuenta, la alternativa es: «Es gratis.» → «No cuesta nada.». Decisión suya, no bloquea.

**Voz: OK.** No hay palabras de la lista «No», ni «no es X, es Y», ni cierres motivacionales, ni emojis. Tuteo
coherente y ortografía correcta.

**CTA y destino: OK.** Hay una sola llamada (PRESUPUESTO por privado), y la UTM de `pie.md` y de `pieza.json` coincide
con `plan.md`.

**Visual: OK.** Ocho PNG de 1080x1350, con el texto idéntico a `copy.md` y nada cortado. Contraste correcto sobre
`#0B0D10`. Hay un solo elemento en señal `#28D9FF` por diapositiva. El monograma es el SVG oficial
`kigaldev-monogram-console.svg` a 60x48 (proporción 100:80, sin deformar) y va en la misma esquina en todas.

**pieza.json: OK.** Estado `borrador`. `archivos` coincide con los 8 PNG. Lunes 30/11/2026 a las 20:00 `+01:00`, correcto
en diciembre (CET).

**Cambios:**
1. `pie.md`: el cambio común de arriba (solo el texto del pie; las notas a `notas.md`).

---

## 02 · claude-sin-codigo · BLOQUEADA

**Motivo del bloqueo (verdad):** la cifra «57 fichas» no tiene fuente. `GUIDE_ENTRIES` en
`kigaldevWeb/src/data/guia-claude.ts` tiene **48** entradas. El fichero tiene 57 líneas `id:` en total, pero 9 son de
`GUIDE_CATEGORIES`. Lo he comprobado con un recuento del array entre `export const GUIDE_ENTRIES` y su `]` de cierre, y
también por campo `category:` (48). La página muestra `GUIDE_ENTRIES.length`, así que en la web pone 48. El error viene
de `plan.md` («57 fichas en 9 categorías»). «9 categorías» sí es correcto (la página dice «9 temas»).

**Para desbloquear (cambios exactos):**
1. `copy.md`, diapositiva 7, titular: «57 fichas como estas, en 9 categorías» → «48 fichas como estas, en 9 categorías».
   En la línea de fuente, «57 entradas en `GUIDE_ENTRIES`» → «48 entradas en `GUIDE_ENTRIES`».
2. `_src/07.html` (o el texto de la diapositiva 7 en `_src/build.js`): «57» → «48». Volver a generar `slides/07.png`.
3. `pie.md`: «57 fichas, cada una con un ejemplo de qué pedirle y cómo se instala.» → «48 fichas, cada una con un ejemplo
   de qué pedirle y cómo se instala.» En las notas, que pasan a `notas.md`: «puede ver las 57 fichas» → «puede ver las
   48 fichas» y «57 entradas» → «48 entradas».
4. `pie.md`: el cambio común de arriba (solo el texto del pie; las notas a `notas.md`).
5. Para el estratega, fuera de la pieza: corregir «57 fichas» → «48 fichas» en `plan.md` y en `investigacion.md`
   (tabla 1), para que no se repita en otras semanas.

**El resto está bien:**
- **Verdad:** las tres frases de ejemplo y los cuerpos de las diapositivas 2-4 son literales de las entradas `gmail`,
  `google-calendar` y `google-drive`. A Drive se le ha quitado el «no con generalidades», bien hecho. Los pasos de la
  diapositiva 5 salen de `CONNECTOR_STEPS`, y «sin coste extra sobre Claude» de `cost: 'sin-coste'` y `COST_LABELS`.
  «Claude te deja las respuestas preparadas para que las revises antes de mandarlas» es literal del `what` de `gmail`.
  «sin jerga» sale de la `description` de `page.tsx`. «Sin tocar una línea de código» sale de `level: 1` («Sin código»).
- **Reglas propias:** no aparece «gratis» ni ningún precio, y no hay CTA a un pago.
- **Voz:** correcta y sin construcciones vetadas.
- **CTA y destino:** una sola llamada (GUIA). La URL con UTM y `origen` coincide con `plan.md`. La ruta existe y
  `KitTool.tsx` lee `?origen=`.
- **Visual:** siete PNG de 1080x1350, con el texto idéntico a `copy.md` y nada cortado. El titular de la 3 («Un hueco sin
  ir y venir») llega justo al margen derecho, pero no se corta. Hay un solo elemento en acción `#4F46E5` por
  diapositiva. El monograma es el oficial `kigaldev-monogram.svg` sobre claro, sin deformar.
- **pieza.json:** estado `borrador`, 7 archivos que existen, miércoles 02/12/2026 a las 14:00 `+01:00`.

---

## 03 · lo-que-no-automatizaria · CAMBIOS (revisado como guion)

**Verdad: OK, salvo un matiz.** Las tres exclusiones, sus porqués, «la llamada la haces tú», «"lo hizo el sistema" no es
una respuesta», «La firma es humana», la pregunta «quién responde cuando falle» (`CHECKLIST_EXCLUSIONS_FOOTNOTE`) y los
«10 procesos» (`CHECKLIST_PROCESSES` tiene 10 entradas) salen de `checklist.ts`. «Marcas lo que haces a mano y te sale
el orden» y «dos minutos» salen de `enlaces.ts`, entrada `checklist`. El matiz: el texto en pantalla del tramo tres dice
«Lo que acaba en Hacienda», pero la fuente y lo que dice Kike es «lo que **puede** acabar en Hacienda».

**Reglas propias: OK.** No hay promesas, clientes, «gratis» ni CTA a un pago.

**Voz: OK.** Se han reescrito bien los dos «no es X, es Y» de la fuente («ahí no hay un proceso: hay tres», «no te
ahorra tiempo: te cuesta el cliente»). «"Lo hizo el sistema" no es una respuesta» es una cita, sin la segunda parte
«es Y», y vale. No hay cierre motivacional.

**Duración y pantalla: OK.** Unas 106 palabras habladas, unos 40 s, dentro de los 35-45 s del plan y de `pieza.json`.
Los tramos suman 40 s. Ningún texto en pantalla pasa de 7 palabras. La zona segura está indicada para todo el texto
(nada en el 10 % superior ni en el 15 % inferior). Cuando llegue el vídeo hay que comprobar que los subtítulos
(«media-baja») quedan por encima del 15 % inferior.

**CTA y destino: OK.** Una sola llamada (CHECKLIST). La URL con UTM y `origen` coincide con `plan.md`. La ruta existe, y
`ChecklistTool.tsx` y `ChecklistLeadForm.tsx` leen `?origen=`.

**pieza.json: OK para esta fase.** Estado `borrador`, jueves 03/12/2026 a las 20:00 `+01:00`. `archivos: []` es lo
esperable sin vídeo. Al montar el reel habrá que poner el MP4 en `archivos` y una `portada`.

**Cambios:**
1. `guion.md`, tabla de tramos, fila 22-31 s, texto en pantalla: «3 · Lo que acaba en Hacienda» → «3 · Lo que puede
   acabar en Hacienda». Cambiarlo también en la línea de «Prueba de sonido apagado». La palabra a destacar sigue siendo
   «Hacienda».
2. `pie.md`: el cambio común de arriba (solo el texto del pie; las notas a `notas.md`).

---

## Segunda vuelta (25/11/2026, 16:17)

Solo reviso los cambios aplicados después de la primera revisión.

**`pie.md` en las tres carpetas: corregido.** Cada `pie.md` lleva ahora solo el texto publicable: sin título, sin
encabezados, sin UTM y sin notas. Las notas están en `notas.md`. Lo he comparado con el bloque «Texto del pie» de la
primera vuelta:
- 01 y 03: idénticos.
- 02: el único cambio es «57 fichas» → «48 fichas».

`validar` da 01 y 02 como válidas. En 03 solo quedan «archivos está vacío» y «reel lleva un solo archivo», lo esperable
mientras no haya vídeo.

**02 · cifra: corregido.**
- «48» ya figura en `copy.md` (titular y fuente), `pie.md`, `alt_text[6]`, `_src/07.html` y `_src/build.js`.
- No queda ningún «57» en la pieza, salvo la nota explicativa de `notas.md`.
- `slides/07.png` dice «48 fichas como estas, en 9 categorías».
- Las diapositivas 01-06 regeneradas (16:15) tienen el mismo texto, colores, maquetación y monograma que en la primera
  vuelta.

**03 · guion: corregido.** `guion.md` dice «3 · Lo que puede acabar en Hacienda» en la tabla de tramos y en la prueba
de sonido apagado. Lo que dice Kike no ha cambiado.

**`alt_text` de 01 y 02: OK.**
- Hay 8 textos en 01 y 7 en 02, en el mismo orden que `archivos`.
- Cada texto describe su diapositiva con frases sacadas de esa misma diapositiva. Algunas están recortadas: en la 01-03
  falta el paréntesis de las cuentas y en la 01-07 faltan «o deja de contestar» y «hoy mismo». Los recortes no cambian
  el sentido.
- No añaden ningún dato, cifra ni promesa que no esté en la imagen o en su fuente.

Las diapositivas de 01 no se han regenerado después de la primera vuelta (16:08, antes de mi revisión), así que siguen
siendo las que ya aprobé.

### Veredicto final

| Pieza | Veredicto |
|---|---|
| 01 · presupuesto-6-preguntas | **OK** |
| 02 · claude-sin-codigo | **OK** (desbloqueada) |
| 03 · lo-que-no-automatizaria | **OK como guion**. El vídeo montado necesita una revisión propia: texto y subtítulos fuera del 10 % superior y del 15 % inferior, duración de 35-45 s, MP4 en `archivos` y `portada` |

Pendiente fuera de las piezas: que el estratega cambie «57 fichas» por «48 fichas» en `plan.md` y en
`investigacion.md`. La decisión sobre «Es gratis» en el pie de 01 sigue siendo de Kike.
