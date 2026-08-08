import { createClient } from "@/lib/supabase/client";
import type {
  SurfboardBoardType,
  SurfboardFormData,
  SurfboardImage,
  SurfboardSuitabilityLevel,
  SurfboardWithImages,
} from "@/lib/types";
import {
  surfboardBoardTypeOptions,
  surfboardSuitabilityLevelOptions,
} from "@/lib/types";

export const SURFBOARD_IMAGES_BUCKET = "surfboard-images";
export const MAX_SURFBOARD_IMAGES = 3;
export const MAX_SURFBOARD_IMAGE_SIZE_MB = 5;
export const ALLOWED_SURFBOARD_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;

const surfboardSelectColumns =
  "id, name, suitability_level, board_types, buoyancy, length, description, created_by, created_at, updated_at";

const surfboardImageSelectColumns =
  "id, surfboard_id, storage_path, sort_order, created_at";

type SurfboardRow = Omit<SurfboardWithImages, "images">;

export type ParsedSurfboardValues = {
  name: string;
  suitability_level: SurfboardSuitabilityLevel;
  board_types: SurfboardBoardType[];
  buoyancy: number | null;
  length: string | null;
  description: string | null;
};

export type SurfboardMutationResult = {
  error: string | null;
  /** 主要操作成功，但 Storage 清理等附帶動作失敗時的提示。 */
  warning?: string;
};

export type SurfboardEditorImage =
  | { kind: "existing"; image: SurfboardImage }
  | { kind: "new"; file: File; previewUrl: string };

const decimalNumberPattern = /^\d+(\.\d+)?$/;

