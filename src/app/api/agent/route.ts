import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { applyGuardrails, type PlannedTool } from "@/lib/agent/guardrails";
import { allTools, buildSystemPrompt, executeTool } from "@/lib/agents/orchestrator";
import type { AgentExecutionContext } from "@/lib/agents/agent-execution-context";
import { getScopedFamilyId, getScopedUserId } from "@/lib/family-context";
import {
  getAgentMemory,
  getPendingCleaningTasks,
  getProfiles,
  getShoppingItems,
  type Profile,
} from "@/lib/kore-db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Hist = { role: string; content: string };

function familyDisplayNameFromProfiles(profiles: Profile[]): string {
  const adults = profiles.filter((p) => p.role !== "child");
  const surnames = adults
    .map((p) => {
      const parts = p.name.trim().split(/\s+/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1]! : "";
    })
    .filter(Boolean);
  const unique = [...new Set(surnames)];
  if (unique.length === 0) return "tu hogar";
  return unique.join("-");
}

function sortProfilesForSnapshot(a: Profile, b: Profile): number {
  const rank = (r: string | null) => {
    if (r === "owner") return 0;
    if (r === "member") return 1;
    if (r === "child") return 3;
    return 2;
  };
  const d = rank(a.role) - rank(b.role);
  if (d !== 0) return d;
  return a.name.localeCompare(b.name, "es");
}

function formatProfileSnapshotLabel(p: Profile): string {
  const n = p.name.trim();
  if (p.role === "owner") return `${n} (Admin)`;
  if (p.role === "child") return `${n} (Hijo/a)`;
  return `${n} (Pareja)`;
}

function buildNaturalLanguageRefLines(profiles: Profile[]): string[] {
  const lines: string[] = [];
  const children = profiles.filter((p) => p.role === "child");
  const partners = profiles.filter((p) => p.role !== "owner" && p.role !== "child");

  if (children.length === 1) {
    const n = children[0]!.name.trim();
    lines.push(`- "la peque", "el peque" → ${n}`);
    lines.push(`- "los niños", "los hijos" → ${n}`);
  } else if (children.length > 1) {
    const all = children.map((c) => c.name.trim()).join(", ");
    lines.push(`- "los niños", "los hijos" → ${all}`);
    lines.push(`- "la peque", "el peque" → ambiguos con varios hijos; usar nombres: ${all}`);
  }

  if (partners.length > 0) {
    const names = partners.map((p) => p.name.trim()).join(", ");
    lines.push(`- "mi pareja", "mi mujer", "mi marido" → ${names}`);
  }

  return lines;
}

/** Snapshot de estructura familiar + referencias coloquiales; solo datos de getProfiles. */
function buildFamilySnapshotText(profiles: Profile[]): string {
  if (profiles.length === 0) {
    return ["FAMILIA (snapshot):", "Sin perfiles en esta familia."].join("\n");
  }
  const label = familyDisplayNameFromProfiles(profiles);
  const miembros = [...profiles].sort(sortProfilesForSnapshot).map(formatProfileSnapshotLabel).join(", ");
  const refLines = buildNaturalLanguageRefLines(profiles);
  return [
    "FAMILIA (snapshot):",
    `Familia: ${label}. Miembros: ${miembros}.`,
    ...(refLines.length > 0 ? ["Referencias en lenguaje coloquial:", ...refLines] : []),
  ].join("\n");
}

function hhmmNowServer(): string {
  return new Date().toTimeString().slice(0, 5);
}

const IMAGEN_VISION_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function normalizarImagenDataUrl(imagen: string): string | null {
  const s = imagen.trim();
  if (!s.startsWith("data:image/")) return null;
  const marker = ";base64,";
  const mi = s.indexOf(marker);
  if (mi === -1) return null;
  const rest = s.slice("data:".length);
  const idxSemi = rest.indexOf(";");
  const idxComma = rest.indexOf(",");
  let endMime = -1;
  if (idxSemi !== -1 && idxComma !== -1) endMime = Math.min(idxSemi, idxComma);
  else if (idxSemi !== -1) endMime = idxSemi;
  else if (idxComma !== -1) endMime = idxComma;
  else return null;
  let mime = rest.slice(0, endMime).toLowerCase();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!IMAGEN_VISION_MIMES.has(mime)) return null;
  return s;
}

