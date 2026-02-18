import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // ✅ CORS (solo para local)
    const origin = req.headers.origin || "";
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
    if (isLocal) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    // ✅ ENV LIMPIO (backend)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE)
      return res.status(500).send("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    if (!VAPID_PUBLIC || !VAPID_PRIVATE)
      return res.status(500).send("Missing VAPID public/private keys");

    webpush.setVapidDetails("mailto:papv466@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { messageId } = body || {};
    if (!messageId) return res.status(400).send("Missing messageId");

    // 1) Leer mensaje
    const { data: msg, error: msgErr } = await supabase
      .from("match_messages")
      .select("id, match_id, user_id, message, created_at")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) return res.status(500).send(msgErr?.message || "Message not found");

    const matchId = msg.match_id;

    // 2) Leer partido
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, created_by_user")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) return res.status(500).send(matchErr?.message || "Match not found");

    // 3) Recipients (creador + joiners + participantes chat)
    const recipients = new Set();
    if (match.created_by_user) recipients.add(match.created_by_user);

    const { data: joiners, error: joinErr } = await supabase
      .from("match_join_requests")
      .select("user_id, status")
      .eq("match_id", matchId)
      .in("status", ["approved", "pending"]);
    if (joinErr) return res.status(500).send(joinErr.message);
    for (const r of joiners || []) if (r.user_id) recipients.add(r.user_id);

    const { data: chatUsers, error: chatUsersErr } = await supabase
      .from("match_messages")
      .select("user_id")
      .eq("match_id", matchId);
    if (chatUsersErr) return res.status(500).send(chatUsersErr.message);
    for (const r of chatUsers || []) if (r.user_id) recipients.add(r.user_id);

    // No mandarse a uno mismo
    recipients.delete(msg.user_id);

    const recipientIds = Array.from(recipients);
    if (recipientIds.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no recipients" });
    }

    // 4) Cargar subs
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth, updated_at")
      .in("user_id", recipientIds);

    if (subsErr) return res.status(500).send(subsErr.message);

    // 🔥 CRÍTICO: si hay varias subs del mismo user, quédate con la MÁS NUEVA
    const byUser = new Map();
    for (const s of subs || []) {
      const prev = byUser.get(s.user_id);
      if (!prev) byUser.set(s.user_id, s);
      else {
        const prevTs = new Date(prev.updated_at || 0).getTime();
        const curTs = new Date(s.updated_at || 0).getTime();
        if (curTs >= prevTs) byUser.set(s.user_id, s);
      }
    }
    const finalSubs = Array.from(byUser.values());

    const payload = JSON.stringify({
      type: "chat",
      matchId,
      title: `Nuevo mensaje en ${match.club_name || "partido"}`,
      body: msg.message?.slice(0, 120) || "Mensaje nuevo",
      url: `/partidos?openChat=${encodeURIComponent(matchId)}`,
    });

    let sent = 0;
    const errors = [];

    for (const s of finalSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        // No exponer detalles del error
        console.error('[PUSH_CHAT_ERROR]', e);
        
        return res.status(500).json({ 
          ok: false, 
          error: 'Error al enviar notificaciones'
        });
      }
    }

    return res.status(200).json({
      ok: true,
      matchId,
      messageId,
      authorId: msg.user_id,
      recipients: recipientIds.length,
      subs: finalSubs.length,
      sent,
      recipientIds,
      errors,
    });
  } catch (e) {
    return res.status(500).send(e?.message || "Server error");
  }
}
