# Investigación · @kikegallego_ · semana 2026-W49

> Agente investigador, 25/11/2026. Para el guionista y el revisor. Complementa `plan.md` de esta semana: los ganchos de las
> piezas 01, 02 y 03 están aquí, y también los de las ideas de reserva.

## 0. Cómo se ha hecho y qué limita esta investigación

- **Sin `APIFY_TOKEN`** (solo existe `.env.example`), así que no se ha usado `/hooklab <url>` ni se han descargado reels.
- **Sin Firecrawl** en esta sesión: no estaba disponible como herramienta. Se han hecho búsquedas web públicas por
  `curl`. Tras unas pocas consultas, DuckDuckGo y Brave empezaron a pedir captcha, y no he intentado saltármelo. Por eso
  las fuentes externas son pocas (5 guías públicas descargadas y leídas enteras) y no hay reels concretos del nicho
  analizados fotograma a fotograma. **No se ha entrado en Instagram de ninguna forma.**
- Las **cifras** de los ganchos salen solo de ficheros de los repositorios (rutas en la tabla 1). Donde no hay cifra real,
  va `[CIFRA]`.
- Los **patrones** (estructura de carrusel, de reel, tipos de gancho) salen de las guías externas de la sección 6. Se
  copia la técnica, nunca el texto.
- La **nota del checklist de HookLab** es la de texto/copy (5 puntos): afirmación sin matices · persona o situación
  concreta · hueco de información · apertura de menos de 10 palabras · lenguaje concreto (mejor con cifra). Solo pasan
  los que sacan 3/5 o más (≥ 50 %). La nota 1-10 es mi criterio de encaje con el público y con la voz.

**Pendiente para la semana que viene:** con `APIFY_TOKEN` o Firecrawl, pasar por `/hooklab` 5-10 reels hablados de
consultores tecnológicos y de automatización en español, y sacar preguntas literales de foros (ver sección 4).

---

## 1. Cifras reales que se pueden usar (y de dónde salen)

| Cifra | Fuente | Ojo |
|---|---|---|
| Revisor de presupuesto: 12 preguntas en 6 bloques | `C:\repos\kigalweb\data\revisor.ts` (`REVISOR_BLOCKS`, `REVISOR_QUESTIONS`) | |
| Director de tecnología en plantilla: 70.000-120.000 €/año brutos | `C:\repos\kigalweb\data\services.ts` (`CTO_COMPARISON`) | Es cifra **de mercado**, no un precio de Kike. Decirlo así |
| Análisis Ejecutivo: 390 € sin IVA, 90 min + informe escrito | `C:\repos\kigalweb\data\services.ts`, `faqs.ts`, `seo.ts` | **Los demás precios del copy deck (1.900 €, 4.500 €, 2.500 €/mes…) ya no están publicados**: `services.ts` dice «undisclosed (2026-11-09)». No usarlos |
| Primera conversación: 20 min, sin coste | `C:\repos\kigalweb\data\faqs.ts` | |
| Checklist: 10 procesos que sí se automatizan y 3 que no; 4 comprobaciones antes de automatizar | `C:\repos\kigaldevWeb\src\data\checklist.ts` | |
| Automatización de Procesos (Kigaldev): desde 1.497 € (hasta 3.997 €) | `C:\repos\kigaldevWeb\src\data\catalog.ts`, slug `automatizacion-procesos` | Comprobar con Kike si lleva IVA antes de usarlo en pantalla |
| Guía de Claude: 48 fichas en 9 categorías | `C:\repos\kigaldevWeb\src\data\guia-claude.ts` (según `plan.md`) | |
| Si buscas cuánto cuesta una tienda online, los artículos dan rangos de «500 a más de 60.000 €» | `C:\repos\kigaldevWeb\docs\estrategia-webs\22-demanda-y-contenidos.md` §3 racimo A, [Observado] | Son rangos de varios artículos de agencias, no de una sola. Decir «los artículos que salen en Google» |
| Si buscas en español «la empresa que me hizo la web no me contesta», los 9 primeros resultados estaban en inglés | mismo doc, §3 racimo B, [Observado] el 11/10/2026 | Fecha de la observación: octubre de 2026. Decir «cuando lo miré» o quitarlo |
| Guía «proveedor desaparecido»: 8 apartados, el primero «El dominio, hoy mismo» | `C:\repos\kigalweb\pages\GuiaProveedorDesaparecido.tsx` | No está en la tabla de imanes: necesita el visto bueno de Kike (`plan.md`, reserva 1) |
| Carrusel: 9 veces más guardados que la imagen única (24.364.803 publicaciones analizadas) | Metricool, Estudio de Instagram 2026, https://metricool.com/es/estudio-instagram/ | Dato para decidir formatos, **no para usar en las piezas** |

