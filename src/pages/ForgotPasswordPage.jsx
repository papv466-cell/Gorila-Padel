import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const em = String(email || "").trim();
    if (!em) return setError("Escribe tu email.");

    try {
      setBusy(true);

      // Vuelve aquí desde el email:
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: err } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo,
      });

      if (err) throw err;

      setOk(
        "Listo. Si el email existe, te llegará un enlace para cambiar la contraseña (mira spam también)."
      );
    } catch (e2) {
      setError(e2?.message || "No se pudo enviar el email de recuperación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
        <img
          src="/imglogog.png"
          alt="Gorila Pádel"
          className="authLogo"
          style={{ margin: "0 auto", display: "block" }}
        />

        <h1 className="authTitle">Recuperar contraseña</h1>
        <p className="authSub">
          Te enviaremos un email con un enlace para crear una nueva contraseña.
        </p>

        <form className="authForm" onSubmit={handleSubmit}>
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
          <Link className="authLink" to="/login">
            Volver a Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}