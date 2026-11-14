### Dossier de Arquitectura de Software y Guía de Ingeniería E2E: Plataforma Web Autonomous Content Engine

La transformación de un sistema operativo de contenido conceptual en una plataforma web escalable, multiinquilino ( *multi-tenant* ) y de alta disponibilidad exige una arquitectura desacoplada que combine la reactividad de las interfaces modernas con la fiabilidad de los motores de ejecución duradera. En el ecosistema digital contemporáneo, donde plataformas como YouTube, TikTok, Instagram y LinkedIn evalúan el comportamiento segundo a segundo y penalizan la inconsistencia técnica, una solución de producción de medios no puede depender de scripts frágiles ni de procesos síncronos bloqueantes.  
Este documento establece la especificación técnica completa y el diseño de sistemas para construir la plataforma web del  **Autonomous Content Engine**  desde cero hasta su puesta en producción empresarial. La arquitectura abarca desde la captura e investigación semántica hasta el guionizado estructurado adaptado por duración y objetivo comercial, el procesamiento audiovisual determinista con aceleración por hardware, la publicación multicanal nativa mediante integraciones oficiales del Model Context Protocol (MCP) y el aprendizaje algorítmico continuo de bucle cerrado.

#### 1\. Topología del Sistema y Modelo C4 de Contenedores

La arquitectura global del sistema sigue un patrón de microservicios distribuidos orientados a eventos, complementado con una máquina de estados duradera que garantiza la consistencia transaccional y la trazabilidad de cada activo multimedia a lo largo de su ciclo de vida.  
Para comprender la interacción entre los diferentes subsistemas, la topología se divide en cuatro capas operativas independientes que interactúan mediante protocolos estándar de red:

##### Capa 1: Borde de Red, Enrutamiento y Autenticación Perimetral

El tráfico entrante es recibido por la red perimetral de Cloudflare Enterprise, responsable de la terminación TLS 1.3, la mitigación de ataques DDoS, la inspección mediante cortafuegos de aplicaciones web (WAF) y el almacenamiento en caché de activos estáticos. Detrás del borde, un controlador de ingreso basado en Envoy o Traefik dentro de un clúster de Kubernetes gestiona el balanceo de carga interno y enruta el tráfico hacia dos destinos principales: peticiones HTTP/REST y transmisiones en tiempo real mediante Server-Sent Events (SSE) y WebSockets. La identidad y los permisos se validan mediante tokens web JSON (JWT) emitidos tras autenticación OAuth2 o Single Sign-On (SSO).

##### Capa 2: Servicios de Aplicación y Orquestación de Flujos

Esta capa alberga el núcleo de la lógica de negocio y se compone de tres servicios desacoplados:

1. **Servicio API Central (FastAPI):**  Gestiona las operaciones transaccionales síncronas, la administración de espacios de trabajo, los perfiles de los creadores y las consultas a la base de datos relacional.  
2. **Servicio de Eventos en Tiempo Real (Node.js / Bun):**  Mantiene conexiones WebSocket y SSE activas con los navegadores de los clientes para retransmitir el progreso de los agentes, las trazas de razonamiento y el estado de renderizado de video sin saturar el hilo principal de la API.  
3. **Servicio de Ejecución Duradera (Temporal.io):**  Actúa como el gobernador inmutable de la Máquina de Estados Finita (FSM). Cada pieza de contenido se asocia a un flujo de trabajo duradero que orquesta la investigación, la aprobación de guiones, la transcodificación y la publicación, asegurando la recuperación automática ante fallos de infraestructura.

##### Capa 3: Clústeres de Cómputo Especializado y Motores de Agentes

La ejecución pesada no se ejecuta en los servidores web, sino en clústeres de trabajadores especializados:

1. **Hub de Agentes e Integración MCP:**  Entorno de ejecución en Python y Node.js que aloja el SDK de Anthropic Claude 3.7. Gestiona las sesiones del Model Context Protocol (MCP) para conectar los agentes con herramientas de búsqueda externa, auditoría y APIs sociales oficiales.  
2. **Clúster de Trabajadores Audiovisuales (Media Workers):**  Grupos de contenedores que ejecutan trabajadores Celery con acceso a GPUs dedicadas. Ejecutan binarios optimizados de FFmpeg 7 para corte de silencios, normalización de sonoridad EBU R128 y composiciones verticales, así como modelos de inteligencia artificial como faster-whisper para transcripción fonética palabra por palabra.

