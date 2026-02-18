import { useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { Link, useNavigate } from "react-router-dom";
import '../styles/Auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [handle, setHandle] = useState("");
  const [sex, setSex] = useState("X");
  const [handedness, setHandedness] = useState("right");
  const [birthdate, setBirthdate] = useState("");
  const [level, setLevel] = useState("medio");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const cleanHandle = useMemo(() => {
    return String(handle || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^\@+/, "");
  }, [handle]);

  const defaultAvatarUrl = useMemo(() => {
    if (sex === "F") return "/avatars/gorila-f.png";
    if (sex === "M") return "/avatars/gorila-m.png";
    return "/avatars/gorila-o.png";
  }, [sex]);

  const birthdateValue = useMemo(() => {
    const v = String(birthdate || "").trim();
    if (!v) return null;
    const ts = new Date(v).getTime();
    if (!Number.isFinite(ts)) return null;
    return v;
  }, [birthdate]);

  async function handleRegister(e) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const em = String(email).trim();
    const pw = String(password);

    if (!cleanHandle) return setError("Escribe un apodo.");
    if (cleanHandle.length < 3) return setError("El apodo debe tener al menos 3 caracteres.");
    if (!em || !pw) return setError("Completa email y contraseña.");
    if (pw.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (pw !== password2) return setError("Las contraseñas no coinciden.");

    if (!["right", "left", "both"].includes(handedness)) {
      return setError("Elige mano derecha, izquierda o ambas.");
    }

    if (birthdate && !birthdateValue) {
      return setError("La fecha de nacimiento no es válida.");
    }

    try {
      setBusy(true);

      const { data: existing, error: exErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", cleanHandle)
        .limit(1);

      if (exErr) throw exErr;
      if (existing && existing.length > 0) {
        return setError("Ese apodo ya existe. Prueba otro.");
      }

      const { error: err } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          data: {
            handle: cleanHandle,
            sex,
            level,
            handedness,
            birthdate: birthdateValue,
            avatar_url: defaultAvatarUrl || null,
          },
        },
      });

      if (err) throw err;

      setOk("Cuenta creada. Si te pide confirmación, revisa tu email y luego entra con tus credenciales.");
      setTimeout(() => navigate("/login", { replace: true }), 700);
    } catch (e2) {
      setError(e2?.message ?? "No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#0b0f0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflow: 'hidden'
      }}
    >
      <div 
        style={{ 
          width: "100%", 
          maxWidth: 420,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* LOGO FIJO */}
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          marginBottom: 12,
          flexShrink: 0
        }}>
          <img
            src="/imglogog.png"
            alt="Gorila Pádel"
            style={{ height: 48, width: "auto", display: "block" }}
          />
        </div>

        {/* CARD CON SCROLL */}
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flex: 1
          }}
        >
          {/* HERO FIJO */}
          <div style={{ 
            position: "relative", 
            height: 200,
            flexShrink: 0
          }}>
            <img
              src="/brand/register-gorila.png"
              alt="Gorila"
              style={{
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
                objectFit: "contain",
                objectPosition: "center",
                transform: "translateY(10px)",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.15), rgba(0,0,0,0.7))",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingBottom: 16,
                textAlign: "center",
              }}
            >
              <h1 style={{ color: "white", fontSize: 22, fontWeight: 900, margin: 0 }}>
                Crear cuenta
              </h1>
              <p style={{ 
                color: "rgba(255,255,255,0.82)", 
                fontSize: 12, 
                margin: "4px 16px 0",
                lineHeight: 1.3
              }}>
                Apodo + datos básicos para que todo funcione
              </p>
            </div>
          </div>

          {/* ⭐ FORM CON SCROLL ⭐ */}
          <form 
            onSubmit={handleRegister}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <label className="authLabel">
              Apodo (único)
              <input
                className="authInput"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Ej: teresa39"
                autoComplete="nickname"
              />
            </label>

            <label className="authLabel">
              Sexo
              <select className="authInput" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="F">Mujer</option>
                <option value="M">Hombre</option>
                <option value="X">Otro</option>
              </select>
            </label>

            <label className="authLabel">
              Mano
              <select
                className="authInput"
                value={handedness}
                onChange={(e) => setHandedness(e.target.value)}
              >
                <option value="right">Derecha</option>
                <option value="left">Izquierda</option>
                <option value="both">Ambas</option>
              </select>
            </label>

            <label className="authLabel">
              Nivel
              <select className="authInput" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="iniciacion">Iniciación</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </label>

            <label className="authLabel">
              Fecha de nacimiento (opcional)
              <input
                className="authInput"
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
            </label>

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

            <label className="authLabel">
              Contraseña
              <input
                className="authInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </label>

            <label className="authLabel">
              Repite la contraseña
              <input
                className="authInput"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="repite la contraseña"
                autoComplete="new-password"
              />
            </label>

            {error && <div className="authError">{error}</div>}
            {ok && <div className="authOk">{ok}</div>}

            <button
              className="authBtn"
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 900,
                marginTop: 10,
              }}
            >
              {busy ? "Creando…" : "Registrar"}
            </button>

            <div style={{ marginTop: 8, textAlign: "center", fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>¿Ya tienes cuenta?</span>{" "}
              <Link style={{ color: '#74B800', fontWeight: 700, textDecoration: 'none' }} to="/login">
                Entrar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
