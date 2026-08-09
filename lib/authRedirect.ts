/**
 * 只接受站內的相對路徑，避免 OAuth callback 被帶到外部網址（open redirect）。
 */
export function resolveSafeNextPath(rawNext: string | null) {
  if (!rawNext) return "/";
  if (!rawNext.startsWith("/")) return "/";
  // 「//example.com」與「/\example.com」會被瀏覽器當成外部網址。
  if (rawNext.startsWith("//") || rawNext.startsWith("/\\")) return "/";
  return rawNext;
}
