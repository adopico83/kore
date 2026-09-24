"use server";

import { getScopedUserId } from "@/lib/family-context";
import { requireFamilyDb } from "@/lib/family-db";
import { addEventLog } from "@/lib/kore-db";

export async function logQuickEvent(rawInput: string, type: string): Promise<void> {
  const trimmed = rawInput.trim();
  if (!trimmed) throw new Error("El texto está vacío");
  const eventType = type.trim();
  if (!eventType) throw new Error("Falta el tipo de evento");

  const { familyId, client } = await requireFamilyDb();
  const userId = await getScopedUserId();
  if (!userId) throw new Error("No family context");

  await addEventLog(client, familyId, userId, { type: eventType, raw_input: trimmed });
}
