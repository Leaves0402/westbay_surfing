/**
 * 首頁圖片的瀏覽器端處理：格式驗證、裁切、縮放與 WebP 壓縮。
 * 使用者只要選檔案與拉裁切框，不需要自己轉檔。
 */

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_UPLOAD_SIZE_MB = 10;

/** react-easy-crop 回傳的實際裁切像素區域。 */
export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageOutputSpec = {
  width: number;
  height: number;
  /** 0–1，約 0.8–0.85 之間可兼顧畫質與檔案大小。 */
  quality: number;
};

/** 各區塊的輸出規格（裁切比例＝width / height）。 */
export const imageOutputSpecs = {
  hero: { width: 2400, height: 1350, quality: 0.82 },
  banner: { width: 2400, height: 1200, quality: 0.82 },
  footer: { width: 2400, height: 1200, quality: 0.82 },
  officer: { width: 1000, height: 1250, quality: 0.85 },
  qrCode: { width: 800, height: 800, quality: 0.9 },
} as const satisfies Record<string, ImageOutputSpec>;

export type ImageOutputKind = keyof typeof imageOutputSpecs;

export function getAspectRatio(kind: ImageOutputKind) {
  const spec = imageOutputSpecs[kind];
  return spec.width / spec.height;
}

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return `「${file.name}」格式不支援，請上傳 JPG、JPEG、PNG 或 WebP 圖片。`;
  }

  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `「${file.name}」大小 ${sizeMb}MB，超過 ${MAX_UPLOAD_SIZE_MB}MB 上限，請先壓縮或選擇較小的圖片。`;
  }

  return null;
}

function loadImageElement(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片讀取失敗，請換一張圖片試試。"));
    image.src = objectUrl;
  });
}

/**
 * 依裁切區域產生指定尺寸的 WebP 圖片。
 * 若瀏覽器不支援 WebP 則退回 JPEG，避免完全無法上傳。
 */
export async function cropImageToWebp({
  file,
  cropArea,
  kind,
}: {
  file: File;
  cropArea: CropArea;
  kind: ImageOutputKind;
}): Promise<{ blob: Blob; extension: string; contentType: string }> {
  const spec = imageOutputSpecs[kind];
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);

    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("此瀏覽器不支援圖片處理，請改用其他瀏覽器。");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      Math.max(0, Math.round(cropArea.x)),
      Math.max(0, Math.round(cropArea.y)),
      Math.max(1, Math.round(cropArea.width)),
      Math.max(1, Math.round(cropArea.height)),
      0,
      0,
      spec.width,
      spec.height
    );

    const webpBlob = await canvasToBlob(canvas, "image/webp", spec.quality);
    if (webpBlob) {
      return { blob: webpBlob, extension: "webp", contentType: "image/webp" };
    }

    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", spec.quality);
    if (jpegBlob) {
      return { blob: jpegBlob, extension: "jpg", contentType: "image/jpeg" };
    }

    throw new Error("圖片壓縮失敗，請換一張圖片試試。");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => {
        // 部分瀏覽器不支援某些格式時會回傳 PNG，這裡確認 type 是否相符。
        resolve(blob && blob.type === type ? blob : null);
      },
      type,
      quality
    );
  });
}
