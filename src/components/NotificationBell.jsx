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
import "./NotificationBell.css";

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
      setSession(s ?? null);
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Desbloquear audio con primera interacción
  useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio('/dist/sounds/gorila3.mp3');
      audio.volume = 0;
      audio.play().then(() => {
        console.log('✅ Audio desbloqueado');
        audio.pause();
      }).catch(() => {
        console.log('⚠️ Audio bloqueado - necesita interacción');
      });
    };
    
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Cargar contador de no leídas y suscribirse a notificaciones
  useEffect(() => {
    if (!session?.user?.id) return;

    loadUnreadCount();

    const unsub = subscribeToNotifications(session.user.id, (newNotification) => {
      setUnreadCount((prev) => prev + 1);
      
      // REPRODUCIR SONIDO 🦍
      try {
        const audio = new Audio('/dist/sounds/gorila3.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log('No se pudo reproducir audio:', err));
      } catch (err) {
        console.log('Error cargando audio:', err);
      }

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
    // BORRAR la notificación
    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("id", notification.id);
      
      // Actualizar UI: quitar del estado local
      setNotifications((prev) => prev.filter(n => n.id !== notification.id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  
    // Cerrar panel
    setIsOpen(false);
  
    // Navegar según el tipo
    const { type, data } = notification;
  
    if (type.startsWith("match_")) {
      // Si es solicitud, abrir panel de solicitudes
      if (type === "match_request_new" && data?.matchId) {
        navigate(`/partidos?openRequests=${data.matchId}`);
      }
      // Si es otro tipo de notificación de partido con matchId, abrir chat
      else if (data?.matchId) {
        navigate(`/partidos?openChat=${data.matchId}`);
      } 
      // Sin matchId, ir a partidos general
      else {
        navigate("/partidos");
      }
    } else if (type.startsWith("class_")) {
      navigate("/clases");
    } else if (type.startsWith("social_")) {
      if (data?.postId) {
        navigate(`/gorilandia?post=${data.postId}`);
      } else {
        navigate("/gorilandia");
      }
    } else if (type.startsWith("store_")) {
      if (data?.orderId) {
        navigate(`/tienda/pedidos/${data.orderId}`);
      } else {
        navigate("/tienda");
      }
    } else if (type.startsWith("inclusive_")) {
      navigate("/partidos-inclusivos");
    } else if (type.startsWith("profile_")) {
      navigate("/perfil");
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