---

## 2. Ganchos candidatos (15, todos pasan el 50 %)

Leyenda del checklist HookLab: **A** afirmación sin matices · **P** persona/situación concreta · **H** hueco de
información · **10** menos de 10 palabras · **C** lenguaje concreto. Un ✓ por punto que cumple.

### P1 · Criterio antes del código

| # | Gancho (texto de portada o frase a cámara) | Formato | Principio | Patrón y fuente | HookLab | Nota |
|---|---|---|---|---|---|---|
| 1 | **«Antes de firmar el presupuesto de tu web, hazte estas 6 preguntas.»** (subtítulo: «La última es la que nadie se hace.») | Carrusel · **pieza 01** | Error común + hueco (la última) | Lista numerada en la portada; la «última» abre bucle (Luzzi, carrusel; Kalend, gancho de utilidad) | A✓ P✓ H✓ 10✗ C✓ · 4/5 | **9** |
| 2 | **«12 preguntas que tu presupuesto web tiene que aguantar.»** | Carrusel (alternativa a la 1) | Cifra + reto | Portada con número concreto y nicho explícito (Luzzi) | A✓ P✓ H✓ 10✓ C✓ · 5/5 | 8 |
| 3 | **«Tu agencia ya no contesta. Lo primero: el dominio.»** | Reel a cámara o carrusel · reserva 1 | Pérdida + resultado antes del cómo | Gancho de problema directo (Kalend); respuesta en la primera línea | A✓ P✓ H✓ 10✓ C✓ · 5/5 | **9** |
| 4 | **«¿El dominio de tu empresa está a tu nombre? Compruébalo hoy.»** | Reel corto (15-20 s) o historia | Pérdida + pregunta | Pregunta incisiva (Luzzi, guion de reel) | A✗ P✓ H✓ 10✓ C✓ · 4/5 | 8 |
| 5 | **«Busca cuánto cuesta una tienda online. Te dirán de 500 a 60.000 €.»** | Carrusel o reel | Contraste + cifra | Dato que sorprende, con fuente (Kalend: «evita los porcentajes redondos sin fuente») | A✓ P✓ H✓ 10✗ C✓ · 4/5 | 8 |
| 6 | **«Antes de firmar con una agencia, pregunta a nombre de quién va todo.»** | Reel a cámara | Error común | Prohibición o consejo directo (Luzzi) | A✓ P✓ H✗ 10✗ C✓ · 3/5 | 7 |
| 7 | **«Un director de tecnología en plantilla: 70.000-120.000 € al año.»** (segunda línea: «Antes de contratarlo, mira esto.») | Carrusel comparativo · reserva 3 | Cifra + contraste | Dato que sorprende + comparativa antes/después (Luzzi, desarrollo «antes vs después») | A✓ P✗ H✓ 10✓ C✓ · 4/5 | 7 |
| 8 | **«Si mañana tu proveedor cierra, ¿te quedas con todo lo que has pagado?»** (es la q11 del revisor) | Reel a cámara | Pérdida | Historia truncada / pregunta (Kalend) | A✗ P✓ H✓ 10✗ C✓ · 3/5 | 7 |

Notas de voz para P1:
- No escribir «CTO» en portada. El público no sabe qué es (`05-copy-deck-kikegallego.md`, decisión V2-LANG). «Director de
  tecnología»; «lo que en inglés llaman CTO a tiempo parcial» como mucho una vez, en el pie.
- La 5 y la 7 llevan cifras de mercado: el pie tiene que decir de dónde salen, y la pieza no puede insinuar que es el
  precio de Kike.
- La 3 y la 8 cuentan cosas que salen de la guía del proveedor desaparecido. Mientras Kike no la apruebe como destino, el
  CTA va a la primera conversación de 20 minutos o a «escríbeme por privado».

### P2 · Automatiza lo que toca (y no lo que no)

