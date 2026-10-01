import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

type LineSource = {
  type?: string;
  groupId?: string;
};

type LineWebhookEvent = {
  type?: string;
  source?: LineSource;
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function getSupabaseSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const expected = btoa(
    String.fromCharCode(...new Uint8Array(digest))
  );
  return constantTimeEqual(expected, signature);
}

async function getLineGroupName(groupId: string, accessToken: string) {
  if (!accessToken) return null;

  const response = await fetch(
    `https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/summary`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) return null;

  const body = (await response.json()) as { groupName?: string };
  return body.groupName?.trim() || null;
}

Deno.serve(async (request: Request) => {
  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecretKey = getSupabaseSecretKey();

  if (request.method === "GET") {
    return Response.json({
      status: "ready",
      configured: Boolean(
        channelSecret && accessToken && supabaseUrl && supabaseSecretKey
      ),
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!channelSecret || !supabaseUrl || !supabaseSecretKey) {
    console.error("LINE webhook is missing required server configuration.");
    return new Response("Server configuration missing", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (
    !signature ||
    !(await verifyLineSignature(rawBody, signature, channelSecret))
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: LineWebhookBody;
  try {
    payload = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const groupIds = [
    ...new Set(
      (payload.events ?? [])
        .filter((event) => event.source?.type === "group")
        .map((event) => event.source?.groupId)
        .filter((groupId): groupId is string => Boolean(groupId))
    ),
  ];

  if (groupIds.length > 0) {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: readError } = await supabase
      .from("line_notification_settings")
      .select("group_id")
      .eq("id", true)
      .maybeSingle();

    if (readError) {
      console.error("Unable to read LINE notification settings.", readError);
      return new Response("Database error", { status: 500 });
    }

    if (!existing) {
      const groupId = groupIds[0];
      const groupName = await getLineGroupName(groupId, accessToken);
      const { error: insertError } = await supabase
        .from("line_notification_settings")
        .insert({ id: true, group_id: groupId, group_name: groupName });

      if (insertError && insertError.code !== "23505") {
        console.error("Unable to bind LINE notification group.", insertError);
        return new Response("Database error", { status: 500 });
      }
    }
  }

  return Response.json({ ok: true });
});
