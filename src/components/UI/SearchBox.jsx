import { useState } from "react";

export default function SearchBox({ onSearch, onPickResult, onClearResults, loading, error, results = [] }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(value);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar ciudad o calle…"
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>

        {error ? <span style={{ fontSize: 12, color: "crimson" }}>{error}</span> : null}
      </form>

      {results.length > 0 ? (
  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
    <button
      type="button"
      onClick={onClearResults}
      style={{
        padding: "6px 10px",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "#fff",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      Limpiar resultados
    </button>
  </div>
) : null}

      {results.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
          {results.map((r, idx) => (
            <li key={`${r.lat},${r.lng},${idx}`} style={{ marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => onPickResult(r)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px solid #eee",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
