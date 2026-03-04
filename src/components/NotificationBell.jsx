// src/components/NotificationBell.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import {
  getUserNotifications,
  getUnreadCount,
  markAsClicked,
  markAllAsRead,
  subscribeToNotifications,
} from "../services/notifications";
import { playGorila, unlockGorilaAudio } from "../services/gorilaSound";
import "./NotificationBell.css";

const GORILA_SOUND = `${window.location.origin}/sounds/gorila.mp3`;

async function sonarGorila() {
  try {
    const audio = new Audio(GORILA_SOUND);
    audio.volume = 1.0;
    await audio.play();
  } catch {
    // fallback a Web Audio API
    try {
      await unlockGorilaAudio();
      await playGorila(1);
    } catch {}
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(prev => prev?.user?.id === s?.user?.id && prev?.user?.id ? prev : (s ?? null));
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Cargar contador de no leídas y suscribirse a notificaciones
  useEffect(() => {
    if (!session?.user?.id) return;

    loadUnreadCount();

    const unsub = subscribeToNotifications(session.user.id, (newNotification) => {
      setUnreadCount((prev) => prev + 1);

      // Mostrar notificación nativa del navegador
      if (Notification.permission === "granted") {
        new Notification(newNotification.title, {
          body: newNotification.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: newNotification.id,
        });
      }
    });

    return () => unsub?.();
  }, [session?.user?.id]);

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  async function loadUnreadCount() {
    if (!session?.user?.id) return;
    const count = await getUnreadCount(session.user.id);
    setUnreadCount(count);
  }

  async function loadNotifications() {
    if (!session?.user?.id) return;
    setLoading(true);
    const data = await getUserNotifications({ userId: session.user.id, limit: 20 });
    setNotifications(data);
    setLoading(false);
  }

  function togglePanel() {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen(!isOpen);
  }

  async function handleNotificationClick(notification) {
    // 🦍 Sonar aquí — hay gesto del usuario garantizado
    sonarGorila();

    await markAsClicked(notification.id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setIsOpen(false);

    const { type, data } = notification;

    // 1️⃣ Si la notificación trae URL directa → úsala
    if (data?.url) {
      navigate(data.url);
      return;
    }

    // 2️⃣ Fallback para notificaciones antiguas sin url en data
    if (type?.includes("request")) {
      navigate(data?.matchId ? `/partidos?openRequests=${data.matchId}` : "/partidos");
    } else if (type?.startsWith("match_") || type === "sos_match" || type === "new_match") {
      navigate(data?.matchId ? `/partidos?openChat=${data.matchId}` : "/partidos");
    } else if (type?.startsWith("social_")) {
      navigate("/gorilandia");
    } else if (type?.startsWith("store_")) {
      navigate("/tienda");
    } else {
      navigate("/");
    }
  }

  async function handleMarkAllAsRead() {
    if (!session?.user?.id) return;
    await markAllAsRead(session.user.id);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function getNotificationIcon(type) {
    if (type.startsWith("match_")) return "🎾";
    if (type.startsWith("class_")) return "🏫";
    if (type.startsWith("social_")) return "🦍";
    if (type.startsWith("store_")) return "🛒";
    if (type.startsWith("inclusive_")) return "♿";
    if (type.startsWith("gamification_")) return "🏆";
    if (type.startsWith("location_")) return "📍";
    if (type.startsWith("engagement_")) return "💚";
    return "🔔";
  }

  if (!session) return null;

  return (
    <div className="notificationBell" ref={panelRef}>
      {/* Botón campana */}
      <button className="notificationBellBtn" onClick={togglePanel} aria-label="Notificaciones">
        🔔
        {unreadCount > 0 && (
          <span className="notificationBadge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {isOpen && (
        <div className="notificationPanel">
          {/* Header */}
          <div className="notificationPanelHeader">
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button className="notificationMarkAllBtn" onClick={handleMarkAllAsRead}>
                Marcar todo leído
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="notificationList">
            {loading ? (
              <div className="notificationEmpty">Cargando...</div>
            ) : notifications.filter(n => !n.read).length === 0 ? (
              <div className="notificationEmpty">
                <div style={{ fontSize: 48, marginBottom: 8 }}>🔔</div>
                <div style={{ fontWeight: 700 }}>Sin notificaciones</div>
                <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
                  Te avisaremos cuando algo pase
                </div>
              </div>
            ) : (
              notifications.filter(n => !n.read).map((notif) => (
                <div
                  key={notif.id}
                  className={`notificationItem ${!notif.read ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="notificationIcon">{getNotificationIcon(notif.type)}</div>
                  <div className="notificationContent">
                    <div className="notificationTitle">{notif.title}</div>
                    <div className="notificationBody">{notif.body}</div>
                    <div className="notificationTime">{formatTime(notif.created_at)}</div>
                  </div>
                  {!notif.read && <div className="notificationDot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}