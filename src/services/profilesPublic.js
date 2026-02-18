import { supabase } from "./supabaseClient";

// Lee perfiles por lista de userIds (uuid)
export async function fetchProfilesByIds(userIds = []) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,age,sex,level,hand")
    .in("id", ids);

  if (error) throw error;

  const map = {};
  for (const p of data ?? []) map[p.id] = p;
  return map;
}
