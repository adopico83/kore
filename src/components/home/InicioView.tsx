"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import type { AgendaRow, PendingRow } from "@/components/home/home-model";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

export type InicioDomain = {
  id: string;
  name: string;
  owner: string;
  weight: number;
  emoji: string;
  state: string;
  line: string;
  agent?: string;
  notes?: string[];
};

export type PendingAddKind = "shopping" | "cleaning";

type InicioViewProps = {
  greeting: string;
  dateLong: string;
  dateShort: string;
  agenda: AgendaRow[];
  pendingMobile: PendingRow[];
  pendingDesktop: PendingRow[];
  domains: InicioDomain[];
  showInvite?: boolean;
  inviteCode?: string | null;
  inviteCopied?: boolean;
  onCopyInvite?: () => void;
  onOpenCalendar: () => void;
  onAddAgenda: () => void;
  onAddPending: (kind: PendingAddKind) => void;
  onComplete: (row: PendingRow) => void;
  onOpenPending: (row: PendingRow) => void;
  onOpenCasa: () => void;
  onOpenDomain: (name: string) => void;
  onDeactivateDomain: (id: string) => void;
};

const SURFACE = "rounded-2xl border border-white/[0.08] bg-[#1c1f27]";

export function InicioView({
  greeting,
  dateLong,
  dateShort,
  agenda,
  pendingMobile,
  pendingDesktop,
  domains,
  showInvite = false,
  inviteCode,
  inviteCopied = false,
  onCopyInvite,
  onOpenCalendar,
  onAddAgenda,
  onAddPending,
  onComplete,
  onOpenPending,
  onOpenCasa,
  onOpenDomain,
  onDeactivateDomain,
}: InicioViewProps) {
  const [pendingChooser, setPendingChooser] = useState(false);
  const visibleAgenda = agenda.slice(0, 4);
  const rincones = domains.slice(0, 4);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start lg:gap-10">
      <div>
        {showInvite && inviteCode?.trim() ? (
          <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-2 text-xs text-white/45">
            <span className="shrink-0">Invita a tu pareja</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold tracking-wide text-[#4CC9A0]">
              {inviteCode.trim()}
            </code>
            <button
              type="button"
              onClick={onCopyInvite}
              className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/70"
            >
              {inviteCopied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : null}

        <h1 className="text-[1.85rem] font-semibold tracking-tight text-white lg:text-4xl">
          <span className="lg:hidden">{greeting}</span>
          <span className="hidden lg:inline">Hoy</span>
        </h1>
        <p className="mt-1 text-sm text-white/45 lg:text-[15px]">
          <span className="lg:hidden">{dateLong}</span>
          <span className="hidden lg:inline">
            {greeting} · {dateShort}
          </span>
        </p>

        <div className="mt-6 flex flex-col gap-3.5">
          <section className={`${SURFACE} px-4 py-4`} aria-label="Agenda">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium text-white">Agenda</h2>
              <AddButton label="Añadir a la agenda" onClick={onAddAgenda} />
            </div>
            {visibleAgenda.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-white/45">
                Sin eventos hoy.
                <br />
                Toca Añadir para el primero de la semana.
              </p>
            ) : (
              <ul className="mt-2">
                {visibleAgenda.map((row) => (
                  <li key={row.id} className="border-b border-white/[0.06] last:border-b-0">
                    <button
                      type="button"
                      onClick={onOpenCalendar}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span
                        className={`h-7 w-1 rounded-full ${row.highlight ? "bg-[#4CC9A0]" : "bg-white/10"}`}
                        aria-hidden
                      />
                      <span className={`w-12 shrink-0 text-sm ${row.highlight ? "text-[#4CC9A0]" : "text-white/45"}`}>
                        {row.time}
                      </span>
                      <span className="min-w-0 truncate text-[15px] text-[#e4e6ed]">{row.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onOpenCalendar} className="mt-3 text-sm text-white/45">
              Ver semana
            </button>
          </section>

          <section className={`${SURFACE} px-4 py-4`} aria-label="Pendiente">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium text-white">Pendiente</h2>
              <AddButton label="Añadir pendiente" onClick={() => setPendingChooser(true)} />
            </div>
            <ul className="mt-2 lg:hidden">
              {pendingMobile.length === 0 ? (
                <li>
                  <p className="py-3 text-sm text-white/45">Nada pendiente.</p>
                </li>
              ) : (
                pendingMobile.map((row) => (
                  <li key={`m-${row.kind}-${row.id}`} className="border-b border-white/[0.06] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onComplete(row)}
                      className="flex w-full items-start gap-3 py-3 text-left"
                      aria-label={`Marcar como hecho: ${row.title}`}
                    >
                      <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border border-white/35" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] text-[#e4e6ed]">{row.title}</span>
                        <span className="block truncate text-[13px] text-white/40">{row.subtitle}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <ul className="mt-1 hidden lg:block">
              {pendingDesktop.length === 0 ? (
                <li>
                  <p className="py-3 text-sm text-white/45">Nada pendiente.</p>
                </li>
              ) : (
                pendingDesktop.map((row) => (
                  <li key={`d-${row.kind}-${row.id}`} className="border-b border-white/[0.06] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onOpenPending(row)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/35" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#e4e6ed]">{row.title}</span>
                        <span className="block truncate text-xs text-white/40">{row.subtitle}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <button
          type="button"
          onClick={onOpenCasa}
          className="mt-6 flex w-full items-center justify-between text-[15px] text-[#e4e6ed] lg:hidden"
        >
          Ver rincones
          <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
        </button>
      </div>

      <aside className="hidden lg:block" aria-label="Rincones">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Rincones</h2>
          {domains.length > 4 ? (
            <button type="button" onClick={onOpenCasa} className="text-sm text-white/40">
              Ver todos
            </button>
          ) : null}
        </div>
        {rincones.length === 0 ? (
          <p className="text-sm text-white/40">Sin rincones activos</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rincones.map((domain) => (
              <RinconCard
                key={domain.id || domain.name}
                domain={domain}
                onOpen={() => onOpenDomain(domain.name)}
                onDeactivate={() => onDeactivateDomain(domain.id)}
              />
            ))}
          </div>
        )}
      </aside>

      {pendingChooser ? (
        <AddPendingSheet
          onClose={() => setPendingChooser(false)}
          onChoose={(kind) => {
            setPendingChooser(false);
            onAddPending(kind);
          }}
        />
      ) : null}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#4CC9A0] px-3 py-1 text-[13px] font-semibold text-[#06281c]"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      Añadir
    </button>
  );
}

function AddPendingSheet({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (kind: PendingAddKind) => void;
}) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pending-title"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1c1f27] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-pending-title" className="text-base font-semibold text-white">
          Añadir pendiente
        </h2>
        <p className="mt-1 text-sm text-white/45">Se guarda en el rincón que elijas.</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose("shopping")}
            aria-label="Compra, lista de la compra"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left"
          >
            <span className="block text-sm font-medium text-[#e4e6ed]">Compra</span>
            <span className="block text-xs text-white/40">Lista de la compra</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("cleaning")}
            aria-label="Limpieza, tarea de casa"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left"
          >
            <span className="block text-sm font-medium text-[#e4e6ed]">Limpieza</span>
            <span className="block text-xs text-white/40">Tarea de casa</span>
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-white/45">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function RinconCard({
  domain,
  onOpen,
  onDeactivate,
}: {
  domain: InicioDomain;
  onOpen: () => void;
  onDeactivate: () => void;
}) {
  const note = domain.notes && domain.notes.length > 0 ? domain.notes[domain.notes.length - 1] : "";
  const progress = Math.max(0, Math.min(100, (domain.weight / 15) * 100));

  return (
    <article className={`relative overflow-hidden ${SURFACE}`}>
      <div className="h-0.5" style={{ backgroundColor: domain.line }} />
      <button type="button" onClick={onOpen} className="block w-full px-3.5 pt-3 pb-3 text-left">
        <div className="flex items-start justify-between gap-2 pr-6">
          <span className="text-lg leading-none">{domain.emoji}</span>
          <span className="max-w-[7.5rem] truncate rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">
            {domain.owner}
          </span>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-white">{domain.name}</p>
        <p className="mt-0.5 truncate text-xs text-white/45">{domain.state}</p>
        {note ? <p className="mt-1 truncate text-[11px] text-white/35">{note}</p> : null}
        {domain.agent ? (
          <p className="mt-1 font-mono text-[10px] tracking-wide text-white/30">Agent: {domain.agent}</p>
        ) : null}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: domain.line }} />
        </div>
        <p className="mt-1.5 text-right font-mono text-[10px] text-white/35">{domain.weight}/15</p>
      </button>
      <button
        type="button"
        onClick={onDeactivate}
        aria-label={`Desactivar ${domain.name}`}
        className="absolute top-3 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-[#14161b]/80 text-xs text-white/70"
      >
        ×
      </button>
    </article>
  );
}
