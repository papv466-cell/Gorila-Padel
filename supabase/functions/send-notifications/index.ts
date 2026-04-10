import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP = Deno.env.get("TWILIO_WHATSAPP_FROM"); // "whatsapp:+14155238886"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

async function sendWhatsApp(to: string, message: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WHATSAPP) {
    console.log("WhatsApp no configurado — guardando en cola:", message);
    return { queued: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: TWILIO_WHATSAPP,
      To: `whatsapp:${to}`,
      Body: message,
    }).toString(),
  });
  return res.json();
}

async function queueWhatsApp(userId: string, eventType: string, message: string, scheduledFor: string, metadata: object = {}) {
  const { data: profile } = await supabase.from("profiles").select("phone, whatsapp_opt_in").eq("id", userId).single();
  if (!profile?.phone || !profile?.whatsapp_opt_in) return;
  await supabase.from("whatsapp_queue").insert({
    user_id: userId,
    phone: profile.phone,
    message,
    event_type: eventType,
    scheduled_for: scheduledFor,
    sent: false,
    metadata,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1hStr = in1h.toISOString();
    const in24hStr = in24h.toISOString();
    const nowStr = now.toISOString();

    // 1. Recordatorios 1 hora antes — partidos pádel
    const { data: matchesSoon } = await supabase
      .from("matches")
      .select("id, club_name, start_at, player_ids")
      .gte("start_at", nowStr)
      .lte("start_at", in1hStr)
      .eq("status", "active");

    for (const match of matchesSoon || []) {
      for (const playerId of match.player_ids || []) {
        const msg = `🎾 ¡Tu partido empieza en 1 hora!\n📍 ${match.club_name}\n⏰ ${new Date(match.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\nÁnimo gorila 🦍`;
        await queueWhatsApp(playerId, "match_reminder_1h", msg, nowStr, { match_id: match.id });
        // Notificación in-app
        await supabase.from("notifications").insert({
          user_id: playerId, type: "match_reminder",
          title: "⏰ Tu partido empieza en 1 hora",
          body: `${match.club_name} — recuerda llegar con tiempo`,
          data: { match_id: match.id },
        });
      }
    }

    // 2. Recordatorios 24h antes — todos los deportes
    for (const table of ["matches", "tennis_matches", "pickleball_matches"]) {
      const { data: matchesTomorrow } = await supabase
        .from(table)
        .select("id, club_name, start_at, player_ids")
        .gte("start_at", in1hStr)
        .lte("start_at", in24hStr)
        .eq("status", "active");

      for (const match of matchesTomorrow || []) {
        for (const playerId of match.player_ids || []) {
          const sport = table === "tennis_matches" ? "🎾 Tenis" : table === "pickleball_matches" ? "🏓 Pickleball" : "🎾 Pádel";
          const msg = `${sport} — Mañana tienes partido!\n📍 ${match.club_name}\n⏰ ${new Date(match.start_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\nPreparado gorila 🦍`;
          await queueWhatsApp(playerId, "match_reminder_24h", msg, nowStr, { match_id: match.id });
          await supabase.from("notifications").insert({
            user_id: playerId, type: "match_reminder_24h",
            title: "📅 Mañana tienes partido",
            body: `${match.club_name}`,
            data: { match_id: match.id },
          });
        }
      }
    }

    // 3. Recordatorios clases con profesor
    const { data: classesSoon } = await supabase
      .from("class_bookings")
      .select("id, student_id, teacher_id, date, start_time, teachers(name)")
      .eq("status", "confirmed")
      .gte("date", now.toISOString().slice(0,10))
      .lte("date", in24h.toISOString().slice(0,10));

    for (const booking of classesSoon || []) {
      const msg = `📚 Clase con ${booking.teachers?.name} mañana!\n⏰ ${booking.start_time?.slice(0,5)}\n\nA por ello 🦍`;
      await queueWhatsApp(booking.student_id, "class_reminder", msg, nowStr, { booking_id: booking.id });
      await supabase.from("notifications").insert({
        user_id: booking.student_id, type: "class_reminder",
        title: `📚 Clase mañana con ${booking.teachers?.name}`,
        body: `A las ${booking.start_time?.slice(0,5)}`,
        data: { booking_id: booking.id },
      });
    }

    // 4. Enviar mensajes pendientes de la cola
    const { data: pending } = await supabase
      .from("whatsapp_queue")
      .select("*")
      .eq("sent", false)
      .lte("scheduled_for", nowStr)
      .limit(50);

    let sent = 0;
    for (const msg of pending || []) {
      try {
        await sendWhatsApp(msg.phone, msg.message);
        await supabase.from("whatsapp_queue").update({ sent: true, sent_at: nowStr }).eq("id", msg.id);
        sent++;
      } catch (e) {
        await supabase.from("whatsapp_queue").update({ error: e.message }).eq("id", msg.id);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      reminders_created: (matchesSoon?.length || 0) + (classesSoon?.length || 0),
      whatsapp_sent: sent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
