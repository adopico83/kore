# CLAUDE.md — Kore

Reglas de desarrollo para este proyecto. Léelas antes de tocar cualquier archivo.

---

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.4 |
| Lenguaje | TypeScript (strict) | ^5 |
| Estilos | Tailwind CSS | ^4 |
| Base de datos | Supabase — Postgres + Auth + RLS | @supabase/supabase-js ^2 |
| IA | OpenAI function calling | openai ^6 |
| Push | Web Push VAPID + Service Worker (`public/sw.js`) | web-push ^3 |
| Tests | Vitest + Testing Library | vitest ^4 |
| Deploy | Vercel (app) + Railway (cron Python para push) | — |

---

## Estructura de carpetas

```
src/
├── app/                    # Routes Next.js (App Router)
│   ├── api/agent/          # POST — ORC + ejecución de tools
│   ├── api/push/           # POST — envío push (protegido por CRON_SECRET)
│   └── api/transcribe/     # Audio → texto (Whisper)
├── components/
│   ├── domain-panels/      # Paneles: CleaningDomainPanel, SchoolDomainPanel, SleepDomainPanel…
│   ├── AgentChat/          # Chat con el ORC
│   ├── CorchoChat/         # Chat asíncrono entre adultos
│   └── …modales/           # CalendarModal, EconomiaModal, SaludModal, PerfilModal…
├── lib/
│   ├── agents/             # orchestrator.ts + 11 subagentes (agenda, colegio, compras…)
│   ├── agent/              # guardrails.ts — filtrado de planes de tools
│   ├── actions/            # Server Actions por dominio (cleaning.ts, calendar.ts…)
│   ├── kore-db.ts          # Única capa de acceso a datos — TODOS los queries van aquí
│   ├── supabase/           # client.ts (browser), server.ts, admin.ts (service role)
│   └── hooks/              # Custom hooks React
├── types/
│   └── database.ts         # Tipos generados desde Supabase — NO editar a mano
└── __tests__/              # Suite Vitest (63 tests)
```

---

## Clientes Supabase — regla crítica

Hay tres clientes y cada uno tiene un uso estricto:

| Cliente | Archivo | Cuándo usar |
|---------|---------|-------------|
| `getBrowserClient()` | `lib/supabase/client.ts` | Solo en componentes cliente (`"use client"`) — respeta RLS |
| `createServerClient()` | `lib/supabase/server.ts` | Server Components y middleware — respeta RLS |
| `createAdminClient()` | `lib/supabase/admin.ts` | Server Actions, API routes y agentes — bypass RLS controlado |

