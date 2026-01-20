import { supabase } from "./supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function getKeyAsBase64(subscription, keyName) {
  const key = subscription.getKey(keyName);
  if (!key) return null;
  const bytes = new Uint8Array(key);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function explainPushSupport() {
  if (!("serviceWorker" in navigator)) return "Service Worker no soportado";
  if (!("PushManager" in window)) return "Push no soportado en este navegador";
  if (!("Notification" in window)) return "Notificaciones no soportadas";
  return null;
}

export async function ensurePushSubscription() {
  console.log("[push] ensurePushSubscription()");

  const supportError = explainPushSupport();
  if (supportError) throw new Error(supportError);

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const user = authData?.user;
  if (!user) throw new Error("Necesitas iniciar sesión");

  const perm = await Notification.requestPermission();
  console.log("[push] permiso:", perm);
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado");

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Falta VITE_VAPID_PUBLIC_KEY (en Vercel y en tu .env local)");

  const reg = await navigator.serviceWorker.ready;
  console.log("[push] SW listo:", reg.scope);

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    console.log("[push] creando subscription…");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } else {
    console.log("[push] reutilizando subscription existente");
  }

  const endpoint = sub.endpoint;
  const p256dh = getKeyAsBase64(sub, "p256dh");
  const auth = getKeyAsBase64(sub, "auth");

  if (!endpoint || !p256dh || !auth) throw new Error("Subscription inválida: faltan endpoint/p256dh/auth");

  const payload = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  };

  console.log("[push] upsert push_subscriptions:", endpoint.slice(0, 60) + "…");

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "user_id,endpoint" });

  if (error) throw error;

  console.log("[push] ✅ guardado en push_subscriptions");
  return sub;
}
