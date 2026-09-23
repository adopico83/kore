import { ChevronRight } from "lucide-react";
import type { AgendaRow, PendingRow } from "@/components/home/home-model";

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
  onComplete: (row: PendingRow) => void;
  onOpenPending: (row: PendingRow) => void;
  onOpenCasa: () => void;
  onOpenDomain: (name: string) => void;
  onDeactivateDomain: (id: string) => void;
};

const PENDING_EMOJI: Record<PendingRow["kind"], string> = {
  shopping: "🛒",
  cleaning: "🧹",
  corcho: "💬",
};

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
  onComplete,
  onOpenPending,
  onOpenCasa,
  onOpenDomain,
  onDeactivateDomain,
}: InicioViewProps) {
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

        <section className="mt-8 lg:hidden" aria-label="Agenda">
          <h2 className="text-[15px] font-medium text-white/80">Agenda</h2>
          {visibleAgenda.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Sin eventos hoy</p>
          ) : (
            <ul className="mt-2">
              {visibleAgenda.map((row) => (
                <li key={row.id} className="border-b border-white/[0.06]">
                  <button
                    type="button"
                    onClick={onOpenCalendar}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span
                      className={`h-7 w-1 rounded-full ${row.highlight ? "bg-[#4CC9A0]" : "bg-transparent"}`}
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
          <button type="button" onClick={onOpenCalendar} className="mt-3 text-sm text-white/40">
            Ver semana
          </button>
        </section>

        <section className="mt-8 lg:hidden" aria-label="Pendiente">
          <h2 className="text-[15px] font-medium text-white/80">Pendiente</h2>
          {pendingMobile.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Nada pendiente</p>
          ) : (
            <ul className="mt-2">
              {pendingMobile.map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <button
                    type="button"
                    onClick={() => onComplete(row)}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                    aria-label={`Marcar como hecho: ${row.title}`}
                  >
                    <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/30" aria-hidden />
                    <span className="min-w-0 truncate text-[15px] text-[#e4e6ed]">{row.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" onClick={onOpenCasa} className="mt-8 text-[15px] text-[#e4e6ed] lg:hidden">
          Ver rincones
        </button>

        <div className="mt-8 hidden flex-col gap-4 lg:flex">
          <article className="rounded-2xl border border-white/[0.07] bg-[#161a22] px-4 py-4">
            <h2 className="text-[15px] font-semibold text-white">Agenda de hoy</h2>
            {visibleAgenda.length === 0 ? (
              <p className="mt-4 text-sm text-white/40">Sin eventos hoy</p>
            ) : (
              <ul className="mt-3">
                {visibleAgenda.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={onOpenCalendar}
                      className="flex w-full items-center gap-3 py-2.5 text-left"
                    >
                      <span className={`w-1 self-stretch rounded-full ${row.highlight ? "bg-[#4CC9A0]" : "bg-white/10"}`} />
                      <span className={`w-12 text-sm ${row.highlight ? "text-[#4CC9A0]" : "text-white/55"}`}>{row.time}</span>
                      <span className="min-w-0 truncate text-sm text-[#e4e6ed]">{row.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onOpenCalendar} className="mt-2 w-full text-right text-xs text-white/35">
              Ver semana
            </button>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#161a22] px-4 py-4">
            <h2 className="text-[15px] font-semibold text-white">Pendiente hoy</h2>
            {pendingDesktop.length === 0 ? (
              <p className="mt-4 text-sm text-white/40">Nada pendiente</p>
            ) : (
              <ul className="mt-2">
                {pendingDesktop.map((row) => (
                  <li key={`${row.kind}-${row.id}`} className="border-b border-white/[0.05] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onOpenPending(row)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="text-lg" aria-hidden>
                        {PENDING_EMOJI[row.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#e4e6ed]">{row.title}</span>
                        <span className="block truncate text-xs text-white/40">{row.subtitle}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
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
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#161a22]">
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
        className="absolute top-3 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-[#090b10]/80 text-xs text-white/70"
      >
        ×
      </button>
    </article>
  );
}
