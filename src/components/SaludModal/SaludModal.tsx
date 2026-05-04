"use client";

import { useMemo, useState } from "react";

export const LS_KORE_SALUD = "kore_salud";

type Member = "Peque" | "Ander" | "Leire";

type Cita = {
  id: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
};

type Medicacion = {
  id: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
  proximaToma: string;
};

export type SaludData = Record<Member, { citas: Cita[]; medicaciones: Medicacion[] }>;

function emptySalud(): SaludData {
  return {
    Peque: { citas: [], medicaciones: [] },
    Ander: { citas: [], medicaciones: [] },
    Leire: { citas: [], medicaciones: [] },
  };
}

function readSalud(): SaludData {
  if (typeof window === "undefined") return emptySalud();
  try {
    const raw = localStorage.getItem(LS_KORE_SALUD);
    if (!raw) return emptySalud();
    const parsed = JSON.parse(raw) as SaludData;
    if (!parsed?.Peque || !parsed?.Ander || !parsed?.Leire) return emptySalud();
    return parsed;
  } catch {
    return emptySalud();
  }
}

function saveSalud(data: SaludData) {
  try {
    localStorage.setItem(LS_KORE_SALUD, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export type SaludModalProps = {
  onClose: () => void;
  onChange?: (data: SaludData) => void;
};

export function SaludModal({ onClose, onChange }: SaludModalProps) {
  const [data, setData] = useState<SaludData>(() => readSalud());
  const [openMember, setOpenMember] = useState<Member>("Peque");
  const [tipo, setTipo] = useState<"cita" | "medicacion">("cita");
  const [miembro, setMiembro] = useState<Member>("Peque");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [frecuenciaHoras, setFrecuenciaHoras] = useState("");
  const [proximaToma, setProximaToma] = useState("");

  const update = (next: SaludData) => {
    setData(next);
    saveSalud(next);
    onChange?.(next);
  };

  const totalPendientes = useMemo(
    () =>
      (data.Peque.citas.length + data.Peque.medicaciones.length) +
      (data.Ander.citas.length + data.Ander.medicaciones.length) +
      (data.Leire.citas.length + data.Leire.medicaciones.length),
    [data],
  );

  const addItem = () => {
    const next = structuredClone(data);
    if (tipo === "cita") {
      if (!descripcion.trim() || !fecha || !hora) return;
      next[miembro].citas.push({
        id: crypto.randomUUID?.() ?? `cita_${Date.now()}`,
        descripcion: descripcion.trim(),
        fecha,
        hora,
        lugar: lugar.trim(),
      });
      setDescripcion("");
      setFecha("");
      setHora("");
      setLugar("");
    } else {
      const freq = Number(frecuenciaHoras);
      if (!nombre.trim() || !dosis.trim() || Number.isNaN(freq) || freq <= 0 || !proximaToma) return;
      next[miembro].medicaciones.push({
        id: crypto.randomUUID?.() ?? `med_${Date.now()}`,
        nombre: nombre.trim(),
        dosis: dosis.trim(),
        frecuenciaHoras: freq,
        proximaToma,
      });
      setNombre("");
      setDosis("");
      setFrecuenciaHoras("");
      setProximaToma("");
    }
    update(next);
  };

  const removeCita = (member: Member, id: string) => {
    const next = structuredClone(data);
    next[member].citas = next[member].citas.filter((c) => c.id !== id);
    update(next);
  };

  const removeMed = (member: Member, id: string) => {
    const next = structuredClone(data);
    next[member].medicaciones = next[member].medicaciones.filter((m) => m.id !== id);
    update(next);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Salud Familiar" style={{ position: "fixed", inset: 0, zIndex: 8200, background: "#090b10", color: "#e4e6ed", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🏥 Salud Familiar</p>
        <button type="button" onClick={onClose} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", width: 36, height: 36 }}>
          ×
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Pendientes totales</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{totalPendientes}</p>
        </section>

        {(["Peque", "Ander", "Leire"] as const).map((member) => {
          const sectionOpen = openMember === member;
          return (
            <section key={member} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", overflow: "hidden" }}>
              <button type="button" onClick={() => setOpenMember(sectionOpen ? "Peque" : member)} style={{ width: "100%", border: "none", background: "transparent", color: "#e4e6ed", padding: "10px 12px", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontWeight: 700 }}>{member}</span>
                <span style={{ color: "rgba(228,230,237,0.65)" }}>{sectionOpen ? "▼" : "▶"}</span>
              </button>
              {sectionOpen ? (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Citas</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {data[member].citas.map((c) => (
                        <li key={c.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: "8px 9px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13 }}>{c.descripcion}</p>
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.65)" }}>{c.fecha} {c.hora} · {c.lugar || "Sin lugar"}</p>
                          </div>
                          <button type="button" onClick={() => removeCita(member, c.id)} style={{ border: "none", background: "transparent", color: "rgba(228,230,237,0.65)", cursor: "pointer" }}>✕</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Medicaciones activas</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                      {data[member].medicaciones.map((m) => (
                        <li key={m.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: "8px 9px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13 }}>{m.nombre} · {m.dosis}</p>
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.65)" }}>Cada {m.frecuenciaHoras}h · Próxima: {m.proximaToma}</p>
                          </div>
                          <button type="button" onClick={() => removeMed(member, m.id)} style={{ border: "none", background: "transparent", color: "rgba(228,230,237,0.65)", cursor: "pointer" }}>✕</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Añadir registro</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "cita" | "medicacion")} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "8px 10px" }}>
              <option value="cita" style={{ color: "#111318", background: "#e4e6ed" }}>Cita</option>
              <option value="medicacion" style={{ color: "#111318", background: "#e4e6ed" }}>Medicación</option>
            </select>
            <select value={miembro} onChange={(e) => setMiembro(e.target.value as Member)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "8px 10px" }}>
              <option value="Peque" style={{ color: "#111318", background: "#e4e6ed" }}>Peque</option>
              <option value="Ander" style={{ color: "#111318", background: "#e4e6ed" }}>Ander</option>
              <option value="Leire" style={{ color: "#111318", background: "#e4e6ed" }}>Leire</option>
            </select>
            {tipo === "cita" ? (
              <>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
              </>
            ) : (
              <>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="Dosis" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input value={frecuenciaHoras} onChange={(e) => setFrecuenciaHoras(e.target.value)} inputMode="numeric" placeholder="Frecuencia (horas)" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
                <input type="datetime-local" value={proximaToma} onChange={(e) => setProximaToma(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px" }} />
              </>
            )}
            <button type="button" onClick={addItem} style={{ borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
              Añadir
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
