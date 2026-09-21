import { createClient } from "@/lib/supabase/client";

export const ANNOUNCEMENT_IMAGE_BUCKET = "announcement-images";
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ANNOUNCEMENT_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateAnnouncementImage(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    return "只支援 JPG、PNG、WebP 或 GIF 圖片。";
  }

  if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
    return "圖片大小不得超過 5 MB。";
  }

  return null;
}

export async function uploadAnnouncementImage(
  announcementId: string,
  file: File
) {
  const validationError = validateAnnouncementImage(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const extension = fileExtensions[file.type] ?? "jpg";
  const path = `${announcementId}/${crypto.randomUUID()}.${extension}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(ANNOUNCEMENT_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  return {
    path: error ? null : path,
    error: error?.message ?? null,
  };
}

export async function removeAnnouncementImages(paths: string[]) {
  const validPaths = paths.filter(Boolean);
  if (validPaths.length === 0) return null;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(ANNOUNCEMENT_IMAGE_BUCKET)
    .remove(validPaths);

  return error?.message ?? null;
}

export async function createSignedAnnouncementImageUrls(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) {
    return { urls: {} as Record<string, string>, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(ANNOUNCEMENT_IMAGE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60);

  if (error) {
    return { urls: {} as Record<string, string>, error: error.message };
  }

  return {
    urls: Object.fromEntries(
      (data ?? [])
        .filter((item) => item.signedUrl)
        .map((item) => [item.path, item.signedUrl])
    ),
    error: null,
  };
}
