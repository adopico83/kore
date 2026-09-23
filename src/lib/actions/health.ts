"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addHealthRecordRow,
  deleteHealthRecordRow,
  listHealthRecords,
  updateHealthRecordRow,
  type HealthRecord,
  type HealthRecordInsert,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getHealthRecords(patientId?: string) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return listHealthRecords(admin, familyId, patientId);
}

export async function addHealthRecord(data: HealthRecordInsert) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return addHealthRecordRow(admin, familyId, data);
}

export async function updateHealthRecord(id: string, data: Partial<Omit<HealthRecord, "id" | "created_at">>) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return updateHealthRecordRow(admin, familyId, id, data);
}

export async function deleteHealthRecord(id: string) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return deleteHealthRecordRow(admin, familyId, id);
}
