# WORKFLOW 02: POSPRODUCCIÓN AUDIOVISUAL Y ENSAMBLAJE MASTER

```
[Archivos Crudos en ./media_workspace/raw/]
       │
       ▼
(PostproducerEditor vía av_production_ffmpeg MCP)
       ├── 1. Ingesta y Verificación de Integridad de Video/Audio
       ├── 2. Transcripción Local Whisper (.json con timestamps palabra por palabra)
       ├── 3. Detección y Poda Algorítmica de Silencios (>400ms) [cite: 1]
       ├── 4. Normalización de Sonoridad a -14 LUFS (+/- 1 LUFS, Peak -1.0 dBFS)
       ├── 5. Re-encuadre Dinámico Vertical 9:16 (1080x1920) [cite: 4, 8]
       ├── 6. Renderizado de Subtítulos Dinámicos (.ass / .srt estilo palabra activa) [cite: 1, 11]
       └── 7. Generación de qc_report.json (Control de Calidad Técnica) [cite: 8]
       │
       ▼
(Orchestrator) ──> [Transición a PRODUCED_VALIDATED en state.json]
```
