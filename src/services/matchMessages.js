// src/services/matchMessages.js
import { supabase } from "./supabaseClient";

// Enviar mensaje + push
export async function sendMatchMessage({ matchId, message }) {
  const msg = String(message ?? "").trim();
  if (!msg) throw new Error("Escribe un mensaje.");
  if (msg.length > 1000) throw new Error("Máximo 1000 caracteres.");

  // Usuario actual
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth?.session?.user?.id;
  if (!userId) throw new Error("No hay sesión.");

  // 1️⃣ Guardar mensaje
  const { data: saved, error } = await supabase
    .from("match_messages")
    .insert([{ match_id: matchId, user_id: userId, message: msg }])
    .select("id")
    .single();

  // ✅ FIX: mover comprobación de error ANTES de usar saved.id
  if (error) throw error;

  // 🚀 Disparar push con el id correcto (saved.id, no data.id)
  try {
    await supabase.functions.invoke("push-last-message", {
      body: {
        matchId,
        messageId: saved.id,
      },
    });
  } catch (e) {
    console.warn("push-last-message falló (no bloquea el chat):", e);
  }

  // 2️⃣ Usuarios del partido (menos yo)
  const { data: participants } = await supabase
    .from("match_participants")
    .select("user_id")
    .eq("match_id", matchId)
    .neq("user_id", userId);

  if (!participants?.length) return saved;

  // 3️⃣ Push subscriptions de esos usuarios
  const userIds = participants.map(p => p.user_id);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .in("user_id", userIds);

  if (!subs?.length) return saved;

  // 4️⃣ Enviar push (solo TOC TOC)
  for (const sub of subs) {
    supabase.functions.invoke("push-chat", {
      body: { endpoint: sub.endpoint },
    }).catch(() => {});
  }

  return saved;
}