| # | Gancho | Formato | Principio | Patrón y fuente | HookLab | Nota |
|---|---|---|---|---|---|---|
| 9 | **«Hay tres cosas que yo no automatizaría en tu empresa. Aunque se pueda.»** | Reel a cámara · **pieza 03** | Contraste + honestidad (va contra lo que se espera de quien vende automatización) | Afirmación contraintuitiva (Kalend, tipo 2); lista cerrada de 3 | A✓ P✓ H✓ 10✓ C✓ · 5/5 | **9** |
| 10 | **«10 procesos que sí automatizaría en una pyme. Y 3 que no.»** | Carrusel sí/no | Cifra + contraste | Lista numerada + giro (Luzzi; kliche según la ficha de búsqueda: «un giro que corrija un error típico») | A✓ P✓ H✓ 10✓ C✓ · 5/5 | **9** |
| 11 | **«Tres cosas que le puedes pedir a Claude mañana en la oficina.»** (subtítulo: «Sin tocar una línea de código.») | Carrusel · **pieza 02** | Utilidad inmediata | Gancho de utilidad inmediata (Kalend, tipo 5) | A✓ P✓ H✓ 10✗ C✓ · 4/5 | 8 |
| 12 | **«Antes de automatizar nada, 4 preguntas. La primera: ¿la cuenta está a tu nombre?»** | Carrusel | Error común + pérdida | Lista numerada; une P1 y P2 (lo de la agencia que desaparece, aplicado a la automatización) | A✓ P✓ H✓ 10✓ C✓ · 5/5 | 8 |
| 13 | **«Tu automatización se va a romper. Lo que importa es quién se entera.»** | Reel a cámara | Contraintuitivo | Afirmación contraintuitiva que el desarrollo sostiene (Kalend) | A✓ P✗ H✓ 10✓ C✗ · 3/5 | 7 |
| 14 | **«No le des a una IA acceso a tu banco. Ni a tus anuncios.»** | Reel corto o diapositiva de la pieza 02 | Prohibición + pérdida | Gancho que prohíbe algo (Luzzi). Sale de la regla «Permisos mínimos, y nunca dinero» de la guía de Claude | A✓ P✗ H✓ 10✓ C✓ · 4/5 | 7 |
| 15 | **«¿Cuánto cuesta automatizar un proceso? Te lo digo con precio publicado.»** | Carrusel FAQ | Cifra + transparencia | Preguntas frecuentes, una por diapositiva (Kalend) | A✗ P✓ H✓ 10✓ C✓ · 4/5 | 7 |

Notas de voz para P2:
- El 9 y el 10 no pueden llevar «es más importante no automatizar que automatizar» ni nada parecido: la tentación del
  «no es X, es Y» está justo aquí. El texto de origen del 13 en `checklist.ts` dice «La pregunta no es si se rompe, es
  quién se entera»: **esa construcción está prohibida** en `voz.md`, por eso el gancho la reescribe.
- El 15 solo funciona si en la pieza aparece el precio real (desde 1.497 €, Automatización de Procesos de Kigaldev) y
  cuándo no compensa. El CTA es el checklist, nunca el pago.
- El 11: «sin coste extra sobre Claude», nunca «gratis» a secas (`plan.md`, pieza 02).

### Los 5 mejores (orden de prioridad)
1. **#9** «Hay tres cosas que yo no automatizaría en tu empresa. Aunque se pueda.» (pieza 03)
2. **#1** «Antes de firmar el presupuesto de tu web, hazte estas 6 preguntas.» (pieza 01)
3. **#3** «Tu agencia ya no contesta. Lo primero: el dominio.» (reserva 1, primer reel de la W50)
4. **#10** «10 procesos que sí automatizaría en una pyme. Y 3 que no.»
5. **#5** «Busca cuánto cuesta una tienda online. Te dirán de 500 a 60.000 €.»

Para las **pruebas de reel** (una al día como mucho), las variantes del 9 que tiene sentido enfrentar son: la versión
afirmación («Hay tres cosas que yo no automatizaría…») contra la versión prohibición («No automatices estas tres cosas,
aunque te lo vendan»). Mismo cuerpo y solo cambia la primera frase, así se mide el gancho y nada más.

---

## 3. Estructuras que encajan con alguien que empieza a grabarse

### Carruseles (4:5, 1080 × 1350, 7-10 diapositivas, una idea por diapositiva)

Reglas comunes a las cuatro (Kalend, Luzzi, creatit):
- La portada promete un resultado o señala un error, con número cuando lo haya. Una palabra destacada en el color de acento.
  Se tiene que leer en la miniatura del feed.
- **La diapositiva 2 no presenta a nadie.** O ahonda en el problema («si te ha pasado esto…») o enseña adónde llegas.
  Luzzi la llama «la más subestimada».
