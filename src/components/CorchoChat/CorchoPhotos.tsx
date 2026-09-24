"use client";

import { X } from "lucide-react";
import type { MouseEvent } from "react";

export function CorchoPhotoGrid({ urls, onOpen }: { urls: string[]; onOpen: (url: string) => void }) {
  if (urls.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {urls.map((url) => (
        <button
          key={url}
          type="button"
          onClick={() => onOpen(url)}
          aria-label="Ver foto a tamaño completo"
          style={{
            padding: 0,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            overflow: "hidden",
            background: "#0c0e14",
            cursor: "pointer",
            lineHeight: 0,
          }}
        >
          {/* URL firmada de Storage: el host cambia con el token y no cabe en next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
        </button>
      ))}
    </div>
  );
}

export function CorchoPhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto del corcho"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar foto"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.45)",
          color: "#fff",
          padding: 8,
          cursor: "pointer",
          lineHeight: 0,
        }}
      >
        <X width={20} height={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto del corcho"
        onClick={stop}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
      />
    </div>
  );
}
