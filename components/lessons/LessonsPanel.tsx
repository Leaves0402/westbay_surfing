"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { InstructorMultiSelect } from "@/components/lessons/InstructorMultiSelect";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import {
  addHoursToTime,
  formatLessonLabel,
  hasLessonStarted,
  isLessonCancelLocked,
} from "@/lib/lessonTime";
import { canManageLessons } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import {
  roleLabels,
  type Lesson,
  type LessonInstructor,
  type LessonParticipant,
  type Profile,
  type PublicMemberProfile,
} from "@/lib/types";

type LessonCardData = Lesson & {
  instructors: PublicMemberProfile[];
  participants: LessonParticipant[];
};

type LessonsPanelProps = {
  userId: string;
  profile: Profile | null;
  onStatusMessage: (message: string) => void;
};

export function LessonsPanel({
  userId,
  profile,
  onStatusMessage,
}: LessonsPanelProps) {
  const canManage = canManageLessons(profile);
  const [lessons, setLessons] = useState<LessonCardData[]>([]);
  const [instructors, setInstructors] = useState<PublicMemberProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actingLessonId, setActingLessonId] = useState<string | null>(null);

  const [lessonDate, setLessonDate] = useState(getTaipeiDate());
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("17:00");
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [capacity, setCapacity] = useState("20");
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>(
    []
  );
  const [note, setNote] = useState("");

  const loadLessons = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const lessonWindowStart = getTaipeiDate(-30);
    const lessonWindowEnd = getTaipeiDate(365);

    const [lessonsResult, membersResult] = await Promise.all([
        supabase
          .from("lessons")
          .select(
            "id, lesson_date, start_time, end_time, capacity, waitlist_capacity, note, created_by, created_at, updated_at"
          )
          .gte("lesson_date", lessonWindowStart)
          .lte("lesson_date", lessonWindowEnd)
          .order("lesson_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("public_member_profiles")
          .select("id, full_name, student_id, surf_level, role"),
      ]);

    if (lessonsResult.error) {
      setIsLoading(false);
      onStatusMessage(`讀取社課失敗：${lessonsResult.error.message}`);
      return;
    }
    if (membersResult.error) {
      setIsLoading(false);
      onStatusMessage(`讀取社員資料失敗：${membersResult.error.message}`);
      return;
    }

    const lessonRows = (lessonsResult.data ?? []) as Lesson[];
    const lessonIds = lessonRows.map((lesson) => lesson.id);
    const emptyResult = { data: [], error: null };
    const [instructorsResult, participantsResult] = lessonIds.length
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
        ])
      : [emptyResult, emptyResult];

    setIsLoading(false);

    if (instructorsResult.error) {
      onStatusMessage(`讀取教學名單失敗：${instructorsResult.error.message}`);
      return;
    }
    if (participantsResult.error) {
      onStatusMessage(`讀取報名名單失敗：${participantsResult.error.message}`);
      return;
    }

    const members = (membersResult.data ?? []) as PublicMemberProfile[];
    const membersById = new Map(members.map((member) => [member.id, member]));
    const instructorRows = (instructorsResult.data ?? []) as LessonInstructor[];
    const participantRows = (participantsResult.data ??
      []) as LessonParticipant[];

    setInstructors(
      members.filter(
        (member) => member.role === "officer" || member.role === "admin"
      )
    );

    setLessons(
      lessonRows.map((lesson) => ({
        ...lesson,
        instructors: instructorRows
          .filter((row) => row.lesson_id === lesson.id)
          .map((row) => membersById.get(row.instructor_id))
          .filter((member): member is PublicMemberProfile => Boolean(member)),
        participants: participantRows.filter(
          (row) => row.lesson_id === lesson.id
        ),
      }))
    );
  }, [onStatusMessage]);

  useEffect(() => {
    queueMicrotask(() => void loadLessons());
  }, [loadLessons]);

  const resetForm = () => {
    setLessonDate(getTaipeiDate());
    setStartTime("15:00");
    setEndTime("17:00");
    setEndTimeTouched(false);
    setCapacity("20");
    setSelectedInstructorIds([]);
    setNote("");
  };

  const handleCreateLesson = async () => {
    if (!canManage) {
      onStatusMessage("只有幹部與管理員可以新增社課。");
      return;
    }

    if (!lessonDate || !startTime || !endTime) {
      onStatusMessage("請填寫日期與時間。");
      return;
    }

    if (endTime <= startTime) {
      onStatusMessage("結束時間必須晚於開始時間。");
      return;
    }

    const capacityValue = Number(capacity);
    if (!Number.isInteger(capacityValue) || capacityValue < 1) {
      onStatusMessage("上限人數必須是大於 0 的整數。");
      return;
    }

    if (selectedInstructorIds.length === 0) {
      onStatusMessage("請選擇至少一位教學");
      return;
    }

    setIsCreating(true);
    onStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_lesson", {
      target_lesson_date: lessonDate,
      target_start_time: startTime,
      target_end_time: endTime,
      target_capacity: capacityValue,
      target_waitlist_capacity: 10,
      target_note: note.trim(),
      target_instructor_ids: selectedInstructorIds,
    });

    setIsCreating(false);

    if (error) {
      onStatusMessage(`新增社課失敗：${error.message}`);
      return;
    }

    resetForm();
    onStatusMessage("社課已新增。");
    await loadLessons();
  };

  const handleJoin = async (lessonId: string) => {
    setActingLessonId(lessonId);
    onStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("join_lesson", {
      target_lesson_id: lessonId,
    });
    setActingLessonId(null);

    if (error) {
      onStatusMessage(`報名失敗：${error.message}`);
      return;
    }

    onStatusMessage("報名成功。");
    await loadLessons();
  };

  const handleCancel = async (lessonId: string) => {
    setActingLessonId(lessonId);
    onStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_lesson_participation", {
      target_lesson_id: lessonId,
    });
    setActingLessonId(null);

    if (error) {
      onStatusMessage(`取消失敗：${error.message}`);
      return;
    }

    onStatusMessage("已取消報名。");
    await loadLessons();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!canManage) {
      onStatusMessage("只有幹部與管理員可以取消社課。");
      return;
    }

    if (
      !window.confirm(
        "確定要取消此社課嗎？該次報名、備取與簽到紀錄都會被刪除，此操作無法復原。"
      )
    ) {
      return;
    }

    setActingLessonId(lessonId);
    onStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_lesson", {
      target_lesson_id: lessonId,
    });
    setActingLessonId(null);

    if (error) {
      onStatusMessage(`取消社課失敗：${error.message}`);
      return;
    }

    onStatusMessage("社課已取消。");
    await loadLessons();
  };

  return (
    <div className="grid gap-6">
      {canManage && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary" />
            <h2 className="font-semibold text-text-primary">社課</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="日期">
              <input
                type="date"
                value={lessonDate}
                onChange={(event) => setLessonDate(event.target.value)}
                className={fieldControlClasses}
              />
            </FormField>

            <FormField label="上限人數">
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className={fieldControlClasses}
              />
            </FormField>

            <FormField label="開始時間">
              <input
                type="time"
                value={startTime}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartTime(nextStart);
                  if (!endTimeTouched) {
                    setEndTime(addHoursToTime(nextStart, 2));
                  }
                }}
                className={fieldControlClasses}
              />
            </FormField>

            <FormField label="結束時間">
              <input
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTimeTouched(true);
                  setEndTime(event.target.value);
                }}
                className={fieldControlClasses}
              />
            </FormField>

            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-700">教學</p>
              <InstructorMultiSelect
                instructors={instructors}
                selectedIds={selectedInstructorIds}
                onChange={setSelectedInstructorIds}
                disabled={isCreating}
              />
            </div>

            <FormField label="備註" className="sm:col-span-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`min-h-24 ${fieldControlClasses}`}
                placeholder="例如上課地點、課程內容、浪況提醒或注意事項"
              />
            </FormField>
          </div>

          <Button
            variant="primary"
            className="mt-5 sm:w-auto"
            fullWidth
            icon={<Plus size={18} />}
            onClick={() => void handleCreateLesson()}
            disabled={isCreating}
          >
            {isCreating ? "新增中..." : "新增社課"}
          </Button>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <h2 className="font-semibold text-text-primary">社課公告</h2>
          </div>
          <button
            type="button"
            aria-label="重新整理社課"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
            onClick={() => void loadLessons()}
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-text-secondary">讀取社課中...</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-text-secondary">目前沒有社課。</p>
        ) : (
          <div className="grid gap-3">
            {lessons.map((lesson) => {
              const confirmed = lesson.participants.filter(
                (item) => item.status === "confirmed"
              );
              const waitlist = lesson.participants
                .filter((item) => item.status === "waitlist")
                .sort(
                  (a, b) => (a.waitlist_order ?? 0) - (b.waitlist_order ?? 0)
                );
              const mine = lesson.participants.find(
                (item) => item.user_id === userId
              );
              const isFull = confirmed.length >= lesson.capacity;
              const waitlistFull =
                waitlist.length >= lesson.waitlist_capacity;
              const cancelLocked = isLessonCancelLocked(
                lesson.lesson_date,
                lesson.start_time
              );
              const lessonStarted = hasLessonStarted(
                lesson.lesson_date,
                lesson.start_time
              );
              const registrationLocked = cancelLocked || lessonStarted;
              const instructorNames = lesson.instructors
                .map(
                  (item) =>
                    `${roleLabels[item.role]}（${item.full_name || "未填姓名"}）`
                )
                .join("、");

              return (
                <div
                  key={lesson.id}
                  className="rounded-xl border border-line bg-appBg p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-text-primary">
                      社課｜
                      {formatLessonLabel(
                        lesson.lesson_date,
                        lesson.start_time,
                        lesson.end_time
                      )}
                    </p>
                    {canManage && (
                      <Button
                        variant="danger"
                        className="!min-h-8 !px-2.5 !text-xs"
                        disabled={actingLessonId === lesson.id}
                        onClick={() => void handleDeleteLesson(lesson.id)}
                      >
                        {actingLessonId === lesson.id
                          ? "取消中..."
                          : "取消社課"}
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    教學：{instructorNames || "未指定"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    人數：{confirmed.length} / {lesson.capacity}
                  </p>
                  {isFull && (
                    <p className="mt-1 text-sm text-text-secondary">
                      備取：{waitlist.length} / {lesson.waitlist_capacity}
                    </p>
                  )}
                  {lesson.note && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                      備註：{lesson.note}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {mine?.status === "confirmed" && (
                      <>
                        <span className="text-sm font-medium text-success">
                          已參加
                        </span>
                        <Button
                          variant="danger"
                          className="!min-h-9 !px-3 !text-xs"
                          disabled={
                            cancelLocked || actingLessonId === lesson.id
                          }
                          onClick={() => void handleCancel(lesson.id)}
                        >
                          {actingLessonId === lesson.id ? "處理中..." : "取消"}
                        </Button>
                        {cancelLocked && (
                          <span className="text-xs text-text-secondary">
                            社課開始前 5 小時內不可取消
                          </span>
                        )}
                      </>
                    )}

                    {mine?.status === "waitlist" && (
                      <>
                        <span className="text-sm font-medium text-warning">
                          備取第 {mine.waitlist_order} 位
                        </span>
                        <Button
                          variant="danger"
                          className="!min-h-9 !px-3 !text-xs"
                          disabled={
                            cancelLocked || actingLessonId === lesson.id
                          }
                          onClick={() => void handleCancel(lesson.id)}
                        >
                          {actingLessonId === lesson.id
                            ? "處理中..."
                            : "取消備取"}
                        </Button>
                        {cancelLocked && (
                          <span className="text-xs text-text-secondary">
                            社課開始前 5 小時內不可取消
                          </span>
                        )}
                      </>
                    )}

                    {!mine && !registrationLocked && !isFull && (
                      <Button
                        variant="primary"
                        className="!min-h-9 !px-3 !text-xs"
                        disabled={actingLessonId === lesson.id}
                        onClick={() => void handleJoin(lesson.id)}
                      >
                        {actingLessonId === lesson.id ? "處理中..." : "參加"}
                      </Button>
                    )}

                    {!mine && !registrationLocked && isFull && !waitlistFull && (
                      <Button
                        variant="outline"
                        className="!min-h-9 !px-3 !text-xs"
                        disabled={actingLessonId === lesson.id}
                        onClick={() => void handleJoin(lesson.id)}
                      >
                        {actingLessonId === lesson.id
                          ? "處理中..."
                          : "加入備取"}
                      </Button>
                    )}

                    {!mine && !registrationLocked && isFull && waitlistFull && (
                      <Button
                        variant="outline"
                        className="!min-h-9 !px-3 !text-xs"
                        disabled
                      >
                        已額滿
                      </Button>
                    )}

                    {!mine && registrationLocked && (
                      <span className="text-xs text-text-secondary">
                        {lessonStarted ? "社課已開始" : "開始前 5 小時停止報名"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
