# BagControl — Guía de Arquitectura

## Visión General

BagControl es un sistema de simulación y gestión de equipajes de aerolínea. Combina un backend Java (Spring Boot) con un frontend Next.js (React) para:
- Planificar rutas de envío de equipajes entre aeropuertos
- Visualizar la simulación en un mapa interactivo (MapLibre GL)
- Gestionar CRUD de aeropuertos, vuelos, incidencias y envíos
- Ejecutar simulaciones en 3 modos: Operación día a día, Simulación 5 días, y Hasta el colapso

## Arquitectura General

```
Frontend (Next.js)  ←→  Backend (Spring Boot)  ←→  H2 (in-memory DB)
     ↑                        ↑                         ↑
     │                        │                         │
  MapLibre GL          WebSocket (STOMP)           EnvioDataStore
  (visualización)      (eventos en tiempo real)    (TreeMap + spool)
```

## Backend (Java/Spring Boot)

### Estructura de Directorios
```
bagcontrol/
├── src/main/java/pe/edu/pucp/inf/bagcontrol/
│   ├── entidades/
│   │   ├── aeropuerto/          # Aeropuerto.java, AeropuertoRepository, AeropuertoLoader
│   │   ├── vuelo/               # Vuelo.java, VueloInstanciado.java, VueloFactory, VueloLoader
│   │   ├── envios/              # Envio.java, EnvioDataStore, EnvioLoader
│   │   ├── incidencias/         # Incidencia.java, IncidenciaRepository
│   │   └── clientes/            # Cliente.java (unused)
│   ├── planificacion/
│   │   ├── controller/          # AeropuertoConsultaController, ConsultaOperativaController, EnvioController, PlanificadorController
│   │   ├── service/             # PlanificadorService, ConsultaOperativaService, ItinerarioService
│   │   ├── modelos/             # EnvioDTO, NuevoEnvioDTO, RutaAsignada, SolucionRuta
│   │   └── utils/               # PlanificadorUtils
│   ├── simulacion/
│   │   ├── motor/               # SimulacionJob, SimulacionManager, SimulacionController, SimulacionState, SimulacionStateMutator
│   │   ├── dtos/                # DTOs de eventos (EventoVueloDTO, EventoAeropuertoDTO, etc.)
│   │   └── motor/SimulacionEventosFactory.java
│   └── analytics/dashboard/     # DashboardController, DashboardService
├── src/main/resources/
│   ├── application.properties   # Config: H2 in-memory, WebSocket, etc.
│   └── data/                    # Archivos estáticos: aeropuertos.txt, planes_vuelo.txt, envios.zip
```

### Persistencia

| Entidad | Tipo | Sobrevive restart | Fuente |
|---------|------|-------------------|--------|
| Aeropuerto | H2 (JPA) | No | `AeropuertoLoader` desde `.txt` |
| Vuelo | H2 (JPA) | No | `VueloLoader` desde `planes_vuelo.txt` |
| Incidencia | H2 (JPA) | No | Vacío al inicio |
| Envío | EnvioDataStore (TreeMap + spool) | No | `EnvioLoader` desde `envios.zip` + CRUD en `enviosCrudPorId` |

**Nota**: Los datos CRUD se pierden al reiniciar el backend. Esto es aceptado por el usuario.

### Flujo de Planificación

1. `SimulacionJob.ejecutarSimulacion()` corre en un hilo separado
2. Cada ciclo cubre `K` minutos simulados (ventana)
3. Llama a `PlanificadorService.calcularSolucion()` que:
   - Lee envíos de `EnvioDataStore.obtenerEnviosEnVentana(inicio, fin)`
   - Lee vuelos de `VueloRepository.findAll()`
   - Lee aeropuertos de `AeropuertoRepository.findAll()`
   - Lee incidencias de `IncidenciaRepository.findAll()`
   - Ejecuta Tabu Search o GRASP para asignar rutas
4. `SimulacionEventosFactory` genera eventos (VUELO_DESPEGA, VUELO_ATERRIZA, AEROPUERTO_ACTUALIZADO)
5. `WebSocketPublisher.publicarLote()` envía eventos al frontend
6. `esperarConControl()` espera `saMs - taMs` antes del siguiente ciclo

