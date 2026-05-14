"use client";

import { Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getKoreNotes } from "@/lib/actions/corcho";
import type { Profile } from "@/lib/kore-db";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

type FeedMessage = {
  id: string;
  name: string;
  initial: string;
  avatarBorder: string;
  at: string;
  text: string;
  audioUrl?: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { hora: "", fecha: "" };
  return {
    hora: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false }),
    fecha: d.toLocaleDateString("es-ES"),
  };
}

export type CorchoHistorialProps = {
  onClose: () => void;
  currentUserId: string;
  profiles: Profile[];
};

export function CorchoHistorial({ onClose, currentUserId, profiles }: CorchoHistorialProps) {
  useEscapeKey(onClose);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getKoreNotes();
        if (cancelled) return;
        const mapped: FeedMessage[] = rows.map((row) => {
          const isMe = row.sender_id === currentUserId;
          const profile = profiles.find((p) => p.id === row.sender_id);
          const name = profile?.name?.trim() || "Familiar";
          const initial = (name.charAt(0) || "?").toUpperCase();
          return {
            id: row.id,
            name,
            initial,
            avatarBorder: isMe ? "#10b981" : "#f59e0b",
            at: row.created_at ?? "",
            text: String(row.content ?? ""),
          };
        });
        setFeed(mapped);
      } catch {
        if (!cancelled) setFeed([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, profiles]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="El Corcho"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8050,
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
          padding: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>El Corcho</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar historial del corcho"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            padding: 8,
            lineHeight: 0,
          }}
        >
          <X width={20} height={20} />
        </button>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        {feed.length === 0 ? (
          <p style={{ margin: 0, color: "rgba(228,230,237,0.6)", fontSize: 14 }}>Sin mensajes aún</p>
        ) : (
          feed.map((msg) => {
            const { hora, fecha } = formatDateTime(msg.at);
            const hasAudio = Boolean(msg.audioUrl);
            return (
              <article
                key={msg.id}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#161a22",
                  padding: 12,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      border: `2px solid ${msg.avatarBorder}`,
                      background: "#12151c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {msg.initial}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#e4e6ed" }}>
                    <span style={{ fontWeight: 700 }}>{msg.name}</span>
                    <span style={{ color: "rgba(228,230,237,0.6)" }}> · {hora} · {fecha}</span>
                  </p>
                </div>

                {hasAudio ? (
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPlayingId((prev) => (prev === msg.id ? null : msg.id))}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        border: "none",
                        background: "#4CC9A0",
                        color: "#0a1a14",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      aria-label="Reproducir audio"
                    >
                      <Play width={14} height={14} fill="currentColor" />
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 18 }}>
                      {[4, 9, 6, 11, 7, 10, 5, 8, 6, 10].map((h, i) => (
                        <span
                          key={`${msg.id}-${i}`}
                          style={{
                            width: 2,
                            borderRadius: 999,
                            height: h,
                            background: "#9B8FE8",
                            opacity: 0.9,
                          }}
                        />
                      ))}
                    </div>
                    {playingId === msg.id && msg.audioUrl ? (
                      <audio controls autoPlay src={msg.audioUrl} style={{ width: "100%" }} />
                    ) : null}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", color: "#e4e6ed" }}>
                    {msg.text}
                  </p>
                )}
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
