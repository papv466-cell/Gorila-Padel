import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastCtx = createContext(null);

function ToastItem({ t, onClose }) {
  const bg =
    t.type === "success" ? "#16a34a" :
    t.type === "error" ? "#dc2626" :
    t.type === "warning" ? "#f59e0b" :
    "#111";

  return (
    <div
      style={{
        background: bg,
        color: "#fff",
        padding: "12px 12px",
        borderRadius: 12,
        boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: t.onClick ? "pointer" : "default",
      }}
      onClick={() => {
        if (t.onClick) t.onClick();
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title ? <div style={{ fontWeight: 900, marginBottom: 4 }}>{t.title}</div> : null}
        <div style={{ fontSize: 13, opacity: 0.95, wordBreak: "break-word" }}>{t.message}</div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(t.id);
        }}
        style={{
          border: 0,
          background: "rgba(255,255,255,0.18)",
          color: "#fff",
          width: 28,
          height: 28,
          borderRadius: 10,
          cursor: "pointer",
          fontWeight: 900,
          lineHeight: "28px",
        }}
        aria-label="Cerrar"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((t) => {
    const id = idRef.current++;
    const toast = {
      id,
      type: t.type || "info",
      title: t.title || "",
      message: t.message || "",
      duration: Number.isFinite(t.duration) ? t.duration : 3000,
      onClick: typeof t.onClick === "function" ? t.onClick : null,
    };

    setToasts((prev) => [...prev, toast]);

    if (toast.duration > 0) {
      window.setTimeout(() => remove(id), toast.duration);
    }

    return id;
  }, [remove]);

  const api = useMemo(() => {
    return {
      show: (message, opts = {}) => push({ ...opts, message, type: opts.type || "info" }),
      info: (message, opts = {}) => push({ ...opts, message, type: "info" }),
      success: (message, opts = {}) => push({ ...opts, message, type: "success" }),
      error: (message, opts = {}) => push({ ...opts, message, type: "error" }),
      warning: (message, opts = {}) => push({ ...opts, message, type: "warning" }),
    };
  }, [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* Contenedor fijo arriba */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 999999,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          {toasts.map((t) => (
            <div key={t.id} style={{ width: "min(520px, 100%)", pointerEvents: "auto" }}>
              <ToastItem t={t} onClose={remove} />
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // evita crashear si se usa sin Provider
    return {
      show: () => {},
      info: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
    };
  }
  return ctx;
}