### Modos de Simulación

| Modo | K | saMs | factorAceleracion | Descripción |
|------|---|------|-------------------|-------------|
| OPERACION_DIA (modo='0') | Usuario define (default 1) | `k * 60 * 1000` | 1 (tiempo real) | 1s real = 1s sim. Un vuelo de 2h tarda 2h reales. |
| VENTANA_CINCO_DIAS (modo='1') | Usuario define (default 300) | 90_000 | K*60/90 | Simulación acelerada. 5 días en ~6 horas. |
| COLAPSO_OPERATIVO (modo='2') | Usuario define (default 300) | 90_000 | K*60/90 | Corre hasta detectar colapso SLA. |

### WebSocket

- Topic: `/topic/simulacion/{simulacionId}/eventos`
- Protocolo: STOMP sobre SockJS
- Endpoint: `/ws/simulacion`
- Mensajes: `LoteEventosDTO` con lista de `EventoBaseDTO`

### Controllers Backend

| Controller | Endpoints | CRUD |
|------------|-----------|------|
| `AeropuertoConsultaController` | GET `/api/aeropuertos` | Solo READ |
| `ConsultaOperativaController` | GET `/api/envios/ventana`, `/api/vuelos/instanciados`, `/api/envios/rango-dias`, `/api/envios/paginados` | Solo READ |
| `EnvioController` | POST `/api/envios`, PUT `/api/envios/{id}`, DELETE `/api/envios/{id}`, GET `/api/envios/buscar` | CREATE, READ, UPDATE, DELETE |
| `SimulacionController` | POST `/api/simulacion/preparar`, `/iniciar/{id}/arrancar`, `/{id}/pausar`, `/{id}/reanudar`, `/{id}/detener` | Simulación lifecycle |
| `PlanificadorController` | GET `/api/simulacion/resumen`, `/api/simulacion/plan` | Solo READ |

**Nota**: No existen controllers CRUD para Vuelo ni Incidencia. Solo existe READ para ambos.

## Frontend (Next.js + React)

### Estructura de Directorios
```
bagcontrol-frontend/
├── app/
│   ├── management/
│   │   ├── page.tsx                    # Página de gestión con sidebar
│   │   └── components/
│   │       ├── GestionAeropuertos.tsx  # CRUD completo de aeropuertos
│   │       ├── GestionVuelos.tsx       # CRUD completo de vuelos
│   │       ├── GestionIncidencias.tsx  # CRUD completo de incidencias
│   │       ├── GestionEnvios.tsx       # Lista paginada de envíos (server-side)
│   │       └── RegistroEnvio.tsx       # Formulario de creación/edición de envíos
│   ├── simulation/
│   │   ├── page.tsx                    # Formulario de configuración de simulación
│   │   ├── components/
│   │   │   └── contenedor-simulacion.tsx  # Form con 3 modos y parámetros
│   │   └── [idSimulacion]/
│   │       ├── page.tsx                # Server Component que carga aeropuertos
│   │       ├── simulacion-cliente.tsx  # Cliente que inicializa el hook de simulación
│   │       ├── hooks/
│   │       │   └── useSimulacion.ts    # Motor de lógica (WebSocket + reloj + eventos)
│   │       └── components/
│   │           ├── mapa-simulacion.tsx      # Mapa principal con MapLibre GL
│   │           ├── mapa-simulacion.constants.ts  # Estilos de capas
│   │           ├── mapa-simulacion.utils.ts      # Helpers de interpolación, coordenadas
│   │           ├── mapa-simulacion.icons.ts      # Carga de íconos PNG coloreados
│   │           ├── panel-vuelos.tsx       # Panel de vuelos activos
│   │           ├── panel-aeropuertos.tsx  # Panel de aeropuertos
│   │           ├── panel-envios.tsx       # Panel de envíos
│   │           ├── pop-up-aeropuerto.tsx  # Popup al hover de aeropuerto
│   │           └── reloj-simulacion.tsx   # Overlay del reloj simulado
│   │       └── components/
│   │           ├── avion-sidepanel.tsx    # Drawer lateral de vuelo seleccionado
│   │           └── aeropuerto-sidepanel.tsx  # Drawer lateral de aeropuerto seleccionado
│   ├── services/
│   │   ├── config/
│   │   │   ├── axios.ts          # Instancias axios (axiosApi 10s, axiosSimulacion 120s)
│   │   │   ├── constants.ts      # BASE_URL, WS_URL
│   │   │   └── webSocket.ts      # Cliente STOMP sobre SockJS
│   │   ├── aeropuerto.service.ts # CRUD de aeropuertos
│   │   ├── vuelo.service.ts      # CRUD de vuelos
│   │   ├── incidencia.service.ts # CRUD de incidencias
│   │   ├── envio.service.ts      # CRUD + paginación de envíos
│   │   └── simulation.service.ts # Preparar, iniciar, pausar, reanudar, detener simulación
│   └── shared/
│       ├── types/                # TypeScript types (Aeropuerto, Evento, Envio, etc.)
│       ├── hooks/                # useToast
│       └── Utils.ts              # HourFormat y otros helpers
```

