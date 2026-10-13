"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  Info,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { MemberAttendanceTables } from "@/components/lessons/MemberAttendanceTables";
import { useLanguage } from "@/components/LanguageProvider";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { Card } from "@/components/ui/Card";
import { fieldControlClasses } from "@/components/ui/FormField";
import {
  compareSurfLevelsDescending,
  canViewAttendancePage,
} from "@/lib/permissions";
import { formatLessonLabel, hasLessonStarted } from "@/lib/lessonTime";
import { buildAttendanceCsv } from "@/lib/attendanceCsv";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import type {
  Lesson,
  LessonAttendanceOverview,
  LessonInstructor,
  LessonInstructorAttendance,
  LessonMemberAttendance,
  LessonParticipant,
  PublicMemberProfile,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function AttendancePage() {
  const { locale } = useLanguage();
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const canView = canViewAttendancePage(profile);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [members, setMembers] = useState<PublicMemberProfile[]>([]);
  const [instructors, setInstructors] = useState<LessonInstructor[]>([]);
  const [participants, setParticipants] = useState<LessonParticipant[]>([]);
  const [allInstructorAttendance, setAllInstructorAttendance] = useState<
    LessonInstructorAttendance[]
  >([]);
  const [allMemberAttendance, setAllMemberAttendance] = useState<
    LessonMemberAttendance[]
  >([]);
  const [attendanceOverview, setAttendanceOverview] = useState<
    Record<
      string,
      { attendanceCount: number; teachingCount: number }
    >
  >({});
  const [startedLessonCount, setStartedLessonCount] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isCheckingInAll, setIsCheckingInAll] = useState(false);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);
  const [statsSearch, setStatsSearch] = useState("");
  const attendanceBusy = isLoadingData || savingKey !== null || isCheckingInAll || promotingUserId !== null;

  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const canOperateAttendance = canView;

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setStatusMessage("");
    const supabase = createClient();
    const lessonWindowStart = getTaipeiDate(-365);
    const lessonWindowEnd = getTaipeiDate(90);

    const [lessonsResult, membersResult, overviewResult] = await Promise.all([
      supabase
        .from("lessons")
        .select(
          "id, lesson_date, start_time, end_time, capacity, waitlist_capacity, note, created_by, created_at, updated_at"
        )
        .gte("lesson_date", lessonWindowStart)
        .lte("lesson_date", lessonWindowEnd)
        .order("lesson_date", { ascending: false })
        .order("start_time", { ascending: false }),
      supabase
        .from("public_member_profiles")
        .select("id, full_name, student_id, surf_level, role"),
      supabase.rpc("get_lesson_attendance_overview"),
    ]);

    if (lessonsResult.error) {
      setIsLoadingData(false);
      setStatusMessage(`讀取社課失敗：${lessonsResult.error.message}`);
      return;
    }
    if (membersResult.error) {
      setIsLoadingData(false);
      setStatusMessage(`讀取社員資料失敗：${membersResult.error.message}`);
      return;
    }
    if (overviewResult.error) {
      setIsLoadingData(false);
      setStatusMessage(`讀取出席統計失敗：${overviewResult.error.message}`);
      return;
    }

    const loadedLessons = (lessonsResult.data ?? []) as Lesson[];
    const lessonIds = loadedLessons.map((lesson) => lesson.id);
    const emptyResult = { data: [], error: null };

    const [
      instructorsResult,
      participantsResult,
      instructorAttendanceResult,
      memberAttendanceResult,
    ] = lessonIds.length
      ? await Promise.all([
          supabase
            .from("lesson_instructors")
            .select("lesson_id, instructor_id")
            .in("lesson_id", lessonIds),
          supabase
            .from("lesson_participants")
            .select(
              "id, lesson_id, user_id, status, waitlist_order, created_at, updated_at"
            )
            .in("lesson_id", lessonIds),
          supabase
            .from("lesson_instructor_attendance")
            .select(
              "id, lesson_id, instructor_id, checked_in, checked_in_by, checked_in_at"
            )
            .in("lesson_id", lessonIds),
          supabase
            .from("lesson_member_attendance")
            .select(
              "id, lesson_id, user_id, checked_in, checked_in_by, checked_in_at"
            )
            .in("lesson_id", lessonIds),
        ])
      : [emptyResult, emptyResult, emptyResult, emptyResult];

    setIsLoadingData(false);

    if (instructorsResult.error) {
      setStatusMessage(`讀取教學名單失敗：${instructorsResult.error.message}`);
      return;
    }
    if (participantsResult.error) {
      setStatusMessage(`讀取參加名單失敗：${participantsResult.error.message}`);
      return;
    }
    if (instructorAttendanceResult.error) {
      setStatusMessage(
        `讀取教學簽到失敗：${instructorAttendanceResult.error.message}`
      );
      return;
    }
    if (memberAttendanceResult.error) {
      setStatusMessage(`讀取社員簽到失敗：${memberAttendanceResult.error.message}`);
      return;
    }

    const overviewRows = (overviewResult.data ??
      []) as LessonAttendanceOverview[];
    setLessons(loadedLessons);
    setMembers((membersResult.data ?? []) as PublicMemberProfile[]);
    setInstructors((instructorsResult.data ?? []) as LessonInstructor[]);
    setParticipants((participantsResult.data ?? []) as LessonParticipant[]);
    setAllInstructorAttendance(
      (instructorAttendanceResult.data ?? []) as LessonInstructorAttendance[]
    );
    setAllMemberAttendance(
      (memberAttendanceResult.data ?? []) as LessonMemberAttendance[]
    );
    setAttendanceOverview(
      Object.fromEntries(
        overviewRows.map((row) => [
          row.user_id,
          {
            attendanceCount: Number(row.attendance_count),
            teachingCount: Number(row.teaching_count),
          },
        ])
      )
    );
    setStartedLessonCount(
      overviewRows.length > 0
        ? Number(overviewRows[0].started_lesson_count)
        : 0
    );

    setSelectedLessonId((current) => {
      if (current && loadedLessons.some((lesson) => lesson.id === current)) {
        return current;
      }
      const upcoming = loadedLessons
        .filter(
          (lesson) => !hasLessonStarted(lesson.lesson_date, lesson.start_time)
        )
        .sort((a, b) => {
          const dateCompare = a.lesson_date.localeCompare(b.lesson_date);
          return dateCompare !== 0
            ? dateCompare
            : a.start_time.localeCompare(b.start_time);
        })[0];
      return upcoming?.id ?? loadedLessons[0]?.id ?? "";
    });
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadData());
  }, [canView, loadData]);

  const instructorAttendance = useMemo(
    () =>
      selectedLessonId
        ? allInstructorAttendance.filter(
            (item) => item.lesson_id === selectedLessonId
          )
        : [],
    [allInstructorAttendance, selectedLessonId]
  );

  const memberAttendance = useMemo(
    () =>
      selectedLessonId
        ? allMemberAttendance.filter(
            (item) => item.lesson_id === selectedLessonId
          )
        : [],
    [allMemberAttendance, selectedLessonId]
  );

  const lessonInstructors = useMemo(
    () =>
      instructors
        .filter((item) => item.lesson_id === selectedLessonId)
        .map((item) => membersById.get(item.instructor_id))
        .filter((member): member is PublicMemberProfile => Boolean(member)),
    [instructors, membersById, selectedLessonId]
  );

  const lessonParticipants = useMemo(
    () =>
      participants
        .filter((item) => item.lesson_id === selectedLessonId)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "confirmed" ? -1 : 1;
          return (a.waitlist_order ?? 0) - (b.waitlist_order ?? 0);
        }),
    [participants, selectedLessonId]
  );

  const instructorStats = useMemo(() => {
    return members
      .filter((member) => member.role === "officer" || member.role === "admin")
      .map((member) => ({
        member,
        teachingCount: attendanceOverview[member.id]?.teachingCount ?? 0,
        total: startedLessonCount,
      }))
      .sort((a, b) => {
        if (b.teachingCount !== a.teachingCount) {
          return b.teachingCount - a.teachingCount;
        }
        const levelCompare = compareSurfLevelsDescending(
          a.member.surf_level,
          b.member.surf_level
        );
        if (levelCompare !== 0) return levelCompare;
        return (a.member.full_name ?? "").localeCompare(
          b.member.full_name ?? "",
          "zh-Hant"
        );
      });
  }, [attendanceOverview, members, startedLessonCount]);

  const memberStats = useMemo(() => {
    return members
      .map((member) => ({
        member,
        count: attendanceOverview[member.id]?.attendanceCount ?? 0,
        total: startedLessonCount,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const levelCompare = compareSurfLevelsDescending(
          a.member.surf_level,
          b.member.surf_level
        );
        if (levelCompare !== 0) return levelCompare;
        return (a.member.full_name ?? "").localeCompare(
          b.member.full_name ?? "",
          "zh-Hant"
        );
      });
  }, [attendanceOverview, members, startedLessonCount]);

  const filteredMemberStats = memberStats.filter(({ member }) =>
    (member.full_name ?? "").toLocaleLowerCase().includes(statsSearch.trim().toLocaleLowerCase())
  );

  const handleExportAttendance = () => {
    const blob = new Blob([buildAttendanceCsv(filteredMemberStats)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `西灣衝浪社社員出席統計-${getTaipeiDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleInstructorAttendance = async (
    instructorId: string,
    checked: boolean
  ) => {
    if (!selectedLessonId || !canOperateAttendance || attendanceBusy) return;
    setSavingKey(`instructor-${instructorId}`);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_lesson_instructor_attendance", {
      target_lesson_id: selectedLessonId,
      target_instructor_id: instructorId,
      target_checked_in: checked,
    });
    if (error) {
      setSavingKey(null);
      setStatusMessage(`更新教學簽到失敗：${error.message}`);
      return;
    }
    await loadData();
    setSavingKey(null);
  };

  const toggleMemberAttendance = async (userId: string, checked: boolean) => {
    if (!selectedLessonId || !canOperateAttendance || attendanceBusy) return;
    const participant = lessonParticipants.find(
      (item) => item.user_id === userId
    );
    if (participant?.status !== "confirmed") {
      setStatusMessage("候補社員必須先正式遞補，才能簽到。");
      return;
    }
    setSavingKey(`member-${userId}`);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_lesson_member_attendance", {
      target_lesson_id: selectedLessonId,
      target_user_id: userId,
      target_checked_in: checked,
    });
    if (error) {
      setSavingKey(null);
      setStatusMessage(`更新社員簽到失敗：${error.message}`);
      return;
    }
    await loadData();
    setSavingKey(null);
  };

  const handlePromoteWaitlistMember = async (userId: string) => {
    if (!selectedLessonId || !canOperateAttendance || attendanceBusy) return;

    setPromotingUserId(userId);
    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("promote_lesson_waitlist_member", {
      target_lesson_id: selectedLessonId,
      target_user_id: userId,
    });
    if (error) {
      setPromotingUserId(null);
      setStatusMessage(`正式遞補失敗：${error.message}`);
      return;
    }

    setStatusMessage("候補社員已正式遞補，現在可以簽到。");
    await loadData();
    setPromotingUserId(null);
  };

  const handleCheckInAllInstructors = async () => {
    if (!selectedLessonId || !canOperateAttendance || attendanceBusy) return;

    if (!window.confirm("確定要將所有教學標記為出席嗎？")) {
      return;
    }

    setIsCheckingInAll(true);
    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("check_in_all_lesson_instructors", {
      target_lesson_id: selectedLessonId,
    });
    if (error) {
      setIsCheckingInAll(false);
      setStatusMessage(`一鍵簽到失敗：${error.message}`);
      return;
    }

    setStatusMessage("已將所有教學標記為出席。");
    await loadData();
    setIsCheckingInAll(false);
  };

  return (
    <main className="min-h-screen bg-appBg text-text-primary">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto min-w-0 max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <ClipboardCheck size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">簽到</h1>
              <p className="mt-1 text-sm text-text-secondary">
                教學與正取社員可簽到；候補需先正式遞補。簽到不限時間，統計僅計算已開始的社課。
              </p>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="flex items-center gap-2 text-sm text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            正在讀取登入狀態...
          </Card>
        ) : !user ? (
          <Card>
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 text-text-secondary" />
              <div>
                <h2 className="font-semibold">尚未登入</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  請先登入後再使用簽到功能。
                </p>
              </div>
            </div>
          </Card>
        ) : !canView ? (
          <Card className="border-warning/30 bg-warning-light">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 text-warning" />
              <div>
                <h2 className="font-semibold">沒有簽到權限</h2>
                <p className="mt-1 text-sm">只有幹部與管理員可以進入簽到頁。</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-4 sm:gap-6">
            <Card>
              <div className="flex items-end justify-between gap-2 sm:gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    選擇社課
                  </span>
                  <select
                    value={selectedLessonId}
                    onChange={(event) => setSelectedLessonId(event.target.value)}
                    disabled={attendanceBusy}
                    className={fieldControlClasses}
                  >
                    {lessons.length === 0 && (
                      <option value="">目前沒有社課</option>
                    )}
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {formatLessonLabel(
                          lesson.lesson_date,
                          lesson.start_time,
                          lesson.end_time,
                          locale
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label="重新整理"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface"
                  onClick={() => void loadData()}
                  disabled={attendanceBusy}
                >
                  <RefreshCw
                    size={18}
                    className={isLoadingData ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">教學出席</h2>
                {canOperateAttendance && selectedLesson && (
                  <Button
                    type="button"
                    variant="outline"
                    className="!px-3 !text-xs"
                    onClick={() => void handleCheckInAllInstructors()}
                    disabled={
                      attendanceBusy ||
                      lessonInstructors.length === 0
                    }
                  >
                    {isCheckingInAll ? "簽到中..." : "一鍵簽到"}
                  </Button>
                )}
              </div>
              {lessonInstructors.length === 0 ? (
                <p className="text-sm text-text-secondary">本堂沒有教學名單。</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="bg-appBg text-xs text-text-secondary">
                      <tr>
                        <th className="w-16 px-3 py-2">簽到</th>
                        <th className="px-3 py-2">姓名</th>
                        <th className="px-3 py-2">程度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessonInstructors.map((instructor) => {
                        const attendance = instructorAttendance.find(
                          (item) => item.instructor_id === instructor.id
                        );
                        return (
                          <tr
                            key={instructor.id}
                            className="border-t border-line"
                          >
                            <td className="px-1 py-1">
                              <label className="inline-flex h-11 w-11 items-center justify-center">
                              <span className="sr-only">簽到：{instructor.full_name || "未填姓名"}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(attendance?.checked_in)}
                                disabled={
                                  !canOperateAttendance ||
                                  attendanceBusy
                                }
                                onChange={(event) =>
                                  void toggleInstructorAttendance(
                                    instructor.id,
                                    event.target.checked
                                  )
                                }
                                className="h-5 w-5 rounded border-line accent-primary"
                              />
                              </label>
                            </td>
                            <td className="break-words px-2 py-3 font-medium sm:px-3">
                              <span translate="no">
                              <span translate="no">
                                {instructor.full_name || "未填姓名"}
                              </span>
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <SurfLevelBadge level={instructor.surf_level} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold">社員出席簽到</h2>
              <MemberAttendanceTables
                key={selectedLessonId}
                participants={lessonParticipants}
                attendance={memberAttendance}
                membersById={membersById}
                capacity={selectedLesson?.capacity ?? 0}
                disabled={!canOperateAttendance || attendanceBusy || !selectedLesson}
                promotingUserId={promotingUserId}
                onCheckIn={toggleMemberAttendance}
                onPromote={handlePromoteWaitlistMember}
              />
            </Card>

            <Card>
              <CollapsibleSection title={<h2>幹部教學次數統計</h2>}>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-appBg text-xs text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">姓名</th>
                      <th className="px-3 py-2">程度</th>
                      <th className="px-3 py-2">教學次數 / 社課次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructorStats.map(({ member, teachingCount, total }) => (
                      <tr key={member.id} className="border-t border-line">
                        <td className="break-words px-2 py-3 font-medium sm:px-3">
                          <span translate="no">
                          <span translate="no">
                            {member.full_name || "未填姓名"}
                          </span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <SurfLevelBadge level={member.surf_level} />
                        </td>
                        <td className="px-3 py-2">
                          {teachingCount} / {total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </CollapsibleSection>
            </Card>

            <Card>
              <CollapsibleSection title={<h2>社員出席社課次數統計</h2>}>
              <div className="mb-3 flex flex-col sm:items-end">
                <Button
                  variant="outline"
                  icon={<Download size={16} aria-hidden="true" />}
                  onClick={handleExportAttendance}
                  disabled={attendanceBusy || filteredMemberStats.length === 0}
                >
                  匯出 CSV
                </Button>
              </div>
              <label className="relative mb-2 block">
                <span className="sr-only">搜尋出席統計社員姓名</span>
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="search"
                  value={statsSearch}
                  onChange={(event) => setStatsSearch(event.target.value)}
                  placeholder="搜尋社員姓名"
                  className={`${fieldControlClasses} !pl-9`}
                />
              </label>
              <p className="mb-3 text-xs text-text-secondary">CSV 會匯出目前搜尋結果；清空搜尋可匯出全部。</p>
              <div className="max-h-96 overflow-auto rounded-xl border border-line">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="sticky top-0 bg-appBg text-xs text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">姓名</th>
                      <th className="px-3 py-2">程度</th>
                      <th className="px-3 py-2">出席次數 / 社課次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemberStats.map(({ member, count, total }) => (
                      <tr key={member.id} className="border-t border-line">
                        <td className="break-words px-2 py-3 font-medium sm:px-3">
                          <span translate="no">
                          <span translate="no">
                            {member.full_name || "未填姓名"}
                          </span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <SurfLevelBadge level={member.surf_level} />
                        </td>
                        <td className="px-3 py-2">
                          {count} / {total}
                        </td>
                      </tr>
                    ))}
                    {filteredMemberStats.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-text-secondary">找不到符合姓名的社員。</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              </CollapsibleSection>
            </Card>
          </div>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>
    </main>
  );
}
