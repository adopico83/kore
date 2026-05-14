"use client";

import type { CSSProperties } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createFamilyForCurrentUserAction, joinFamilyWithInviteForCurrentUserAction } from "@/lib/actions/family-setup";

export function OnboardingFamilyGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get("invite");
  const [familyName, setFamilyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [submitting, setSubmitting] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (inviteFromUrl) {
      setInviteCode(inviteFromUrl);
    }
  }, [inviteFromUrl]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting("create");
    setError("");
    const res = await createFamilyForCurrentUserAction(familyName, ownerName);
    setSubmitting(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting("join");
    setError("");
    const res = await joinFamilyWithInviteForCurrentUserAction(inviteCode, memberName);
    setSubmitting(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <section
      style={{
        width: "min(760px, 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        background: "rgba(22,26,34,0.92)",
        padding: 16,
        boxShadow: "0 16px 36px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Antes de configurar Kore</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "rgba(228,230,237,0.78)", lineHeight: 1.45 }}>
          Crea un hogar nuevo o únete con el código que te han pasado por WhatsApp (formato{" "}
          <span style={{ fontWeight: 700 }}>KORE-XXXX</span>).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <form onSubmit={onCreate} style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Crear familia nueva</p>
          <input
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="Nombre del hogar"
            required
            style={inputStyle}
          />
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Tu nombre" required style={inputStyle} />
          <button type="submit" disabled={submitting !== null} style={btnPrimary}>
            {submitting === "create" ? "Creando…" : "Crear hogar"}
          </button>
        </form>

        <form onSubmit={onJoin} style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Unirse con código</p>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="KORE-A3X9"
            required
            style={inputStyle}
            autoCapitalize="characters"
          />
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Tu nombre" required style={inputStyle} />
          <button type="submit" disabled={submitting !== null} style={btnSecondary}>
            {submitting === "join" ? "Uniendo…" : "Unirme"}
          </button>
        </form>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>{error}</p>
      ) : null}
    </section>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "#121622",
  color: "#e4e6ed",
  padding: "10px 12px",
  fontSize: 16,
  outline: "none",
};

const btnPrimary: CSSProperties = {
  minHeight: 44,
  border: "none",
  borderRadius: 10,
  background: "#4CC9A0",
  color: "#0a1a14",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  minHeight: 44,
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.06)",
  color: "#e4e6ed",
  fontWeight: 700,
  cursor: "pointer",
};
