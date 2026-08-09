"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { EditorDialogShell } from "@/components/home/editor/EditorDialogShell";
import {
  MAX_ABOUT_HIGHLIGHTS,
  MAX_ABOUT_PARAGRAPHS,
  type HomepageDraft,
} from "@/lib/homepage";

export function AboutEditDialog({
  draft,
  onClose,
  onApply,
}: {
  draft: HomepageDraft;
  onClose: () => void;
  onApply: (updater: (current: HomepageDraft) => HomepageDraft) => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");

  const { aboutEyebrow, aboutHeading, aboutParagraphs, aboutHighlights } =
    draft.content;

  const patchContent = (patch: Partial<HomepageDraft["content"]>) => {
    onApply((current) => ({
      ...current,
      content: { ...current.content, ...patch },
    }));
  };

  const updateParagraph = (index: number, value: string) => {
    patchContent({
      aboutParagraphs: aboutParagraphs.map((paragraph, paragraphIndex) =>
        paragraphIndex === index ? value : paragraph
      ),
    });
  };

  const addParagraph = () => {
    if (aboutParagraphs.length >= MAX_ABOUT_PARAGRAPHS) {
      setErrorMessage(`介紹段落最多 ${MAX_ABOUT_PARAGRAPHS} 段。`);
      return;
    }
    setErrorMessage("");
    patchContent({ aboutParagraphs: [...aboutParagraphs, ""] });
  };

  const removeParagraph = (index: number) => {
    if (aboutParagraphs.length <= 1) {
      setErrorMessage("請至少保留一段社團介紹。");
      return;
    }
    setErrorMessage("");
    patchContent({
      aboutParagraphs: aboutParagraphs.filter(
        (_, paragraphIndex) => paragraphIndex !== index
      ),
    });
  };

  const updateHighlight = (
    index: number,
    patch: Partial<{ title: string; description: string }>
  ) => {
    patchContent({
      aboutHighlights: aboutHighlights.map((highlight, highlightIndex) =>
        highlightIndex === index ? { ...highlight, ...patch } : highlight
      ),
    });
  };

  const addHighlight = () => {
    if (aboutHighlights.length >= MAX_ABOUT_HIGHLIGHTS) {
      setErrorMessage(`特色項目最多 ${MAX_ABOUT_HIGHLIGHTS} 項。`);
      return;
    }
    setErrorMessage("");
    patchContent({
      aboutHighlights: [...aboutHighlights, { title: "", description: "" }],
    });
  };

  const removeHighlight = (index: number) => {
    setErrorMessage("");
    patchContent({
      aboutHighlights: aboutHighlights.filter(
        (_, highlightIndex) => highlightIndex !== index
      ),
    });
  };

  const moveHighlight = (from: number, to: number) => {
    if (to < 0 || to >= aboutHighlights.length) return;

    const next = [...aboutHighlights];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    patchContent({ aboutHighlights: next });
  };

  return (
    <EditorDialogShell
      title="編輯 About 區塊"
      description="小標、標題、左側介紹段落與右側特色項目"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="ABOUT 小標" hint="顯示在標題上方的英文小字">
          <input
            type="text"
            value={aboutEyebrow}
            maxLength={40}
            onChange={(event) =>
              patchContent({ aboutEyebrow: event.target.value })
            }
            className={fieldControlClasses}
          />
        </FormField>

        <FormField label="區塊標題">
          <input
            type="text"
            value={aboutHeading}
            maxLength={80}
            onChange={(event) =>
              patchContent({ aboutHeading: event.target.value })
            }
            className={fieldControlClasses}
          />
        </FormField>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            左側介紹段落（{aboutParagraphs.length}/{MAX_ABOUT_PARAGRAPHS}）
          </p>
          <Button
            variant="outline"
            className="!min-h-9 !text-xs"
            icon={<Plus size={14} />}
            onClick={addParagraph}
            disabled={aboutParagraphs.length >= MAX_ABOUT_PARAGRAPHS}
          >
            新增段落
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {aboutParagraphs.map((paragraph, index) => (
            <div key={index} className="flex items-start gap-2">
              <textarea
                value={paragraph}
                maxLength={600}
                onChange={(event) => updateParagraph(index, event.target.value)}
                placeholder={`第 ${index + 1} 段介紹`}
                className={`min-h-24 ${fieldControlClasses}`}
              />
              <button
                type="button"
                aria-label={`刪除第 ${index + 1} 段`}
                title="刪除段落"
                onClick={() => removeParagraph(index)}
                disabled={aboutParagraphs.length <= 1}
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            右側特色項目（{aboutHighlights.length}/{MAX_ABOUT_HIGHLIGHTS}）
          </p>
          <Button
            variant="outline"
            className="!min-h-9 !text-xs"
            icon={<Plus size={14} />}
            onClick={addHighlight}
            disabled={aboutHighlights.length >= MAX_ABOUT_HIGHLIGHTS}
          >
            新增項目
          </Button>
        </div>

        {aboutHighlights.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-bg px-3 py-4 text-center text-sm text-slate-500">
            目前沒有特色項目，可以按「新增項目」加入。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {aboutHighlights.map((highlight, index) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-bg p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <FormField label={`項目 ${index + 1} 標題`}>
                    <input
                      type="text"
                      value={highlight.title}
                      maxLength={40}
                      onChange={(event) =>
                        updateHighlight(index, { title: event.target.value })
                      }
                      className={fieldControlClasses}
                    />
                  </FormField>
                  <FormField label="說明">
                    <textarea
                      value={highlight.description}
                      maxLength={200}
                      onChange={(event) =>
                        updateHighlight(index, {
                          description: event.target.value,
                        })
                      }
                      className={`min-h-16 ${fieldControlClasses}`}
                    />
                  </FormField>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`把項目 ${index + 1} 往上移`}
                    title="往上移"
                    onClick={() => moveHighlight(index, index - 1)}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`把項目 ${index + 1} 往下移`}
                    title="往下移"
                    onClick={() => moveHighlight(index, index + 1)}
                    disabled={index === aboutHighlights.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-500 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <Button
                    variant="danger"
                    className="!min-h-9 !text-xs"
                    icon={<Trash2 size={13} />}
                    onClick={() => removeHighlight(index)}
                  >
                    移除項目
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EditorDialogShell>
  );
}
