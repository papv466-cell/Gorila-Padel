import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // esto SIEMPRE lo verás en consola también
    console.error("[APP CRASH]", error);
    console.error("[APP CRASH INFO]", info);
    this.setState({ info });
  }

  async copyDebug() {
    const { error, info } = this.state;

    const payload = {
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
      componentStack: info?.componentStack ?? null,
      time: new Date().toISOString(),
    };

    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado ✅ Pégalo aquí y lo arreglamos.");
    } catch {
      // fallback si el portapapeles falla
      const w = window.open("", "_blank");
      w.document.write(`<pre>${text.replace(/</g, "&lt;")}</pre>`);
      w.document.close();
    }
  }

  render() {
    const { error, info } = this.state;

    if (!error) return this.props.children;

    const message = error?.message ?? String(error);

    return (
      <div style={{ minHeight: "100vh", padding: 24, background: "#0b0f14", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 42 }}>Se ha producido un error</h1>

        <p style={{ marginTop: 12, opacity: 0.9 }}>
          Pulsa el botón para copiar el error y pégamelo aquí. Con eso lo arreglamos rápido.
        </p>

        <button
          type="button"
          onClick={() => this.copyDebug()}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Copiar error (debug)
        </button>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "rgba(0,0,0,0.35)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Mensaje</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message}</pre>

          <div style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>Stack</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", opacity: 0.9 }}>
            {error?.stack ?? "(sin stack)"}
          </pre>

          <div style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>Component stack</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", opacity: 0.9 }}>
            {info?.componentStack ?? "(sin component stack)"}
          </pre>
        </div>
      </div>
    );
  }
}
