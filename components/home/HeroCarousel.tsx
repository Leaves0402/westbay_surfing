"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toObjectPosition, type HomepageImage } from "@/lib/homepage";

const AUTOPLAY_INTERVAL_MS = 7000;
const SWIPE_THRESHOLD_PX = 48;

export function HeroCarousel({
  slides,
  children,
}: {
  slides: HomepageImage[];
  /** 疊在照片上的 Hero 文字與操作按鈕。 */
  children: React.ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>(
    {}
  );
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;

  const goTo = useCallback(
    (index: number) => {
      if (slideCount === 0) return;
      setActiveIndex(((index % slideCount) + slideCount) % slideCount);
    },
    [slideCount]
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // 自動輪播：使用者操作、滑鼠移入或偏好減少動態時暫停。
  useEffect(() => {
    if (!hasMultipleSlides || isPaused || prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [hasMultipleSlides, isPaused, prefersReducedMotion, slideCount]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultipleSlides) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setIsPaused(true);
      goTo(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setIsPaused(true);
      goTo(activeIndex + 1);
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (startX === null || !hasMultipleSlides) return;

    const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    setIsPaused(true);
    goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
  };

  return (
    <section
      // 高度固定，切換照片不會造成版面跳動；底部露出下一區一小部分。
      className="relative h-[82svh] min-h-[520px] w-full overflow-hidden bg-slate-900"
      aria-label="社團照片輪播"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const hasFailed = failedSources[slide.url];

        return (
          <div
            key={`${slide.url}-${index}`}
            aria-hidden={!isActive}
            className={`absolute inset-0 ${
              prefersReducedMotion ? "" : "transition-opacity duration-700"
            } ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            {hasFailed ? (
              // 圖片載入失敗的穩定 fallback：純色背景，尺寸不變、文字不位移。
              <div className="h-full w-full bg-primary-hover" />
            ) : (
              <Image
                src={slide.url}
                alt={slide.alt}
                fill
                priority={index === 0}
                unoptimized
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: toObjectPosition(slide) }}
                onError={() =>
                  setFailedSources((current) => ({
                    ...current,
                    [slide.url]: true,
                  }))
                }
              />
            )}
          </div>
        );
      })}

      {/* 遮罩確保文字對比度足夠 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65"
      />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-4 pb-16 pt-20 sm:px-6">
        {children}
      </div>

      {hasMultipleSlides && (
        <>
          <button
            type="button"
            aria-label="上一張照片"
            title="上一張照片"
            onClick={() => {
              setIsPaused(true);
              goTo(activeIndex - 1);
            }}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white transition hover:bg-black/55 sm:left-4"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="下一張照片"
            title="下一張照片"
            onClick={() => {
              setIsPaused(true);
              goTo(activeIndex + 1);
            }}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white transition hover:bg-black/55 sm:right-4"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-2.5">
            {slides.map((slide, index) => (
              <button
                key={`${slide.url}-dot-${index}`}
                type="button"
                aria-label={`切換到第 ${index + 1} 張照片`}
                aria-current={index === activeIndex}
                onClick={() => {
                  setIsPaused(true);
                  setActiveIndex(index);
                }}
                className={`h-2.5 w-2.5 rounded-full border border-white/70 transition-colors ${
                  index === activeIndex ? "bg-white" : "bg-white/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
