// src/components/NotificationBell.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getUserNotifications,
  getUnreadCount,
  markAsClicked,
  markAllAsRead,
  subscribeToNotifications,
} from "../services/notifications";
import "./NotificationBell.css";

async function sonarGorila() {
  try {
    const audio = new Audio("/sounds/gorila.mp3");
    audio.volume = 1.0;
    await audio.play();
  } catch {}
}

export default function NotificationBell({ session }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    loadUnreadCount();
    const unsub = subscribeToNotifications(userId, (newNotif) => {
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [newNotif, ...prev]);
      if (document.hidden && Notification.permission === "granted") {
        new Notification(newNotif.title, {
          body: newNotif.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: newNotif.id,
        });
      }
    });
    return () => unsub?.();
  }, [userId]);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "NOTIFICATION_CLICK" && e.data.url) navigate(e.data.url);
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [navigate]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  async function loadUnreadCount() {
    if (!userId) return;
    const count = await getUnreadCount(userId);
    setUnreadCount(count);
  }

  async function loadNotifications() {
    if (!userId) return;
    setLoading(true);
    const data = await getUserNotifications({ userId, limit: 30 });
    setNotifications(data);
    setLoading(false);
  }

  function togglePanel() {
    if (!isOpen) loadNotifications();
    setIsOpen(v => !v);
  }

  async function handleNotificationClick(notif) {
    sonarGorila();
    await markAsClicked(notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setIsOpen(false);
    const { type, data } = notif;
    if (data?.url) { navigate(data.url); return; }
    if (type?.includes("request")) navigate(data?.matchId ? `/partidos?openRequests=${data.matchId}` : "/partidos");
    else if (type?.startsWith("match_") || type === "sos_match" || type === "new_match") navigate(data?.matchId ? `/partidos?openChat=${data.matchId}` : "/partidos");
    else if (type?.startsWith("social_")) navigate("/gorilandia");
    else if (type?.startsWith("store_")) navigate("/tienda");
    else if (type?.startsWith("booking_")) navigate("/perfil");
    else navigate("/");
  }

  async function handleMarkAllAsRead() {
    if (!userId) return;
    await markAllAsRead(userId);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function formatTime(ts) {
    const d = new Date(ts), now = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins/60)}h`;
    if (mins < 10080) return `${Math.floor(mins/1440)}d`;
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function getIcon(type) {
    if (!type) return "🔔";
    if (type.includes("request")) return "🙋";
    if (type.startsWith("match_")) return "🎾";
    if (type.startsWith("class_")) return "🎓";
    if (type.startsWith("social_")) return "🦍";
    if (type.startsWith("store_")) return "🛒";
    if (type.startsWith("inclusive_")) return "♿";
    if (type.startsWith("gamification_") || type.includes("xp") || type.includes("level")) return "🏆";
    if (type.startsWith("booking_")) return "🏟️";
    if (type.includes("challenge") || type.includes("reto")) return "⚔️";
    return "🔔";
  }

  if (!userId) return null;

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);
  const visible = showAll ? notifications : unread;

  return (
    <div className="notificationBell" ref={panelRef}>
      <button className="notificationBellBtn" onClick={togglePanel} aria-label="Notificaciones">
        🔔
        {unreadCount > 0 && (
          <span className="notificationBadge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notificationPanel">
          <div className="notificationPanelHeader">
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <h3 style={{margin:0}}>Notificaciones</h3>
              {unread.length > 0 && (
                <span style={{fontSize:11, fontWeight:900, padding:"2px 8px", borderRadius:10, background:"rgba(var(--sport-color-rgb, 46,204,113),0.2)", color:"var(--sport-color)"}}>
                  {unread.length} nuevas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button className="notificationMarkAllBtn" onClick={handleMarkAllAsRead}>✓ Todo leído</button>
            )}
          </div>

          {read.length > 0 && (
            <div style={{display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              {[["nuevas", false], ["historial", true]].map(([label, val]) => (
                <button key={label} onClick={() => setShowAll(val)}
                  style={{flex:1, padding:"8px", border:"none", background:"transparent", cursor:"pointer", fontSize:12, fontWeight:800,
                    color: showAll === val ? "var(--sport-color)" : "rgba(255,255,255,0.4)",
                    borderBottom: showAll === val ? "2px solid var(--sport-color)" : "2px solid transparent"}}>
                  {label === "nuevas" ? `🔴 Nuevas (${unread.length})` : `📋 Historial (${read.length})`}
                </button>
              ))}
            </div>
          )}

          <div className="notificationList">
            {loading ? (
              <div className="notificationEmpty"><div style={{fontSize:32, marginBottom:8}}>⏳</div>Cargando...</div>
            ) : visible.length === 0 ? (
              <div className="notificationEmpty">
                <div style={{fontSize:48, marginBottom:8}}>🔔</div>
                <div style={{fontWeight:700}}>{showAll ? "Sin historial" : "¡Todo al día!"}</div>
                <div style={{opacity:0.5, fontSize:12, marginTop:4}}>
                  {showAll ? "No hay notificaciones anteriores" : "Te avisaremos cuando algo pase 🦍"}
                </div>
              </div>
            ) : (
              visible.map((notif) => (
                <div key={notif.id}
                  className={`notificationItem ${!notif.read ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notif)}>
                  <div className="notificationIcon">{getIcon(notif.type)}</div>
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