##### Capa 4: Persistencia Políglota y Almacenamiento Distribuido

El almacenamiento se organiza según los patrones de acceso y la naturaleza de los datos:

1. **Base de Datos Relacional y Vectorial (PostgreSQL 16 \+ pgvector):**  Almacena el modelo relacional completo, las tablas de auditoría y los embeddings de 1536 dimensiones que alimentan la Bóveda de Ideas y la Bóveda de Ganchos.  
2. **Caché en Memoria y Cola de Mensajería (Redis Enterprise):**  Gestiona el almacenamiento en caché de segundo nivel, los limitadores de tasa de llamadas ( *rate limiters* ) distribuidos y los canales Pub/Sub para eventos en vivo.  
3. **Almacenamiento de Objetos (Cloudflare R2 / AWS S3):**  Depósito de archivos crudos de video, pistas de audio, masters procesados, exportaciones de carruseles PDF y copias de seguridad cifradas.  
4. **Bóveda de Secretos Criptográficos (HashiCorp Vault / AWS Secrets Manager):**  Almacena y rota las claves de API, las credenciales OAuth2 de las redes sociales y las claves maestras de cifrado AES-256.

Contenedor / Servicio,Tecnología Principal,Responsabilidad de Dominio,Mecanismo de Comunicación  
Web Frontend,Next.js 15 / React 19,"Interfaz SPA, editor de guión AV, simulador de plataformas y paneles analíticos.",HTTPS / WSS hacia API Gateway  
API Gateway,Traefik / Envoy,"Enrutamiento perimetral, terminación SSL, validación JWT y control de flujo.",Balanceo de carga hacia Pods K8s  
Core API Service,FastAPI (Python 3.12),"Endpoints REST, CRUD relacional, gestión de proyectos y gobernanza de permisos.",HTTP REST / SQLAlchemy 2.0  
Workflow Engine,Temporal.io Server,"Gestión de flujos duraderos, FSM, reintentos exponenciales y señales HITL.",gRPC hacia SDK de Temporal  
Agent Core & MCP,Claude 3.7 / LangGraph,"Invocación de LLMs, síntesis de briefs, redacción AV y comunicación MCP.",JSON-RPC sobre stdio / SSE  
Media Workers,Celery \+ GPU Workers,"Transcripción faster-whisper, corte FFmpeg, mezcla EBU R128 y quemado de subtítulos.",Redis Broker / Cloudflare R2  
Primary Database,PostgreSQL 16 \+ pgvector,"Entidades relacionales, pistas de auditoría inmutables y búsqueda semántica.",Conexiones TCP pool (pgBouncer)  
Secrets Manager,HashiCorp Vault,Custodia cifrada de tokens OAuth2 de redes sociales y claves de plataforma.,HTTPS API con rotación periódica

#### 2\. Arquitectura del Frontend y Experiencia de Usuario

La interfaz de usuario debe traducir la complejidad de un sistema multiagente en una experiencia de control fluida para el creador o su equipo. El diseño rechaza los formularios estáticos tradicionales y adopta un espacio de trabajo modular centrado en el contenido.

##### Decisiones Técnicas del Cliente Web

El frontend está construido sobre Next.js 15 utilizando el App Router y componentes de React 19\. La gestión de datos asíncronos de servidor se centraliza en TanStack Query v5, lo que permite implementar mutaciones optimistas y revalidaciones silenciosas en segundo plano. El estado local y las preferencias de interfaz se controlan mediante almacenes ligeros de Zustand.  
La capa visual se implementa con Tailwind CSS v4 y componentes accesibles de Radix UI encapsulados a través de shadcn/ui. Para asegurar la tipificación estricta de extremo a extremo, todos los esquemas de intercambio de datos se validan con Zod, compartiendo definiciones de tipos entre el cliente y el servidor.

##### Componentes Complejos Especializados

La plataforma integra tres componentes interactivos de alta complejidad técnica:

###### *1\. Editor de Guión Audiovisual a Dos Columnas (Split-Script Studio)*

Basado en una arquitectura headless con Tiptap, este componente organiza el guión en filas sincronizadas compuestas por dos columnas interdependientes: la columna visual (planos, b-roll, overlays gráficos, atrezzo) y la columna sonora (locución, música de fondo, efectos de sonido). Cada fila calcula en tiempo real su duración estimada en segundos a partir de la tasa media de habla (aproximadamente 2.5 palabras por segundo). Si una sección excede la ventana temporal configurada, la interfaz resalta el bloque en color ámbar para advertir de una pérdida inminente de dinamismo.

