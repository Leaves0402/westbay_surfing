"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import { DraftImageField } from "@/components/home/editor/DraftImageField";
import type { HomepageDraft } from "@/lib/homepage";

export function BannerEditDialog({
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
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <EditorDialogShell
      title="編輯中段背景區塊"
      description="背景圖片、主標語與副標語"
      onClose={onClose}
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

      <DraftImageField
        label="背景圖片"
        hint="建議使用橫向照片，會輸出 2400×1200 的 WebP。"
        image={draft.bannerImage}
        kind="banner"
        previewClassName="h-24 w-48"
        onChange={(image) =>
          onApply((current) => ({ ...current, bannerImage: image }))
        }
        onError={setErrorMessage}
        onTrackObjectUrl={onTrackObjectUrl}
      />

      <div className="mt-6 grid gap-4 border-t border-border pt-4">
        <FormField label="主標語">
          <input
            type="text"
            value={draft.content.bannerSlogan}
            maxLength={80}
            onChange={(event) =>
              onApply((current) => ({
                ...current,
                content: {
                  ...current.content,
                  bannerSlogan: event.target.value,
                },
              }))
            }
            className={fieldControlClasses}
          />
        </FormField>

        <FormField label="副標語">
          <textarea
            value={draft.content.bannerSubtitle}
            maxLength={200}
            onChange={(event) =>
              onApply((current) => ({
                ...current,
                content: {
                  ...current.content,
                  bannerSubtitle: event.target.value,
                },
              }))
            }
            className={`min-h-20 ${fieldControlClasses}`}
          />
        </FormField>
      </div>
    </EditorDialogShell>
  );
}
