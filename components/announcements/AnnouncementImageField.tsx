"use client";

import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ANNOUNCEMENT_IMAGE_ACCEPT,
  validateAnnouncementImage,
} from "@/lib/announcements";

type AnnouncementImageFieldProps = {
  file: File | null;
  previewUrl: string | null;
  existingImageUrl?: string | null;
  isExistingImageRemoved?: boolean;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  onError: (message: string) => void;
};

export function AnnouncementImageField({
  file,
  previewUrl,
  existingImageUrl = null,
  isExistingImageRemoved = false,
  disabled = false,
  onChange,
  onRemoveExisting,
  onError,
}: AnnouncementImageFieldProps) {
  const visibleUrl =
    previewUrl || (!isExistingImageRemoved ? existingImageUrl : null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!nextFile) return;

    const validationError = validateAnnouncementImage(nextFile);
    if (validationError) {
      onError(validationError);
      return;
    }

    onChange(nextFile);
  };

  const handleRemove = () => {
    if (file) {
      onChange(null);
      return;
    }

    onRemoveExisting?.();
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-bg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40">
          <ImagePlus size={18} />
          {visibleUrl ? "更換照片" : "新增照片"}
          <input
            type="file"
            accept={ANNOUNCEMENT_IMAGE_ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </label>

        {visibleUrl && (
          <Button
            variant="danger"
            icon={<Trash2 size={16} />}
            onClick={handleRemove}
            disabled={disabled}
          >
            移除照片
          </Button>
        )}
      </div>

      <p className="text-xs text-text-secondary">
        支援 JPG、PNG、WebP 與 GIF，每張最大 5 MB。
      </p>

      {visibleUrl && (
        <div className="relative aspect-[16/9] w-full max-w-xl overflow-hidden rounded-xl border border-line bg-appBg">
          <Image
            src={visibleUrl}
            alt="公告照片預覽"
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}
    </div>
  );
}
