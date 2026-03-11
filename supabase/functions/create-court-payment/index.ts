import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: "2023-10-16" });
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { slotId, userId, matchId, split, splitWith } = await req.json();
    if (!slotId || !userId) throw new Error("slotId y userId requeridos");

    const { data: slot } = await supabase
      .from("court_slots")
      .select("*, club_courts(name)")
      .eq("id", slotId)
      .single();
    if (!slot) throw new Error("Slot no encontrado");
    if (slot.status !== "available") throw new Error("Este slot ya no está disponible");

    const { data: { user } } = await supabase.auth.admin.getUserById(userId);

    // Si es split, dividir entre 4 jugadores
    const totalPlayers = split && splitWith?.length ? 1 + splitWith.length : 1;
    const splitCount = split ? Math.max(totalPlayers, 2) : 1;
    const pricePerPlayer = split ? (slot.price || 0) / splitCount : (slot.price || 0);
    const amount = Math.round(pricePerPlayer * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      metadata: {
        slotId,
        userId,
        matchId: matchId || "",
        courtId: String(slot.court_id),
        date: slot.date,
        startTime: slot.start_time,
        split: split ? "true" : "false",
        splitWith: splitWith ? splitWith.join(",") : "",
        splitCount: String(splitCount),
      },
      receipt_email: user?.email,
      description: `Reserva ${slot.club_courts?.name || ""} - ${slot.date} ${slot.start_time?.slice(0,5)}${split ? ` (1/${splitCount})` : ""}`,
    });

    // Marcar slot como pending
    await supabase.from("court_slots").update({ status: "pending" }).eq("id", slotId);

    // Si hay split, guardar registro de split en BD para notificar a otros jugadores
    if (split && splitWith?.length > 0) {
      await supabase.from("split_payment_requests").upsert({
        slot_id: slotId,
        initiator_id: userId,
        player_ids: [userId, ...splitWith],
        split_count: splitCount,
        price_per_player: pricePerPlayer,
        payment_intent_id: paymentIntent.id,
        status: "pending",
      }).select();
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        amount,
        pricePerPlayer,
        splitCount,
        slotData: {
          courtName: slot.club_courts?.name,
          date: slot.date,
          startTime: slot.start_time?.slice(0,5),
          endTime: slot.end_time?.slice(0,5),
          price: slot.price,
          pricePerPlayer,
          split,
          splitCount,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
