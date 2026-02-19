// src/services/notifications.js
import { supabase } from "./supabaseClient";

/**
 * TIPOS DE NOTIFICACIONES
 */
export const NOTIFICATION_TYPES = {
  // Partidos
  MATCH_REQUEST: "match_request",
  MATCH_APPROVED: "match_approved",
  MATCH_REJECTED: "match_rejected",
  MATCH_INVITE: "match_invite",
  MATCH_TRANSFER_RECEIVED: "match_transfer_received",
  MATCH_TRANSFER_LOST: "match_transfer_lost",
  MATCH_CHAT: "match_chat",
  MATCH_CANCELLED: "match_cancelled",
  MATCH_TIME_CHANGED: "match_time_changed",
  MATCH_REMINDER_24H: "match_reminder_24h",
  MATCH_REMINDER_1H: "match_reminder_1h",
  MATCH_STARTING: "match_starting",
  MATCH_ENDING_5MIN: "match_ending_5min",
  MATCH_ENDED: "match_ended",

  // Clases
  CLASS_BOOKED: "class_booked",
  CLASS_REMINDER_24H: "class_reminder_24h",
  CLASS_REMINDER_1H: "class_reminder_1h",
  CLASS_STARTING: "class_starting",
  CLASS_ENDING_5MIN: "class_ending_5min",
  CLASS_ENDED: "class_ended",
  CLASS_CANCELLED: "class_cancelled",

  // Social (Gorilandia)
  SOCIAL_LIKE: "social_like",
  SOCIAL_COMMENT: "social_comment",
  SOCIAL_REPLY: "social_reply",
  SOCIAL_MENTION: "social_mention",
  SOCIAL_FOLLOW: "social_follow",
  SOCIAL_SHARE: "social_share",

  // Tienda
  STORE_ORDER_CONFIRMED: "store_order_confirmed",
  STORE_ORDER_SHIPPED: "store_order_shipped",
  STORE_ORDER_DELIVERED: "store_order_delivered",
  STORE_NEW_SALE: "store_new_sale",
  STORE_FLASH_SALE: "store_flash_sale",
  STORE_BACK_IN_STOCK: "store_back_in_stock",
  STORE_PRICE_DROP: "store_price_drop",
  STORE_CART_ABANDONED: "store_cart_abandoned",

  // Partidos inclusivos
  INCLUSIVE_NEW_MATCH: "inclusive_new_match",
  INCLUSIVE_USER_JOINED: "inclusive_user_joined",

  // Perfil
  PROFILE_WELCOME: "profile_welcome",
  PROFILE_INCOMPLETE: "profile_incomplete",
  PROFILE_VERIFY_EMAIL: "profile_verify_email",

  // Gamificación
  GAMIFICATION_STREAK: "gamification_streak",
  GAMIFICATION_LEVEL_UP: "gamification_level_up",
  GAMIFICATION_ACHIEVEMENT: "gamification_achievement",
  GAMIFICATION_RECORD: "gamification_record",

  // Ubicación
  LOCATION_MATCH_NEARBY: "location_match_nearby",
  LOCATION_NEW_CLUB: "location_new_club",

  // Engagement
  ENGAGEMENT_MISS_YOU: "engagement_miss_you",
};

/**
 * Crear una notificación
 */
export async function createNotification({ userId, type, title, body, data = {} }) {
  try {
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data,
      })
      .select()
      .single();

    if (error) throw error;

    // Enviar push notification
    await sendPushNotification({ userId, title, body, data: { ...data, notificationId: notification.id } });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Obtener notificaciones del usuario
 */
export async function getUserNotifications({ userId, limit = 50, unreadOnly = false }) {
  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}

/**
 * Contar notificaciones no leídas
 */
export async function getUnreadCount(userId) {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error counting unread notifications:", error);
    return 0;
  }
}

/**
 * Marcar notificación como leída
 */
export async function markAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

/**
 * Marcar todas como leídas
 */
export async function markAllAsRead(userId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
}

