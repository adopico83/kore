"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addCleaningTask as dbAddCleaningTask,
  completeCleaningTask as dbCompleteCleaningTask,
  getCleaningTasks as dbGetCleaningTasks,
  getPendingCleaningTasks as dbGetPendingCleaningTasks,
  getUpcomingCleaningTasks as dbGetUpcomingCleaningTasks,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getCleaningTasks() {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbGetCleaningTasks(admin, familyId);
}

export async function addCleaningTask(data: {
  zone: string;
  task: string;
  frequency?: string;
  assigned_to?: string;
}) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbAddCleaningTask(admin, familyId, data);
}

export async function completeCleaningTask(id: string) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbCompleteCleaningTask(admin, familyId, id);
}

export async function getPendingCleaningTasks() {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbGetPendingCleaningTasks(admin, familyId);
}

export async function getUpcomingCleaningTasks(withinDays = 7) {
  const familyId = await requireFamilyId();
  const admin = createAdminClient();
  return dbGetUpcomingCleaningTasks(admin, familyId, withinDays);
}
