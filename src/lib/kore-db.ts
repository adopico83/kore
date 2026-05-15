import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addDays,
  computeInitialNextDueDate,
  computeNextDueDate,
  formatDateIso,
  todayIsoDate,
} from "@/lib/cleaning-schedule";
import type { Database, Json } from "@/types/database";
import { getBrowserClient } from "@/lib/supabase/client";

export const ANDER_ID = "6204d1a5-bbba-4a01-a9f2-b0742ee0bcd4";
export const LEIRE_ID = "63c1ffab-4fa1-4953-8d5f-9c5b7e1d5bd4";
export const FAMILY_ID = "8378283a-cfc0-46ec-90c0-07e45c885aee";
export const PEQUE_ID = "00000000-0000-0000-0000-000000000003";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Domain = Database["public"]["Tables"]["domains"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type HealthRecord = Database["public"]["Tables"]["health_records"]["Row"];
export type KoreNote = Database["public"]["Tables"]["kore_notes"]["Row"];
export type DailyMetrics = Database["public"]["Tables"]["daily_metrics"]["Row"];

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

export type AgentMemoryRow = {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
};

export type ShoppingItemRow = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  priority: string | null;
  completed: boolean;
  created_by: string | null;
  created_at: string;
};

export type CleaningTaskRow = {
  id: string;
  zone: string;
  task: string;
  frequency: string | null;
  assigned_to: string | null;
  completed: boolean;
  created_at: string;
  last_completed_at: string | null;
  next_due_at: string | null;
};

export type MenuItemRow = {
  id: string;
  day: string;
  meal: string;
  dish: string;
  week_start: string;
  created_at: string;
};

export type SchoolEventRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  type: string | null;
  description: string | null;
  calendar_event_id: string | null;
  created_at: string;
};

export type SleepSessionRow = {
  id: string;
  family_id: string;
  profile_id: string;
  sleep_start: string;
  sleep_end: string;
  wake_count: number;
  notes: string | null;
  created_at: string;
};

export type SchoolMaterialRow = {
  id: string;
  item: string;
  urgency: string | null;
  completed: boolean;
  created_at: string;
};

export type LeisureActivityRow = {
  id: string;
  person: string;
  activity: string;
  date: string | null;
  duration_minutes: number | null;
  created_at: string;
};

export type SleepLogRow = {
  id: string;
  person: string;
  type: string;
  reason: string | null;
  hours: number | null;
  logged_at: string;
};

/** Serialización de PushSubscription (navegador / web-push). */
export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

/** Objeto listo para `web-push` / `PushManager.subscribe` resultado. */
export type WebPushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

export function parseSubscriptionDataToWebPush(data: Json | null): WebPushSubscriptionPayload | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const endpoint = typeof o.endpoint === "string" ? o.endpoint : "";
  const keysRaw = o.keys;
  if (!keysRaw || typeof keysRaw !== "object" || Array.isArray(keysRaw)) return null;
  const keys = keysRaw as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  if (!endpoint || !p256dh || !auth) return null;
  const out: WebPushSubscriptionPayload = { endpoint, keys: { p256dh, auth } };
  if (typeof o.expirationTime === "number") out.expirationTime = o.expirationTime;
  else if (o.expirationTime === null) out.expirationTime = null;
  return out;
}

