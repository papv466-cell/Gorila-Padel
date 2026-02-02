import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC =
      process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(500).send("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).send("Missing VAPID public/private keys");

    webpush.setVapidDetails("mailto:admin@gorila.app", VAPID_PUBLIC, VAPID_PRIVATE);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { matchId, requestId } = body || {};
    if (!matchId || !requestId) return res.status(400).send("Missing matchId or requestId");

    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, created_by_user, start_at")
      .eq("id", matchId)
      .single();
    if (matchErr || !match) return res.status(500).send(matchErr?.message || "Match not found");

    const creatorId = match.created_by_user;
    if (!creatorId) return res.status(200).json({ ok: true, sent: 0, reason: "no creator" });

    const { data: reqRow, error: reqErr } = await supabase
      .from("match_join_requests")
      .select("id, match_id, user_id, status, created_at")
      .eq("id", requestId)
      .single();
    if (reqErr || !reqRow) return res.status(500).send(reqErr?.message || "Request not found");

    if (reqRow.user_id === creatorId) return res.status(200).json({ ok: true, sent: 0, reason: "self" });

    // ✅ TU COLUMNA ES user_id
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", creatorId);

    if (subsErr) return res.status(500).send(subsErr.message);
    if (!subs || subs.length === 0) return res.status(200).json({ ok: true, sent: 0, reason: "no subs" });

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
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        const statusCode = e?.statusCode || e?.status || null;
        errors.push({ statusCode, message: String(e?.message || e) });

        if (statusCode === 410) {
          try {
            await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } catch {}
        }
      }
    }

    return res.status(200).json({ ok: true, subs: subs.length, sent, errors });
  } catch (e) {
    return res.status(500).send(e?.message || "Server error");
  }
}
