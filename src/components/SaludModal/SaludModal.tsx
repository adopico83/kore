"use client";

import { useEffect, useMemo, useState } from "react";

import {
  addHealthRecord,
  deleteHealthRecord,
  getHealthRecords,
  updateHealthRecord,
} from "@/lib/kore-db";
import {
  buildCitaHealthInsert,
  buildCitaHealthUpdate,
  buildMedHealthInsert,
  buildMedHealthUpdate,
  saludFromHealthRecords,
} from "@/lib/kore-salud-sync";

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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editCitaDraft, setEditCitaDraft] = useState<Cita>({
    id: "",
    descripcion: "",
    fecha: "",
    hora: "",
    lugar: "",
  });
  const [editMedDraft, setEditMedDraft] = useState<Medicacion>({
    id: "",
    nombre: "",
    dosis: "",
    frecuenciaHoras: 8,
    proximaToma: "",
  });
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

  const applyLocal = (next: SaludData) => {
    setData(next);
    saveSalud(next);
    onChange?.(next);
  };

  const reloadFromRemote = async () => {
    try {
      const rows = await getHealthRecords();
      const next = saludFromHealthRecords(rows) as SaludData;
      applyLocal(next);
    } catch {
      applyLocal(readSalud());
    }
  };

  useEffect(() => {
    void reloadFromRemote();
  }, []);

  const update = (next: SaludData) => {
    applyLocal(next);
  };

  const totalPendientes = useMemo(
    () =>
      (data.Peque.citas.length + data.Peque.medicaciones.length) +
      (data.Ander.citas.length + data.Ander.medicaciones.length) +
      (data.Leire.citas.length + data.Leire.medicaciones.length),
    [data],
  );

  const addItem = async () => {
    if (tipo === "cita") {
      if (!descripcion.trim() || !fecha || !hora) return;
      try {
        await addHealthRecord(
          buildCitaHealthInsert(miembro, {
            descripcion: descripcion.trim(),
            fecha,
            hora,
            lugar: lugar.trim(),
          }),
        );
        setDescripcion("");
        setFecha("");
        setHora("");
        setLugar("");
        await reloadFromRemote();
      } catch {
        const next = structuredClone(data);
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
        update(next);
      }
      return;
    }
    const freq = Number(frecuenciaHoras);
    if (!nombre.trim() || !dosis.trim() || Number.isNaN(freq) || freq <= 0 || !proximaToma) return;
    try {
      await addHealthRecord(
        buildMedHealthInsert(miembro, {
          nombre: nombre.trim(),
          dosis: dosis.trim(),
          frecuenciaHoras: freq,
          proximaToma,
        }),
      );
      setNombre("");
      setDosis("");
      setFrecuenciaHoras("");
      setProximaToma("");
      await reloadFromRemote();
    } catch {
      const next = structuredClone(data);
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
      update(next);
    }
  };

  const removeCita = async (member: Member, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
    } catch {
      const next = structuredClone(data);
      next[member].citas = next[member].citas.filter((c) => c.id !== id);
      update(next);
    }
  };

  const removeMed = async (member: Member, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
    } catch {
      const next = structuredClone(data);
      next[member].medicaciones = next[member].medicaciones.filter((m) => m.id !== id);
      update(next);
    }
  };

  const startEditCita = (member: Member, cita: Cita) => {
    setEditingKey(`cita:${member}:${cita.id}`);
    setEditCitaDraft(cita);
  };

  const startEditMed = (member: Member, med: Medicacion) => {
    setEditingKey(`med:${member}:${med.id}`);
    setEditMedDraft(med);
  };

  const saveEditCita = async (member: Member, id: string) => {
    if (!editCitaDraft.descripcion.trim() || !editCitaDraft.fecha || !editCitaDraft.hora) return;
    try {
      await updateHealthRecord(
        id,
        buildCitaHealthUpdate({
          member,
          descripcion: editCitaDraft.descripcion.trim(),
          fecha: editCitaDraft.fecha,
          hora: editCitaDraft.hora,
          lugar: editCitaDraft.lugar.trim(),
        }),
      );
      setEditingKey(null);
      await reloadFromRemote();
    } catch {
      const next = structuredClone(data);
      next[member].citas = next[member].citas.map((c) =>
        c.id === id
          ? {
              ...c,
              descripcion: editCitaDraft.descripcion.trim(),
              fecha: editCitaDraft.fecha,
              hora: editCitaDraft.hora,
              lugar: editCitaDraft.lugar.trim(),
            }
          : c,
      );
      update(next);
      setEditingKey(null);
    }
  };

  const saveEditMed = async (member: Member, id: string) => {
    const freq = Number(editMedDraft.frecuenciaHoras);
    if (!editMedDraft.nombre.trim() || !editMedDraft.dosis.trim() || Number.isNaN(freq) || freq <= 0 || !editMedDraft.proximaToma) return;
    try {
      await updateHealthRecord(
        id,
        buildMedHealthUpdate({
          member,
          nombre: editMedDraft.nombre.trim(),
          dosis: editMedDraft.dosis.trim(),
          frecuenciaHoras: freq,
          proximaToma: editMedDraft.proximaToma,
        }),
      );
      setEditingKey(null);
      await reloadFromRemote();
    } catch {
      const next = structuredClone(data);
      next[member].medicaciones = next[member].medicaciones.map((m) =>
        m.id === id
          ? {
              ...m,
              nombre: editMedDraft.nombre.trim(),
              dosis: editMedDraft.dosis.trim(),
              frecuenciaHoras: freq,
              proximaToma: editMedDraft.proximaToma,
            }
          : m,
      );
      update(next);
      setEditingKey(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Salud Familiar" style={{ position: "fixed", inset: 0, zIndex: 8200, background: "#090b10", color: "#e4e6ed", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🏥 Salud Familiar</p>
        <button type="button" onClick={onClose} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", width: 36, height: 36 }}>
          ×
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Pendientes totales</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{totalPendientes}</p>
        </section>

        {(["Peque", "Ander", "Leire"] as const).map((member) => {
          const sectionOpen = openMember === member;
          const memberColor = member === "Peque" ? "#4CC9A0" : member === "Ander" ? "#2CB1A3" : "#EF9F27";
          return (
            <section key={member} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", overflow: "hidden" }}>
              <button type="button" onClick={() => setOpenMember(sectionOpen ? "Peque" : member)} style={{ width: "100%", border: "none", background: "transparent", color: "#e4e6ed", padding: "10px 12px", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: memberColor }}>{member}</span>
                <span style={{ color: "rgba(228,230,237,0.65)" }}>{sectionOpen ? "▼" : "▶"}</span>
              </button>
              {sectionOpen ? (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Citas</p>
                    {data[member].citas.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.65)" }}>Sin citas</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {data[member].citas.map((c) => {
                          const key = `cita:${member}:${c.id}`;
                          const isEditing = editingKey === key;
                          return (
                            <li key={c.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#1c2028", padding: 10, marginBottom: 8 }}>
                              {isEditing ? (
                                <div style={{ display: "grid", gap: 8 }}>
                                  <input value={editCitaDraft.descripcion} onChange={(e) => setEditCitaDraft((d) => ({ ...d, descripcion: e.target.value }))} placeholder="Descripción" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <input type="date" value={editCitaDraft.fecha} onChange={(e) => setEditCitaDraft((d) => ({ ...d, fecha: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                    <input type="time" value={editCitaDraft.hora} onChange={(e) => setEditCitaDraft((d) => ({ ...d, hora: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  </div>
                                  <input value={editCitaDraft.lugar} onChange={(e) => setEditCitaDraft((d) => ({ ...d, lugar: e.target.value }))} placeholder="Lugar" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button type="button" onClick={() => void saveEditCita(member, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Guardar</button>
                                    <button type="button" onClick={() => setEditingKey(null)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13 }}>{c.descripcion}</p>
                                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(228,230,237,0.72)" }}>{c.fecha} {c.hora} · {c.lugar || "Sin lugar"}</p>
                                  </div>
                                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    <button type="button" onClick={() => startEditCita(member, c)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                    <button type="button" onClick={() => void removeCita(member, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Medicaciones activas</p>
                    {data[member].medicaciones.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.65)" }}>Sin medicaciones</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {data[member].medicaciones.map((m) => {
                          const key = `med:${member}:${m.id}`;
                          const isEditing = editingKey === key;
                          return (
                            <li key={m.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#1c2028", padding: 10, marginBottom: 8 }}>
                              {isEditing ? (
                                <div style={{ display: "grid", gap: 8 }}>
                                  <input value={editMedDraft.nombre} onChange={(e) => setEditMedDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Nombre" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <input value={editMedDraft.dosis} onChange={(e) => setEditMedDraft((d) => ({ ...d, dosis: e.target.value }))} placeholder="Dosis" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <input value={String(editMedDraft.frecuenciaHoras)} onChange={(e) => setEditMedDraft((d) => ({ ...d, frecuenciaHoras: Number(e.target.value) || d.frecuenciaHoras }))} inputMode="numeric" placeholder="Frecuencia (horas)" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <input type="datetime-local" value={editMedDraft.proximaToma} onChange={(e) => setEditMedDraft((d) => ({ ...d, proximaToma: e.target.value }))} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button type="button" onClick={() => void saveEditMed(member, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Guardar</button>
                                    <button type="button" onClick={() => setEditingKey(null)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13 }}>{m.nombre} · {m.dosis}</p>
                                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(228,230,237,0.72)" }}>Cada {m.frecuenciaHoras}h · Próxima: {m.proximaToma}</p>
                                  </div>
                                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                    <button type="button" onClick={() => startEditMed(member, m)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                    <button type="button" onClick={() => void removeMed(member, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Añadir registro</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "cita" | "medicacion")} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "10px 12px", fontSize: 16 }}>
              <option value="cita" style={{ color: "#111318", background: "#e4e6ed" }}>Cita</option>
              <option value="medicacion" style={{ color: "#111318", background: "#e4e6ed" }}>Medicación</option>
            </select>
            <select value={miembro} onChange={(e) => setMiembro(e.target.value as Member)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "10px 12px", fontSize: 16 }}>
              <option value="Peque" style={{ color: "#111318", background: "#e4e6ed" }}>Peque</option>
              <option value="Ander" style={{ color: "#111318", background: "#e4e6ed" }}>Ander</option>
              <option value="Leire" style={{ color: "#111318", background: "#e4e6ed" }}>Leire</option>
            </select>
            {tipo === "cita" ? (
              <>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
              </>
            ) : (
              <>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="Dosis" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input value={frecuenciaHoras} onChange={(e) => setFrecuenciaHoras(e.target.value)} inputMode="numeric" placeholder="Frecuencia (horas)" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                <input type="datetime-local" value={proximaToma} onChange={(e) => setProximaToma(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
              </>
            )}
            <button type="button" onClick={() => void addItem()} style={{ borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
              Añadir
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
