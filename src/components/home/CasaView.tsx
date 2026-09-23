"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { InicioDomain } from "@/components/home/InicioView";

type Cita = {
  id: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
};

export type CasaSalud = {
  citas: Cita[];
  medicaciones: Cita[];
};

type CasaMember = {
  id: string;
  name: string;
  role: string;
};

type CasaAdult = {
  id: string;
  name: string;
};

type CasaExpense = {
  id: string;
  desc: string;
  amount: number;
  category: string;
  at: string;
};

type CasaViewProps = {
  domains: InicioDomain[];
  onOpenDomain: (name: string) => void;
  onDeactivateDomain: (id: string) => void;
  onAddCorner: () => void;
  onOpenSalud: () => void;
  onOpenSaludResumen: () => void;
  saludPendientes: number;
  members: CasaMember[];
  salud: Record<string, CasaSalud | undefined>;
  onOpenEconomia: () => void;
  economiaTitle: string;
  totalMes: number;
  debtByAdult: Record<string, number>;
  adults: CasaAdult[];
  expenses: CasaExpense[];
};

function euros(amount: number): string {
  return `${Math.abs(amount).toFixed(2).replace(".", ",")}€`;
}

function expenseEmoji(category: string): string {
  if (category === "comida") return "🍽️";
  if (category === "hogar") return "🏠";
  if (category === "salud") return "🏥";
  if (category === "ocio") return "🎯";
  if (category === "transporte") return "🚗";
  return "🧾";
}

export function CasaView({
  domains,
  onOpenDomain,
  onDeactivateDomain,
  onAddCorner,
  onOpenSalud,
  onOpenSaludResumen,
  saludPendientes,
  members,
  salud,
  onOpenEconomia,
  economiaTitle,
  totalMes,
  debtByAdult,
  adults,
  expenses,
}: CasaViewProps) {
  const [domainsOpen, setDomainsOpen] = useState(true);
  const [healthOpen, setHealthOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="rounded-2xl border border-white/[0.07] bg-[#161a22] p-4">
        <button
          type="button"
          onClick={() => setDomainsOpen((open) => !open)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={domainsOpen}
        >
          <span className="text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">Rincones</span>
          <ChevronDown className={`h-4 w-4 text-white/40 ${domainsOpen ? "rotate-180" : ""}`} />
        </button>
        {domainsOpen ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {domains.map((domain) => {
              const note = domain.notes && domain.notes.length > 0 ? domain.notes[domain.notes.length - 1] : "";
              const progress = Math.max(0, Math.min(100, (domain.weight / 15) * 100));
              return (
                <div key={domain.id || domain.name} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12151c]">
                  <div className="h-0.5" style={{ backgroundColor: domain.line }} />
                  <button
                    type="button"
                    onClick={() => onOpenDomain(domain.name)}
                    className="w-full px-3 pt-3 pb-3 text-left"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 pr-6">
                        <span className="text-lg leading-none">{domain.emoji}</span>
                        <span className="max-w-[5.5rem] truncate rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/45">
                          {domain.owner}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{domain.name}</p>
                      <p className="mt-0.5 truncate text-xs text-white/45">{domain.state}</p>
                      {note ? <p className="mt-1 truncate text-[11px] text-white/35">{note}</p> : null}
                      {domain.agent ? (
                        <p className="mt-1 font-mono text-[10px] text-white/30">Agent: {domain.agent}</p>
                      ) : null}
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: domain.line }} />
                      </div>
                      <p className="mt-1 text-right font-mono text-[10px] text-white/35">
                        {domain.weight}/15
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeactivateDomain(domain.id)}
                    aria-label={`Desactivar ${domain.name}`}
                    className="absolute top-3 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-[#12151c] text-xs text-white/70"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={onAddCorner}
              className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-sm font-medium text-white/55"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#4CC9A0]/50 bg-[#4CC9A0]/15 text-lg text-[#4CC9A0]">
                +
              </span>
              Más rincones
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161a22]">
        <div className="flex items-center gap-3 p-4">
          <button type="button" onClick={onOpenSalud} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="text-2xl" aria-hidden>
              🏥
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-white">Salud familiar</span>
              <span className="block text-xs text-white/45">Citas y medicación</span>
            </span>
          </button>
          <span className="shrink-0 rounded-full bg-[#EF9F27]/20 px-2.5 py-1 text-xs font-semibold text-[#EF9F27]">
            {saludPendientes} pendientes
          </span>
          <button
            type="button"
            onClick={() => setHealthOpen((open) => !open)}
            aria-label={healthOpen ? "Contraer salud" : "Expandir salud"}
            className="text-sm text-white/45"
          >
            {healthOpen ? "▼" : "▶"}
          </button>
        </div>
        {healthOpen ? (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3">
            {members.map((member) => {
              const slice = salud[member.id];
              const citas = slice?.citas ?? [];
              const meds = slice?.medicaciones ?? [];
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={onOpenSaludResumen}
                  className="text-left"
                >
                  <p
                    className={`mb-1 text-[11px] font-bold tracking-wider uppercase ${
                      member.role === "child" ? "text-[#4CC9A0]" : "text-white/45"
                    }`}
                  >
                    {member.name}
                  </p>
                  {citas.length === 0 && meds.length === 0 ? (
                    <p className="text-sm text-white/40">Sin registros</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {citas.map((cita) => (
                        <li key={cita.id} className="truncate border-l-2 border-[#9B8FE8] pl-2 text-sm text-[#e4e6ed]">
                          {cita.fecha} {cita.hora} · {cita.descripcion}
                        </li>
                      ))}
                      {meds.map((med) => (
                        <li key={med.id} className="truncate border-l-2 border-[#4CC9A0] pl-2 text-sm text-[#e4e6ed]">
                          {med.fecha} {med.hora} · {med.descripcion}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <button
        type="button"
        onClick={onOpenEconomia}
        className="rounded-2xl border border-white/[0.07] bg-[#161a22] p-4 text-left"
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            💶
          </span>
          <span className="text-[15px] font-semibold text-white">{economiaTitle}</span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
            <p className="text-[10px] tracking-wider text-white/45 uppercase">Gastos mes</p>
            <p className="mt-2 text-lg font-bold text-[#E05555]">{euros(totalMes)}</p>
          </div>
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
            {adults.map((adult) => (
              <div key={adult.id}>
                <p className="text-[10px] tracking-wider text-white/45 uppercase">Debe {adult.name}</p>
                <p className="text-base font-bold text-[#4CC9A0]">{euros(debtByAdult[adult.id] ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {expenses.slice(0, 3).map((expense) => (
            <li key={expense.id} className="flex items-center gap-3 text-sm">
              <span className="text-lg">{expenseEmoji(expense.category)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[#e4e6ed]">{expense.desc}</span>
                <span className="block text-xs text-white/40">
                  {expense.at ? new Date(expense.at).toLocaleDateString("es-ES") : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[#E05555]">-{euros(expense.amount)}</span>
            </li>
          ))}
        </ul>
      </button>
    </div>
  );
}
