"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Info, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import {
  cropImageToWebp,
  getAspectRatio,
  imageOutputSpecs,
  MAX_UPLOAD_SIZE_MB,
  validateUploadFile,
  type ImageOutputKind,
} from "@/lib/imageProcessing";
import type { PendingImageUpload } from "@/lib/homepage";

export type CropDialogResult = {
  pendingUpload: PendingImageUpload;
  previewUrl: string;
  focalX: number;
  focalY: number;
  alt: string;
};

const kindLabels: Record<ImageOutputKind, string> = {
  hero: "Hero 輪播圖（16:9）",
  banner: "中段背景圖（2:1）",
  footer: "頁尾背景圖（2:1）",
  officer: "幹部照片（4:5）",
  qrCode: "QR Code（1:1）",
};

/**
 * 圖片裁切視窗：使用 react-easy-crop 處理拖曳、滑桿與雙指縮放，
 * 確認後在瀏覽器端裁切、縮放並轉成 WebP 再交給上層儲存。
 */
export function ImageCropDialog({
  file,
  kind,
  initialAlt = "",
  initialFocalX = 50,
  initialFocalY = 50,
  showAltField = true,
  onCancel,
  onConfirm,
}: {
  file: File;
  kind: ImageOutputKind;
  initialAlt?: string;
  initialFocalX?: number;
  initialFocalY?: number;
  showAltField?: boolean;
  onCancel: () => void;
  onConfirm: (result: CropDialogResult) => void;
}) {
  // 檔案格式與大小在開啟視窗時就先驗證，不需要在 effect 內設定狀態。
  const [errorMessage, setErrorMessage] = useState(
    () => validateUploadFile(file) ?? ""
  );
  // 這個視窗每次都是針對單一檔案掛載，所以在初始化時就建立預覽網址。
  const [objectUrl] = useState<string | null>(() =>
    validateUploadFile(file) ? null : URL.createObjectURL(file)
  );
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [focalX, setFocalX] = useState(initialFocalX);
  const [focalY, setFocalY] = useState(initialFocalY);
  const [alt, setAlt] = useState(initialAlt);
  const [isProcessing, setIsProcessing] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const aspect = getAspectRatio(kind);
  const spec = imageOutputSpecs[kind];

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const resetTransform = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFocalX(50);
    setFocalY(50);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      setErrorMessage("請先調整裁切範圍。");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const { blob, extension, contentType } = await cropImageToWebp({
        file,
        cropArea: croppedAreaPixels,
        kind,
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;

      onConfirm({
        pendingUpload: { blob, contentType, extension },
        previewUrl,
        focalX,
        focalY,
        alt,
      });
    } catch (error) {
      setIsProcessing(false);
      setErrorMessage(
        error instanceof Error ? error.message : "圖片處理失敗，請重試。"
      );
    }
  };

  const canConfirm = Boolean(objectUrl && croppedAreaPixels) && !isProcessing;

  return (
    <EditorDialogShell
      title="調整圖片"
      description={`${kindLabels[kind]}．輸出 ${spec.width}×${spec.height} WebP．原始檔案上限 ${MAX_UPLOAD_SIZE_MB}MB`}
      isBusy={isProcessing}
      onClose={onCancel}
      maxWidthClassName="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {isProcessing ? "處理中..." : "確認裁切"}
          </Button>
        </>
      }
    >
      {errorMessage && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger"
        >
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      {objectUrl && (
        <>
          <div className="relative h-[46vh] min-h-[240px] w-full overflow-hidden rounded-xl border border-border bg-slate-900">
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              restrictPosition
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            拖曳可移動圖片，使用下方滑桿或手機雙指手勢縮放。
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700">
                <ZoomIn size={15} />
                縮放
              </span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                disabled={isProcessing}
                aria-label="縮放圖片"
                className="h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
              />
              <span className="w-10 shrink-0 text-right text-xs text-slate-500">
                {zoom.toFixed(1)}x
              </span>
            </label>

            <Button
              variant="outline"
              className="shrink-0 !min-h-9 !text-xs"
              icon={<RotateCcw size={14} />}
              onClick={resetTransform}
              disabled={isProcessing}
            >
              重設位置與縮放
            </Button>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-medium text-slate-700">
              手機版顯示焦點
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              手機版容器較窄，會再裁掉左右兩側。調整焦點可以避免人物被裁掉。
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-slate-500">
                  水平 {focalX}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={focalX}
                  onChange={(event) => setFocalX(Number(event.target.value))}
                  disabled={isProcessing}
                  aria-label="水平焦點"
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
                />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-slate-500">
                  垂直 {focalY}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={focalY}
                  onChange={(event) => setFocalY(Number(event.target.value))}
                  disabled={isProcessing}
                  aria-label="垂直焦點"
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="mb-1.5 text-xs text-slate-500">桌機預覽</p>
                <div
                  className="relative w-full overflow-hidden rounded-xl border border-border bg-slate-100"
                  style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
                >
                  <CropPreview
                    imageUrl={objectUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-slate-500">手機預覽</p>
                <div className="relative h-40 w-24 overflow-hidden rounded-xl border border-border bg-slate-100">
                  <CropPreview
                    imageUrl={objectUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    focalX={focalX}
                    focalY={focalY}
                  />
                </div>
              </div>
            </div>
          </div>

          {showAltField && (
            <div className="mt-5 border-t border-border pt-4">
              <FormField
                label="圖片替代文字（alt）"
                hint="給看不到圖片的使用者與搜尋引擎的簡短描述"
              >
                <input
                  type="text"
                  value={alt}
                  maxLength={200}
                  onChange={(event) => setAlt(event.target.value)}
                  placeholder="例如：社員在西子灣練習起乘"
                  className={fieldControlClasses}
                  disabled={isProcessing}
                />
              </FormField>
            </div>
          )}
        </>
      )}
    </EditorDialogShell>
  );
}

/**
 * 用 CSS 重現裁切結果的預覽。
 * 桌機預覽顯示完整裁切框；手機預覽再套用焦點位置，模擬 object-cover 行為。
 */
function CropPreview({
  imageUrl,
  crop,
  zoom,
  aspect,
  focalX,
  focalY,
}: {
  imageUrl: string;
  crop: Point;
  zoom: number;
  aspect: number;
  focalX?: number;
  focalY?: number;
}) {
  const isMobilePreview = focalX !== undefined && focalY !== undefined;

  if (isMobilePreview) {
    return (
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: `url("${imageUrl}")`,
          backgroundPosition: `${focalX}% ${focalY}%`,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: `${zoom * 100}%`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // crop 是相對於裁切框的位移，這裡只需要近似呈現結果。
        backgroundPositionX: `calc(50% - ${crop.x * (1 / aspect)}px)`,
        backgroundPositionY: `calc(50% - ${crop.y * (1 / aspect)}px)`,
      }}
    />
  );
}
