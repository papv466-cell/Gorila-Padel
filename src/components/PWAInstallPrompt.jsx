import { useEffect, useMemo, useState } from "react";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isInStandaloneMode() {
  // iOS Safari standalone
  // Android Chrome standalone (display-mode)
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const ios = useMemo(() => isIos(), []);
  const standalone = useMemo(() => (typeof window !== "undefined" ? isInStandaloneMode() : false), []);

  useEffect(() => {
    if (standalone) return; // ya instalada

    // si el usuario lo cerró, no lo molestamos en esta sesión
    try {
      const v = sessionStorage.getItem("gp:pwaPromptDismissed");
      if (v === "1") setDismissed(true);
    } catch {}

    const handler = (e) => {
      // Android/Chrome: esto permite enseñar un botón “Instalar”
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [standalone]);

  if (standalone) return null;
  if (dismissed) return null;

  const showAndroidInstall = !!deferredPrompt;
  const showIosHelp = ios && !showAndroidInstall; // iOS no tiene beforeinstallprompt

  if (!showAndroidInstall && !showIosHelp) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  }

  function handleClose() {
    setDismissed(true);
    try {
      sessionStorage.setItem("gp:pwaPromptDismissed", "1");
    } catch {}
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 99999,
        background: "#0b0f14",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        padding: 12,
        boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        display: "grid",
        gap: 8,
        maxWidth: 520,
        margin: "0 auto",
      }}
      role="dialog"
      aria-label="Instalar Gorila Pádel"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Instala Gorila Pádel</div>
          {showAndroidInstall ? (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Se abre más rápido y podrás recibir notificaciones.
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              En iPhone: comparte y “Añadir a pantalla de inicio”.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "#fff",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Cerrar
        </button>
      </div>

      {showIosHelp ? (
        <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>
          <div>1) Abre esto en <strong>Safari</strong></div>
          <div>2) Pulsa <strong>Compartir</strong> (cuadrado con flecha)</div>
          <div>3) Elige <strong>“Añadir a pantalla de inicio”</strong></div>
        </div>
      ) : null}

      {showAndroidInstall ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={handleInstall}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "#fff",
              color: "#0b0f14",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Instalar
          </button>
        </div>
      ) : null}
    </div>
  );
}
