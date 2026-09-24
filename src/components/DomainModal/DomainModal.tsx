"use client";

import type { CSSProperties } from "react";
import { startTransition, useCallback, useEffect, useMemo, useOptimistic, useState } from "react";
import { emitKoreUpdate } from "@/lib/kore-events";
import { applyListMutation, upsertById } from "@/lib/optimistic-state";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import {
  addShoppingItem,
  completeShoppingItem,
  deleteShoppingItem,
  getShoppingItems,
  reactivateShoppingItem,
} from "@/lib/actions/shopping";
import { CleaningDomainPanel } from "@/components/domain-panels/CleaningDomainPanel";
import { SchoolDomainPanel } from "@/components/domain-panels/SchoolDomainPanel";
import { SleepDomainPanel } from "@/components/domain-panels/SleepDomainPanel";
import { type Profile, type ShoppingItemRow } from "@/lib/kore-db";

export type DomainItem = {
  id: string;
  name: string;
  owner: string;
  state: string;
  emoji: string;
  notes: string[];
};

export type DomainHistoryEntry = { id: string; at: string; text: string };

export type DomainModalProps = {
  domain: DomainItem;
  members?: string[];
  actorId?: string;
  onClose: () => void;
  onSave: (next: Pick<DomainItem, "owner" | "state" | "notes">) => void | Promise<void>;
  /** Historial remoto (Supabase). Si no se pasa, se usa `localStorage` como antes. */
  historyEntries?: DomainHistoryEntry[];
  /** Si true, el historial no permite borrar entradas (no hay API de borrado). */
  historyReadOnly?: boolean;
  /** Perfiles familiares (paneles Limpieza / Sueño). */
  profiles?: Profile[];
  /** Lista viva de compras (incluye filas pendientes de confirmar). */
  shoppingItems?: Array<ShoppingItemRow & { pending?: boolean }>;
  shoppingError?: string;
  onAddShoppingItem?: (name: string) => Promise<void>;
  onCompleteShoppingItem?: (id: string) => void;
  onDeleteShoppingItem?: (id: string) => void;
  onReactivateShoppingItem?: (id: string) => void;
};

const cardStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#161a22",
  padding: 12,
};

function normalizeDomainName(name: string): string {
  return name.trim().toLowerCase();
}

function isComprasDomainName(name: string): boolean {
  return normalizeDomainName(name) === "compras";
}

function isLimpiezaDomainName(name: string): boolean {
  return normalizeDomainName(name) === "limpieza";
}

function isSuenoDomainName(name: string): boolean {
  const n = normalizeDomainName(name);
  return n === "sueño" || n === "sueno";
}

function isColegioDomainName(name: string): boolean {
  return normalizeDomainName(name) === "colegio";
}

function hasStructuredDataPanel(name: string): boolean {
  return isLimpiezaDomainName(name) || isSuenoDomainName(name) || isColegioDomainName(name);
}

