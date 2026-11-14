# REGISTRO DE EXPERIMENTACIÓN A/B (WATCH TIME SHARE PROTOCOL)

**ID Experimento:** {{EXPERIMENT_ID}}  
**ID Contenido Asociado:** {{CONTENT_ID}}  
**Plataforma:** {{PLATFORM: YouTube Test & Compare / Meta / TikTok}}  

| Parámetro | Variante A (Control) | Variante B (Test) |
| :--- | :--- | :--- |
| **Hipótesis** | Línea de base actual | {{HYPOTHESIS_DESCRIPTION}} |
| **Variable Aislada** | Título / Miniatura estándar | Modificación monovariable |
| **Asset Gráfico** | `{{THUMBNAIL_A_PATH}}` (1280x720) | `{{THUMBNAIL_B_PATH}}` (1280x720) |
| **Texto / Título** | "{{TITLE_A}}" | "{{TITLE_B}}" |
| **Impresiones Acumuladas** | {{IMPRESSIONS_A}} | {{IMPRESSIONS_B}} |
| **CTR Bruto Registrado** | {{CTR_A}}% | {{CTR_B}}% |
| **Duración Media (AVD)** | {{AVD_A_SECONDS}} seg | {{AVD_B_SECONDS}} seg |
| **Tiempo Total Visualizado** | {{TOTAL_WATCH_TIME_A}} min | {{TOTAL_WATCH_TIME_B}} min |
| **Watch Time Share (%)** | {{WATCH_TIME_SHARE_A}}% | {{WATCH_TIME_SHARE_B}}% |

**Criterio de Resolución:**  
La plataforma y el sistema declaran ganadora a la variante con mayor **Watch Time Share**, penalizando el CTR engañoso si la retención es baja.  
**Variante Ganadora:** {{WINNER_VARIANT}}  
**Delta Watch Time:** {{DELTA_WATCH_TIME_PERCENT}}%  
**Conclusión Operativa:** {{OPERATIONAL_CONCLUSION}}
