import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CorchoChat } from "@/components/CorchoChat";

vi.mock("@/lib/actions/corcho", () => ({
  getKoreNotes: vi.fn(async () => [
    {
      id: "n1",
      sender_id: "me",
      recipient_id: "you",
      content: "Hola",
      audio_url: null,
      status: "unread",
      priority: "low",
      created_at: "2026-09-24T10:00:00.000Z",
      family_id: "fam",
      imageUrls: ["https://example.test/foto.jpg"],
    },
  ]),
  addCorchoNote: vi.fn(),
  deleteCorchoNote: vi.fn(),
  addKoreNote: vi.fn(),
  markNoteAsRead: vi.fn(),
}));

describe("CorchoChat fotos", () => {
  it("muestra la miniatura y ya no dice que las fotos no se guardan", async () => {
    render(<CorchoChat onClose={() => undefined} currentUserId="me" partnerUserId="you" recipientName="Leire" />);

    expect(await screen.findByText("Hola")).toBeInTheDocument();
    expect(screen.queryByText(/Las fotos no se guardan/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Adjuntar foto")).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).toHaveAttribute("multiple");

    fireEvent.click(screen.getByRole("button", { name: "Ver foto a tamaño completo" }));
    expect(screen.getByRole("dialog", { name: "Foto del corcho" })).toBeInTheDocument();
    expect(screen.getByAltText("Foto del corcho")).toHaveAttribute("src", "https://example.test/foto.jpg");
  });
});
