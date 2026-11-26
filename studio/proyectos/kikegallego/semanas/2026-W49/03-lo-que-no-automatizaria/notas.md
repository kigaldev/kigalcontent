# 03 · lo-que-no-automatizaria · notas (no se publican)

`pie.md` lleva solo el texto que se publica: `meta/ig.mjs` lo manda entero.

## Para el director y para Kike

- **Llamada a la acción:** una, «Escríbeme CHECKLIST por privado y te lo paso». Sin enlace en la bio.
- **Qué recibe quien escriba CHECKLIST:** el enlace al checklist de automatización de kigaldev.com.
- **Destino con UTM y origen (el que va en la respuesta):**
  `https://www.kigaldev.com/recursos/checklist-automatizacion?utm_source=instagram&utm_medium=social&utm_campaign=lo-que-no-automatizaria-w49&origen=instagram-lo-que-no-automatizaria-w49`
- **Respuesta por privado, para copiar y pegar:**
  > Aquí lo tienes: https://www.kigaldev.com/recursos/checklist-automatizacion?utm_source=instagram&utm_medium=social&utm_campaign=lo-que-no-automatizaria-w49&origen=instagram-lo-que-no-automatizaria-w49
  > Son dos minutos: marcas lo que haces a mano y te sale por cuál empezar. Las tres que no automatizaría también están ahí, con el porqué.
- **Fuentes:** las tres exclusiones, su detalle y la frase de «pregúntale quién responde cuando falle», de `kigaldevWeb/src/data/checklist.ts` (`CHECKLIST_EXCLUSIONS`, `CHECKLIST_EXCLUSIONS_FOOTNOTE`); los 10 procesos, de `CHECKLIST_PROCESSES`; «marca lo que haces a mano y sale el orden» y «2 minutos», de `kigalweb/data/enlaces.ts` (entrada `checklist`).
- **Reel de prueba:** el gancho B («No automatices estas tres cosas, aunque te lo vendan») usa este mismo pie; solo cambia la primera línea: «No automatices estas tres cosas en tu empresa, aunque te lo vendan.» Al montar la prueba, se crea su propio `pie.md` con esa línea.
- **Al montar el reel:** poner el MP4 en `archivos` y una `portada` en `pieza.json`. Comprobar que los subtítulos quedan por encima del 15 % inferior.
- Caracteres del pie: unos 1.010 (límite 2.200). Hashtags: 5.
