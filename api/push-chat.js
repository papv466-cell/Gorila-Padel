// api/push-chat.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

function isUUID(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function getEnv(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // ✅ Import robusto de web-push para evitar crash en Vercel
  let webpush;
  try {
    const mod = await import("web-push");
    webpush = mod.default ?? mod; // funciona tanto si viene default como si viene namespace
  } catch (e) {
    return res
      .status(500)
      .send("web-push import failed: " + (e?.message || String(e)));
  }

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
    const SERVICE_ROLE = getEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE",
      "SERVICE_ROLE_KEY"
    );

    // 👇 puedes tenerlas como VAPID_* o VITE_VAPID_*
    const VAPID_PUBLIC = getEnv("VAPID_PUBLIC_KEY", "VITE_VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = getEnv("VAPID_PRIVATE_KEY", "VITE_VAPID_PRIVATE_KEY");

    if (!SUPABASE_URL) return res.status(500).send("Missing SUPABASE_URL");
    if (!SERVICE_ROLE) return res.status(500).send("Missing SUPABASE_SERVICE_ROLE_KEY");
    if (!VAPID_PUBLIC) return res.status(500).send("Missing VAPID_PUBLIC_KEY");
    if (!VAPID_PRIVATE) return res.status(500).send("Missing VAPID_PRIVATE_KEY");

    // ✅ set vapid
    try {
      webpush.setVapidDetails("mailto:admin@gorila.app", VAPID_PUBLIC, VAPID_PRIVATE);
    } catch (e) {
      return res.status(500).send("setVapidDetails failed: " + (e?.message || String(e)));
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { matchId, messageId } = body || {};

    if (!isUUID(matchId)) return res.status(400).send("Invalid matchId (uuid required)");
    if (!isUUID(messageId)) return res.status(400).send("Invalid messageId (uuid required)");

    // 1) mensaje
    const { data: msg, error: msgErr } = await supabase
      .from("match_messages")
      .select("id, match_id, user_id, message, created_at")
      .eq("id", messageId)
      .single();

    if (msgErr || !msg) return res.status(500).send(msgErr?.message || "Message not found");

    // 2) partido
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, start_at, created_by_user")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) return res.status(500).send(matchErr?.message || "Match not found");

    // 3) destinatarios = creador + aprobados - autor
    const { data: approved, error: apprErr } = await supabase
      .from("match_join_requests")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("status", "approved");

    if (apprErr) return res.status(500).send(apprErr.message);

    const recipients = new Set();
    if (match.created_by_user) recipients.add(match.created_by_user);
    for (const r of approved || []) if (r.user_id) recipients.add(r.user_id);

    recipients.delete(msg.user_id);

    const recipientIds = Array.from(recipients);
    if (recipientIds.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no recipients" });
    }

    // 4) subs
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    if (subsErr) return res.status(500).send(subsErr.message);

    const payload = JSON.stringify({
      type: "chat",
      matchId,
      title: `Nuevo mensaje en ${match.club_name || "partido"}`,
      body: (msg.message || "Mensaje nuevo").slice(0, 120),
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
        const emsg = String(e?.message || e);
        errors.push(emsg);

        // ✅ si está muerta (410/404 normalmente), la borramos para no acumular basura
        const code = e?.statusCode || e?.status || null;
        if (code === 410 || code === 404) {
          try {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
          } catch {}
        }
      }
    }

    return res.status(200).json({
      ok: true,
      recipients: recipientIds.length,
      subs: (subs || []).length,
      sent,
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    return res.status(500).send("push-chat crashed: " + (e?.message || String(e)));
  }
}
