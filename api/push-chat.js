// api/push-chat.js
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const VAPID_PUBLIC =
      process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
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
    const { matchId, messageId } = body || {};

    if (!messageId) return res.status(400).send("Missing messageId");

    // 1) Leer mensaje (✅ maybeSingle => NO revienta si no existe)
    const { data: msg, error: msgErr } = await supabase
      .from("match_messages")
      .select("id, match_id, user_id, message, created_at")
      .eq("id", messageId)
      .maybeSingle();

    if (msgErr) return res.status(500).send(msgErr.message);
    if (!msg) return res.status(404).send("Message not found (check you used IDs from PROD)");

    const matchIdFromMsg = msg.match_id;

    // Si viene matchId y NO coincide con el del mensaje, avisamos (esto caza errores de “copié el id incorrecto”)
    if (matchId && matchId !== matchIdFromMsg) {
      return res
        .status(400)
        .send(`matchId does not match message.match_id (got ${matchId}, expected ${matchIdFromMsg})`);
    }

    // 2) Leer partido (para título)
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, start_at, created_by_user")
      .eq("id", matchIdFromMsg)
      .maybeSingle();

    if (matchErr) return res.status(500).send(matchErr.message);
    if (!match) return res.status(404).send("Match not found");

    // 3) Destinatarios = creador + aprobados (sin autor)
    const { data: approved, error: apprErr } = await supabase
      .from("match_join_requests")
      .select("user_id")
      .eq("match_id", matchIdFromMsg)
      .eq("status", "approved");

    if (apprErr) return res.status(500).send(apprErr.message);

    const recipients = new Set();
    if (match.created_by_user) recipients.add(match.created_by_user);
    for (const r of approved || []) if (r.user_id) recipients.add(r.user_id);

    // no enviar al autor del mensaje
    recipients.delete(msg.user_id);

    const recipientIds = Array.from(recipients);
    if (recipientIds.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no recipients" });
    }

    // 4) Cargar subs
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    if (subsErr) return res.status(500).send(subsErr.message);

    const payload = JSON.stringify({
      type: "chat",
      matchId: matchIdFromMsg,
      title: `Nuevo mensaje en ${match.club_name || "partido"}`,
      body: msg.message?.slice(0, 120) || "Mensaje nuevo",
      url: `/partidos?openChat=${encodeURIComponent(matchIdFromMsg)}`,
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
      }
    }

    return res.status(200).json({
      ok: true,
      matchId: matchIdFromMsg,
      recipients: recipientIds.length,
      subs: (subs || []).length,
      sent,
      errors,
    });
  } catch (e) {
    return res.status(500).send(e?.message || "Server error");
  }
}