###### *2\. Selector Paramétrico de Duración y Objetivo de Negocio*

Ubicado en la cabecera del editor, permite al usuario alternar entre cuatro modalidades de duración: Micro-Short (15 a 30 segundos), Standard Short (45 a 60 segundos), Extended Short (90 a 180 segundos) y Long-Form (8 a 12 minutos). Simultáneamente, el usuario selecciona el objetivo comercial del contenido a partir del catálogo configurado en el perfil del creador: captación de suscriptores para lista de correo propia, cualificación para llamadas de venta B2B, distribución relacional masiva ( *Sends per Reach* ) o bucle de retención interna. La selección modula automáticamente las restricciones de longitud del guión y sugiere la estructura de llamada a la acción (CTA) correspondiente.

###### *3\. Simulador de Interfaces Móviles y Zonas Seguras*

Un visor dinámico renderiza la previsualización del video o de la portada superponiendo las capas transparentes de la interfaz nativa de cada plataforma (el bloque de botones derecho de TikTok, la caja inferior de pie de foto en Instagram Reels o la barra de búsqueda superior en Shorts). Esto asegura que los elementos críticos —como el rostro del presentador, las cifras clave o los subtítulos animados— se mantengan estrictamente dentro del 70% central vertical, evitando que los iconos nativos tapen la información y arruinen la tasa de retención.

#### 3\. Arquitectura del Backend y Máquina de Estados Finita (FSM)

El backend de la plataforma se estructura en torno al patrón de ejecución duradera utilizando Temporal.io. Este diseño elimina el riesgo de estados inconsistentes provocados por reinicios de contenedores, agotamiento de memoria en transcodificaciones pesadas o caídas temporales de las APIs de las redes sociales.

##### Definición Formal de la Máquina de Estados

Cada pieza de contenido dentro de un espacio de trabajo se modela como un activo con un ciclo de vida estricto compuesto por ocho estados secuenciales. Cada transición exige el cumplimiento de invariantes técnicas y condiciones de guardia:  
Estado Actual,Transición Permitida,Disparador / Evento,Condición de Guardia ( Guard ),Efecto Secundario ( Side Effect )  
INIT,CAPTURED,Comando de captura o webhook de idea,Concepto no vacío y origen identificado,Asignación de ID único y cálculo de vector de embedding  
CAPTURED,RESEARCHED\_TRIAGED,Finalización de tarea de investigación,Cálculo de puntuación ICE completado y TAM asignado,"Si ICE \>= 7.0, pasa a triage; si ICE \< 4.0, transiciona a ARCHIVED"  
RESEARCHED\_TRIAGED,SCRIPTED\_PACKAGED,Finalización de redacción de guión AV,Guión a 2 columnas validado y 2 variantes A/B de empaque listas,Bloqueo preventivo: emisión de solicitud de aprobación Tier 2  
SCRIPTED\_PACKAGED,HITL\_PENDING\_PRODUCTION,Recepción de token de aprobación de guión,Firma válida del creador en interfaz web,Habilitación de la bandeja de subida de archivos crudos  
HITL\_PENDING\_PRODUCTION,PRODUCED\_VALIDATED,Finalización de pipeline audiovisual,QC Report aprobado: sonoridad en \-14 LUFS y subtítulos renderizados,Bloqueo preventivo: emisión de solicitud de aprobación Tier 3  
PRODUCED\_VALIDATED,HITL\_PENDING\_PUBLISH,Inspección del master por el creador,Master previsualizado en el simulador de canal,Preparación de borradores y cálculo de ventanas de publicación  
HITL\_PENDING\_PUBLISH,PUBLISHED\_LIVE,Aprobación final y firma criptográfica,Token HITL Tier 3 firmado con doble factor (2FA),Llamada a APIs de redes sociales y programación de cron analítico  
PUBLISHED\_LIVE,AUDITED\_CLOSED\_LOOP,Vencimiento de ventana temporal (24h/7d/30d),Métricas extraídas exitosamente desde APIs nativas,Clasificación RMT-A e inyección de reglas en la Bóveda de Ganchos

##### Recuperación ante Fallos y Reintentos Exponenciales

Las actividades de Temporal.io que interactúan con servicios externos (como APIs de transcripción o publicación) implementan políticas de reintento avanzadas:

