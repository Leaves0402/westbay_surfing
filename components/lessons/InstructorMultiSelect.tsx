"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { fieldControlClasses } from "@/components/ui/FormField";
import { roleLabels, type PublicMemberProfile, type Role } from "@/lib/types";

function formatInstructorOption(member: PublicMemberProfile) {
  return `${roleLabels[member.role]}（${member.full_name || "未填姓名"}）`;
}

function sortInstructors(members: PublicMemberProfile[]) {
  const roleOrder: Record<Role, number> = {
    admin: 0,
    officer: 1,
    board_manager: 2,
    member: 3,
    pending: 4,
  };

  return [...members].sort((a, b) => {
    const roleCompare = roleOrder[a.role] - roleOrder[b.role];
    if (roleCompare !== 0) return roleCompare;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "", "zh-Hant");
  });
}

type InstructorMultiSelectProps = {
  instructors: PublicMemberProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function InstructorMultiSelect({
  instructors,
  selectedIds,
  onChange,
  disabled = false,
}: InstructorMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const sortedInstructors = useMemo(
    () => sortInstructors(instructors),
    [instructors]
  );
  const selectedInstructors = useMemo(
    () =>
      selectedIds
        .map((id) => sortedInstructors.find((item) => item.id === id))
        .filter((item): item is PublicMemberProfile => Boolean(item)),
    [selectedIds, sortedInstructors]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const toggleInstructor = (instructorId: string) => {
    if (disabled) return;
    if (selectedIds.includes(instructorId)) {
      onChange(selectedIds.filter((id) => id !== instructorId));
      return;
    }
    onChange([...selectedIds, instructorId]);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {selectedInstructors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedInstructors.map((instructor) => (
            <span
              key={instructor.id}
              translate="no"
              className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary"
            >
              {formatInstructorOption(instructor)}
              <button
                type="button"
                aria-label={`移除 ${formatInstructorOption(instructor)}`}
                className="rounded-full p-0.5 hover:bg-primary/15 disabled:opacity-40"
                onClick={() => toggleInstructor(instructor.id)}
                disabled={disabled}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={`${fieldControlClasses} flex items-center justify-between text-left`}
        >
          <span
            className={
              selectedInstructors.length > 0
                ? "truncate text-slate-900"
                : "text-slate-400"
            }
          >
            {selectedInstructors.length > 0
              ? `已選 ${selectedInstructors.length} 位教學`
              : "選擇教學"}
          </span>
          <ChevronDown size={16} className="shrink-0 text-text-secondary" />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface shadow-sm">
            {sortedInstructors.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-secondary">
                目前沒有可選教學。
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {sortedInstructors.map((instructor) => {
                  const checked = selectedIds.includes(instructor.id);
                  return (
                    <li key={instructor.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-appBg">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInstructor(instructor.id)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary"
                        />
                        <span translate="no" className="text-text-primary">
                          {formatInstructorOption(instructor)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
