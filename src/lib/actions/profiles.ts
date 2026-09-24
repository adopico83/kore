"use server";

import { requireFamilyDb } from "@/lib/family-db";
import { getProfiles as dbGetProfiles, updateStressLevel as dbUpdateStressLevel } from "@/lib/kore-db";

export async function getProfiles() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetProfiles(client, familyId);
}

export async function updateStressLevel(userId: string, level: number) {
  const { familyId, client } = await requireFamilyDb();
  return dbUpdateStressLevel(client, familyId, userId, level);
}
