"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Users } from "lucide-react";
import { SectionEditButton } from "@/components/home/editor/SectionEditButton";
import { toObjectPosition, type HomepageOfficer } from "@/lib/homepage";

/**
 * 幹部團隊照片網格：手機 2 人一排、桌機 4 人一排，統一 4:5 照片比例。
 * 這裡只是首頁展示卡，和系統帳號權限無關。
 */
export function OfficerSection({
  officers,
  isEditing = false,
  onManage,
}: {
  officers: HomepageOfficer[];
  isEditing?: boolean;
  onManage?: () => void;
}) {
  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary">
              TEAM
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              幹部團隊
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              有任何關於入社、租板或社課的問題，都可以直接找我們。
            </p>
          </div>

          {isEditing && onManage && (
            <SectionEditButton
              label="管理幹部"
              icon={<Users size={14} />}
              onClick={onManage}
            />
          )}
        </div>

        {officers.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-slate-500">
            目前還沒有幹部介紹。
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {officers.map((officer, index) => (
              <li key={`${officer.id ?? index}-${officer.roleTitle}`}>
                <OfficerCard officer={officer} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OfficerCard({ officer }: { officer: HomepageOfficer }) {
  const [hasFailed, setHasFailed] = useState(false);
  const image = officer.image;

  return (
    <figure className="flex h-full flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-slate-100">
        {image && !hasFailed ? (
          <Image
            src={image.url}
            alt={image.alt || `${officer.displayName}（${officer.roleTitle}）`}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            style={{ objectPosition: toObjectPosition(image) }}
            onError={() => setHasFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <ImageOff size={22} strokeWidth={1.5} />
            <span className="text-[11px]">照片待補</span>
          </div>
        )}
      </div>

      <figcaption className="mt-3">
        <p className="text-xs font-medium text-primary">{officer.roleTitle}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {officer.displayName}
        </p>
        {officer.bio && (
          <p className="mt-1 text-xs leading-5 text-slate-500">{officer.bio}</p>
        )}
      </figcaption>
    </figure>
  );
}
