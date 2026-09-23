import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeTabBar } from "@/components/home/HomeTabBar";
import { InicioView } from "@/components/home/InicioView";

const agenda = [{ id: "1", time: "09:00", title: "Colegio — Leire", highlight: true }];
const pending = [{ id: "s1", kind: "shopping" as const, title: "Queso lonchas", subtitle: "Compras" }];

describe("shell de inicio", () => {
  it("marca un pendiente y no muestra el título Hoy en el saludo móvil", () => {
    const onComplete = vi.fn();
    render(
      <InicioView
        greeting="Buenas, Ander"
        dateLong="miércoles 23 · septiembre"
        dateShort="miércoles 23"
        agenda={agenda}
        pendingMobile={pending}
        pendingDesktop={pending}
        domains={[]}
        onOpenCalendar={() => undefined}
        onComplete={onComplete}
        onOpenPending={() => undefined}
        onOpenCasa={() => undefined}
        onOpenDomain={() => undefined}
        onDeactivateDomain={() => undefined}
      />,
    );

    expect(screen.getByText("Buenas, Ander")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecho: Queso lonchas" }));
    expect(onComplete).toHaveBeenCalledWith(pending[0]);
    expect(screen.getByRole("button", { name: "Ver rincones" })).toBeInTheDocument();
  });

  it("usa anillo ámbar para A y teal para L, sin chrome de depuración", () => {
    render(
      <HomeHeader
        familyName="Dopico Gomez"
        adults={[
          { id: "a", name: "Ander" },
          { id: "l", name: "Leire" },
        ]}
        onOpenProfile={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Perfil de Ander" })).toHaveStyle({ borderColor: "#EF9F27" });
    expect(screen.getByRole("button", { name: "Perfil de Leire" })).toHaveStyle({ borderColor: "#4CC9A0" });
    expect(screen.queryByText("Reactivar")).not.toBeInTheDocument();
  });

  it("ofrece cuatro pestañas planas", () => {
    render(<HomeTabBar tab="inicio" onChange={() => undefined} onOpenAgent={() => undefined} />);
    expect(screen.getByRole("tab", { name: /Inicio/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Corcho/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Yo/ })).toBeInTheDocument();
  });
});
