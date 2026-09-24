"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addCleaningTask as dbAddCleaningTask,
  completeCleaningTask as dbCompleteCleaningTask,
  getCleaningTasks as dbGetCleaningTasks,
  getPendingCleaningTasks as dbGetPendingCleaningTasks,
  getUpcomingCleaningTasks as dbGetUpcomingCleaningTasks,
} from "@/lib/kore-db";

export async function getCleaningTasks() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetCleaningTasks(client, familyId);
}

export async function addCleaningTask(data: {
  zone: string;
  task: string;
  frequency?: string;
  assigned_to?: string;
}) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddCleaningTask(client, familyId, data);
}

export async function completeCleaningTask(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbCompleteCleaningTask(client, familyId, id);
}

export async function getPendingCleaningTasks() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetPendingCleaningTasks(client, familyId);
}

export async function getUpcomingCleaningTasks(withinDays = 7) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetUpcomingCleaningTasks(client, familyId, withinDays);
}
