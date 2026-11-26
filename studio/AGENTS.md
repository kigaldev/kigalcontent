# Instagram Studio · contexto para Codex

Estudio de contenido de Instagram de Kike Gallego, en Windows (`C:\repos\kigalcontent\studio`, dentro del repositorio kigalcontent; PowerShell 5.1).
Sirve para **varios proyectos**: cada cuenta o marca vive en `proyectos/<proyecto>/`. Abre Codex en esta carpeta
para tener el equipo de agentes y las skills de contenido (solo se cargan aquí, a propósito).

## Cómo se trabaja (en una frase)
El contenido se crea de forma automática con un equipo de agentes, **Kike lo revisa y lo aprueba**, y se publica por la
**API oficial de Meta**: al momento o programado.

| Quiero… | Comando |
|---|---|
| Crear el lote de una semana | `/semana <proyecto>` |
| Revisar, aprobar y publicar | `/publicar <proyecto>` |
| Añadir otro repositorio o cuenta | `/nuevo-proyecto <nombre> [ruta]` |
| Crear la regla de un «comenta X» | `node ..\bot\scripts\regla.mjs crear --proyecto <p> --palabra X …` |
| Ver métricas y aprender | agente `analista` (o «analiza la semana de <proyecto>») |

## El equipo (`.codex/agents/`)
La sesión principal es el **director**: tiene todo el contexto, reparte, revisa y solo enseña a Kike lo que ha pasado el
revisor. Los agentes:

| Agente | Hace | Skills principales |
|---|---|---|
| `estratega` | voz, pilares, plan de la semana | content-pillar-builder, content-calendar, series-planner |
| `investigador` | ganchos y formatos que funcionan, competencia | hooklab, reel-analyzer, competitor-teardown, trend-spotter |
| `guionista` | guiones, copy de carruseles, pies, CTA | hooklab-scriptgen, reel-scripter, carousel-builder, caption-and-hashtags, humanizer |
| `productor` | PNG de carruseles, motion, edición de vídeo, reels de prueba | Puppeteer, /motion, HyperFrames, reels-de-prueba |
| `revisor` | verdad, reglas del proyecto, voz, límites de Instagram (contexto limpio) | — |
| `analista` | métricas oficiales y ganchos ganadores | analytics-readout, social-analytics-report |

## Proyectos (`proyectos/`)
Cada proyecto tiene: `proyecto.md` (cuenta, objetivo, público, pilares, imanes, reglas propias), `marca.md`, `voz.md`,
`memoria/` (decisiones y ganchos que funcionan), `semanas/<AAAA-Www>/<NN>-<slug>/` (una carpeta por pieza con
`pieza.json`), `metricas/`, `brutos/` (vídeos que graba Kike) y `.env` (token de su cuenta, nunca en git).
Plantilla en `proyectos/_plantilla/`.

- `kikegallego`: cuenta **@kikegallego_**, para kikegallego.com y kigaldev.com.

## Reglas que no se rompen
1. **Nunca automatizar Instagram desde el navegador** (ni Codex-in-chrome, ni extensiones, ni apps con contraseña).
   Publicar solo con `meta/ig.mjs` (API oficial). Ver `docs/Causas-de-baneo-y-como-evitarlas.md`.
2. **Solo se publica lo que Kike aprueba**, pieza a pieza. Ningún agente pone `"estado": "aprobado"`.
3. **Solo contenido propio.** El contenido ajeno se descarga para analizarlo, nunca para republicarlo. Reels de prueba:
   una al día como mucho.
4. **Nada inventado**: cifras, precios, casos y nombres salen de los ficheros del proyecto o de sus repositorios.
5. **Español de España**, tono directo; las skills de Ootto están en inglés, la salida va en español. Todo texto final pasa
   por `humanizer`.
6. Claves (Meta, Vercel Blob, APIFY, GEMINI/GROQ) solo en `.env` (raíz) o `proyectos/<p>/.env`. Nunca en el chat ni en git.

## Herramientas y dónde viven
| Herramienta | Ruta | Cómo se usa |
|---|---|---|
| Publicador API de Meta | `meta/` | `node meta\ig.mjs …` · instrucciones en `meta/README.md` |
| HookLab | `HookLab/` | skills `/hooklab*`; Python en `HookLab\.venv\Scripts\python.exe` |
| yt-dlp y faster-whisper | `HookLab\.venv` | `HookLab\.venv\Scripts\yt-dlp.exe`, `from faster_whisper import WhisperModel` |
| Skills de Ootto (52) y propias | `.agents/skills/` | `/reel-analyzer`, `/viral-hook-writer`, `/semana`, `/publicar`… |
| Open Carrusel (editor manual de carruseles) | `open-carrusel/` | `cd open-carrusel; npm run dev` → http://localhost:3000 |
| Puppeteer (PNG de carruseles) | `open-carrusel\node_modules\puppeteer` | lo usa el agente `productor` |
| Motion Architect (Remotion) | `motion-architect/` | plugin global `/motion`, `/motion-render`; estudio en `motion-architect\studio` |
| HyperFrames | plugin global | edición de vídeo grabado, subtítulos |
| Reels de prueba, humanizer | `.agents/skills/` (copias de las globales) | «haz las pruebas de este reel» |
| Bot «comenta PALABRA y te lo mando» | `..\bot\` (raíz de kigalcontent) | Vercel + Supabase · `node ..\bot\scripts\regla.mjs …` · `..\bot\README.md` |
| Guías ManyChat propio y baneos | `docs/` | base del bot y de las reglas anti-baneo |

## Notas de Windows
- Shell: PowerShell 5.1 (sin `&&`; usa `;` o `if ($?) {}`). Las skills de HookLab traen ejemplos en PowerShell: valen tal cual.
- Comandos de HookLab siempre **desde `HookLab\`**: `.venv\Scripts\python.exe ingest.py …`, `db_export.py`, `server.py`
  (dashboard en el puerto 5000).
- `/hooklab <url>` necesita `APIFY_TOKEN` (de pago). Sin él, se analiza un vídeo local descargado con yt-dlp.
- Open Carrusel y Remotion Studio usan los dos el puerto 3000: no los arranques a la vez (o `$env:PORT=3001`).
- Open Carrusel llama a Codex CLI (ruta en `open-carrusel\.env.local`); cada mensaje de su chat tiene un tope de 1 $.
- Al escribir ficheros desde PowerShell 5.1, usa `-Encoding utf8` o el Write tool: si no, se rompen las tildes.
