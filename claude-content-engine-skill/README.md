# Autonomous Content Engine v2 (Claude Code Skill)

Sistema integral de creacion, produccion, publicacion directa en redes sociales y optimizacion algoritmica para creadores y equipos de medios digitales en Claude Code [cite: 3, 4, 8].

---

## Novedades Principales en la Version 2.0
1. **Selector Parametrico de Duracion:** Selecciona entre Micro-Short (15-30s), Standard Short (45-60s), Extended Short (90-180s) y Long-Form (8-12m) con adaptacion automatica de ritmo, palabras objetivo e interrupciones de patron [cite: 11, 20].
2. **Context Engine del Creador (`config/creator_profile.json`):** Adapta la llamada a la accion (CTA) a tu modelo de negocio activo (captacion de emails con Lead Magnet, conversacion B2B, distribucion relacional o retencion) [cite: 1, 3].
3. **Publicacion Directa en Redes Sociales:** Conectores MCP listos para YouTube, Instagram Reels, TikTok y LinkedIn [cite: 3, 4, 8].
4. **Copycrafting Algoritmico con Tips de Viralizacion:**
   - *Instagram:* Hook <125 caracteres, SEO semantico, disparador ManyChat y fomento de Sends/Reach >2% [cite: 4, 12].
   - *TikTok:* Intencion de busqueda para TikTok Search y debate polarizante en comentarios [cite: 5, 16].
   - *YouTube:* Titulos moviles <60 caracteres, marcas de tiempo y SEO en primeros 150 caracteres [cite: 2, 20].
   - *LinkedIn:* Formato dwell-time, hook de 2 lineas, cero enlaces en cuerpo principal y enlace en 1er comentario [cite: 14, 15, 19].
5. **Seguridad Humana Tier 3 HITL:** Bloqueo preventivo de publicaciones en redes hasta que el creador firme la autorizacion con su token personal.

---

## Estructura del Proyecto
```
claude-content-engine-skill/
├── SKILL.md
├── README.md
├── config/
│   ├── creator_profile.json
│   ├── mcp_servers.json
│   └── permissions_matrix.json
├── agents/
│   ├── orchestrator.md
│   ├── researcher_strategist.md
│   ├── director_scriptwriter.md
│   ├── postproducer_editor.md
│   ├── publisher_distributor.md
│   └── analytics_experimenter.md
├── workflows/
│   ├── 01_ideation_to_brief.md
│   ├── 02_production_to_master.md
│   ├── 03_publish_and_distribution.md
│   └── 04_analytics_closed_loop.md
├── templates/
│   ├── creator_profile_template.json
│   ├── social_copy_matrix_template.md
│   ├── production_brief_template.md
│   ├── two_column_script_template.md
│   ├── rmta_evaluation_template.md
│   └── ab_test_template.md
├── scripts/
│   ├── ice_scorer.py
│   ├── metrics_analyzer.py
│   ├── pipeline_orchestrator.py
│   ├── social_publisher.py
│   └── mcp_healthcheck.py
└── tests/
    └── test_content_engine.py
```

---

## Instalacion y Validacion

```bash
# 1. Extraer en tu entorno de trabajo
tar -xzf claude-content-engine-skill-v2.tar.gz

# 2. Configurar perfil de creador
nano config/creator_profile.json

# 3. Comprobar entorno MCP y herramientas
python3 scripts/mcp_healthcheck.py

# 4. Ejecutar suite de pruebas integradas
python3 -m unittest discover -s tests -p "test_*.py"
```
