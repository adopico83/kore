"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addLeisureActivity as dbAddLeisureActivity,
  getLeisureActivities as dbGetLeisureActivities,
  logPersonalTime as dbLogPersonalTime,
} from "@/lib/kore-db";

export async function getLeisureActivities(person?: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetLeisureActivities(client, familyId, person);
}

export async function addLeisureActivity(data: {
  person: string;
  activity: string;
  date?: string;
  duration_minutes?: number;
}) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddLeisureActivity(client, familyId, data);
}

export async function logPersonalTime(person: string, description: string, minutes: number) {
  const { familyId, client } = await requireFamilyDb();
  return dbLogPersonalTime(client, familyId, person, description, minutes);
}
