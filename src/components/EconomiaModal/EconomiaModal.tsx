"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { addExpense, ANDER_ID, deleteExpense, getExpenses, LEIRE_ID, type Expense } from "@/lib/kore-db";
import { emitKoreUpdate } from "@/lib/kore-events";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

export const LS_KORE_EXPENSES = "kore_expenses";

export type ExpenseItem = {
  id: string;
  desc: string;
  amount: number;
  category: "comida" | "hogar" | "salud" | "ocio" | "transporte" | "otros";
  paidBy: "Ander" | "Leire";
  shared: boolean;
  at: string;
};

const categoryEmoji: Record<ExpenseItem["category"], string> = {
  comida: "🍽️",
  hogar: "🏠",
  salud: "🏥",
  ocio: "🎯",
  transporte: "🚗",
  otros: "🧾",
};

function toCurrency(value: number) {
  return `${value < 0 ? "-" : ""}${Math.abs(value).toFixed(2).replace(".", ",")}€`;
}

function readExpenses(): ExpenseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KORE_EXPENSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExpenses(items: ExpenseItem[]) {
  try {
    localStorage.setItem(LS_KORE_EXPENSES, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function expenseRowToItem(row: Expense): ExpenseItem {
  const allowed: ExpenseItem["category"][] = ["comida", "hogar", "salud", "ocio", "transporte", "otros"];
  const category = (allowed.includes(row.category as ExpenseItem["category"])
    ? row.category
    : "otros") as ExpenseItem["category"];
  return {
    id: row.id,
    desc: row.description,
    amount: row.amount,
    category,
    paidBy: row.payer_id === LEIRE_ID ? "Leire" : "Ander",
    shared: row.is_shared,
    at: row.created_at,
  };
}

export type EconomiaModalProps = {
  onClose: () => void;
  onChange?: (items: ExpenseItem[]) => void;
};

export function EconomiaModal({ onClose, onChange }: EconomiaModalProps) {
  useEscapeKey(onClose);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [items, setItems] = useState<ExpenseItem[]>(() =>
    readExpenses().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseItem["category"]>("hogar");
  const [paidBy, setPaidBy] = useState<ExpenseItem["paidBy"]>("Ander");
  const [shared, setShared] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getExpenses();
        if (cancelled) return;
        const mapped = rows.map(expenseRowToItem).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setItems(mapped);
        onChangeRef.current?.(mapped);
        return;
      } catch {
        /* Supabase no disponible */
      }
      if (cancelled) return;
      const fallback = readExpenses().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(fallback);
      onChangeRef.current?.(fallback);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const balance = useMemo(() => {
    const now = new Date();
    const monthItems = items.filter((it) => {
      const d = new Date(it.at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const totalMes = monthItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const sharedItems = items.filter((it) => it.shared);
    const totalShared = sharedItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const paidAnder = sharedItems
      .filter((it) => it.paidBy === "Ander")
      .reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const paidLeire = sharedItems
      .filter((it) => it.paidBy === "Leire")
      .reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const half = totalShared / 2;
    return {
      totalMes,
      debeAnder: Math.max(0, half - paidAnder),
      debeLeire: Math.max(0, half - paidLeire),
    };
  }, [items]);

  const updateItemsLocal = (next: ExpenseItem[]) => {
    const sorted = next.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(sorted);
    saveExpenses(sorted);
    onChange?.(sorted);
  };

  const addItem = async () => {
    const cleanDesc = desc.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!cleanDesc) return;
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    const payer_id = paidBy === "Leire" ? LEIRE_ID : ANDER_ID;
    try {
      const created = await addExpense({
        payer_id,
        amount: Math.abs(parsedAmount),
        category,
        description: cleanDesc,
        is_shared: shared,
        source: "manual",
      });
      const item = expenseRowToItem(created);
      const next = [item, ...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(next);
      onChange?.(next);
      emitKoreUpdate(["expenses"]);
    } catch {
      const item: ExpenseItem = {
        id: crypto.randomUUID?.() ?? `exp_${Date.now()}`,
        desc: cleanDesc,
        amount: Math.abs(parsedAmount),
        category,
        paidBy,
        shared,
        at: new Date().toISOString(),
      };
      const next = [item, ...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      updateItemsLocal(next);
    }
    setDesc("");
    setAmount("");
    setCategory("hogar");
    setPaidBy("Ander");
    setShared(true);
  };

  const removeItem = async (id: string) => {
    try {
      await deleteExpense(id);
      const next = items.filter((it) => it.id !== id);
      setItems(next);
      onChange?.(next);
      emitKoreUpdate(["expenses"]);
    } catch {
      updateItemsLocal(items.filter((it) => it.id !== id));
    }
  };

  const card: CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#161a22",
    padding: 12,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Economía del hogar"
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
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>💶 Economía del hogar</p>
        <button type="button" onClick={onClose} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", width: 36, height: 36 }}>
          ×
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.6)" }}>Total mes</p>
            <p style={{ margin: "6px 0 0", color: "#E05555", fontWeight: 700 }}>{toCurrency(balance.totalMes)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.6)" }}>Debe Ander</p>
            <p style={{ margin: "6px 0 0", color: "#4CC9A0", fontWeight: 700 }}>{toCurrency(balance.debeAnder)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.6)" }}>Debe Leire</p>
            <p style={{ margin: "6px 0 0", color: "#4CC9A0", fontWeight: 700 }}>{toCurrency(balance.debeLeire)}</p>
          </div>
        </section>

        <section style={card}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Añadir gasto</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px", boxSizing: "border-box" }} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importe" inputMode="decimal" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#e4e6ed", padding: "8px 10px", boxSizing: "border-box" }} />
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseItem["category"])} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "#e4e6ed", color: "#111318", padding: "8px 10px", boxSizing: "border-box" }}>
              <option value="comida" style={{ color: "#111318", background: "#e4e6ed" }}>Comida</option>
              <option value="hogar" style={{ color: "#111318", background: "#e4e6ed" }}>Hogar</option>
              <option value="salud" style={{ color: "#111318", background: "#e4e6ed" }}>Salud</option>
              <option value="ocio" style={{ color: "#111318", background: "#e4e6ed" }}>Ocio</option>
              <option value="transporte" style={{ color: "#111318", background: "#e4e6ed" }}>Transporte</option>
              <option value="otros" style={{ color: "#111318", background: "#e4e6ed" }}>Otros</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              {(["Ander", "Leire"] as const).map((person) => (
                <button key={person} type="button" onClick={() => setPaidBy(person)} style={{ flex: 1, borderRadius: 999, border: paidBy === person ? "1px solid #4CC9A0" : "1px solid rgba(255,255,255,0.15)", background: paidBy === person ? "rgba(76,201,160,0.2)" : "rgba(255,255,255,0.04)", color: "#e4e6ed", padding: "6px 8px", cursor: "pointer" }}>
                  {person}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShared((v) => !v)} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: shared ? "rgba(76,201,160,0.2)" : "rgba(255,255,255,0.04)", color: "#e4e6ed", padding: "8px 10px", textAlign: "left", cursor: "pointer" }}>
              {shared ? "Compartido: Sí" : "Compartido: No (personal)"}
            </button>
            <button type="button" onClick={() => void addItem()} style={{ borderRadius: 8, border: "none", background: "#4CC9A0", color: "#0a1a14", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
              Añadir
            </button>
          </div>
        </section>

        <section style={card}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Gastos</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => {
              const d = new Date(item.at);
              const fecha = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES");
              const hora = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <li key={item.id} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "#e4e6ed", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {categoryEmoji[item.category]} {item.desc} · <span style={{ color: "rgba(228,230,237,0.6)" }}>{fecha} {hora}</span> · <span style={{ color: "#E05555" }}>{toCurrency(item.amount)}</span>
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>
                      Paga: {item.paidBy} · {item.shared ? "Compartido" : "Personal"}
                    </p>
                  </div>
                  <button type="button" onClick={() => void removeItem(item.id)} style={{ border: "none", background: "transparent", color: "rgba(228,230,237,0.65)", cursor: "pointer", flexShrink: 0 }}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
