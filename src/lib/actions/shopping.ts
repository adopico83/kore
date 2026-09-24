"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addShoppingItem as dbAddShoppingItem,
  clearCompletedItems as dbClearCompletedItems,
  completeShoppingItem as dbCompleteShoppingItem,
  deleteShoppingItem as dbDeleteShoppingItem,
  getShoppingItems as dbGetShoppingItems,
  reactivateShoppingItem as dbReactivateShoppingItem,
} from "@/lib/kore-db";

export async function getShoppingItems() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetShoppingItems(client, familyId);
}

export async function addShoppingItem(data: {
  id?: string;
  name: string;
  quantity?: string;
  category?: string;
  priority?: string;
  created_by?: string;
}) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddShoppingItem(client, familyId, data);
}

export async function completeShoppingItem(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbCompleteShoppingItem(client, familyId, id);
}

export async function reactivateShoppingItem(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbReactivateShoppingItem(client, familyId, id);
}

export async function deleteShoppingItem(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeleteShoppingItem(client, familyId, id);
}

export async function clearCompletedItems() {
  const { familyId, client } = await requireFamilyDb();
  return dbClearCompletedItems(client, familyId);
}
