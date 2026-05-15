"use server";

import { getScopedFamilyId, getScopedUserId } from "@/lib/family-context";
import {
  addSchoolEvent as dbAddSchoolEvent,
  deleteSchoolItem as dbDeleteSchoolItem,
  getSchoolEvents as dbGetSchoolEvents,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getSchoolEvents() {
  const familyId = await requireFamilyId();
  return dbGetSchoolEvents(familyId);
}

export async function addSchoolEvent(data: {
  title: string;
  date: string;
  time?: string;
  type?: string;
  description?: string;
}) {
  const familyId = await requireFamilyId();
  const userId = await getScopedUserId();
  return dbAddSchoolEvent(familyId, {
    ...data,
    created_by: userId,
  });
}

export async function deleteSchoolEvent(id: string) {
  const familyId = await requireFamilyId();
  return dbDeleteSchoolItem(familyId, id, "event");
}
