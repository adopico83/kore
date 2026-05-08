"use client";

import { useEffect, useMemo, useState } from "react";

import {
  addHealthRecord,
  deleteHealthRecord,
  getHealthRecords,
  updateHealthRecord,
} from "@/lib/actions/health";
import type { Profile } from "@/lib/kore-db";
import { emitKoreUpdate } from "@/lib/kore-events";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

export const LS_KORE_SALUD = "kore_salud";

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

export type SaludData = Record<string, { citas: Cita[]; medicaciones: Medicacion[] }>;

function emptyMember() {
  return { citas: [], medicaciones: [] };
}

function emptySalud(profiles: Profile[]): SaludData {
  return Object.fromEntries(profiles.map((p) => [p.id, emptyMember()])) as SaludData;
}

function readSalud(profiles: Profile[]): SaludData {
  if (typeof window === "undefined") return emptySalud(profiles);
  try {
    const raw = localStorage.getItem(LS_KORE_SALUD);
    if (!raw) return emptySalud(profiles);
    const parsed = JSON.parse(raw) as SaludData;
    if (!parsed || typeof parsed !== "object") return emptySalud(profiles);
    const out = emptySalud(profiles);
    for (const p of profiles) {
      const member = parsed[p.id];
      if (!member) continue;
      out[p.id] = {
        citas: Array.isArray(member.citas) ? member.citas : [],
        medicaciones: Array.isArray(member.medicaciones) ? member.medicaciones : [],
      };
    }
    return out;
  } catch {
    return emptySalud(profiles);
  }
}

