"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import { DraftImageField } from "@/components/home/editor/DraftImageField";
import { normalizeInstagramUrl, type HomepageDraft } from "@/lib/homepage";

export function FooterEditDialog({
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

  const patchContent = (patch: Partial<HomepageDraft["content"]>) => {
    onApply((current) => ({
      ...current,
      content: { ...current.content, ...patch },
    }));
  };

  const instagramPreview = normalizeInstagramUrl(
    draft.content.footerInstagramUrl
  );

  return (
    <EditorDialogShell
      title="編輯 Footer"
      description="社團名稱、簡介、Instagram、聯絡網站管理員、QR Code 與背景圖"
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
        <FormField label="社團名稱">
          <input
            type="text"
            value={draft.content.footerClubName}
            maxLength={60}
            onChange={(event) =>
              patchContent({ footerClubName: event.target.value })
            }
            className={fieldControlClasses}
          />
        </FormField>

        <FormField label="簡介">
          <textarea
            value={draft.content.footerDescription}
            maxLength={300}
            onChange={(event) =>
              patchContent({ footerDescription: event.target.value })
            }
            className={`min-h-20 ${fieldControlClasses}`}
          />
        </FormField>

        <FormField
          label="Instagram"
          hint={
            instagramPreview
              ? `會顯示為連結：${instagramPreview}`
              : "可以輸入帳號（例如 westbay.surf）或完整網址；留空就不顯示。"
          }
        >
          <input
            type="text"
            value={draft.content.footerInstagramUrl}
            maxLength={200}
            onChange={(event) =>
              patchContent({ footerInstagramUrl: event.target.value })
            }
            placeholder="westbay.surf 或 https://www.instagram.com/westbay.surf"
            className={fieldControlClasses}
          />
        </FormField>

        <FormField
          label="聯絡網站管理員"
          hint="可以填 Email 或表單網址；留空就不顯示。"
        >
          <input
            type="text"
            value={draft.content.footerAdminContact}
            maxLength={200}
            onChange={(event) =>
              patchContent({ footerAdminContact: event.target.value })
            }
            placeholder="例如 admin@example.com"
            className={fieldControlClasses}
          />
        </FormField>
      </div>

      <div className="mt-6 grid gap-6 border-t border-border pt-4 sm:grid-cols-2">
        <DraftImageField
          label="QR Code 圖片"
          hint="正方形圖片，會輸出 800×800 的 WebP；沒有設定時 Footer 不會顯示 QR Code 區塊。"
          image={draft.qrCodeImage}
          kind="qrCode"
          previewClassName="h-28 w-28"
          allowRemove
          showAltField={false}
          onChange={(image) =>
            onApply((current) => ({ ...current, qrCodeImage: image }))
          }
          onError={setErrorMessage}
          onTrackObjectUrl={onTrackObjectUrl}
        />

        <DraftImageField
          label="Footer 背景圖片"
          hint="深色橫向照片效果最好，會輸出 2400×1200 的 WebP。"
          image={draft.footerImage}
          kind="footer"
          previewClassName="h-24 w-44"
          onChange={(image) =>
            onApply((current) => ({ ...current, footerImage: image }))
          }
          onError={setErrorMessage}
          onTrackObjectUrl={onTrackObjectUrl}
        />
      </div>
    </EditorDialogShell>
  );
}
