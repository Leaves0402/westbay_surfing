import { createClient } from "@/lib/supabase/client";

export type LineNotificationKind = "announcement" | "lesson" | "trip";

export async function sendLineNotification(
  kind: LineNotificationKind,
  resourceId: string
) {
  const supabase = createClient();
  const { error } = await supabase.functions.invoke("send-line-notification", {
    body: { kind, resourceId },
  });

  return error ? error.message : null;
}
