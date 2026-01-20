import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

function getCodeFromUrl() {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("code") || "";
  } catch {
    return "";
  }
}

function hasAccessTokenInHash() {
  try {
    return window.location.hash.includes("access_token=");
  } catch {
    return false;
  }
}

function cleanUrl() {
  try {
    // deja solo /reset-password (sin ?code=... ni #access_token=...)
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {}
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    let alive = true;
    let unsub = null;

    async function init() {
      setError(null);
      setOk(null);
      setReady(false);

      try {
        // 0) Escucha eventos: en algunos navegadores la sesión aparece “un poco después”
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (!alive) return;
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
            setReady(true);
          }
        });
        unsub = () => sub?.subscription?.unsubscribe?.();

        // 1) Si viene con ?code=... (PKCE), canjeamos
        const code = getCodeFromUrl();
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
          cleanUrl();
        }

        // 2) Si viene con hash access_token, supabase lo procesa, pero damos margen
        if (hasAccessTokenInHash()) {
          // dejamos un poco de tiempo para que el SDK lo procese antes de limpiar
          setTimeout(() => {
            if (!alive) return;
            cleanUrl();
          }, 800);
        }

        // 3) Reintentos cortos para detectar sesión
        for (let i = 0; i < 12; i++) {
          const { data } = await supabase.auth.getSession();
          if (!alive) return;

          if (data?.session) {
            setReady(true);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        // 4) Si aún no hay sesión:
        if (!alive) return;
        setError(
          "Auth session missing. Abre el link del email en la MISMA pestaña (sin previsualización) o vuelve a pedir el email."
        );
      } catch (e) {
        if (!alive) return;
        setError(e?.message ?? "No se pudo iniciar el reset");
      }
    }

    init();

    return () => {
      alive = false;
      try {
        unsub?.();
      } catch {}
    };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const a = String(pw1);
    const b = String(pw2);

    if (a.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (a !== b) return setError("Las contraseñas no coinciden.");

    try {
      setBusy(true);

      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;

      if (!s?.session) {
        throw new Error(
          "Auth session missing. Vuelve a abrir el link del email en esta misma pestaña (o pide otro email)."
        );
      }

      const { error: err } = await supabase.auth.updateUser({ password: a });
      if (err) throw err;

      setOk("Contraseña cambiada ✅ Ya puedes entrar.");
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (e2) {
      setError(e2?.message ?? "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
        <img src="/logo.png" alt="Gorila Padel" className="authLogo" />
        <h1 className="authTitle">Nueva contraseña</h1>

        {!ready ? (
          <p className="authSub">Preparando el reset…</p>
        ) : (
          <p className="authSub">Escribe tu nueva contraseña.</p>
        )}

        {error ? <div className="authError">{error}</div> : null}
        {ok ? <div className="authOk">{ok}</div> : null}

        <form className="authForm" onSubmit={handleSave}>
          <label className="authLabel">
            Nueva contraseña
            <input
              className="authInput"
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
              disabled={!ready || busy}
            />
          </label>

          <label className="authLabel">
            Repite la contraseña
            <input
              className="authInput"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="repite la contraseña"
              autoComplete="new-password"
              disabled={!ready || busy}
            />
          </label>

          <button className="authBtn" type="submit" disabled={!ready || busy}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>

        <div className="authFooter">
          <Link className="authLink" to="/login">
            Volver a entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
