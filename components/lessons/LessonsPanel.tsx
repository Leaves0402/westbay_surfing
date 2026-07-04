"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import {
  addHoursToTime,
  formatLessonLabel,
  isLessonCancelLocked,
} from "@/lib/lessonTime";
import { canManageLessons } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type {
  Lesson,
  LessonInstructor,
  LessonParticipant,
  Profile,
  PublicMemberProfile,
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

function getTodayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

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

  const [lessonDate, setLessonDate] = useState(getTodayDate());
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

    const [lessonsResult, instructorsResult, participantsResult, membersResult] =
      await Promise.all([
        supabase
          .from("lessons")
          .select(
            "id, lesson_date, start_time, end_time, capacity, waitlist_capacity, note, created_by, created_at, updated_at"
          )
          .order("lesson_date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("lesson_instructors")
          .select("lesson_id, instructor_id"),
        supabase
          .from("lesson_participants")
          .select(
            "id, lesson_id, user_id, status, waitlist_order, created_at, updated_at"
          ),
        supabase
          .from("public_member_profiles")
          .select("id, full_name, student_id, surf_level, role"),
      ]);

    setIsLoading(false);

    if (lessonsResult.error) {
      onStatusMessage(`讀取社課失敗：${lessonsResult.error.message}`);
      return;
    }
    if (instructorsResult.error) {
      onStatusMessage(`讀取教學名單失敗：${instructorsResult.error.message}`);
      return;
    }
    if (participantsResult.error) {
      onStatusMessage(`讀取報名名單失敗：${participantsResult.error.message}`);
      return;
    }
    if (membersResult.error) {
      onStatusMessage(`讀取社員資料失敗：${membersResult.error.message}`);
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

    const lessonRows = (lessonsResult.data ?? []) as Lesson[];
    for (const lesson of lessonRows) {
      await supabase.rpc("promote_lesson_waitlist", {
        target_lesson_id: lesson.id,
      });
    }

    const refreshedParticipants = await supabase
      .from("lesson_participants")
      .select(
        "id, lesson_id, user_id, status, waitlist_order, created_at, updated_at"
      );

    const finalParticipants = (refreshedParticipants.data ??
      participantRows) as LessonParticipant[];

    setLessons(
      lessonRows.map((lesson) => ({
        ...lesson,
        instructors: instructorRows
          .filter((row) => row.lesson_id === lesson.id)
          .map((row) => membersById.get(row.instructor_id))
          .filter((member): member is PublicMemberProfile => Boolean(member)),
        participants: finalParticipants.filter(
          (row) => row.lesson_id === lesson.id
        ),
      }))
    );
  }, [onStatusMessage]);

  useEffect(() => {
    queueMicrotask(() => void loadLessons());
  }, [loadLessons]);

  const resetForm = () => {
    setLessonDate(getTodayDate());
    setStartTime("15:00");
    setEndTime("17:00");
    setEndTimeTouched(false);
    setCapacity("20");
    setSelectedInstructorIds([]);
    setNote("");
  };

  const toggleInstructor = (instructorId: string) => {
    setSelectedInstructorIds((current) =>
      current.includes(instructorId)
        ? current.filter((id) => id !== instructorId)
        : [...current, instructorId]
    );
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
      onStatusMessage("請至少選擇一位教學。");
      return;
    }

    setIsCreating(true);
    onStatusMessage("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        lesson_date: lessonDate,
        start_time: startTime,
        end_time: endTime,
        capacity: capacityValue,
        waitlist_capacity: 10,
        note: note.trim() || null,
        created_by: userId,
      })
      .select(
        "id, lesson_date, start_time, end_time, capacity, waitlist_capacity, note, created_by, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      setIsCreating(false);
      onStatusMessage(`新增社課失敗：${error?.message ?? "未知錯誤"}`);
      return;
    }

    const lessonId = (data as Lesson).id;
    const { error: instructorError } = await supabase
      .from("lesson_instructors")
      .insert(
        selectedInstructorIds.map((instructorId) => ({
          lesson_id: lessonId,
          instructor_id: instructorId,
        }))
      );

    setIsCreating(false);

    if (instructorError) {
      await supabase.from("lessons").delete().eq("id", lessonId);
      onStatusMessage(`新增教學名單失敗：${instructorError.message}`);
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
              <div className="grid gap-2 sm:grid-cols-2">
                {instructors.map((instructor) => (
                  <label
                    key={instructor.id}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-appBg px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInstructorIds.includes(instructor.id)}
                      onChange={() => toggleInstructor(instructor.id)}
                      className="h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary"
                    />
                    <span>{instructor.full_name || "未填姓名"}</span>
                    <SurfLevelBadge level={instructor.surf_level} />
                  </label>
                ))}
              </div>
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
              const instructorNames = lesson.instructors
                .map((item) => item.full_name || "未填姓名")
                .join("、");

              return (
                <div
                  key={lesson.id}
                  className="rounded-xl border border-line bg-appBg p-4"
                >
                  <p className="font-semibold text-text-primary">
                    社課｜
                    {formatLessonLabel(
                      lesson.lesson_date,
                      lesson.start_time,
                      lesson.end_time
                    )}
                  </p>
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

                    {!mine && !isFull && (
                      <Button
                        variant="primary"
                        className="!min-h-9 !px-3 !text-xs"
                        disabled={actingLessonId === lesson.id}
                        onClick={() => void handleJoin(lesson.id)}
                      >
                        {actingLessonId === lesson.id ? "處理中..." : "參加"}
                      </Button>
                    )}

                    {!mine && isFull && !waitlistFull && (
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

                    {!mine && isFull && waitlistFull && (
                      <Button
                        variant="outline"
                        className="!min-h-9 !px-3 !text-xs"
                        disabled
                      >
                        已額滿
                      </Button>
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
