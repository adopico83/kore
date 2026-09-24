"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addCalendarEvent as dbAddCalendarEvent,
  deleteCalendarEvent as dbDeleteCalendarEvent,
  getCalendarEvents as dbGetCalendarEvents,
  updateCalendarEvent as dbUpdateCalendarEvent,
  type CalendarEventInsert,
  type CalendarEventRow,
} from "@/lib/kore-db";

export async function getCalendarEvents() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetCalendarEvents(client, familyId);
}

export async function addCalendarEvent(data: CalendarEventInsert) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddCalendarEvent(client, familyId, data);
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<Pick<CalendarEventRow, "title" | "date" | "time" | "created_by">>,
) {
  const { familyId, client } = await requireFamilyDb();
  return dbUpdateCalendarEvent(client, familyId, id, data);
}

export async function deleteCalendarEvent(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeleteCalendarEvent(client, familyId, id);
}
