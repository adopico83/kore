import { describe, expect, it, vi } from "vitest";
import { FAMILY_ID, deleteKoreNote, getCorchoPhotoUrlsByNote } from "@/lib/kore-db";
import { isFamilyStoragePath, isJpegBytes, isMissingCorchoPhotosTable } from "@/lib/corcho-photos";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_PATH = `${FAMILY_ID}/${NOTE_ID}/${IMAGE_ID}.jpg`;

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: vi.fn(),
}));

function imageQuery(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const node = {
    eq: () => node,
    in: () => node,
    order: () => node,
    then(onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return { select: () => node };
}

describe("rutas de fotos del corcho", () => {
  it("acepta solo la ruta de la propia familia", () => {
    expect(isFamilyStoragePath(PHOTO_PATH, FAMILY_ID)).toBe(true);
    expect(isFamilyStoragePath(`${FAMILY_ID}/../otro.jpg`, FAMILY_ID)).toBe(false);
    expect(isFamilyStoragePath(`otra-familia/${NOTE_ID}/${IMAGE_ID}.jpg`, FAMILY_ID)).toBe(false);
    expect(isJpegBytes(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(isJpegBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(isMissingCorchoPhotosTable({ code: "PGRST205", message: "schema cache" })).toBe(true);
  });

  it("borra los objetos de la nota antes de borrar la fila", async () => {
    const removed: string[][] = [];
    let noteDeleted = false;
    const client = {
      from: (table: string) => {
        if (table === "kore_note_images") {
          return imageQuery({
            data: [{ storage_path: PHOTO_PATH }, { storage_path: "otra/familia/foto.jpg" }],
            error: null,
          });
        }
        if (table === "kore_notes") {
          return {
            delete: () => ({
              eq: () => ({
                eq: async () => {
                  noteDeleted = true;
                  return { error: null };
                },
              }),
            }),
          };
        }
        throw new Error(table);
      },
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(paths);
            return { error: null };
          },
        }),
      },
    };

    await deleteKoreNote(client as never, FAMILY_ID, NOTE_ID);

    expect(removed).toEqual([[PHOTO_PATH]]);
    expect(noteDeleted).toBe(true);
  });

  it("no borra la nota si Storage rechaza el borrado", async () => {
    let noteDeleted = false;
    const client = {
      from: (table: string) => {
        if (table === "kore_note_images") {
          return imageQuery({ data: [{ storage_path: PHOTO_PATH }], error: null });
        }
        return {
          delete: () => ({
            eq: () => ({
              eq: async () => {
                noteDeleted = true;
                return { error: null };
              },
            }),
          }),
        };
      },
      storage: {
        from: () => ({
          remove: async () => ({ error: { message: "storage down" } }),
        }),
      },
    };

    await expect(deleteKoreNote(client as never, FAMILY_ID, NOTE_ID)).rejects.toThrow(
      "removeCorchoPhotoObjects: storage down",
    );
    expect(noteDeleted).toBe(false);
  });

  it("firma las rutas y las agrupa por nota", async () => {
    const client = {
      from: () =>
        imageQuery({
          data: [
            { note_id: NOTE_ID, storage_path: PHOTO_PATH, created_at: "2026-09-24T10:00:00.000Z" },
            { note_id: NOTE_ID, storage_path: "ajena/nota/foto.jpg", created_at: "2026-09-24T10:01:00.000Z" },
          ],
          error: null,
        }),
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}`, error: null })),
            error: null,
          }),
        }),
      },
    };

    const urls = await getCorchoPhotoUrlsByNote(client as never, FAMILY_ID, [NOTE_ID]);

    expect(urls[NOTE_ID]).toEqual([`https://signed.test/${PHOTO_PATH}`]);
  });

  it("sigue sin fotos si la tabla aún no existe", async () => {
    const client = {
      from: () =>
        imageQuery({
          data: null,
          error: { code: "PGRST205", message: "Could not find the table public.kore_note_images" },
        }),
      storage: { from: () => ({ createSignedUrls: vi.fn() }) },
    };

    await expect(getCorchoPhotoUrlsByNote(client as never, FAMILY_ID, [NOTE_ID])).resolves.toEqual({});
  });
});