- Cada diapositiva cierra su idea y abre la siguiente (micro-bucle). Unas 2 s de lectura por diapositiva: si hay que leer
  un párrafo, se va.
- Última diapositiva: **una sola acción**. Nada de «gracias por leer» ni «espero que te sirva».
- El pie repite el gancho en la primera línea (se ve antes del «… más») y vuelve a poner el CTA.

**C1 · Lista de comprobación** («hazte estas N preguntas»). Para la pieza 01.
1. Portada: gancho + número. 2. Por qué importa: el problema en una frase con la situación del gerente (el presupuesto
encima de la mesa y nadie a quien preguntar). 3-8. Un bloque por diapositiva: la pregunta grande arriba y, debajo, una
línea de «qué tiene que poner por escrito». 9. Resumen guardable (las 6 en una lista). 10. CTA.
Fuente del patrón: Kalend (portada → contexto → una idea por slide → resumen → CTA), Luzzi (cierre «resumen accionable +
pedir que lo guarden»).

**C2 · Sí / no** («10 que sí, 3 que no»). Para el gancho #10 o como pareja del reel 03.
1. Portada. 2. La regla en una frase («primero lo que más se repite y menos criterio necesita»; está en
`22-demanda-y-contenidos.md`, racimo D). 3-6. Los «sí», agrupados de 2-3 por diapositiva, con su señal de «te suena si…».
7-9. Los 3 «no», uno por diapositiva y con otro color de fondo (el giro). 10. CTA CHECKLIST.
Fuente: Luzzi (desarrollo «errores y soluciones», «antes vs después»), kliche (el «giro» que corrige un error típico).

**C3 · Señal roja → qué pedir en su lugar.** Para P1 en semanas siguientes (presupuestos, agencias, contratos).
1. Portada («N señales de que un presupuesto te va a dar un disgusto»). 2. Ahondar en el problema. 3-7. Cada diapositiva
dividida: arriba la señal (en rojo apagado), abajo qué pedir (en el acento). 8. «Si tienes 2 o más…» (el criterio de Kike).
9. CTA. Las señales tienen que salir de `revisor.ts` o de la guía del proveedor desaparecido, no de cosecha propia.
Fuente: Luzzi («errores y soluciones: combina diagnóstico con solución, muy guardable»).

**C4 · Preguntas frecuentes** (una duda por diapositiva). Para el gancho #15 o #7.
1. Portada con la pregunta que da miedo hacer («¿Cuánto cuesta…?»). 2-7. Una pregunta por diapositiva, contestada en dos
líneas con la cifra publicada o con «depende de X y de Y» dicho en concreto. 8. Cuándo no compensa (la honestidad con los
límites de `voz.md`). 9. CTA.
Fuente: Kalend («Preguntas frecuentes: desactiva objeciones de venta sin sonar a venta»).

### Reels a cámara (9:16, grabados con el móvil)

Condiciones de grabación para quien empieza: móvil en vertical a la altura de los ojos, luz de ventana delante, plano medio
(de cintura o pecho para arriba), **una toma por frase** en vez de aprenderse el guion de corrido. El editor corta entre
tomas: ese corte cada 4-6 s ya es el ritmo que piden las guías y disimula los fallos. Subtítulos grabados en el vídeo
siempre (mucha gente lo ve sin sonido).

**R1 · Respuesta directa: «lo que yo haría, en orden»** · 25-35 s · unas 80-95 palabras
| Tramo | Qué se dice | Qué se ve | Texto en pantalla |
|---|---|---|---|
| 0-3 s | El gancho, sin saludo. La respuesta o la tesis va en la primera frase | Kike a cámara, ya hablando en el primer fotograma (sin «hola») | El gancho, palabra por palabra, arriba del todo, desde el fotograma 1 |
| 3-8 s | La situación del gerente en una frase, con una cifra si la hay | Corte a otra toma, encuadre algo más cerrado | La cifra sola, grande |
| 8-25 s | 3 pasos o 3 puntos, una frase cada uno | Un corte por punto; con la mano marca 1-2-3 | «1 ·», «2 ·», «3 ·» con 3-4 palabras cada uno |
| 25-30 s | Una sola acción: «Escríbeme X por privado» | Mirando a cámara | La palabra clave en mayúsculas |
Comprobaciones de HookLab que asegura (vídeo): sin intro antes del valor, texto en los 2 primeros segundos, cara en el
primer segundo, dos capas alineadas (frase dicha = texto en pantalla). Las otras dos (movimiento en el primer segundo,
audio que empieza a media frase) se pueden forzar en edición: arrancar la toma medio segundo después de que Kike empiece
a hablar, o con un pequeño acercamiento.
Fuentes: Luzzi (guion educativo: «95 palabras, unos 32 segundos hablados»; hook 1-3 s, desarrollo 4-25 s, cierre en los
últimos 3-5 s; «cada 5 o 6 segundos tiene que pasar algo»; «una sola idea por vídeo»), Kalend (sin «Hola, soy…»; el gancho
se escribe antes de grabar).
Encaja con: pieza 03 (alargada a 35-45 s porque son 3 puntos con su porqué), ganchos #3, #4, #6, #13, #14.

