"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDraftFromData,
  fetchHomepageData,
  getFallbackHomepageData,
  saveHomepageDraft,
  type HomepageData,
  type HomepageDraft,
} from "@/lib/homepage";

export type HomepageEditorStatus = {
  tone: "success" | "danger" | "warning";
  text: string;
} | null;

/**
 * 首頁內容的讀取與編輯狀態。
 *
 * - 初始值使用本機 fallback，SQL 還沒執行時首頁也不會白屏。
 * - 編輯模式的所有修改只存在 draft，按「完成編輯」才一次寫入資料庫。
 * - 有未儲存變更時，關閉分頁或重新整理會顯示離開確認。
 */
export function useHomepageEditor(canManage: boolean) {
  const [data, setData] = useState<HomepageData>(() =>
    getFallbackHomepageData()
  );
  const [draft, setDraft] = useState<HomepageDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<HomepageEditorStatus>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchHomepageData();
    setIsLoading(false);
    setData(result.data);
    return result;
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  const isEditing = draft !== null;

  const isDirty = useMemo(() => {
    if (!draft) return false;
    return (
      JSON.stringify(serializeDraft(draft)) !==
      JSON.stringify(serializeDraft(createDraftFromData(data)))
    );
  }, [data, draft]);

  // 有未儲存變更時提醒使用者不要直接離開。
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // 攔截站內連結點擊，避免帶著未儲存變更切換路由。
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (href === window.location.pathname) return;

      const confirmed = window.confirm(
        "首頁還有尚未儲存的編輯內容，離開後會遺失。確定要離開嗎？"
      );
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty]);

  const trackObjectUrl = useCallback((url: string) => {
    objectUrlsRef.current.push(url);
  }, []);

  const releaseObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => releaseObjectUrls, [releaseObjectUrls]);

  const startEditing = useCallback(() => {
    if (!canManage) return;
    setStatus(null);
    setDraft(createDraftFromData(data));
  }, [canManage, data]);

  const cancelEditing = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        "取消後會捨棄這次所有尚未儲存的編輯內容，確定要取消嗎？"
      );
      if (!confirmed) return;
    }

    // 捨棄草稿與所有暫存的預覽圖，回到已發布內容。
    releaseObjectUrls();
    setDraft(null);
    setStatus(null);
  }, [isDirty, releaseObjectUrls]);

  const updateDraft = useCallback(
    (updater: (current: HomepageDraft) => HomepageDraft) => {
      setDraft((current) => (current ? updater(current) : current));
    },
    []
  );

  const saveDraft = useCallback(async () => {
    if (!draft || isSaving) return;

    setIsSaving(true);
    setStatus(null);

    const result = await saveHomepageDraft({
      draft,
      publishedData: data,
    });

    if (result.error) {
      // 失敗時保留草稿，讓使用者可以修正後再儲存。
      setIsSaving(false);
      setStatus({
        tone: "danger",
        text: result.warning
          ? `${result.error}（${result.warning}）`
          : result.error,
      });
      return;
    }

    const reloaded = await loadData();
    releaseObjectUrls();
    setDraft(null);
    setIsSaving(false);

    if (reloaded.error) {
      setStatus({
        tone: "warning",
        text: `首頁已更新，但重新讀取內容時發生問題：${reloaded.error}`,
      });
      return;
    }

    setStatus({
      tone: result.warning ? "warning" : "success",
      text: result.warning ?? "首頁內容已更新。",
    });
  }, [data, draft, isSaving, loadData, releaseObjectUrls]);

  return {
    data,
    draft,
    isEditing,
    isDirty,
    isLoading,
    isSaving,
    status,
    setStatus,
    startEditing,
    cancelEditing,
    updateDraft,
    saveDraft,
    trackObjectUrl,
  };
}

/** 只比較會被儲存的欄位，避免預覽網址等暫時值造成誤判。 */
function serializeDraft(draft: HomepageDraft) {
  return {
    content: draft.content,
    hero: draft.heroImages.map((image) => ({
      storagePath: image.storagePath,
      alt: image.alt,
      focalX: image.focalX,
      focalY: image.focalY,
      isNew: Boolean(image.pendingUpload),
    })),
    banner: draft.bannerImage && {
      storagePath: draft.bannerImage.storagePath,
      alt: draft.bannerImage.alt,
      focalX: draft.bannerImage.focalX,
      focalY: draft.bannerImage.focalY,
      isNew: Boolean(draft.bannerImage.pendingUpload),
    },
    footer: draft.footerImage && {
      storagePath: draft.footerImage.storagePath,
      alt: draft.footerImage.alt,
      focalX: draft.footerImage.focalX,
      focalY: draft.footerImage.focalY,
      isNew: Boolean(draft.footerImage.pendingUpload),
    },
    qrCode: draft.qrCodeImage && {
      storagePath: draft.qrCodeImage.storagePath,
      alt: draft.qrCodeImage.alt,
      isNew: Boolean(draft.qrCodeImage.pendingUpload),
    },
    officers: draft.officers.map((officer) => ({
      displayName: officer.displayName,
      roleTitle: officer.roleTitle,
      bio: officer.bio,
      storagePath: officer.image?.storagePath ?? null,
      focalX: officer.image?.focalX ?? 50,
      focalY: officer.image?.focalY ?? 50,
      isNew: Boolean(officer.image?.pendingUpload),
    })),
  };
}