function saveSalud(data: SaludData) {
  try {
    localStorage.setItem(LS_KORE_SALUD, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function mapHealthRowsToSalud(rows: Awaited<ReturnType<typeof getHealthRecords>>, profiles: Profile[]): SaludData {
  const out = emptySalud(profiles);
  for (const row of rows) {
    if (!row.patient_id || !out[row.patient_id]) continue;
    if (row.type === "appointment") {
      const raw = row.date_time ?? "";
      const [fecha, horaRaw] = raw.includes("T") ? raw.split("T") : [raw, ""];
      out[row.patient_id].citas.push({
        id: row.id,
        descripcion: row.description ?? "",
        fecha: (fecha ?? "").slice(0, 10),
        hora: (horaRaw ?? "").slice(0, 5),
        lugar: "",
      });
      continue;
    }
    if (row.type === "medication") {
      out[row.patient_id].medicaciones.push({
        id: row.id,
        nombre: row.description ?? "",
        dosis: "",
        frecuenciaHoras: 8,
        proximaToma: row.next_dose_at ?? "",
      });
    }
  }
  return out;
}

export type SaludModalProps = {
  onClose: () => void;
  profiles: Profile[];
  onChange?: (data: SaludData) => void;
};

export function SaludModal({ onClose, profiles, onChange }: SaludModalProps) {
  useEscapeKey(onClose);
  const [data, setData] = useState<SaludData>(() => readSalud(profiles));
  const [openMember, setOpenMember] = useState<string>(profiles[0]?.id ?? "");
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
  const [miembro, setMiembro] = useState<string>(profiles[0]?.id ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [frecuenciaHoras, setFrecuenciaHoras] = useState("");
  const [proximaToma, setProximaToma] = useState("");

  useEffect(() => {
    setData(readSalud(profiles));
    if (!openMember && profiles[0]?.id) setOpenMember(profiles[0].id);
    if (!miembro && profiles[0]?.id) setMiembro(profiles[0].id);
  }, [profiles, openMember, miembro]);

  const applyLocal = (next: SaludData) => {
    setData(next);
    saveSalud(next);
    onChange?.(next);
  };

  const reloadFromRemote = async () => {
    try {
      const rows = await getHealthRecords();
      applyLocal(mapHealthRowsToSalud(rows, profiles));
    } catch {
      applyLocal(readSalud(profiles));
    }
  };

  useEffect(() => {
    void reloadFromRemote();
  }, [profiles]);

  const update = (next: SaludData) => {
    applyLocal(next);
  };

  const totalPendientes = useMemo(
    () =>
      Object.values(data).reduce(
        (acc, member) => acc + member.citas.length + member.medicaciones.length,
        0,
      ),
    [data],
  );

  const addItem = async () => {
    if (!miembro) return;
    if (tipo === "cita") {
      if (!descripcion.trim() || !fecha || !hora) return;
      try {
        await addHealthRecord({
          patient_id: miembro,
          type: "appointment",
          description: descripcion.trim(),
          date_time: `${fecha}T${hora}:00`,
          next_dose_at: null,
          status: "pending",
        });
        setDescripcion("");
        setFecha("");
        setHora("");
        setLugar("");
        await reloadFromRemote();
        emitKoreUpdate(["health_records"]);
      } catch {
        const next = structuredClone(data);
        if (!next[miembro]) next[miembro] = emptyMember();
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
      await addHealthRecord({
        patient_id: miembro,
        type: "medication",
        description: `${nombre.trim()} ${dosis.trim()}`.trim(),
        date_time: proximaToma,
        next_dose_at: proximaToma,
        status: "active",
      });
      setNombre("");
      setDosis("");
      setFrecuenciaHoras("");
      setProximaToma("");
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      if (!next[miembro]) next[miembro] = emptyMember();
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

  const removeCita = async (memberId: string, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      if (!next[memberId]) return;
      next[memberId].citas = next[memberId].citas.filter((c) => c.id !== id);
      update(next);
    }
  };

  const removeMed = async (memberId: string, id: string) => {
    try {
      await deleteHealthRecord(id);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      if (!next[memberId]) return;
      next[memberId].medicaciones = next[memberId].medicaciones.filter((m) => m.id !== id);
      update(next);
    }
  };

  const startEditCita = (memberId: string, cita: Cita) => {
    setEditingKey(`cita:${memberId}:${cita.id}`);
    setEditCitaDraft(cita);
  };

  const startEditMed = (memberId: string, med: Medicacion) => {
    setEditingKey(`med:${memberId}:${med.id}`);
    setEditMedDraft(med);
  };

  const saveEditCita = async (memberId: string, id: string) => {
    if (!editCitaDraft.descripcion.trim() || !editCitaDraft.fecha || !editCitaDraft.hora) return;
    try {
      await updateHealthRecord(id, {
        patient_id: memberId,
        description: editCitaDraft.descripcion.trim(),
        date_time: `${editCitaDraft.fecha}T${editCitaDraft.hora}:00`,
      });
      setEditingKey(null);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      if (!next[memberId]) return;
      next[memberId].citas = next[memberId].citas.map((c) =>
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

  const saveEditMed = async (memberId: string, id: string) => {
    const freq = Number(editMedDraft.frecuenciaHoras);
    if (!editMedDraft.nombre.trim() || !editMedDraft.dosis.trim() || Number.isNaN(freq) || freq <= 0 || !editMedDraft.proximaToma) return;
    try {
      await updateHealthRecord(id, {
        patient_id: memberId,
        description: `${editMedDraft.nombre.trim()} ${editMedDraft.dosis.trim()}`.trim(),
        date_time: editMedDraft.proximaToma,
        next_dose_at: editMedDraft.proximaToma,
      });
      setEditingKey(null);
      await reloadFromRemote();
      emitKoreUpdate(["health_records"]);
    } catch {
      const next = structuredClone(data);
      if (!next[memberId]) return;
      next[memberId].medicaciones = next[memberId].medicaciones.map((m) =>
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

        {profiles.map((member, index) => {
          const memberData = data[member.id] ?? emptyMember();
          const sectionOpen = openMember === member.id;
          const colors = ["#4CC9A0", "#2CB1A3", "#EF9F27", "#9B8FE8"];
          const memberColor = colors[index % colors.length];
          return (
            <section key={member.id} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161a22", overflow: "hidden" }}>
              <button type="button" onClick={() => setOpenMember(sectionOpen ? (profiles[0]?.id ?? "") : member.id)} style={{ width: "100%", border: "none", background: "transparent", color: "#e4e6ed", padding: "10px 12px", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: memberColor }}>{member.name}</span>
                <span style={{ color: "rgba(228,230,237,0.65)" }}>{sectionOpen ? "▼" : "▶"}</span>
              </button>
              {sectionOpen ? (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Citas</p>
                    {memberData.citas.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.65)" }}>Sin citas</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {memberData.citas.map((c) => {
                          const key = `cita:${member.id}:${c.id}`;
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
                                    <button type="button" onClick={() => void saveEditCita(member.id, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Guardar</button>
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
                                    <button type="button" onClick={() => startEditCita(member.id, c)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                    <button type="button" onClick={() => void removeCita(member.id, c.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
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
                    {memberData.medicaciones.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.65)" }}>Sin medicaciones</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {memberData.medicaciones.map((m) => {
                          const key = `med:${member.id}:${m.id}`;
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
                                    <button type="button" onClick={() => void saveEditMed(member.id, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Guardar</button>
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
                                    <button type="button" onClick={() => startEditMed(member.id, m)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e4e6ed", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Editar</button>
                                    <button type="button" onClick={() => void removeMed(member.id, m.id)} style={{ minHeight: 44, minWidth: 44, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(228,230,237,0.75)", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
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
            <select value={miembro} onChange={(e) => setMiembro(e.target.value)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "10px 12px", fontSize: 16 }}>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id} style={{ color: "#111318", background: "#e4e6ed" }}>
                  {profile.name}
                </option>
              ))}
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
