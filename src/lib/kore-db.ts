import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

/** IDs fijos hasta auth real (mismo contrato que `kore-seed.ts`). */
export const ANDER_ID = "00000000-0000-0000-0000-000000000001";
export const LEIRE_ID = "00000000-0000-0000-0000-000000000002";
/** Paciente “Peque” hasta perfil dedicado en Supabase. */
export const PEQUE_ID = "00000000-0000-0000-0000-000000000003";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Domain = Database["public"]["Tables"]["domains"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type HealthRecord = Database["public"]["Tables"]["health_records"]["Row"];
export type KoreNote = Database["public"]["Tables"]["kore_notes"]["Row"];
export type DailyMetrics = Database["public"]["Tables"]["daily_metrics"]["Row"];

/* ─── Tablas presentes en Supabase pero aún no en `types/database.ts` ─── */

export type CalendarEventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  created_by: string | null;
  created_at: string;
};

export type CalendarEventInsert = {
  id?: string;
  title: string;
  date: string;
  time: string;
  created_by?: string | null;
  created_at?: string;
};

export type DomainHistoryRow = {
  id: string;
  domain_id: string;
  text: string;
  created_by: string;
  created_at: string;
};

export type DomainHistoryInsert = {
  id?: string;
  domain_id: string;
  text: string;
  created_by: string;
  created_at?: string;
};

export type ConversationRow = {
  id: string;
  type: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  audio_url: string | null;
  created_at: string;
};

export type AgentMemoryRow = {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
};

type ExtendedTables = Database["public"]["Tables"] & {
  calendar_events: {
    Row: CalendarEventRow;
    Insert: Omit<CalendarEventRow, "id" | "created_at"> & {
      id?: string;
      created_at?: string;
    };
    Update: Partial<CalendarEventRow>;
    Relationships: [];
  };
  domain_history: {
    Row: DomainHistoryRow;
    Insert: DomainHistoryInsert;
    Update: Partial<DomainHistoryRow>;
    Relationships: [];
  };
  conversations: {
    Row: ConversationRow;
    Insert: Omit<ConversationRow, "id" | "created_at"> & {
      id?: string;
      created_at?: string;
    };
    Update: Partial<ConversationRow>;
    Relationships: [];
  };
  messages: {
    Row: MessageRow;
    Insert: Omit<MessageRow, "id" | "created_at"> & {
      id?: string;
      created_at?: string;
    };
    Update: Partial<MessageRow>;
    Relationships: [];
  };
  agent_memory: {
    Row: AgentMemoryRow;
    Insert: Omit<AgentMemoryRow, "id" | "created_at" | "updated_at"> & {
      id?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<AgentMemoryRow>;
    Relationships: [];
  };
};

export type KoreDatabase = {
  public: Omit<Database["public"], "Tables"> & {
    Tables: ExtendedTables;
  };
};

type KoreClient = SupabaseClient<KoreDatabase>;

/** Cliente browser tipado con tablas Kore (incluye las aún no reflejadas en `database.ts`). */
export function getKoreSupabaseClient(): KoreClient {
  return createClient() as unknown as KoreClient;
}

function getClient(): KoreClient {
  return getKoreSupabaseClient();
}

function throwDb(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ─── PERFILES ───────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from("profiles").select("*").order("name", { ascending: true });
  if (error) {
    console.error("[kore-db] getProfiles", error);
    return [];
  }
  return data ?? [];
}

export async function updateStressLevel(userId: string, level: number): Promise<void> {
  const supabase = getClient();
  const stress_level = Math.min(10, Math.max(1, Math.round(level)));
  const { error } = await supabase
    .from("profiles")
    .update({ stress_level, updated_at: new Date().toISOString() })
    .eq("id", userId);
  throwDb("updateStressLevel", error);
}

// ─── DOMINIOS ───────────────────────────────────────────────────────────────

export async function getDomains(): Promise<Domain[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from("domains").select("*").order("name", { ascending: true });
  if (error) {
    console.error("[kore-db] getDomains", error);
    return [];
  }
  return data ?? [];
}

export async function updateDomain(id: string, data: Partial<Domain>): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("domains").update(data).eq("id", id);
  throwDb("updateDomain", error);
}

export async function addDomainHistory(domainId: string, text: string, createdBy: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("domain_history").insert({
    domain_id: domainId,
    text,
    created_by: createdBy,
  });
  throwDb("addDomainHistory", error);
}

export async function getDomainHistory(domainId: string): Promise<DomainHistoryRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("domain_history")
    .select("*")
    .eq("domain_id", domainId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[kore-db] getDomainHistory", error);
    return [];
  }
  return data ?? [];
}

// ─── AGENDA ───────────────────────────────────────────────────────────────

