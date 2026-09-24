"use server";

import { requireFamilyDb } from "@/lib/family-db";
import {
  addKoreNote as dbAddKoreNote,
  getKoreNotes as dbGetKoreNotes,
  markNoteAsRead as dbMarkNoteAsRead,
  type KoreNoteInsert,
} from "@/lib/kore-db";

export async function getKoreNotes(recipientId?: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetKoreNotes(client, familyId, recipientId);
}

export async function addKoreNote(data: KoreNoteInsert) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddKoreNote(client, familyId, data);
}

export async function markNoteAsRead(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbMarkNoteAsRead(client, familyId, id);
}
