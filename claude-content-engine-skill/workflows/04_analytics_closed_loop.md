# WORKFLOW 04: ANALÍTICA TEMPORAL, RMT-A Y RETROALIMENTACIÓN DE BUCLE CERRADO

```
[Cron Job / Trigger a 24h, 7d y 30d]
       │
       ▼
(AnalyticsExperimenter vía MCPs Analíticos)
       ├── 1. Recolección de Métricas Nativas [cite: 4, 10]
       │      • 24h: CTR inicial, 3s Hold Rate, Starts vs Streams, Dwell Time [cite: 3, 4, 13, 15]
       │      • 7d: AVD %, Completion Rate, Sends per Reach, Shares acumulados [cite: 3, 4, 12, 17]
       │      • 30d: Repeat-listeners, Conversión a suscriptores, Tráfico sugerido [cite: 1, 7, 17]
       ├── 2. Análisis Relativo de Outliers (Z-Score frente a histórica de 90 días) [cite: 2, 20]
       ├── 3. Diagnóstico Causal de 4 Capas (Idea, Empaque, Ejecución, Distribución) [cite: 2, 20]
       ├── 4. Clasificación Estratégica RMT-A:
       │      • Repetir (Franquiciar) [cite: 2]
       │      • Mejorar (Optimizar empaque o gancho) [cite: 2, 25]
       │      • Probar (Nuevas hipótesis) [cite: 2]
       │      • Abandonar (Archivar formato) [cite: 2]
       └── 5. Resolución de Experimentos A/B (Watch Time Share) [cite: 11, 21]
       │
       ▼
(Orchestrator) ──> [Inyección en .content_engine/memory/learned_rules.json]
       │
       ▼
[Actualización de ponderaciones para ResearcherStrategist y DirectorScriptwriter en el ciclo siguiente]
```
