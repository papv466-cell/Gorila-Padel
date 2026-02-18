import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info) {
    console.error("[APP CRASH]", error);
    console.error("[APP CRASH INFO]", info);
    this.setState({ error, info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Se ha producido un error</h2>

        <p style={{ margin: "8px 0", opacity: 0.8 }}>
          Copia/pega esto y me lo mandas:
        </p>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#0b0f14",
            color: "#fff",
            padding: 12,
            borderRadius: 10,
            fontSize: 12,
            overflow: "auto",
            maxHeight: "55vh",
          }}
        >
{`Mensaje: ${error?.message ?? "—"}

Stack:
${error?.stack ?? "—"}

Component stack:
${info?.componentStack ?? "—"}`}
        </pre>

        <button
          type="button"
          className="btn"
          onClick={() => window.location.reload()}
          style={{ marginTop: 12 }}
        >
          Recargar
        </button>
      </div>
    );
  }
}
