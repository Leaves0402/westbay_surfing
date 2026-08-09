"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";

/**
 * 各區塊在編輯模式才會出現的小型編輯按鈕。
 * 公開瀏覽狀態完全不會渲染，避免到處出現鉛筆圖示。
 */
export function SectionEditButton({
  label,
  onClick,
  tone = "light",
  icon,
}: {
  label: string;
  onClick: () => void;
  /** dark 用於深色照片背景上（Banner、Footer）。 */
  tone?: "light" | "dark";
  icon?: ReactNode;
}) {
  const toneClasses =
    tone === "dark"
      ? "border-white/50 bg-black/45 text-white hover:bg-black/65"
      : "border-border bg-surface text-slate-700 hover:border-primary hover:text-primary";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${toneClasses}`}
    >
      {icon ?? <Pencil size={14} />}
      {label}
    </button>
  );
}
