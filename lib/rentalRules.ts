import { createClient } from "@/lib/supabase/client";

export const MAX_RENTAL_RULES_LENGTH = 10000;

export async function fetchRentalRules() {
  const { data, error } = await createClient()
    .from("rental_rules")
    .select("content")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data?.content as string | undefined) ?? "";
}

export async function saveRentalRules(content: string) {
  const { data, error } = await createClient()
    .from("rental_rules")
    .upsert({ id: 1, content: content.trim() }, { onConflict: "id" })
    .select("content")
    .single();
  if (error) throw error;
  return data.content as string;
}
