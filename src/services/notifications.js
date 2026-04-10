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
