"use client";

import { useCallback, useEffect, useState } from "react";

import {
  completeShoppingItem,
  deleteShoppingItem,
  getShoppingItems,
  type ShoppingItemRow,
} from "@/lib/kore-db";
import { emitKoreUpdate } from "@/lib/kore-events";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

type ShoppingModalProps = {
  onClose: () => void;
};

export function ShoppingModal({ onClose }: ShoppingModalProps) {
  useEscapeKey(onClose);
  const [items, setItems] = useState<ShoppingItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getShoppingItems();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleComplete = async (id: string) => {
    try {
      await completeShoppingItem(id);
      emitKoreUpdate(["shopping_items"]);
      await loadItems();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShoppingItem(id);
      emitKoreUpdate(["shopping_items"]);
      await loadItems();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lista de la compra"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8200,
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
          padding: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🛒 Compras</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar compras"
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

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {loading ? (
          <p style={{ margin: 0, color: "rgba(228,230,237,0.65)" }}>Cargando items...</p>
        ) : items.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(228,230,237,0.65)" }}>No hay items en la lista.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      textDecoration: item.completed ? "line-through" : "none",
                      opacity: item.completed ? 0.6 : 1,
                    }}
                  >
                    {item.name}
                    {item.quantity ? ` (${item.quantity})` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                    {(item.category ?? "sin categoría")} · {(item.priority ?? "sin prioridad")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!item.completed ? (
                    <button
                      type="button"
                      onClick={() => void handleComplete(item.id)}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        background: "#4CC9A0",
                        color: "#0a1a14",
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Completar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    style={{
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      background: "transparent",
                      color: "#e4e6ed",
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
