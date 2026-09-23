import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SaludModal } from "@/components/SaludModal";
import type { Profile } from "@/lib/kore-db";

vi.mock("@/lib/actions/health", () => ({
  getHealthRecords: vi.fn().mockResolvedValue([]),
  addHealthRecord: vi.fn().mockResolvedValue({ id: "hr-1" }),
  updateHealthRecord: vi.fn(),
  deleteHealthRecord: vi.fn(),
}));

import { addHealthRecord, getHealthRecords } from "@/lib/actions/health";

const profiles = [
  { id: "ander", name: "Ander" },
  { id: "leire", name: "Leire" },
  { id: "peque", name: "Peque" },
] as Profile[];

describe("SaludModal", () => {
  it("muestra personas tocables y fecha y hora identificables", async () => {
    render(<SaludModal onClose={() => undefined} profiles={profiles} />);
    await waitFor(() => expect(getHealthRecords).toHaveBeenCalled());

    const ander = screen.getByRole("button", { name: /Ander/ });
    expect(ander.getAttribute("aria-expanded")).toBe("true");
    expect(ander.style.minHeight).toBe("64px");
    expect(screen.getByRole("button", { name: /Leire/ }).getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(ander);
    expect(ander.getAttribute("aria-expanded")).toBe("false");

    expect(screen.getByText("Fecha")).toBeTruthy();
    expect(screen.getByText("Hora")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-23" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "10:30" } });
    expect(screen.getByText("23 sep 2026")).toBeTruthy();
    expect(screen.getByText("10:30")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Descripción"), { target: { value: "Pediatra" } });
    fireEvent.change(screen.getByPlaceholderText("Lugar"), { target: { value: "Ambulatorio" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() => expect(addHealthRecord).toHaveBeenCalled());
    const payload = vi.mocked(addHealthRecord).mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      type: "appointment",
      patient_id: "ander",
      date_time: "2026-09-23T10:30:00",
    });
    expect(JSON.parse(String(payload?.description)).descripcion).toBe("Pediatra");
    expect(JSON.parse(String(payload?.description)).lugar).toBe("Ambulatorio");
  });
});
