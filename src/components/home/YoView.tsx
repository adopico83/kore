import Link from "next/link";
import { Sparkles } from "lucide-react";
import { avatarRingFor } from "@/components/home/home-model";

type YoViewProps = {
  name: string;
  onOpenProfile: () => void;
  onOpenAgent: () => void;
  pushSupported: boolean;
  pushActive: boolean;
  pushBusy: boolean;
  onEnablePush: () => void;
  showAdmin: boolean;
};

export function YoView({
  name,
  onOpenProfile,
  onOpenAgent,
  pushSupported,
  pushActive,
  pushBusy,
  onEnablePush,
  showAdmin,
}: YoViewProps) {
  const trimmed = name.trim();
  const initial = trimmed.charAt(0).toLocaleUpperCase("es") || "?";
  const ring = avatarRingFor(trimmed || "?");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#161a22] p-4">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 bg-[#12151c] text-base font-semibold"
          style={{ borderColor: ring }}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">{trimmed || "Tu perfil"}</p>
          <p className="text-sm text-white/40">Tu espacio en casa</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenProfile}
        disabled={!trimmed}
        className="rounded-2xl border border-white/[0.07] bg-[#161a22] px-4 py-3.5 text-left text-sm font-medium text-[#e4e6ed] disabled:opacity-40"
      >
        Abrir perfil
      </button>

      <button
        type="button"
        onClick={onOpenAgent}
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#4CC9A0] px-4 py-3.5 text-sm font-semibold text-[#06281c]"
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        Hablar con Kore
      </button>

      {pushSupported ? (
        pushActive ? (
          <p className="rounded-2xl border border-white/[0.07] px-4 py-3.5 text-sm text-white/55">
            Notificaciones activas en este dispositivo.
          </p>
        ) : (
          <button
            type="button"
            onClick={onEnablePush}
            disabled={pushBusy}
            className="rounded-2xl border border-white/[0.07] bg-[#161a22] px-4 py-3.5 text-left text-sm text-[#e4e6ed] disabled:opacity-60"
          >
            {pushBusy ? "Activando notificaciones…" : "Activar notificaciones"}
          </button>
        )
      ) : null}

      {showAdmin ? (
        <Link
          href="/admin"
          className="rounded-2xl border border-white/[0.07] px-4 py-3.5 text-sm text-white/55"
        >
          Administración
        </Link>
      ) : null}
    </div>
  );
}