/**
 * Marcar notificación como clickeada
 */
export async function markAsClicked(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ clicked: true, read: true })
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking notification as clicked:", error);
  }
}

/**
 * Borrar notificación
 */
export async function deleteNotification(notificationId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

/**
 * Enviar push notification
 */
async function sendPushNotification({ userId, title, body, data = {} }) {
  try {
    // Llamar a la edge function que envía push
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId,
        title,
        body,
        data,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error sending push notification:", error);
    // No lanzar error para no bloquear la creación de la notificación
  }
}

/**
 * Suscribirse a notificaciones en tiempo real
 */
export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Actualizar última actividad del usuario
 */
export async function updateUserActivity(userId, activityType = "login") {
  try {
    const updates = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    switch (activityType) {
      case "login":
        updates.last_login = new Date().toISOString();
        break;
      case "match_created":
        updates.last_match_created = new Date().toISOString();
        break;
      case "match_joined":
        updates.last_match_joined = new Date().toISOString();
        break;
      case "gorilandia_post":
        updates.last_gorilandia_post = new Date().toISOString();
        break;
      case "store_purchase":
        updates.last_store_purchase = new Date().toISOString();
        break;
    }

    const { error } = await supabase
      .from("user_activity")
      .upsert(updates, { onConflict: "user_id" });

    if (error) throw error;
  } catch (error) {
    console.error("Error updating user activity:", error);
  }
}

/**
 * HELPERS PARA CREAR NOTIFICACIONES ESPECÍFICAS
 */

// Partido - Solicitud recibida
export async function notifyMatchRequest({ matchId, matchName, requesterId, requesterName, creatorId }) {
  return createNotification({
    userId: creatorId,
    type: NOTIFICATION_TYPES.MATCH_REQUEST,
    title: "Nueva solicitud",
    body: `${requesterName} quiere unirse a tu partido`,
    data: { matchId, requesterId },
  });
}

// Partido - Solicitud aceptada
export async function notifyMatchApproved({ matchId, matchName, creatorName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_APPROVED,
    title: "¡Solicitud aceptada!",
    body: `${creatorName} te aceptó en el partido`,
    data: { matchId },
  });
}

// Partido - Solicitud rechazada
export async function notifyMatchRejected({ matchId, matchName, creatorName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_REJECTED,
    title: "Solicitud rechazada",
    body: `Tu solicitud para el partido fue rechazada`,
    data: { matchId },
  });
}

// Partido - Invitación
export async function notifyMatchInvite({ matchId, matchName, fromUserId, fromUserName, toUserId }) {
  return createNotification({
    userId: toUserId,
    type: NOTIFICATION_TYPES.MATCH_INVITE,
    title: "Te invitaron a un partido",
    body: `${fromUserName} te invitó a jugar`,
    data: { matchId, fromUserId },
  });
}

// Partido - Plaza cedida (recibida)
export async function notifyMatchTransferReceived({ matchId, matchName, fromUserName, toUserId }) {
  return createNotification({
    userId: toUserId,
    type: NOTIFICATION_TYPES.MATCH_TRANSFER_RECEIVED,
    title: "¡Te cedieron una plaza!",
    body: `${fromUserName} te cedió su plaza`,
    data: { matchId },
  });
}

// Partido - Nuevo mensaje en chat
export async function notifyMatchChat({ matchId, matchName, senderName, message, userIds }) {
  const promises = userIds.map((userId) =>
    createNotification({
      userId,
      type: NOTIFICATION_TYPES.MATCH_CHAT,
      title: `${senderName} en el chat`,
      body: message.substring(0, 100),
      data: { matchId },
    })
  );
  return Promise.all(promises);
}

// Partido - Cancelado
export async function notifyMatchCancelled({ matchId, matchName, userIds }) {
  const promises = userIds.map((userId) =>
    createNotification({
      userId,
      type: NOTIFICATION_TYPES.MATCH_CANCELLED,
      title: "Partido cancelado",
      body: `El partido fue cancelado por el organizador`,
      data: { matchId },
    })
  );
  return Promise.all(promises);
}

