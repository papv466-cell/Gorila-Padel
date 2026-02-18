import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMatchesForClubPreview } from "../../services/matches";

export default function ClubMatchesPreview({ clubId, clubName, limit = 5 }) {
  const [searchParams] = useSearchParams();
  const refreshKey = searchParams.get("refresh") || "";

  const [status, setStatus] = useState({ loading: true, error: null });
  const [items, setItems] = useState([]);

  async function load() {
    if (!clubId && !clubName) return;

    try {
      setStatus({ loading: true, error: null });

      const data = await fetchMatchesForClubPreview({
        clubId: String(clubId || ""),
        clubName: String(clubName || ""),
        limit,
      });

      setItems(Array.isArray(data) ? data : []);
      setStatus({ loading: false, error: null });
    } catch (e) {
      setItems([]);
      setStatus({ loading: false, error: e?.message ?? "Error cargando partidos" });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, clubName, refreshKey]);

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Próximos partidos</div>

        <button
          type="button"
          className="btn ghost"
          onClick={load}
          disabled={status.loading}
          style={{ padding: "4px 8px", fontSize: 12 }}
        >
          {status.loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {status.error ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "crimson" }}>{status.error}</div>
      ) : status.loading ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Cargando…</div>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Aún no hay partidos en este club.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
          {items.map((m) => (
            <li key={m.id} style={{ fontSize: 12, opacity: 0.9 }}>
              {new Date(m.start_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
              {" · "}
              {m.duration_min} min
              {" · "}
              {m.level}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