* Intervalo inicial de reintento: 5 segundos.  
* Coeficiente de retroceso exponencial: 2.0.  
* Intervalo máximo de reintento: 300 segundos.  
* Intentos máximos: 8 reintentos con descarte controlado hacia la cola de mensajes no procesables ( *Dead Letter Queue* ), notificando al equipo mediante canales de observabilidad.

#### 4\. Motor de Agentes y Capa de Integración MCP

El sistema operativo de agentes no delega la lógica de negocio a llamadas opacas a modelos de lenguaje, sino que estructura la ejecución mediante un bus de herramientas gobernado por el Model Context Protocol (MCP).

##### El Administrador de Clientes MCP (MCP Client Hub)

En el backend, el servicio de agentes mantiene un pool de conexiones persistentes con servidores MCP independientes mediante procesos de subproceso locales (stdio) o clientes HTTP con Server-Sent Events (SSE).  
Cuando un agente necesita realizar una investigación o consultar una base de datos, el orquestador no le permite inventar parámetros: le expone el esquema estricto de herramientas definido por el servidor MCP correspondiente. Cada llamada a una herramienta viaja como un mensaje JSON-RPC 2.0 validado bidireccionalmente.  
{  
  "jsonrpc": "2.0",  
  "method": "tools/call",  
  "params": {  
    "name": "publish\_reel",  
    "arguments": {  
      "video\_url": "https\://cdn.platform.internal/assets/VID-101/master\_916.mp4",  
      "caption": "Jensen Huang dirige una empresa de 3T\$... pero tiene 0 horas libres al día.",  
      "share\_to\_feed": true,  
      "hitl\_token": "HITL\_AUTH\_CREATOR\_OK\_9842"  
    }  
  },  
  "id": "req-0042"  
}

##### Catálogo de Servidores MCP y Especialización de Agentes

El ecosistema integra cinco servidores MCP primarios:

1. **server-brave-search**  **:**  Proporciona capacidades de búsqueda semántica e investigación de hechos históricos o técnicos para el agente ResearcherStrategist.  
2. **server-filesystem**  **:**  Permite al agente PostproducerEditor gestionar las rutas locales de medios, leer transcripciones temporales y verificar la existencia de archivos finales.  
3. **youtube-mcp-server**  **:**  Expone endpoints para carga de videos en modo oculto ( *unlisted* ), gestión de experimentos nativos de Test & Compare y extracción de cuotas de tiempo de visualización ( *Watch Time Share* ).  
4. **meta-content-mcp-server**  **:**  Gestiona la carga de Reels, la verificación de marcos de portada ( *cover frames* ) y la extracción de métricas de envíos por mensaje directo ( *Sends per Reach* ).  
5. **linkedin-mcp-server**  **:**  Controla la publicación de documentos en formato carrusel PDF nativo, aplica la regla de cero enlaces en el cuerpo principal y programa el enlace de captura en el primer comentario.

#### 5\. Pipeline Audiovisual Asíncrono de Alto Rendimiento

El procesamiento de archivos multimedia es una de las áreas más críticas del sistema. Un error en la sincronización de audio o en la posición de los subtítulos degrada inmediatamente la retención de la audiencia. El pipeline de medios opera en cinco fases estrictamente auditadas.

##### Fases de Ejecución del Pipeline Audiovisual

###### *Fase 1: Ingesta y Análisis Forense del Crudo*

El usuario sube sus grabaciones directamente al almacenamiento de objetos mediante URLs prefirmadas emitidas por la API. Al completarse la subida, un worker lanza una sonda con ffprobe para verificar los parámetros de entrada: resolución nativa mínima de 1080p, tasa de cuadros de 30 o 60 fps y presencia de pista de audio estéreo sin distorsiones digitales de nivel.

###### *Fase 2: Transcripción Fonética Palabra por Palabra (Whisper)*

El trabajador extrae la pista vocal en formato WAV a 16 kHz mono y la envía al motor faster-whisper ejecutándose sobre GPU con precisión float16. El modelo genera una estructura JSON exhaustiva donde cada palabra individual cuenta con su marca de inicio y fin en milisegundos y su probabilidad de confianza acústica.

###### *Fase 3: Poda Algorítmica de Silencios Muertos*

