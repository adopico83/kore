"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import { addKoreNote as dbAddKoreNote, getKoreNotes as dbGetKoreNotes, markNoteAsRead as dbMarkNoteAsRead, type KoreNoteInsert } from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getKoreNotes(recipientId?: string) {
  const familyId = await requireFamilyId();
  return dbGetKoreNotes(familyId, recipientId);
}

export async function addKoreNote(data: KoreNoteInsert) {
  const familyId = await requireFamilyId();
  return dbAddKoreNote(familyId, data);
}

export async function markNoteAsRead(id: string) {
  const familyId = await requireFamilyId();
  return dbMarkNoteAsRead(familyId, id);
}
