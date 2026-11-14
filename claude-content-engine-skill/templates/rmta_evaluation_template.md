# FICHA DE EVALUACIÓN ANALÍTICA RMT-A Y DIAGNÓSTICO MULTIVARIABLE

**ID Contenido:** {{CONTENT_ID}} | **Canal:** {{CHANNEL}} | **Fecha Publicación:** {{PUBLISH_DATE}}

## 1. REGISTRO TEMPORAL DE MÉTRICAS PRIMARIAS
- **Ventana 24 Horas:**
  - CTR Inicial / 3s Hold Rate: {{METRIC_24H_VALUE}}% (Benchmark: {{BENCHMARK_24H}}%)
  - Velocidad Inicial (Views/hora): {{VIEW_VELOCITY_24H}}
  - Starts vs Streams (si aplica Podcast): {{STARTS_VS_STREAMS}}
- **Ventana 7 Días:**
  - Duración Media de Visualización (AVD) / Completion Rate: {{AVD_7D}}% (Benchmark: {{BENCHMARK_7D}}%)
  - Valor Social (Sends per Reach / Guardados): {{SOCIAL_VALUE_7D}}%
  - Total Visualizaciones 7 Días: {{VIEWS_7D}}
- **Ventana 30 Días:**
  - Ratio de Espectadores Recurrentes: {{REPEAT_VIEWERS_30D}}%
  - Nuevos Suscriptores / Leads captados: {{CONVERSIONS_30D}}

---

## 2. EVALUACIÓN RELATIVA DE OUTLIERS
- **Línea de Base Histórica (Canal - 90 días):** Media = {{BASELINE_MEAN}} | Desviación Estándar = {{BASELINE_STD}}
- **Factor Outlier:** {{OUTLIER_FACTOR}}x frente a la media.
- **Veredicto Estadístico:** {{STATISTICAL_VERDICT: Outlier Positivo (>=3x) / Desempeño Promedio / Outlier Negativo (<=0.5x)}}

---

## 3. AISLAMIENTO CAUSAL EN 4 CAPAS
- [ ] **Fallo / Éxito en Idea (TAM):** {{DIAGNOSIS_IDEA}}
- [ ] **Fallo / Éxito en Empaque (CTR / Hold Rate):** {{DIAGNOSIS_PACKAGING}}
- [ ] **Fallo / Éxito en Ejecución (AVD / Retención / Pacing):** {{DIAGNOSIS_EXECUTION}}
- [ ] **Fallo / Éxito en Distribución (Horario / Algoritmo):** {{DIAGNOSIS_DISTRIBUTION}}

---

## 4. CLASIFICACIÓN ESTRATÉGICA RMT-A
- [ ] **Repetir (Franquiciar):** Alto empaque + alta retención. Escalar como serie.
- [ ] **Mejorar (Optimizar):** Desajuste identificado (cambiar empaque o retocar gancho).
- [ ] **Probar (Experimentar):** Asignar al 20% de presupuesto de riesgo.
- [ ] **Abandonar (Archivar):** 3 iteraciones deficientes sin tracción.

**Regla de Aprendizaje Concreta:**
> *"{{LEARNED_RULE_STATEMENT}}"*
*(Esta regla se inyecta automáticamente en `.content_engine/memory/learned_rules.json`).*
