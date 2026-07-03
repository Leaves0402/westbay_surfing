import type { BadgeTone } from "@/components/ui/Badge";
import type { Role, SurfLevel } from "@/lib/types";

export const surfLevelToneMap: Record<SurfLevel, BadgeTone> = {
  初階: "info",
  中階: "success",
  中進階: "warning",
  進階: "danger",
};

export function getSurfLevelTone(level: string | null | undefined): BadgeTone {
  if (!level) return "neutral";
  return surfLevelToneMap[level as SurfLevel] ?? "neutral";
}

export const roleBadgeToneMap: Record<Role, BadgeTone> = {
  pending: "neutral",
  member: "info",
  board_manager: "primary",
  officer: "warning",
  admin: "danger",
};

export function getRoleTone(role: Role): BadgeTone {
  return roleBadgeToneMap[role] ?? "neutral";
}
