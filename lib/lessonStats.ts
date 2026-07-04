type MemberAttendanceRow = {
  user_id: string;
  lesson_id: string;
  checked_in: boolean;
};

type InstructorAttendanceRow = {
  instructor_id: string;
  lesson_id: string;
  checked_in: boolean;
};

/** Count unique started lessons a user attended as member and/or instructor. */
export function countLessonAttendance(
  userId: string,
  startedLessonIds: Set<string>,
  memberAttendance: MemberAttendanceRow[],
  instructorAttendance: InstructorAttendanceRow[]
) {
  const lessonIds = new Set<string>();

  for (const row of memberAttendance) {
    if (
      row.checked_in &&
      row.user_id === userId &&
      startedLessonIds.has(row.lesson_id)
    ) {
      lessonIds.add(row.lesson_id);
    }
  }

  for (const row of instructorAttendance) {
    if (
      row.checked_in &&
      row.instructor_id === userId &&
      startedLessonIds.has(row.lesson_id)
    ) {
      lessonIds.add(row.lesson_id);
    }
  }

  return lessonIds.size;
}

/** Count unique started lessons a user taught (instructor check-in only). */
export function countInstructorTeaching(
  userId: string,
  startedLessonIds: Set<string>,
  instructorAttendance: InstructorAttendanceRow[]
) {
  const lessonIds = new Set<string>();

  for (const row of instructorAttendance) {
    if (
      row.checked_in &&
      row.instructor_id === userId &&
      startedLessonIds.has(row.lesson_id)
    ) {
      lessonIds.add(row.lesson_id);
    }
  }

  return lessonIds.size;
}
