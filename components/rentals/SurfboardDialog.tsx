"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { SurfboardDetailView } from "@/components/rentals/SurfboardDetailView";
import {
  SurfboardImageCarousel,
  type CarouselImage,
} from "@/components/rentals/SurfboardImageCarousel";
import {
  createSurfboard,
  deleteSurfboard,
  MAX_SURFBOARD_IMAGES,
  MAX_SURFBOARD_IMAGE_SIZE_MB,
  updateSurfboard,
  validateSurfboardForm,
  validateSurfboardImageFile,
  type SurfboardEditorImage,
} from "@/lib/surfboards";
import type { SurfboardFormData, SurfboardWithImages } from "@/lib/types";
import {
  surfboardBoardTypeOptions,
  surfboardSuitabilityLevelOptions,
  surfboardUnknownValueText,
} from "@/lib/types";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

type DialogNoticeTone = "success" | "danger" | "warning";

type Notice = {
  tone: DialogNoticeTone;
  text: string;
};

const noticeToneClasses: Record<Notice["tone"], string> = {
  success: "border-success/30 bg-success-light text-success",
  danger: "border-danger/30 bg-danger-light text-danger",
  warning: "border-warning/30 bg-warning-light text-warning",
};

function makeFormFromBoard(board: SurfboardWithImages | null): SurfboardFormData {
  if (!board) {
    return {
      name: "",
      suitability_level: "初階",
      board_types: [],
      buoyancy: "",
      length: "",
      description: "",
    };
  }

  return {
    name: board.name,
    suitability_level: board.suitability_level,
    board_types: [...board.board_types],
    buoyancy: board.buoyancy === null ? "" : String(board.buoyancy),
    length: board.length ?? "",
    description: board.description ?? "",
  };
}

function makeEditorImagesFromBoard(
  board: SurfboardWithImages | null
): SurfboardEditorImage[] {
  if (!board) return [];
  return board.images.map((image) => ({ kind: "existing", image }));
}

