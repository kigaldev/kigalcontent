# Plan: controlar y crear el contenido de Instagram con Claude Code

Fecha: 20 nov 2026. Encaja con la Fase 0 del motor de contenido (`kigaldevWeb/docs/estrategia-webs/30-plan-de-marketing.md` §4.13).

## Estado (25 nov 2026)

- **Decisiones de Kike:** Instagram abierto como canal; una sola cuenta, **@kikegallego_**, para kikegallego.com y
  kigaldev.com; orden del motor de contenido confirmado (Fase 0 → 1 → 2). Todo el contenido se crea automáticamente y
  Kike lo publica tras revisarlo.
- **Montado en Windows:** equipo de agentes (`.claude/agents/`), skills `/semana`, `/publicar` y `/nuevo-proyecto`,
  estructura multiproyecto (`proyectos/`), HookLab con su entorno de Python, yt-dlp, faster-whisper, Open Carrusel,
  Motion Architect.
- **Fase 3 construida:** la publicación y las métricas por la API oficial (`meta/ig.mjs`) y el bot «comenta PALABRA y
  te lo mando» (`kigalcontent/bot/`: Next.js + Supabase en Vercel, multicuenta, con los frenos de la guía de baneos). Probado en
  local (tests, build, webhook firmado). Falta lo de Kike: validar la app de Meta (porfolio «Kigaldev Market»), el
  alojamiento temporal (`meta/README.md`) y desplegar el bot (`../bot/README.md`).

## Qué hace cada pieza (y qué no)

| Pieza | Para qué sirve | Coste / requisitos | Qué no hace |
|---|---|---|---|
| **HookLab** | Puntúa hooks de reels, imágenes o copy con checklists binarios y guarda lo que funciona en una biblioteca SQLite con dashboard. Genera guiones (`scriptgen`) y SEO a partir de esa biblioteca. | Apify (de pago, por ejecución) para bajar reels por URL. El análisis lo hace Claude. | No publica ni lee tus estadísticas |
| **Ootto (52 skills)** | Estrategia y escritura: memoria de voz (`ai-brain`), pilares, calendario de 2 semanas, hooks, guiones, carruseles, pies, CTA, scripts de DM, análisis de competidores y comentarios. | Gratis (MIT). En inglés. | Su «autopilot» de pago (ootto.ai) no está instalado ni hace falta |
| **Open Carrusel** | App local: le pides el carrusel por chat y lo exporta a PNG en 1:1, 4:5 o 9:16 con tu marca. | Gratis. Cada mensaje del chat lanza Claude CLI (tope 1 $ por mensaje). | No escribe la estrategia: dale el copy hecho |
| **Motion Architect** | Motion graphics con Remotion: referencias → storyboard → animación → mp4 en los 4 formatos. | Gratis. Opcional: GROQ/OpenAI para transcribir, Gemini para «ver» vídeos. Remotion es gratis para autónomos y empresas de hasta 3 personas. | Se solapa con HyperFrames (ya instalado): usa Motion Architect para piezas animadas, HyperFrames para editar vídeo grabado |
| **Reels de prueba** | 5 versiones distintas de un reel que ya funciona para subirlas como «Reel de prueba» (solo no seguidores), una al día. | ffmpeg (instalado). Cuenta profesional con la opción de Reel de prueba. | No sube nada: se sube a mano desde el móvil |
| **Gist de Gonzalo** | Dos guías: montar tu propio ManyChat (comenta PALABRA → DM con enlace) por la API oficial, y las 7 causas de baneo. | Vercel + Supabase + app de Meta (tienes todo). | Es un proyecto a construir, no una skill |
| **Meta Ads MCP (oficial)** | Desde Claude: informes de campañas, crear y editar campañas/anuncios, tests A/B, historial. `https://mcp.facebook.com/ads` | Pendiente de conectar (ver abajo). | Es para anuncios de pago. No publica contenido orgánico ni da estadísticas orgánicas completas |

**Lo que falta para «controlar» del todo:** ninguna de estas piezas publica en orgánico ni lee tus estadísticas
orgánicas. Eso lo da la API de Instagram (Graph API) con tu propia app de Meta, la misma que pide el ManyChat propio.
Por eso la fase 3 junta las dos cosas.

