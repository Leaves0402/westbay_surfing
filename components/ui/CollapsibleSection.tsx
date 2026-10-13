import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleSectionProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
};

export function CollapsibleSection({
  title,
  children,
  className = "",
  collapsible = true,
}: CollapsibleSectionProps) {
  if (!collapsible) {
    return <div className={`min-w-0 ${className}`}>{children}</div>;
  }

  return (
    <details className={`group/collapse min-w-0 ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 break-words font-semibold">{title}</div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0 text-text-secondary transition-transform group-open/collapse:rotate-180"
        />
      </summary>
      <div className="min-w-0 pt-3">{children}</div>
    </details>
  );
}
