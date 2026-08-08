"use client";

import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import {
  SurfboardImageCarousel,
  type CarouselImage,
} from "@/components/rentals/SurfboardImageCarousel";
import type { SurfboardWithImages } from "@/lib/types";
import { surfboardUnknownValueText } from "@/lib/types";

/**
 * 衝浪板的唯讀詳細資料版面：桌面版左圖右資料、手機版上下排列。
 * 衝浪板管理與登記挑板共用同一份版面與樣式。
 */
export function SurfboardDetailView({
  board,
  imageUrls,
}: {
  board: SurfboardWithImages;
  imageUrls: Record<string, string>;
}) {
  const carouselImages: CarouselImage[] = board.images.map((image, index) => ({
    key: image.id,
    url: imageUrls[image.storage_path] ?? null,
    alt: `衝浪板「${board.name}」的第 ${index + 1} 張圖片`,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SurfboardImageCarousel images={carouselImages} />

      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">衝浪板名稱</dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900">
            {board.name}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">適合程度</dt>
          <dd className="mt-1">
            <SurfLevelBadge level={board.suitability_level} />
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">板型</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {board.board_types.map((boardType) => (
              <Badge key={boardType} tone="primary">
                {boardType}
              </Badge>
            ))}
          </dd>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-slate-500">浮力</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {board.buoyancy === null
                ? surfboardUnknownValueText
                : `${board.buoyancy} L`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">長度</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {board.length ?? surfboardUnknownValueText}
            </dd>
          </div>
        </div>

        <div>
          <dt className="text-xs text-slate-500">說明</dt>
          <dd className="mt-0.5 whitespace-pre-wrap leading-6 text-slate-700">
            {board.description || "未填寫"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