### Motor de Simulación (`useSimulacion.ts`)

El hook `useSimulacion` coordina:
1. **Conexión WebSocket** — recibe lotes de eventos del backend
2. **Cola de eventos** — acumula eventos hasta que el reloj los alcanza
3. **Reloj simulado** — avanza con `requestAnimationFrame` (60fps), factorAceleracion calculado según modo
4. **Refs compartidos** — `aeropuertosRef`, `vuelosActivosRef`, `enviosPlanificadosRef`, `tiempoSimulacionRef` se pasan al mapa y paneles

#### Parámetros del hook
```ts
useSimulacion(
  id: string,              // ID de simulación
  topic: string,           // Topic WebSocket
  aeropuertosIniciales: Aeropuerto[],  // Aeropuertos del backend
  K: number,               // Minutos simulados por lote
  SaS: number,             // Segundos reales por lote
  fechaInicio: string,     // ISO string
  modo: string,            // '0'=OPERACION_DIA, '1'=VENTANA_CINCO_DIAS, '2'=COLAPSO_OPERATIVO
  onNuevoLote?: () => void // Callback al recibir lote
)
```

#### Reloj simulado
- Usa `requestAnimationFrame` (no `setInterval`) para ticks a 60fps
- `factorAceleracion = modo === '0' ? 1 : (K * 60 * 1000) / (SaS * 1000)`
- En OPERACION_DIA: factor=1 (tiempo real)
- En otros modos: factor = K*60/SaS (acelerado)
- El `ultimoFrame` se actualiza cada tick para evitar saltos al volver de cola vacía

#### Caché de epochs en vuelos
Al recibir `VUELO_DESPEGA`, se pre-computan `_salidaEpoch` y `_llegadaEpoch` para evitar crear `Date` objects en cada frame del rAF.

### Motor Gráfico (`mapa-simulacion.tsx`)

El mapa usa dos instancias de MapLibre:
1. **Mapa de fondo** (`backgroundMapRef`) — estilo OpenFreeMap con tiles
2. **Mapa de datos** (`mapRef`) — estilo vacío con capas GeoJSON

Las capas se actualizan en un `requestAnimationFrame` loop:
- **Aviones y rutas**: cada frame (~60fps)
- **Aeropuertos**: cada 30 frames (~500ms, throttled)
- **Ruta de envío**: solo cuando cambia `featuresRutaEnvio`

Los íconos se cargan en paralelo al inicio (aviones y aeropuertos separados).

### Página de Gestión (`/management`)

Los CRUDs están implementados en el frontend y llaman a los endpoints del backend. Los componentes:
- `GestionAeropuertos`: CRUD completo (CREATE, READ, UPDATE, DELETE)
- `GestionVuelos`: CRUD completo + cancelar vuelo
- `GestionIncidencias`: CRUD completo
- `GestionEnvios`: READ paginado (server-side) + CREATE via `RegistroEnvio`

