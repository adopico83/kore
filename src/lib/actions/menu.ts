"use server";

import { requireFamilyDb } from "@/lib/family-db";
import { addMenuItem as dbAddMenuItem, clearDayMenu as dbClearDayMenu, getWeeklyMenu as dbGetWeeklyMenu } from "@/lib/kore-db";

export async function getWeeklyMenu(week_start?: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetWeeklyMenu(client, familyId, week_start);
}

export async function addMenuItem(data: {
  day: string;
  meal: string;
  dish: string;
  week_start?: string;
}) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddMenuItem(client, familyId, data);
}

export async function clearDayMenu(day: string, week_start?: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbClearDayMenu(client, familyId, day, week_start);
}
