import { useState } from "react";
import { signIn, signUp } from "../services/auth";
import { upsertMyProfile } from "../services/profiles";
import { useLocation, useNavigate } from "react-router-dom";

export default function AuthPage({ mode = "login", onDone }) {
  const isLogin = mode === "login";

  const navigate = useNavigate();
  const location = useLocation();
  

  // ✅ Soporta volver a donde venías (por ejemplo: /partidos?create=1&clubId=...)
  const state = location.state || {};
  const returnTo = state.returnTo || null;
  const from = location.state?.from || "/mapa";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // perfil (obligatorio en registro)
  const [name, setName] = useState("");
  const [age, setAge] = useState(25);
  const [sex, setSex] = useState("M");
  const [level, setLevel] = useState("medio");
  const [hand, setHand] = useState("derecha");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function goAfterAuth() {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (onDone) {
      onDone();
      return;
    }

    navigate("/mapa", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      setBusy(true);

      if (isLogin) {
        await signIn({ email, password });
navigate(from, { replace: true });
return;
      }

      // registro
      if (!name.trim()) throw new Error("Nombre obligatorio.");
      if (!age || age < 12 || age > 99) throw new Error("Edad inválida.");
      if (!["M", "F", "X"].includes(sex)) throw new Error("Sexo inválido.");

      await signUp({ email, password });

      // Intento de crear perfil (si la sesión está activa)
      try {
        await upsertMyProfile({
          name: name.trim(),
          age: Number(age),
          sex,
          level,
          hand,
        });
      } catch (_) {
        // si hay confirmación por email, aquí puede no haber sesión aún
      }

      goAfterAuth();
    } catch (err) {
      setError(err?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">{isLogin ? "Entrar" : "Registro"}</h1>
        <p className="subtitle">
          {isLogin
            ? "Accede con tu email y contraseña."
            : "Crea tu cuenta y completa tu perfil."}
        </p>
      </header>

      <div style={{ padding: 16, maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                border: "1px solid #ddd",
                borderRadius: 6,
              }}
            />
          </label>

          <label style={{ fontSize: 12 }}>
            Contraseña
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                border: "1px solid #ddd",
                borderRadius: 6,
              }}
            />
          </label>

          {!isLogin ? (
            <>
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                }}
              />

              <label style={{ fontSize: 12 }}>
                Nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                  }}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 12 }}>
                  Edad
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    type="number"
                    min={12}
                    max={99}
                    required
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                    }}
                  />
                </label>

                <label style={{ fontSize: 12 }}>
                  Sexo
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                    }}
                  >
                    <option value="M">Hombre (M)</option>
                    <option value="F">Mujer (F)</option>
                    <option value="X">Otro (X)</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 12 }}>
                  Nivel
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                    }}
                  >
                    <option value="iniciacion">Iniciación</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </label>

                <label style={{ fontSize: 12 }}>
                  Mano
                  <select
                    value={hand}
                    onChange={(e) => setHand(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 6,
                    }}
                  >
                    <option value="derecha">Derecha</option>
                    <option value="izquierda">Izquierda</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}

          {error ? (
            <div style={{ fontSize: 12, color: "crimson" }}>{error}</div>
          ) : null}

          <button className="btn" disabled={busy} type="submit">
            {busy ? "Procesando…" : isLogin ? "Entrar" : "Registrarme"}
          </button>
        </form>
      </div>
    </div>
  );
}
