"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ImageOff } from "lucide-react";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import type { SurfboardWithImages } from "@/lib/types";

export type SurfboardCardStatus = {
  tone: "success" | "neutral" | "warning" | "primary";
  label: string;
};

export function SurfboardCard({
  board,
  imageUrl,
  onClick,
  isSelected = false,
  isUnavailable = false,
  status,
}: {
  board: SurfboardWithImages;
  imageUrl: string | null;
  onClick: () => void;
  /** 挑板模式中目前選取的板子。 */
  isSelected?: boolean;
  /** 不可選擇（程度不足或已被選走），但仍可點開詳細資料。 */
  isUnavailable?: boolean;
  status?: SurfboardCardStatus;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`查看「${board.name}」詳細資料`}
      aria-label={`查看衝浪板「${board.name}」詳細資料`}
      aria-pressed={isSelected}
      className={`group flex w-40 shrink-0 flex-col rounded-2xl border bg-surface p-3 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSelected
          ? "border-primary bg-primary-light/40 shadow-md"
          : "border-border hover:border-primary hover:bg-primary-light/30"
      }`}
    >
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-bg ${
          isUnavailable && !isSelected ? "opacity-55" : ""
        }`}
      >
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={`衝浪板「${board.name}」的圖片`}
            fill
            unoptimized
            className="object-contain p-1 transition-transform duration-200 group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <ImageOff size={22} strokeWidth={1.5} />
            <span className="text-[10px]">
              {imageUrl ? "圖片載入失敗" : "沒有圖片"}
            </span>
          </div>
        )}

        {isSelected && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
            <Check size={14} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <span className="mt-2 block w-full truncate text-center text-sm font-semibold text-slate-900">
        <span translate="no">{board.name}</span>
      </span>

      <span className="mt-1 flex w-full justify-center">
        <SurfLevelBadge level={board.suitability_level} />
      </span>

      {status && (
        <span className="mt-1.5 flex w-full justify-center">
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      )}
    </button>
  );
}
