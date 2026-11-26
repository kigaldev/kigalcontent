# Plan · @kikegallego_ · semana 2026-W49 (lunes 30/11 – domingo 06/12/2026)

> Primera semana del canal: no hay métricas ni ganchos probados. Ritmo de `proyecto.md`: 3 piezas (2 carruseles + 1 reel
> que graba Kike). Objetivo de la semana: arrancar con lo que ya existe y es verificable (las tres herramientas de captación
> publicadas en las webs) y que Kike coja rodaje delante de la cámara.
>
> Horas en hora de Madrid. Ojo: el domingo 6/12 es festivo y el lunes 7/12 muchos hacen puente; por eso nada pasa del jueves.

## Las tres piezas

| # | Día y hora | Pilar | Formato | Gancho de trabajo | Objetivo | Destino con UTM | Lo que necesita de Kike |
|---|---|---|---|---|---|---|---|
| 01 · `presupuesto-6-preguntas` | lunes 30/11, 20:00 | P1 · Criterio antes del código (acento «criterio», fondo oscuro) | Carrusel 4:5, 8 diapositivas | «Antes de firmar el presupuesto de tu web, hazte estas seis preguntas. La última es la que nadie se hace.» | Guardados y conversaciones por privado: presentar la cuenta con su idea central (decidir antes de pagar) | `https://www.kikegallego.com/revisor-de-presupuesto?utm_source=instagram&utm_medium=social&utm_campaign=presupuesto-6-preguntas-w49` | Nada para producir. Contestar a mano los privados con la palabra PRESUPUESTO |
| 02 · `claude-sin-codigo` | miércoles 02/12, 14:00 | P2 · Automatiza lo que toca (acento «implementación», fondo claro) | Carrusel 4:5, 7 diapositivas | «Tres cosas que le puedes pedir a Claude mañana en la oficina, sin tocar una línea de código.» | Guardados y altas en la guía (lead en Airtable) | `https://www.kigaldev.com/recursos/guia-claude-para-negocios?utm_source=instagram&utm_medium=social&utm_campaign=claude-sin-codigo-w49&origen=instagram-claude-sin-codigo-w49` | Nada para producir. Contestar los privados con la palabra GUIA |
| 03 · `lo-que-no-automatizaria` | jueves 03/12, 20:00 | P2 · Automatiza lo que toca (y no lo que no) | Reel 9:16, 35-45 s, Kike a cámara | «Hay tres cosas que yo no automatizaría en tu empresa. Aunque se pueda.» | Rodaje de Kike + vistas y compartidos; altas en el checklist | `https://www.kigaldev.com/recursos/checklist-automatizacion?utm_source=instagram&utm_medium=social&utm_campaign=lo-que-no-automatizaria-w49&origen=instagram-lo-que-no-automatizaria-w49` | Grabar el reel (ver abajo) y contestar los privados con la palabra CHECKLIST |

Llamada a la acción, una por pieza (hasta la fase 3, sin bot):
- 01: «Escríbeme PRESUPUESTO por privado y te paso el revisor.»
- 02: «Escríbeme GUIA por privado y te la paso.»
- 03: «Escríbeme CHECKLIST por privado y te lo paso.»

Ninguna lleva a un pago: las tres son herramientas que ya están publicadas en las webs.

## Por qué este reparto
- **P1 abre la cuenta.** Es la frase de posicionamiento del plan (§3.1: «decide qué hay que hacer, en qué orden y cuánto cuesta»), y el revisor ya está en el hub de la bio (`kigalweb/data/enlaces.ts`).
- **P2 sale dos veces** porque los dos imanes de kigaldev.com existen y capturan el lead en Airtable. No meto P3 ni P4 esta semana:
  - P3 (afiliación): en `kigaldevWeb/src/data/tools.ts` hay 6 herramientas y ninguna tiene `published: true` («false until Kike confirms real use and the affiliate programme»). Sin eso no se puede declarar la afiliación con verdad. Queda en reserva.
  - P4 (Mabby Wear): el caso publicado tiene una contradicción (ver reserva 2). Mejor aclararla antes de usarlo.
- **Formatos:** carrusel → carrusel → reel, con los dos acentos de `marca.md` alternados (oscuro, claro). El reel va el último para que Kike tenga margen de grabar y revisar.

## Detalle por pieza y de dónde sale cada dato

