"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

export type CarouselImage = {
  key: string;
  url: string | null;
  alt: string;
};

const SWIPE_THRESHOLD_PX = 40;

export function SurfboardImageCarousel({
  images,
  className = "",
  activeIndex,
  onActiveIndexChange,
  overlay,
  emptyLabel = "沒有圖片",
}: {
  images: CarouselImage[];
  className?: string;
  /** 傳入時為受控模式，由外層管理目前顯示的圖片。 */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** 疊在圖片上的額外控制項，例如編輯模式的移除按鈕。 */
  overlay?: ReactNode;
  emptyLabel?: string;
}) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const isControlled = activeIndex !== undefined;
  const rawIndex = isControlled ? activeIndex : uncontrolledIndex;
  const safeIndex =
    images.length === 0
      ? 0
      : Math.min(Math.max(rawIndex, 0), images.length - 1);

  const hasMultipleImages = images.length > 1;
  const current = images[safeIndex] ?? null;

  const goTo = (index: number) => {
    if (images.length === 0) return;

    const next = ((index % images.length) + images.length) % images.length;
    if (isControlled) {
      onActiveIndexChange?.(next);
      return;
    }
    setUncontrolledIndex(next);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (startX === null || !hasMultipleImages) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    goTo(deltaX < 0 ? safeIndex + 1 : safeIndex - 1);
  };

  return (
    <div className={className}>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-bg"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="group"
        aria-label={
          hasMultipleImages
            ? `衝浪板圖片，第 ${safeIndex + 1} 張，共 ${images.length} 張`
            : "衝浪板圖片"
        }
      >
        {current ? (
          <CarouselFrame
            key={current.key}
            image={current}
            emptyLabel={emptyLabel}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
            <ImageOff size={28} strokeWidth={1.5} />
            <span className="text-xs">{emptyLabel}</span>
          </div>
        )}

        {hasMultipleImages && (
          <>
            <button
              type="button"
              aria-label="上一張圖片"
              title="上一張圖片"
              onClick={() => goTo(safeIndex - 1)}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-slate-600 shadow-sm transition hover:bg-surface"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="下一張圖片"
              title="下一張圖片"
              onClick={() => goTo(safeIndex + 1)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-slate-600 shadow-sm transition hover:bg-surface"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {overlay}
      </div>

      {hasMultipleImages && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.key}
              type="button"
              aria-label={`切換到第 ${index + 1} 張圖片`}
              aria-current={index === safeIndex}
              onClick={() => goTo(index)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                index === safeIndex
                  ? "bg-primary"
                  : "bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CarouselFrame({
  image,
  emptyLabel,
}: {
  image: CarouselImage;
  emptyLabel: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  if (!image.url || hasFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
        <ImageOff size={28} strokeWidth={1.5} />
        <span className="text-xs">
          {image.url ? "圖片載入失敗" : emptyLabel}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt}
      fill
      unoptimized
      className="object-cover"
      onError={() => setHasFailed(true)}
    />
  );
}
