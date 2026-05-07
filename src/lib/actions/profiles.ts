"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import { getProfiles as dbGetProfiles, updateStressLevel as dbUpdateStressLevel } from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getProfiles() {
  const familyId = await requireFamilyId();
  return dbGetProfiles(familyId);
}

export async function updateStressLevel(userId: string, level: number) {
  const familyId = await requireFamilyId();
  return dbUpdateStressLevel(familyId, userId, level);
}
