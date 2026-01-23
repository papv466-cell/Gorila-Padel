// src/services/push.js
import { supabase } from "./supabaseClient";

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// ✅ solo para UI: saber si el navegador ya tiene subscription
export async function isPushEnabledInBrowser() {
  try {
    if (!("Notification" in window)) return false;
    if (!("serviceWorker" in navigator)) return false;
    if (!("PushManager" in window)) return false;
    if (Notification.permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// ✅ Asegura subscription + la guarda en Supabase
export async function ensurePushSubscription() {
  console.log("[push] ensurePushSubscription()");

  if (!("Notification" in window)) throw new Error("Este navegador no soporta notificaciones.");
  if (!("serviceWorker" in navigator)) throw new Error("No hay Service Worker disponible.");
  if (!("PushManager" in window)) throw new Error("Push no soportado en este navegador.");

  const perm = await Notification.requestPermission();
  console.log("[push] permiso:", perm);
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado.");

  const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC) throw new Error("Falta VITE_VAPID_PUBLIC_KEY en .env / Vercel.");

  const reg = await navigator.serviceWorker.ready;
  console.log("[push] SW listo:", reg.scope);

  let sub = await reg.pushManager.getSubscription();
  let reused = true;

  if (!sub) {
    reused = false;
    console.log("[push] creando subscription…");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  } else {
    console.log("[push] reutilizando subscription existente");
  }

  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json?.keys?.p256dh || "";
  const auth = json?.keys?.auth || "";

  // ✅ requiere sesión porque guardamos la subscripción asociada a usuario
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa para guardar Push.");

  const payload = {
    user_id: session.user.id,
    endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  };

  console.log("[push] upsert push_subscriptions:", endpoint);
  const { error: upErr } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });

  if (upErr) throw upErr;

  console.log("[push] ✅ guardado en push_subscriptions");

  return { ok: true, reused, endpoint };
}
