"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  getNightRecoveryScore as dbGetNightRecoveryScore,
  getSleepLogs as dbGetSleepLogs,
  logSleepHours as dbLogSleepHours,
  logWakeup as dbLogWakeup,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getSleepLogs(days = 7) {
  const familyId = await requireFamilyId();
  return dbGetSleepLogs(familyId, days);
}

export async function logWakeup(data: { person: string; reason?: string }) {
  const familyId = await requireFamilyId();
  return dbLogWakeup(familyId, data);
}

export async function logSleepHours(person: string, hours: number) {
  const familyId = await requireFamilyId();
  return dbLogSleepHours(familyId, person, hours);
}

export async function getNightRecoveryScore() {
  const familyId = await requireFamilyId();
  return dbGetNightRecoveryScore(familyId);
}
