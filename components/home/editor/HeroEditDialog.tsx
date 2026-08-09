"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageOff,
  Info,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import {
  ImageCropDialog,
  type CropDialogResult,
} from "@/components/home/editor/ImageCropDialog";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  validateUploadFile,
} from "@/lib/imageProcessing";
import {
  MAX_HERO_IMAGES,
  MIN_HERO_IMAGES,
  type DraftImage,
  type HomepageDraft,
} from "@/lib/homepage";

type PendingTarget = { mode: "add" } | { mode: "replace"; index: number };

export function HeroEditDialog({
  draft,
  onClose,
  onApply,
  onTrackObjectUrl,
}: {
  draft: HomepageDraft;
  onClose: () => void;
  onApply: (updater: (current: HomepageDraft) => HomepageDraft) => void;
  onTrackObjectUrl: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const heroImages = draft.heroImages;

  const openFilePicker = (target: PendingTarget) => {
    setPendingTarget(target);
    inputRef.current?.click();
  };

  const handleFileChange = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setPendingTarget(null);
      return;
    }

    setErrorMessage("");
    setPendingFile(file);
  };

  const handleCropConfirm = (result: CropDialogResult) => {
    onTrackObjectUrl(result.previewUrl);

    const nextImage: DraftImage = {
      storagePath: null,
      url: result.previewUrl,
      alt: result.alt,
      focalX: result.focalX,
      focalY: result.focalY,
      pendingUpload: result.pendingUpload,
    };

    const target = pendingTarget;
    onApply((current) => {
      if (target?.mode === "replace") {
        return {
          ...current,
          heroImages: current.heroImages.map((image, index) =>
            index === target.index ? nextImage : image
          ),
        };
      }

      return { ...current, heroImages: [...current.heroImages, nextImage] };
    });

    setPendingFile(null);
    setPendingTarget(null);
  };

  const updateAlt = (index: number, alt: string) => {
    onApply((current) => ({
      ...current,
      heroImages: current.heroImages.map((image, imageIndex) =>
        imageIndex === index ? { ...image, alt } : image
      ),
    }));
  };

  const removeImage = (index: number) => {
    if (heroImages.length <= MIN_HERO_IMAGES) {
      setErrorMessage(`Hero 至少要保留 ${MIN_HERO_IMAGES} 張圖片。`);
      return;
    }

    const confirmed = window.confirm(
      "確定要刪除這張 Hero 圖片嗎？按「完成編輯」後才會實際套用。"
    );
    if (!confirmed) return;

    setErrorMessage("");
    onApply((current) => ({
      ...current,
      heroImages: current.heroImages.filter(
        (_, imageIndex) => imageIndex !== index
      ),
    }));
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= heroImages.length) return;

    onApply((current) => {
      const next = [...current.heroImages];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, heroImages: next };
    });
  };

  return (
    <EditorDialogShell
      title="編輯 Hero 區塊"
      description={`首頁主標題、副標題與輪播圖片（${MIN_HERO_IMAGES}–${MAX_HERO_IMAGES} 張）`}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          完成這個區塊
        </Button>
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

      <div className="grid gap-4">
        <FormField label="首頁主標題">
          <input
            type="text"
            value={draft.content.heroTitle}
            maxLength={60}
            onChange={(event) =>
              onApply((current) => ({
                ...current,
                content: { ...current.content, heroTitle: event.target.value },
              }))
            }
            className={fieldControlClasses}
          />
        </FormField>

        <FormField label="副標題">
          <textarea
            value={draft.content.heroSubtitle}
            maxLength={300}
            onChange={(event) =>
              onApply((current) => ({
                ...current,
                content: {
                  ...current.content,
                  heroSubtitle: event.target.value,
                },
              }))
            }
            className={`min-h-20 ${fieldControlClasses}`}
          />
        </FormField>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            輪播圖片（{heroImages.length}/{MAX_HERO_IMAGES}）
          </p>
          <Button
            variant="outline"
            className="!min-h-9 !text-xs"
            icon={<Plus size={14} />}
            onClick={() => openFilePicker({ mode: "add" })}
            disabled={heroImages.length >= MAX_HERO_IMAGES}
          >
            {heroImages.length >= MAX_HERO_IMAGES
              ? `已達 ${MAX_HERO_IMAGES} 張上限`
              : "新增圖片"}
          </Button>
        </div>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          可以拖曳卡片調整順序，手機請使用左右箭頭。第 1 張會是進入首頁時的第一張照片。
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {heroImages.map((image, index) => (
            <li
              key={`${image.storagePath ?? image.url}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  moveImage(dragIndex, index);
                }
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-wrap items-start gap-3 rounded-xl border p-3 transition-colors ${
                dragIndex === index
                  ? "border-primary bg-primary-light/40"
                  : "border-border bg-bg"
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-1 hidden cursor-grab text-slate-400 sm:block"
              >
                <GripVertical size={16} />
              </span>

              <HeroThumbnail image={image} index={index} />

              <div className="min-w-0 flex-1">
                <FormField label={`第 ${index + 1} 張的替代文字（alt）`}>
                  <input
                    type="text"
                    value={image.alt}
                    maxLength={200}
                    onChange={(event) => updateAlt(index, event.target.value)}
                    placeholder="例如：社員在西子灣練習起乘"
                    className={fieldControlClasses}
                  />
                </FormField>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`把第 ${index + 1} 張往前移`}
                    title="往前移"
                    onClick={() => moveImage(index, index - 1)}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`把第 ${index + 1} 張往後移`}
                    title="往後移"
                    onClick={() => moveImage(index, index + 1)}
                    disabled={index === heroImages.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>

                  <Button
                    variant="outline"
                    className="!min-h-9 !text-xs"
                    icon={<Upload size={13} />}
                    onClick={() => openFilePicker({ mode: "replace", index })}
                  >
                    替換
                  </Button>
                  <Button
                    variant="danger"
                    className="!min-h-9 !text-xs"
                    icon={<Trash2 size={13} />}
                    onClick={() => removeImage(index)}
                    disabled={heroImages.length <= MIN_HERO_IMAGES}
                  >
                    刪除
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
          kind="hero"
          initialAlt={
            pendingTarget?.mode === "replace"
              ? heroImages[pendingTarget.index]?.alt ?? ""
              : ""
          }
          initialFocalX={
            pendingTarget?.mode === "replace"
              ? heroImages[pendingTarget.index]?.focalX ?? 50
              : 50
          }
          initialFocalY={
            pendingTarget?.mode === "replace"
              ? heroImages[pendingTarget.index]?.focalY ?? 50
              : 50
          }
          onCancel={() => {
            setPendingFile(null);
            setPendingTarget(null);
          }}
          onConfirm={handleCropConfirm}
        />
      )}
    </EditorDialogShell>
  );
}

function HeroThumbnail({
  image,
  index,
}: {
  image: DraftImage;
  index: number;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-100">
      {hasFailed ? (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <ImageOff size={16} strokeWidth={1.5} />
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- 預覽可能是 blob URL */
        <img
          src={image.url}
          alt={image.alt || `第 ${index + 1} 張 Hero 圖片`}
          className="h-full w-full object-cover"
          style={{ objectPosition: `${image.focalX}% ${image.focalY}%` }}
          onError={() => setHasFailed(true)}
        />
      )}
    </div>
  );
}
