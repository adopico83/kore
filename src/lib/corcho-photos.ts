/** Bucket privado de fotos del Corcho. La ruta es `{familyId}/{noteId}/{imageId}.jpg`. */
export const CORCHO_PHOTOS_BUCKET = "corcho-fotos";

export const CORCHO_MAX_PHOTOS = 6;

/** Tope del bucket (2 MiB) y del body de la server action tras comprimir. */
export const CORCHO_MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Las miniaturas se firman al abrir el Corcho; 6 h cubre una sesión larga. */
export const CORCHO_PHOTO_URL_TTL_SECONDS = 6 * 60 * 60;

const NOTE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

export function corchoPhotoStoragePath(familyId: string, noteId: string, imageId: string): string {
  return `${familyId}/${noteId}/${imageId}.jpg`;
}

/** Solo objetos de esta familia, con la forma que escribe la app. */
export function isFamilyStoragePath(path: string, familyId: string): boolean {
  const family = familyId.trim();
  if (!family || path.includes("..") || path.includes("\\")) return false;
  const prefix = `${family}/`;
  if (!path.startsWith(prefix)) return false;
  return NOTE_PATH.test(path.slice(prefix.length));
}

export function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isMissingCorchoPhotosTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("kore_note_images");
}
