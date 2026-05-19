"use client";

import type { CSSProperties } from "react";

const dateTimeContainerStyle: CSSProperties = {
  background: "#1c2028",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 12px",
  boxSizing: "border-box",
};

const dateTimeInputStyle: CSSProperties = {
  width: "100%",
  display: "block",
  marginTop: 6,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#e4e6ed",
  colorScheme: "dark",
  fontSize: 16,
  opacity: 1,
  outline: "none",
  boxSizing: "border-box",
  minHeight: 28,
};

function formatDateLabel(date: string): string {
  const parts = date.slice(0, 10).split("-");
  if (parts.length < 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTimeLabel(time: string): string {
  const t = time.trim();
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDatetimeLocalLabel(value: string): string {
  if (!value.trim()) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DateTimeFieldBaseProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  emptyHint?: string;
};

type DateTimeFieldProps = DateTimeFieldBaseProps & {
  kind: "date" | "time";
  min?: string;
};

/** iOS PWA: valor visible en label; input nativo conserva el picker. */
export function DateTimeField({ kind, value, onChange, min, ariaLabel, emptyHint = "Toca para seleccionar" }: DateTimeFieldProps) {
  const hasValue = value.trim().length > 0;
  const displayText = hasValue
    ? kind === "date"
      ? formatDateLabel(value)
      : formatTimeLabel(value)
    : emptyHint;

  return (
    <label style={{ ...dateTimeContainerStyle, display: "block", cursor: "pointer" }}>
      <span
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: hasValue ? 600 : 400,
          color: hasValue ? "#e4e6ed" : "rgba(228,230,237,0.45)",
          lineHeight: 1.35,
        }}
      >
        {displayText}
      </span>
      <input
        type={kind}
        value={value}
        min={kind === "date" ? min : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        style={dateTimeInputStyle}
      />
    </label>
  );
}

type DateTimeLocalFieldProps = DateTimeFieldBaseProps & {
  caption?: string;
};

/** Mismo patrón para `datetime-local` (Sueño: inicio/fin de sesión). */
export function DateTimeLocalField({
  value,
  onChange,
  ariaLabel,
  caption,
  emptyHint = "Toca para seleccionar",
}: DateTimeLocalFieldProps) {
  const hasValue = value.trim().length > 0;
  const displayText = hasValue ? formatDatetimeLocalLabel(value) : emptyHint;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {caption ? (
        <span style={{ fontSize: 11, color: "rgba(228,230,237,0.55)" }}>{caption}</span>
      ) : null}
      <label style={{ ...dateTimeContainerStyle, display: "block", cursor: "pointer", margin: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: hasValue ? 600 : 400,
            color: hasValue ? "#e4e6ed" : "rgba(228,230,237,0.45)",
            lineHeight: 1.35,
          }}
        >
          {displayText}
        </span>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          style={dateTimeInputStyle}
        />
      </label>
    </div>
  );
}
