import type { Profile } from "@/lib/types";

type ProfileCompletionInput = Pick<Profile, "full_name" | "student_id"> | null;

export function needsProfileCompletion(profile: ProfileCompletionInput) {
  if (!profile) return false;
  return !profile.full_name?.trim() || !profile.student_id?.trim();
}
