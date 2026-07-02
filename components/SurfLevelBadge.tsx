import type { SurfLevel } from "@/lib/types";

export const surfLevelColorClasses: Record<SurfLevel, string> = {
  初階: "bg-blue-500",
  中階: "bg-green-500",
  中進階: "bg-yellow-400",
  進階: "bg-red-500",
};

export const surfLevelBorderClasses: Record<SurfLevel, string> = {
  初階: "border-blue-500",
  中階: "border-green-500",
  中進階: "border-yellow-400",
  進階: "border-red-500",
};

export function SurfLevelBadge({ level }: { level: string | null | undefined }) {
  if (!level) {
    return <span className="text-slate-500">未填寫</span>;
  }

  const colorClass = surfLevelColorClasses[level as SurfLevel] ?? "bg-slate-300";

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${colorClass}`} />
      <span>{level}</span>
    </span>
  );
}