### 01 · `presupuesto-6-preguntas` · carrusel P1
Estructura propuesta (el guionista la escribe):
1. Portada: el gancho.
2-7. Una diapositiva por bloque del revisor, con su pregunta resumen tal cual está en la web:
   Alcance («¿Sabes qué estás comprando?») · Propiedad del código y de las cuentas («¿Es tuyo de verdad?») · Mantenimiento («¿Y después de entregarlo?») · Plazos («¿Cuándo, y qué pasa si no?») · Dependencias («¿Te ata a él?») · Qué pasa si el proveedor desaparece («El peor día»). En cada una, como mucho una línea de las preguntas públicas q1-q12 (p. ej. q4: dominio y cuentas a nombre de tu empresa, con un correo tuyo).
8. Cierre y CTA.

| Dato | Fuente |
|---|---|
| 6 bloques, sus nombres y preguntas resumen; 12 preguntas con sus enunciados | `C:\repos\kigalweb\data\revisor.ts` (`REVISOR_BLOCKS`, `REVISOR_QUESTIONS`) |
| El revisor da «un semáforo claro y qué preguntarle a tu proveedor» y es gratis | `C:\repos\kigalweb\data\enlaces.ts` (entrada `revisor`) |
| URL `www.kikegallego.com/revisor-de-presupuesto` | `C:\repos\kigalweb\routes.tsx` y `SITE_URL` en `C:\repos\kigalweb\data\seo.ts` |

Cifra de la pieza: «12 preguntas, 6 bloques». No se cita ningún precio.
Aviso de medición: el revisor guarda el lead en Airtable con un «Origen CTA» que pone el servidor (`kigalweb/api/budget-review.ts`), no lee la URL. La UTM solo se verá en GA4 y solo si el visitante acepta cookies. Para saber si el lead viene de Instagram habrá que cruzar fechas o preguntar.

### 02 · `claude-sin-codigo` · carrusel P2
Estructura propuesta:
1. Portada: el gancho.
2. Gmail: «Resúmeme los correos de clientes de esta semana que siguen sin respuesta.»
3. Google Calendar: «Búscame una hora libre el jueves por la mañana para ver al gestor.»
4. Google Drive: «Busca el último contrato con este cliente y dime cuándo vence y con cuánto preaviso.»
5. Cómo se activa: en claude.ai, Ajustes → Conectores → Conectar, y «acepta solo los permisos que vayas a usar».
6. El límite honesto: Claude te deja las respuestas preparadas «para que las revises antes de mandarlas».
7. Cierre y CTA.

| Dato | Fuente |
|---|---|
| Las tres frases de ejemplo, «sin coste extra» sobre Claude, nivel «sin tocar código», qué hace cada conector | `C:\repos\kigaldevWeb\src\data\guia-claude.ts` (entradas `gmail`, `google-calendar`, `google-drive`: `level: 1`, `cost: 'sin-coste'`) |
| Pasos para activar un conector | mismo fichero, `CONNECTOR_STEPS` |
| La guía tiene 48 fichas en 9 categorías (si se quiere una cifra en el cierre) | mismo fichero, `GUIDE_ENTRIES` y `GUIDE_CATEGORIES`, revisado el 17/11/2026 (`GUIDE_UPDATED_AT`) |
| La guía lee `?origen=` y lo manda al lead | `C:\repos\kigaldevWeb\src\app\recursos\guia-claude-para-negocios\KitTool.tsx` |

Ojo: «sin coste» en la guía significa «sin coste extra sobre Claude». No escribir «gratis» a secas.

### 03 · `lo-que-no-automatizaria` · reel P2 (Kike a cámara)
Esqueleto (el guionista lo convierte en guion de 35-45 s):
- 0-3 s: gancho a cámara.
- Las tres, una frase cada una, con las palabras del checklist:
  1. Lo que cada uno hace a su manera («ahí no hay un proceso: hay tres»).
  2. Las conversaciones difíciles («un mensaje automático en esos cinco minutos no te ahorra tiempo: te cuesta el cliente»).
  3. Lo que puede acabar en Hacienda o con un abogado («"lo hizo el sistema" no es una respuesta»).
- Cierre: lo demás sí se automatiza. Hay 10 procesos que conviene mirar primero. CTA.

