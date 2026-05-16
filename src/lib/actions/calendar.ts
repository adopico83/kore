"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addCalendarEvent as dbAddCalendarEvent,
  deleteCalendarEvent as dbDeleteCalendarEvent,
  getCalendarEvents as dbGetCalendarEvents,
  updateCalendarEvent as dbUpdateCalendarEvent,
  type CalendarEventInsert,
  type CalendarEventRow,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getCalendarEvents() {
  const familyId = await requireFamilyId();
  return dbGetCalendarEvents(familyId);
}

export async function addCalendarEvent(data: CalendarEventInsert) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbAddCalendarEvent(admin, familyId, data);
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<Pick<CalendarEventRow, "title" | "date" | "time" | "created_by">>,
) {
  const familyId = await requireFamilyId();
  return dbUpdateCalendarEvent(familyId, id, data);
}

export async function deleteCalendarEvent(id: string) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbDeleteCalendarEvent(admin, familyId, id);
}
