import { supabase } from "./supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function ensurePushSubscription() {
  // 1) soporte
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker no soportado");
  if (!("PushManager" in window)) throw new Error("Push no soportado en este navegador");

  // 2) sesión
  const { data: s } = await supabase.auth.getSession();
  if (!s?.session?.user) throw new Error("Necesitas iniciar sesión");

  // 3) permiso
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado");

  // 4) VAPID public key (la pondremos en env)
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Falta VITE_VAPID_PUBLIC_KEY");

  // 5) service worker registration
  const reg = await navigator.serviceWorker.ready;

  // 6) suscripción
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  // 7) guardar en supabase
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) throw new Error("Suscripción inválida");

  const { data, error } = await supabase
  .from("push_subscriptions")
  .upsert(
    {
      user_id: s.session.user.id,
      endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  )
  .select();

console.log("✅ UPSERT DATA:", data);
console.log("❌ UPSERT ERROR:", error);

if (error) throw error;
return true;
}
