"use client";

import { Check, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** 編輯模式的固定操作列：完成編輯 / 取消。 */
export function HomepageEditToolbar({
  isSaving,
  isDirty,
  onSave,
  onCancel,
}: {
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-[55] border-b border-primary/30 bg-primary-light/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-xs leading-5 text-primary sm:text-sm">
          <Info size={15} className="mt-0.5 shrink-0" strokeWidth={2} />
          <span>
            編輯模式：點各區塊的編輯按鈕修改內容
            {isDirty ? "．有尚未儲存的變更" : "．目前沒有變更"}
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="!min-h-9 !text-xs"
            icon={<X size={14} />}
            onClick={onCancel}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            variant="primary"
            className="!min-h-9 !text-xs"
            icon={
              isSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )
            }
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "儲存中..." : "完成編輯"}
          </Button>
        </div>
      </div>
    </div>
  );
}
