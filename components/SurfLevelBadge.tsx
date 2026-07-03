import { Badge } from "@/components/ui/Badge";
import { getSurfLevelTone } from "@/lib/badgeTones";

export function SurfLevelBadge({ level }: { level: string | null | undefined }) {
  if (!level) {
    return <span className="text-sm text-text-secondary">未填寫</span>;
  }

  return <Badge tone={getSurfLevelTone(level)}>{level}</Badge>;
}
