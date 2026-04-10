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
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    const authCheck = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { "apikey": Deno.env.get("SUPABASE_ANON_KEY"), "Authorization": `Bearer ${token}` },
    });
    const authUser = await authCheck.json();

    const { projectId, amount, userId } = await req.json();
    if (!projectId || !amount || amount < 0.5) throw new Error("Datos inválidos");

    const amountCents = Math.round(amount * 100);

    let customerId = null;
    if (userId) {
      const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).single();
      customerId = profile?.stripe_customer_id;
      if (!customerId && authUser?.email) {
        const customer = await stripe.customers.create({
          email: authUser.email,
          metadata: { userId },
        });
        customerId = customer.id;
        await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: { projectId, userId: userId || "anonymous", source: "donation" },
      description: "Donacion proyecto GorilaGo!",
      receipt_email: authUser?.email,
      ...(customerId ? { customer: customerId } : {}),
    });

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      amount,
      amountCents,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
