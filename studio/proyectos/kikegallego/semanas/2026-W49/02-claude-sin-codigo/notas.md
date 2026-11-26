# 02 · claude-sin-codigo · notas (no se publican)

`pie.md` lleva solo el texto que se publica: `meta/ig.mjs` lo manda entero.

## Para el director y para Kike

- **Llamada a la acción:** una, «Escríbeme GUIA por privado y te la paso». Sin enlace en la bio.
- **Qué recibe quien escriba GUIA:** el enlace a la guía de Claude para negocios. En la página puede ver las 48 fichas sin dejar el correo; si lo deja, recibe su kit personal (qué herramientas le sirven, en qué orden y por qué).
- **Destino con UTM y origen (el que va en la respuesta):**
  `https://www.kigaldev.com/recursos/guia-claude-para-negocios?utm_source=instagram&utm_medium=social&utm_campaign=claude-sin-codigo-w49&origen=instagram-claude-sin-codigo-w49`
- **Respuesta por privado, para copiar y pegar:**
  > Aquí la tienes: https://www.kigaldev.com/recursos/guia-claude-para-negocios?utm_source=instagram&utm_medium=social&utm_campaign=claude-sin-codigo-w49&origen=instagram-claude-sin-codigo-w49
  > Las fichas están todas a la vista. Si marcas lo que quieres conseguir y me dejas tu correo, te digo cuáles te sirven y por cuál empezar.
- **Ojo con «no cuesta nada aparte de lo que ya tengas de Claude»:** es la traducción de `cost: 'sin-coste'` («Sin coste extra» sobre Claude). No dice que Claude sea gratis ni en qué plan están los conectores: ese dato no está en los ficheros.
- **Cifra corregida (revisión interna):** son 48 fichas. `GUIDE_ENTRIES` tiene 48 entradas; las 57 líneas `id:` del fichero incluyen las 9 de `GUIDE_CATEGORIES`. El error venía de `plan.md` e `investigacion.md`, que el estratega tiene que corregir.
- **Fuentes:** `kigaldevWeb/src/data/guia-claude.ts` (entradas `gmail`, `google-calendar`, `google-drive`, `CONNECTOR_STEPS`, `COST_LABELS`, 48 entradas en `GUIDE_ENTRIES`) y `src/app/recursos/guia-claude-para-negocios/page.tsx` (el kit personal a cambio del correo, las fichas abiertas sin correo).
- Caracteres del pie: unos 830 (límite 2.200). Hashtags: 5.
