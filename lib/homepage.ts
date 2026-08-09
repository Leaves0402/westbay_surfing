import { createClient } from "@/lib/supabase/client";
import {
  bannerSection as fallbackBanner,
  clubIntro as fallbackClubIntro,
  footerContact as fallbackFooterContact,
  footerImage as fallbackFooterImage,
  heroContent as fallbackHeroContent,
  heroSlides as fallbackHeroSlides,
  officers as fallbackOfficers,
} from "@/lib/siteContent";

export const HOMEPAGE_IMAGES_BUCKET = "homepage-images";

export const MAX_HERO_IMAGES = 6;
export const MIN_HERO_IMAGES = 1;
export const MAX_ABOUT_HIGHLIGHTS = 6;
export const MAX_ABOUT_PARAGRAPHS = 4;
export const MAX_OFFICERS = 12;

export type HomepageMediaKind = "hero" | "banner" | "footer" | "qr_code";

/** 首頁圖片：可能來自 Supabase Storage，也可能是本機 fallback 圖。 */
export type HomepageImage = {
  /**
   * 圖片位置。兩種可能：
   * - Supabase Storage 路徑，例如 `hero/uuid.webp`
   * - 以 `/` 開頭的本機 public 圖片，例如 `/images/home/hero/hero-01.webp`
   *
   * 這樣即使還沒上傳任何照片，也可以直接沿用本機圖片存檔與顯示。
   */
  storagePath: string | null;
  /** 實際可顯示的網址。 */
  url: string;
  alt: string;
  /** object-position 百分比，避免人物在手機版被裁掉。 */
  focalX: number;
  focalY: number;
};

export type HomepageHighlight = {
  title: string;
  description: string;
};

export type HomepageOfficer = {
  /** 資料庫 id；尚未儲存的新資料為 null。 */
  id: string | null;
  displayName: string;
  roleTitle: string;
  bio: string;
  image: HomepageImage | null;
};

export type HomepageContent = {
  heroTitle: string;
  heroSubtitle: string;
  aboutEyebrow: string;
  aboutHeading: string;
  aboutParagraphs: string[];
  aboutHighlights: HomepageHighlight[];
  bannerSlogan: string;
  bannerSubtitle: string;
  footerClubName: string;
  footerDescription: string;
  /** 已正規化的 Instagram 連結；空字串代表不顯示。 */
  footerInstagramUrl: string;
  /** 聯絡網站管理員：Email 或網址；空字串代表不顯示。 */
  footerAdminContact: string;
};

export type HomepageData = {
  content: HomepageContent;
  heroImages: HomepageImage[];
  bannerImage: HomepageImage | null;
  footerImage: HomepageImage | null;
  qrCodeImage: HomepageImage | null;
  officers: HomepageOfficer[];
  /** true 表示資料來自 Supabase；false 表示使用本機 fallback。 */
  isRemote: boolean;
};

type MediaRow = {
  id: string;
  kind: HomepageMediaKind;
  storage_path: string;
  alt: string | null;
  sort_order: number;
  focal_x: number;
  focal_y: number;
};

type OfficerRow = {
  id: string;
  display_name: string;
  role_title: string;
  bio: string | null;
  storage_path: string | null;
  focal_x: number;
  focal_y: number;
  sort_order: number;
};

type ContentRow = {
  hero_title: string;
  hero_subtitle: string;
  about_eyebrow: string;
  about_heading: string;
  about_paragraphs: string[] | null;
  about_highlights: HomepageHighlight[] | null;
  banner_slogan: string;
  banner_subtitle: string;
  footer_club_name: string;
  footer_description: string;
  footer_instagram_url: string | null;
  footer_admin_contact: string | null;
};

const contentColumns =
  "hero_title, hero_subtitle, about_eyebrow, about_heading, about_paragraphs, about_highlights, banner_slogan, banner_subtitle, footer_club_name, footer_description, footer_instagram_url, footer_admin_contact";

const mediaColumns = "id, kind, storage_path, alt, sort_order, focal_x, focal_y";

const officerColumns =
  "id, display_name, role_title, bio, storage_path, focal_x, focal_y, sort_order";

/** 以 `/` 開頭代表 public 目錄下的本機圖片，不在 Supabase Storage 內。 */
export function isLocalAssetPath(path: string) {
  return path.startsWith("/");
}

