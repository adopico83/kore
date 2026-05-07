"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addHealthRecord as dbAddHealthRecord,
  deleteHealthRecord as dbDeleteHealthRecord,
  getHealthRecords as dbGetHealthRecords,
  updateHealthRecord as dbUpdateHealthRecord,
  type HealthRecord,
  type HealthRecordInsert,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getHealthRecords(patientId?: string) {
  const familyId = await requireFamilyId();
  return dbGetHealthRecords(familyId, patientId);
}

export async function addHealthRecord(data: HealthRecordInsert) {
  const familyId = await requireFamilyId();
  return dbAddHealthRecord(familyId, data);
}

export async function updateHealthRecord(id: string, data: Partial<Omit<HealthRecord, "id" | "created_at">>) {
  const familyId = await requireFamilyId();
  return dbUpdateHealthRecord(familyId, id, data);
}

export async function deleteHealthRecord(id: string) {
  const familyId = await requireFamilyId();
  return dbDeleteHealthRecord(familyId, id);
}