**R2 · Caso o trastienda con conflicto** · 35-45 s · unas 110-130 palabras
| Tramo | Qué se dice | Qué se ve | Texto en pantalla |
|---|---|---|---|
| 0-3 s | Empieza en el problema: «Me llamaron para X. Lo primero que hicimos no fue X.» | Kike a cámara, o el entregable real en mano si existe | La frase de apertura resumida |
| 3-12 s | El conflicto, con un dato real (antes del segundo 10) | Corte; si hay entregable o pantalla real, plano detalle | El dato |
| 12-35 s | Qué se decidió y en qué orden (2-3 decisiones) | Alternar Kike y el detalle | Una palabra por decisión |
| 35-45 s | Lo que puede aplicar quien ve el vídeo + una acción | A cámara | La acción |
Fuente: Luzzi (guion de historia: «el conflicto aparece antes del segundo 10»; situación → conflicto → punto de giro →
aprendizaje → CTA), Kalend (gancho de historia truncada).
Requisito: **solo con casos que tengan permiso escrito** (hoy, Mabby Wear) y con la cifra confirmada por Kike (ver reserva 2
de `plan.md`). Si no, usarlo para trastienda propia («cómo preparo una propuesta») sin nombrar a nadie.

---

## 4. Preguntas del público

**No he podido sacar preguntas literales de foros** esta semana: Reddit devuelve 403 a las peticiones automáticas y los
buscadores pedían captcha. Lo que sigue son las formulaciones recogidas en `22-demanda-y-contenidos.md` (11/10/2026). El
propio documento avisa: la existencia de cada racimo está observada en Google, pero **la redacción exacta es criterio
suyo**, no una cita. Sirven de gancho tal cual, pero hay que tratarlas como hipótesis.

Presupuestos (P1):
- «Me han pedido 15.000 euros por una web, ¿es mucho?»
- «¿Cómo saber si un presupuesto de página web es caro?»
- «¿Qué debe incluir un presupuesto de página web?»
- «¿Por qué una web cuesta 500 euros y otra 5.000?»

Proveedor que desaparece (P1):
- «La empresa que me hizo la web no me contesta.»
- «Mi programador se fue y nadie sabe cómo funciona la web.»
- «El dominio de mi empresa está a nombre de otra persona.»
- «No tengo las claves de mi propia página web.»
- «¿Cómo cambio de agencia sin perder la web?»

Automatización e IA (P2):
- «¿Cuánto cuesta automatizar un proceso en una empresa?»
- «¿Qué proceso automatizo primero?»
- «¿Cómo uso la IA en mi empresa sin saber programar?»
- «Tengo un Excel que solo entiende una persona.»

En cuanto empiecen a llegar comentarios y privados, `comment-mining` sobre ellos sustituye esta lista por citas reales.

---

## 5. Lo que NO hacer

**Palabras y giros prohibidos por `voz.md` y `proyecto.md`:** «revoluciona», «potencia», «desbloquea», «lleva tu negocio
al siguiente nivel», «gratis» (salvo lo que lo es de verdad; en la guía de Claude, «sin coste extra»), «subvencionado» o
«subvencionada», **«no es X, es Y»** y sus variantes («la pregunta no es A, es B», «el problema no era A, era B»), cierres
motivacionales, emojis en cada línea, anglicismos evitables («CTO» en portada, «onboarding», «stack», «MVP», «roadmap»,
«hack»).

**Clichés del nicho que he visto repetidos en las fuentes y en `22-demanda-y-contenidos.md`:**
- «La IA va a cambiar tu negocio» y similares. El racimo «IA para pymes» está saturado de artículos idénticos (doc 22,
  racimo F). Ir a lo concreto: una tarea, una herramienta, un límite.
