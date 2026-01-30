import { useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { Link, useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [handle, setHandle] = useState("");
  const [sex, setSex] = useState("X");
  const [handedness, setHandedness] = useState("right"); // right | left | both
  const [birthdate, setBirthdate] = useState(""); // "YYYY-MM-DD" (opcional)
  const [level, setLevel] = useState("medio");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // ✅ handle limpio
  const cleanHandle = useMemo(() => {
    return String(handle || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^\@+/, "");
  }, [handle]);

  // ✅ avatar por defecto (si existen los ficheros)
  const defaultAvatarUrl = useMemo(() => {
    if (sex === "F") return "/avatars/gorila-f.png";
    if (sex === "M") return "/avatars/gorila-m.png";
    return "/avatars/gorila-o.png";
  }, [sex]);

  // ✅ birthdate normalizado a YYYY-MM-DD o null
  const birthdateValue = useMemo(() => {
    const v = String(birthdate || "").trim();
    if (!v) return null;
    // HTML date ya devuelve YYYY-MM-DD, pero validamos por si acaso
    const ts = new Date(v).getTime();
    if (!Number.isFinite(ts)) return null;
    // devolvemos el string tal cual (YYYY-MM-DD)
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

      // 1) Pre-check apodo
      const { data: existing, error: exErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", cleanHandle)
        .limit(1);

      if (exErr) throw exErr;
      if (existing && existing.length > 0) {
        return setError("Ese apodo ya existe. Prueba otro.");
      }

      // 2) SignUp + metadata (trigger crea perfil)
      const { error: err } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          data: {
            handle: cleanHandle,
            sex,
            level,
            handedness, // ✅ right | left | both
            birthdate: birthdateValue, // ✅ null o YYYY-MM-DD
            // ✅ Si aún no tienes esos ficheros, pon null para no romper:
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
    <div className="authWrapper">
      <div className="authCard">
        <img src="/imglogog.png" alt="Gorila Pádel" className="authLogo" />

        <h1 className="authTitle">Crear cuenta</h1>
        <p className="authSub">Apodo + datos básicos para que todo funcione (ceder plaza, valoraciones, clases…).</p>

        <form className="authForm" onSubmit={handleRegister}>
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
            <select className="authInput" value={handedness} onChange={(e) => setHandedness(e.target.value)}>
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

          {error ? <div className="authError">{error}</div> : null}
          {ok ? <div className="authOk">{ok}</div> : null}

          <button className="authBtn" type="submit" disabled={busy}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <div className="authFooter">
          <span>¿Ya tienes cuenta?</span>{" "}
          <Link className="authLink" to="/login">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
