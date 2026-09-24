"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addHealthRecordRow,
  deleteHealthRecordRow,
  listHealthRecords,
  updateHealthRecordRow,
  type HealthRecord,
  type HealthRecordInsert,
} from "@/lib/kore-db";

export async function getHealthRecords(patientId?: string) {
  const { familyId, client } = await requireFamilyDb();
  return listHealthRecords(client, familyId, patientId);
}

export async function addHealthRecord(data: HealthRecordInsert) {
  const { familyId, client } = await requireFamilyDb();
  return addHealthRecordRow(client, familyId, data);
}

export async function updateHealthRecord(id: string, data: Partial<Omit<HealthRecord, "id" | "created_at">>) {
  const { familyId, client } = await requireFamilyDb();
  return updateHealthRecordRow(client, familyId, id, data);
}

export async function deleteHealthRecord(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return deleteHealthRecordRow(client, familyId, id);
}
