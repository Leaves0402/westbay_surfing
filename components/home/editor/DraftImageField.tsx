"use client";

import { useRef, useState } from "react";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ImageCropDialog,
  type CropDialogResult,
} from "@/components/home/editor/ImageCropDialog";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  validateUploadFile,
  type ImageOutputKind,
} from "@/lib/imageProcessing";
import type { DraftImage } from "@/lib/homepage";

/**
 * 單張圖片欄位：預覽、上傳或替換（會先開裁切視窗）、以及移除。
 * Banner、Footer、QR Code 與幹部照片共用同一個控制項。
 */
export function DraftImageField({
  label,
  hint,
  image,
  kind,
  previewClassName,
  isBusy = false,
  allowRemove = false,
  showAltField = true,
  onChange,
  onError,
  onTrackObjectUrl,
}: {
  label: string;
  hint?: string;
  image: DraftImage | null;
  kind: ImageOutputKind;
  /** 預覽容器樣式，需自帶固定尺寸或比例避免版面跳動。 */
  previewClassName: string;
  isBusy?: boolean;
  allowRemove?: boolean;
  showAltField?: boolean;
  onChange: (image: DraftImage | null) => void;
  onError: (message: string) => void;
  onTrackObjectUrl: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasImageFailed, setHasImageFailed] = useState(false);

  const handleFileChange = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setPendingFile(file);
  };

  const handleCropConfirm = (result: CropDialogResult) => {
    onTrackObjectUrl(result.previewUrl);
    setHasImageFailed(false);
    onChange({
      storagePath: null,
      url: result.previewUrl,
      alt: showAltField ? result.alt : (image?.alt ?? ""),
      focalX: result.focalX,
      focalY: result.focalY,
      pendingUpload: result.pendingUpload,
    });
    setPendingFile(null);
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}

      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div
          className={`relative shrink-0 overflow-hidden rounded-xl border border-border bg-bg ${previewClassName}`}
        >
          {image && !hasImageFailed ? (
            /* eslint-disable-next-line @next/next/no-img-element -- 預覽可能是 blob URL，不需要 next/image 最佳化 */
            <img
              src={image.url}
              alt={image.alt || label}
              className="h-full w-full object-cover"
              style={{ objectPosition: `${image.focalX}% ${image.focalY}%` }}
              onError={() => setHasImageFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
              <ImageOff size={20} strokeWidth={1.5} />
              <span className="text-[10px]">
                {image ? "圖片載入失敗" : "尚未設定"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="!min-h-9 !text-xs"
            icon={<Upload size={14} />}
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            {image ? "替換圖片" : "上傳圖片"}
          </Button>

          {allowRemove && image && (
            <Button
              variant="danger"
              className="!min-h-9 !text-xs"
              icon={<Trash2 size={14} />}
              onClick={() => {
                setHasImageFailed(false);
                onChange(null);
              }}
              disabled={isBusy}
            >
              移除圖片
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(event) => handleFileChange(event.target.files)}
      />

      {pendingFile && (
        <ImageCropDialog
          file={pendingFile}
          kind={kind}
          initialAlt={image?.alt ?? ""}
          initialFocalX={image?.focalX ?? 50}
          initialFocalY={image?.focalY ?? 50}
          showAltField={showAltField}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
