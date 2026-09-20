"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Filter,
  Info,
  RefreshCw,
  Waves,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  SurfboardCard,
  type SurfboardCardStatus,
} from "@/components/rentals/SurfboardCard";
import { SurfboardDetailView } from "@/components/rentals/SurfboardDetailView";
import { userMeetsSurfLevel } from "@/lib/permissions";
import type {
  Profile,
  SurfboardBoardType,
  SurfboardWithImages,
} from "@/lib/types";
import { surfboardBoardTypeOptions } from "@/lib/types";

const LEVEL_BLOCKED_TEXT = "你的衝浪程度尚未達到此板子的適合程度";
const TAKEN_TEXT = "此時段已被選擇";

export function SurfboardPicker({
  boards,
  imageUrls,
  profile,
  takenSurfboardIds,
  isLoading,
  isSubmitting,
  loadErrorMessage,
  confirmLabel = "確認登記租板",
  onClose,
  onConfirm,
}: {
  boards: SurfboardWithImages[];
  imageUrls: Record<string, string>;
  profile: Pick<Profile, "surf_level"> | null;
  /** 同一租板時段中已被其他人選走的板子。 */
  takenSurfboardIds: string[];
  isLoading: boolean;
  isSubmitting: boolean;
  loadErrorMessage: string;
  /** 會員直接登記；非社員流程則先進入最終摘要。 */
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (surfboardId: string) => Promise<void>;
}) {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [detailBoardId, setDetailBoardId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [boardTypeFilters, setBoardTypeFilters] = useState<
    SurfboardBoardType[]
  >([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 鍵盤 Esc：在詳細畫面先返回列表，在列表則關閉視窗。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isSubmitting) return;

      if (detailBoardId) {
        setDetailBoardId(null);
        return;
      }

      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailBoardId, isSubmitting, onClose]);

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
  }, [detailBoardId, isLoading]);

  const takenIdSet = useMemo(
    () => new Set(takenSurfboardIds),
    [takenSurfboardIds]
  );

  // 登記失敗後重新載入時，若選取的板子已被別人選走就清掉選取狀態。
  useEffect(() => {
    if (selectedBoardId && takenIdSet.has(selectedBoardId)) {
      queueMicrotask(() => setSelectedBoardId(null));
    }
  }, [selectedBoardId, takenIdSet]);

  const filteredBoards = useMemo(() => {
    if (boardTypeFilters.length === 0) return boards;

    return boards.filter((board) =>
      boardTypeFilters.some((boardType) => board.board_types.includes(boardType))
    );
  }, [boardTypeFilters, boards]);

  const meetsBoardLevel = (board: SurfboardWithImages) =>
    userMeetsSurfLevel(profile, board.suitability_level);

  const getBoardStatus = (board: SurfboardWithImages): SurfboardCardStatus => {
    if (selectedBoardId === board.id) {
      return { tone: "success", label: "已選擇" };
    }
    if (takenIdSet.has(board.id)) {
      return { tone: "neutral", label: TAKEN_TEXT };
    }
    if (!meetsBoardLevel(board)) {
      return { tone: "warning", label: "程度不足" };
    }
    return { tone: "primary", label: "可選擇" };
  };

  const isBoardSelectable = (board: SurfboardWithImages) =>
    !takenIdSet.has(board.id) && meetsBoardLevel(board);

  const detailBoard = useMemo(
    () => boards.find((board) => board.id === detailBoardId) ?? null,
    [boards, detailBoardId]
  );

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  const toggleBoardTypeFilter = (boardType: SurfboardBoardType) => {
    setBoardTypeFilters((current) =>
      current.includes(boardType)
        ? current.filter((item) => item !== boardType)
        : [...current, boardType]
    );
  };

  const getCoverImageUrl = (board: SurfboardWithImages) => {
    const cover = board.images[0];
    if (!cover) return null;
    return imageUrls[cover.storage_path] ?? null;
  };

  const detailBlockedReason = detailBoard
    ? takenIdSet.has(detailBoard.id)
      ? TAKEN_TEXT
      : !meetsBoardLevel(detailBoard)
        ? LEVEL_BLOCKED_TEXT
        : null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={detailBoard ? "衝浪板詳細資料" : "挑選你想要的板子"}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-2">
            {detailBoard ? (
              <>
                <button
                  type="button"
                  aria-label="返回挑板列表"
                  title="返回挑板列表"
                  onClick={() => setDetailBoardId(null)}
                  disabled={isSubmitting}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="truncate font-semibold text-slate-900">
                  衝浪板詳細資料
                </h2>
              </>
            ) : (
              <>
                <Waves size={18} className="shrink-0 text-primary" />
                <h2 className="truncate font-semibold text-slate-900">
                  挑選你想要的板子
                </h2>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!detailBoard && (
              <button
                type="button"
                aria-label="篩選板型"
                aria-expanded={isFilterOpen}
                title="篩選板型"
                onClick={() => setIsFilterOpen((current) => !current)}
                disabled={isSubmitting}
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  isFilterOpen || boardTypeFilters.length > 0
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-slate-500 hover:bg-bg"
                }`}
              >
                <Filter size={16} />
                {boardTypeFilters.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {boardTypeFilters.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              aria-label="關閉挑板視窗"
              title="關閉挑板視窗"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {detailBoard ? (
            <>
              <SurfboardDetailView
                board={detailBoard}
                imageUrls={imageUrls}
              />

              {detailBlockedReason && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-3 py-2 text-sm text-warning">
                  <Info size={16} className="mt-0.5 shrink-0" />
                  <span>{detailBlockedReason}</span>
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={<Check size={16} />}
                  onClick={() => {
                    setSelectedBoardId(detailBoard.id);
                    setDetailBoardId(null);
                  }}
                  disabled={
                    isSubmitting ||
                    !isBoardSelectable(detailBoard) ||
                    selectedBoardId === detailBoard.id
                  }
                >
                  {selectedBoardId === detailBoard.id
                    ? "已選擇這張衝浪板"
                    : "選擇這張衝浪板"}
                </Button>
                <Button
                  variant="outline"
                  icon={<ArrowLeft size={16} />}
                  onClick={() => setDetailBoardId(null)}
                  disabled={isSubmitting}
                >
                  返回挑板
                </Button>
              </div>
            </>
          ) : (
            <>
              {isFilterOpen && (
                <div className="mb-4 rounded-xl border border-border bg-bg p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    依板型篩選
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {surfboardBoardTypeOptions.map((boardType) => (
                      <label
                        key={boardType}
                        className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={boardTypeFilters.includes(boardType)}
                          onChange={() => toggleBoardTypeFilter(boardType)}
                          disabled={isSubmitting}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                        />
                        {boardType}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      className="!min-h-9 !px-3 !text-xs"
                      icon={<X size={14} />}
                      onClick={() => setBoardTypeFilters([])}
                      disabled={isSubmitting || boardTypeFilters.length === 0}
                    >
                      清除篩選
                    </Button>
                  </div>
                </div>
              )}

              {loadErrorMessage && (
                <p className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
                  <Info size={16} className="mt-0.5 shrink-0" />
                  <span>{loadErrorMessage}</span>
                </p>
              )}

              {isLoading ? (
                <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                  <RefreshCw size={16} className="animate-spin" />
                  正在讀取衝浪板資料...
                </p>
              ) : boards.length === 0 ? (
                <p className="rounded-xl border border-border bg-bg px-3 py-6 text-center text-sm text-slate-500">
                  目前沒有可挑選的衝浪板，請聯絡幹部或管理員新增衝浪板。
                </p>
              ) : filteredBoards.length === 0 ? (
                <p className="rounded-xl border border-border bg-bg px-3 py-6 text-center text-sm text-slate-500">
                  沒有符合目前板型篩選的衝浪板，請調整或清除篩選。
                </p>
              ) : (
                <div
                  ref={scrollRef}
                  className="max-w-full touch-pan-x overflow-x-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
                >
                  <div className="flex w-max items-stretch gap-4">
                    {filteredBoards.map((board) => (
                      <SurfboardCard
                        key={board.id}
                        board={board}
                        imageUrl={getCoverImageUrl(board)}
                        isSelected={selectedBoardId === board.id}
                        isUnavailable={!isBoardSelectable(board)}
                        status={getBoardStatus(board)}
                        onClick={() => setDetailBoardId(board.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!isLoading && filteredBoards.length > 0 && (
                <p className="mt-3 text-xs text-slate-400">
                  點擊卡片可查看詳細資料，並在詳細資料中選擇這張衝浪板。
                </p>
              )}
            </>
          )}
        </div>

        {!detailBoard && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <p className="min-w-0 text-sm text-slate-600">
              目前選擇：
              {selectedBoard ? (
                <span className="inline-flex items-center gap-2 align-middle">
                  <span className="font-medium text-slate-900">
                    <span translate="no">{selectedBoard.name}</span>
                  </span>
                  <Badge tone="success">
                    <Check size={12} />
                    已選擇
                  </Badge>
                </span>
              ) : (
                <span className="text-slate-400">尚未選擇衝浪板</span>
              )}
            </p>

            <Button
              variant="primary"
              className="shrink-0"
              onClick={() => {
                if (!selectedBoardId) return;
                void onConfirm(selectedBoardId);
              }}
              disabled={!selectedBoardId || isSubmitting}
            >
              {isSubmitting ? "處理中..." : confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
