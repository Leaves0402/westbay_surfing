import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 未登入時只允許進入的頁面。
 * 其餘頁面（/profile、/announcements、/trips、/attendance、/admin/*、/maintenance…）
 * 一律導回首頁並帶上 authRequired 提示。
 *
 * 這是前端的第一層 route guard；Supabase RLS 仍是最終權限防線。
 */
const publicPaths = ["/", "/rentals"];

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (publicPath) =>
      pathname === publicPath ||
      (publicPath !== "/" && pathname.startsWith(`${publicPath}/`))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // OAuth callback 與 auth 相關路由不能攔，否則無法完成登入。
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // 缺少環境變數時不要把所有人鎖在外面，交給頁面自己顯示錯誤。
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let isSignedIn = false;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isSignedIn = Boolean(user);
  } catch {
    // 讀取登入狀態失敗時採取保守做法：視為未登入並導回首頁。
    isSignedIn = false;
  }

  if (isSignedIn) {
    return response;
  }

  const redirectUrl = new URL("/", request.nextUrl.origin);
  redirectUrl.searchParams.set("authRequired", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    /*
     * 排除靜態資源與圖片最佳化路徑，只在頁面請求時執行：
     * - _next/static、_next/image
     * - favicon.ico 等 metadata 檔案
     * - public 目錄下的圖片與字型
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
