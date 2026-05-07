"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addLeisureActivity as dbAddLeisureActivity,
  getLeisureActivities as dbGetLeisureActivities,
  logPersonalTime as dbLogPersonalTime,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getLeisureActivities(person?: string) {
  const familyId = await requireFamilyId();
  return dbGetLeisureActivities(familyId, person);
}

export async function addLeisureActivity(data: {
  person: string;
  activity: string;
  date?: string;
  duration_minutes?: number;
}) {
  const familyId = await requireFamilyId();
  return dbAddLeisureActivity(familyId, data);
}

export async function logPersonalTime(person: string, description: string, minutes: number) {
  const familyId = await requireFamilyId();
  return dbLogPersonalTime(familyId, person, description, minutes);
}