**Nota**: Los controllers CRUD de Vuelo e Incidencia no existen aún en el backend. Solo Aeropuerto tiene GET, y Envio tiene CRUD completo.

### Formulario de Registro de Envío (`RegistroEnvio.tsx`)

- Input fechaHora siempre visible
- Botón "Usar hora actual" para pre-completar con `new Date()`
- En modo crear: fechaHora se pre-completa con la hora actual
- En modo edición: fechaHora se pre-completa con la fecha del envío
- Si fechaHora está vacío al enviar, el backend la rellena con `Instant.now()`

### Parámetros de Simulación (`contenedor-simulacion.tsx`)

| Modo | Label | K | fechaFin | saMs |
|------|-------|---|----------|------|
| OPERACION_DIA | "Operación día a día" | 1 (default) | start + 24h | k*60*1000 |
| VENTANA_CINCO_DIAS | "Simulación de 5 días" | timeScale (default 300) | start + 5d | 90_000 |
| COLAPSO_OPERATIVO | "Hasta el colapso operativo" | timeScale (default 300) | null | 90_000 |

Al enviar, se pasa `modo` como query param tanto al backend (POST `/preparar`) como al frontend (URL de navegación).

### Paginación de Envíos

El endpoint `GET /api/envios/paginados` soporta:
- `page`, `size` (paginación)
- `origenIata`, `destinoIata`, `idCliente`, `q` (filtros)
- `maletasMin`, `maletasMax` (filtros de capacidad)

El `EnvioDataStore.obtenerEnviosEnVentanaPaginados` implementa:
- Sin filtros: salta días enteros usando `indicePorDia` (O(1) por día)
- Con filtros: pre-check de strings por línea antes de deserializar (evita crear objetos Envio para cada línea)

## Consideraciones de Performance

### Backend
- `obtenerEnviosEnVentana` usa `enviosPorTiempo` (TreeMap en RAM) para consultas rápidas
- `obtenerEnviosEnVentanaPaginados` salta días sin leer el spool cuando no hay filtros
- Los filtros usan pre-check de strings por línea antes de deserializar

### Frontend
- `requestAnimationFrame` a 60fps para el motor de simulación (no `setInterval`)
- Aeropuertos GeoJSON se actualizan cada 30 frames (throttled)
- Ruta de envío solo se actualiza cuando cambia `featuresRutaEnvio`
- Los íconos se cargan en paralelo (aviones y aeropuertos separados)
- `_salidaEpoch` y `_llegadaEpoch` se cachean en los vuelos para evitar crear `Date` objects

### Problemas Conocidos
- Los CRUDs de vuelos e incidencias no tienen controllers en el backend (solo frontend)
- Los datos CRUD se pierden al reiniciar el backend
- `saMs` en `SimulacionJob` es `90_000` hardcoded para modos acelerados, y `k*60*1000` para OPERACION_DIA

## WebSocket

- Configuración: `/ws/simulacion` (SockJS + STOMP)
- Topic por simulación: `/topic/simulacion/{simulacionId}/eventos`
- Mensajes: `LoteEventosDTO` con `eventos: EventoBaseDTO[]`
- Eventos de lifecycle: `SIMULACION_INICIADA`, `SIMULACION_PAUSADA`, `SIMULACION_REANUDADA`, `SIMULACION_FINALIZADA`, `COLAPSO_DETECTADO`, `SIMULACION_DETENIDA`, `ERROR`
- Eventos de física: `VUELO_DESPEGA`, `VUELO_ATERRIZA`, `AEROPUERTO_ACTUALIZADO`

## Variables de Entorno

Frontend (`bagcontrol-frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=http://localhost:8080/ws/simulacion
```

## Comandos Útiles

**Backend:**
```bash
cd bagcontrol
./mvnw.cmd spring-boot:run
```

**Frontend:**
```bash
cd bagcontrol-frontend
npm run dev
```

**Compilar backend:**
```bash
cd bagcontrol
./mvnw.cmd compile
```
