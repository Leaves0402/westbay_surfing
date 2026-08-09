"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, Users } from "lucide-react";
import { SectionEditButton } from "@/components/home/editor/SectionEditButton";
import { toObjectPosition, type HomepageOfficer } from "@/lib/homepage";

/**
 * 幹部團隊：固定一列橫向展示，可用左右按鈕、方向鍵、滑鼠拖曳或觸控滑動瀏覽。
 * 幹部人數變多時只會往右延伸，不會一直增加頁面長度。
 * 這裡只是首頁展示卡，和系統帳號權限無關。
 */
export function OfficerSection({
  officers,
  isEditing = false,
  onManage,
}: {
  officers: HomepageOfficer[];
  isEditing?: boolean;
  onManage?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);

  const measureScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setCanScrollLeft(container.scrollLeft > 4);
    setCanScrollRight(container.scrollLeft < maxScrollLeft - 4);
  }, []);

  // 初次量測與視窗尺寸變化時重新判斷左右箭頭是否可用。
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const frame = requestAnimationFrame(measureScroll);
    const observer = new ResizeObserver(measureScroll);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measureScroll, officers.length]);

  // 滑鼠滾輪縱向滾動時轉成橫向捲動（需要非 passive 監聽才能 preventDefault）。
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      container.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const scrollByPage = (direction: -1 | 1) => {
    const container = scrollRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    container.scrollBy({
      left: direction * Math.max(container.clientWidth * 0.8, 200),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByPage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByPage(1);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const container = scrollRef.current;
    if (!dragState || !container || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(deltaX) > 5) {
      dragState.moved = true;
      container.setPointerCapture(event.pointerId);
    }

    if (dragState.moved) {
      container.scrollLeft = dragState.startScrollLeft - deltaX;
    }
  };

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
  };

  const hasOfficers = officers.length > 0;
  const isScrollable = canScrollLeft || canScrollRight;

  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">
              TEAM
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              幹部團隊
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              有任何關於入社、租板或社課的問題，都可以直接找我們。
              {isScrollable && "可以左右滑動或使用箭頭查看更多幹部。"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasOfficers && (
              <>
                <button
                  type="button"
                  aria-label="查看前面的幹部"
                  title="上一批"
                  onClick={() => scrollByPage(-1)}
                  disabled={!canScrollLeft}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-slate-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label="查看後面的幹部"
                  title="下一批"
                  onClick={() => scrollByPage(1)}
                  disabled={!canScrollRight}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-slate-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {isEditing && onManage && (
              <SectionEditButton
                label="管理幹部"
                icon={<Users size={14} />}
                onClick={onManage}
              />
            )}
          </div>
        </div>

        {!hasOfficers ? (
          <p className="mt-8 rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-slate-500">
            目前還沒有幹部介紹。
          </p>
        ) : (
          <div
            ref={scrollRef}
            role="group"
            aria-label="幹部團隊橫向列表"
            tabIndex={0}
            onScroll={measureScroll}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointerDrag}
            onPointerCancel={endPointerDrag}
            className="mt-8 max-w-full touch-pan-x snap-x snap-mandatory overflow-x-auto pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
          >
            <ul className="flex w-max items-stretch gap-4 sm:gap-5">
              {officers.map((officer, index) => (
                <li
                  key={`${officer.id ?? index}-${officer.roleTitle}`}
                  className="w-40 shrink-0 snap-start sm:w-44 lg:w-48"
                >
                  <OfficerCard officer={officer} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function OfficerCard({ officer }: { officer: HomepageOfficer }) {
  const [hasFailed, setHasFailed] = useState(false);
  const image = officer.image;

  return (
    <figure className="flex h-full flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-slate-100">
        {image && !hasFailed ? (
          <Image
            src={image.url}
            alt={image.alt || `${officer.displayName}（${officer.roleTitle}）`}
            fill
            unoptimized
            sizes="(max-width: 640px) 160px, (max-width: 1024px) 176px, 192px"
            className="object-cover"
            style={{ objectPosition: toObjectPosition(image) }}
            onError={() => setHasFailed(true)}
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <ImageOff size={22} strokeWidth={1.5} />
            <span className="text-[11px]">照片待補</span>
          </div>
        )}
      </div>

      <figcaption className="mt-3">
        <p className="text-xs font-medium text-primary">{officer.roleTitle}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {officer.displayName}
        </p>
        {officer.bio && (
          <p className="mt-1 text-xs leading-5 text-slate-500">{officer.bio}</p>
        )}
      </figcaption>
    </figure>
  );
}
