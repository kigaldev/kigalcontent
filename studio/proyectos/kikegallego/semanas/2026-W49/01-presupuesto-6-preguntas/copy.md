# 01 · presupuesto-6-preguntas · copy del carrusel

- Formato: carrusel 4:5 (1080 x 1350), 8 diapositivas.
- Pilar: P1 · Criterio antes del código.
- Acento de marca: **criterio** (fondo `#0B0D10`, texto `#EDEFF1`, secundario `#B7BDC5`, **señal `#28D9FF`**: una sola cosa por diapositiva).
- Tipografía: titulares en Space Grotesk, cuerpo en IBM Plex Sans, números y etiquetas («1 · Alcance») en IBM Plex Mono. Monograma KG pequeño en una esquina.
- Estructura: la del plan (portada, un bloque del revisor por diapositiva, cierre). Cada titular de las diapositivas 2-7 es la pregunta resumen del bloque, copiada tal cual de `REVISOR_BLOCKS`. El cuerpo es como mucho una línea de las preguntas públicas q1-q12.

---

## Diapositiva 1 · portada
- **Titular:** Antes de firmar el presupuesto de tu web
- **Cuerpo:** Hazte estas seis preguntas. La última va sobre el peor día.
- **Señal:** «seis preguntas»
- **Visual:** solo texto, muy grande, mucho aire. Se tiene que leer en la miniatura del feed.
- **Fuente:** gancho del `plan.md` (pieza 01). He cambiado «La última es la que nadie se hace» porque «nadie» no se puede comprobar en ningún fichero. La nueva frase mantiene el bucle abierto y apunta al bloque 6 («El peor día»).

## Diapositiva 2 · bloque 1
- **Etiqueta (mono, pequeña):** 1 · Alcance
- **Titular:** ¿Sabes qué estás comprando?
- **Cuerpo:** Que ponga, función por función o página por página, qué entra en el precio y qué queda fuera.
- **Señal:** «qué queda fuera»
- **Fuente:** `revisor.ts`, bloque Alcance y q1.

## Diapositiva 3 · bloque 2
- **Etiqueta:** 2 · Propiedad del código y de las cuentas
- **Titular:** ¿Es tuyo de verdad?
- **Cuerpo:** El dominio y las cuentas (hosting, analítica, anuncios), a nombre de tu empresa y con un correo tuyo.
- **Señal:** «a nombre de tu empresa»
- **Fuente:** `revisor.ts`, bloque 2 y q4.

## Diapositiva 4 · bloque 3
- **Etiqueta:** 3 · Mantenimiento
- **Titular:** ¿Y después de entregarlo?
- **Cuerpo:** Lo que cuesta construirlo, separado de lo que costará mantenerlo cada mes.
- **Señal:** «cada mes»
- **Fuente:** `revisor.ts`, bloque 3 y q5.

## Diapositiva 5 · bloque 4
- **Etiqueta:** 4 · Plazos
- **Titular:** ¿Cuándo, y qué pasa si no?
- **Cuerpo:** Una fecha de entrega o, al menos, un plazo por escrito.
- **Señal:** «por escrito»
- **Fuente:** `revisor.ts`, bloque 4 y q7.

## Diapositiva 6 · bloque 5
- **Etiqueta:** 5 · Dependencias
- **Titular:** ¿Te ata a él?
- **Cuerpo:** Lo que te entregan, ¿podría mantenerlo otro proveedor o solo quien te lo hace?
- **Señal:** «otro proveedor»
- **Fuente:** `revisor.ts`, bloque 5 y q9.

## Diapositiva 7 · bloque 6 (la de guardar)
- **Etiqueta:** 6 · Qué pasa si el proveedor desaparece
- **Titular:** El peor día
- **Cuerpo:** Si mañana cierra o deja de contestar, ¿te quedas hoy mismo con una copia de todo lo pagado y con los accesos de administrador?
- **Señal:** «accesos de administrador»
- **Pie de diapositiva (texto-2, pequeño):** Guárdalo para cuando te llegue el próximo presupuesto.
- **Visual:** la diapositiva que cierra el bucle de la portada. Si cabe, debajo del pie una tira con las seis preguntas resumen en mono pequeño (Alcance · Propiedad · Mantenimiento · Plazos · Dependencias · El peor día), para que sirva de resumen guardable.
- **Fuente:** `revisor.ts`, bloque 6 y q11.

## Diapositiva 8 · cierre y llamada a la acción
- **Titular:** 12 preguntas, 6 bloques, sin jerga
- **Cuerpo:** El revisor te da un semáforo claro y qué preguntarle a tu proveedor. Escríbeme PRESUPUESTO por privado y te lo paso.
- **Señal:** «PRESUPUESTO»
- **Visual:** PRESUPUESTO en mayúsculas, en señal y en mono, como si fuera lo que hay que teclear.
- **Fuente:** `revisor.ts` (12 preguntas, 6 bloques); `kigalweb/data/enlaces.ts`, entrada `revisor` («sin jerga», «un semáforo claro y qué preguntarle a tu proveedor»).

---

## Lo que no lleva esta pieza
Ni precios, ni nombres de clientes ni de agencias, ni los tramos de importe del formulario del revisor (`AMOUNT_RANGES`), ni nada de lo que el revisor guarda en el servidor (pesos, banderas, preguntas al proveedor).
