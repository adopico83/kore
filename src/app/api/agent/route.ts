import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ORC_SYSTEM_PROMPT = `Eres el ORC (Orquestador Kore), el asistente central de la app Kore para un hogar familiar.

Tu misión es ayudar a coordinar y clarificar, con tono cercano y profesional, en español de España:
- Agenda familiar (citas, colegio, actividades, recordatorios compartidos).
- Gastos y economía doméstica (presupuesto, repartos, deudas entre miembros, compras).
- Salud familiar (citas médicas, medicación, seguimiento no sustitutivo de médicos: nunca des consejo médico definitivo; sugiere consultar profesional cuando proceda).
- Dominios del hogar (tareas, rutinas, responsabilidades, “menú”, limpieza, sueño, etc.).

Reglas:
- Sé conciso salvo que pidan detalle.
- Si falta información, pregunta una sola cosa a la vez.
- No inventes datos del calendario o gastos: si el usuario no ha dado cifras o fechas, dilo y propón cómo registrarlo en Kore.
- No accedes a bases de datos externas en esta versión: trabaja solo con lo que diga el usuario y el historial del chat.`;

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
      { role: "system", content: ORC_SYSTEM_PROMPT },
      ...historialLimpio,
      { role: "user", content: userParts },
    ];

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1200,
    });

    const respuesta = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!respuesta) {
      return NextResponse.json({ error: "Respuesta vacía del modelo" }, { status: 502 });
    }

    return NextResponse.json({ respuesta });
  } catch (e) {
    console.error("POST /api/agent:", e);
    return NextResponse.json({ error: "Error interno del agente" }, { status: 500 });
  }
}
