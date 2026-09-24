"use server";

import { getScopedUserId } from "@/lib/family-context";
import { requireFamilyDb } from "@/lib/family-db";
import {
  addSchoolEvent as dbAddSchoolEvent,
  deleteSchoolItem as dbDeleteSchoolItem,
  getSchoolEvents as dbGetSchoolEvents,
} from "@/lib/kore-db";

export async function getSchoolEvents() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetSchoolEvents(client, familyId);
}

export async function addSchoolEvent(data: {
  title: string;
  date: string;
  time?: string;
  type?: string;
  description?: string;
}) {
  const { familyId, client } = await requireFamilyDb();
  const userId = await getScopedUserId();
  return dbAddSchoolEvent(client, familyId, {
    ...data,
    created_by: userId,
  });
}

export async function deleteSchoolEvent(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeleteSchoolItem(client, familyId, id, "event");
}
