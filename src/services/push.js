import { supabase } from "./supabaseClient";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function explainPushSupport() {
  if (!("serviceWorker" in navigator)) return "Service Worker no soportado";
  if (!("PushManager" in window)) return "Push no soportado en este navegador";
  if (!("Notification" in window)) return "Notificaciones no soportadas";
  return null;
}

export async function ensurePushSubscription() {
  const supportError = explainPushSupport();
  if (supportError) throw new Error(supportError);

  // 👇 Incógnito suele fallar / bloquear push
  // no es bug, pero damos mensaje humano si pasa.
  // (no hay API 100% fiable, pero esto evita dramas)
  if (navigator.userAgent.includes("Incognito")) {
    // no siempre existe, lo dejamos suave
  }

  const { data: s } = await supabase.auth.getSession();
  if (!s?.session?.user) throw new Error("Necesitas iniciar sesión");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado");

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error("Falta VITE_VAPID_PUBLIC_KEY (en Vercel y en tu .env local)");

  // Espera a que el SW esté listo
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) throw new Error("Suscripción inválida");

  const { error } = await supabase
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
    );

  if (error) throw error;

  return true;
}
