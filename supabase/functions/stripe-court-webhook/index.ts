import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: "2023-10-16" });
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_COURT_WEBHOOK_SECRET");
  let event;
  try { event = stripe.webhooks.constructEvent(body, sig, webhookSecret); }
  catch (e) { return new Response("Webhook error: " + e.message, { status: 400 }); }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const { slotId, userId, matchId, courtId, date, startTime } = pi.metadata;
    const { data: slot } = await supabase.from("court_slots").select("*").eq("id", slotId).single();
    if (slot) {
      // 1. Confirmar reserva
      await supabase.from("court_slots").update({ status: "booked" }).eq("id", slotId);
      await supabase.from("court_bookings").insert({
        club_id: slot.club_id, court_number: courtId, user_id: userId,
        date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
        price_cents: pi.amount, status: "confirmed",
        match_id: matchId || null, stripe_payment_intent: pi.id
      });

      // 2. Notificar jugador
      await supabase.from("notifications").insert({
        user_id: userId, type: "booking_confirmed",
        title: "Reserva confirmada",
        body: "Tu pista del " + date + " a las " + startTime + " ha sido confirmada y pagada.",
        data: { slotId, date, startTime }
      });

      // 3. Registrar donación 10cts
      try {
        // Buscar fundación del club
        const { data: club } = await supabase.from("clubs")
          .select("foundation_id, custom_foundation_name, custom_foundation_iban")
          .eq("id", slot.club_id).single();

        const foundationId = club?.foundation_id || null;
        const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

        // Upsert en club_donations — suma 10cts al mes actual
        const { data: existing } = await supabase.from("club_donations")
          .select("id, total_cents, match_count")
          .eq("club_id", slot.club_id)
          .eq("month", currentMonth)
          .maybeSingle();

        if (existing) {
          await supabase.from("club_donations").update({
            total_cents: (existing.total_cents || 0) + 10,
            match_count: (existing.match_count || 0) + 1,
            foundation_id: foundationId,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("club_donations").insert({
            club_id: slot.club_id,
            foundation_id: foundationId,
            month: currentMonth,
            total_cents: 10,
            match_count: 1,
            transferred: false,
          });
        }
      } catch (donationError) {
        console.error("Error registrando donación:", donationError);
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await supabase.from("court_slots").update({ status: "available" }).eq("id", pi.metadata.slotId);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
