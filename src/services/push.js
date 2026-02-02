import { supabase } from "./supabaseClient";

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

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

export async function ensurePushSubscription() {
  if (typeof window === "undefined") throw new Error("Push solo funciona en navegador.");
  if (!("Notification" in window)) throw new Error("Este navegador no soporta notificaciones.");
  if (!("serviceWorker" in navigator)) throw new Error("No hay Service Worker disponible.");
  if (!("PushManager" in window)) throw new Error("Push no soportado en este navegador.");

  // 1) Permiso
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado.");

  // 2) VAPID public (frontend)
  const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC) throw new Error("Falta VITE_VAPID_PUBLIC_KEY en tu .env");

  // 3) SW ready
  const reg = await navigator.serviceWorker.ready;

  // 4) Subscription
  let sub = await reg.pushManager.getSubscription();
  let reused = true;

  if (!sub) {
    reused = false;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  }

  // 5) Sesión
  const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  const session = sessData?.session;
  if (!session?.user) throw new Error("No hay sesión activa para guardar Push.");

  // 6) Payload
  const json = sub.toJSON();
  const payload = {
    user_id: session.user.id,
    endpoint: sub.endpoint,
    p256dh: json?.keys?.p256dh || "",
    auth: json?.keys?.auth || "",
    user_agent: navigator.userAgent || "",
    platform: navigator.platform || "",
    updated_at: new Date().toISOString(),
  };

  // 7) Upsert (requiere UNIQUE endpoint + policy update/insert)
  const { error: upErr } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "user_id,endpoint" });


  if (upErr) {
    console.error("❌ push_subscriptions upsert error:", upErr);
    throw upErr;
  }

  console.log("✅ push_subscriptions saved", { reused, endpoint: payload.endpoint });

  return { ok: true, reused, endpoint: payload.endpoint };
}