// Partido - Recordatorio 24h
export async function notifyMatchReminder24h({ matchId, matchName, startTime, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_REMINDER_24H,
    title: "Partido mañana",
    body: `Tu partido es mañana a las ${startTime}`,
    data: { matchId },
  });
}

// Partido - Recordatorio 1h
export async function notifyMatchReminder1h({ matchId, matchName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_REMINDER_1H,
    title: "Partido en 1 hora",
    body: `Tu partido empieza en 1 hora. ¡Prepárate!`,
    data: { matchId },
  });
}

// Partido - Empieza en 5 min
export async function notifyMatchStarting({ matchId, matchName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_STARTING,
    title: "¡Partido YA! 🎾",
    body: `Tu partido empieza en 5 minutos`,
    data: { matchId },
  });
}

// Partido - Termina en 5 min
export async function notifyMatchEnding({ matchId, matchName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_ENDING_5MIN,
    title: "Último set 🔥",
    body: `El partido termina en 5 minutos`,
    data: { matchId },
  });
}

// Partido - Terminado
export async function notifyMatchEnded({ matchId, matchName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.MATCH_ENDED,
    title: "Partido terminado",
    body: `¿Cómo estuvo el partido? ¡Cuéntanos!`,
    data: { matchId },
  });
}

// Social - Nuevo like
export async function notifySocialLike({ postId, likerName, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SOCIAL_LIKE,
    title: "Nuevo like 🦍",
    body: `A ${likerName} le gustó tu publicación`,
    data: { postId },
  });
}

// Social - Nuevo comentario
export async function notifySocialComment({ postId, commenterName, comment, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.SOCIAL_COMMENT,
    title: `${commenterName} comentó`,
    body: comment.substring(0, 100),
    data: { postId },
  });
}

// Tienda - Pedido confirmado
export async function notifyStoreOrderConfirmed({ orderId, orderNumber, userId }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.STORE_ORDER_CONFIRMED,
    title: "Pedido confirmado ✅",
    body: `Pedido #${orderNumber} confirmado`,
    data: { orderId },
  });
}

// Tienda - Nueva venta (para vendedor)
export async function notifyStoreNewSale({ orderId, orderNumber, productName, sellerId }) {
  return createNotification({
    userId: sellerId,
    type: NOTIFICATION_TYPES.STORE_NEW_SALE,
    title: "¡Nueva venta! 💰",
    body: `Vendiste: ${productName}`,
    data: { orderId },
  });
}

// Aprobar solicitud de partido
export async function notifyMatchApproved({ matchId, matchName, toUserId }) {
  return createNotification({
    userId: toUserId,
    type: 'match_request_approved',
    title: '✅ Solicitud aprobada',
    message: `Tu solicitud para "${matchName}" ha sido aprobada`,
    data: { matchId }
  });
}

// Rechazar solicitud de partido
export async function notifyMatchRejected({ matchId, matchName, toUserId }) {
  return createNotification({
    userId: toUserId,
    type: 'match_request_rejected',
    title: '❌ Solicitud rechazada',
    body: `Tu solicitud para "${matchName}" ha sido rechazada`,
    data: { matchId }
  });
}

// Mensaje en chat de partido
export async function notifyMatchMessage({ matchId, matchName, fromUserId, fromUserName, toUserId, messagePreview }) {
  return createNotification({
    userId: toUserId,
    type: 'match_message_new',
    title: `💬 ${fromUserName}`,
    body: `${messagePreview}... en "${matchName}"`,
    data: { matchId, fromUserId }
  });
}

// Engagement - Te echamos de menos
export async function notifyEngagementMissYou({ userId, userName, daysSinceLastLogin }) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.ENGAGEMENT_MISS_YOU,
    title: "¡Te echamos de menos! 🦍",
    body: `Hace ${daysSinceLastLogin} días que no juegas. ¿Qué tal un partido?`,
    data: { daysSinceLastLogin },    
  });
  
}