**Nunca usar `createAdminClient()` en el cliente (browser).** Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` fuera del servidor. Antes de usar el admin client en una Server Action, validar siempre la sesión del usuario con `getScopedFamilyId()`.

---

## Capa de datos — `kore-db.ts`

- **Todos los queries a Supabase van en `src/lib/kore-db.ts`**, no en acciones ni componentes directamente.
- Las funciones de `kore-db` reciben el cliente como primer parámetro (`SupabaseClient`) para ser testeables.
- Los tipos de fila se exportan desde `kore-db.ts` (ej. `Profile`, `CleaningTaskRow`, `SleepSessionRow`). Importar desde ahí, no recriar tipos.

---

## Server Actions — convenciones

- Todos empiezan con `"use server"` en la primera línea.
- Patrón estándar: validar sesión → obtener `familyId` → crear admin client → llamar función de `kore-db`.
- `getScopedFamilyId()` lanza si no hay sesión; usarlo como guard obligatorio al inicio.
- Cada dominio tiene su propio archivo en `lib/actions/` (ej. `cleaning.ts`, `calendar.ts`).

```ts
// Patrón obligatorio en Server Actions
"use server";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function miAccion(data: MiTipo) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbMiFuncion(admin, familyId, data);
}
```

---

## Agentes — arquitectura ORC + subagentes

- El **ORC** (`/api/agent/route.ts`) recibe el mensaje, carga contexto del hogar y delega en subagentes.
- Cada subagente es un módulo en `lib/agents/` que exporta: `tools: ChatCompletionTool[]`, `execute(toolName, args, ctx)`, `AGENT_DESCRIPTION`.
- Todos los tools siguen la convención de nombre: `get_*` (lectura), `add_*` / `save_*` / `log_*` (escritura), `update_*`, `delete_*` / `clear_*` (destructivo).
- **Los guardrails** (`lib/agent/guardrails.ts`) filtran y reordenan el plan de tools antes de ejecutar. Si añades un tool nuevo, comprueba si necesita regla en guardrails.
- El ORC emite `emitKoreUpdate` tras ejecutar tools para que la UI refresque sin recargar.
- Los subagentes usan `createAdminClient()` — nunca el cliente browser.

---

## Guardrails — reglas activas

- Mutaciones: máximo una por dominio por mensaje salvo que el texto contenga varios ítems explícitos (ej. lista de la compra con comas/y).
- Lecturas: máximo una al final del plan.
- `add_school_event` / `add_appointment` siempre generan un `add_calendar_event` paralelo (regla calendario-par).
- `clear_day_menu` + `add_menu_item` el mismo día se bloquea salvo verbo de sustitución explícito.
- No añadir mutaciones fantasma — un mensaje sin verbos de acción no debe disparar tools de escritura.

---

## Componentes — convenciones

- Componentes de página/shell: `"use client"` en la primera línea si tienen estado o efectos.
- Los paneles de dominio (`domain-panels/`) son componentes controlados: reciben los datos por props, emiten callbacks.
- Los modales siguen el patrón `open: boolean` + `onClose: () => void` + datos iniciales como prop.
- Iconos: **solo `lucide-react`**. No instalar otras librerías de iconos.
- Estilos: **solo Tailwind**. No CSS modules ni styled-components. Usar `clsx` / `tailwind-merge` para condicionales.

---

## TypeScript

- El proyecto usa TypeScript estricto. No usar `any` — si es necesario, usar `unknown` y narrowing.
- Los tipos de base de datos viven en `src/types/database.ts` (generados por Supabase CLI). No editarlos a mano.
- Los tipos de dominio (`Profile`, `CleaningTaskRow`, etc.) se exportan desde `kore-db.ts`.
- Preferir tipos inferidos sobre anotaciones redundantes.

---

## Tests

- Suite: **Vitest** + **Testing Library** en `src/__tests__/`.
- Un archivo de test por módulo: `kore-db.test.ts`, `api-agent.test.ts`, `guardrails` (dentro de `api-agent.test.ts`), etc.
- Estado actual: **63 tests en verde**. Cualquier cambio debe mantener todos en verde.
- Ejecutar antes de hacer commit: `npm run test:run`.
- Los tests de Server Actions mockean `getScopedFamilyId` y el cliente Supabase — no requieren conexión real.

---

## Variables de entorno

| Variable | Uso | Disponible en |
|----------|-----|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Cliente + servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente browser (RLS) | Cliente + servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client — bypass RLS | Solo servidor |
| `OPENAI_API_KEY` | ORC y subagentes | Solo servidor |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Suscripción push en cliente | Cliente + servidor |
| `VAPID_PRIVATE_KEY` | Firma notificaciones | Solo servidor |
| `VAPID_SUBJECT` | Contacto VAPID | Solo servidor |
| `CRON_SECRET` | Header `x-cron-secret` en `/api/push` | Solo servidor |

**Las variables sin prefijo `NEXT_PUBLIC_` nunca llegan al bundle del cliente.** No añadir secrets como `NEXT_PUBLIC_*`.

---

## Restricciones absolutas

1. **`createAdminClient()` solo en servidor** — nunca en archivos con `"use client"` ni en hooks.
2. **`kore-db.ts` es la única puerta a Supabase** — no escribir queries `.from(...)` directamente en acciones o componentes.
3. **No romper los 63 tests** — `npm run test:run` debe pasar limpio.
4. **No editar `src/types/database.ts` a mano** — se regenera con Supabase CLI.
5. **No instalar dependencias nuevas sin justificación** — el bundle ya incluye React 19, OpenAI, Supabase y Tailwind 4.
6. **`/api/push` solo acepta peticiones con `x-cron-secret` correcto** — no relajar esta validación.
7. **RLS es la línea de defensa por familia** — toda escritura en el servidor debe ir acompañada de `familyId` validado.
8. **No exponer `ANDER_ID`, `LEIRE_ID`, `FAMILY_ID`, `PEQUE_ID`** (constantes hardcodeadas en `kore-db.ts`) en respuestas de API o logs de producción — son IDs de la familia de desarrollo.
9. **Nunca hacer commits, push ni operaciones git autónomamente** — el desarrollador gestiona git manualmente siempre.
10. **Nunca dar una tarea por terminada sin validar**: ejecutar `npx tsc --noEmit`, `npm run lint` y `npm run test:run` — los tres deben pasar limpios.

---

## Antes de dar una tarea por terminada

Ejecutar siempre en este orden:

1. `npx tsc --noEmit` — sin errores de tipos
2. `npm run lint` — sin warnings
3. `npm run test:run` — 63 tests en verde

No marcar nada como listo hasta que los tres pasen.

---

## Scripts útiles

```bash
npm run dev          # Servidor en puerto 3001 (no 3000 — ese es Perfilio)
npm run build        # Build de producción + typecheck
npm run test:run     # Vitest una pasada (usar antes de commit)
npm test             # Vitest en modo watch
npm run lint         # ESLint
```

---

## Filosofía de desarrollo

- No parchear síntomas: trabajar siempre desde la raíz del problema.
- Proponer diffs y explicar el approach antes de ejecutar cambios grandes.
- Ante la duda, preguntar antes de asumir.