## El flujo semanal

```
1. INVESTIGAR    HookLab (/hooklab <url>) + Ootto reel-analyzer, competitor-teardown, comment-mining, trend-spotter
                 → biblioteca de hooks que pasan el 50 % del checklist
2. PLANIFICAR    Ootto ai-brain (una vez) + content-pillar-builder + content-calendar (2 semanas)
3. ESCRIBIR      /hooklab-scriptgen o viral-hook-writer → reel-scripter → on-screen-text-writer → humanizer
4. PRODUCIR      Reel grabado: hooklab-edit / HyperFrames (subtítulos, cortes, 9:16)
                 Motion graphics: /motion
                 Carrusel: carousel-builder (copy) → Open Carrusel (diseño y PNG)
5. PUBLICAR      caption-and-hashtags o /hooklab-seo → subir DESDE EL MÓVIL (o programar en la app)
6. EXPRIMIR      El reel que funcione → «haz las pruebas de este reel» → 1 prueba al día
7. MEDIR         analytics-readout / social-analytics-report → el hook ganador vuelve a la biblioteca (/hooklab)
8. AMPLIFICAR    (fase 4) El reel ganador de las pruebas → anuncio con Meta Ads MCP
```

## Fases

**Fase 1: ya (sin coste).** Abrir Claude Code en `C:\repos\kigalcontent\studio`, ejecutar `ai-brain` con la voz de
kigaldev, `content-pillar-builder` y un `content-calendar` de 2 semanas alineado con los vídeos de herramientas con
afiliado. Producir con Open Carrusel, `/motion` y HyperFrames. Analizar reels propios o de referencia descargándolos
en local (HookLab acepta ficheros).

**Fase 2: cuando haya 3-5 reels publicados.** Activar Apify (`APIFY_TOKEN`) si compensa analizar por URL a escala.
Empezar con Reels de prueba en los que funcionen, respetando una al día y no más de una prueba diaria las dos primeras
semanas.

**Fase 3: captación por comentarios.** Construido en `kigalcontent/bot/` con la guía de `docs/` (Next.js + Supabase +
Vercel, proyecto aparte de kigaldevWeb). Pendiente de desplegar. Encaje directo: comentario «GUIA» → DM con
`kigaldev.com/recursos/guia-claude-para-negocios?utm_source=instagram`, y el lead acaba en Airtable como el resto. En
la misma app de Meta, añadir lectura de estadísticas orgánicas para un panel propio.

**Fase 4: pago.** Conectar Meta Ads MCP y usarlo para informes y para promocionar solo lo que ya ha ganado en orgánico
y en pruebas.

## Conectar Meta Ads MCP (pendiente, lo haces tú)

Dos caminos:
- **Sin app propia:** guía de Meta «How to set up Meta ads AI connectors»
  (facebook.com/business/help/1456422242197840).
- **Con tu app de Meta** (la misma de la fase 3): en developers.facebook.com añade el caso de uso «Create & manage ads
  with ads MCP server», configura la redirect URL de Facebook Login for Business y luego:
  `claude mcp add --transport http --client-id <META_APP_ID> meta-ads https://mcp.facebook.com/ads`
  Después, en una sesión interactiva, `/mcp` para iniciar sesión. Permisos mínimos: `ads_mcp_management` + `ads_read`
  (añade `ads_management` para crear campañas e `instagram_basic` para más herramientas).

## Riesgos

- **Baneo por automatización:** nada que maneje instagram.com o la app por ti. Esto incluye la extensión de Chrome
  de Claude.
- **Reels de prueba** existe para que Instagram no detecte las copias como duplicados: úsala solo con vídeos propios
  y al ritmo que marca; si una prueba baja de ~100 visualizaciones en 24 h, para una semana.
- **Coste de Apify** por ejecución: no ingerir en bloque sin mirar el precio del actor.
- **Inflación de skills:** las 52 de Ootto y las de HookLab solo cargan en esta carpeta, a propósito. No las copies a
  `~/.claude/skills`.
