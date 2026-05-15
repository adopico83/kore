"use client";

import { useEffect } from "react";

/**
 * Registra el service worker sin bloquear el render; errores se ignoran (p. ej. HTTP sin SW).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* modo preview, http sin SW, etc. */
    });
  }, []);
  return null;
}
