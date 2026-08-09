"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { officers } from "@/lib/siteContent";

/**
 * 幹部團隊照片網格：手機 2 人一排、桌機 4 人一排，統一 4:5 照片比例。
 * 照片與姓名目前皆為暫代內容，見 lib/siteContent.ts。
 */
export function OfficerSection() {
  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">
          TEAM
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          幹部團隊
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
          有任何關於入社、租板或社課的問題，都可以直接找我們。以下照片與姓名為暫代內容，待正式資料補上後更新。
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {officers.map((officer) => (
            <li key={officer.role}>
              <OfficerCard officer={officer} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OfficerCard({ officer }: { officer: (typeof officers)[number] }) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <figure className="flex h-full flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-slate-100">
        {hasFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <ImageOff size={22} strokeWidth={1.5} />
            <span className="text-[11px]">照片待補</span>
          </div>
        ) : (
          <Image
            src={officer.image.src}
            alt={officer.image.alt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            style={{ objectPosition: officer.image.objectPosition }}
            onError={() => setHasFailed(true)}
          />
        )}
      </div>

      <figcaption className="mt-3">
        <p className="text-xs font-medium text-primary">{officer.role}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
          {officer.name}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{officer.bio}</p>
      </figcaption>
    </figure>
  );
}
