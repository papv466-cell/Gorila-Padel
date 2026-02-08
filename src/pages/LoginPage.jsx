import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { Link, useNavigate, useLocation } from "react-router-dom";
import '../styles/Auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);

    const em = String(email).trim();
    const pw = String(password);

    if (!em || !pw) {
      return setError("Completa email y contraseña.");
    }

    try {
      setBusy(true);
      const { error: err } = await supabase.auth.signInWithPassword({
        email: em,
        password: pw,
      });

      if (err) throw err;

      const from = location.state?.from || "/partidos";
      navigate(from, { replace: true });
    } catch (e2) {
      setError(e2?.message ?? "No se pudo entrar");
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
        background: "linear-gradient(135deg, #000000 0%, #1a1a1a 100%)",
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
          maxWidth: 380,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* CARD */}
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '32px 24px'
          }}
        >
          {/* LOGO FIJO */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            marginBottom: 20,
            flexShrink: 0
          }}>
            <img
              src="/imglogog.png"
              alt="Gorila Pádel"
              style={{ 
                height: 80, 
                width: 'auto', 
                display: "block",
                borderRadius: 16
              }}
            />
          </div>

          {/* TÍTULO FIJO */}
          <h1 style={{ 
            color: "white", 
            fontSize: 26, 
            fontWeight: 900, 
            margin: '0 0 8px',
            textAlign: 'center',
            flexShrink: 0
          }}>
            Entrar
          </h1>

          <p style={{ 
            color: "rgba(255,255,255,0.6)", 
            fontSize: 13, 
            margin: "0 0 24px",
            textAlign: 'center',
            lineHeight: 1.4,
            flexShrink: 0
          }}>
            Accede para unirte a partidos, crear y chatear
          </p>

          {/* FORM */}
          <form 
            onSubmit={handleLogin}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <label 
              className="authLabel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span style={{ 
                fontSize: 12, 
                fontWeight: 700, 
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Email
              </span>
              <input
                className="authInput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
              />
            </label>

            <label 
              className="authLabel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span style={{ 
                fontSize: 12, 
                fontWeight: 700, 
                color: 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Contraseña
              </span>
              <input
                className="authInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                disabled={busy}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
              />
            </label>

            {error && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#ff6b6b',
                fontSize: 12,
                fontWeight: 700
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                padding: '14px',
                background: 'linear-gradient(135deg, #74B800 0%, #9BE800 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#000',
                fontSize: 15,
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginTop: 8,
                boxShadow: '0 4px 12px rgba(116, 184, 0, 0.3)',
                letterSpacing: '0.3px'
              }}
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>

            <div style={{ 
              marginTop: 8, 
              textAlign: "center", 
              fontSize: 13 
            }}>
              <Link 
                style={{ 
                  color: 'rgba(255,255,255,0.6)', 
                  textDecoration: 'none',
                  fontWeight: 600
                }} 
                to="/reset-password"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <div style={{ 
              marginTop: 4, 
              textAlign: "center", 
              fontSize: 13 
            }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                ¿No tienes cuenta?
              </span>{" "}
              <Link 
                style={{ 
                  color: '#74B800', 
                  fontWeight: 700, 
                  textDecoration: 'none' 
                }} 
                to="/register"
              >
                Registrarse
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}