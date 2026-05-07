import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { addKoreNote, ANDER_ID, getKoreNotes, LEIRE_ID, markNoteAsRead } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en comunicación asíncrona entre Ander y Leire. Gestiona ÚNICAMENTE mensajes, notas y comunicación entre la pareja.";

function personToId(p: string): string | null {
  if (p === "Ander") return ANDER_ID;
  if (p === "Leire") return LEIRE_ID;
  return null;
}

const NAMES = new Set(["send_note", "get_unread_notes", "mark_note_read", "get_notes_history"]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_note",
      description: "Envía una nota al Corcho.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", enum: ["Ander", "Leire"] },
          to: { type: "string", enum: ["Ander", "Leire"] },
          content: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["from", "to", "content", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_notes",
      description: "Notas no leídas para el destinatario indicado.",
      parameters: {
        type: "object",
        properties: {
          recipient: { type: "string", enum: ["Ander", "Leire"] },
        },
        required: ["recipient"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_note_read",
      description: "Marca una nota como leída.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_notes_history",
      description: "Historial reciente de notas en ambos sentidos.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Corcho." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "send_note": {
      const from = personToId(String(a.from ?? ""));
      const to = personToId(String(a.to ?? ""));
      const content = String(a.content ?? "").trim();
      const priority = a.priority as "low" | "medium" | "high";
      if (!from || !to || from === to || !content || !priority) {
        return { error: "Remitente, destinatario o contenido inválidos." };
      }
      const row = await addKoreNote({
        sender_id: from,
        recipient_id: to,
        content,
        audio_url: null,
        status: "unread",
        priority,
      });
      return { ok: true, note: row };
    }
    case "get_unread_notes": {
      const recipient = personToId(String(a.recipient ?? ""));
      if (!recipient) return { error: "Destinatario inválido." };
      const notes = await getKoreNotes(recipient);
      const unread = notes.filter((n) => n.status === "unread");
      return { ok: true, notes: unread };
    }
    case "mark_note_read": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await markNoteAsRead(id);
      return { ok: true, id };
    }
    case "get_notes_history": {
      const aNotes = await getKoreNotes(ANDER_ID);
      const lNotes = await getKoreNotes(LEIRE_ID);
      const merged = [...aNotes, ...lNotes].sort(
        (x, y) => new Date(y.created_at ?? "").getTime() - new Date(x.created_at ?? "").getTime(),
      );
      const seen = new Set<string>();
      const unique = merged.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
      return { ok: true, notes: unique.slice(0, 80) };
    }
    default:
      return { error: "Herramienta no reconocida en Corcho." };
  }
}
