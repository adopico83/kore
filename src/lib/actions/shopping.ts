"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addShoppingItem as dbAddShoppingItem,
  clearCompletedItems as dbClearCompletedItems,
  completeShoppingItem as dbCompleteShoppingItem,
  deleteShoppingItem as dbDeleteShoppingItem,
  getShoppingItems as dbGetShoppingItems,
  reactivateShoppingItem as dbReactivateShoppingItem,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getShoppingItems() {
  const familyId = await requireFamilyId();
  return dbGetShoppingItems(familyId);
}

export async function addShoppingItem(data: {
  name: string;
  quantity?: string;
  category?: string;
  priority?: string;
  created_by?: string;
}) {
  const familyId = await requireFamilyId();
  return dbAddShoppingItem(familyId, data);
}

export async function completeShoppingItem(id: string) {
  const familyId = await requireFamilyId();
  return dbCompleteShoppingItem(familyId, id);
}

export async function reactivateShoppingItem(id: string) {
  const familyId = await requireFamilyId();
  return dbReactivateShoppingItem(familyId, id);
}

export async function deleteShoppingItem(id: string) {
  const familyId = await requireFamilyId();
  return dbDeleteShoppingItem(familyId, id);
}

export async function clearCompletedItems() {
  const familyId = await requireFamilyId();
  return dbClearCompletedItems(familyId);
}