export function DomainModal({
  domain,
  members = [],
  actorId,
  onClose,
  onSave,
  historyEntries,
  historyReadOnly,
  profiles = [],
  shoppingItems: externalShoppingItems,
  shoppingError,
  onAddShoppingItem,
  onCompleteShoppingItem,
  onDeleteShoppingItem,
  onReactivateShoppingItem,
}: DomainModalProps) {
  useEscapeKey(onClose);
  const isCompras = isComprasDomainName(domain.name);
  const isDataPanel = hasStructuredDataPanel(domain.name);

  const [owner, setOwner] = useState(domain.owner);
  const [stateText, setStateText] = useState(domain.state);
  const [notes, setNotes] = useState<string[]>(domain.notes ?? []);
  const [newNote, setNewNote] = useState("");
  const [newShoppingName, setNewShoppingName] = useState("");
  const [shoppingItems, setShoppingItems] = useState<ShoppingItemRow[]>(externalShoppingItems ?? []);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [localShoppingError, setLocalShoppingError] = useState("");
  const shoppingControlled = externalShoppingItems !== undefined;
  const [optimisticLocalShopping, applyLocalShopping] = useOptimistic(
    shoppingItems,
    applyListMutation<ShoppingItemRow & { pending?: boolean }>,
  );
  const visibleShopping: Array<ShoppingItemRow & { pending?: boolean }> = shoppingControlled
    ? externalShoppingItems
    : optimisticLocalShopping;
  const shownShoppingError = shoppingError || localShoppingError;

  const [history, setHistory] = useState<DomainHistoryEntry[]>(() => {
    if (isComprasDomainName(domain.name)) return [];
    if (historyReadOnly) return historyEntries ?? [];
    if (historyEntries !== undefined) return historyEntries;
    try {
      const raw = localStorage.getItem(`kore_domain_history_${domain.id}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as DomainHistoryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const loadShoppingItems = useCallback(async () => {
    setShoppingLoading(true);
    try {
      const rows = await getShoppingItems();
      setShoppingItems(rows);
    } catch {
      setShoppingItems([]);
    } finally {
      setShoppingLoading(false);
    }
  }, []);

  useEffect(() => {
    setOwner(domain.owner);
    setStateText(domain.state);
    setNotes(domain.notes ?? []);
    setNewNote("");
    setNewShoppingName("");

    if (isComprasDomainName(domain.name)) {
      setHistory([]);
      return;
    }

    if (historyReadOnly) {
      setHistory(historyEntries ?? []);
      return;
    }
    if (historyEntries !== undefined) {
      setHistory(historyEntries);
      return;
    }
    try {
      const raw = localStorage.getItem(`kore_domain_history_${domain.id}`);
      if (!raw) {
        setHistory([]);
        return;
      }
      const parsed = JSON.parse(raw) as DomainHistoryEntry[];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, [domain.id, domain.name, domain.owner, domain.state, domain.notes, historyEntries, historyReadOnly]);

  useEffect(() => {
    if (!isCompras || shoppingControlled) return;
    void loadShoppingItems();
  }, [isCompras, domain.id, loadShoppingItems, shoppingControlled]);

  const pendingShopping = useMemo(
    () => visibleShopping.filter((r) => !r.completed),
    [visibleShopping],
  );
  const completedShopping = useMemo(() => {
    const done = visibleShopping.filter((r) => r.completed);
    return [...done].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [visibleShopping]);

  const removeHistoryEntry = (entryId: string) => {
    if (historyReadOnly) return;
    const next = history.filter((h) => h.id !== entryId);
    setHistory(next);
    try {
      localStorage.setItem(`kore_domain_history_${domain.id}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const handleAddShoppingItem = async () => {
    const name = newShoppingName.trim();
    if (!name) return;
    if (!actorId && !onAddShoppingItem) return;
    setLocalShoppingError("");
    setNewShoppingName("");
    if (onAddShoppingItem) {
      try {
        await onAddShoppingItem(name);
      } catch {
        setLocalShoppingError("No se pudo añadir el producto. Se ha deshecho.");
      }
      return;
    }
    const id = crypto.randomUUID();
    const draft: ShoppingItemRow & { pending?: boolean } = {
      id,
      name,
      quantity: null,
      category: null,
      priority: null,
      completed: false,
      created_by: actorId ?? null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    startTransition(async () => {
      applyLocalShopping({ type: "add", item: draft });
      try {
        const row = await addShoppingItem({ id, name, created_by: actorId });
        setShoppingItems((prev) => upsertById(prev, row, "start"));
      } catch {
        setLocalShoppingError("No se pudo añadir el producto. Se ha deshecho.");
      }
    });
  };

  const handleCompleteShopping = (id: string) => {
    if (onCompleteShoppingItem) {
      onCompleteShoppingItem(id);
      return;
    }
    setLocalShoppingError("");
    startTransition(async () => {
      applyLocalShopping({ type: "patch", id, patch: { completed: true, pending: true } });
      try {
        await completeShoppingItem(id);
        setShoppingItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: true } : item)));
      } catch {
        setLocalShoppingError("No se pudo completar la compra. Se ha deshecho.");
      }
    });
  };

  const handleDeleteShopping = (id: string) => {
    if (onDeleteShoppingItem) {
      onDeleteShoppingItem(id);
      return;
    }
    setLocalShoppingError("");
    startTransition(async () => {
      applyLocalShopping({ type: "remove", id });
      try {
        await deleteShoppingItem(id);
        setShoppingItems((prev) => prev.filter((item) => item.id !== id));
      } catch {
        setLocalShoppingError("No se pudo eliminar el producto. Se ha deshecho.");
      }
    });
  };

  const handleReactivateShopping = (id: string) => {
    if (onReactivateShoppingItem) {
      onReactivateShoppingItem(id);
      return;
    }
    setLocalShoppingError("");
    startTransition(async () => {
      applyLocalShopping({ type: "patch", id, patch: { completed: false, pending: true } });
      try {
        await reactivateShoppingItem(id);
        setShoppingItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: false } : item)));
      } catch {
        setLocalShoppingError("No se pudo reactivar el producto. Se ha deshecho.");
      }
    });
  };

  const notesToSave = isCompras || isDataPanel ? (domain.notes ?? []) : notes;
  const safeMembers = members ?? [];
  const ownerOptions = useMemo(() => [...safeMembers, "Sin asignar"], [safeMembers]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Dominio ${domain.name}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8100,
        background: "#090b10",
        color: "#e4e6ed",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {domain.emoji} {domain.name}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar dominio"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            width: 36,
            height: 36,
          }}
        >
          ×
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
        <section style={cardStyle}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Lo lleva:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ownerOptions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setOwner(name)}
                style={{
                  borderRadius: 999,
                  border: owner === name ? "1px solid #9B8FE8" : "1px solid rgba(255,255,255,0.15)",
                  background: owner === name ? "rgba(155,143,232,0.2)" : "rgba(255,255,255,0.05)",
                  color: "#e4e6ed",
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Estado</p>
          <input
            value={stateText}
            onChange={(e) => setStateText(e.target.value)}
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#e4e6ed",
              padding: "8px 10px",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </section>

        {isDataPanel ? (
          <section style={cardStyle}>
            {isLimpiezaDomainName(domain.name) ? <CleaningDomainPanel profiles={profiles} /> : null}
            {isSuenoDomainName(domain.name) ? <SleepDomainPanel profiles={profiles} /> : null}
            {isColegioDomainName(domain.name) ? <SchoolDomainPanel /> : null}
          </section>
        ) : isCompras ? (
          <section style={cardStyle}>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Pendientes</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newShoppingName}
                onChange={(e) => setNewShoppingName(e.target.value)}
                placeholder="Añadir item"
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#e4e6ed",
                  padding: "8px 10px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handleAddShoppingItem()}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: "#4CC9A0",
                  color: "#0a1a14",
                  padding: "0 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Añadir
              </button>
            </div>
            {shownShoppingError ? (
              <p role="alert" style={{ margin: "0 0 8px", fontSize: 12, color: "#fecaca" }}>
                {shownShoppingError}
              </p>
            ) : null}
            {shoppingLoading ? (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Cargando lista…</p>
            ) : pendingShopping.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>No hay items pendientes.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingShopping.map((item) => (
                  <li
                    key={item.id}
                    aria-busy={item.pending ? true : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      padding: "7px 9px",
                      opacity: item.pending ? 0.55 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13 }}>
                        {item.name}
                        {item.quantity ? ` (${item.quantity})` : ""}
                      </span>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                        {(item.category ?? "sin categoría")} · {(item.priority ?? "sin prioridad")}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => void handleCompleteShopping(item.id)}
                        style={{
                          border: "none",
                          borderRadius: 8,
                          background: "#4CC9A0",
                          color: "#0a1a14",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteShopping(item.id)}
                        style={{
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          background: "transparent",
                          color: "#e4e6ed",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section style={cardStyle}>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Notas / Tareas</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Añadir item"
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#e4e6ed",
                  padding: "8px 10px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const value = newNote.trim();
                  if (!value) return;
                  setNotes((prev) => [...prev, value]);
                  setNewNote("");
                }}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: "#4CC9A0",
                  color: "#0a1a14",
                  padding: "0 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Añadir
              </button>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {notes.map((note, i) => (
                <li
                  key={`${note}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    padding: "7px 9px",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{note}</span>
                  <button
                    type="button"
                    onClick={() => setNotes((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "rgba(228,230,237,0.65)",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    aria-label="Eliminar nota"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={cardStyle}>
          {isCompras ? (
            completedShopping.length === 0 ? (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Frecuentes</p>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Sin frecuentes todavía.</p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Frecuentes</p>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {completedShopping.map((item) => {
                    const text = `${item.name}${item.quantity ? ` (${item.quantity})` : ""}`;
                    return (
                      <li
                        key={item.id}
                        aria-busy={item.pending ? true : undefined}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(228,230,237,0.92)",
                          padding: "4px 6px 4px 10px",
                          maxWidth: "100%",
                          opacity: item.pending ? 0.55 : 1,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {text}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleReactivateShopping(item.id)}
                          aria-label={`Reactivar ${item.name}`}
                          title="Reactivar"
                          style={{
                            border: "none",
                            borderRadius: 999,
                            width: 22,
                            height: 22,
                            background: "rgba(76,201,160,0.2)",
                            color: "#4CC9A0",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteShopping(item.id)}
                          aria-label={`Eliminar ${item.name}`}
                          title="Eliminar definitivamente"
                          style={{
                            border: "none",
                            borderRadius: 999,
                            width: 22,
                            height: 22,
                            background: "rgba(224,85,85,0.16)",
                            color: "#E05555",
                            cursor: "pointer",
                            fontSize: 12,
                            lineHeight: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          🗑
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )
          ) : history.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Sin registros aún</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {history
                .slice()
                .reverse()
                .map((entry) => {
                  const d = new Date(entry.at);
                  const fecha = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES");
                  const hora = Number.isNaN(d.getTime())
                    ? ""
                    : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
                  return (
                    <li
                      key={entry.id}
                      style={{
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        padding: "8px 9px",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                          {fecha} {hora}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#e4e6ed", whiteSpace: "pre-wrap" }}>
                          {entry.text}
                        </p>
                      </div>
                      {historyReadOnly ? null : (
                        <button
                          type="button"
                          onClick={() => removeHistoryEntry(entry.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "rgba(228,230,237,0.65)",
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          aria-label="Eliminar entrada del historial"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      </main>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <button
          type="button"
          onClick={() =>
            void Promise.resolve(onSave({ owner, state: stateText.trim(), notes: notesToSave })).then(() =>
              emitKoreUpdate(["domains"]),
            )
          }
          style={{
            width: "100%",
            borderRadius: 10,
            border: "none",
            background: "#4CC9A0",
            color: "#0a1a14",
            padding: "11px 12px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Guardar
        </button>
      </footer>
    </div>
  );
}
