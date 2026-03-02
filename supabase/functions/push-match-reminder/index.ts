// Edge Function: recordatorio push 30min antes de reserva de pista
// Cron: cada 15 minutos

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendPush(endpoint: string, p256dh: string, auth: string, payload: object) {
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

  const { default: webpush } = await import("npm:web-push");
  webpush.setVapidDetails("mailto:hola@gorilapadel.com", VAPID_PUBLIC, VAPID_PRIVATE);

  await webpush.sendNotification(
    { endpoint, keys: { p256dh, auth } },
    JSON.stringify(payload)
  );
}

Deno.serve(async () => {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in45 = new Date(now.getTime() + 45 * 60 * 1000);

    // Formato HH:MM para comparar con start_time
    const from = in30.toTimeString().slice(0, 5);
    const to   = in45.toTimeString().slice(0, 5);
    const today = now.toISOString().slice(0, 10);

    // Reservas confirmadas que empiezan entre 30 y 45 min
    const { data: bookings, error } = await supabase
      .from("court_bookings")
      .select("id, user_id, club_id, date, start_time, end_time")
      .eq("status", "confirmed")
      .eq("date", today)
      .gte("start_time", from)
      .lt("start_time", to);

    if (error) throw error;
    if (!bookings?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    let sent = 0;
    for (const booking of bookings) {
      // Obtener push subscription del usuario
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", booking.user_id);

      if (!subs?.length) continue;

      // Obtener nombre del club
      const { data: admin } = await supabase
        .from("club_admins")
        .select("club_name")
        .eq("club_id", booking.club_id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      const clubName = admin?.club_name || booking.club_id;
      const hora = booking.start_time?.slice(0, 5);

      const payload = {
        title: `⏰ Tu pista en ${clubName} empieza en 30 min`,
        body: `Reserva a las ${hora}. ¡No llegues tarde!`,
        icon: "/icon-192.png",
        data: {
          url: `/club/${booking.club_id}`,
          type: "booking_reminder",
        },
      };

      for (const sub of subs) {
        try {
          await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload);
          sent++;
        } catch {}
      }

      // Guardar notificación en BD
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        type: "booking_reminder",
        title: payload.title,
        body: payload.body,
        data: { url: `/club/${booking.club_id}`, bookingId: booking.id },
      });
    }

    return new Response(JSON.stringify({ sent, bookings: bookings.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
