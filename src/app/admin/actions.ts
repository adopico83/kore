"use server";

import { revalidatePath } from "next/cache";

import { assertKoreAdminAction } from "@/lib/admin-auth";
import {
  deleteFamilyCascade,
  getAdminFamilies as dbGetAdminFamilies,
  getAdminStats as dbGetAdminStats,
  type AdminFamilyRow,
  type AdminStats,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAdminStats(): Promise<AdminStats> {
  await assertKoreAdminAction();
  return dbGetAdminStats(createAdminClient());
}

export async function getAdminFamilies(): Promise<AdminFamilyRow[]> {
  await assertKoreAdminAction();
  return dbGetAdminFamilies(createAdminClient());
}

export async function deleteFamily(familyId: string): Promise<void> {
  await assertKoreAdminAction();
  const admin = createAdminClient();
  await deleteFamilyCascade(admin, familyId);
  revalidatePath("/admin");
}