/** 長度使用呎吋格式，例如 5'4（五呎四吋）或 9（九呎整）。 */
const feetInchesPattern = /^(\d{1,2})(?:['’](\d{1,2})["”]?)?$/;

/**
 * 將使用者輸入的長度正規化成 5'4 或 9 的格式，格式錯誤時回傳 null。
 */
export function normalizeSurfboardLength(input: string): string | null {
  const match = feetInchesPattern.exec(input.trim());
  if (!match) return null;

  const feet = Number(match[1]);
  if (!Number.isInteger(feet) || feet < 1 || feet > 20) return null;

  if (match[2] === undefined) {
    return String(feet);
  }

  const inches = Number(match[2]);
  if (!Number.isInteger(inches) || inches < 0 || inches > 11) return null;

  return inches === 0 ? String(feet) : `${feet}'${inches}`;
}

export function validateSurfboardForm(
  form: SurfboardFormData
): { values: ParsedSurfboardValues; error: null } | { values: null; error: string } {
  const name = form.name.trim();
  if (!name) {
    return { values: null, error: "請填寫衝浪板名稱。" };
  }
  if (name.length > 100) {
    return { values: null, error: "衝浪板名稱最多 100 字。" };
  }

  if (!surfboardSuitabilityLevelOptions.includes(form.suitability_level)) {
    return { values: null, error: "請選擇適合程度。" };
  }

  if (form.board_types.length === 0) {
    return { values: null, error: "請至少選擇一種板型。" };
  }
  if (
    form.board_types.some(
      (boardType) => !surfboardBoardTypeOptions.includes(boardType)
    )
  ) {
    return { values: null, error: "板型選項不正確。" };
  }

  // 浮力與長度可留空，留空時存為 null，畫面顯示「未知」。
  const buoyancyInput = form.buoyancy.trim();
  let buoyancy: number | null = null;

  if (buoyancyInput) {
    if (!decimalNumberPattern.test(buoyancyInput)) {
      return {
        values: null,
        error: "浮力請輸入數字，例如 45 或 45.5（單位 L），或留空表示未知。",
      };
    }

    buoyancy = Number(buoyancyInput);
    if (!Number.isFinite(buoyancy) || buoyancy <= 0 || buoyancy > 999) {
      return { values: null, error: "浮力必須介於 0 到 999 公升（L）之間。" };
    }
  }

  const lengthInput = form.length.trim();
  let length: string | null = null;

  if (lengthInput) {
    length = normalizeSurfboardLength(lengthInput);
    if (!length) {
      return {
        values: null,
        error:
          "長度請使用呎吋格式，例如 5'4（五呎四吋）或 9（九呎），或留空表示未知。",
      };
    }
  }

  const description = form.description.trim();
  if (description.length > 2000) {
    return { values: null, error: "說明最多 2000 字。" };
  }

  return {
    values: {
      name,
      suitability_level: form.suitability_level,
      board_types: form.board_types,
      buoyancy,
      length,
      description: description || null,
    },
    error: null,
  };
}

export function validateSurfboardImageFile(file: File): string | null {
  if (!ALLOWED_SURFBOARD_IMAGE_TYPES.includes(file.type)) {
    return `「${file.name}」格式不支援，請上傳 JPG、PNG 或 WebP 圖片。`;
  }

  if (file.size > MAX_SURFBOARD_IMAGE_SIZE_MB * 1024 * 1024) {
    return `「${file.name}」超過 ${MAX_SURFBOARD_IMAGE_SIZE_MB}MB 上限。`;
  }

  return null;
}

export async function fetchSurfboards(): Promise<
  { data: SurfboardWithImages[]; error: null } | { data: null; error: string }
> {
  const supabase = createClient();

  const [boardsResult, imagesResult] = await Promise.all([
    supabase
      .from("surfboards")
      .select(surfboardSelectColumns)
      .order("created_at", { ascending: true }),
    supabase
      .from("surfboard_images")
      .select(surfboardImageSelectColumns)
      .order("sort_order", { ascending: true }),
  ]);

  if (boardsResult.error) {
    return { data: null, error: boardsResult.error.message };
  }

  if (imagesResult.error) {
    return { data: null, error: imagesResult.error.message };
  }

  const boards = (boardsResult.data ?? []) as SurfboardRow[];
  const images = (imagesResult.data ?? []) as SurfboardImage[];

  return {
    data: boards.map((board) => ({
      ...board,
      images: images.filter((image) => image.surfboard_id === board.id),
    })),
    error: null,
  };
}

export async function createSignedSurfboardImageUrls(
  storagePaths: string[]
): Promise<
  { urls: Record<string, string>; error: null } | { urls: null; error: string }
> {
  if (storagePaths.length === 0) {
    return { urls: {}, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(SURFBOARD_IMAGES_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) {
    return { urls: null, error: error.message };
  }

  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      urls[item.path] = item.signedUrl;
    }
  }

  return { urls, error: null };
}

function getImageFileExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

async function removeStorageFiles(storagePaths: string[]): Promise<string | null> {
  if (storagePaths.length === 0) return null;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(SURFBOARD_IMAGES_BUCKET)
    .remove(storagePaths);

  return error ? error.message : null;
}

async function uploadSurfboardImageFiles(
  surfboardId: string,
  files: File[]
): Promise<
  { paths: string[]; error: null } | { paths: string[]; error: string }
> {
  const supabase = createClient();
  const uploadedPaths: string[] = [];

  for (const file of files) {
    const fileError = validateSurfboardImageFile(file);
    if (fileError) {
      await removeStorageFiles(uploadedPaths);
      return { paths: [], error: fileError };
    }

    const path = `${surfboardId}/${crypto.randomUUID()}.${getImageFileExtension(file)}`;
    const { error } = await supabase.storage
      .from(SURFBOARD_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      await removeStorageFiles(uploadedPaths);
      return { paths: [], error: `圖片「${file.name}」上傳失敗：${error.message}` };
    }

    uploadedPaths.push(path);
  }

  return { paths: uploadedPaths, error: null };
}

export async function createSurfboard(input: {
  values: ParsedSurfboardValues;
  files: File[];
  userId: string;
}): Promise<SurfboardMutationResult> {
  const { values, files, userId } = input;

  if (files.length === 0) {
    return { error: "請至少上傳 1 張圖片。" };
  }

  if (files.length > MAX_SURFBOARD_IMAGES) {
    return { error: `每張衝浪板最多 ${MAX_SURFBOARD_IMAGES} 張圖片。` };
  }

  const supabase = createClient();

  const { data: insertedBoard, error: insertError } = await supabase
    .from("surfboards")
    .insert({
      name: values.name,
      suitability_level: values.suitability_level,
      board_types: values.board_types,
      buoyancy: values.buoyancy,
      length: values.length,
      description: values.description,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !insertedBoard) {
    return {
      error: `新增衝浪板失敗：${insertError?.message ?? "未知錯誤"}`,
    };
  }

  const surfboardId = (insertedBoard as { id: string }).id;

  const uploadResult = await uploadSurfboardImageFiles(surfboardId, files);
  if (uploadResult.error) {
    await supabase.from("surfboards").delete().eq("id", surfboardId);
    return { error: uploadResult.error };
  }

  const { error: imagesError } = await supabase.from("surfboard_images").insert(
    uploadResult.paths.map((storagePath, index) => ({
      surfboard_id: surfboardId,
      storage_path: storagePath,
      sort_order: index,
    }))
  );

  if (imagesError) {
    // 資料儲存失敗時清掉剛上傳的檔案與衝浪板資料，避免留下孤兒檔案。
    const cleanupError = await removeStorageFiles(uploadResult.paths);
    await supabase.from("surfboards").delete().eq("id", surfboardId);
    return {
      error: `儲存圖片資料失敗：${imagesError.message}`,
      warning: cleanupError
        ? `已上傳的圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage：${uploadResult.paths.join("、")}`
        : undefined,
    };
  }

  return { error: null };
}

export async function updateSurfboard(input: {
  surfboardId: string;
  values: ParsedSurfboardValues;
  finalImages: SurfboardEditorImage[];
  removedImages: SurfboardImage[];
}): Promise<SurfboardMutationResult> {
  const { surfboardId, values, finalImages, removedImages } = input;

  if (finalImages.length === 0) {
    return { error: "請至少保留 1 張圖片。" };
  }

  if (finalImages.length > MAX_SURFBOARD_IMAGES) {
    return { error: `每張衝浪板最多 ${MAX_SURFBOARD_IMAGES} 張圖片。` };
  }

  const supabase = createClient();

  const newFiles = finalImages
    .filter(
      (item): item is Extract<SurfboardEditorImage, { kind: "new" }> =>
        item.kind === "new"
    )
    .map((item) => item.file);

  const uploadResult = await uploadSurfboardImageFiles(surfboardId, newFiles);
  if (uploadResult.error) {
    return { error: uploadResult.error };
  }

  const { error: updateError } = await supabase
    .from("surfboards")
    .update({
      name: values.name,
      suitability_level: values.suitability_level,
      board_types: values.board_types,
      buoyancy: values.buoyancy,
      length: values.length,
      description: values.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", surfboardId);

  if (updateError) {
    const cleanupError = await removeStorageFiles(uploadResult.paths);
    return {
      error: `更新衝浪板失敗：${updateError.message}`,
      warning: cleanupError
        ? `新上傳的圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
        : undefined,
    };
  }

  if (removedImages.length > 0) {
    const { error: deleteRowsError } = await supabase
      .from("surfboard_images")
      .delete()
      .in(
        "id",
        removedImages.map((image) => image.id)
      );

    if (deleteRowsError) {
      const cleanupError = await removeStorageFiles(uploadResult.paths);
      return {
        error: `移除舊圖片失敗：${deleteRowsError.message}`,
        warning: cleanupError
          ? `新上傳的圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
          : undefined,
      };
    }
  }

  // 依照最終順序更新既有圖片的 sort_order，並插入新圖片。
  let newFileIndex = 0;
  const newImageRows: Array<{
    surfboard_id: string;
    storage_path: string;
    sort_order: number;
  }> = [];

  for (let index = 0; index < finalImages.length; index += 1) {
    const item = finalImages[index];

    if (item.kind === "existing") {
      if (item.image.sort_order !== index) {
        const { error: sortError } = await supabase
          .from("surfboard_images")
          .update({ sort_order: index })
          .eq("id", item.image.id);

        if (sortError) {
          const cleanupError = await removeStorageFiles(uploadResult.paths);
          return {
            error: `更新圖片順序失敗：${sortError.message}`,
            warning: cleanupError
              ? `新上傳的圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
              : undefined,
          };
        }
      }
    } else {
      newImageRows.push({
        surfboard_id: surfboardId,
        storage_path: uploadResult.paths[newFileIndex],
        sort_order: index,
      });
      newFileIndex += 1;
    }
  }

  if (newImageRows.length > 0) {
    const { error: insertImagesError } = await supabase
      .from("surfboard_images")
      .insert(newImageRows);

    if (insertImagesError) {
      const cleanupError = await removeStorageFiles(uploadResult.paths);
      return {
        error: `儲存新圖片資料失敗：${insertImagesError.message}`,
        warning: cleanupError
          ? `新上傳的圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
          : undefined,
      };
    }
  }

  const removedCleanupError = await removeStorageFiles(
    removedImages.map((image) => image.storage_path)
  );

  return {
    error: null,
    warning: removedCleanupError
      ? `衝浪板已更新，但部分舊圖片檔案清除失敗（${removedCleanupError}），請通知維護人員檢查 Storage：${removedImages
          .map((image) => image.storage_path)
          .join("、")}`
      : undefined,
  };
}

export async function deleteSurfboard(
  board: SurfboardWithImages
): Promise<SurfboardMutationResult> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("surfboards")
    .delete()
    .eq("id", board.id);

  if (deleteError) {
    return { error: `移除衝浪板失敗：${deleteError.message}` };
  }

  const storagePaths = board.images.map((image) => image.storage_path);
  const cleanupError = await removeStorageFiles(storagePaths);

  return {
    error: null,
    warning: cleanupError
      ? `衝浪板已移除，但圖片檔案清除失敗（${cleanupError}），請通知維護人員檢查 Storage：${storagePaths.join("、")}`
      : undefined,
  };
}
