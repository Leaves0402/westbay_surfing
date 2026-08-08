"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
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
  surfboardUsageLevelOptions,
} from "@/lib/types";

type Notice = {
  tone: "success" | "danger" | "warning";
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
      usage_level: "全新",
      description: "",
    };
  }

  return {
    name: board.name,
    suitability_level: board.suitability_level,
    board_types: [...board.board_types],
    buoyancy: String(board.buoyancy),
    length: String(board.length),
    usage_level: board.usage_level,
    description: board.description ?? "",
  };
}

function makeEditorImagesFromBoard(
  board: SurfboardWithImages | null
): SurfboardEditorImage[] {
  if (!board) return [];
  return board.images.map((image) => ({ kind: "existing", image }));
}

function getEditorImageKey(item: SurfboardEditorImage) {
  return item.kind === "existing" ? item.image.id : item.previewUrl;
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
  userId,
  onClose,
  onCreated,
  onSaved,
  onDeleted,
}: {
  /** null 代表新增模式。 */
  board: SurfboardWithImages | null;
  imageUrls: Record<string, string>;
  userId: string;
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [failedThumbKeys, setFailedThumbKeys] = useState<
    Record<string, boolean>
  >({});

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

  // 鍵盤 Esc 關閉。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isBusy) return;

      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return;
      }

      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose, showDeleteConfirm]);

  const startEditing = () => {
    if (!board) return;
    setForm(makeFormFromBoard(board));
    setEditorImages(makeEditorImagesFromBoard(board));
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
    }

    setNotice(error ? { tone: "danger", text: error } : null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeEditorImage = (index: number) => {
    setEditorImages((current) => {
      const target = current[index];
      if (target?.kind === "new") {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const moveEditorImage = (index: number, offset: -1 | 1) => {
    setEditorImages((current) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
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
        userId,
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

  // 檢視模式資料同步：儲存後由外層重新載入的 board 直接更新畫面。
  const viewBoard = board;

  const carouselImages: CarouselImage[] = (viewBoard?.images ?? []).map(
    (image, index) => ({
      key: image.id,
      url: imageUrls[image.storage_path] ?? null,
      alt: `衝浪板「${viewBoard?.name ?? ""}」的第 ${index + 1} 張圖片`,
    })
  );

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

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              {isEditing ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    圖片（最少 1 張、最多 {MAX_SURFBOARD_IMAGES} 張）
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {editorImages.map((item, index) => {
                      const key = getEditorImageKey(item);
                      const url =
                        item.kind === "existing"
                          ? (imageUrls[item.image.storage_path] ?? null)
                          : item.previewUrl;

                      return (
                        <div key={key}>
                          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-bg">
                            {url && !failedThumbKeys[key] ? (
                              <Image
                                src={url}
                                alt={`第 ${index + 1} 張圖片預覽`}
                                fill
                                unoptimized
                                className="object-cover"
                                onError={() =>
                                  setFailedThumbKeys((prev) => ({
                                    ...prev,
                                    [key]: true,
                                  }))
                                }
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <ImageOff size={18} strokeWidth={1.5} />
                              </div>
                            )}

                            <button
                              type="button"
                              aria-label={`移除第 ${index + 1} 張圖片`}
                              title="移除圖片"
                              onClick={() => removeEditorImage(index)}
                              disabled={isBusy}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-danger disabled:opacity-40"
                            >
                              <X size={12} />
                            </button>
                          </div>

                          <div className="mt-1.5 flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`將第 ${index + 1} 張圖片往前移`}
                              title="往前移"
                              onClick={() => moveEditorImage(index, -1)}
                              disabled={isBusy || index === 0}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-slate-500">
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              aria-label={`將第 ${index + 1} 張圖片往後移`}
                              title="往後移"
                              onClick={() => moveEditorImage(index, 1)}
                              disabled={
                                isBusy || index === editorImages.length - 1
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {editorImages.length < MAX_SURFBOARD_IMAGES && (
                      <button
                        type="button"
                        aria-label="新增圖片"
                        title="新增圖片"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isBusy}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-slate-400 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={20} />
                        <span className="text-xs">新增圖片</span>
                      </button>
                    )}
                  </div>

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
              ) : (
                <SurfboardImageCarousel images={carouselImages} />
              )}
            </div>

            <div>
              {isEditing ? (
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
                      placeholder="例如：藍白軟板 8'0"
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

                  <FormField label="浮力（L）" hint="單位：公升（L），例如 45.5">
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
                      placeholder="例如 45.5"
                      className={fieldControlClasses}
                      disabled={isBusy}
                    />
                  </FormField>

                  <FormField label="長度（呎）" hint="單位：呎（ft），例如 6 或 9.2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.length}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          length: event.target.value,
                        }))
                      }
                      placeholder="例如 6 或 9.2"
                      className={fieldControlClasses}
                      disabled={isBusy}
                    />
                  </FormField>

                  <FormField label="使用程度">
                    <select
                      value={form.usage_level}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          usage_level: event.target
                            .value as SurfboardFormData["usage_level"],
                        }))
                      }
                      className={fieldControlClasses}
                      disabled={isBusy}
                    >
                      {surfboardUsageLevelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
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
              ) : (
                viewBoard && (
                  <dl className="grid gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">衝浪板名稱</dt>
                      <dd className="mt-0.5 text-base font-semibold text-slate-900">
                        {viewBoard.name}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">適合程度</dt>
                      <dd className="mt-1">
                        <Badge tone="info">{viewBoard.suitability_level}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">板型</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {viewBoard.board_types.map((boardType) => (
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
                          {viewBoard.buoyancy} L
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">長度</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">
                          {viewBoard.length} 呎
                        </dd>
                      </div>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">使用程度</dt>
                      <dd className="mt-1">
                        <Badge tone="neutral">{viewBoard.usage_level}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">說明</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap leading-6 text-slate-700">
                        {viewBoard.description || "未填寫"}
                      </dd>
                    </div>
                  </dl>
                )
              )}
            </div>
          </div>
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
