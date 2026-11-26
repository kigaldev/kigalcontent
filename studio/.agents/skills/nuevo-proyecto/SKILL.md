---
name: nuevo-proyecto
description: Da de alta en el estudio de Instagram un proyecto o cuenta nueva (otro repositorio, otro producto, otra marca) para que el equipo de agentes trabaje con él. Úsala con «/nuevo-proyecto <nombre>», «añade Opostudia al estudio», «quiero hacer contenido para <repo>».
argument-hint: "<nombre> [ruta del repositorio]"
---

# /nuevo-proyecto

1. Copia `proyectos/_plantilla/` a `proyectos/<nombre>/` (nombre en minúsculas, sin espacios) y crea `semanas/`,
   `memoria/` (con `ganchos.md` y `decisiones.md`), `metricas/` y `brutos/`.
2. Lee el repositorio de origen (AGENTS.md, README, la home y las páginas de producto o precios, design system o tokens
   de Tailwind, logotipos en `public/`) y rellena un borrador de `proyecto.md`, `marca.md` y `voz.md` con lo que encuentres.
   Cita la ruta de cada dato. Lo que no esté escrito, como pregunta, no como suposición.
3. Pregunta a Kike, de una en una y solo lo que falte: la cuenta de Instagram (`@`), el objetivo del canal, las ofertas o
   imanes a los que llevar, el ritmo semanal y las reglas propias (avisos obligatorios, lo que no se dice).
4. Si la cuenta es distinta de las ya conectadas: `proyectos/<nombre>/.env` desde `.env.example` y los pasos 1-3 de
   `meta/README.md` para esa cuenta (la misma app de Meta sirve: se añade la cuenta como evaluador y se genera su token).
5. Apunta en `memoria/decisiones.md` lo decidido, con fecha. Termina proponiendo `/semana <nombre>`.
