"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

/** 登記名單用的小型正方形縮圖，附上板名 tooltip。 */
export function SurfboardThumbnail({
  boardName,
  imageUrl,
  className = "h-10 w-10",
}: {
  boardName: string;
  imageUrl: string | null;
  className?: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <span
      title={boardName}
      aria-label={`衝浪板：${boardName}`}
      className={`relative block shrink-0 overflow-hidden rounded-lg border border-border bg-bg ${className}`}
    >
      {imageUrl && !hasFailed ? (
        <Image
          src={imageUrl}
          alt={`衝浪板「${boardName}」的圖片`}
          fill
          unoptimized
          className="object-contain p-0.5"
          onError={() => setHasFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-400">
          <ImageOff size={14} strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}
