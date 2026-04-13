import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.3.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: "2023-10-16" });
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { leagueId, userId, pricePerPlayer } = await req.json();
    if (!leagueId || !userId) throw new Error("Faltan parámetros");

    const fee = 0.30;
    const price = parseFloat(pricePerPlayer || 0);
    const total = price + fee;
    const amountCents = Math.max(50, Math.round(total * 100));

    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      const customer = await stripe.customers.create({ email: user?.email || "", metadata: { userId } });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents, currency: "eur",
      customer: customerId,
      metadata: { leagueId, userId, source: "league_inscription", pricePerPlayer: String(price) },
      description: `Inscripción liga GorilaGo! + 0.30€ comisión`,
      setup_future_usage: "off_session",
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret, amountCents, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
