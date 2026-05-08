import OpenAI from "openai";

const SYSTEM_PROMPT =
  "Eres un asistente que extrae nombres propios de personas. Devuelve SOLO un JSON con esta estructura exacta: { owner: string, partner: string | null, children: string[] }. Extrae solo nombres propios, nunca frases completas. Si no hay pareja devuelve null, si no hay hijos devuelve array vacío. No inventes nombres.";

export type ExtractedFamilyMembers = {
  owner: string;
  partner: string | null;
  children: string[];
};

function fallbackExtractFamilyMembers(text: string): ExtractedFamilyMembers {
  const parsedNames = text
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (parsedNames.length === 0) {
    return { owner: "", partner: null, children: [] };
  }
  const [first, ...rest] = parsedNames;
  return { owner: "", partner: first, children: rest };
}

function normalizeExtracted(raw: unknown): ExtractedFamilyMembers | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const owner = typeof o.owner === "string" ? o.owner.trim() : "";

  let partner: string | null = null;
  if (o.partner === null || o.partner === undefined) {
    partner = null;
  } else if (typeof o.partner === "string") {
    partner = o.partner.trim() || null;
  } else {
    return null;
  }

  if (!Array.isArray(o.children)) return null;
  const children = o.children
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter(Boolean);

  return { owner, partner, children };
}

/**
 * Extrae owner, partner e hijos del texto. El caller que persiste en DB debe ignorar `owner`
 * (el perfil owner ya existe tras el registro).
 */
export async function extractFamilyMembers(text: string): Promise<ExtractedFamilyMembers> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { owner: "", partner: null, children: [] };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackExtractFamilyMembers(trimmed);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return fallbackExtractFamilyMembers(trimmed);
    }

    const parsed: unknown = JSON.parse(content);
    const normalized = normalizeExtracted(parsed);
    if (!normalized) {
      return fallbackExtractFamilyMembers(trimmed);
    }
    return normalized;
  } catch {
    return fallbackExtractFamilyMembers(trimmed);
  }
}
