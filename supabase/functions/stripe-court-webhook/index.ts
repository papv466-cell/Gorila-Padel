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
      await supabase.from("court_slots").update({ status: "booked" }).eq("id", slotId);
      await supabase.from("court_bookings").insert({ club_id: slot.club_id, court_number: courtId, user_id: userId, date: slot.date, start_time: slot.start_time, end_time: slot.end_time, price_cents: pi.amount, status: "confirmed", match_id: matchId || null, stripe_payment_intent: pi.id });
      await supabase.from("notifications").insert({ user_id: userId, type: "booking_confirmed", title: "Reserva confirmada", body: "Tu pista del " + date + " a las " + startTime + " ha sido confirmada y pagada.", data: { slotId, date, startTime } });
    }
  }
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await supabase.from("court_slots").update({ status: "available" }).eq("id", pi.metadata.slotId);
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});