export async function getCalendarEvents(): Promise<CalendarEventRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) {
    console.error("[kore-db] getCalendarEvents", error);
    return [];
  }
  return data ?? [];
}

export async function addCalendarEvent(event: CalendarEventInsert): Promise<CalendarEventRow> {
  const supabase = getClient();
  const row = {
    title: event.title,
    date: event.date,
    time: event.time,
    created_by: event.created_by ?? null,
    ...(event.id ? { id: event.id } : {}),
    ...(event.created_at ? { created_at: event.created_at } : {}),
  };
  const { data, error } = await supabase.from("calendar_events").insert(row).select("*").single();
  throwDb("addCalendarEvent", error);
  return data as CalendarEventRow;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  throwDb("deleteCalendarEvent", error);
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<Pick<CalendarEventRow, "title" | "date" | "time" | "created_by">>,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("calendar_events").update(data).eq("id", id);
  throwDb("updateCalendarEvent", error);
}

// ─── GASTOS ─────────────────────────────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[kore-db] getExpenses", error);
    return [];
  }
  return data ?? [];
}

export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export async function addExpense(expense: ExpenseInsert): Promise<Expense> {
  const supabase = getClient();
  const { data, error } = await supabase.from("expenses").insert(expense).select("*").single();
  throwDb("addExpense", error);
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  throwDb("deleteExpense", error);
}

// ─── SALUD ──────────────────────────────────────────────────────────────────

export async function getHealthRecords(): Promise<HealthRecord[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from("health_records").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[kore-db] getHealthRecords", error);
    return [];
  }
  return data ?? [];
}

export type HealthRecordInsert = Database["public"]["Tables"]["health_records"]["Insert"];

export async function addHealthRecord(record: HealthRecordInsert): Promise<HealthRecord> {
  const supabase = getClient();
  const { data, error } = await supabase.from("health_records").insert(record).select("*").single();
  throwDb("addHealthRecord", error);
  return data as HealthRecord;
}

export async function updateHealthRecord(
  id: string,
  data: Partial<Omit<HealthRecord, "id" | "created_at">>,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("health_records").update(data).eq("id", id);
  throwDb("updateHealthRecord", error);
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("health_records").delete().eq("id", id);
  throwDb("deleteHealthRecord", error);
}

// ─── NOTAS / CORCHO ─────────────────────────────────────────────────────────

export async function getKoreNotes(recipientId: string): Promise<KoreNote[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("kore_notes")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[kore-db] getKoreNotes", error);
    return [];
  }
  return data ?? [];
}

export type KoreNoteInsert = Database["public"]["Tables"]["kore_notes"]["Insert"];

export async function addKoreNote(note: KoreNoteInsert): Promise<KoreNote> {
  const supabase = getClient();
  const { data, error } = await supabase.from("kore_notes").insert(note).select("*").single();
  throwDb("addKoreNote", error);
  return data as KoreNote;
}

export async function markNoteAsRead(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("kore_notes").update({ status: "read" }).eq("id", id);
  throwDb("markNoteAsRead", error);
}

// ─── MÉTRICAS DIARIAS ───────────────────────────────────────────────────────

export async function getDailyMetrics(date: string): Promise<DailyMetrics | null> {
  const supabase = getClient();
  const { data, error } = await supabase.from("daily_metrics").select("*").eq("date", date).maybeSingle();
  if (error) {
    console.error("[kore-db] getDailyMetrics", error);
    return null;
  }
  return data;
}

export type DailyMetricsUpsert = Database["public"]["Tables"]["daily_metrics"]["Insert"];

export async function upsertDailyMetrics(metrics: DailyMetricsUpsert): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("daily_metrics").upsert(metrics, { onConflict: "date" });
  throwDb("upsertDailyMetrics", error);
}

// ─── MEMORIA DEL AGENTE ─────────────────────────────────────────────────────

export async function getAgentMemory(): Promise<AgentMemoryRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (error) {
    console.error("[kore-db] getAgentMemory", error);
    return [];
  }
  return data ?? [];
}

export async function upsertAgentMemory(key: string, value: string, category: string): Promise<void> {
  const supabase = getClient();
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await supabase.from("agent_memory").select("id").eq("key", key).maybeSingle();
  throwDb("upsertAgentMemory(select)", selErr);
  if (existing?.id) {
    const { error } = await supabase
      .from("agent_memory")
      .update({ value, category, updated_at: now })
      .eq("id", existing.id);
    throwDb("upsertAgentMemory(update)", error);
    return;
  }
  const { error } = await supabase.from("agent_memory").insert({
    key,
    value,
    category,
    created_at: now,
    updated_at: now,
  });
  throwDb("upsertAgentMemory(insert)", error);
}
