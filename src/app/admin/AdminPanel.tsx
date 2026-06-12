"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminFamilyRow, AdminStats } from "@/lib/kore-db";

import { deleteFamily } from "./actions";

type Props = {
  stats: AdminStats;
  families: AdminFamilyRow[];
};

const cardStyle = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#161a22",
  padding: 16,
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminPanel({ stats, families }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onDelete = (familyId: string, familyName: string) => {
    const ok = window.confirm(
      `¿Eliminar la familia "${familyName}" y TODOS sus datos?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setError(null);
    setDeletingId(familyId);
    startTransition(async () => {
      try {
        await deleteFamily(familyId);
        setDeletingId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar la familia.");
        setDeletingId(null);
      }
    });
  };

  return (
    <>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Familias
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#4CC9A0" }}>{stats.totalFamilies}</p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Usuarios
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#9B8FE8" }}>{stats.totalUsers}</p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(228,230,237,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Push activas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "#EF9F27" }}>{stats.totalPushSubscriptions}</p>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Familias registradas</h2>
        </div>

        {families.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 14, color: "rgba(228,230,237,0.55)" }}>No hay familias.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(228,230,237,0.55)" }}>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Owner</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Creada</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Miembros</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Invite</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {families.map((f) => {
                  const isDeleting = pending && deletingId === f.id;
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{f.name}</td>
                      <td style={{ padding: "10px 12px" }}>{f.ownerName}</td>
                      <td style={{ padding: "10px 12px" }}>{formatDate(f.createdAt)}</td>
                      <td style={{ padding: "10px 12px" }}>{f.memberCount}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                        {f.inviteCode?.trim() || "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDelete(f.id, f.name)}
                          style={{
                            border: "none",
                            borderRadius: 8,
                            background: isDeleting ? "rgba(224,85,85,0.35)" : "rgba(224,85,85,0.2)",
                            color: "#E05555",
                            padding: "6px 10px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: pending ? "wait" : "pointer",
                          }}
                        >
                          {isDeleting ? "Eliminando…" : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#E05555" }} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