/**
 * 把圖片位置轉成可顯示的網址。
 *
 * Supabase 專案網址會隨環境不同，因此圖片一律用 next/image 的 unoptimized 顯示；
 * 上傳時已經在瀏覽器端裁切、縮放並轉成 WebP，不需要再經過 Image Optimizer。
 */
export function resolveImageUrl(storagePath: string) {
  if (isLocalAssetPath(storagePath)) return storagePath;

  const supabase = createClient();
  const { data } = supabase.storage
    .from(HOMEPAGE_IMAGES_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

function parseObjectPosition(objectPosition: string) {
  const [rawX, rawY] = objectPosition.split(/\s+/);
  const x = Number.parseFloat(rawX ?? "50");
  const y = Number.parseFloat(rawY ?? "50");

  return {
    focalX: Number.isFinite(x) ? clampPercent(x) : 50,
    focalY: Number.isFinite(y) ? clampPercent(y) : 50,
  };
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function toObjectPosition(image: HomepageImage) {
  return `${image.focalX}% ${image.focalY}%`;
}

function mediaRowToImage(row: MediaRow): HomepageImage {
  return {
    storagePath: row.storage_path,
    url: resolveImageUrl(row.storage_path),
    alt: row.alt ?? "",
    focalX: clampPercent(row.focal_x),
    focalY: clampPercent(row.focal_y),
  };
}

/** 本機 fallback：SQL 還沒執行或讀取失敗時使用，避免首頁白屏。 */
export function getFallbackHomepageData(): HomepageData {
  return {
    content: {
      heroTitle: fallbackHeroContent.title,
      heroSubtitle: fallbackHeroContent.subtitle,
      aboutEyebrow: "ABOUT",
      aboutHeading: fallbackClubIntro.heading,
      aboutParagraphs: [...fallbackClubIntro.paragraphs],
      aboutHighlights: fallbackClubIntro.highlights.map((highlight) => ({
        ...highlight,
      })),
      bannerSlogan: fallbackBanner.slogan,
      bannerSubtitle: fallbackBanner.subtitle,
      footerClubName: fallbackFooterContact.clubName,
      footerDescription: fallbackFooterContact.description,
      footerInstagramUrl: "",
      footerAdminContact: "",
    },
    // 本機 fallback 圖也保留路徑，這樣第一次儲存時可以直接沿用，不會存到空值。
    heroImages: fallbackHeroSlides.map((slide) => ({
      storagePath: slide.src,
      url: slide.src,
      alt: slide.alt,
      ...parseObjectPosition(slide.objectPosition),
    })),
    bannerImage: {
      storagePath: fallbackBanner.image.src,
      url: fallbackBanner.image.src,
      alt: fallbackBanner.image.alt,
      ...parseObjectPosition(fallbackBanner.image.objectPosition),
    },
    footerImage: {
      storagePath: fallbackFooterImage.src,
      url: fallbackFooterImage.src,
      alt: fallbackFooterImage.alt,
      ...parseObjectPosition(fallbackFooterImage.objectPosition),
    },
    qrCodeImage: null,
    officers: fallbackOfficers.map((officer) => ({
      id: null,
      displayName: officer.name,
      roleTitle: officer.role,
      bio: officer.bio,
      image: {
        storagePath: officer.image.src,
        url: officer.image.src,
        alt: officer.image.alt,
        ...parseObjectPosition(officer.image.objectPosition),
      },
    })),
    isRemote: false,
  };
}

/**
 * 讀取首頁內容。任何一段失敗都退回本機 fallback，
 * 這樣即使 migration 還沒執行，首頁仍然可以正常顯示。
 */
export async function fetchHomepageData(): Promise<{
  data: HomepageData;
  error: string | null;
}> {
  const fallback = getFallbackHomepageData();

  try {
    const supabase = createClient();

    const [contentResult, mediaResult, officersResult] = await Promise.all([
      supabase.from("homepage_content").select(contentColumns).maybeSingle(),
      supabase
        .from("homepage_media")
        .select(mediaColumns)
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("homepage_officers")
        .select(officerColumns)
        .order("sort_order", { ascending: true }),
    ]);

    const firstError =
      contentResult.error ?? mediaResult.error ?? officersResult.error;

    if (firstError) {
      return { data: fallback, error: firstError.message };
    }

    const contentRow = contentResult.data as ContentRow | null;
    const mediaRows = (mediaResult.data ?? []) as MediaRow[];
    const officerRows = (officersResult.data ?? []) as OfficerRow[];

    const heroImages = mediaRows
      .filter((row) => row.kind === "hero")
      .map(mediaRowToImage);
    const bannerImage =
      mediaRows.filter((row) => row.kind === "banner").map(mediaRowToImage)[0] ??
      null;
    const footerImage =
      mediaRows.filter((row) => row.kind === "footer").map(mediaRowToImage)[0] ??
      null;
    const qrCodeImage =
      mediaRows
        .filter((row) => row.kind === "qr_code")
        .map(mediaRowToImage)[0] ?? null;

    const content: HomepageContent = contentRow
      ? {
          heroTitle: contentRow.hero_title,
          heroSubtitle: contentRow.hero_subtitle,
          aboutEyebrow: contentRow.about_eyebrow,
          aboutHeading: contentRow.about_heading,
          aboutParagraphs:
            contentRow.about_paragraphs && contentRow.about_paragraphs.length > 0
              ? contentRow.about_paragraphs
              : fallback.content.aboutParagraphs,
          aboutHighlights: contentRow.about_highlights ?? [],
          bannerSlogan: contentRow.banner_slogan,
          bannerSubtitle: contentRow.banner_subtitle,
          footerClubName: contentRow.footer_club_name,
          footerDescription: contentRow.footer_description,
          footerInstagramUrl: contentRow.footer_instagram_url ?? "",
          footerAdminContact: contentRow.footer_admin_contact ?? "",
        }
      : fallback.content;

    return {
      data: {
        content,
        // 遠端還沒有圖片時沿用本機 fallback 圖，不要顯示破圖。
        heroImages: heroImages.length > 0 ? heroImages : fallback.heroImages,
        bannerImage: bannerImage ?? fallback.bannerImage,
        footerImage: footerImage ?? fallback.footerImage,
        qrCodeImage,
        officers:
          officerRows.length > 0
            ? officerRows.map((row) => ({
                id: row.id,
                displayName: row.display_name,
                roleTitle: row.role_title,
                bio: row.bio ?? "",
                image: row.storage_path
                  ? {
                      storagePath: row.storage_path,
                      url: resolveImageUrl(row.storage_path),
                      alt: `${row.display_name}（${row.role_title}）`,
                      focalX: clampPercent(row.focal_x),
                      focalY: clampPercent(row.focal_y),
                    }
                  : null,
              }))
            : fallback.officers,
        isRemote: Boolean(contentRow),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error: error instanceof Error ? error.message : "讀取首頁內容失敗。",
    };
  }
}

/** Instagram 允許輸入帳號或完整網址，統一正規化為可點擊連結。 */
export function normalizeInstagramUrl(rawInput: string) {
  const value = rawInput.trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, "");
  }

  const handle = value.replace(/^@/, "").replace(/^instagram\.com\//i, "");
  const cleanHandle = handle.replace(/\/+$/, "");
  if (!cleanHandle) return "";

  return `https://www.instagram.com/${cleanHandle}`;
}

/** 從 Instagram 連結取出顯示用帳號。 */
export function getInstagramHandle(url: string) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const handle = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return handle ? `@${handle}` : parsed.hostname;
  } catch {
    return url;
  }
}

/** 聯絡網站管理員可以是 Email 或網址，回傳可點擊連結（不可點擊時為 null）。 */
export function getAdminContactHref(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;
  if (/^mailto:/i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;

  return null;
}

export type PendingImageUpload = {
  blob: Blob;
  contentType: string;
  extension: string;
};

/** 要儲存的圖片：沿用既有 Storage 檔案，或上傳新裁切好的圖片。 */
export type DraftImage = {
  /** 既有 Storage 路徑；新圖片為 null。 */
  storagePath: string | null;
  /** 預覽網址（既有圖片的公開網址或新圖片的 blob URL）。 */
  url: string;
  alt: string;
  focalX: number;
  focalY: number;
  /** 尚未上傳的新圖片內容。 */
  pendingUpload?: PendingImageUpload;
};

export type HomepageDraft = {
  content: HomepageContent;
  heroImages: DraftImage[];
  bannerImage: DraftImage | null;
  footerImage: DraftImage | null;
  qrCodeImage: DraftImage | null;
  officers: Array<{
    id: string | null;
    displayName: string;
    roleTitle: string;
    bio: string;
    image: DraftImage | null;
  }>;
};

export function toDraftImage(image: HomepageImage | null): DraftImage | null {
  if (!image) return null;
  return {
    storagePath: image.storagePath,
    url: image.url,
    alt: image.alt,
    focalX: image.focalX,
    focalY: image.focalY,
  };
}

export function createDraftFromData(data: HomepageData): HomepageDraft {
  return {
    content: {
      ...data.content,
      aboutParagraphs: [...data.content.aboutParagraphs],
      aboutHighlights: data.content.aboutHighlights.map((highlight) => ({
        ...highlight,
      })),
    },
    heroImages: data.heroImages.map((image) => toDraftImage(image) as DraftImage),
    bannerImage: toDraftImage(data.bannerImage),
    footerImage: toDraftImage(data.footerImage),
    qrCodeImage: toDraftImage(data.qrCodeImage),
    officers: data.officers.map((officer) => ({
      id: officer.id,
      displayName: officer.displayName,
      roleTitle: officer.roleTitle,
      bio: officer.bio,
      image: toDraftImage(officer.image),
    })),
  };
}

export function validateHomepageDraft(draft: HomepageDraft): string | null {
  const { content } = draft;

  if (!content.heroTitle.trim()) return "請填寫首頁主標題。";
  if (content.heroTitle.length > 60) return "首頁主標題最多 60 字。";
  if (content.heroSubtitle.length > 300) return "首頁副標題最多 300 字。";

  if (!content.aboutHeading.trim()) return "請填寫 About 區塊標題。";
  if (content.aboutEyebrow.length > 40) return "About 小標最多 40 字。";

  const paragraphs = content.aboutParagraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "請至少填寫一段社團介紹。";
  if (paragraphs.length > MAX_ABOUT_PARAGRAPHS) {
    return `社團介紹最多 ${MAX_ABOUT_PARAGRAPHS} 段。`;
  }

  if (content.aboutHighlights.length > MAX_ABOUT_HIGHLIGHTS) {
    return `特色項目最多 ${MAX_ABOUT_HIGHLIGHTS} 項。`;
  }
  for (const highlight of content.aboutHighlights) {
    if (!highlight.title.trim()) return "特色項目標題不可空白。";
    if (highlight.title.length > 40) return "特色項目標題最多 40 字。";
    if (highlight.description.length > 200) {
      return "特色項目說明最多 200 字。";
    }
  }

  if (!content.bannerSlogan.trim()) return "請填寫中段主標語。";
  if (content.bannerSlogan.length > 80) return "中段主標語最多 80 字。";
  if (content.bannerSubtitle.length > 200) return "中段副標語最多 200 字。";

  if (!content.footerClubName.trim()) return "請填寫 Footer 社團名稱。";
  if (content.footerClubName.length > 60) return "社團名稱最多 60 字。";
  if (content.footerDescription.length > 300) return "Footer 簡介最多 300 字。";

  if (draft.heroImages.length < MIN_HERO_IMAGES) {
    return "Hero 至少要保留 1 張圖片。";
  }
  if (draft.heroImages.length > MAX_HERO_IMAGES) {
    return `Hero 最多 ${MAX_HERO_IMAGES} 張圖片。`;
  }

  if (draft.officers.length > MAX_OFFICERS) {
    return `首頁展示幹部最多 ${MAX_OFFICERS} 位。`;
  }
  for (const officer of draft.officers) {
    if (!officer.displayName.trim()) return "幹部名稱不可空白。";
    if (!officer.roleTitle.trim()) return "幹部職位不可空白。";
    if (officer.displayName.length > 40) return "幹部名稱最多 40 字。";
    if (officer.roleTitle.length > 40) return "幹部職位最多 40 字。";
    if (officer.bio.length > 200) return "幹部說明最多 200 字。";
  }

  // 每張要儲存的圖片都必須有來源：既有路徑或這次新裁切的檔案。
  const imagesToCheck: Array<[string, DraftImage | null]> = [
    ...draft.heroImages.map(
      (image, index) => [`第 ${index + 1} 張 Hero 圖片`, image] as [string, DraftImage]
    ),
    ["中段背景圖片", draft.bannerImage],
    ["Footer 背景圖片", draft.footerImage],
    ["QR Code 圖片", draft.qrCodeImage],
    ...draft.officers.map(
      (officer, index) =>
        [`第 ${index + 1} 位幹部的照片`, officer.image] as [string, DraftImage | null]
    ),
  ];

  for (const [label, image] of imagesToCheck) {
    if (image && !image.storagePath && !image.pendingUpload) {
      return `${label}資料不完整，請重新上傳。`;
    }
  }

  return null;
}

function buildStoragePath(kind: string, extension: string) {
  return `${kind}/${crypto.randomUUID()}.${extension}`;
}

async function removeStorageFiles(paths: string[]) {
  // 本機 public 圖片不在 Storage 內，不能也不需要刪除。
  const storagePaths = paths.filter((path) => path && !isLocalAssetPath(path));
  if (storagePaths.length === 0) return null;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(HOMEPAGE_IMAGES_BUCKET)
    .remove(storagePaths);

  return error ? error.message : null;
}

async function uploadDraftImage(
  kind: string,
  image: DraftImage
): Promise<{ path: string; error: null } | { path: null; error: string }> {
  if (!image.pendingUpload) {
    if (!image.storagePath) {
      return { path: null, error: "圖片資料不完整，請重新上傳這張圖片。" };
    }
    return { path: image.storagePath, error: null };
  }

  const supabase = createClient();
  const path = buildStoragePath(kind, image.pendingUpload.extension);

  const { error } = await supabase.storage
    .from(HOMEPAGE_IMAGES_BUCKET)
    .upload(path, image.pendingUpload.blob, {
      contentType: image.pendingUpload.contentType,
      upsert: false,
    });

  if (error) {
    return { path: null, error: `圖片上傳失敗：${error.message}` };
  }

  return { path, error: null };
}

export type SaveHomepageResult = {
  error: string | null;
  warning?: string;
};

/**
 * 把資料庫端的技術性錯誤轉成可行動的訊息。
 * 最常見的原因是 docs/sql/add_homepage_management.sql 還沒執行或不是最新版。
 */
function describeSaveError(message: string) {
  const needsMigration =
    /where clause/i.test(message) ||
    /save_homepage/i.test(message) ||
    /schema cache/i.test(message) ||
    /does not exist/i.test(message) ||
    /homepage_(content|media|officers)/i.test(message);

  if (needsMigration) {
    return `儲存首頁內容失敗：${message}（請確認已在 Supabase 執行最新版的 docs/sql/add_homepage_management.sql）`;
  }

  return `儲存首頁內容失敗：${message}`;
}

/**
 * 統一儲存首頁草稿。
 *
 * 流程：先上傳所有新圖片 → 呼叫 save_homepage RPC 一次性寫入（單一交易）
 * → 成功後刪除已被移除的舊圖片；任何步驟失敗都會清掉這次剛上傳的檔案，
 * 不會留下無主的 Storage 檔案。
 */
export async function saveHomepageDraft({
  draft,
  publishedData,
}: {
  draft: HomepageDraft;
  publishedData: HomepageData;
}): Promise<SaveHomepageResult> {
  const validationError = validateHomepageDraft(draft);
  if (validationError) {
    return { error: validationError };
  }

  const uploadedPaths: string[] = [];

  const uploadFor = async (kind: string, image: DraftImage) => {
    const result = await uploadDraftImage(kind, image);
    if (result.error === null && image.pendingUpload) {
      uploadedPaths.push(result.path);
    }
    return result;
  };

  try {
    const heroPayload: Array<Record<string, unknown>> = [];
    for (const [index, image] of draft.heroImages.entries()) {
      const uploaded = await uploadFor("hero", image);
      if (uploaded.error !== null) {
        await removeStorageFiles(uploadedPaths);
        return { error: uploaded.error };
      }

      heroPayload.push({
        storage_path: uploaded.path,
        alt: image.alt.trim(),
        focal_x: image.focalX,
        focal_y: image.focalY,
        sort_order: index,
      });
    }

    const singleMediaPayload: Record<string, unknown> = {};
    const singleKinds: Array<[HomepageMediaKind, DraftImage | null]> = [
      ["banner", draft.bannerImage],
      ["footer", draft.footerImage],
      ["qr_code", draft.qrCodeImage],
    ];

    for (const [kind, image] of singleKinds) {
      if (!image) {
        singleMediaPayload[kind] = null;
        continue;
      }

      const uploaded = await uploadFor(kind, image);
      if (uploaded.error !== null) {
        await removeStorageFiles(uploadedPaths);
        return { error: uploaded.error };
      }

      singleMediaPayload[kind] = {
        storage_path: uploaded.path,
        alt: image.alt.trim(),
        focal_x: image.focalX,
        focal_y: image.focalY,
      };
    }

    const officersPayload: Array<Record<string, unknown>> = [];
    for (const [index, officer] of draft.officers.entries()) {
      let storagePath: string | null = null;

      if (officer.image) {
        const uploaded = await uploadFor("officers", officer.image);
        if (uploaded.error !== null) {
          await removeStorageFiles(uploadedPaths);
          return { error: uploaded.error };
        }
        storagePath = uploaded.path;
      }

      officersPayload.push({
        display_name: officer.displayName.trim(),
        role_title: officer.roleTitle.trim(),
        bio: officer.bio.trim(),
        storage_path: storagePath,
        focal_x: officer.image?.focalX ?? 50,
        focal_y: officer.image?.focalY ?? 50,
        sort_order: index,
      });
    }

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("save_homepage", {
      payload: {
        content: {
          hero_title: draft.content.heroTitle.trim(),
          hero_subtitle: draft.content.heroSubtitle.trim(),
          about_eyebrow: draft.content.aboutEyebrow.trim(),
          about_heading: draft.content.aboutHeading.trim(),
          about_paragraphs: draft.content.aboutParagraphs
            .map((paragraph) => paragraph.trim())
            .filter(Boolean),
          about_highlights: draft.content.aboutHighlights.map((highlight) => ({
            title: highlight.title.trim(),
            description: highlight.description.trim(),
          })),
          banner_slogan: draft.content.bannerSlogan.trim(),
          banner_subtitle: draft.content.bannerSubtitle.trim(),
          footer_club_name: draft.content.footerClubName.trim(),
          footer_description: draft.content.footerDescription.trim(),
          footer_instagram_url: normalizeInstagramUrl(
            draft.content.footerInstagramUrl
          ),
          footer_admin_contact: draft.content.footerAdminContact.trim(),
        },
        hero: heroPayload,
        ...singleMediaPayload,
        officers: officersPayload,
      },
    });

    if (rpcError) {
      const cleanupError = await removeStorageFiles(uploadedPaths);
      return {
        error: describeSaveError(rpcError.message),
        warning: cleanupError
          ? `新上傳的圖片清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
          : undefined,
      };
    }

    // 儲存成功後才清掉不再使用的舊圖片。
    const keptPaths = new Set(
      [
        ...heroPayload.map((item) => item.storage_path as string),
        ...Object.values(singleMediaPayload)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map((item) => item.storage_path as string),
        ...officersPayload
          .map((item) => item.storage_path)
          .filter((path): path is string => typeof path === "string"),
      ].filter(Boolean)
    );

    const previousPaths = [
      ...publishedData.heroImages.map((image) => image.storagePath),
      publishedData.bannerImage?.storagePath ?? null,
      publishedData.footerImage?.storagePath ?? null,
      publishedData.qrCodeImage?.storagePath ?? null,
      ...publishedData.officers.map((officer) => officer.image?.storagePath ?? null),
    ].filter((path): path is string => Boolean(path));

    const orphanPaths = previousPaths.filter((path) => !keptPaths.has(path));
    const cleanupError = await removeStorageFiles(orphanPaths);

    return {
      error: null,
      warning: cleanupError
        ? `首頁已更新，但舊圖片清除失敗（${cleanupError}），請通知維護人員檢查 Storage。`
        : undefined,
    };
  } catch (error) {
    await removeStorageFiles(uploadedPaths);
    return {
      error:
        error instanceof Error
          ? `儲存首頁內容失敗：${error.message}`
          : "儲存首頁內容失敗。",
    };
  }
}