Para evitar la pérdida de retención provocada por pausas excesivas en los primeros segundos del video, el sistema aplica un filtro de detección de silencios:  
ffmpeg \-i input.mp4 \-af silencedetect=noise=-35dB:d=0.4 \-f null \-

El script analiza las marcas devueltas y genera un mapa de cortes para eliminar automáticamente cualquier pausa superior a  **400 milisegundos** . A continuación, los fragmentos se empalman sin desfase temporal en el audio.

###### *Fase 4: Normalización de Sonoridad según Estándar EBU R128*

Para evitar que las plataformas apliquen compresiones algorítmicas destructivas sobre el audio, se procesa la sonoridad en dos pasadas utilizando el filtro loudnorm:  
ffmpeg \-i cut\_audio.wav \-af loudnorm=I=-14.0:LRA=7.0:TP=-1.0:print\_format=json \-f null \-

El audio resultante se fija exactamente en  **\-14.0 LUFS**  de sonoridad integrada con un pico verdadero máximo de  **\-1.0 dBFS** , garantizando una audición clara y contundente tanto en dispositivos móviles como en altavoces externos.

###### *Fase 5: Re-encuadre 9:16 y Quemado de Subtítulos Dinámicos*

El video se re-encuadra a 1080x1920 píxeles manteniendo al interlocutor en la retícula central. La transcripción se transforma en un archivo de subtítulos estilizados en formato Advanced SubStation Alpha (.ass), configurando animaciones de resaltado por palabra y posicionando el texto en la zona segura (a una altura del 45% al 65% del fotograma). La renderización final se ejecuta mediante codificación acelerada por hardware:  
ffmpeg \-hwaccel cuda \-i input.mp4 \-vf "ass=subtitles.ass" \-c:v h264\_nvenc \-b:v 8M \-maxrate 10M \-bufsize 16M \-c:a aac \-b:a 320k master\_output.mp4

#### 6\. Modelo de Datos Relacional y Esquema PostgreSQL

El esquema de la base de datos centraliza la información operativa de la plataforma. La arquitectura se implementa sobre PostgreSQL 16 utilizando la extensión vectorial pgvector para permitir búsquedas por similitud semántica.  
\-- Habilitar extensión para mapas vectoriales  
CREATE EXTENSION IF NOT EXISTS vector;