| Dato | Fuente |
|---|---|
| Las 3 que no se automatizan y su porqué | `C:\repos\kigaldevWeb\src\data\checklist.ts` (`CHECKLIST_EXCLUSIONS`) |
| «10 procesos que sí» | mismo fichero (`CHECKLIST_PROCESSES`, 10 entradas) |
| El checklist lee `?origen=` y lo guarda en Airtable como `checklist-<ruta>·<origen>` | `C:\repos\kigaldevWeb\src\app\recursos\checklist-automatizacion\ChecklistTool.tsx` y `ChecklistLeadForm.tsx` |
| Palabra clave CHECKLIST | `proyecto.md`, tabla de imanes |

## Lo que necesita de Kike
1. **Grabar el reel 03** antes del domingo 29/11 y dejarlo en `proyectos/kikegallego/brutos/`: 3 tomas completas del guion que le pasa el estudio, 35-45 s cada una, móvil en vertical a la altura de los ojos, luz de ventana delante. Unos 15 minutos.
2. **Contestar a mano los privados** con PRESUPUESTO, GUIA o CHECKLIST. El estudio le deja preparada la respuesta con el enlace de la tabla, para copiar y pegar.

No falta ningún dato para producir estas tres piezas.

## Notas para el director (no son tareas de Kike)
- **Dominios.** `proyecto.md` escribe `kigaldev.com` y `kikegallego.com` sin `www`, pero las dos webs declaran `https://www.` como URL canónica (`kigaldevWeb/src/data/catalog.ts` y `kigalweb/data/seo.ts`). En la tabla uso `www` para no depender de una redirección que se coma la UTM.
- **`origen` además de UTM.** Ninguna de las dos webs guarda `utm_*` en Airtable (no hay ninguna referencia a `utm_` en el código). Lo que sí guardan el checklist y la guía es `?origen=`, así que lo añado a sus enlaces. Si no, el objetivo de `proyecto.md` («cada lead entra en Airtable con utm_source=instagram») no se cumple. Merece un ticket en las webs.
- **Enlace de la bio.** El hub `https://www.kikegallego.com/enlaces` es el «link in bio» de las dos webs (`kigalweb/data/enlaces.ts`); en la bio, con `?utm_source=instagram&utm_medium=social&utm_campaign=bio`. En ese fichero el perfil de Instagram sigue con `published: false` y `href` vacío, así que no sale en el hub.

## Ideas de reserva
1. **P1 · «Si la empresa que te hizo la web no te contesta, lo primero no es la web: es el dominio.»** Reel o carrusel con el orden de la guía (dominio hoy mismo → correo antes que la web → qué es urgente y qué puede esperar). Fuente: `C:\repos\kigalweb\pages\GuiaProveedorDesaparecido.tsx`. Destino: `https://www.kikegallego.com/guias/proveedor-desaparecido?utm_source=instagram&utm_medium=social&utm_campaign=proveedor-dominio-w50`. No está en la tabla de imanes de `proyecto.md` ni en el hub: necesita el visto bueno de Kike.
2. **P4 · Mabby Wear: «Me llamaron para montar una tienda online. Lo primero que hicimos no fue la tienda.»** Hay permiso escrito del 11/10/2026. Fuente: `C:\repos\kigalweb\data\cases.ts` (`mabby-wear-mentoria`). [FALTA DATO: el caso dice «Cerca de 90 pedidos en el primer trimestre» (dato del 10/11/2026), y en la nota honesta «Este caso se publica sin cifras». Kike tiene que confirmar si la cifra se puede usar en Instagram. Sin esa confirmación, la pieza va sin cifra.]
3. **P1 · «Un director de tecnología en plantilla cuesta 70.000-120.000 € al año brutos. Antes de contratarlo, mira esto.»** Comparativa con lo que queda en tu empresa con cada opción. Fuente: `C:\repos\kigalweb\data\services.ts` (`CTO_COMPARISON`; la cifra es de mercado, no un precio de Kike, porque sus dos columnas van «a presupuesto a medida»). Destino: `https://www.kikegallego.com/contacto?utm_source=instagram&utm_medium=social&utm_campaign=cto-plantilla-w50`.

P3 (el arsenal) queda bloqueado hasta que exista al menos una herramienta con `published: true` en `C:\repos\kigaldevWeb\src\data\tools.ts`. [FALTA DATO: que Kike confirme qué herramientas usa de verdad y en qué programas de afiliación está dado de alta.]

## Ganchos de `memoria/ganchos.md` que reutilizo
Ninguno: el fichero está vacío porque es la primera semana. Los tres ganchos de esta semana son la primera prueba. Que el analista apunte su % de abandono en 3 s y su tiempo medio de visionado.
