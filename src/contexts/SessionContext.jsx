// src/contexts/SessionContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Contexto ÚNICO de autenticación para toda la app.
// Todas las páginas deben usar useSession() en vez de tener su propio
// getSession() / onAuthStateChange() — eso era lo que causaba que todas
// las páginas se quedasen en "Cargando" tras volver a la app.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const userIdRef = useRef(null);

  useEffect(() => {
    let alive = true;

    // Safety timer: si Supabase tarda más de 6s, continuar sin sesión
    // (evita que la app se quede bloqueada indefinidamente)
    const safetyTimer = setTimeout(() => {
      if (alive && !sessionReady) {
        console.warn('[SessionContext] Safety timer triggered — continuing without session');
        setSessionReady(true);
      }
    }, 6000);

    // Carga inicial de sesión
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      clearTimeout(safetyTimer);
      if (data?.session) {
        userIdRef.current = data.session.user.id;
        setSession(data.session);
      }
      setSessionReady(true);
    }).catch(() => {
      if (!alive) return;
      clearTimeout(safetyTimer);
      setSessionReady(true);
    });

    // Listener de cambios de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;

      const newUserId = newSession?.user?.id ?? null;
      const prevUserId = userIdRef.current;

      // TOKEN_REFRESHED o SIGNED_IN con el mismo usuario → ignorar completamente
      // Esto es lo que causaba el bug: el token se refresca al volver a la app
      // y todas las páginas con su propio listener se re-montaban innecesariamente
      if (newUserId && newUserId === prevUserId) {
        if (_event === 'TOKEN_REFRESHED' || _event === 'SIGNED_IN') {
          return;
        }
      }

      userIdRef.current = newUserId;
      setSession(newSession ?? null);
      setSessionReady(true);
    });

    return () => {
      alive = false;
      clearTimeout(safetyTimer);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, sessionReady }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}