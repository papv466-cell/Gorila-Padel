import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // ✅ CORS básico (por si pruebas desde local contra Vercel)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ✅ VAPID: intenta varios nombres por si en Vercel los tienes distintos
    const VAPID_PUBLIC =
      process.env.VAPID_PUBLIC_KEY ||
      process.env.VITE_VAPID_PUBLIC_KEY ||
      process.env.VAPID_PUBLIC ||
      process.env.VITE_VAPID_PUBLIC;

    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({
        ok: false,
        where: "env",
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        has: {
          SUPABASE_URL: !!SUPABASE_URL,
          SERVICE_ROLE: !!SERVICE_ROLE,
        },
      });
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return res.status(500).json({
        ok: false,
        where: "env",
        error: "Missing VAPID public/private keys",
        has: {
          VAPID_PUBLIC: !!VAPID_PUBLIC,
          VAPID_PRIVATE: !!VAPID_PRIVATE,
        },
      });
    }

    webpush.setVapidDetails("mailto:admin@gorila.app", VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { matchId, requestId } = body || {};

    if (!matchId || !requestId) {
      return res.status(400).json({ ok: false, error: "Missing matchId or requestId", got: { matchId, requestId } });
    }

    // 1) match (para creador)
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, club_name, created_by_user, start_at")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return res.status(500).json({ ok: false, where: "matches", error: matchErr?.message || "Match not found" });
    }

    const creatorId = match.created_by_user;
    if (!creatorId) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no creator", matchId });
    }

    // 2) request (para saber quién solicita)
    const { data: reqRow, error: reqErr } = await supabase
      .from("match_join_requests")
      .select("id, match_id, user_id, status, created_at")
      .eq("id", requestId)
      .single();

    if (reqErr || !reqRow) {
      return res.status(500).json({ ok: false, where: "match_join_requests", error: reqErr?.message || "Request not found" });
    }

    if (reqRow.user_id === creatorId) {
      return res.status(200).json({ ok: true, sent: 0, reason: "self", creatorId, requesterId: reqRow.user_id });
    }

    // ✅ 3) buscar subs del creador
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, updated_at, created_at")
      .eq("user_id", creatorId);

    if (subsErr) {
      return res.status(500).json({ ok: false, where: "push_subscriptions", error: subsErr.message, creatorId });
    }

    // 🔍 DEBUG: te devolvemos lo que encontró (sin exponer keys completas)
    const subsPreview = (subs || []).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      endpoint_head: String(s.endpoint || "").slice(0, 60),
      hasKeys: !!(s.p256dh && s.auth),
      updated_at: s.updated_at,
      created_at: s.created_at,
    }));

    if (!subs || subs.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        reason: "no subs",
        debug: {
          matchId,
          requestId,
          creatorId,
          requesterId: reqRow.user_id,
          subsFound: 0,
          subsPreview,
        },
      });
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
        const statusCode = e?.statusCode || e?.status || null;
        errors.push({
          statusCode,
          message: String(e?.message || e),
          endpoint_head: String(s.endpoint || "").slice(0, 60),
        });

        // si está muerta, la borramos
        if (statusCode === 410) {
          try {
            await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } catch {}
        }
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      subs: subs.length,
      errors,
      debug: {
        matchId,
        requestId,
        creatorId,
        requesterId: reqRow.user_id,
        subsPreview,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, where: "catch", error: e?.message || "Server error" });
  }
}
