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

export function canViewLessons(input: RoleInput) {
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

// 衝浪板管理區塊：只有幹部以上（officer、admin）可以查看與管理。
export function canViewSurfboards(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canManageSurfboards(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

/**
 * 瀏覽衝浪板：有租板權限的正式身分都可以讀取板子資料並在登記時挑選，
 * 但不會因此看到「衝浪板管理」區塊（新增、編輯、移除仍限 officer、admin）。
 */
export function canBrowseSurfboards(input: RoleInput) {
  return canUseMemberFeatures(input);
}

/**
 * 首頁內容管理：只有幹部以上（officer、admin）可以編輯首頁文字與圖片。
 * board_manager、member、pending 與未登入訪客都只能瀏覽。
 */
export function canManageHomepage(input: RoleInput) {
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

export function canViewSurfLevelRequests(input: RoleInput) {
  return canManageMembers(input);
}

export function canReviewSurfLevelRequests(input: RoleInput) {
  return hasAtLeastRole(input, "admin");
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

export function canManageLessons(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canViewAttendancePage(input: RoleInput) {
  return hasAtLeastRole(input, "officer");
}

export function canViewMaintenancePage(input: RoleInput) {
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
