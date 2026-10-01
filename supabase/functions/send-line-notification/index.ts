import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.0";

type NotificationKind = "announcement" | "lesson" | "trip";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const shorten = (value: string | null | undefined, limit = 300) => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1)}…`
    : normalized;
};

const formatDate = (value: string) => value.replaceAll("-", "/");
const formatTime = (value: string) => value.slice(0, 5);

const formatTaipeiDateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

const isNotificationKind = (value: unknown): value is NotificationKind =>
  value === "announcement" || value === "lesson" || value === "trip";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lineAccessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const siteUrl = (
    Deno.env.get("SITE_URL") ?? "https://westbay-surfing.vercel.app"
  ).replace(/\/+$/, "");

  if (!supabaseUrl || !serviceRoleKey || !lineAccessToken) {
    console.error("LINE notification function is missing required secrets.");
    return jsonResponse({ error: "通知服務尚未完成設定。" }, 500);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return jsonResponse({ error: "請先登入。" }, 401);
  }

  let payload: { kind?: unknown; resourceId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "無效的請求內容。" }, 400);
  }

  if (
    !isNotificationKind(payload.kind) ||
    typeof payload.resourceId !== "string" ||
    !payload.resourceId
  ) {
    return jsonResponse({ error: "缺少通知類型或內容編號。" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse({ error: "登入狀態已失效，請重新登入。" }, 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "找不到使用者資料。" }, 403);
  }

  const staffRoles = new Set(["officer", "admin"]);
  const memberRoles = new Set([
    "member",
    "board_manager",
    "officer",
    "admin",
  ]);
  const allowed =
    payload.kind === "trip"
      ? memberRoles.has(profile.role)
      : staffRoles.has(profile.role);

  if (!allowed) {
    return jsonResponse({ error: "你沒有發送這類通知的權限。" }, 403);
  }

  const { data: settings, error: settingsError } = await admin
    .from("line_notification_settings")
    .select("group_id")
    .eq("id", true)
    .maybeSingle();

  if (settingsError) {
    console.error("Failed to load LINE notification settings.");
    return jsonResponse({ error: "讀取 LINE 群組設定失敗。" }, 500);
  }
  if (!settings?.group_id) {
    return jsonResponse({ error: "尚未綁定 LINE 通知群組。" }, 409);
  }

  let message = "";

  if (payload.kind === "announcement") {
    const { data, error } = await admin
      .from("announcements")
      .select("title, content, created_by")
      .eq("id", payload.resourceId)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "找不到剛發布的公告。" }, 404);
    }
    if (data.created_by !== user.id) {
      return jsonResponse({ error: "只能發送自己剛發布的公告通知。" }, 403);
    }

    message = [
      `📢 新公告｜${shorten(data.title, 80)}`,
      "",
      shorten(data.content),
      "",
      "查看完整公告：",
      `${siteUrl}/announcements`,
    ].join("\n");
  }

  if (payload.kind === "lesson") {
    const { data, error } = await admin
      .from("lessons")
      .select(
        "lesson_date, start_time, end_time, registration_deadline, capacity, note, created_by"
      )
      .eq("id", payload.resourceId)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "找不到剛發布的社課。" }, 404);
    }
    if (data.created_by !== user.id) {
      return jsonResponse({ error: "只能發送自己剛發布的社課通知。" }, 403);
    }

    const lines = [
      "🏄 新社課發布！",
      `時間：${formatDate(data.lesson_date)} ${formatTime(data.start_time)}–${formatTime(data.end_time)}`,
      `名額：${data.capacity} 人`,
      `報名截止：${formatTaipeiDateTime(data.registration_deadline)}`,
    ];
    if (data.note?.trim()) lines.push(`備註：${shorten(data.note)}`);
    lines.push("", "前往網站報名：", `${siteUrl}/lessons`);
    message = lines.join("\n");
  }

  if (payload.kind === "trip") {
    const { data, error } = await admin
      .from("surf_trips")
      .select(
        "start_date, end_date, capacity, min_surf_level, note, created_by"
      )
      .eq("id", payload.resourceId)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "找不到剛發布的外衝活動。" }, 404);
    }
    if (data.created_by !== user.id) {
      return jsonResponse({ error: "只能發送自己剛發布的外衝通知。" }, 403);
    }

    const { data: tripSpots, error: tripSpotsError } = await admin
      .from("surf_trip_spots")
      .select("spot_id")
      .eq("trip_id", payload.resourceId);
    if (tripSpotsError) {
      return jsonResponse({ error: "讀取外衝地點失敗。" }, 500);
    }

    const spotIds = (tripSpots ?? []).map((item) => item.spot_id);
    let spotNames: string[] = [];
    if (spotIds.length > 0) {
      const { data: spots, error: spotsError } = await admin
        .from("surf_spots")
        .select("name, county")
        .in("id", spotIds);
      if (spotsError) {
        return jsonResponse({ error: "讀取外衝地點失敗。" }, 500);
      }
      spotNames = (spots ?? []).map((spot) =>
        spot.county ? `${spot.county}・${spot.name}` : spot.name
      );
    }

    const dateLabel =
      data.start_date === data.end_date
        ? formatDate(data.start_date)
        : `${formatDate(data.start_date)}–${formatDate(data.end_date)}`;
    const lines = [
      "🚗 新外衝活動！",
      `日期：${dateLabel}`,
      `地點：${spotNames.join("、") || "未指定"}`,
      `名額：${data.capacity} 人（不含車長）`,
      `程度限制：${data.min_surf_level ? `${data.min_surf_level}以上` : "不限制"}`,
    ];
    if (data.note?.trim()) lines.push(`備註：${shorten(data.note)}`);
    lines.push("", "前往網站查看：", `${siteUrl}/trips`);
    message = lines.join("\n");
  }

  const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineAccessToken}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      to: settings.group_id,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!lineResponse.ok) {
    console.error(`LINE push failed with status ${lineResponse.status}.`);
    return jsonResponse({ error: "LINE 通知發送失敗。" }, 502);
  }

  return jsonResponse({ ok: true });
});
