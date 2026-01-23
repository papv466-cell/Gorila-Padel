import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).send("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return res.status(500).send("Missing VAPID public/private keys");
    }

    webpush.setVapidDetails("mailto:admin@gorila.app", VAPID_PUBLIC, VAPID_PRIVATE);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { messageId } = body || {};
    if (!messageId) return res.status(400).send("Missing messageId");

    // 1) leer mensaje y sacar matchId de verdad
    const { data: msg, error: msgErr } = await supabase
      .from("match_messages")
      .select("id, match_id, user_id, message, created_at")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) return res.status(500).send(msgErr?.message || "Message not found");

    const matchId = msg.match_id;

    // 2) leer partido (para título + creador)
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, start_at, created_by_user")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) return res.status(500).send(matchErr?.message || "Match not found");

    // 3) destinatarios:
    // - creador
    // - joiners approved/pending
    // - gente que ya ha escrito en el chat (histórico)
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

    // no enviar al autor del mensaje
    recipients.delete(msg.user_id);

    const recipientIds = Array.from(recipients);
    if (recipientIds.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no recipients" });
    }

    // 4) cargar subs push
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    if (subsErr) return res.status(500).send(subsErr.message);

    const payload = JSON.stringify({
      type: "chat",
      matchId,
      title: `Nuevo mensaje en ${match.club_name || "partido"}`,
      body: msg.message?.slice(0, 120) || "Mensaje nuevo",
      url: `/partidos?openChat=${encodeURIComponent(matchId)}`,
    });

    let sent = 0;
    const errors = [];

    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        errors.push(String(e?.message || e));
        // opcional: podrías borrar subs muertas aquí si quieres
      }
    }

    return res.status(200).json({
      ok: true,
      recipients: recipientIds.length,
      subs: (subs || []).length,
      sent,
      errors,
    });
  } catch (e) {
    return res.status(500).send(e?.message || "Server error");
  }
}
