"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addSleepSession as dbAddSleepSession,
  deleteSleepSession as dbDeleteSleepSession,
  getSleepSessions as dbGetSleepSessions,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getSleepSessions(days = 14) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbGetSleepSessions(admin, familyId, days);
}

export async function addSleepSession(data: {
  profile_id: string;
  sleep_start: string;
  sleep_end: string;
  wake_count?: number;
  hours?: number | null;
  notes?: string | null;
}) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbAddSleepSession(admin, familyId, data);
}

export async function deleteSleepSession(id: string) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbDeleteSleepSession(admin, familyId, id);
}
