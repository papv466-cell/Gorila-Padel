import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // Supabase procesa automáticamente el token del hash
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) {
        setError("El enlace de recuperación no es válido o ha expirado.");
      }
    });
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setBusy(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setOk(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (e) {
      setError(e.message || "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
        <h1 className="authTitle">Nueva contraseña</h1>

        {ok ? (
          <p>Contraseña cambiada. Redirigiendo…</p>
        ) : (
          <form onSubmit={handleReset}>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <div className="authError">{error}</div>}

            <button disabled={busy}>
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
