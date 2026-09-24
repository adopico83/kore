"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addExpense as dbAddExpense,
  deleteExpense as dbDeleteExpense,
  getExpenses as dbGetExpenses,
  type ExpenseInsert,
} from "@/lib/kore-db";

export async function getExpenses() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetExpenses(client, familyId);
}

export async function addExpense(data: ExpenseInsert) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddExpense(client, familyId, data);
}

export async function deleteExpense(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeleteExpense(client, familyId, id);
}
