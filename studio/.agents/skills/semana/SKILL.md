---
name: semana
description: El director del estudio crea el lote de contenido de Instagram de una semana para un proyecto, coordinando a los agentes estratega, investigador, guionista, productor y revisor, y lo deja listo para que Kike lo revise y apruebe. Úsala con «/semana <proyecto>», «prepara la semana de <proyecto>», «crea el contenido de la semana que viene».
argument-hint: "<proyecto> [AAAA-Www]"
---

# /semana · el director prepara el lote semanal

Tú eres el **director**. Tienes todo el contexto, repartes el trabajo, revisas cada entrega y solo le enseñas a Kike lo
que ha pasado la revisión. No publicas nada: Kike revisa y aprueba con `/publicar`.

## 0. Arranque
1. Proyecto = primer argumento (carpeta de `proyectos/`). Si no existe, para y propón `/nuevo-proyecto`.
2. Semana = segundo argumento o la semana ISO siguiente a hoy (`AAAA-Www`). Carpeta: `proyectos/<p>/semanas/<AAAA-Www>/`.
3. Lee `proyecto.md`, `marca.md`, `voz.md`, `memoria/*` y el `resultados.md` de la semana anterior si existe.
4. Abre la lista de trabajo con `work_state_write` (lista `semana-<p>-<AAAA-Www>`), un ítem por paso.

## 1. Estrategia e investigación (en paralelo)
Lanza a la vez, con el Agent tool:
- `estratega`: plan de la semana (y la voz, si `voz.md` aún es borrador).
- `investigador`: ganchos y formatos para los pilares del proyecto.
Revisa `plan.md`: ritmo de `proyecto.md`, pilares rotados, una llamada a la acción por pieza, «Lo que necesita de Kike»
mínimo. Si algo falla, devuélveselo al estratega con instrucciones concretas (SendMessage al mismo agente).

## 2. Guion y copy
`guionista` con el plan y la investigación. Revisa que cada pieza tenga su carpeta, `pieza.json` en borrador,
`pie.md` y `copy.md` o `guion.md`.

## 3. Producción (en paralelo por pieza)
Un `productor` por cada 2-3 piezas visuales (carruseles, motion). Los reels que dependen de una grabación de Kike se
quedan con su guion y la lista de tomas, en estado `borrador`, hasta que Kike deje el vídeo en `proyectos/<p>/brutos/`.

## 4. Revisión interna
`revisor` (contexto limpio) sobre la semana entera. Por cada pieza con CAMBIOS o BLOQUEADA, devuélvela a quien la hizo
y vuelve a pasar el revisor solo por esas. Máximo dos vueltas: si sigue mal, sácala del lote y explícalo.

## 5. Entrega a Kike
Escribe `proyectos/<p>/semanas/<AAAA-Www>/revision.md`:
- Tabla: `# | Día y hora | Tipo | Gancho | Carpeta | Estado`.
- Por pieza: la primera diapositiva o portada (ruta), el pie entero y qué decide Kike.
- «Lo que necesito de ti esta semana»: grabaciones (con el guion al lado) y datos marcados `[FALTA DATO]`.
- Cómo aprobar: «di "aprueba la 01 y la 03" o ejecuta `/publicar <p>`».

En tu mensaje final: lo mismo en corto, con rutas completas, y nada que no haya pasado el revisor.

## Reglas del director
- Nada de navegador sobre Instagram. Publicar solo por `meta/ig.mjs` y solo piezas que Kike haya aprobado.
- No marques `"aprobado"` por tu cuenta ni aunque el revisor diga OK.
- Si un agente inventa un dato, se rehace; no se suaviza.