- «Automatiza gratis con Zapier en 5 minutos». Es la promesa de hazlo tú mismo que domina las búsquedas, y Kike vende lo
  contrario (doc 22, racimo D).
- «Depende de muchos factores» como respuesta a un precio. Es justo lo que hacen todos los artículos de agencias (doc 22,
  racimo A). Si se habla de precio, se da una cifra publicada.
- «Ahorra 10-40 horas al mes» o «+X % de facturación». Son promesas de resultado: prohibidas por `proyecto.md` (garantías
  de proceso, no de resultados) y además son cifras ajenas.
- Hablar de Kit Digital, Kit Consulting o ayudas públicas (no hay ninguna abierta; regla de `proyecto.md`).
- Nombrar consultoras, agencias, competidores o clientes sin permiso escrito.

**Errores de formato que señalan todas las guías:**
- Empezar un reel con «Hola, soy Kike y hoy os voy a hablar de…».
- Una portada vaga («Consejos para tu web») o con demasiado texto para leerse en la miniatura.
- Dos ideas en un mismo reel o en una misma diapositiva.
- Pedir dos cosas al final (seguir y comentar y guardar…): una sola acción.
- Ganchos con porcentajes redondos sin fuente: «suenan a inventados» (Kalend). Aquí, además, está prohibido inventarlos.
- Copiar el texto de un gancho ajeno. Se modela la estructura; Instagram penaliza las copias y es plagio.

---

## 6. Fuentes

Externas (descargadas y leídas el 25/11/2026; sin login):
- Kalend, «Cómo hacer un carrusel de Instagram para tu negocio (estructura + plantilla)», 05/07/2026:
  https://getkalend.com/blog/como-hacer-carrusel-instagram-para-negocio/ (estructura de diapositivas, 7 formatos, errores, pie).
- Kalend, «15 hooks para Reels de negocios», 13/04/2026: https://getkalend.com/blog/hooks-para-reels-de-negocio/ (5 tipos
  de gancho: problema directo, contraintuitivo, dato, historia truncada, utilidad inmediata).
- Luzzi Digital, «Cómo hacer un carrusel de Instagram que genere guardados (estructura probada)», 2026:
  https://www.luzzidigital.com/como-hacer-un-carrusel-de-instagram-que-genere-guardados-estructura-probada/ (portada,
  diapositiva 2, micro-bucles, 6-10 diapositivas, 3 tipos de cierre).
- Luzzi Digital, «Cómo hacer un guion para Reels y TikTok que la gente vea hasta el final»:
  https://www.luzzidigital.com/como-hacer-un-guion-para-reels-y-tiktok-que-la-gente-vea-hasta-el-final/ (hook 1-3 s,
  ritmo cada 5-6 s, plantillas educativa e historia con número de palabras).
- Metricool, «Estudio de Instagram 2026»: https://metricool.com/es/estudio-instagram/ (carrusel: 9 veces más guardados
  que la imagen única; 24.364.803 publicaciones de más de 375.000 cuentas).
- creatit.es, guía de carruseles (solo el resumen de la búsqueda: «la última diapositiva pide guardar y deja una sola
  llamada a la acción»): https://www.creatit.es/blog-guia-carruseles-instagram-20-fotos
- kliche.es, «Plantilla para un carrusel en Instagram: estructura de 8 ideas que genera guardados» (solo el resumen de la
  búsqueda: «promesa clara, contexto, valor en pasos, un giro que corrija un error típico y un cierre»). No he conseguido
  la URL exacta.

Internas (cifras y vocabulario del público):
- `C:\repos\kigaldevWeb\docs\estrategia-webs\22-demanda-y-contenidos.md` (racimos de demanda, lo observado en Google).
- `C:\repos\kigaldevWeb\docs\estrategia-webs\05-copy-deck-kikegallego.md` (decisión V2-LANG sobre «CTO»).
- `C:\repos\kigalweb\data\revisor.ts`, `services.ts`, `faqs.ts`, `pages\GuiaProveedorDesaparecido.tsx`.
- `C:\repos\kigaldevWeb\src\data\checklist.ts`, `catalog.ts`, `src\app\recursos\guia-claude-para-negocios\page.tsx`.
- Ficha de competidor (patrón «publicar el precio» en un consultor individual español):
  `C:\repos\kigaldevWeb\docs\estrategia-webs\research\competitors\es-diego-manuel-bejar.md`. Solo como referencia de
  formato: no se nombra en las piezas.
