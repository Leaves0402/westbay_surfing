"use client";

import { useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * proxy 攔下未登入的受保護頁面後，會帶著 authRequired 導回首頁，這裡顯示提示並提供登入。
 * 使用 useSearchParams，需由外層包在 Suspense 內。
 */
export function AuthRequiredNotice({
  isLoggedIn,
  isLoading,
  onLogin,
}: {
  isLoggedIn: boolean;
  isLoading: boolean;
  onLogin: (nextPath: string) => void;
}) {
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("authRequired");
  const authError = searchParams.get("authError");

  if (isLoggedIn) return null;

  if (authError) {
    return (
      <section className="border-b border-danger/30 bg-danger-light">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <p className="flex items-start gap-2 text-sm leading-6 text-slate-700">
            <Info
              size={16}
              className="mt-0.5 shrink-0 text-danger"
              strokeWidth={1.75}
            />
            <span>登入失敗：{authError}</span>
          </p>
        </div>
      </section>
    );
  }

  if (!requestedPath) return null;

  return (
    <section className="border-b border-warning/30 bg-warning-light">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-700">
          <Info
            size={16}
            className="mt-0.5 shrink-0 text-warning"
            strokeWidth={1.75}
          />
          <span>
            「{requestedPath}」需要登入後才能使用，請先使用 Google 帳號登入。
          </span>
        </p>
        <Button
          variant="primary"
          className="shrink-0 !min-h-9 !text-xs"
          onClick={() => onLogin(requestedPath)}
          disabled={isLoading}
        >
          Google 登入
        </Button>
      </div>
    </section>
  );
}
