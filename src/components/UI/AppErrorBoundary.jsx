import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[APP CRASH]", error);
    console.error("[APP CRASH INFO]", info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ marginTop: 0 }}>Se ha producido un error</h1>
        <p style={{ opacity: 0.8 }}>
          Copia/pega esto y me lo mandas, y lo arreglamos en 2 minutos.
        </p>

        <pre
          style={{
            background: "#111",
            color: "#fff",
            padding: 12,
            borderRadius: 10,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
{String(this.state.error?.message || this.state.error)}
        </pre>
      </div>
    );
  }
}
