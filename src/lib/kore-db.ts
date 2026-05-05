import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getBrowserClient } from "@/lib/supabase/client";

export const ANDER_ID = "00000000-0000-0000-0000-000000000001";
export const LEIRE_ID = "00000000-0000-0000-0000-000000000002";
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

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await db().from("profiles").select("*").order("name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function updateStressLevel(userId: string, level: number): Promise<void> {
  const stress_level = Math.min(10, Math.max(1, Math.round(level)));
  const { error } = await db()
    .from("profiles")
    .update({ stress_level, updated_at: new Date().toISOString() })
    .eq("id", userId);
  throwDb("updateStressLevel", error);
}

export async function getCalendarEvents(): Promise<CalendarEventRow[]> {
  const { data, error } = await db()
    .from("calendar_events")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addCalendarEvent(data: CalendarEventInsert): Promise<CalendarEventRow> {
  const row = {
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

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await db().from("calendar_events").delete().eq("id", id);
  throwDb("deleteCalendarEvent", error);
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<Pick<CalendarEventRow, "title" | "date" | "time" | "created_by">>,
): Promise<void> {
  const { error } = await db().from("calendar_events").update(data).eq("id", id);
  throwDb("updateCalendarEvent", error);
}

export type HealthRecordInsert = Database["public"]["Tables"]["health_records"]["Insert"];

export async function getHealthRecords(patientId?: string): Promise<HealthRecord[]> {
  let query = db().from("health_records").select("*").order("created_at", { ascending: false });
  if (patientId) query = query.eq("patient_id", patientId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addHealthRecord(data: HealthRecordInsert): Promise<HealthRecord> {
  const { data: created, error } = await db().from("health_records").insert(data).select("*").single();
  throwDb("addHealthRecord", error);
  return created as HealthRecord;
}

export async function updateHealthRecord(
  id: string,
  data: Partial<Omit<HealthRecord, "id" | "created_at">>,
): Promise<void> {
  const { error } = await db().from("health_records").update(data).eq("id", id);
  throwDb("updateHealthRecord", error);
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const { error } = await db().from("health_records").delete().eq("id", id);
  throwDb("deleteHealthRecord", error);
}

export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export async function getExpenses(): Promise<Expense[]> {
  const { data, error } = await db().from("expenses").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addExpense(data: ExpenseInsert): Promise<Expense> {
  const { data: created, error } = await db().from("expenses").insert(data).select("*").single();
  throwDb("addExpense", error);
  return created as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await db().from("expenses").delete().eq("id", id);
  throwDb("deleteExpense", error);
}

export type KoreNoteInsert = Database["public"]["Tables"]["kore_notes"]["Insert"];

export async function getKoreNotes(recipientId?: string): Promise<KoreNote[]> {
  let query = db().from("kore_notes").select("*").order("created_at", { ascending: false });
  if (recipientId) query = query.eq("recipient_id", recipientId);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addKoreNote(data: KoreNoteInsert): Promise<KoreNote> {
  const { data: created, error } = await db().from("kore_notes").insert(data).select("*").single();
  throwDb("addKoreNote", error);
  return created as KoreNote;
}

export async function markNoteAsRead(id: string): Promise<void> {
  const { error } = await db().from("kore_notes").update({ status: "read" }).eq("id", id);
  throwDb("markNoteAsRead", error);
}

export async function getDomains(): Promise<Domain[]> {
  const { data, error } = await db().from("domains").select("*").order("name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function updateDomain(id: string, data: Partial<Domain>): Promise<void> {
  const { error } = await db().from("domains").update(data).eq("id", id);
  throwDb("updateDomain", error);
}

export async function addDomainHistory(domainId: string, text: string, createdBy: string): Promise<void> {
  const { error } = await db().from("domain_history").insert({
    domain_id: domainId,
    text,
    created_by: createdBy,
  });
  throwDb("addDomainHistory", error);
}

export async function getDomainHistory(domainId: string): Promise<DomainHistoryRow[]> {
  const { data, error } = await db()
    .from("domain_history")
    .select("*")
    .eq("domain_id", domainId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export type DailyMetricsUpsert = Database["public"]["Tables"]["daily_metrics"]["Insert"];

export async function getDailyMetrics(date: string): Promise<DailyMetrics | null> {
  const { data, error } = await db().from("daily_metrics").select("*").eq("date", date).maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertDailyMetrics(data: DailyMetricsUpsert): Promise<void> {
  const { error } = await db().from("daily_metrics").upsert(data, { onConflict: "date" });
  throwDb("upsertDailyMetrics", error);
}

export async function getAgentMemory(category?: string): Promise<AgentMemoryRow[]> {
  let query = db()
    .from("agent_memory")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function upsertAgentMemory(key: string, value: string, category: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await db().from("agent_memory").select("id").eq("key", key).maybeSingle();
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
    key,
    value,
    category,
    created_at: now,
    updated_at: now,
  });
  throwDb("upsertAgentMemory(insert)", error);
}

export async function getShoppingItems(): Promise<ShoppingItemRow[]> {
  const { data, error } = await db().from("shopping_items").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addShoppingItem(data: {
  name: string;
  quantity?: string;
  category?: string;
  priority?: string;
  created_by?: string;
}): Promise<ShoppingItemRow> {
  const payload = {
    name: data.name,
    quantity: data.quantity ?? null,
    category: data.category ?? null,
    priority: data.priority ?? null,
    created_by: data.created_by ?? ANDER_ID,
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

export async function completeShoppingItem(id: string): Promise<void> {
  const { error } = await db().from("shopping_items").update({ completed: true }).eq("id", id);
  throwDb("completeShoppingItem", error);
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const { error } = await db().from("shopping_items").delete().eq("id", id);
  throwDb("deleteShoppingItem", error);
}

export async function clearCompletedItems(): Promise<void> {
  const { error } = await db().from("shopping_items").delete().eq("completed", true);
  throwDb("clearCompletedItems", error);
}

export async function getCleaningTasks(): Promise<CleaningTaskRow[]> {
  const { data, error } = await db().from("cleaning_tasks").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addCleaningTask(data: {
  zone: string;
  task: string;
  frequency?: string;
  assigned_to?: string;
}): Promise<CleaningTaskRow> {
  const payload = {
    zone: data.zone,
    task: data.task,
    frequency: data.frequency ?? "semanal",
    assigned_to: data.assigned_to ?? null,
    completed: false,
  };
  console.log("[kore-db] addCleaningTask payload", payload);
  const { data: created, error } = await db().from("cleaning_tasks").insert(payload).select("*").single();
  if (error) {
    console.error("[kore-db] addCleaningTask error", {
      message: error.message,
      details: (error as { details?: string }).details ?? "",
      hint: (error as { hint?: string }).hint ?? "",
      code: (error as { code?: string }).code ?? "",
    });
  } else {
    console.log("[kore-db] addCleaningTask inserted", created);
  }
  throwDb("addCleaningTask", error);
  return created as CleaningTaskRow;
}

export async function completeCleaningTask(id: string): Promise<void> {
  const { error } = await db().from("cleaning_tasks").update({ completed: true }).eq("id", id);
  throwDb("completeCleaningTask", error);
}

export async function getPendingCleaningTasks(): Promise<CleaningTaskRow[]> {
  const { data, error } = await db()
    .from("cleaning_tasks")
    .select("*")
    .eq("completed", false)
    .order("created_at", { ascending: false });
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

export async function getWeeklyMenu(week_start?: string): Promise<MenuItemRow[]> {
  const targetWeek = (week_start ?? currentWeekStartIso()).slice(0, 10);
  const { data, error } = await db()
    .from("menu_items")
    .select("*")
    .eq("week_start", targetWeek)
    .order("day", { ascending: true })
    .order("meal", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addMenuItem(data: {
  day: string;
  meal: string;
  dish: string;
  week_start?: string;
}): Promise<MenuItemRow> {
  const payload = {
    day: data.day,
    meal: data.meal,
    dish: data.dish,
    week_start: (data.week_start ?? currentWeekStartIso()).slice(0, 10),
  };
  const { data: created, error } = await db().from("menu_items").insert(payload).select("*").single();
  throwDb("addMenuItem", error);
  return created as MenuItemRow;
}

export async function clearDayMenu(day: string, week_start?: string): Promise<void> {
  const targetWeek = (week_start ?? currentWeekStartIso()).slice(0, 10);
  const { error } = await db().from("menu_items").delete().eq("day", day).eq("week_start", targetWeek);
  throwDb("clearDayMenu", error);
}

export async function getSchoolEvents(): Promise<SchoolEventRow[]> {
  const { data, error } = await db()
    .from("school_events")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addSchoolEvent(data: {
  title: string;
  date: string;
  time?: string;
  type?: string;
  description?: string;
}): Promise<SchoolEventRow> {
  const payload = {
    title: data.title,
    date: data.date.slice(0, 10),
    time: data.time ?? null,
    type: data.type ?? null,
    description: data.description ?? null,
  };
  console.log("[kore-db] addSchoolEvent payload", payload);
  const { data: created, error } = await db().from("school_events").insert(payload).select("*").single();
  if (error) {
    console.error("[kore-db] addSchoolEvent error", {
      message: error.message,
      details: (error as { details?: string }).details ?? "",
      hint: (error as { hint?: string }).hint ?? "",
      code: (error as { code?: string }).code ?? "",
    });
  } else {
    console.log("[kore-db] addSchoolEvent inserted", created);
  }
  throwDb("addSchoolEvent", error);
  return created as SchoolEventRow;
}

export async function getSchoolMaterials(): Promise<SchoolMaterialRow[]> {
  const { data, error } = await db().from("school_materials").select("*").order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addSchoolMaterial(data: { item: string; urgency?: string }): Promise<SchoolMaterialRow> {
  const payload = {
    item: data.item,
    urgency: data.urgency ?? "media",
    completed: false,
  };
  const { data: created, error } = await db().from("school_materials").insert(payload).select("*").single();
  throwDb("addSchoolMaterial", error);
  return created as SchoolMaterialRow;
}

export async function completeSchoolMaterial(id: string): Promise<void> {
  const { error } = await db().from("school_materials").update({ completed: true }).eq("id", id);
  throwDb("completeSchoolMaterial", error);
}

export async function deleteSchoolItem(id: string, type: "event" | "material"): Promise<void> {
  const table = type === "event" ? "school_events" : "school_materials";
  const { error } = await db().from(table).delete().eq("id", id);
  throwDb("deleteSchoolItem", error);
}

export async function getLeisureActivities(person?: string): Promise<LeisureActivityRow[]> {
  let query = db().from("leisure_activities").select("*").order("created_at", { ascending: false });
  if (person) query = query.eq("person", person);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function addLeisureActivity(data: {
  person: string;
  activity: string;
  date?: string;
  duration_minutes?: number;
}): Promise<LeisureActivityRow> {
  const payload = {
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
  person: string,
  description: string,
  minutes: number,
): Promise<LeisureActivityRow> {
  const payload = {
    person,
    activity: `tiempo_personal: ${description}`.slice(0, 255),
    date: null,
    duration_minutes: minutes,
  };
  const { data: created, error } = await db().from("leisure_activities").insert(payload).select("*").single();
  throwDb("logPersonalTime", error);
  return created as LeisureActivityRow;
}

export async function logWakeup(data: { person: string; reason?: string }): Promise<SleepLogRow> {
  const payload = {
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

export async function logSleepHours(person: string, hours: number): Promise<SleepLogRow> {
  const payload = {
    person,
    type: "sleep_hours",
    reason: null,
    hours,
  };
  const { data: created, error } = await db().from("sleep_logs").insert(payload).select("*").single();
  throwDb("logSleepHours", error);
  return created as SleepLogRow;
}

export async function getSleepLogs(days = 7): Promise<SleepLogRow[]> {
  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db()
    .from("sleep_logs")
    .select("*")
    .gte("logged_at", cutoff)
    .order("logged_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getNightRecoveryScore(): Promise<{ date: string; night_recovery_score: number | null }> {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const metric = await getDailyMetrics(date);
  return { date, night_recovery_score: metric?.night_recovery_score ?? null };
}
