"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import { addExpense as dbAddExpense, deleteExpense as dbDeleteExpense, getExpenses as dbGetExpenses, type ExpenseInsert } from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getExpenses() {
  const familyId = await requireFamilyId();
  return dbGetExpenses(familyId);
}

export async function addExpense(data: ExpenseInsert) {
  const familyId = await requireFamilyId();
  return dbAddExpense(familyId, data);
}

export async function deleteExpense(id: string) {
  const familyId = await requireFamilyId();
  return dbDeleteExpense(familyId, id);
}
