"use client";

import { useEffect, useState } from "react";
import { LS_KORE_SALUD, type SaludData } from "@/components/SaludModal";
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
import { emitKoreUpdate } from "@/lib/kore-events";

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

export type SaludResumenModalProps = {
  onClose: () => void;
  onChange?: (next: SaludData) => void;
};

export function SaludResumenModal({ onClose, onChange }: SaludResumenModalProps) {
  const [data, setData] = useState<SaludData>(() => readSalud());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [citaDraft, setCitaDraft] = useState<Cita>({
    id: "",
    descripcion: "",
    fecha: "",
    hora: "",
    lugar: "",
  });
  const [medDraft, setMedDraft] = useState<Medicacion>({
    id: "",
    nombre: "",
    dosis: "",
    frecuenciaHoras: 8,
    proximaToma: "",
  });
  const [addingMember, setAddingMember] = useState<Member | null>(null);
  const [addingType, setAddingType] = useState<"cita" | "medicacion">("cita");
  const [newCita, setNewCita] = useState({ descripcion: "", fecha: "", hora: "", lugar: "" });
  const [newMed, setNewMed] = useState({ nombre: "", dosis: "", frecuenciaHoras: "", proximaToma: "" });

  const persist = (next: SaludData) => {
    setData(next);
    saveSalud(next);
    onChange?.(next);
  };

  const reloadFromRemote = async () => {
    try {
      const rows = await getHealthRecords();
      persist(saludFromHealthRecords(rows) as SaludData);
    } catch {
      persist(readSalud());
    }
  };

  useEffect(() => {
    void reloadFromRemote();
  }, []);

  const removeCita = async (member: Member, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      next[member].citas = next[member].citas.filter((c) => c.id !== id);
      persist(next);
    }
  };

  const removeMed = async (member: Member, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      next[member].medicaciones = next[member].medicaciones.filter((m) => m.id !== id);
      persist(next);
    }
  };

  const startEditCita = (member: Member, c: Cita) => {
    setEditingKey(`cita:${member}:${c.id}`);
    setCitaDraft(c);
  };

  const startEditMed = (member: Member, m: Medicacion) => {
    setEditingKey(`med:${member}:${m.id}`);
    setMedDraft(m);
  };

  const saveEditCita = async (member: Member, id: string) => {
    if (!citaDraft.descripcion.trim() || !citaDraft.fecha || !citaDraft.hora) return;
    try {
      await updateHealthRecord(
        id,
        buildCitaHealthUpdate({
          member,
          descripcion: citaDraft.descripcion.trim(),
          fecha: citaDraft.fecha,
          hora: citaDraft.hora,
          lugar: citaDraft.lugar.trim(),
        }),
      );
      setEditingKey(null);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      next[member].citas = next[member].citas.map((c) =>
        c.id === id
          ? {
              ...c,
              descripcion: citaDraft.descripcion.trim(),
              fecha: citaDraft.fecha,
              hora: citaDraft.hora,
              lugar: citaDraft.lugar.trim(),
            }
          : c,
      );
      persist(next);
      setEditingKey(null);
    }
  };

  const saveEditMed = async (member: Member, id: string) => {
    const freq = Number(medDraft.frecuenciaHoras);
    if (!medDraft.nombre.trim() || !medDraft.dosis.trim() || Number.isNaN(freq) || freq <= 0 || !medDraft.proximaToma) return;
    try {
      await updateHealthRecord(
        id,
        buildMedHealthUpdate({
          member,
          nombre: medDraft.nombre.trim(),
          dosis: medDraft.dosis.trim(),
          frecuenciaHoras: freq,
          proximaToma: medDraft.proximaToma,
        }),
      );
      setEditingKey(null);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      next[member].medicaciones = next[member].medicaciones.map((m) =>
        m.id === id
          ? {
              ...m,
              nombre: medDraft.nombre.trim(),
              dosis: medDraft.dosis.trim(),
              frecuenciaHoras: freq,
              proximaToma: medDraft.proximaToma,
            }
          : m,
      );
      persist(next);
      setEditingKey(null);
    }
  };

  const addNew = async () => {
    if (!addingMember) return;
    if (addingType === "cita") {
      if (!newCita.descripcion.trim() || !newCita.fecha || !newCita.hora) return;
      try {
        await addHealthRecord(
          buildCitaHealthInsert(addingMember, {
            descripcion: newCita.descripcion.trim(),
            fecha: newCita.fecha,
            hora: newCita.hora,
            lugar: newCita.lugar.trim(),
          }),
        );
        setNewCita({ descripcion: "", fecha: "", hora: "", lugar: "" });
        setAddingMember(null);
        await reloadFromRemote();
        emitKoreUpdate(["health_records"]);
      } catch {
        const next = structuredClone(data);
        next[addingMember].citas.push({
          id: crypto.randomUUID?.() ?? `cita_${Date.now()}`,
          descripcion: newCita.descripcion.trim(),
          fecha: newCita.fecha,
          hora: newCita.hora,
          lugar: newCita.lugar.trim(),
        });
        setNewCita({ descripcion: "", fecha: "", hora: "", lugar: "" });
        setAddingMember(null);
        persist(next);
      }
      return;
    }
    const freq = Number(newMed.frecuenciaHoras);
    if (!newMed.nombre.trim() || !newMed.dosis.trim() || Number.isNaN(freq) || freq <= 0 || !newMed.proximaToma) return;
    try {
      await addHealthRecord(
        buildMedHealthInsert(addingMember, {
          nombre: newMed.nombre.trim(),
          dosis: newMed.dosis.trim(),
          frecuenciaHoras: freq,
          proximaToma: newMed.proximaToma,
        }),
      );
      setNewMed({ nombre: "", dosis: "", frecuenciaHoras: "", proximaToma: "" });
      setAddingMember(null);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      next[addingMember].medicaciones.push({
        id: crypto.randomUUID?.() ?? `med_${Date.now()}`,
        nombre: newMed.nombre.trim(),
        dosis: newMed.dosis.trim(),
        frecuenciaHoras: freq,
        proximaToma: newMed.proximaToma,
      });
      setNewMed({ nombre: "", dosis: "", frecuenciaHoras: "", proximaToma: "" });
      setAddingMember(null);
      persist(next);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Salud Familiar"
      style={{ position: "fixed", inset: 0, zIndex: 8250, background: "#090b10", color: "#e4e6ed", display: "flex", flexDirection: "column" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🏥 Salud Familiar</p>
        <button type="button" onClick={onClose} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", width: 36, height: 36 }}>
          ×
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {(["Peque", "Ander", "Leire"] as const).map((member) => {
          const citas = data[member].citas;
          const meds = data[member].medicaciones;
          const memberColor = member === "Peque" ? "#4CC9A0" : member === "Ander" ? "#2CB1A3" : "#9B8FE8";
          return (
            <section key={member} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: memberColor }}>{member}</p>
                <button
                  type="button"
                  onClick={() => {
                    setAddingMember(member);
                    setAddingType("cita");
                  }}
                  style={{ borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", width: 44, height: 44, cursor: "pointer", fontSize: 18 }}
                >
                  +
                </button>
              </div>

              <>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(228,230,237,0.65)" }}>Citas</p>
                {citas.length === 0 ? (
                  <p style={{ margin: "0 0 10px", color: "rgba(228,230,237,0.6)", fontSize: 13 }}>Sin citas</p>
                ) : (
                  <div style={{ display: "grid" }}>
                    {citas.map((c) => {
                      const key = `cita:${member}:${c.id}`;
                      const isEditing = editingKey === key;
                      return (
                        <div key={c.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#1c2028", padding: 10, marginBottom: 8 }}>
                          {isEditing ? (
                            <div style={{ display: "grid", gap: 8 }}>
                              <input value={citaDraft.descripcion} onChange={(e) => setCitaDraft((d) => ({ ...d, descripcion: e.target.value }))} placeholder="Descripción" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <input type="date" value={citaDraft.fecha} onChange={(e) => setCitaDraft((d) => ({ ...d, fecha: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                                <input type="time" value={citaDraft.hora} onChange={(e) => setCitaDraft((d) => ({ ...d, hora: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              </div>
                              <input value={citaDraft.lugar} onChange={(e) => setCitaDraft((d) => ({ ...d, lugar: e.target.value }))} placeholder="Lugar" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => void saveEditCita(member, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Guardar</button>
                                <button type="button" onClick={() => setEditingKey(null)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p style={{ margin: 0, fontSize: 13 }}>{c.fecha} · {c.hora} · {c.lugar || "Sin lugar"} · {c.descripcion}</p>
                              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => startEditCita(member, c)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                <button type="button" onClick={() => void removeCita(member, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p style={{ margin: "10px 0 6px", fontSize: 11, color: "rgba(228,230,237,0.65)" }}>Medicaciones activas</p>
                {meds.length === 0 ? (
                  <p style={{ margin: 0, color: "rgba(228,230,237,0.6)", fontSize: 13 }}>Sin medicaciones</p>
                ) : (
                  <div style={{ display: "grid" }}>
                    {meds.map((m) => {
                      const key = `med:${member}:${m.id}`;
                      const isEditing = editingKey === key;
                      return (
                        <div key={m.id} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#1c2028", padding: 10, marginBottom: 8 }}>
                          {isEditing ? (
                            <div style={{ display: "grid", gap: 8 }}>
                              <input value={medDraft.nombre} onChange={(e) => setMedDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Nombre" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <input value={medDraft.dosis} onChange={(e) => setMedDraft((d) => ({ ...d, dosis: e.target.value }))} placeholder="Dosis" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <input value={String(medDraft.frecuenciaHoras)} onChange={(e) => setMedDraft((d) => ({ ...d, frecuenciaHoras: Number(e.target.value) || d.frecuenciaHoras }))} inputMode="numeric" placeholder="Frecuencia horas" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <input type="datetime-local" value={medDraft.proximaToma} onChange={(e) => setMedDraft((d) => ({ ...d, proximaToma: e.target.value }))} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => void saveEditMed(member, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Guardar</button>
                                <button type="button" onClick={() => setEditingKey(null)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p style={{ margin: 0, fontSize: 13 }}>{m.nombre} · {m.dosis} · Próxima: {m.proximaToma}</p>
                              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => startEditMed(member, m)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                <button type="button" onClick={() => void removeMed(member, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>

              {addingMember === member ? (
                <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "grid", gap: 6 }}>
                  <select value={addingType} onChange={(e) => setAddingType(e.target.value as "cita" | "medicacion")} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "10px 12px", fontSize: 16 }}>
                    <option value="cita" style={{ color: "#111318", background: "#e4e6ed" }}>Cita</option>
                    <option value="medicacion" style={{ color: "#111318", background: "#e4e6ed" }}>Medicación</option>
                  </select>
                  {addingType === "cita" ? (
                    <>
                      <input value={newCita.descripcion} onChange={(e) => setNewCita((d) => ({ ...d, descripcion: e.target.value }))} placeholder="Descripción" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="date" value={newCita.fecha} onChange={(e) => setNewCita((d) => ({ ...d, fecha: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                        <input type="time" value={newCita.hora} onChange={(e) => setNewCita((d) => ({ ...d, hora: e.target.value }))} style={{ flex: 1, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                      </div>
                      <input value={newCita.lugar} onChange={(e) => setNewCita((d) => ({ ...d, lugar: e.target.value }))} placeholder="Lugar" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                    </>
                  ) : (
                    <>
                      <input value={newMed.nombre} onChange={(e) => setNewMed((d) => ({ ...d, nombre: e.target.value }))} placeholder="Nombre" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                      <input value={newMed.dosis} onChange={(e) => setNewMed((d) => ({ ...d, dosis: e.target.value }))} placeholder="Dosis" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                      <input value={newMed.frecuenciaHoras} onChange={(e) => setNewMed((d) => ({ ...d, frecuenciaHoras: e.target.value }))} inputMode="numeric" placeholder="Frecuencia (horas)" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                      <input type="datetime-local" value={newMed.proximaToma} onChange={(e) => setNewMed((d) => ({ ...d, proximaToma: e.target.value }))} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "10px 12px", fontSize: 16 }} />
                    </>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => void addNew()} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>Guardar</button>
                    <button type="button" onClick={() => setAddingMember(null)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}
