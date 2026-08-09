"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImageOff,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import { DraftImageField } from "@/components/home/editor/DraftImageField";
import { MAX_OFFICERS, type HomepageDraft } from "@/lib/homepage";

type DraftOfficer = HomepageDraft["officers"][number];

export function OfficerManagerDialog({
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const officers = draft.officers;

  const patchOfficer = (index: number, patch: Partial<DraftOfficer>) => {
    onApply((current) => ({
      ...current,
      officers: current.officers.map((officer, officerIndex) =>
        officerIndex === index ? { ...officer, ...patch } : officer
      ),
    }));
  };

  const addOfficer = () => {
    if (officers.length >= MAX_OFFICERS) {
      setErrorMessage(`首頁展示幹部最多 ${MAX_OFFICERS} 位。`);
      return;
    }

    setErrorMessage("");
    onApply((current) => ({
      ...current,
      officers: [
        ...current.officers,
        { id: null, displayName: "", roleTitle: "", bio: "", image: null },
      ],
    }));
  };

  const removeOfficer = (index: number) => {
    const officer = officers[index];
    const name = officer.displayName.trim() || `第 ${index + 1} 位`;

    const confirmed = window.confirm(
      `確定要從首頁移除「${name}」嗎？\n\n這只會移除首頁上的介紹卡，不會變更任何人的系統帳號權限。按「完成編輯」後才會實際套用。`
    );
    if (!confirmed) return;

    setErrorMessage("");
    onApply((current) => ({
      ...current,
      officers: current.officers.filter(
        (_, officerIndex) => officerIndex !== index
      ),
    }));
  };

  const moveOfficer = (from: number, to: number) => {
    if (to < 0 || to >= officers.length) return;

    onApply((current) => {
      const next = [...current.officers];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, officers: next };
    });
  };

  return (
    <EditorDialogShell
      title="管理首頁幹部"
      description={`首頁展示用的幹部介紹卡（最多 ${MAX_OFFICERS} 位）`}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          完成這個區塊
        </Button>
      }
    >
      <p className="flex items-start gap-2 rounded-xl border border-info/30 bg-info-light px-3 py-2 text-xs leading-5 text-slate-700">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-info" />
        <span>
          這裡只管理首頁上的幹部介紹卡，與系統帳號權限完全分開。新增或移除都不會變更任何人的角色；帳號權限請到「社員名單」調整。
        </span>
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger"
        >
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          展示幹部（{officers.length}/{MAX_OFFICERS}）
        </p>
        <Button
          variant="outline"
          className="!min-h-9 !text-xs"
          icon={<Plus size={14} />}
          onClick={addOfficer}
          disabled={officers.length >= MAX_OFFICERS}
        >
          {officers.length >= MAX_OFFICERS ? "已達上限" : "新增展示幹部"}
        </Button>
      </div>

      {officers.length === 0 ? (
        <p className="mt-3 rounded-xl border border-border bg-bg px-3 py-6 text-center text-sm text-slate-500">
          目前沒有展示幹部，按「新增展示幹部」加入第一位。
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            可以拖曳卡片調整順序，手機請使用上下箭頭。
          </p>

          <ul className="mt-3 flex flex-col gap-4">
            {officers.map((officer, index) => (
              <li
                key={`${officer.id ?? "new"}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    moveOfficer(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`rounded-xl border p-3 transition-colors ${
                  dragIndex === index
                    ? "border-primary bg-primary-light/40"
                    : "border-border bg-bg"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 hidden cursor-grab text-slate-400 sm:block"
                  >
                    <GripVertical size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="職位">
                        <input
                          type="text"
                          value={officer.roleTitle}
                          maxLength={40}
                          onChange={(event) =>
                            patchOfficer(index, {
                              roleTitle: event.target.value,
                            })
                          }
                          placeholder="例如：社長"
                          className={fieldControlClasses}
                        />
                      </FormField>

                      <FormField label="名稱">
                        <input
                          type="text"
                          value={officer.displayName}
                          maxLength={40}
                          onChange={(event) =>
                            patchOfficer(index, {
                              displayName: event.target.value,
                            })
                          }
                          placeholder="例如：王小明"
                          className={fieldControlClasses}
                        />
                      </FormField>
                    </div>

                    <FormField label="說明" className="mt-3">
                      <textarea
                        value={officer.bio}
                        maxLength={200}
                        onChange={(event) =>
                          patchOfficer(index, { bio: event.target.value })
                        }
                        placeholder="例如：負責社團整體運作與活動規劃。"
                        className={`min-h-16 ${fieldControlClasses}`}
                      />
                    </FormField>

                    <div className="mt-3">
                      <DraftImageField
                        label="幹部照片"
                        hint="4:5 直向照片效果最好，會輸出 1000×1250 的 WebP。"
                        image={officer.image}
                        kind="officer"
                        previewClassName="h-28 w-[90px]"
                        allowRemove
                        showAltField={false}
                        onChange={(image) => patchOfficer(index, { image })}
                        onError={setErrorMessage}
                        onTrackObjectUrl={onTrackObjectUrl}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`把第 ${index + 1} 位往前移`}
                        title="往前移"
                        onClick={() => moveOfficer(index, index - 1)}
                        disabled={index === 0}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`把第 ${index + 1} 位往後移`}
                        title="往後移"
                        onClick={() => moveOfficer(index, index + 1)}
                        disabled={index === officers.length - 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <Button
                        variant="danger"
                        className="!min-h-9 !text-xs"
                        icon={<Trash2 size={13} />}
                        onClick={() => removeOfficer(index)}
                      >
                        從首頁移除
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {officers.some((officer) => !officer.image) && (
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ImageOff size={14} className="mt-0.5 shrink-0" />
          <span>沒有上傳照片的幹部，首頁會顯示「照片待補」的佔位方塊。</span>
        </p>
      )}
    </EditorDialogShell>
  );
}
