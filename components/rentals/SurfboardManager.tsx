"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Plus, RefreshCw, Waves } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SurfboardCard } from "@/components/rentals/SurfboardCard";
import { SurfboardDialog } from "@/components/rentals/SurfboardDialog";
import {
  createSignedSurfboardImageUrls,
  fetchSurfboards,
} from "@/lib/surfboards";
import type { SurfboardWithImages } from "@/lib/types";

type DialogState =
  | { mode: "create" }
  | { mode: "detail"; boardId: string }
  | null;

export function SurfboardManager({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<SurfboardWithImages[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const loadSurfboards = useCallback(async () => {
    setIsLoading(true);

    const result = await fetchSurfboards();

    if (result.error !== null) {
      setIsLoading(false);
      setStatusMessage(`讀取衝浪板失敗：${result.error}`);
      return;
    }

    const storagePaths = result.data.flatMap((board) =>
      board.images.map((image) => image.storage_path)
    );
    const urlsResult = await createSignedSurfboardImageUrls(storagePaths);

    setIsLoading(false);
    setBoards(result.data);

    if (urlsResult.error !== null) {
      setImageUrls({});
      setStatusMessage(`讀取衝浪板圖片失敗：${urlsResult.error}`);
      return;
    }

    setImageUrls(urlsResult.urls);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadSurfboards());
  }, [loadSurfboards]);

  // 滑鼠滾輪橫向捲動（需要非 passive 監聽才能 preventDefault）。
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

    if (dragState.moved) {
      suppressClickRef.current = true;
    }
    dragStateRef.current = null;
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const selectedBoard = useMemo(() => {
    if (dialogState?.mode !== "detail") return null;
    return boards.find((board) => board.id === dialogState.boardId) ?? null;
  }, [boards, dialogState]);

  // 詳細資料開啟中若資料被移除（例如重新載入後不存在），自動關閉視窗。
  useEffect(() => {
    if (dialogState?.mode === "detail" && !isLoading && !selectedBoard) {
      queueMicrotask(() => setDialogState(null));
    }
  }, [dialogState, isLoading, selectedBoard]);

  const getCoverImageUrl = (board: SurfboardWithImages) => {
    const cover = board.images[0];
    if (!cover) return null;
    return imageUrls[cover.storage_path] ?? null;
  };

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Waves size={18} className="text-primary" strokeWidth={2} />
          <h2 className="font-semibold text-slate-900">衝浪板管理</h2>
        </div>

        <button
          type="button"
          aria-label="重新整理衝浪板列表"
          title="重新整理衝浪板列表"
          onClick={() => void loadSurfboards()}
          disabled={isLoading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-500">
        幹部與管理員可以在這裡管理社上的衝浪板，點擊卡片查看與編輯詳細資料。
      </p>

      {isLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <RefreshCw size={16} className="animate-spin" />
          正在讀取衝浪板資料...
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="max-w-full cursor-grab touch-pan-x overflow-x-auto pb-2 active:cursor-grabbing [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onClickCapture={handleClickCapture}
        >
          <div className="flex w-max items-stretch gap-4">
            <button
              type="button"
              onClick={() => setDialogState({ mode: "create" })}
              title="新增衝浪板"
              aria-label="新增衝浪板"
              className="group w-40 shrink-0 rounded-2xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-slate-400 transition group-hover:border-primary group-hover:bg-primary-light/30 group-hover:text-primary">
                <Plus size={24} strokeWidth={1.75} />
                <span className="text-sm font-medium">新增衝浪板</span>
              </span>
              <span className="invisible mt-2 block truncate text-sm font-semibold">
                佔位
              </span>
              <span className="invisible mt-1 block truncate px-2.5 py-1 text-xs">
                佔位
              </span>
            </button>

            {boards.map((board) => (
              <SurfboardCard
                key={board.id}
                board={board}
                imageUrl={getCoverImageUrl(board)}
                onClick={() =>
                  setDialogState({ mode: "detail", boardId: board.id })
                }
              />
            ))}

            {boards.length === 0 && (
              <div className="flex w-56 shrink-0 items-center justify-center px-2 text-sm text-slate-400">
                目前還沒有衝浪板，點擊左側卡片新增第一張。
              </div>
            )}
          </div>
        </div>
      )}

      {statusMessage && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-slate-600"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{statusMessage}</span>
        </p>
      )}

      {dialogState?.mode === "create" && (
        <SurfboardDialog
          board={null}
          imageUrls={imageUrls}
          userId={userId}
          onClose={() => setDialogState(null)}
          onCreated={async (message) => {
            setDialogState(null);
            setStatusMessage(message);
            await loadSurfboards();
          }}
          onSaved={loadSurfboards}
          onDeleted={async () => {
            setDialogState(null);
            await loadSurfboards();
          }}
        />
      )}

      {dialogState?.mode === "detail" && selectedBoard && (
        <SurfboardDialog
          board={selectedBoard}
          imageUrls={imageUrls}
          userId={userId}
          onClose={() => setDialogState(null)}
          onCreated={async (message) => {
            setDialogState(null);
            setStatusMessage(message);
            await loadSurfboards();
          }}
          onSaved={loadSurfboards}
          onDeleted={async (message) => {
            setDialogState(null);
            setStatusMessage(message);
            await loadSurfboards();
          }}
        />
      )}
    </Card>
  );
}
