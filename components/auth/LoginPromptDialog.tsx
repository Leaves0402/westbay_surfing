"use client";

import { useEffect, useRef } from "react";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * 未登入使用者點擊受保護操作時顯示的登入提示。
 * 只使用現有的 Supabase Google OAuth，不提供帳號密碼或註冊。
 */
export function LoginPromptDialog({
  description,
  isSubmitting = false,
  onLogin,
  onClose,
}: {
  description?: string;
  isSubmitting?: boolean;
  onLogin: () => void;
  onClose: () => void;
}) {
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loginButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
              <Lock size={18} strokeWidth={1.75} />
            </span>
            <div>
              <h2
                id="login-prompt-title"
                className="font-semibold text-slate-900"
              >
                請使用 Google 帳號登入後繼續
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {description ??
                  "這個功能需要社員身分。登入後會自動建立社員資料，預設身分為待審核。"}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="關閉登入提示"
            title="關閉"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="sm:w-auto"
            fullWidth
          >
            取消
          </Button>
          <Button
            ref={loginButtonRef}
            variant="primary"
            onClick={onLogin}
            disabled={isSubmitting}
            className="sm:w-auto"
            fullWidth
          >
            {isSubmitting ? "前往登入..." : "Google 登入"}
          </Button>
        </div>
      </div>
    </div>
  );
}
