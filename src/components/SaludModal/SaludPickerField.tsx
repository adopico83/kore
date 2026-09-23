"use client";

import { Calendar, Clock } from "lucide-react";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

type PickerKind = "date" | "time" | "datetime-local";

type SaludPickerFieldProps = {
  kind: PickerKind;
  value: string;
  onChange: (value: string) => void;
  /** Ocupa el espacio sobrante cuando va en una fila. */
  fill?: boolean;
};

function formatFecha(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function formatHora(raw: string): string | null {
  const match = /^(\d{2}:\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

function visibleLabel(kind: PickerKind, value: string): { text: string; filled: boolean } {
  if (kind === "date") {
    const formatted = value ? formatFecha(value) : null;
    return { text: formatted ?? "Fecha", filled: Boolean(formatted) };
  }
  if (kind === "time") {
    const formatted = value ? formatHora(value) : null;
    return { text: formatted ?? "Hora", filled: Boolean(formatted) };
  }
  const [datePart, timePart] = value.split("T");
  const fecha = datePart ? formatFecha(datePart) : null;
  const hora = timePart ? formatHora(timePart) : null;
  if (fecha && hora) return { text: `${fecha} · ${hora}`, filled: true };
  if (fecha) return { text: fecha, filled: true };
  return { text: "Próxima toma", filled: false };
}

function accessibleName(kind: PickerKind, text: string, filled: boolean): string {
  if (!filled) {
    if (kind === "date") return "Fecha";
    if (kind === "time") return "Hora";
    return "Próxima toma";
  }
  if (kind === "date") return `Fecha, ${text}`;
  if (kind === "time") return `Hora, ${text}`;
  return `Próxima toma, ${text}`;
}

export function SaludPickerField({ kind, value, onChange, fill = false }: SaludPickerFieldProps) {
  const label = visibleLabel(kind, value);
  const Icon = kind === "time" ? Clock : Calendar;
  return (
    <label
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flex: fill ? 1 : undefined,
        minWidth: 0,
        minHeight: 48,
        boxSizing: "border-box",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        padding: "10px 12px",
      }}
    >
      <Icon aria-hidden size={18} color={label.filled ? "#4CC9A0" : "rgba(228,230,237,0.55)"} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: 16,
          lineHeight: 1.2,
          color: label.filled ? "#e4e6ed" : "rgba(228,230,237,0.55)",
          pointerEvents: "none",
        }}
      >
        {label.text}
      </span>
      <input
        className="kore-picker-input"
        type={kind}
        value={value}
        aria-label={accessibleName(kind, label.text, label.filled)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
