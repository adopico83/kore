"use server";

import { getScopedFamilyId, getScopedUserId } from "@/lib/family-context";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AgentMessageRow = Database["public"]["Tables"]["agent_messages"]["Row"];

export type AgentConversationSummary = {
  conversation_id: string;
  titulo: string;
  created_at: string;
  total_mensajes: number;
};

function extractTitleFromStoredUserContent(content: string): string {
  try {
    const p = JSON.parse(content) as { v?: number; t?: string };
    if (p && p.v === 1 && typeof p.t === "string") return p.t.trim();
  } catch {
    /* texto plano legacy / no JSON */
  }
  return content.trim();
}

async function requireAgentChatContext(): Promise<{ userId: string; familyId: string }> {
  const userId = await getScopedUserId();
  const familyId = await getScopedFamilyId();
  if (!userId || !familyId) throw new Error("No autenticado");
  return { userId, familyId };
}

async function queryAgentMessages(
  familyId: string,
  userId: string,
  conversationId: string,
): Promise<AgentMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getAgentMessages: ${error.message}`);
  return (data ?? []) as AgentMessageRow[];
}

async function insertAgentMessage(
  familyId: string,
  userId: string,
  conversationId: string,
  role: string,
  content: string,
): Promise<AgentMessageRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .insert({
      family_id: familyId,
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
    })
    .select("*")
    .single();
  if (error) throw new Error(`saveAgentMessage: ${error.message}`);
  return data as AgentMessageRow;
}

async function deleteAgentMessagesForConversation(
  familyId: string,
  userId: string,
  conversationId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_messages")
    .delete()
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);
  if (error) throw new Error(`deleteAgentMessagesForConversation: ${error.message}`);
}

async function queryAgentConversations(
  familyId: string,
  userId: string,
): Promise<AgentConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_messages")
    .select("conversation_id, content, role, created_at")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getAgentConversations: ${error.message}`);
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  const byConv = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byConv.get(row.conversation_id);
    if (list) list.push(row);
    else byConv.set(row.conversation_id, [row]);
  }
  const summaries: (AgentConversationSummary & { _last_at: string })[] = [];
  for (const [conversation_id, convRows] of byConv) {
    const first = convRows[0];
    const last = convRows[convRows.length - 1];
    const firstUser = convRows.find((x) => x.role === "user");
    const rawTitulo = firstUser ? extractTitleFromStoredUserContent(firstUser.content) : "";
    const titulo =
      rawTitulo.length > 60 ? `${rawTitulo.slice(0, 60)}…` : rawTitulo || "Nueva conversación";
    const created_at = first?.created_at ?? last?.created_at ?? new Date().toISOString();
    const last_at = last?.created_at ?? created_at;
    summaries.push({
      conversation_id,
      titulo,
      created_at: created_at ?? new Date().toISOString(),
      total_mensajes: convRows.length,
      _last_at: last_at ?? "",
    });
  }
  summaries.sort((a, b) => b._last_at.localeCompare(a._last_at));
  return summaries.slice(0, 20).map(({ _last_at: _ignored, ...rest }) => rest);
}

async function bulkInsertAgentMessages(
  familyId: string,
  userId: string,
  inserts: { conversation_id: string; role: string; content: string; created_at?: string | null }[],
): Promise<void> {
  if (inserts.length === 0) return;
  const supabase = await createClient();
  const BATCH = 200;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const slice = inserts.slice(i, i + BATCH);
    const payload = slice.map((r) => ({
      family_id: familyId,
      user_id: userId,
      conversation_id: r.conversation_id,
      role: r.role,
      content: r.content,
      ...(r.created_at ? { created_at: r.created_at } : {}),
    }));
    const { error } = await supabase.from("agent_messages").insert(payload);
    if (error) throw new Error(`bulkInsertAgentMessages: ${error.message}`);
  }
}

export async function getAgentMessages(conversationId: string): Promise<AgentMessageRow[]> {
  const { userId, familyId } = await requireAgentChatContext();
  return queryAgentMessages(familyId, userId, conversationId);
}

export async function saveAgentMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<AgentMessageRow> {
  const { userId, familyId } = await requireAgentChatContext();
  return insertAgentMessage(familyId, userId, conversationId, role, content);
}

export async function getAgentConversations(): Promise<AgentConversationSummary[]> {
  const { userId, familyId } = await requireAgentChatContext();
  return queryAgentConversations(familyId, userId);
}

export async function deleteAgentConversation(conversationId: string): Promise<void> {
  const { userId, familyId } = await requireAgentChatContext();
  await deleteAgentMessagesForConversation(familyId, userId, conversationId);
}

export async function importLegacyAgentMessages(
  clientUserId: string,
  rows: { conversation_id: string; role: string; content: string; created_at?: string }[],
): Promise<void> {
  const { userId, familyId } = await requireAgentChatContext();
  if (clientUserId !== userId) throw new Error("Sesión no coincide con el usuario del cliente");
  await bulkInsertAgentMessages(familyId, userId, rows);
}
