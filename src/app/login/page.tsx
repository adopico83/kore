"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase = getBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      console.log("AUTH RESULT:", authError);

      if (authError) {
        setError(authError.message || "No se pudo iniciar sesión.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Ha ocurrido un error inesperado. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        backgroundColor: "#090b10",
        color: "#e4e6ed",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 1440 960"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <defs>
          <pattern id="kore-login-diag-a" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <line x1="0" y1="0" x2="0" y2="34" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
          <pattern id="kore-login-diag-b" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <line x1="0" y1="0" x2="0" y2="34" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <radialGradient id="kore-login-green" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 120) rotate(0) scale(520 380)">
            <stop offset="0" stopColor="#4CC9A0" stopOpacity="0.08" />
            <stop offset="1" stopColor="#4CC9A0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kore-login-purple" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1260 100) rotate(0) scale(520 380)">
            <stop offset="0" stopColor="#9B8FE8" stopOpacity="0.08" />
            <stop offset="1" stopColor="#9B8FE8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1440" height="960" fill="#090b10" />
        <rect width="1440" height="960" fill="url(#kore-login-diag-a)" />
        <rect width="1440" height="960" fill="url(#kore-login-diag-b)" />
        <rect width="1440" height="960" fill="url(#kore-login-green)" />
        <rect width="1440" height="960" fill="url(#kore-login-purple)" />
      </svg>

      <section
        style={{
          minHeight: "56dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px 18px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 160 160"
          fill="none"
          aria-hidden
          style={{ width: "min(55vw, 220px)", height: "auto" }}
        >
          <rect width="160" height="160" rx="36" fill="#0b0d13" />
          <circle cx="62" cy="80" r="44" stroke="#4CC9A0" strokeWidth="1.8" fill="none" />
          <circle cx="98" cy="80" r="44" stroke="#9B8FE8" strokeWidth="1.8" fill="none" />
          <circle cx="82" cy="80" r="5" fill="white" opacity="0.95" />
          <circle cx="82" cy="80" r="14" fill="white" opacity="0.05" />
        </svg>
        <h1
          style={{
            margin: "20px 0 6px",
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: "clamp(42px, 11vw, 62px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: "#e4e6ed",
          }}
        >
          Kore
        </h1>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-dm-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "clamp(12px, 3.4vw, 14px)",
            letterSpacing: "0.16em",
            textTransform: "lowercase",
            color: "rgba(228,230,237,0.7)",
          }}
        >
          tu hogar organizado
        </p>
      </section>

      <section
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          padding: "0 16px 32px",
          boxSizing: "border-box",
          position: "relative",
          zIndex: 1,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(22,26,34,0.92)",
            boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              minHeight: 46,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#121622",
              color: "#e4e6ed",
              padding: "11px 12px",
              fontSize: 16,
              fontFamily: "var(--font-dm-sans), sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              minHeight: 46,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#121622",
              color: "#e4e6ed",
              padding: "11px 12px",
              fontSize: 16,
              fontFamily: "var(--font-dm-sans), sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              minHeight: 46,
              borderRadius: 10,
              border: "none",
              background: "#4CC9A0",
              color: "#0a1a14",
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 0 18px rgba(76,201,160,0.35)",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          {error ? (
            <p
              style={{
                margin: "4px 2px 0",
                fontSize: 13,
                color: "#fca5a5",
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}
            >
              {error}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