type ExtendedTables = Database["public"]["Tables"] & {
  calendar_events: {
    Row: CalendarEventRow;
    Insert: Omit<CalendarEventRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<CalendarEventRow>;
    Relationships: [];
  };
  domain_history: {
    Row: DomainHistoryRow;
    Insert: DomainHistoryInsert;
    Update: Partial<DomainHistoryRow>;
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
  shopping_items: {
    Row: ShoppingItemRow;
    Insert: Omit<ShoppingItemRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<ShoppingItemRow>;
    Relationships: [];
  };
  cleaning_tasks: {
    Row: CleaningTaskRow;
    Insert: Omit<CleaningTaskRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<CleaningTaskRow>;
    Relationships: [];
  };
  menu_items: {
    Row: MenuItemRow;
    Insert: Omit<MenuItemRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<MenuItemRow>;
    Relationships: [];
  };
  school_events: {
    Row: SchoolEventRow;
    Insert: Omit<SchoolEventRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<SchoolEventRow>;
    Relationships: [];
  };
  school_materials: {
    Row: SchoolMaterialRow;
    Insert: Omit<SchoolMaterialRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<SchoolMaterialRow>;
    Relationships: [];
  };
  leisure_activities: {
    Row: LeisureActivityRow;
    Insert: Omit<LeisureActivityRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<LeisureActivityRow>;
    Relationships: [];
  };
  sleep_logs: {
    Row: SleepLogRow;
    Insert: Omit<SleepLogRow, "id" | "logged_at"> & { id?: string; logged_at?: string };
    Update: Partial<SleepLogRow>;
    Relationships: [];
  };
  sleep_sessions: {
    Row: SleepSessionRow;
    Insert: Omit<SleepSessionRow, "id" | "created_at"> & { id?: string; created_at?: string };
    Update: Partial<SleepSessionRow>;
    Relationships: [];
  };
};

export type KoreDatabase = {
  public: Omit<Database["public"], "Tables"> & {
    Tables: ExtendedTables;
  };
};

type KoreClient = SupabaseClient<KoreDatabase>;

function db(): KoreClient {
  return getBrowserClient();
}

function throwDb(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function getProfiles(familyId: string): Promise<Profile[]> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function updateStressLevel(familyId: string, userId: string, level: number): Promise<void> {
  const stress_level = Math.min(10, Math.max(1, Math.round(level)));
  const { error } = await db()
    .from("profiles")
    .update({ stress_level, updated_at: new Date().toISOString() })
    .eq("family_id", familyId)
    .eq("id", userId);
  throwDb("updateStressLevel", error);
}

export async function getCalendarEvents(familyId: string): Promise<CalendarEventRow[]> {
  const { data, error } = await db()
    .from("calendar_events")
    .select("*")
    .eq("family_id", familyId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addCalendarEvent(familyId: string, data: CalendarEventInsert): Promise<CalendarEventRow> {
  const row = {
    family_id: familyId,
    title: data.title,
    date: data.date,
    time: data.time,
    created_by: data.created_by ?? null,
    ...(data.id ? { id: data.id } : {}),
    ...(data.created_at ? { created_at: data.created_at } : {}),
  };
  const { data: created, error } = await db().from("calendar_events").insert(row).select("*").single();
  throwDb("addCalendarEvent", error);
  return created as CalendarEventRow;
}

export async function deleteCalendarEvent(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("calendar_events").delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteCalendarEvent", error);
}

export async function updateCalendarEvent(
  familyId: string,
  id: string,
  data: Partial<Pick<CalendarEventRow, "title" | "date" | "time" | "created_by">>,
): Promise<void> {
  const { error } = await db().from("calendar_events").update(data).eq("family_id", familyId).eq("id", id);
  throwDb("updateCalendarEvent", error);
}

export type HealthRecordInsert = Database["public"]["Tables"]["health_records"]["Insert"];

export async function getHealthRecords(familyId: string, patientId?: string): Promise<HealthRecord[]> {
  let query = db()
    .from("health_records")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (patientId) query = query.eq("patient_id", patientId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addHealthRecord(familyId: string, data: HealthRecordInsert): Promise<HealthRecord> {
  const { data: created, error } = await db()
    .from("health_records")
    .insert({ ...data, family_id: familyId })
    .select("*")
    .single();
  throwDb("addHealthRecord", error);
  return created as HealthRecord;
}

export async function updateHealthRecord(
  familyId: string,
  id: string,
  data: Partial<Omit<HealthRecord, "id" | "created_at">>,
): Promise<void> {
  const { error } = await db().from("health_records").update(data).eq("family_id", familyId).eq("id", id);
  throwDb("updateHealthRecord", error);
}

export async function deleteHealthRecord(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("health_records").delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteHealthRecord", error);
}

export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export async function getExpenses(familyId: string): Promise<Expense[]> {
  const { data, error } = await db()
    .from("expenses")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addExpense(familyId: string, data: ExpenseInsert): Promise<Expense> {
  const { data: created, error } = await db()
    .from("expenses")
    .insert({ ...data, family_id: familyId })
    .select("*")
    .single();
  throwDb("addExpense", error);
  return created as Expense;
}

export async function deleteExpense(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("expenses").delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteExpense", error);
}

export type KoreNoteInsert = Database["public"]["Tables"]["kore_notes"]["Insert"];

export async function getKoreNotes(familyId: string, recipientId?: string): Promise<KoreNote[]> {
  let query = db()
    .from("kore_notes")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (recipientId) query = query.eq("recipient_id", recipientId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addKoreNote(familyId: string, data: KoreNoteInsert): Promise<KoreNote> {
  const { data: created, error } = await db()
    .from("kore_notes")
    .insert({ ...data, family_id: familyId })
    .select("*")
    .single();
  throwDb("addKoreNote", error);
  return created as KoreNote;
}

export async function markNoteAsRead(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("kore_notes").update({ status: "read" }).eq("family_id", familyId).eq("id", id);
  throwDb("markNoteAsRead", error);
}

export async function getDomains(familyId: string): Promise<Domain[]> {
  const { data, error } = await db()
    .from("domains")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function updateDomain(familyId: string, id: string, data: Partial<Domain>): Promise<void> {
  const { error } = await db().from("domains").update(data).eq("family_id", familyId).eq("id", id);
  throwDb("updateDomain", error);
}

export async function activateDomain(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("domains").update({ is_active: true }).eq("family_id", familyId).eq("id", id);
  throwDb("activateDomain", error);
}

export async function deactivateDomain(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("domains").update({ is_active: false }).eq("family_id", familyId).eq("id", id);
  throwDb("deactivateDomain", error);
}

export async function createCustomDomain(
  familyId: string,
  data: { name: string; emoji: string; owner_id?: string | null; weight?: number; priority_level?: number | null },
): Promise<Domain> {
  const cleanName = data.name.trim();
  const cleanEmoji = data.emoji.trim();
  if (!cleanName) throw new Error("createCustomDomain: name required");
  const displayName = cleanEmoji ? `${cleanEmoji} ${cleanName}` : cleanName;
  const payload = {
    family_id: familyId,
    name: displayName,
    weight: data.weight ?? 5,
    is_active: true,
    owner_id: data.owner_id ?? null,
    priority_level: data.priority_level ?? null,
    agent: null,
  };
  const { data: created, error } = await db().from("domains").insert(payload).select("*").single();
  throwDb("createCustomDomain", error);
  return created as Domain;
}

export async function addDomainHistory(
  familyId: string,
  domainId: string,
  text: string,
  createdBy: string,
): Promise<void> {
  const { error } = await db().from("domain_history").insert({
    family_id: familyId,
    domain_id: domainId,
    text,
    created_by: createdBy,
  });
  throwDb("addDomainHistory", error);
}

export async function getDomainHistory(familyId: string, domainId: string): Promise<DomainHistoryRow[]> {
  const { data, error } = await db()
    .from("domain_history")
    .select("*")
    .eq("family_id", familyId)
    .eq("domain_id", domainId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export type DailyMetricsUpsert = Database["public"]["Tables"]["daily_metrics"]["Insert"];

export async function getDailyMetrics(familyId: string, date: string): Promise<DailyMetrics | null> {
  const { data, error } = await db()
    .from("daily_metrics")
    .select("*")
    .eq("family_id", familyId)
    .eq("date", date)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertDailyMetrics(familyId: string, data: DailyMetricsUpsert): Promise<void> {
  const { error } = await db()
    .from("daily_metrics")
    .upsert({ ...data, family_id: familyId }, { onConflict: "date" });
  throwDb("upsertDailyMetrics", error);
}

export async function getAgentMemory(familyId: string, category?: string): Promise<AgentMemoryRow[]> {
  let query = db()
    .from("agent_memory")
    .select("*")
    .eq("family_id", familyId)
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function upsertAgentMemory(
  familyId: string,
  key: string,
  value: string,
  category: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await db()
    .from("agent_memory")
    .select("id")
    .eq("family_id", familyId)
    .eq("key", key)
    .maybeSingle();
  throwDb("upsertAgentMemory(select)", selErr);
  if (existing?.id) {
    const { error } = await db()
      .from("agent_memory")
      .update({ value, category, updated_at: now })
      .eq("id", existing.id);
    throwDb("upsertAgentMemory(update)", error);
    return;
  }
  const { error } = await db().from("agent_memory").insert({
    family_id: familyId,
    key,
    value,
    category,
    created_at: now,
    updated_at: now,
  });
  throwDb("upsertAgentMemory(insert)", error);
}

export async function getShoppingItems(familyId: string): Promise<ShoppingItemRow[]> {
  const { data, error } = await db()
    .from("shopping_items")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addShoppingItem(
  familyId: string,
  data: {
    name: string;
    quantity?: string;
    category?: string;
    priority?: string;
    created_by?: string;
  },
): Promise<ShoppingItemRow> {
  const payload = {
    family_id: familyId,
    name: data.name,
    quantity: data.quantity ?? null,
    category: data.category ?? null,
    priority: data.priority ?? null,
    created_by: data.created_by?.trim() || null,
    completed: false,
  };
  console.log("[kore-db] addShoppingItem payload", payload);
  const { data: created, error } = await db().from("shopping_items").insert(payload).select("*").single();
  if (error) {
    const message = String(error.message ?? "");
    const details = String((error as { details?: string }).details ?? "");
    const hint = String((error as { hint?: string }).hint ?? "");
    const code = String((error as { code?: string }).code ?? "");
    const fullText = `${message} ${details} ${hint} ${code}`.toLowerCase();
    const isRls =
      code === "42501" ||
      fullText.includes("row-level security") ||
      fullText.includes("violates row-level security");
    const isFk = code === "23503" || fullText.includes("foreign key");
    const isType = code === "22P02" || fullText.includes("invalid input syntax");
    console.error("[kore-db] addShoppingItem error", {
      message,
      details,
      hint,
      code,
      classified_as: isRls ? "RLS" : isFk ? "FK" : isType ? "TYPE" : "OTHER",
    });
  } else {
    console.log("[kore-db] addShoppingItem inserted", created);
  }
  throwDb("addShoppingItem", error);
  return created as ShoppingItemRow;
}

export async function completeShoppingItem(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("shopping_items").update({ completed: true }).eq("family_id", familyId).eq("id", id);
  throwDb("completeShoppingItem", error);
}

export async function reactivateShoppingItem(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("shopping_items").update({ completed: false }).eq("family_id", familyId).eq("id", id);
  throwDb("reactivateShoppingItem", error);
}

export async function deleteShoppingItem(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("shopping_items").delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteShoppingItem", error);
}

export async function clearCompletedItems(familyId: string): Promise<void> {
  const { error } = await db().from("shopping_items").delete().eq("family_id", familyId).eq("completed", true);
  throwDb("clearCompletedItems", error);
}

export async function getCleaningTasks(familyId: string): Promise<CleaningTaskRow[]> {
  const { data, error } = await db()
    .from("cleaning_tasks")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addCleaningTask(
  familyId: string,
  data: {
    zone: string;
    task: string;
    frequency?: string;
    assigned_to?: string;
  },
): Promise<CleaningTaskRow> {
  const now = new Date();
  const payload = {
    family_id: familyId,
    zone: data.zone,
    task: data.task,
    frequency: data.frequency ?? "semanal",
    assigned_to: data.assigned_to ?? null,
    completed: false,
    last_completed_at: null,
    next_due_at: computeInitialNextDueDate(now, data.frequency ?? "semanal"),
  };
  const { data: created, error } = await db().from("cleaning_tasks").insert(payload).select("*").single();
  throwDb("addCleaningTask", error);
  return created as CleaningTaskRow;
}

export async function completeCleaningTask(familyId: string, id: string): Promise<CleaningTaskRow> {
  const { data: existing, error: readErr } = await db()
    .from("cleaning_tasks")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", id)
    .maybeSingle();
  throwDb("completeCleaningTask.read", readErr);
  if (!existing) throw new Error("Tarea de limpieza no encontrada.");

  const now = new Date();
  const nextDue = formatDateIso(computeNextDueDate(now, existing.frequency));
  const { data: updated, error } = await db()
    .from("cleaning_tasks")
    .update({
      last_completed_at: now.toISOString(),
      next_due_at: nextDue,
      completed: false,
    })
    .eq("family_id", familyId)
    .eq("id", id)
    .select("*")
    .single();
  throwDb("completeCleaningTask", error);
  return updated as CleaningTaskRow;
}

/** Tareas con vencimiento hoy o atrasadas (recurrencia). */
export async function getPendingCleaningTasks(familyId: string, asOf = todayIsoDate()): Promise<CleaningTaskRow[]> {
  const { data, error } = await db()
    .from("cleaning_tasks")
    .select("*")
    .eq("family_id", familyId)
    .not("next_due_at", "is", null)
    .lte("next_due_at", asOf)
    .order("next_due_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

/** Próximas tareas (después de hoy, dentro de N días). */
export async function getUpcomingCleaningTasks(
  familyId: string,
  withinDays = 7,
  asOf = todayIsoDate(),
): Promise<CleaningTaskRow[]> {
  const endIso = formatDateIso(addDays(new Date(`${asOf}T12:00:00`), withinDays));

  const { data, error } = await db()
    .from("cleaning_tasks")
    .select("*")
    .eq("family_id", familyId)
    .not("next_due_at", "is", null)
    .gt("next_due_at", asOf)
    .lte("next_due_at", endIso)
    .order("next_due_at", { ascending: true });
  if (error) return [];
  return data ?? [];
}

function currentWeekStartIso(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getWeeklyMenu(familyId: string, week_start?: string): Promise<MenuItemRow[]> {
  const targetWeek = (week_start ?? currentWeekStartIso()).slice(0, 10);
  const { data, error } = await db()
    .from("menu_items")
    .select("*")
    .eq("family_id", familyId)
    .eq("week_start", targetWeek)
    .order("day", { ascending: true })
    .order("meal", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addMenuItem(
  familyId: string,
  data: {
    day: string;
    meal: string;
    dish: string;
    week_start?: string;
  },
): Promise<MenuItemRow> {
  const payload = {
    family_id: familyId,
    day: data.day,
    meal: data.meal,
    dish: data.dish,
    week_start: (data.week_start ?? currentWeekStartIso()).slice(0, 10),
  };
  const { data: created, error } = await db().from("menu_items").insert(payload).select("*").single();
  throwDb("addMenuItem", error);
  return created as MenuItemRow;
}

export async function clearDayMenu(familyId: string, day: string, week_start?: string): Promise<void> {
  const targetWeek = (week_start ?? currentWeekStartIso()).slice(0, 10);
  const { error } = await db().from("menu_items").delete().eq("family_id", familyId).eq("day", day).eq("week_start", targetWeek);
  throwDb("clearDayMenu", error);
}

export async function getSchoolEvents(familyId: string): Promise<SchoolEventRow[]> {
  const { data, error } = await db()
    .from("school_events")
    .select("*")
    .eq("family_id", familyId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addSchoolEvent(
  familyId: string,
  data: {
    title: string;
    date: string;
    time?: string;
    type?: string;
    description?: string;
    created_by?: string | null;
  },
): Promise<SchoolEventRow> {
  const dateIso = data.date.slice(0, 10);
  const timeStr = (data.time ?? "").trim();
  const typeLabel = data.type?.trim();
  const calendarTitle = typeLabel ? `${data.title} · ${typeLabel}` : data.title;

  const calendarRow = await addCalendarEvent(familyId, {
    title: calendarTitle,
    date: dateIso,
    time: timeStr,
    created_by: data.created_by ?? null,
  });

  const payload = {
    family_id: familyId,
    title: data.title,
    date: dateIso,
    time: timeStr || null,
    type: typeLabel ?? null,
    description: data.description ?? null,
    calendar_event_id: calendarRow.id,
  };
  const { data: created, error } = await db().from("school_events").insert(payload).select("*").single();
  throwDb("addSchoolEvent", error);
  return created as SchoolEventRow;
}

export async function getSchoolMaterials(familyId: string): Promise<SchoolMaterialRow[]> {
  const { data, error } = await db()
    .from("school_materials")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addSchoolMaterial(
  familyId: string,
  data: { item: string; urgency?: string },
): Promise<SchoolMaterialRow> {
  const payload = {
    family_id: familyId,
    item: data.item,
    urgency: data.urgency ?? "media",
    completed: false,
  };
  const { data: created, error } = await db().from("school_materials").insert(payload).select("*").single();
  throwDb("addSchoolMaterial", error);
  return created as SchoolMaterialRow;
}

export async function completeSchoolMaterial(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("school_materials").update({ completed: true }).eq("family_id", familyId).eq("id", id);
  throwDb("completeSchoolMaterial", error);
}

export async function deleteSchoolItem(familyId: string, id: string, type: "event" | "material"): Promise<void> {
  if (type === "event") {
    const { data: row, error: readErr } = await db()
      .from("school_events")
      .select("calendar_event_id")
      .eq("family_id", familyId)
      .eq("id", id)
      .maybeSingle();
    throwDb("deleteSchoolItem.read", readErr);
    const calendarId = row?.calendar_event_id;
    if (calendarId) {
      await deleteCalendarEvent(familyId, calendarId);
    }
  }
  const table = type === "event" ? "school_events" : "school_materials";
  const { error } = await db().from(table).delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteSchoolItem", error);
}

export async function getLeisureActivities(familyId: string, person?: string): Promise<LeisureActivityRow[]> {
  let query = db()
    .from("leisure_activities")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (person) query = query.eq("person", person);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addLeisureActivity(
  familyId: string,
  data: {
    person: string;
    activity: string;
    date?: string;
    duration_minutes?: number;
  },
): Promise<LeisureActivityRow> {
  const payload = {
    family_id: familyId,
    person: data.person,
    activity: data.activity,
    date: data.date ? data.date.slice(0, 10) : null,
    duration_minutes: data.duration_minutes ?? null,
  };
  const { data: created, error } = await db().from("leisure_activities").insert(payload).select("*").single();
  throwDb("addLeisureActivity", error);
  return created as LeisureActivityRow;
}

export async function logPersonalTime(
  familyId: string,
  person: string,
  description: string,
  minutes: number,
): Promise<LeisureActivityRow> {
  const payload = {
    family_id: familyId,
    person,
    activity: `tiempo_personal: ${description}`.slice(0, 255),
    date: null,
    duration_minutes: minutes,
  };
  const { data: created, error } = await db().from("leisure_activities").insert(payload).select("*").single();
  throwDb("logPersonalTime", error);
  return created as LeisureActivityRow;
}

export function sleepSessionDurationHours(sleepStart: string, sleepEnd: string): number {
  const ms = new Date(sleepEnd).getTime() - new Date(sleepStart).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export async function addSleepSession(
  familyId: string,
  data: {
    profile_id: string;
    sleep_start: string;
    sleep_end: string;
    wake_count?: number;
    notes?: string | null;
  },
): Promise<SleepSessionRow> {
  const payload = {
    family_id: familyId,
    profile_id: data.profile_id,
    sleep_start: data.sleep_start,
    sleep_end: data.sleep_end,
    wake_count: Math.max(0, Math.round(data.wake_count ?? 0)),
    notes: data.notes?.trim() ? data.notes.trim() : null,
  };
  const { data: created, error } = await db().from("sleep_sessions").insert(payload).select("*").single();
  throwDb("addSleepSession", error);
  return created as SleepSessionRow;
}

export async function getSleepSessions(familyId: string, days = 7): Promise<SleepSessionRow[]> {
  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("sleep_sessions")
    .select("*")
    .eq("family_id", familyId)
    .gte("sleep_start", cutoff)
    .order("sleep_start", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function deleteSleepSession(familyId: string, id: string): Promise<void> {
  const { error } = await db().from("sleep_sessions").delete().eq("family_id", familyId).eq("id", id);
  throwDb("deleteSleepSession", error);
}

export type SleepSummaryByPerson = {
  person_id: string;
  sessions: number;
  avg_hours: number;
  total_wake_count: number;
};

export async function getSleepSummaryFromSessions(
  familyId: string,
  days = 7,
): Promise<{ days: number; sessions: SleepSessionRow[]; by_person: SleepSummaryByPerson[] }> {
  const sessions = await getSleepSessions(familyId, days);
  const byPerson = new Map<string, { hours: number[]; wakes: number }>();
  for (const s of sessions) {
    const bucket = byPerson.get(s.profile_id) ?? { hours: [], wakes: 0 };
    bucket.hours.push(sleepSessionDurationHours(s.sleep_start, s.sleep_end));
    bucket.wakes += s.wake_count;
    byPerson.set(s.profile_id, bucket);
  }
  const summary: SleepSummaryByPerson[] = [...byPerson.entries()].map(([person_id, b]) => ({
    person_id,
    sessions: b.hours.length,
    avg_hours:
      b.hours.length > 0 ? Math.round((b.hours.reduce((a, c) => a + c, 0) / b.hours.length) * 10) / 10 : 0,
    total_wake_count: b.wakes,
  }));
  return { days, sessions, by_person: summary };
}

export async function logWakeup(familyId: string, data: { person: string; reason?: string }): Promise<SleepLogRow> {
  const payload = {
    family_id: familyId,
    person: data.person,
    type: "wakeup",
    reason: data.reason ?? null,
    hours: null,
  };
  console.log("[kore-db] logWakeup payload", payload);
  const { data: created, error } = await db().from("sleep_logs").insert(payload).select("*").single();
  if (error) {
    console.error("[kore-db] logWakeup error", {
      message: error.message,
      details: (error as { details?: string }).details ?? "",
      hint: (error as { hint?: string }).hint ?? "",
      code: (error as { code?: string }).code ?? "",
    });
  } else {
    console.log("[kore-db] logWakeup inserted", created);
  }
  throwDb("logWakeup", error);
  return created as SleepLogRow;
}

export async function logSleepHours(familyId: string, person: string, hours: number): Promise<SleepLogRow> {
  const payload = {
    family_id: familyId,
    person,
    type: "sleep_hours",
    reason: null,
    hours,
  };
  const { data: created, error } = await db().from("sleep_logs").insert(payload).select("*").single();
  throwDb("logSleepHours", error);
  return created as SleepLogRow;
}

export async function getSleepLogs(familyId: string, days = 7): Promise<SleepLogRow[]> {
  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("sleep_logs")
    .select("*")
    .eq("family_id", familyId)
    .gte("logged_at", cutoff)
    .order("logged_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getNightRecoveryScore(
  familyId: string,
): Promise<{ date: string; night_recovery_score: number | null }> {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const metric = await getDailyMetrics(familyId, date);
  return { date, night_recovery_score: metric?.night_recovery_score ?? null };
}

export async function saveSubscription(
  profileId: string,
  familyId: string,
  subscription: PushSubscriptionJSON,
  deviceType?: string | null,
): Promise<PushSubscriptionRow> {
  const { data: existing, error: selErr } = await db()
    .from("push_subscriptions")
    .select("id, subscription_data")
    .eq("profile_id", profileId);
  throwDb("saveSubscription.select", selErr);

  for (const row of existing ?? []) {
    const parsed = parseSubscriptionDataToWebPush(row.subscription_data as Json);
    if (parsed?.endpoint === subscription.endpoint) {
      const { error: delOne } = await db().from("push_subscriptions").delete().eq("id", row.id);
      throwDb("saveSubscription.delete", delOne);
    }
  }

  const payload = {
    profile_id: profileId,
    family_id: familyId,
    subscription_data: subscription as unknown as Json,
    device_type: deviceType?.trim() || null,
  };
  const { data, error } = await db().from("push_subscriptions").insert(payload).select("*").single();
  throwDb("saveSubscription", error);
  return data as PushSubscriptionRow;
}

export async function getSubscriptionsByFamily(
  familyId: string,
): Promise<{ id: string; subscription: WebPushSubscriptionPayload }[]> {
  const { data, error } = await db()
    .from("push_subscriptions")
    .select("id, subscription_data")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) return [];
  const out: { id: string; subscription: WebPushSubscriptionPayload }[] = [];
  for (const row of data ?? []) {
    const sub = parseSubscriptionDataToWebPush(row.subscription_data as Json);
    if (sub) out.push({ id: row.id, subscription: sub });
  }
  return out;
}

export async function deleteSubscription(profileId: string): Promise<void> {
  const { error } = await db().from("push_subscriptions").delete().eq("profile_id", profileId);
  throwDb("deleteSubscription", error);
}
