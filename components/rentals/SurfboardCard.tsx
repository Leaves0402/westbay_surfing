"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { SurfboardWithImages } from "@/lib/types";

export function SurfboardCard({
  board,
  imageUrl,
  onClick,
}: {
  board: SurfboardWithImages;
  imageUrl: string | null;
  onClick: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`查看「${board.name}」詳細資料`}
      aria-label={`查看衝浪板「${board.name}」詳細資料`}
      className="group w-40 shrink-0 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-primary hover:bg-primary-light/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-bg">
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={`衝浪板「${board.name}」的圖片`}
            fill
            unoptimized
            className="object-cover transition-transform duration-200 group-hover:scale-105"
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
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
        {board.name}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        使用程度：{board.usage_level}
      </p>
    </button>
  );
}
