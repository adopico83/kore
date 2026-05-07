"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import { addMenuItem as dbAddMenuItem, clearDayMenu as dbClearDayMenu, getWeeklyMenu as dbGetWeeklyMenu } from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getWeeklyMenu(week_start?: string) {
  const familyId = await requireFamilyId();
  return dbGetWeeklyMenu(familyId, week_start);
}

export async function addMenuItem(data: {
  day: string;
  meal: string;
  dish: string;
  week_start?: string;
}) {
  const familyId = await requireFamilyId();
  return dbAddMenuItem(familyId, data);
}

export async function clearDayMenu(day: string, week_start?: string) {
  const familyId = await requireFamilyId();
  return dbClearDayMenu(familyId, day, week_start);
}
