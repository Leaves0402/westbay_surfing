"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Info,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldControlClasses } from "@/components/ui/FormField";
import {
  compareSurfLevelsDescending,
  canViewAttendancePage,
} from "@/lib/permissions";
import { formatLessonLabel, hasLessonStarted } from "@/lib/lessonTime";
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

  const confirmedParticipantCount = lessonParticipants.filter(
    (participant) => participant.status === "confirmed"
  ).length;
  const firstWaitlistUserId =
    lessonParticipants.find((participant) => participant.status === "waitlist")
      ?.user_id ?? null;

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

  const toggleInstructorAttendance = async (
    instructorId: string,
    checked: boolean
  ) => {
    if (!selectedLessonId || !canOperateAttendance) return;
    setSavingKey(`instructor-${instructorId}`);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_lesson_instructor_attendance", {
      target_lesson_id: selectedLessonId,
      target_instructor_id: instructorId,
      target_checked_in: checked,
    });
    setSavingKey(null);
    if (error) {
      setStatusMessage(`更新教學簽到失敗：${error.message}`);
      return;
    }
    await loadData();
  };

  const toggleMemberAttendance = async (userId: string, checked: boolean) => {
    if (!selectedLessonId || !canOperateAttendance) return;
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
    setSavingKey(null);
    if (error) {
      setStatusMessage(`更新社員簽到失敗：${error.message}`);
      return;
    }
    await loadData();
  };

  const handlePromoteWaitlistMember = async (userId: string) => {
    if (!selectedLessonId || !canOperateAttendance) return;

    setPromotingUserId(userId);
    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("promote_lesson_waitlist_member", {
      target_lesson_id: selectedLessonId,
      target_user_id: userId,
    });
    setPromotingUserId(null);

    if (error) {
      setStatusMessage(`正式遞補失敗：${error.message}`);
      return;
    }

    setStatusMessage("候補社員已正式遞補，現在可以簽到。");
    await loadData();
  };

  const handleCheckInAllInstructors = async () => {
    if (!selectedLessonId || !canOperateAttendance) return;

    if (!window.confirm("確定要將所有教學標記為出席嗎？")) {
      return;
    }

    setIsCheckingInAll(true);
    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("check_in_all_lesson_instructors", {
      target_lesson_id: selectedLessonId,
    });
    setIsCheckingInAll(false);

    if (error) {
      setStatusMessage(`一鍵簽到失敗：${error.message}`);
      return;
    }

    setStatusMessage("已將所有教學標記為出席。");
    await loadData();
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

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
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
          <div className="grid gap-6">
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    選擇社課
                  </span>
                  <select
                    value={selectedLessonId}
                    onChange={(event) => setSelectedLessonId(event.target.value)}
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
                          lesson.end_time
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label="重新整理"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
                  onClick={() => void loadData()}
                  disabled={isLoadingData}
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
                    className="!min-h-9 !px-3 !text-xs"
                    onClick={() => void handleCheckInAllInstructors()}
                    disabled={
                      isCheckingInAll ||
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
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="bg-appBg text-xs text-text-secondary">
                      <tr>
                        <th className="px-3 py-2">簽到</th>
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
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(attendance?.checked_in)}
                                disabled={
                                  !canOperateAttendance ||
                                  savingKey === `instructor-${instructor.id}`
                                }
                                onChange={(event) =>
                                  void toggleInstructorAttendance(
                                    instructor.id,
                                    event.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-line text-primary"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {instructor.full_name || "未填姓名"}
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
              {lessonParticipants.length === 0 ? (
                <p className="text-sm text-text-secondary">本堂尚無參加者。</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-appBg text-xs text-text-secondary">
                      <tr>
                        <th className="px-3 py-2">簽到</th>
                        <th className="px-3 py-2">姓名</th>
                        <th className="px-3 py-2">程度</th>
                        <th className="px-3 py-2">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessonParticipants.map((participant) => {
                        const member = membersById.get(participant.user_id);
                        const attendance = memberAttendance.find(
                          (item) => item.user_id === participant.user_id
                        );
                        return (
                          <tr
                            key={participant.id}
                            className="border-t border-line"
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(attendance?.checked_in)}
                                disabled={
                                  !canOperateAttendance ||
                                  participant.status !== "confirmed" ||
                                  savingKey === `member-${participant.user_id}`
                                }
                                onChange={(event) =>
                                  void toggleMemberAttendance(
                                    participant.user_id,
                                    event.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-line text-primary"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {member?.full_name || "未填姓名"}
                            </td>
                            <td className="px-3 py-2">
                              <SurfLevelBadge level={member?.surf_level} />
                            </td>
                            <td className="px-3 py-2">
                              {participant.status === "confirmed" ? (
                                <Badge tone="success">正取</Badge>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone="warning">
                                    候補 {participant.waitlist_order ?? ""}
                                  </Badge>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="!min-h-8 !px-2 !text-xs"
                                    disabled={
                                      participant.user_id !== firstWaitlistUserId ||
                                      !selectedLesson ||
                                      confirmedParticipantCount >=
                                        selectedLesson.capacity ||
                                      promotingUserId !== null
                                    }
                                    onClick={() =>
                                      void handlePromoteWaitlistMember(
                                        participant.user_id
                                      )
                                    }
                                    title={
                                      confirmedParticipantCount >=
                                      (selectedLesson?.capacity ?? 0)
                                        ? "正取名額已滿，需先釋出名額"
                                        : participant.user_id !==
                                            firstWaitlistUserId
                                          ? "必須依候補順序遞補"
                                          : "正式遞補後才能簽到"
                                    }
                                  >
                                    {promotingUserId === participant.user_id
                                      ? "遞補中..."
                                      : "正式遞補"}
                                  </Button>
                                </div>
                              )}
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
              <h2 className="mb-3 font-semibold">幹部教學次數統計</h2>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[420px] text-left text-sm">
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
                        <td className="px-3 py-2 font-medium">
                          {member.full_name || "未填姓名"}
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
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold">社員出席社課次數統計</h2>
              <div className="max-h-96 overflow-auto rounded-xl border border-line">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="sticky top-0 bg-appBg text-xs text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">姓名</th>
                      <th className="px-3 py-2">程度</th>
                      <th className="px-3 py-2">出席次數 / 社課次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberStats.map(({ member, count, total }) => (
                      <tr key={member.id} className="border-t border-line">
                        <td className="px-3 py-2 font-medium">
                          {member.full_name || "未填姓名"}
                        </td>
                        <td className="px-3 py-2">
                          <SurfLevelBadge level={member.surf_level} />
                        </td>
                        <td className="px-3 py-2">
                          {count} / {total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
