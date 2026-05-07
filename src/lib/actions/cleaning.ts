"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addCleaningTask as dbAddCleaningTask,
  completeCleaningTask as dbCompleteCleaningTask,
  getCleaningTasks as dbGetCleaningTasks,
  getPendingCleaningTasks as dbGetPendingCleaningTasks,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getCleaningTasks() {
  const familyId = await requireFamilyId();
  return dbGetCleaningTasks(familyId);
}

export async function addCleaningTask(data: {
  zone: string;
  task: string;
  frequency?: string;
  assigned_to?: string;
}) {
  const familyId = await requireFamilyId();
  return dbAddCleaningTask(familyId, data);
}

export async function completeCleaningTask(id: string) {
  const familyId = await requireFamilyId();
  return dbCompleteCleaningTask(familyId, id);
}

export async function getPendingCleaningTasks() {
  const familyId = await requireFamilyId();
  return dbGetPendingCleaningTasks(familyId);
}
