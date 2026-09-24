"use server";

import {
  CORCHO_MAX_PHOTO_BYTES,
  CORCHO_MAX_PHOTOS,
  isJpegBytes,
} from "@/lib/corcho-photos";
import { getScopedUserId } from "@/lib/family-context";
import { requireFamilyDb } from "@/lib/family-db";
import {
  addKoreNote as dbAddKoreNote,
  deleteKoreNote as dbDeleteKoreNote,
  getCorchoPhotoUrlsByNote,
  getKoreNotes as dbGetKoreNotes,
  getProfilesForFamily,
  insertKoreNote,
  markNoteAsRead as dbMarkNoteAsRead,
  saveCorchoNotePhotos,
  type KoreNote,
  type KoreNoteInsert,
} from "@/lib/kore-db";

export type CorchoNote = KoreNote & { imageUrls: string[] };

function corchoStorageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (/bucket not found/i.test(message) || /kore_note_images/i.test(message) || /schema cache/i.test(message)) {
    return new Error("Las fotos del corcho aún no están activas en el servidor.");
  }
  return error instanceof Error ? error : new Error("No se pudo guardar el recado.");
}

export async function getKoreNotes(recipientId?: string): Promise<CorchoNote[]> {
  const { familyId, client } = await requireFamilyDb();
  const notes = await dbGetKoreNotes(client, familyId, recipientId);
  if (notes.length === 0) return [];
  const imageUrls = await getCorchoPhotoUrlsByNote(
    client,
    familyId,
    notes.map((note) => note.id),
  );
  return notes.map((note) => ({ ...note, imageUrls: imageUrls[note.id] ?? [] }));
}

export async function addKoreNote(data: KoreNoteInsert) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddKoreNote(client, familyId, data);
}

export async function markNoteAsRead(id: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbMarkNoteAsRead(client, familyId, id);
}

function photoFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function addCorchoNote(formData: FormData): Promise<void> {
  const { familyId, client } = await requireFamilyDb();
  const userId = await getScopedUserId();
  if (!userId) throw new Error("No hay sesión de usuario para enviar el mensaje.");

  const content = String(formData.get("content") ?? "").trim();
  const recipientId = String(formData.get("recipient_id") ?? "").trim();
  const photos = photoFiles(formData);

  if (!content && photos.length === 0) {
    throw new Error("Escribe un recado o adjunta una foto.");
  }
  if (!recipientId) {
    throw new Error("No hay otro adulto en el hogar como destinatario.");
  }
  if (photos.length > CORCHO_MAX_PHOTOS) {
    throw new Error(`Puedes adjuntar hasta ${CORCHO_MAX_PHOTOS} fotos.`);
  }

  const files: Uint8Array[] = [];
  for (const photo of photos) {
    if (photo.type !== "image/jpeg") {
      throw new Error("Las fotos tienen que ser JPEG.");
    }
    if (photo.size > CORCHO_MAX_PHOTO_BYTES) {
      throw new Error("Una foto pesa demasiado. Prueba con otra.");
    }
    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (!isJpegBytes(bytes)) {
      throw new Error("El archivo no es una foto JPEG.");
    }
    files.push(bytes);
  }

  const profiles = await getProfilesForFamily(client, familyId);
  const senderOk = profiles.some((profile) => profile.id === userId);
  const recipientOk = profiles.some((profile) => profile.id === recipientId);
  if (!senderOk || !recipientOk || userId === recipientId) {
    throw new Error("El destinatario no pertenece a tu hogar.");
  }

  const note = await insertKoreNote(client, familyId, {
    sender_id: userId,
    recipient_id: recipientId,
    content: content || null,
    audio_url: null,
    status: "unread",
    priority: "low",
  });

  if (files.length === 0) return;

  try {
    await saveCorchoNotePhotos(client, familyId, note.id, files);
  } catch (error) {
    try {
      await dbDeleteKoreNote(client, familyId, note.id);
    } catch {
      /* La nota se queda si no se puede deshacer; el error útil es el de la foto. */
    }
    throw corchoStorageError(error);
  }
}

export async function deleteCorchoNote(noteId: string): Promise<void> {
  const id = noteId.trim();
  if (!id) throw new Error("Falta el recado.");
  const { familyId, client } = await requireFamilyDb();
  try {
    await dbDeleteKoreNote(client, familyId, id);
  } catch (error) {
    throw corchoStorageError(error);
  }
}
