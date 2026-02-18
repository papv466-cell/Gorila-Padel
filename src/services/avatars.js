import { supabase } from "./supabaseClient";

/**
 * Sube un avatar al bucket `avatars` y devuelve la URL pública.
 * Guarda en ruta: <userId>/avatar.<ext>
 */
export async function uploadAvatarFile({ userId, file }) {
  if (!userId) throw new Error("Falta userId");
  if (!file) throw new Error("Falta file");

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Formato no válido. Usa JPG, PNG o WEBP.");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar.${ext}`;

  // Subimos (upsert=true para reemplazar si ya había)
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) throw upErr;

  // URL pública
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) throw new Error("No se pudo obtener la URL pública del avatar.");

  // Truco: cache busting para que se refresque aunque el navegador lo cachee
  return `${publicUrl}?v=${Date.now()}`;
}
