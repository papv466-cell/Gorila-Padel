import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 1) Token del header Authorization: Bearer <token>
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Crear clientes
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(url, serviceKey);
    const supabaseAnon = createClient(url, anonKey);

    // 3) Validar usuario a partir del token (sin fiarnos del cliente)
    const { data: u, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !u?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    // 4) Matches donde el user puede ver chat:
    // - es creador del match
    // - o tiene request pending/approved
    const { data: myCreated } = await supabaseAdmin
      .from("matches")
      .select("id")
      .eq("created_by_user", userId);

    const { data: myReq } = await supabaseAdmin
      .from("match_requests")
      .select("match_id,status")
      .eq("user_id", userId)
      .in("status", ["pending", "approved"]);

    const matchIds = new Set<string>();
    for (const r of myCreated ?? []) matchIds.add(r.id);
    for (const r of myReq ?? []) matchIds.add(r.match_id);

    const ids = Array.from(matchIds);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ title: "Gorila Padel", body: "Sin mensajes nuevos", url: "/partidos" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5) Último mensaje en esos matches
    const { data: lastMsg } = await supabaseAdmin
      .from("match_messages")
      .select("id, match_id, user_id, message, created_at")
      .in("match_id", ids)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastMsg) {
      return new Response(JSON.stringify({ title: "Gorila Padel", body: "Sin mensajes nuevos", url: "/partidos" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6) Respuesta para notificación (simple)
    const title = "Nuevo mensaje";
    const body = String(lastMsg.message ?? "").slice(0, 120);
    const urlOut = `/partidos?openChat=${lastMsg.match_id}`;

    return new Response(JSON.stringify({ title, body, url: urlOut }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
