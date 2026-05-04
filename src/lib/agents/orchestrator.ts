import type { AgentMemoryRow } from "@/lib/kore-db";

import * as agenda from "./agenda";
import * as colegio from "./colegio";
import * as compras from "./compras";
import * as corcho from "./corcho";
import * as economia from "./economia";
import * as limpieza from "./limpieza";
import * as memoria from "./memoria";
import * as menu from "./menu";
import * as salud from "./salud";
import * as sueno from "./sueno";
import * as tiempoLibre from "./tiempo-libre";

const subagents = [
  agenda,
  colegio,
  compras,
  limpieza,
  menu,
  sueno,
  tiempoLibre,
  salud,
  corcho,
  economia,
  memoria,
] as const;

type AgentModule = (typeof subagents)[number];

const toolToAgent = new Map<string, AgentModule>();
for (const agent of subagents) {
  for (const t of agent.tools) {
    if (t.type === "function") toolToAgent.set(t.function.name, agent);
  }
}

/** Todas las herramientas OpenAI de los 11 subagentes. */
export const allTools = subagents.flatMap((s) => s.tools);

export async function executeTool(toolName: string, args: unknown): Promise<unknown> {
  const agent = toolToAgent.get(toolName);
  if (!agent) {
    return { error: `No hay ningún subagente que ejecute la herramienta "${toolName}".` };
  }
  return agent.execute(toolName, args);
}

/** Prompt de sistema del ORC con memorias insertadas. */
export function buildSystemPrompt(memories: AgentMemoryRow[]): string {
  const block =
    memories.length === 0
      ? "(Sin registros en agent_memory todavía.)"
      : memories
          .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
          .join("\n");

  return `Eres el ORC, el Orquestador Central de Kore, el Sistema Operativo del hogar de Ander y Leire. Tienen una hija pequeña en edad escolar.

Tu única responsabilidad es ESCUCHAR, ANALIZAR y DELEGAR al subagente correcto.
NO ejecutas tareas tú mismo — las delegas.

Tienes 11 subagentes especializados:
- Agenda: calendario familiar general
- Colegio: todo lo del cole de la hija
- Compras: lista de la compra
- Limpieza: tareas y zonas del hogar
- Menú: planificación de comidas
- Sueño: despertares y descanso
- Tiempo Libre: ocio y bienestar personal
- Salud: citas y medicaciones
- Corcho: mensajes entre Ander y Leire
- Economía: gastos y balance
- Memoria: patrones y aprendizaje

Proceso de decisión:
1. Analiza el mensaje del usuario
2. Identifica el dominio (puede ser más de uno)
3. Usa las tools del subagente correcto
4. Si afecta a varios dominios, usa múltiples tools en orden lógico
5. Confirma lo ejecutado de forma breve y natural

Memorias del hogar que debes tener en cuenta:
${block}

Habla siempre en español. Tono cercano y directo, como un miembro más de la familia que ayuda a organizarse. Sin formalismos.
Si detectas un patrón nuevo, guárdalo en memoria automáticamente.`;
}