function revokeNewImagePreviews(items: SurfboardEditorImage[]) {
  for (const item of items) {
    if (item.kind === "new") {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}

export function SurfboardDialog({
  board,
  imageUrls,
  onClose,
  onCreated,
  onSaved,
  onDeleted,
}: {
  /** null 代表新增模式。 */
  board: SurfboardWithImages | null;
  imageUrls: Record<string, string>;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
  onSaved: () => Promise<void>;
  onDeleted: (message: string) => Promise<void>;
}) {
  const isCreateMode = board === null;

  const [isEditing, setIsEditing] = useState(isCreateMode);
  const [form, setForm] = useState<SurfboardFormData>(() =>
    makeFormFromBoard(board)
  );
  const [editorImages, setEditorImages] = useState<SurfboardEditorImage[]>(
    () => makeEditorImagesFromBoard(board)
  );
  const [editorImageIndex, setEditorImageIndex] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorImagesRef = useRef<SurfboardEditorImage[]>([]);

  const isBusy = isSaving || isDeleting;

  useEffect(() => {
    editorImagesRef.current = editorImages;
  }, [editorImages]);

  // 卸載時釋放新圖片的預覽 URL。
  useEffect(() => {
    return () => {
      revokeNewImagePreviews(editorImagesRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    onClose();
  }, [isBusy, onClose]);

  const panelRef = useDialogAccessibility({
    isBusy,
    onClose: () => {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return;
      }
      handleClose();
    },
  });

  const startEditing = () => {
    if (!board) return;
    setForm(makeFormFromBoard(board));
    setEditorImages(makeEditorImagesFromBoard(board));
    setEditorImageIndex(0);
    setNotice(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (isCreateMode) {
      handleClose();
      return;
    }

    // 取消時放棄尚未儲存的變更，不修改資料庫或 Storage。
    revokeNewImagePreviews(editorImages);
    setForm(makeFormFromBoard(board));
    setEditorImages(makeEditorImagesFromBoard(board));
    setEditorImageIndex(0);
    setNotice(null);
    setIsEditing(false);
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const additions: SurfboardEditorImage[] = [];
    let error: string | null = null;

    for (const file of files) {
      if (editorImages.length + additions.length >= MAX_SURFBOARD_IMAGES) {
        error = `每張衝浪板最多 ${MAX_SURFBOARD_IMAGES} 張圖片。`;
        break;
      }

      const fileError = validateSurfboardImageFile(file);
      if (fileError) {
        error = fileError;
        break;
      }

      additions.push({
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (additions.length > 0) {
      setEditorImages((current) => [...current, ...additions]);
      setEditorImageIndex(editorImages.length);
    }

    setNotice(error ? { tone: "danger", text: error } : null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeCurrentEditorImage = () => {
    const index = editorImageIndex;

    setEditorImages((current) => {
      const target = current[index];
      if (target?.kind === "new") {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });

    setEditorImageIndex((current) => Math.max(current - 1, 0));
  };

  const moveCurrentEditorImage = (offset: -1 | 1) => {
    const index = editorImageIndex;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= editorImages.length) return;

    setEditorImages((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setEditorImageIndex(targetIndex);
  };

  const handleSave = async () => {
    if (isBusy) return;

    const validation = validateSurfboardForm(form);
    if (validation.error !== null) {
      setNotice({ tone: "danger", text: validation.error });
      return;
    }

    if (editorImages.length === 0) {
      setNotice({ tone: "danger", text: "請至少上傳 1 張圖片。" });
      return;
    }

    if (editorImages.length > MAX_SURFBOARD_IMAGES) {
      setNotice({
        tone: "danger",
        text: `每張衝浪板最多 ${MAX_SURFBOARD_IMAGES} 張圖片。`,
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    if (isCreateMode) {
      const result = await createSurfboard({
        values: validation.values,
        files: editorImages
          .filter(
            (item): item is Extract<SurfboardEditorImage, { kind: "new" }> =>
              item.kind === "new"
          )
          .map((item) => item.file),
      });

      setIsSaving(false);

      if (result.error) {
        const warningSuffix = result.warning ? `（${result.warning}）` : "";
        setNotice({ tone: "danger", text: `${result.error}${warningSuffix}` });
        return;
      }

      revokeNewImagePreviews(editorImages);
      await onCreated("衝浪板已新增。");
      return;
    }

    if (!board) return;

    const keptExistingIds = new Set(
      editorImages
        .filter(
          (item): item is Extract<SurfboardEditorImage, { kind: "existing" }> =>
            item.kind === "existing"
        )
        .map((item) => item.image.id)
    );
    const removedImages = board.images.filter(
      (image) => !keptExistingIds.has(image.id)
    );

    const result = await updateSurfboard({
      surfboardId: board.id,
      values: validation.values,
      finalImages: editorImages,
      removedImages,
    });

    setIsSaving(false);

    if (result.error) {
      // 失敗時保留使用者尚未儲存的輸入。
      const warningSuffix = result.warning ? `（${result.warning}）` : "";
      setNotice({ tone: "danger", text: `${result.error}${warningSuffix}` });
      return;
    }

    revokeNewImagePreviews(editorImages);
    await onSaved();
    setIsEditing(false);
    setNotice(
      result.warning
        ? { tone: "warning", text: result.warning }
        : { tone: "success", text: "衝浪板已更新。" }
    );
  };

  const handleDelete = async () => {
    if (!board || isBusy) return;

    setIsDeleting(true);
    setNotice(null);

    const result = await deleteSurfboard(board);

    setIsDeleting(false);
    setShowDeleteConfirm(false);

    if (result.error) {
      setNotice({ tone: "danger", text: result.error });
      return;
    }

    await onDeleted(result.warning ?? "衝浪板已移除。");
  };

  const viewBoard = board;

  const editorCarouselImages: CarouselImage[] = editorImages.map(
    (item, index) => ({
      key: item.kind === "existing" ? item.image.id : item.previewUrl,
      url:
        item.kind === "existing"
          ? (imageUrls[item.image.storage_path] ?? null)
          : item.previewUrl,
      alt: `第 ${index + 1} 張圖片預覽`,
    })
  );

  const safeEditorIndex =
    editorImages.length === 0
      ? 0
      : Math.min(editorImageIndex, editorImages.length - 1);

  const title = isCreateMode
    ? "新增衝浪板"
    : isEditing
      ? "編輯衝浪板"
      : "衝浪板詳細資料";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>

          <div className="flex flex-wrap items-center gap-2">
            {!isCreateMode && !isEditing && (
              <>
                <Button
                  variant="outline"
                  className="!min-h-9 !px-3 !text-xs"
                  icon={<Pencil size={14} />}
                  title="編輯衝浪板"
                  onClick={startEditing}
                  disabled={isBusy}
                >
                  編輯
                </Button>
                <Button
                  variant="danger"
                  className="!min-h-9 !px-3 !text-xs"
                  icon={<Trash2 size={14} />}
                  title="移除衝浪板"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isBusy}
                >
                  {isDeleting ? "移除中..." : "移除衝浪板"}
                </Button>
              </>
            )}

            {isEditing && (
              <>
                <Button
                  variant="primary"
                  className="!min-h-9 !px-3 !text-xs"
                  icon={<Save size={14} />}
                  title={isCreateMode ? "新增衝浪板" : "儲存變更"}
                  onClick={() => void handleSave()}
                  disabled={isBusy}
                >
                  {isSaving
                    ? isCreateMode
                      ? "新增中..."
                      : "儲存中..."
                    : isCreateMode
                      ? "新增"
                      : "儲存"}
                </Button>
                <Button
                  variant="outline"
                  className="!min-h-9 !px-3 !text-xs"
                  icon={<X size={14} />}
                  title="取消編輯"
                  onClick={cancelEditing}
                  disabled={isBusy}
                >
                  取消
                </Button>
              </>
            )}

            <button
              type="button"
              aria-label="關閉視窗"
              title="關閉視窗"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleClose}
              disabled={isBusy}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {notice && (
            <p
              role="status"
              className={`mb-4 rounded-xl border px-3 py-2 text-sm ${noticeToneClasses[notice.tone]}`}
            >
              {notice.text}
            </p>
          )}

          {isEditing ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    圖片（最少 1 張、最多 {MAX_SURFBOARD_IMAGES} 張）
                  </p>

                  <SurfboardImageCarousel
                    images={editorCarouselImages}
                    activeIndex={safeEditorIndex}
                    onActiveIndexChange={setEditorImageIndex}
                    emptyLabel="尚未加入圖片"
                    overlay={
                      editorImages.length > 0 ? (
                        <button
                          type="button"
                          aria-label={`移除第 ${safeEditorIndex + 1} 張圖片`}
                          title="移除這張圖片"
                          onClick={removeCurrentEditorImage}
                          disabled={isBusy}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <X size={14} />
                        </button>
                      ) : null
                    }
                  />

                  {editorImages.length > 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        aria-label="將這張圖片往前移"
                        title="往前移"
                        onClick={() => moveCurrentEditorImage(-1)}
                        disabled={isBusy || safeEditorIndex === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs text-slate-500">
                        第 {safeEditorIndex + 1} / {editorImages.length} 張
                      </span>
                      <button
                        type="button"
                        aria-label="將這張圖片往後移"
                        title="往後移"
                        onClick={() => moveCurrentEditorImage(1)}
                        disabled={
                          isBusy || safeEditorIndex === editorImages.length - 1
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    fullWidth
                    className="mt-3 !min-h-9 !text-xs"
                    icon={<Plus size={14} />}
                    title="新增圖片"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      isBusy || editorImages.length >= MAX_SURFBOARD_IMAGES
                    }
                  >
                    {editorImages.length >= MAX_SURFBOARD_IMAGES
                      ? `已達 ${MAX_SURFBOARD_IMAGES} 張上限`
                      : "新增圖片"}
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(event) => handleAddFiles(event.target.files)}
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    支援 JPG、PNG、WebP，每張最大 {MAX_SURFBOARD_IMAGE_SIZE_MB}
                    MB。第 1 張會作為列表封面。
                  </p>
                </div>
              </div>

              <div>
                <div className="grid gap-4">
                  <FormField label="衝浪板名稱">
                    <input
                      type="text"
                      value={form.name}
                      maxLength={100}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="例如：藍白軟板"
                      className={fieldControlClasses}
                      disabled={isBusy}
                    />
                  </FormField>

                  <FormField label="適合程度">
                    <select
                      value={form.suitability_level}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          suitability_level: event.target
                            .value as SurfboardFormData["suitability_level"],
                        }))
                      }
                      className={fieldControlClasses}
                      disabled={isBusy}
                    >
                      {surfboardSuitabilityLevelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      板型（可複選）
                    </span>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {surfboardBoardTypeOptions.map((boardType) => (
                        <label
                          key={boardType}
                          className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={form.board_types.includes(boardType)}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                board_types: event.target.checked
                                  ? [...current.board_types, boardType]
                                  : current.board_types.filter(
                                      (item) => item !== boardType
                                    ),
                              }))
                            }
                            disabled={isBusy}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                          />
                          {boardType}
                        </label>
                      ))}
                    </div>
                  </div>

                  <FormField
                    label="浮力（L）"
                    hint={`單位：公升（L），例如 45.5；留空顯示「${surfboardUnknownValueText}」`}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.buoyancy}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          buoyancy: event.target.value,
                        }))
                      }
                      placeholder="例如 45.5，可留空"
                      className={fieldControlClasses}
                      disabled={isBusy}
                    />
                  </FormField>

                  <FormField
                    label="長度（呎吋）"
                    hint={`格式：呎'吋，例如 5'4 代表五呎四吋；留空顯示「${surfboardUnknownValueText}」`}
                  >
                    <input
                      type="text"
                      value={form.length}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          length: event.target.value,
                        }))
                      }
                      placeholder="例如 5'4 或 9，可留空"
                      className={fieldControlClasses}
                      disabled={isBusy}
                    />
                  </FormField>

                  <FormField label="說明">
                    <textarea
                      value={form.description}
                      maxLength={2000}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="衝浪板狀況、適用情境或其他備註"
                      className={`min-h-24 ${fieldControlClasses}`}
                      disabled={isBusy}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          ) : (
            viewBoard && (
              <SurfboardDetailView board={viewBoard} imageUrls={imageUrls} />
            )
          )}
        </div>

        {showDeleteConfirm && viewBoard && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-label="確認移除衝浪板"
          >
            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-light text-danger">
                  <AlertTriangle size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    確認移除衝浪板
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    確定要移除衝浪板「{viewBoard.name}」嗎？相關的{" "}
                    {viewBoard.images.length} 張圖片也會一併移除，此操作無法復原。
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="!min-h-9 !px-3 !text-xs"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  className="!min-h-9 !px-3 !text-xs"
                  icon={<Trash2 size={14} />}
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                >
                  {isDeleting ? "移除中..." : "確認移除"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
