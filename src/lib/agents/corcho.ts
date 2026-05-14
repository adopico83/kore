import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import type { Profile } from "@/lib/kore-db";
import { addKoreNote, getKoreNotes, markNoteAsRead } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en comunicación asíncrona entre miembros del hogar. Gestiona ÚNICAMENTE mensajes, notas y comunicación en el Corcho (pareja / familia).";

function personToId(p: string, profiles: Profile[]): string | null {
  return resolveProfileIdFromAgentToken(p, profiles);
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
      description: "Notas no leídas para el destinatario indicado (nombre o rol legacy Ander/Leire/Peque).",
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
      description: "Historial reciente de notas en el hogar.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Corcho." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { profiles, familyId } = ctx;

  switch (toolName) {
    case "send_note": {
      const from = personToId(String(a.from ?? ""), profiles);
      const to = personToId(String(a.to ?? ""), profiles);
      const content = String(a.content ?? "").trim();
      const priority = a.priority as "low" | "medium" | "high";
      if (!from || !to || from === to || !content || !priority) {
        return { error: "Remitente, destinatario o contenido inválidos." };
      }
      const row = await addKoreNote(familyId, {
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
      const recipient = personToId(String(a.recipient ?? ""), profiles);
      if (!recipient) return { error: "Destinatario inválido." };
      const notes = await getKoreNotes(familyId, recipient);
      const unread = notes.filter((n) => n.status === "unread");
      return { ok: true, notes: unread };
    }
    case "mark_note_read": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await markNoteAsRead(familyId, id);
      return { ok: true, id };
    }
    case "get_notes_history": {
      const notes = await getKoreNotes(familyId);
      const sorted = [...notes].sort(
        (x, y) => new Date(y.created_at ?? "").getTime() - new Date(x.created_at ?? "").getTime(),
      );
      return { ok: true, notes: sorted.slice(0, 80) };
    }
    default:
      return { error: "Herramienta no reconocida en Corcho." };
  }
}
