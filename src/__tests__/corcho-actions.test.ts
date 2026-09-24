import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetScopedFamilyId = vi.fn();
const mockGetScopedUserId = vi.fn();

vi.mock("@/lib/family-context", () => ({
  getScopedFamilyId: mockGetScopedFamilyId,
  getScopedUserId: mockGetScopedUserId,
}));

const mockDb = {
  getKoreNotes: vi.fn(),
  addKoreNote: vi.fn(),
  markNoteAsRead: vi.fn(),
  getProfilesForFamily: vi.fn(),
  insertKoreNote: vi.fn(),
  saveCorchoNotePhotos: vi.fn(),
  deleteKoreNote: vi.fn(),
  getCorchoPhotoUrlsByNote: vi.fn(),
};

vi.mock("@/lib/kore-db", () => mockDb);

const mockSessionClient = { from: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSessionClient),
}));

function jpegFile(name = "foto.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, { type: "image/jpeg" });
}

describe("addCorchoNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScopedFamilyId.mockResolvedValue("fam-1");
    mockGetScopedUserId.mockResolvedValue("user-1");
    mockDb.getProfilesForFamily.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    mockDb.insertKoreNote.mockResolvedValue({ id: "note-1" });
    mockDb.saveCorchoNotePhotos.mockResolvedValue(undefined);
  });

  it("exige texto o una foto", async () => {
    const { addCorchoNote } = await import("@/lib/actions/corcho");
    const formData = new FormData();
    formData.set("recipient_id", "user-2");
    await expect(addCorchoNote(formData)).rejects.toThrow("Escribe un recado o adjunta una foto.");
    expect(mockDb.insertKoreNote).not.toHaveBeenCalled();
  });

  it("rechaza más de 6 fotos y archivos que no son JPEG", async () => {
    const { addCorchoNote } = await import("@/lib/actions/corcho");
    const demasiadas = new FormData();
    demasiadas.set("recipient_id", "user-2");
    for (let index = 0; index < 7; index += 1) demasiadas.append("photos", jpegFile());
    await expect(addCorchoNote(demasiadas)).rejects.toThrow("Puedes adjuntar hasta 6 fotos.");

    const png = new FormData();
    png.set("content", "mira");
    png.set("recipient_id", "user-2");
    png.append("photos", new File([new Uint8Array([0x89, 0x50])], "foto.png", { type: "image/png" }));
    await expect(addCorchoNote(png)).rejects.toThrow("Las fotos tienen que ser JPEG.");
  });

  it("guarda la nota y sube las fotos con el remitente de la sesión", async () => {
    const { addCorchoNote } = await import("@/lib/actions/corcho");
    const formData = new FormData();
    formData.set("content", "el parque");
    formData.set("recipient_id", "user-2");
    formData.append("photos", jpegFile());

    await addCorchoNote(formData);

    expect(mockDb.insertKoreNote).toHaveBeenCalledWith(
      mockSessionClient,
      "fam-1",
      expect.objectContaining({
        sender_id: "user-1",
        recipient_id: "user-2",
        content: "el parque",
      }),
    );
    expect(mockDb.saveCorchoNotePhotos).toHaveBeenCalledWith(
      mockSessionClient,
      "fam-1",
      "note-1",
      [expect.any(Uint8Array)],
    );
  });

  it("borra la nota y sus fotos", async () => {
    const { deleteCorchoNote } = await import("@/lib/actions/corcho");
    await deleteCorchoNote("note-1");
    expect(mockDb.deleteKoreNote).toHaveBeenCalledWith(mockSessionClient, "fam-1", "note-1");
  });

  it("adjunta las URLs firmadas con el cliente de sesión", async () => {
    mockDb.getKoreNotes.mockResolvedValueOnce([{ id: "note-1" }]);
    mockDb.getCorchoPhotoUrlsByNote.mockResolvedValueOnce({ "note-1": ["https://signed.example/a.jpg"] });
    const { getKoreNotes } = await import("@/lib/actions/corcho");
    await expect(getKoreNotes()).resolves.toEqual([
      { id: "note-1", imageUrls: ["https://signed.example/a.jpg"] },
    ]);
    expect(mockDb.getKoreNotes).toHaveBeenCalledWith(mockSessionClient, "fam-1", undefined);
    expect(mockDb.getCorchoPhotoUrlsByNote).toHaveBeenCalledWith(mockSessionClient, "fam-1", ["note-1"]);
  });
});
