import type { Profile, Role, SurfLevel } from "@/lib/types";

const memberRoles: Role[] = ["member", "board_manager", "officer", "admin"];
const rentalManagerRoles: Role[] = ["board_manager", "officer", "admin"];
const officerRoles: Role[] = ["officer", "admin"];

const surfLevelRanks: Record<SurfLevel, number> = {
  初階: 1,
  中階: 2,
  中進階: 3,
  進階: 4,
};

function hasRole(role: Role | null | undefined, allowedRoles: Role[]) {
  return Boolean(role && allowedRoles.includes(role));
}

export function canUseMemberFeatures(profile: Pick<Profile, "role"> | null) {
  return hasRole(profile?.role, memberRoles);
}

export function canViewAnnouncements(profile: Pick<Profile, "role"> | null) {
  return canUseMemberFeatures(profile);
}

export function canManageAnnouncements(profile: Pick<Profile, "role"> | null) {
  return hasRole(profile?.role, officerRoles);
}

export function canViewRentals(profile: Pick<Profile, "role"> | null) {
  return canUseMemberFeatures(profile);
}

export function canManageRentalSlots(profile: Pick<Profile, "role"> | null) {
  return hasRole(profile?.role, rentalManagerRoles);
}

export function canManageMemberRoles(profile: Pick<Profile, "role"> | null) {
  return hasRole(profile?.role, officerRoles);
}

export function getSurfLevelRank(level: string | null | undefined) {
  if (!level) return 0;
  return surfLevelRanks[level as SurfLevel] ?? 0;
}

export function userMeetsSurfLevel(
  profile: Pick<Profile, "surf_level"> | null,
  minSurfLevel: string | null | undefined
) {
  if (!minSurfLevel) return true;
  return getSurfLevelRank(profile?.surf_level) >= getSurfLevelRank(minSurfLevel);
}
