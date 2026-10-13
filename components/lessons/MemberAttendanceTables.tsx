"use client";

import { useState } from "react";
import { ChevronDown, Minus, Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fieldControlClasses } from "@/components/ui/FormField";
import type {
  LessonMemberAttendance,
  LessonParticipant,
  PublicMemberProfile,
} from "@/lib/types";

type MemberAttendanceTablesProps = {
  participants: LessonParticipant[];
  attendance: LessonMemberAttendance[];
  membersById: Map<string, PublicMemberProfile>;
  capacity: number;
  disabled: boolean;
  promotingUserId: string | null;
  onCheckIn: (userId: string, checked: boolean) => Promise<void>;
  onPromote: (userId: string) => Promise<void>;
};

export function MemberAttendanceTables({
  participants,
  attendance,
  membersById,
  capacity,
  disabled,
  promotingUserId,
  onCheckIn,
  onPromote,
}: MemberAttendanceTablesProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const checkedInIds = new Set(
    attendance.filter((item) => item.checked_in).map((item) => item.user_id)
  );
  const unchecked = participants.filter((item) => !checkedInIds.has(item.user_id));
  const checked = participants.filter((item) => checkedInIds.has(item.user_id));
  const query = search.trim().toLocaleLowerCase();
  const filteredUnchecked = unchecked.filter((item) =>
    (membersById.get(item.user_id)?.full_name || t("未填姓名"))
      .toLocaleLowerCase()
      .includes(query)
  );
  const confirmedCount = participants.filter((item) => item.status === "confirmed").length;
  const firstWaitlistUserId = participants.find((item) => item.status === "waitlist")?.user_id;

  return (
    <div className="min-w-0 space-y-4">
      <details className="group overflow-hidden rounded-xl border border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-appBg p-3 [&::-webkit-details-marker]:hidden">
          <h3 id="unchecked-heading" className="flex items-center gap-2 text-sm font-semibold">
            <span>未簽到</span>
            <Badge>{unchecked.length}</Badge>
          </h3>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="bg-appBg px-3 pb-3">
          <label className="relative block">
            <span className="sr-only">搜尋未簽到社員姓名</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜尋社員姓名"
              className={`${fieldControlClasses} !pl-9`}
            />
          </label>
        </div>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-t border-line bg-appBg text-xs text-text-secondary">
            <tr>
              <th className="w-14 px-2 py-2 text-center">簽到</th>
              <th className="px-2 py-2 sm:px-3">姓名</th>
              <th className="hidden w-28 px-3 py-2 sm:table-cell">程度</th>
              <th className="w-24 px-2 py-2 sm:w-40 sm:px-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {filteredUnchecked.map((participant) => {
              const member = membersById.get(participant.user_id);
              const name = member?.full_name || t("未填姓名");
              return (
                <tr key={participant.id} className="border-t border-line">
                  <td className="px-1 py-1 text-center">
                    <label className="inline-flex min-h-11 w-11 cursor-pointer items-center justify-center">
                      <span className="sr-only">{t("簽到")}：{name}</span>
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={disabled || participant.status !== "confirmed"}
                        onChange={() => void onCheckIn(participant.user_id, true)}
                        className="h-5 w-5 rounded border-line accent-primary disabled:cursor-not-allowed"
                      />
                    </label>
                  </td>
                  <td className="break-words px-2 py-3 sm:px-3">
                    <span translate="no" className="font-medium">{name}</span>
                    <div className="mt-1 sm:hidden"><SurfLevelBadge level={member?.surf_level} /></div>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell"><SurfLevelBadge level={member?.surf_level} /></td>
                  <td className="px-2 py-3 sm:px-3">
                    {participant.status === "confirmed" ? (
                      <Badge tone="success">正取</Badge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning">候補 {participant.waitlist_order ?? ""}</Badge>
                        <Button
                          variant="outline"
                          className="!px-2 !text-xs"
                          disabled={disabled || participant.user_id !== firstWaitlistUserId || confirmedCount >= capacity}
                          onClick={() => void onPromote(participant.user_id)}
                          title={confirmedCount >= capacity ? "正取名額已滿，需先釋出名額" : participant.user_id !== firstWaitlistUserId ? "必須依候補順序遞補" : "正式遞補後才能簽到"}
                        >
                          {promotingUserId === participant.user_id ? "遞補中..." : "正式遞補"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredUnchecked.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                {unchecked.length === 0 ? "目前沒有未簽到社員。" : "找不到符合姓名的社員。"}
              </td></tr>
            )}
          </tbody>
        </table>
      </details>

      <details className="group overflow-hidden rounded-xl border border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-success-light p-3 [&::-webkit-details-marker]:hidden">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span>已簽到</span><Badge tone="success">{checked.length}</Badge>
          </h3>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-t border-line bg-appBg text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">姓名</th>
              <th className="hidden w-28 px-3 py-2 sm:table-cell">程度</th>
              <th className="w-16 px-2 py-2 text-center"><span className="sr-only">撤銷簽到</span></th>
            </tr>
          </thead>
          <tbody>
            {checked.map((participant) => {
              const member = membersById.get(participant.user_id);
              const name = member?.full_name || t("未填姓名");
              return (
                <tr key={participant.id} className="border-t border-line">
                  <td className="break-words px-3 py-3">
                    <span translate="no" className="font-medium">{name}</span>
                    <div className="mt-1 sm:hidden"><SurfLevelBadge level={member?.surf_level} /></div>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell"><SurfLevelBadge level={member?.surf_level} /></td>
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-danger hover:bg-danger-light disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`${t("撤銷簽到")}：${name}`}
                      title="撤銷簽到"
                      disabled={disabled}
                      onClick={() => void onCheckIn(participant.user_id, false)}
                    >
                      <Minus size={18} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {checked.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-text-secondary">目前沒有已簽到社員。</td></tr>
            )}
          </tbody>
        </table>
      </details>
    </div>
  );
}
