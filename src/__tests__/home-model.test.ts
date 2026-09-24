import { describe, expect, it } from "vitest";

import {
  avatarRingFor,
  buildPendingRows,
  buildTodayAgenda,
  formatHomeDate,
  greetingFor,
  corchoMessageText,
  corchoNotePreview,
  honestCorchoText,
} from "@/components/home/home-model";

describe("home inicio", () => {
  it("saluda con el nombre y no inventa un título Hoy", () => {
    expect(greetingFor("Ander Dopico")).toBe("Buenas, Ander");
    expect(greetingFor("  ")).toBe("Buenas");
    expect(greetingFor(null)).toBe("Buenas");
  });

  it("formatea la fecha corta del hogar", () => {
    const date = formatHomeDate(new Date(2026, 8, 23));
    expect(date.long).toBe("miércoles 23 · septiembre");
    expect(date.short).toBe("miércoles 23");
  });

  it("pinta el anillo de A en ámbar y el de L en teal", () => {
    expect(avatarRingFor("Ander")).toBe("#EF9F27");
    expect(avatarRingFor("Leire")).toBe("#4CC9A0");
    expect(avatarRingFor("Nora", 0)).toBe("#9B8FE8");
  });

  it("deja en la agenda solo los eventos de hoy, pocos y con la primera fila marcada", () => {
    const rows = buildTodayAgenda(
      [
        { id: "manana", titulo: "Colegio — Leire", fecha: "2026-09-24", hora: "09:00" },
        { id: "natacion", titulo: "Natación", fecha: "2026-09-23", hora: "18:30" },
        { id: "colegio", titulo: "Colegio — Leire", fecha: "2026-09-23", hora: "09:00" },
      ],
      new Date(2026, 8, 23, 12, 0, 0),
    );
    expect(rows.map((row) => row.id)).toEqual(["colegio", "natacion"]);
    expect(rows[0]).toMatchObject({ time: "09:00", highlight: true });
    expect(rows[1]?.highlight).toBe(false);
  });

  it("arma pendientes cortos y aparta el corcho al escritorio", () => {
    const rows = buildPendingRows({
      shopping: [
        { id: "s1", name: "Queso lonchas", completed: false },
        { id: "s2", name: "Leche", completed: true },
        { id: "s3", name: "Pan", completed: false },
      ],
      cleaning: [
        { id: "c1", zone: "Baño", task: "Limpiar", completed: false },
        { id: "c2", zone: "Cocina", task: "Fregar", completed: false },
      ],
      note: { id: "n1", title: "Mensaje de Leire", subtitle: "Corcho" },
    });
    expect(rows.mobile.map((row) => row.title)).toEqual(["Queso lonchas", "Baño", "Pan"]);
    expect(rows.mobile.map((row) => row.subtitle)).toEqual(["Compra", "Limpieza · hoy", "Compra"]);
    expect(rows.desktop.map((row) => row.title)).toEqual(["Queso lonchas", "Baño", "Mensaje de Leire"]);
    expect(rows.mobile.some((row) => row.kind === "corcho")).toBe(false);
  });

  it("no finge una foto guardada en el corcho", () => {
    expect(honestCorchoText("📎 Imagen")).toBe("Había una foto adjunta; no se guardó.");
    expect(honestCorchoText("📎 2 imágenes")).toBe("Había una foto adjunta; no se guardó.");
    expect(honestCorchoText("Trae el queso")).toBe("Trae el queso");
  });

  it("muestra la foto cuando el corcho sí la ha guardado", () => {
    expect(corchoMessageText("📎 Imagen", 1)).toBe("");
    expect(corchoMessageText("Trae el queso", 2)).toBe("Trae el queso");
    expect(corchoNotePreview("", 1)).toBe("Foto");
    expect(corchoNotePreview(null, 3)).toBe("3 fotos");
    expect(corchoNotePreview("📎 2 imágenes", 0)).toBe("Había una foto adjunta; no se guardó.");
    expect(corchoNotePreview("", 0)).toBe("(nota sin texto)");
  });
});
