import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).send("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).send("Missing VAPID public/private keys");

    webpush.setVapidDetails("mailto:papv466@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { matchId, requestId } = body || {};

    if (!matchId || !requestId) {
      return res.status(400).json({ ok: false, error: "Missing matchId or requestId" });
    }

    // 1) match
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, created_by_user, start_at")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return res.status(500).json({ ok: false, error: matchErr?.message || "Match not found" });
    }

    const creatorId = match.created_by_user;
    if (!creatorId) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no creator" });
    }

    // 2) request
    const { data: reqRow, error: reqErr } = await supabase
      .from("match_join_requests")
      .select("id, match_id, user_id, status, created_at")
      .eq("id", requestId)
      .single();

    if (reqErr || !reqRow) {
      return res.status(500).json({ ok: false, error: reqErr?.message || "Request not found" });
    }

    if (reqRow.user_id === creatorId) {
      return res.status(200).json({ ok: true, sent: 0, reason: "self" });
    }

    // 3) subs del creador
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, updated_at, created_at")
      .eq("user_id", creatorId);

    if (subsErr) {
      return res.status(500).json({ ok: false, error: subsErr.message });
    }

    if (!subs || subs.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no subs" });
    }

    const payload = JSON.stringify({
      type: "join_request",
      matchId,
      title: `Nueva solicitud en ${match.club_name || "tu partido"}`,
      body: "Alguien quiere unirse. Entra para aprobar o rechazar.",
      url: `/partidos?openRequests=${encodeURIComponent(matchId)}`,
    });

    let sent = 0;
    const errors = [];

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        // ✅ FIX: acumular errores sin cortar el loop — si un dispositivo falla, los demás siguen
        errors.push({ endpoint: s.endpoint?.slice(0, 40), err: e?.message });
      }
    }

    // ✅ FIX: eliminado subsPreview de la respuesta (exponía datos internos)
    return res.status(200).json({
      ok: true,
      sent,
      subs: subs.length,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}