\-- Tabla de Espacios de Trabajo (Tenants)  
CREATE TABLE workspaces (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    name VARCHAR(255) NOT NULL,  
    plan\_tier VARCHAR(50) NOT NULL DEFAULT 'PRO',  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Perfil de Contexto del Creador (Context Engine)  
CREATE TABLE creator\_profiles (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    creator\_name VARCHAR(255) NOT NULL,  
    niche VARCHAR(255) NOT NULL,  
    target\_icp TEXT NOT NULL,  
    active\_goal VARCHAR(50) NOT NULL, \-- EMAIL\_LEAD\_CAPTURE, B2B\_INBOUND, SHARES, RETENTION  
    lead\_magnets JSONB NOT NULL DEFAULT '\[\]'::jsonb,  
    voice\_guidelines TEXT,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Bóveda de Ideas y Priorización Cuantitativa ICE  
CREATE TABLE ideas (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    concept\_title TEXT NOT NULL,  
    source\_origin VARCHAR(100) NOT NULL,  
    impact\_score NUMERIC(3,1) CHECK (impact\_score BETWEEN 1.0 AND 10.0),  
    confidence\_score NUMERIC(3,1) CHECK (confidence\_score BETWEEN 1.0 AND 10.0),  
    ease\_score NUMERIC(3,1) CHECK (ease\_score BETWEEN 1.0 AND 10.0),  
    ice\_score NUMERIC(3,1) GENERATED ALWAYS AS (ROUND((impact\_score \+ confidence\_score \+ ease\_score) / 3.0, 1)) STORED,  
    tam\_classification VARCHAR(50) NOT NULL DEFAULT 'CORE\_80',  
    triage\_status VARCHAR(50) NOT NULL DEFAULT 'UNPRIORITIZED',  
    semantic\_embedding vector(1536),  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Pipeline de Activos de Contenido (Instancias FSM)  
CREATE TABLE content\_assets (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    idea\_id UUID REFERENCES ideas(id) ON DELETE SET NULL,  
    asset\_code VARCHAR(50) UNIQUE NOT NULL,  
    working\_title VARCHAR(255) NOT NULL,  
    target\_duration VARCHAR(50) NOT NULL,  
    conversion\_goal VARCHAR(50) NOT NULL,  
    current\_state VARCHAR(50) NOT NULL DEFAULT 'INIT',  
    temporal\_workflow\_id VARCHAR(255),  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Guiones Audiovisuales a Dos Columnas y Empaque  
CREATE TABLE scripts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    asset\_id UUID NOT NULL REFERENCES content\_assets(id) ON DELETE CASCADE,  
    script\_version INT NOT NULL DEFAULT 1,  
    two\_column\_blocks JSONB NOT NULL,  
    hook\_variants JSONB NOT NULL,  
    selected\_hook\_index INT DEFAULT 0,  
    word\_count INT NOT NULL,  
    estimated\_duration\_sec NUMERIC(5,1) NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Registros de Producción y Control de Calidad  
CREATE TABLE media\_productions (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    asset\_id UUID NOT NULL REFERENCES content\_assets(id) ON DELETE CASCADE,  
    raw\_media\_url TEXT NOT NULL,  
    master\_media\_url TEXT,  
    transcription\_json JSONB,  
    silences\_trimmed INT DEFAULT 0,  
    measured\_lufs NUMERIC(4,1),  
    true\_peak\_dbfs NUMERIC(4,1),  
    qc\_passed BOOLEAN DEFAULT FALSE,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Publicaciones Multicanal y Despliegue  
CREATE TABLE publications (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    asset\_id UUID NOT NULL REFERENCES content\_assets(id) ON DELETE CASCADE,  
    channel VARCHAR(50) NOT NULL,  
    external\_platform\_id VARCHAR(255),  
    canonical\_url TEXT,  
    post\_body TEXT NOT NULL,  
    first\_comment TEXT,  
    hashtags JSONB DEFAULT '\[\]'::jsonb,  
    publish\_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  
    scheduled\_at TIMESTAMP WITH TIME ZONE,  
    published\_at TIMESTAMP WITH TIME ZONE,  
    hitL\_approval\_token VARCHAR(255),  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Métricas Temporales de Bucle Cerrado (24h, 7d, 30d)  
CREATE TABLE performance\_snapshots (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    publication\_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,  
    window\_type VARCHAR(10) NOT NULL,  
    view\_count BIGINT DEFAULT 0,  
    hold\_rate\_3s NUMERIC(5,2),  
    completion\_rate NUMERIC(5,2),  
    watch\_time\_share NUMERIC(5,2),  
    sends\_per\_reach NUMERIC(5,2),  
    dwell\_time\_seconds NUMERIC(6,1),  
    outlier\_multiplier NUMERIC(4,2),  
    recorded\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Bóveda de Ganchos Validada y Memoria de Aprendizajes  
CREATE TABLE hook\_vault (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    hook\_text TEXT NOT NULL,  
    hook\_type VARCHAR(100) NOT NULL,  
    verdict VARCHAR(50) NOT NULL,  
    observed\_hold\_rate NUMERIC(5,2),  
    semantic\_vector vector(1536),  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Pistas de Auditoría Inmutables  
CREATE TABLE audit\_logs (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    action\_type VARCHAR(100) NOT NULL,  
    agent\_or\_user\_id VARCHAR(255) NOT NULL,  
    security\_tier INT NOT NULL,  
    operation\_status VARCHAR(50) NOT NULL,  
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,  
    ip\_source VARCHAR(45),  
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Índices de Rendimiento y Búsqueda  
CREATE INDEX idx\_content\_assets\_state ON content\_assets(workspace\_id, current\_state);  
CREATE INDEX idx\_publications\_channel\_status ON publications(channel, publish\_status);  
CREATE INDEX idx\_performance\_snapshots\_window ON performance\_snapshots(publication\_id, window\_type);  
CREATE INDEX idx\_hook\_vault\_vector ON hook\_vault USING hnsw (semantic\_vector vector\_cosine\_ops);

#### 7\. Motor de Publicación Multicanal y Captura Analítica

La capa de distribución conecta los masters terminados con las APIs de las redes sociales respetando los estándares de empaque y las restricciones de formato de cada destino.

##### Reglas Algorítmicas de Copycrafting por Canal

El motor genera descripciones optimizadas según los factores de posicionamiento documentados en los estudios del sector:

1. **Instagram Reels:**  La primera línea no debe superar los 120 caracteres para evitar que quede oculta tras el botón de pliegue. Se añaden entre 3 y 5 etiquetas temáticas de nicho y se orienta la frase final a generar envíos por mensaje directo ( *Sends per Reach* ).  
2. **TikTok:**  El texto se estructura como una consulta directa para el motor de búsqueda interno de TikTok ( *Social Search* ). El cierre plantea un dilema abierto para estimular los comentarios durante los primeros 30 minutos de prueba algorítmica.  
3. **LinkedIn:**  El texto se formatea con líneas cortas y saltos de espacio limpios para prolongar el tiempo de lectura en pantalla ( *Dwell Time* ). Se prohíben estrictamente los enlaces externos dentro del cuerpo del mensaje para evitar penalizaciones en el modelo 360Brew; el enlace de conversión se programa automáticamente en el primer comentario o el contenido se entrega como documento PDF deslizable.  
4. **YouTube Shorts / Long-Form:**  Los títulos se acortan a un máximo de 50 caracteres para asegurar su legibilidad completa en dispositivos móviles. Los videos de formato largo generan automáticamente marcas de tiempo ( *timestamps* ) para estructurar los capítulos y facilitar el descubrimiento orgánico.

##### Evaluación de Experimentos A/B mediante Cuota de Tiempo de Visualización

En las pruebas nativas de YouTube Test & Compare, el sistema no selecciona la variante ganadora basándose únicamente en el porcentaje de clics (CTR). Siguiendo las directrices técnicas de la plataforma, el evaluador calcula la  **Cuota de Tiempo de Visualización (**  ***Watch Time Share***  **)** :  
\$\$\\text{Watch Time Share}\_A \= \\frac{\\text{Impresiones}\_A \\times \\text{CTR}\_A \\times \\text{AVD}\_A}{(\\text{Impresiones}\_A \\times \\text{CTR}\_A \\times \\text{AVD}\_A) \+ (\\text{Impresiones}\_B \\times \\text{CTR}\_B \\times \\text{AVD}\_B)} \\times 100\$\$  
Donde  \$\\text{AVD}\$  representa la duración media de visualización en segundos. Si una variante A obtiene un CTR del 8% pero una retención de 40 segundos, mientras que la variante B obtiene un CTR del 5% pero una retención de 180 segundos, la variante B resulta ganadora al aportar más de un 70% del tiempo total de consumo acumulado.

#### 8\. Gobernanza de Seguridad y Control Humano (HITL)

Para evitar publicaciones accidentales o desviaciones no deseadas en el tono de marca, la arquitectura implementa una política estricta de seguridad en tres niveles jerárquicos:

##### Nivel 1: Automatización Segura (Tier 1\)

Acciones de bajo riesgo ejecutadas sin intervención humana directa:

* Rastreo e indexación de fuentes públicas en la web.  
* Cálculo matemático del índice ICE y clasificación preliminar de ideas.  
* Generación de borradores de escaleta y estimación de tiempos de locución.  
* Corte algorítmico de pausas y renderizado de subtítulos en previsualización local.  
* Consultas de solo lectura en las APIs analíticas de las plataformas.

##### Nivel 2: Revisión Creativa y Estratégica (Tier 2\)

Puntos de control donde el sistema detiene el avance hasta recibir la aprobación del creador en la interfaz web:

* Aprobación definitiva del guión audiovisual a dos columnas antes de iniciar la sesión de rodaje.  
* Selección final de la variante de título y miniatura que participará en el experimento A/B.  
* Autorización para incorporar nuevas reglas o modificaciones a la Bóveda de Ganchos.

##### Nivel 3: Despliegue Irreversible y Compromiso Externo (Tier 3\)

Operaciones críticas que exigen una firma explícita y autenticación reforzada:

* Emisión de publicaciones visibles al público en cualquier red social.  
* Eliminación permanente de archivos crudos de video en el almacenamiento de objetos.  
* Modificación o sustitución de credenciales de acceso y tokens OAuth2.  
* Activación de campañas de distribución publicitaria de pago.

El flujo de autorización Tier 3 exige que el creador revise el activo terminado en el simulador de canal y firme la acción mediante un token criptográfico efímero (HITL\_AUTH\_CREATOR\_OK), el cual se registra con su dirección IP y marca de tiempo en la tabla inmutable audit\_logs.

#### 9\. Infraestructura, DevOps y Observabilidad en Producción

La plataforma se despliega como una infraestructura reproducible definida mediante código con Terraform sobre clústeres gestionados de Kubernetes (EKS en AWS o GKE en Google Cloud Platform).

##### Estrategia de Autoescalado y Aislamiento de Cargas

El clúster de Kubernetes se divide en dos grupos de nodos ( *node pools* ):

1. **Grupo de Nodos Generales (CPU):**  Instancias m6i.xlarge que ejecutan los pods web de Next.js, la API de FastAPI, el servidor de Temporal.io y los controladores de ingreso. Escalan horizontalmente en función del porcentaje de uso de CPU y memoria mediante el Horizontal Pod Autoscaler (HPA).  
2. **Grupo de Nodos de Medios (GPU):**  Instancias g4dn.xlarge (con GPUs NVIDIA T4) dedicadas exclusivamente a los pods de Celery que ejecutan transcodificación con FFmpeg y transcripción con faster-whisper. El escalado de este grupo no depende de la CPU, sino de la longitud de la cola de trabajo en Redis ( *Queue-depth Autoscaling*  mediante KEDA).

##### Pila de Observabilidad y Monitoreo

La salud operativa del sistema se audita mediante tres capas integradas:

1. **Métricas de Infraestructura y Negocio:**  Exportadores de Prometheus que recolectan tiempos de respuesta HTTP, tasas de éxito en transcodificación y duración de flujos de trabajo de Temporal, visualizados en tableros unificados de Grafana.  
2. **Trazabilidad Distribuida (OpenTelemetry):**  Cada solicitud que ingresa al API Gateway genera un identificador de traza que viaja a través de Temporal, los agentes y los workers, permitiendo diagnosticar cuellos de botella en la generación o en la comunicación MCP.  
3. **Registro Centralizado y Gestión de Alertas:**  Trazas estructuradas en formato JSON enviadas a OpenSearch o Datadog, con alertas configuradas en PagerDuty ante cualquier anomalía en las tasas de error de las APIs de las redes sociales.

#### 10\. Roadmap de Implementación: De Cero a Producción en 16 Semanas

El plan de ingeniería distribuye el desarrollo en cinco fases consecutivas estructuradas en bloques de trabajo de dos semanas:  
Fase de Proyecto,Semanas,Objetivos Principales de Ingeniería,Hito de Validación Técnica  
Fase 0: Cimientos e Infraestructura,Semanas 1–2,"Despliegue de clúster Kubernetes con Terraform; aprovisionamiento de PostgreSQL con pgvector, Redis y Cloudflare R2; configuración de pipelines CI/CD con GitHub Actions.",Conexiones seguras validadas entre servicios; pruebas de estrés iniciales en base de datos completadas con éxito.  
Fase 1: Motor Central y Agentes,Semanas 3–6,Implementación de API REST en FastAPI; orquestación de la FSM en Temporal.io; conexión del SDK de Claude 3.7 con servidores MCP de investigación y búsqueda.,"Flujo de ideación, filtrado ICE y redacción de guión AV completado en menos de 15 segundos con validación Zod."  
Fase 2: Pipeline de Medios en GPU,Semanas 7–9,Construcción de imágenes Docker con FFmpeg 7 y soporte NVIDIA CUDA; integración de faster-whisper; scripts de poda de silencios y normalización EBU R128.,"Transcripción, poda y renderizado de un video vertical de 60 segundos ejecutado en menos de 30 segundos."  
Fase 3: Frontend y Gobernanza HITL,Semanas 10–12,Desarrollo de interfaces en Next.js 15; construcción del editor AV a dos columnas; simuladores de interfaz móvil; flujo de firma de tokens HITL Tier 2 y Tier 3.,"Navegación completa del creador sin recargas de página, con sincronización de eventos SSE en tiempo real."  
Fase 4: Publicación y Analítica,Semanas 13–14,"Integración oficial de APIs de YouTube, Instagram, TikTok y LinkedIn; bóveda de tokens OAuth2; tareas cron de extracción analítica en ventanas de 24h, 7d y 30d.",Publicación de prueba exitosa en los cuatro canales y registro de la primera instantánea analítica con cálculo RMT-A.  
Fase 5: Pruebas de Carga y Lanzamiento,Semanas 15–16,Pruebas de estrés de API con k6; auditoría de seguridad y penetración; ajustes de cuotas de plataformas; despliegue general en producción.,Disponibilidad del 99.9% comprobada bajo carga sintética de 500 usuarios concurrentes; latencia p95 \< 200 ms.  
