"use client";

import type { User } from "@supabase/supabase-js";
import { CircleAlert, Gauge, Mail, ShieldCheck } from "lucide-react";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { getRoleTone } from "@/lib/badgeTones";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/types";

/**
 * 登入後的精簡狀態列：帳號、身分與衝浪程度排成一條，取代原本三張大型狀態卡。
 */
export function MemberStatusStrip({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2">
          <span className="flex min-w-0 items-center gap-2">
            <Mail size={15} className="shrink-0 text-slate-400" />
            <span className="shrink-0 text-slate-500">帳號</span>
            <span className="truncate font-medium text-slate-800">
              {user.email}
            </span>
          </span>

          <span className="flex items-center gap-2">
            <ShieldCheck size={15} className="shrink-0 text-slate-400" />
            <span className="shrink-0 text-slate-500">身分</span>
            {profile ? (
              <Badge tone={getRoleTone(profile.role)}>
                {roleLabels[profile.role]}
              </Badge>
            ) : (
              <span className="text-slate-500">讀取中...</span>
            )}
          </span>

          <span className="flex items-center gap-2">
            <Gauge size={15} className="shrink-0 text-slate-400" />
            <span className="shrink-0 text-slate-500">衝浪程度</span>
            <SurfLevelBadge level={profile?.surf_level} />
          </span>
        </div>

        {profile?.role === "pending" && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-light px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm leading-6 text-slate-700">
              <CircleAlert
                size={16}
                className="mt-0.5 shrink-0 text-warning"
                strokeWidth={1.75}
              />
              <span>
                你目前是待審核身分，可以填寫基本資料與查看公開租板時段，完成資料後請等待幹部或管理員審核。
              </span>
            </p>
            <LinkButton
              href="/profile"
              variant="outline"
              className="shrink-0 !min-h-9 !text-xs"
            >
              前往填寫資料
            </LinkButton>
          </div>
        )}
      </div>
    </section>
  );
}
