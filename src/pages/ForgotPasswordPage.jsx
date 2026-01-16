import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const em = String(email).trim();
    if (!em) return setError("Escribe tu email.");

    try {
      setBusy(true);

      // 👉 Importantísimo: a dónde volverá el email de reset
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: err } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo,
      });

      if (err) throw err;

      setOk("Te he enviado un email para cambiar la contraseña. Revisa bandeja y spam.");
    } catch (e2) {
      setError(e2?.message ?? "No se pudo enviar el email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
        <img src="/logo.png" alt="Global Padel" className="authLogo" />
        <h1 className="authTitle">Recuperar contraseña</h1>
        <p className="authSub">Te mandamos un email para cambiarla.</p>

        <form className="authForm" onSubmit={handleSend}>
          <label className="authLabel">
            Email
            <input
              className="authInput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          {error ? <div className="authError">{error}</div> : null}
          {ok ? <div className="authOk">{ok}</div> : null}

          <button className="authBtn" type="submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar email"}
          </button>
        </form>

        <div className="authFooter">
          <Link className="authLink" to="/login">Volver a entrar</Link>
        </div>
      </div>
    </div>
  );
}
