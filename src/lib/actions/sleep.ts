"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addSleepSession as dbAddSleepSession,
  deleteSleepSession as dbDeleteSleepSession,
  getSleepSessions as dbGetSleepSessions,
} from "@/lib/kore-db";

export async function getSleepSessions(days = 14) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetSleepSessions(client, familyId, days);
}

export async function addSleepSession(data: {
  profile_id: string;
  sleep_start: string;
  sleep_end: string;
  wake_count?: number;
  hours?: number | null;
  notes?: string | null;
}) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddSleepSession(client, familyId, data);
}

export async function deleteSleepSession(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeleteSleepSession(client, familyId, id);
}
