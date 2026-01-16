// src/components/UI/AppErrorBoundary.jsx
import React from "react";

function safeString(v) {
  try {
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.message || v.name || "Error";
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function buildDebugPayload({ error, info, extra }) {
  return {
    at: new Date().toISOString(),
    href: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    error: {
      name: error?.name,
      message: error?.message || safeString(error),
      stack: error?.stack,
    },
    react: {
      componentStack: info?.componentStack,
    },
    extra: extra || null,
  };
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, extra: null, copied: false };
  }

  componentDidCatch(error, info) {
    // Error dentro de React render/lifecycle
    // Guardamos todo para mostrarlo y poder copiarlo
    this.setState({ error, info, extra: null });
    // Log útil en prod
    // eslint-disable-next-line no-console
    console.error("[APP CRASH]", error, info);
  }

  componentDidMount() {
    // Errores fuera de React (muy típico en producción)
    window.addEventListener("error", this.onWindowError);
    window.addEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onWindowError);
    window.removeEventListener("unhandledrejection", this.onUnhandledRejection);
  }

  onWindowError = (ev) => {
    const err = ev?.error || new Error(ev?.message || "window.error");
    this.setState({
      error: err,
      info: null,
      extra: { type: "window.error", message: ev?.message, filename: ev?.filename, lineno: ev?.lineno, colno: ev?.colno },
    });
  };

  onUnhandledRejection = (ev) => {
    const reason = ev?.reason;
    const err = reason instanceof Error ? reason : new Error(safeString(reason) || "unhandledrejection");
    this.setState({
      error: err,
      info: null,
      extra: { type: "unhandledrejection", reason: safeString(reason) },
    });
  };

  copyDebug = async () => {
    const payload = buildDebugPayload(this.state);
    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 1500);
    } catch {
      // fallback: prompt
      window.prompt("Copia esto:", text);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const payload = buildDebugPayload(this.state);
    const pretty = JSON.stringify(payload, null, 2);

    return (
      <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e5e7eb", padding: 22 }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h1 style={{ fontSize: 44, margin: "0 0 10px" }}>Se ha producido un error</h1>
          <p style={{ opacity: 0.85, marginTop: 0 }}>
            Pulsa el botón y pégamelo aquí. Lo arreglamos rápido.
          </p>

          <button
            onClick={this.copyDebug}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: this.state.copied ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
            type="button"
          >
            {this.state.copied ? "✅ Copiado" : "Copiar error (debug)"}
          </button>

          <div style={{ height: 12 }} />

          <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
              <strong>Mensaje:</strong>{" "}
              {this.state.error?.message ? this.state.error.message : safeString(this.state.error)}
            </div>

            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35 }}>
              {pretty}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
