"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

/** Fondo animado: tres ondas sinusoidales finas (canvas nativo). */
function LoginSineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let start = 0;

    const lines = [
      { color: "#4CC9A0", opacity: 0.35, amp: 0.072, kx: 0.013, speed: 0.85, y0: 0.36 },
      { color: "#9B8FE8", opacity: 0.3, amp: 0.058, kx: 0.018, speed: -0.72, y0: 0.5 },
      { color: "#4CC9A0", opacity: 0.2, amp: 0.046, kx: 0.021, speed: 0.55, y0: 0.64 },
    ];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = (now: number) => {
      if (!start) start = now;
      const t = (now - start) * 0.00009;

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 0.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      for (const L of lines) {
        ctx.strokeStyle = L.color;
        ctx.globalAlpha = L.opacity;
        ctx.beginPath();
        const baseY = height * L.y0;
        const amp = height * L.amp;
        const phase = t * L.speed;
        for (let x = 0; x <= width; x += 1.25) {
          const y = baseY + amp * Math.sin(x * L.kx + phase);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

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
        backgroundColor: "#0d1117",
        color: "#e4e6ed",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <LoginSineCanvas />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <section
          style={{
            minHeight: "56dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 20px 18px",
            textAlign: "center",
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
            <circle cx="62" cy="80" r="44" stroke="#4CC9A0" strokeWidth="1.8" fill="none" />
            <circle cx="98" cy="80" r="44" stroke="#9B8FE8" strokeWidth="1.8" fill="none" />
            <circle cx="82" cy="80" r="5" fill="white" opacity="0.95" />
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
      </div>
    </main>
  );
}
