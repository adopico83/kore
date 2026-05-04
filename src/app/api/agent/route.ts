import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { allTools, buildSystemPrompt, executeTool } from "@/lib/agents/orchestrator";
import { getAgentMemory } from "@/lib/kore-db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Hist = { role: string; content: string };

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

const MAX_TOOL_ROUNDS = 14;

export async function POST(request: NextRequest) {
  try {
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
    };

    const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";
    const rawHist = Array.isArray(body.historial) ? body.historial : [];
    const imagenesRaw = Array.isArray(body.imagenes) ? body.imagenes : [];

    const imagenes = imagenesRaw
      .filter((x): x is string => typeof x === "string")
      .map((x) => normalizarImagenDataUrl(x))
      .filter((x): x is string => x != null)
      .slice(0, 8);

    if (!mensaje && imagenes.length === 0) {
      return NextResponse.json(
        { error: "mensaje o imagenes es obligatorio" },
        { status: 400 },
      );
    }

    const memories = await getAgentMemory();
    const systemPrompt = buildSystemPrompt(memories);

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
      { role: "system", content: systemPrompt },
      ...historialLimpio,
      { role: "user", content: userParts },
    ];

    const toolsExecuted: { name: string; result: unknown }[] = [];
    let reply = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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

      messages.push(msg);

      const calls = msg.tool_calls;
      if (!calls?.length) {
        reply = msg.content?.trim() ?? "";
        break;
      }

      for (const tc of calls) {
        if (tc.type !== "function") continue;
        const name = tc.function.name;
        let args: unknown = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await executeTool(name, args);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "Error al ejecutar herramienta" };
        }
        toolsExecuted.push({ name, result });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!reply) {
      reply =
        toolsExecuted.length > 0
          ? "Listo, he aplicado los cambios que pedías."
          : "No he podido generar una respuesta; prueba de nuevo.";
    }

    return NextResponse.json({ reply, toolsExecuted, respuesta: reply });
  } catch (e) {
    console.error("POST /api/agent:", e);
    return NextResponse.json({ error: "Error interno del agente" }, { status: 500 });
  }
}
