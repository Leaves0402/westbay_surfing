import type { Profile, Role, SurfLevel } from "@/lib/types";

type RoleInput = Role | Pick<Profile, "role"> | null | undefined;

const roleRanks: Record<Role, number> = {
  pending: 0,
  member: 1,
  board_manager: 2,
  officer: 3,
  admin: 4,
};

const surfLevelRanks: Record<SurfLevel, number> = {
  初階: 1,
  中階: 2,
  中進階: 3,
  進階: 4,
};

function resolveRole(input: RoleInput) {
  if (!input) return null;
  return typeof input === "string" ? input : input.role;
}

function hasAtLeastRole(input: RoleInput, minimumRole: Role) {
  const role = resolveRole(input);
  if (!role) return false;
  return roleRanks[role] >= roleRanks[minimumRole];
}

export function canUseMemberFeatures(input: RoleInput) {
  return hasAtLeastRole(input, "member");
}

export function canViewAnnouncements(input: RoleInput) {
  return canUseMemberFeatures(input);
}

export function canManageAnnouncements(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canViewRentals(input: RoleInput) {
  return canUseMemberFeatures(input);
}

export function canManageRentalSlots(input: RoleInput) {
  return hasAtLeastRole(input, "board_manager");
}

export function canManageRentalPayments(input: RoleInput) {
  return hasAtLeastRole(input, "board_manager");
}

export function canViewUnpaidRentals(input: RoleInput) {
  return hasAtLeastRole(input, "board_manager");
}

export function canMarkRentalPaid(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canViewMembers(input: RoleInput) {
  return canUseMemberFeatures(input);
}

export function canManageMembers(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canManageMemberRoles(input: RoleInput) {
  return canManageMembers(input);
}

export function canReviewPendingMembers(input: RoleInput) {
  return canManageMembers(input);
}

export function canReviewSurfLevelRequests(input: RoleInput) {
  return canManageMembers(input);
}

export function canViewSurfTrips(input: RoleInput) {
  return canUseMemberFeatures(input);
}

export function canCreateSurfTrips(input: RoleInput) {
  return canUseMemberFeatures(input);
}

export function canManageSurfTripLeaders(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
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

export function compareRolesDescending(a: Role, b: Role) {
  return roleRanks[b] - roleRanks[a];
}

export function compareSurfLevelsDescending(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return getSurfLevelRank(b) - getSurfLevelRank(a);
}
