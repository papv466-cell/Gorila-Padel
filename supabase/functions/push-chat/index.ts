import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint" }),
        { status: 400 }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error("Missing VAPID env vars");
    }

    // 👉 Push SIN payload (solo despertar)
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "60",
      },
    });

    // Si la suscripción murió, avisamos
    if (res.status === 404 || res.status === 410) {
      return new Response(
        JSON.stringify({ gone: true }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
