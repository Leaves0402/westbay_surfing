"use client";

import { useState } from "react";
import { ClipboardList, Pencil, RefreshCw } from "lucide-react";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { MAX_RENTAL_RULES_LENGTH, saveRentalRules } from "@/lib/rentalRules";
import { useRentalRules } from "@/lib/useRentalRules";

type RulesState = ReturnType<typeof useRentalRules>;

function RulesContent({ rules }: { rules: RulesState }) {
  if (rules.isLoading) {
    return <p role="status" className="text-sm text-slate-500">正在讀取租板規定...</p>;
  }
  if (rules.hasError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-danger">無法讀取租板規定，請重試。</p>
        <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => void rules.reload()}>重新讀取</Button>
      </div>
    );
  }
  return rules.content.trim() ? (
    <p translate="no" className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{rules.content}</p>
  ) : (
    <p className="text-sm leading-6 text-slate-500">租板規定尚未公布</p>
  );
}

export function RentalRulesSection({ rules, canEdit }: { rules: RulesState; canEdit: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!canEdit || isSaving || !draft.trim() || draft.length > MAX_RENTAL_RULES_LENGTH) return;
    setIsSaving(true);
    setError("");
    try {
      rules.setContent(await saveRentalRules(draft));
      setIsEditing(false);
      setSaved(true);
    } catch {
      setError("儲存租板規定失敗，請確認權限後重試。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ClipboardList size={18} className="text-primary" />租板規定</h2>
          {canEdit && (
            <Button variant="outline" icon={<Pencil size={16} />} disabled={rules.isLoading || rules.hasError} onClick={() => {
              setDraft(rules.content);
              setError("");
              setSaved(false);
              setIsEditing(true);
            }}>編輯租板規定</Button>
          )}
        </div>
        <RulesContent rules={rules} />
        {saved && <p role="status" className="mt-3 text-sm text-success">租板規定已儲存。</p>}
      </Card>
      {canEdit && isEditing && (
        <EditorDialogShell title="編輯租板規定" isBusy={isSaving} onClose={() => setIsEditing(false)} footer={<>
          <Button variant="outline" disabled={isSaving} onClick={() => setIsEditing(false)}>取消</Button>
          <Button disabled={isSaving || !draft.trim() || draft.length > MAX_RENTAL_RULES_LENGTH} onClick={() => void save()}>{isSaving ? "儲存中..." : "儲存"}</Button>
        </>}>
          <FormField label="租板規定內容">
            <textarea rows={12} value={draft} maxLength={MAX_RENTAL_RULES_LENGTH} disabled={isSaving} onChange={(event) => setDraft(event.target.value)} className={`${fieldControlClasses} resize-y`} />
          </FormField>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </EditorDialogShell>
      )}
    </>
  );
}

export function RentalRulesDialog({ onClose, onContinue, onLoaded }: {
  onClose: () => void;
  onContinue: () => void;
  onLoaded: (content: string) => void;
}) {
  // Read the published rules again for each registration attempt.
  const rules = useRentalRules();
  const [accepted, setAccepted] = useState(false);
  const canContinue = !rules.isLoading && !rules.hasError && Boolean(rules.content.trim()) && accepted;

  return (
    <EditorDialogShell title="租板規定" description="請閱讀租板規定，勾選確認後繼續報名。" onClose={onClose} footer={<div className="w-full space-y-4">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
        <input type="checkbox" checked={accepted} disabled={rules.isLoading || rules.hasError || !rules.content.trim()} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
        <span>我已閱讀並知悉租板規定</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button disabled={!canContinue} onClick={() => {
          if (!canContinue) return;
          onLoaded(rules.content);
          onContinue();
        }}>繼續報名</Button>
      </div>
    </div>}>
      <RulesContent rules={rules} />
    </EditorDialogShell>
  );
}