const MAX_TOOL_ROUNDS = 5;

type ToolExecution = {
  name: string;
  success: boolean;
  result: unknown;
  error?: string;
};

type IntentType = "ACCION" | "CONSULTA";

function extractUserText(content: OpenAI.Chat.ChatCompletionMessageParam["content"] | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && "type" in part && part.type === "text") {
        return typeof part.text === "string" ? part.text : "";
      }
      return "";
    })
    .join(" ")
    .trim();
}

function detectIntent(lastUserMsg: string): IntentType {
  const raw = (lastUserMsg ?? "").trim();
  const text = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "CONSULTA";
  if (raw.includes("?") || /^¿/.test(raw)) return "CONSULTA";
  const hasEntity =
    /\b(cita|pediatra|medicacion|gasto|euros|compra|lista|limpieza|menu|reunion|colegio|excursion|partido|futbol|dormido|despertado|mensaje|nota|recordatorio)\b/i.test(
      text,
    );
  const hasTime =
    /\b(hoy|manana|pasado manana|esta noche|esta semana|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo|a las \d{1,2}(:\d{2})?|de \w+)\b/i.test(
      text,
    );
  const hasActionVerb =
    /\b(anade|agrega|registr|apunt|guard|borra|elimina|actualiz|complet|manda|envia|anota|recuerda|log|programa|limpiar|gastar|gastado)\b/i.test(
      text,
    );
  // Conservador: solo acción cuando las señales son claras y no ambiguas.
  const clearAction = (hasEntity && hasTime) || (hasEntity && hasActionVerb);
  return clearAction ? "ACCION" : "CONSULTA";
}

function sanitizeArgs(args: unknown): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
}

function enrichToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  profiles: Awaited<ReturnType<typeof getProfiles>>,
): Record<string, unknown> {
  if (toolName !== "add_shopping_item") return args;
  const currentCreatedBy = typeof args.created_by === "string" ? args.created_by.trim() : "";
  if (currentCreatedBy) return args;
  const firstAdultId =
    profiles.find((p) => p.role !== "child" && typeof p.id === "string" && p.id.trim())?.id ?? null;
  if (!firstAdultId) return args;
  return { ...args, created_by: firstAdultId };
}

function isReadTool(name: string): boolean {
  return name.startsWith("get_");
}

function isCommunicationTool(name: string): boolean {
  return name === "send_note" || name === "add_kore_note";
}

function isDestructiveTool(name: string): boolean {
  return name.startsWith("clear_") || name.startsWith("delete_");
}

function isDuplicateLikeError(err: string): boolean {
  const s = err.toLowerCase();
  return s.includes("already exists") || s.includes("duplicate") || s.includes("ya existe") || s.includes("23505");
}

function normalizeToolResult(name: string, result: unknown): { success: boolean; error?: string } {
  if (result && typeof result === "object" && "error" in result && typeof (result as { error?: unknown }).error === "string") {
    const err = String((result as { error: string }).error);
    if (isDuplicateLikeError(err)) return { success: true };
    return { success: false, error: err };
  }
  return { success: true };
}


async function planToolsFromModel(params: {
  systemPrompt: string;
  historialLimpio: OpenAI.Chat.ChatCompletionMessageParam[];
  userParts: OpenAI.Chat.ChatCompletionContentPart[];
  toolChoice: "auto" | "required";
  retryHint?: string;
}): Promise<{ plan: PlannedTool[]; rawCount: number }> {
  const planningSystem = `${params.systemPrompt}

FASE DE PLANIFICACIÓN:
Devuelve únicamente el plan de herramientas a ejecutar para este mensaje.
No redactes respuesta al usuario.
`;

  const planningMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: planningSystem },
    ...params.historialLimpio,
    {
      role: "user",
      content: [
        ...params.userParts,
        ...(params.retryHint ? [{ type: "text" as const, text: params.retryHint }] : []),
      ],
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: planningMessages,
    tools: allTools,
    tool_choice: params.toolChoice,
    temperature: 0.2,
    max_tokens: 1000,
  });

  const msg = completion.choices[0]?.message;
  const calls = msg?.tool_calls ?? [];
  const plan = calls
    .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: "function" } => tc.type === "function")
    .map((tc) => {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(tc.function.arguments || "{}");
      } catch {
        parsed = {};
      }
      return { tool: tc.function.name, args: sanitizeArgs(parsed) };
    });
  return { plan, rawCount: calls.length };
}

