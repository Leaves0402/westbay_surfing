"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CircleAlert, Gauge, Info, Lock, RefreshCw, Save, UserRound } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { getRoleTone } from "@/lib/badgeTones";
import { hasLessonStarted } from "@/lib/lessonTime";
import { countLessonAttendance } from "@/lib/lessonStats";
import { canUseMemberFeatures } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  profileSelectColumns,
  reviewRequiredSurfLevels,
  roleLabels,
  surfLevelDescriptions,
  type Lesson,
  type LessonInstructorAttendance,
  type LessonMemberAttendance,
  type Profile,
  type SurfLevel,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function ProfilePage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    reloadProfile,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

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
              <UserRound size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">社員基本資料</h1>
              <p className="mt-1 text-sm text-text-secondary">
                填寫姓名、學號與衝浪程度。初階與中階可直接更新，中進階與進階需由幹部或管理員審核。
              </p>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="flex items-center gap-2 text-sm text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            正在讀取資料...
          </Card>
        ) : !user ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                <Lock size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold text-text-primary">尚未登入</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  請先使用 Google 登入後再填寫社員資料。
                </p>
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => void handleGoogleLogin()}
                >
                  Google 登入
                </Button>
              </div>
            </div>
          </Card>
        ) : !profile ? (
          <Card className="flex items-center gap-2 text-sm text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            正在建立或讀取社員資料...
          </Card>
        ) : (
          <>
            <ProfileForm
              key={`${profile.id}-${profile.requested_surf_level ?? ""}`}
              user={user}
              profile={profile}
              setStatusMessage={setStatusMessage}
              reloadProfile={reloadProfile}
            />
            {canUseMemberFeatures(profile) && (
              <LessonAttendanceStatCard userId={user.id} />
            )}
          </>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>
    </main>
  );
}

function LessonAttendanceStatCard({ userId }: { userId: string }) {
  const [attendedCount, setAttendedCount] = useState(0);
  const [startedLessonCount, setStartedLessonCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const [lessonsResult, memberAttendanceResult, instructorAttendanceResult] =
        await Promise.all([
          supabase
            .from("lessons")
            .select(
              "id, lesson_date, start_time, end_time, capacity, waitlist_capacity, note, created_by, created_at, updated_at"
            ),
          supabase
            .from("lesson_member_attendance")
            .select(
              "id, lesson_id, user_id, checked_in, checked_in_by, checked_in_at"
            )
            .eq("user_id", userId)
            .eq("checked_in", true),
          supabase
            .from("lesson_instructor_attendance")
            .select(
              "id, lesson_id, instructor_id, checked_in, checked_in_by, checked_in_at"
            )
            .eq("instructor_id", userId)
            .eq("checked_in", true),
        ]);

      if (!active) return;

      const lessons = (lessonsResult.data ?? []) as Lesson[];
      const memberAttendance = (memberAttendanceResult.data ??
        []) as LessonMemberAttendance[];
      const instructorAttendance = (instructorAttendanceResult.data ??
        []) as LessonInstructorAttendance[];
      const startedLessons = lessons.filter((lesson) =>
        hasLessonStarted(lesson.lesson_date, lesson.start_time)
      );
      const startedIds = new Set(startedLessons.map((lesson) => lesson.id));

      setStartedLessonCount(startedLessons.length);
      setAttendedCount(
        countLessonAttendance(
          userId,
          startedIds,
          memberAttendance,
          instructorAttendance
        )
      );
      setIsLoading(false);
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <Card className="mt-6">
      <h2 className="font-semibold text-text-primary">社課出席</h2>
      <p className="mt-2 text-sm text-text-secondary">
        {isLoading
          ? "讀取中..."
          : `社課出席：${attendedCount} / ${startedLessonCount}`}
      </p>
    </Card>
  );
}

function ProfileForm({
  user,
  profile,
  setStatusMessage,
  reloadProfile,
}: {
  user: User;
  profile: Profile;
  setStatusMessage: (message: string) => void;
  reloadProfile: () => Promise<Profile | null>;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [studentId, setStudentId] = useState(profile.student_id ?? "");
  const [surfLevel, setSurfLevel] = useState(
    profile.requested_surf_level ?? profile.surf_level ?? "初階"
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setStatusMessage("請填寫姓名。");
      return;
    }

    if (!studentId.trim()) {
      setStatusMessage("請填寫學號。");
      return;
    }

    if (!surfLevel) {
      setStatusMessage("請選擇衝浪程度。");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(profileSelectColumns)
      .single();

    if (profileError) {
      setIsSaving(false);
      setStatusMessage(`儲存社員資料失敗：${profileError.message}`);
      return;
    }

    const selectedLevel = surfLevel as SurfLevel;
    const shouldRequestOrUpdateLevel =
      selectedLevel !== profile.surf_level ||
      profile.requested_surf_level !== null;

    if (shouldRequestOrUpdateLevel) {
      const { error: levelError } = await supabase.rpc("request_surf_level", {
        target_level: selectedLevel,
      });

      if (levelError) {
        setIsSaving(false);
        setStatusMessage(`更新衝浪程度失敗：${levelError.message}`);
        return;
      }
    }

    setIsSaving(false);

    if (reviewRequiredSurfLevels.includes(selectedLevel)) {
      setStatusMessage(`已送出${selectedLevel}程度審核。`);
    } else {
      setStatusMessage("社員資料已儲存。");
    }

    await reloadProfile();
  };

  return (
    <Card>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-text-secondary">Email</p>
          <p className="mt-1 break-all font-medium text-text-primary">
            {user.email}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">系統身分</p>
          <p className="mt-1">
            <Badge tone={getRoleTone(profile.role)}>
              {roleLabels[profile.role]}
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">已核准程度</p>
          <p className="mt-1 font-medium text-text-primary">
            <SurfLevelBadge level={profile.surf_level} />
          </p>
        </div>
      </div>

      {profile.requested_surf_level && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-light p-3">
          <CircleAlert
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-warning"
          />
          <p className="text-sm leading-6 text-text-primary/80">
            已送出{profile.requested_surf_level}程度審核，等待幹部或管理員處理。
          </p>
        </div>
      )}

      <div className="grid gap-4">
        <FormField label="姓名">
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={fieldControlClasses}
            placeholder="請輸入姓名"
          />
        </FormField>

        <FormField label="學號">
          <input
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className={fieldControlClasses}
            placeholder="請輸入學號"
          />
        </FormField>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-text-primary">衝浪程度</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {surfLevelDescriptions.map((level) => {
              const needsReview = reviewRequiredSurfLevels.includes(level.value);
              const isSelected = surfLevel === level.value;

              return (
                <label
                  key={level.value}
                  className={`min-h-11 rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary-light"
                      : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="surf_level"
                      value={level.value}
                      checked={isSelected}
                      onChange={(event) => setSurfLevel(event.target.value)}
                      className="h-4 w-4 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <SurfLevelBadge level={level.value} />
                    {needsReview && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <Gauge size={12} />
                        需審核
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    {level.description}
                  </p>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        className="mt-6 sm:w-auto"
        icon={<Save size={16} />}
        onClick={() => void handleSaveProfile()}
        disabled={isSaving}
      >
        {isSaving ? "儲存中..." : "儲存資料"}
      </Button>
    </Card>
  );
}
