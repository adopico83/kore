# Kore

**El sistema operativo de tu hogar.** Una PWA que convierte el caos doméstico en calma: compras, agenda, colegio, sueño, economía y más — con un orquestador de IA que actúa, no solo responde.

---

## ¿Qué es Kore?

Kore es un **sistema operativo del hogar familiar**: un único lugar donde la familia organiza la vida diaria, delega la carga mental y mantiene todo sincronizado.

- **PWA instalable** en iOS y Android (añadir a pantalla de inicio; experiencia casi nativa).
- **Multi-familia**: registro, onboarding e invitación por código para que cada hogar tenga su espacio aislado.
- **IA con acción**: el ORC (Orquestador) entiende el contexto familiar y ejecuta herramientas reales contra la base de datos.

### Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 · React 19 · TypeScript |
| Estilos | Tailwind CSS 4 |
| Backend / DB | Supabase (Auth, Postgres, RLS) |
| IA | OpenAI (chat + function calling) |
| Push | Web Push (VAPID) + Service Worker |
| Hosting | Vercel |
| Cron push | Railway (Python) |
| Tests | Vitest |

---

## Features actuales

### ORC — Orquestador con 11 subagentes

Un agente central (**Kore / ORC**) con personalidad calmada y contexto del hogar (energía familiar, hora, tareas pendientes). Delega en **11 subagentes especializados**:

| Subagente | Dominio |
|-----------|---------|
| **Agenda** | Eventos del calendario familiar |
| **Colegio** | Eventos escolares, materiales, sync con agenda |
| **Compras** | Lista de la compra |
| **Limpieza** | Tareas recurrentes por zona y frecuencia |
| **Menú** | Planificación semanal de comidas |
| **Sueño** | Sesiones de sueño, despertares, resúmenes |
| **Tiempo libre** | Actividades y tiempo personal |
| **Salud** | Registros de salud familiar |
| **Corcho** | Notas y comunicación entre adultos |
| **Economía** | Gastos y visión económica |
| **Memoria** | `agent_memory` — hechos persistentes del hogar |

Cada subagente expone **tools** OpenAI; el ORC elige cuándo invocarlas. Las server actions sensibles usan **service role** (`createAdminClient`) tras validar sesión, evitando bloqueos RLS en escrituras del servidor.

### Lista de la compra

Ítems con categoría, prioridad y estado completado. Gestión desde UI y desde el agente de Compras.

### El Corcho

Chat / notas asíncronas entre miembros del hogar (pareja, adultos). Subagente **Corcho** dedicado; UI en `CorchoChat` y modales relacionados.

### Agenda familiar

Calendario compartido (`calendar_events`). Los eventos de **Colegio** se sincronizan con la agenda al crearse o eliminarse.

### Dominios (paneles en la app)

Tarjetas de dominio con paneles dedicados donde aplica:

- **Colegio** — eventos escolares, tipos, sync agenda
- **Limpieza** — tareas recurrentes, vencidas / próximas
- **Sueño** — sesiones, horas, despertares
- **Compras** — lista de la compra
- **Menú** — menú semanal
- **Salud** — registros de salud
- **Economía** — gastos
- **Tiempo libre** — actividades

*(Otros dominios se gestionan vía modales y agentes.)*

### Multi-familia

- Registro e inicio de sesión (Supabase Auth)
- Onboarding por familia
- Código de invitación para unirse al hogar
- RLS: cada familia solo ve sus datos

### Push notifications

Web Push con VAPID; suscripciones en `push_subscriptions`. Endpoint `/api/push` protegido con `CRON_SECRET` para envíos desde cron (Railway).

### Seguridad de datos

- **RLS** en Supabase para acceso por `family_id`
- Cliente anon en navegador; **service role** solo en servidor (actions, API, agentes) con validación de sesión previa

---

## Arquitectura

### Vista general

```
┌─────────────────────────────────────────────────────────────┐
│  PWA (Next.js) — HomeClient, dominios, Corcho, agente       │
└───────────────┬─────────────────────────────┬───────────────┘
                │ Server Actions              │ /api/agent
                ▼                             ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│  lib/actions/*            │     │  ORC + 11 subagentes      │
│  createAdminClient()      │     │  OpenAI function calling  │
└───────────────┬───────────┘     └───────────────┬───────────┘
                │                                 │
                └──────────────┬──────────────────┘
                               ▼
                ┌──────────────────────────┐
                │  Supabase (Postgres+RLS)  │
                └──────────────────────────┘
                               ▲
                ┌──────────────┴───────────┐
                │  Railway cron → /api/push │
                └──────────────────────────┘
```

### Estructura de carpetas clave