export async function POST(request: NextRequest) {
  try {
    const familyId = await getScopedFamilyId();
    if (!familyId) {
      return new Response(JSON.stringify({ error: "No tienes una familia asignada" }), { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta OPENAI_API_KEY en el entorno del servidor" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      mensaje?: string;
      historial?: Hist[];
      imagenes?: string[];
      input_fue_audio?: boolean;
    };

    const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";
    const rawHist = Array.isArray(body.historial) ? body.historial : [];
    const imagenesRaw = Array.isArray(body.imagenes) ? body.imagenes : [];

    const imagenes = imagenesRaw
      .filter((x): x is string => typeof x === "string")
      .map((x) => normalizarImagenDataUrl(x))
      .filter((x): x is string => x != null)
      .slice(0, 8);
    const inputFueAudio = body.input_fue_audio === true;

    if (!mensaje && imagenes.length === 0) {
      return NextResponse.json(
        { error: "mensaje o imagenes es obligatorio" },
        { status: 400 },
      );
    }

    const [memories, profiles, shoppingItems, pendingCleaningTasks, currentUserId] = await Promise.all([
      getAgentMemory(familyId),
      getProfiles(familyId),
      getShoppingItems(familyId),
      getPendingCleaningTasks(familyId),
      getScopedUserId(),
    ]);
    const agentCtx: AgentExecutionContext = { familyId, profiles, currentUserId };
    const systemPrompt = buildSystemPrompt(memories);
    const familySnapshotText = buildFamilySnapshotText(profiles);
    const systemPromptWithFamily = `${systemPrompt}\n\n${familySnapshotText}`;
    const adults = profiles.filter((p) => p.role !== "child");
    const avgStress =
      adults.length > 0
        ? adults.reduce((acc, p) => acc + (Number.isFinite(p.stress_level) ? Number(p.stress_level) : 5), 0) /
          adults.length
        : 5;
    const energiaFamiliar = Math.round(Math.max(1, Math.min(10, 10 - avgStress)));
    const tareasPendientes =
      shoppingItems.filter((item) => !item.completed).length + pendingCleaningTasks.length;
    const snapshotText = [
      "CONTEXTO ACTUAL DEL HOGAR:",
      `- hora_actual: ${hhmmNowServer()}`,
      `- energia_familiar: ${energiaFamiliar}`,
      "- estado_sueño: no disponible",
      `- tareas_pendientes: ${tareasPendientes}`,
      `- input_fue_audio: ${inputFueAudio ? "true" : "false"}`,
    ].join("\n");

    const historialLimpio: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    for (const h of rawHist.slice(-40)) {
      if (h.role !== "user" && h.role !== "assistant") continue;
      const c = typeof h.content === "string" ? h.content.trim() : "";
      if (!c) continue;
      historialLimpio.push({ role: h.role, content: c });
    }

    const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (mensaje) {
      userParts.push({ type: "text", text: mensaje });
    }
    for (const url of imagenes) {
      userParts.push({ type: "image_url", image_url: { url } });
    }
    if (userParts.length === 0) {
      userParts.push({ type: "text", text: "Describe las imágenes adjuntas." });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPromptWithFamily },
      { role: "system", content: snapshotText },
      ...historialLimpio,
      { role: "user", content: userParts },
    ];

    const lastUserMsg = extractUserText(
      [...messages].reverse().find((m) => m.role === "user")?.content,
    );
    const intent = detectIntent(lastUserMsg);
    const toolChoice: "auto" | "required" = intent === "ACCION" ? "required" : "auto";

    const toolsExecuted: ToolExecution[] = [];
    const executedCallSignatures = new Set<string>(); // sesión actual/request
    let reply = "";
    let blockedByExclusion = 0;
    let normalizedDuplicateAsSuccess = 0;

    if (intent === "CONSULTA") {
      // Flujo directo de consulta sin fase de planificación estricta.
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: allTools,
        tool_choice: "auto",
        temperature: 0.5,
        max_tokens: 1600,
      });
      const msg = completion.choices[0]?.message;
      if (!msg) {
        return NextResponse.json({ error: "Respuesta vacía del modelo" }, { status: 502 });
      }
      const calls = msg.tool_calls;
      console.log("[api/agent] GPT tool_calls", {
        phase: "consulta-directa",
        count: calls?.length ?? 0,
        calls: (calls ?? []).map((tc) =>
          tc.type === "function"
            ? { id: tc.id, type: tc.type, name: tc.function.name, arguments: tc.function.arguments }
            : { id: tc.id, type: tc.type },
        ),
      });
      if (!calls?.length) {
        reply = msg.content?.trim() ?? "";
      } else {
        // Si consulta trae tools, ejecutar solo esa tanda (sin rondas libres)
        for (const tc of calls) {
          if (tc.type !== "function") continue;
          const name = tc.function.name;
          let args: Record<string, unknown> = {};
          try {
            args = sanitizeArgs(JSON.parse(tc.function.arguments || "{}"));
          } catch {
            args = {};
          }
          args = enrichToolArgs(name, args, profiles);
          const signature = `${name}:${JSON.stringify(args)}`;
          if (executedCallSignatures.has(signature)) continue;
          executedCallSignatures.add(signature);
          let result: unknown;
          let success = false;
          let errorMessage: string | undefined;
          try {
            result = await executeTool(name, args, agentCtx);
            const normalized = normalizeToolResult(name, result);
            success = normalized.success;
            errorMessage = normalized.error;
            if (normalized.success && normalized.error == null && result && typeof result === "object" && "error" in result) {
              normalizedDuplicateAsSuccess += 1;
            }
          } catch (e) {
            errorMessage = e instanceof Error ? e.message : "Error al ejecutar herramienta";
            if (isDuplicateLikeError(errorMessage)) {
              success = true;
              result = { ok: true, normalized_duplicate: true };
              normalizedDuplicateAsSuccess += 1;
              errorMessage = undefined;
            } else {
              result = { error: errorMessage };
            }
          }
          toolsExecuted.push({ name, success, result, ...(errorMessage ? { error: errorMessage } : {}) });
        }
      }
    } else {
      // FASE 1 — Planning
      let planning = await planToolsFromModel({
        systemPrompt: systemPromptWithFamily,
        historialLimpio,
        userParts,
        toolChoice,
      });
      console.log("[api/agent] planning phase output", {
        intent,
        rawCount: planning.rawCount,
        plan: planning.plan,
      });

      if (planning.plan.length === 0) {
        planning = await planToolsFromModel({
          systemPrompt: systemPromptWithFamily,
          historialLimpio,
          userParts,
          toolChoice: "required",
          retryHint: "No encontré tools para esta acción, intenta de nuevo con tools específicas.",
        });
        console.log("[api/agent] planning retry output", {
          intent,
          rawCount: planning.rawCount,
          plan: planning.plan,
        });
      }

      if (planning.plan.length === 0) {
        reply = "Necesito un detalle más para registrarlo bien. ¿Me lo concretas?";
      } else {
        const rawPlan = planning.plan;
        const ordered = applyGuardrails(rawPlan, lastUserMsg);
        console.log("[api/agent] validated plan", {
          blockedByExclusion,
          orderedPlan: ordered,
        });

        // FASE 2 — ejecución blindada (sin rondas libres)
        // Ejecutar TODAS las categorías antes de respuesta final:
        // destructive -> writes -> communication -> reads (máx 1 al final).
        const destructive = ordered.filter((s) => isDestructiveTool(s.tool));
        const writes = ordered.filter(
          (s) => /^(add_|log_|save_|update_)/.test(s.tool) && !isCommunicationTool(s.tool),
        );
        const communication = ordered.filter((s) => isCommunicationTool(s.tool));
        const reads = ordered.filter((s) => isReadTool(s.tool));
        const executionQueue = [...destructive, ...writes, ...communication];
        let hasMutationSuccess = false;

        for (const step of executionQueue) {
          const stepArgs = enrichToolArgs(step.tool, step.args, profiles);
          const signature = `${step.tool}:${JSON.stringify(stepArgs)}`;
          if (executedCallSignatures.has(signature)) {
            const duplicateResult = { error: "Tool duplicada evitada: ya se ejecutó en esta sesión con los mismos argumentos." };
            toolsExecuted.push({
              name: step.tool,
              success: false,
              result: duplicateResult,
              error: duplicateResult.error,
            });
            continue;
          }
          executedCallSignatures.add(signature);

          let result: unknown;
          let success = false;
          let errorMessage: string | undefined;
          try {
            result = await executeTool(step.tool, stepArgs, agentCtx);
            const normalized = normalizeToolResult(step.tool, result);
            success = normalized.success;
            errorMessage = normalized.error;
            if (success && normalized.error == null && result && typeof result === "object" && "error" in result) {
              normalizedDuplicateAsSuccess += 1;
            }
          } catch (e) {
            const rawErr = e instanceof Error ? e.message : "Error al ejecutar herramienta";
            if (isDuplicateLikeError(rawErr)) {
              success = true;
              result = { ok: true, normalized_duplicate: true };
              normalizedDuplicateAsSuccess += 1;
            } else {
              success = false;
              errorMessage = rawErr;
              result = { error: rawErr };
            }
          }
          toolsExecuted.push({
            name: step.tool,
            success,
            result,
            ...(errorMessage ? { error: errorMessage } : {}),
          });
          if (success && (!isReadTool(step.tool) || isCommunicationTool(step.tool))) hasMutationSuccess = true;
        }

        // STOP TEMPRANO REFORMADO:
        // Sólo tras agotar todas las mutaciones. Lecturas opcionales al final (máx 1).
        if (reads.length > 0) {
          const readStep = reads[reads.length - 1];
          const readArgs = enrichToolArgs(readStep.tool, readStep.args, profiles);
          const signature = `${readStep.tool}:${JSON.stringify(readArgs)}`;
          if (!executedCallSignatures.has(signature)) {
            executedCallSignatures.add(signature);
            let result: unknown;
            let success = false;
            let errorMessage: string | undefined;
            try {
              result = await executeTool(readStep.tool, readArgs, agentCtx);
              const normalized = normalizeToolResult(readStep.tool, result);
              success = normalized.success;
              errorMessage = normalized.error;
            } catch (e) {
              const rawErr = e instanceof Error ? e.message : "Error al ejecutar herramienta";
              if (isDuplicateLikeError(rawErr)) {
                success = true;
                result = { ok: true, normalized_duplicate: true };
                normalizedDuplicateAsSuccess += 1;
              } else {
                success = false;
                errorMessage = rawErr;
                result = { error: rawErr };
              }
            }
            toolsExecuted.push({
              name: readStep.tool,
              success,
              result,
              ...(errorMessage ? { error: errorMessage } : {}),
            });
          }
        }

        if (hasMutationSuccess) {
          reply = "Listo, ya está hecho. Si quieres, te enseño un resumen.";
        }
      }
    }

    if (!reply) {
      const failures = toolsExecuted.filter((t) => !t.success);
      const hasSuccess = toolsExecuted.some((t) => t.success);
      if (hasSuccess) {
        reply = "Listo, ya está hecho.";
      } else if (failures.length > 0) {
        const details = failures
          .map((f) => `- ${f.name}: ${f.error ?? "Error no especificado"}`)
          .join("\n");
        reply = `He encontrado errores al ejecutar algunas acciones:\n${details}\n\nNo he podido completar todo correctamente.`;
      } else {
        reply =
          toolsExecuted.length > 0
            ? "Listo, he aplicado los cambios que pedías."
            : "No he podido generar una respuesta; prueba de nuevo.";
      }
    }

    console.log("[api/agent] final summary", {
      intent,
      toolsExecuted: toolsExecuted.length,
      blockedByExclusion,
      normalizedDuplicateAsSuccess,
      reply,
    });

    return NextResponse.json({ reply, toolsExecuted, respuesta: reply });
  } catch (e) {
    console.error("POST /api/agent:", e);
    return NextResponse.json({ error: "Error interno del agente" }, { status: 500 });
  }
}
