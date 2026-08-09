"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

/**
 * 首頁編輯用的共用 Dialog 外框：統一標題、關閉、Esc、背景鎖定與底部按鈕列。
 * 讓各區塊的編輯視窗維持一致的樣式與行為。
 */
export function EditorDialogShell({
  title,
  description,
  isBusy = false,
  onClose,
  footer,
  children,
  maxWidthClassName = "max-w-2xl",
}: {
  title: string;
  description?: string;
  isBusy?: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  const panelRef = useDialogAccessibility({ onClose, isBusy });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`flex max-h-[92vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-xs leading-5 text-slate-500"
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label="關閉編輯視窗"
            title="關閉"
            onClick={onClose}
            disabled={isBusy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
          {footer}
        </div>
      </div>
    </div>
  );
}