```
kore/
├── public/
│   └── sw.js                 # Service Worker (push)
├── src/
│   ├── app/
│   │   ├── page.tsx          # SSR inicial (datos de familia)
│   │   ├── HomeClient.tsx    # Shell principal de la PWA
│   │   ├── login/ register/ onboarding/
│   │   └── api/
│   │       ├── agent/        # POST — ORC + tools
│   │       ├── push/         # POST — envío push (cron)
│   │       └── transcribe/   # Audio → texto
│   ├── components/
│   │   ├── domain-panels/    # Colegio, Limpieza, Sueño…
│   │   ├── CorchoChat/
│   │   ├── AgentChat/
│   │   └── …modales (Calendario, Salud, Economía…)
│   ├── lib/
│   │   ├── agents/           # orchestrator + 11 subagentes
│   │   ├── actions/          # Server Actions por dominio
│   │   ├── kore-db.ts        # Capa de acceso a datos
│   │   ├── supabase/         # client, server, admin
│   │   └── agent/            # Guardrails del ORC
│   ├── types/
│   │   └── database.ts       # Tipos generados Supabase
│   └── __tests__/            # Vitest
└── package.json
```

### Base de datos (tablas principales)

| Grupo | Tablas |
|-------|--------|
| **Núcleo** | `families`, `profiles`, `domains` |
| **Agente** | `agent_memory`, `agent_messages`, `conversations`, `messages` |
| **Agenda** | `calendar_events`, `school_events`, `school_materials` |
| **Hogar** | `shopping_items`, `cleaning_tasks`, `menu_items`, `sleep_sessions`, `sleep_logs` |
| **Bienestar** | `health_records`, `daily_metrics`, `leisure_activities` |
| **Economía** | `expenses` |
| **Corcho** | `kore_notes`, `kore_notifications` |
| **Sistema** | `push_subscriptions`, `events_log`, `domain_history` |

Tipos en `src/types/database.ts`. Migraciones en `supabase/migrations/` (si están en el repo).

### Flujo del ORC y subagentes

1. El usuario escribe (o envía audio transcrito) → `POST /api/agent`.
2. Se resuelve `familyId` y perfiles; se cargan memorias y snapshot (energía, tareas, etc.).
3. OpenAI recibe el system prompt del ORC + tools de los 11 subagentes.
4. Si el modelo pide una tool → `executeTool` enruta al subagente correcto.
5. El subagente llama a `kore-db` con `createAdminClient()` cuando hace falta bypass RLS controlado.
6. La respuesta vuelve al cliente; la UI puede refrescar vía `emitKoreUpdate`.

Guardrails en `src/lib/agent/guardrails.ts` filtran planes de tools antes de ejecutar.

---

## Variables de entorno

Crea `.env.local` en la raíz (no commitear):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:tu@email.com

# Cron (Railway → /api/push)
CRON_SECRET=un-secreto-largo-aleatorio
```

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente en navegador (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server actions, API, agentes |
| `OPENAI_API_KEY` | ORC y subagentes |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Suscripción push en cliente |
| `VAPID_PRIVATE_KEY` | Firma de notificaciones en servidor |
| `VAPID_SUBJECT` | Contacto VAPID (`mailto:` o URL de la app) |
| `CRON_SECRET` | Header `x-cron-secret` en `/api/push` |

Replica las mismas variables en **Vercel** (Production / Preview).

---

## Cómo arrancar en local

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd kore
npm install

# 2. Variables de entorno
cp .env.example .env.local   # o crea .env.local a mano
# Rellena todas las variables de la sección anterior

# 3. Desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para push en local necesitas HTTPS o un túnel; en iOS la PWA se prueba mejor en dispositivo con build desplegado.

### Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción + typecheck |
| `npm run start` | Servir build |
| `npm test` | Vitest (watch) |
| `npm run test:run` | Vitest una sola pasada |
| `npm run lint` | ESLint |

---

## Tests

```bash
npm test
# o
npm run test:run
```

Suite con **Vitest**: API del agente, guardrails, utilidades y componentes críticos.

**Estado actual: 63 tests en verde** (12 archivos).

---

## Despliegue

| Servicio | Rol |
|----------|-----|
| **Vercel** | Frontend Next.js, API routes (`/api/agent`, `/api/push`, `/api/transcribe`) |
| **Supabase** | Postgres, Auth, RLS, storage si aplica |
| **Railway** | Cron en Python que llama a `POST /api/push` con `x-cron-secret` para notificaciones programadas |

Flujo típico: push a `main` → Vercel despliega automáticamente. Variables de entorno en el dashboard de Vercel. Service role **nunca** en el cliente.

---

## Roadmap

- [ ] **Notificaciones inteligentes** — contexto (sueño, limpieza, colegio) en lugar de push genéricos
- [ ] **Memoria predictiva del ORC** — anticipar necesidades desde `agent_memory` y patrones
- [ ] **Panel de admin** — familias, métricas, soporte
- [ ] **Stripe** — planes y límites por familia

---

## Licencia

Proyecto privado. Consulta con los mantenedores antes de redistribuir.

---

*Kore no sustituye el criterio de la familia: lo amplifica. Menos carga mental, más calma en casa.*
