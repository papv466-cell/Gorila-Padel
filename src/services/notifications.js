import { supabase } from "./supabaseClient";

// Tipos de notificaciones disponibles
export const NOTIFICATION_TYPES = {
  // Partidos
  MATCH_JOINED: "match_joined",           // Alguien se une a tu partido
  MATCH_FULL: "match_full",               // Tu partido está completo
  MATCH_REMINDER_1H: "match_reminder_1h", // 1h antes del partido
  MATCH_REMINDER_24H: "match_reminder_24h",// 24h antes
  MATCH_CANCELLED: "match_cancelled",     // Partido cancelado

  // Juntos
  INCLUSIVE_REQUEST: "inclusive_request", // Solicitud de unirse
  REQUEST_APPROVED: "request_approved",   // Solicitud aceptada
  REQUEST_REJECTED: "request_rejected",   // Solicitud rechazada

  // Clases
  CLASS_BOOKED: "class_booked",           // Clase reservada
  CLASS_REMINDER: "class_reminder",       // Recordatorio clase
  CLASS_CANCELLED: "class_cancelled",     // Clase cancelada
  CLASS_CONFIRMED: "class_confirmed",     // Profesor confirma clase

  // Profesores
  TEACHER_NEW_SLOT: "teacher_new_slot",   // Profesor favorito libera hora
  TEACHER_VERIFIED: "teacher_verified",   // Profesor verificado

  // Pagos
  PAYMENT_SUCCESS: "payment_success",     // Pago confirmado
  DONATION_THANKS: "donation_thanks",     // Gracias por donar

  // Sistema
  BOOKING_CONFIRMED: "booking_confirmed", // Reserva pista confirmada
};

export async function sendNotification({ userId, type, title, body, data = {} }) {
  if (!userId) return;
  try {
    await supabase.from("notifications").insert({
      user_id: userId, type, title, body, data,
    });
  } catch (e) {
    console.error("Error sending notification:", e);
  }
}

export async function sendNotificationToMany({ userIds, type, title, body, data = {} }) {
  if (!userIds?.length) return;
  const rows = userIds.map(user_id => ({ user_id, type, title, body, data }));
  try {
    await supabase.from("notifications").insert(rows);
  } catch (e) {
    console.error("Error sending notifications:", e);
  }
}

// Notificar a todos los jugadores de un partido
export async function notifyMatchPlayers({ match, type, title, body, excludeUserId }) {
  const playerIds = (match.player_ids || []).filter(id => id !== excludeUserId);
  await sendNotificationToMany({ userIds: playerIds, type, title, body, data: { match_id: match.id } });
}

// Aliases para compatibilidad con matches.js
export async function notifyMatchApproved({ userId, matchId, clubName }) {
  await sendNotification({ userId, type: "match_joined", title: "✅ Solicitud aceptada", body: `Ya estás dentro del partido en ${clubName}`, data: { match_id: matchId } });
}

export async function notifyMatchRejected({ userId, matchId, clubName }) {
  await sendNotification({ userId, type: "request_rejected", title: "❌ Solicitud rechazada", body: `No pudieron aceptarte en el partido de ${clubName}`, data: { match_id: matchId } });
}

export async function notifyMatchRequest({ userId, matchId, clubName, requesterName }) {
  await sendNotification({ userId, type: "inclusive_request", title: "♿ Nueva solicitud", body: `${requesterName} quiere unirse a tu partido en ${clubName}`, data: { match_id: matchId } });
}

export async function notifyMatchInvite({ userId, matchId, clubName, inviterName }) {
  await sendNotification({ userId, type: "match_invite", title: "🎾 Te han invitado a un partido", body: `${inviterName} te invita a jugar en ${clubName}`, data: { match_id: matchId } });
}

export async function notifyMatchTransferReceived({ userId, matchId, clubName }) {
  await sendNotification({ userId, type: "match_transfer", title: "💸 Has recibido una transferencia", body: `Pago recibido para el partido en ${clubName}`, data: { match_id: matchId } });
}

export async function notifyMatchChat({ userId, matchId, senderName, message }) {
  await sendNotification({ userId, type: "match_chat", title: `💬 ${senderName}`, body: message?.slice(0, 80), data: { match_id: matchId } });
}

export async function notifySocialLike({ userId, postId, likerName }) {
  await sendNotification({ userId, type: "social_like", title: `❤️ A ${likerName} le gusta tu publicación`, body: "", data: { post_id: postId } });
}

export async function notifySocialComment({ userId, postId, commenterName, comment }) {
  await sendNotification({ userId, type: "social_comment", title: `💬 ${commenterName} ha comentado`, body: comment?.slice(0, 80), data: { post_id: postId } });
}
