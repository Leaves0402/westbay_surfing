"use client";

import { useState } from "react";
import Image from "next/image";
import { AtSign, ImageOff, Mail } from "lucide-react";
import { SectionEditButton } from "@/components/home/editor/SectionEditButton";
import {
  getAdminContactHref,
  getInstagramHandle,
  toObjectPosition,
  type HomepageContent,
  type HomepageImage,
} from "@/lib/homepage";

/**
 * 深色海浪照片 Footer。
 * 沒有填寫的聯絡欄位會直接不顯示，不會出現「待補」字樣。
 */
export function PublicFooter({
  content,
  backgroundImage,
  qrCodeImage,
  isEditing = false,
  onEdit,
}: {
  content: HomepageContent;
  backgroundImage: HomepageImage | null;
  qrCodeImage: HomepageImage | null;
  isEditing?: boolean;
  onEdit?: () => void;
}) {
  const instagramHandle = getInstagramHandle(content.footerInstagramUrl);
  const adminContactHref = getAdminContactHref(content.footerAdminContact);
  const hasContactInfo =
    Boolean(content.footerInstagramUrl) || Boolean(content.footerAdminContact);

  return (
    <footer className="relative isolate overflow-hidden bg-slate-900 text-white">
      {backgroundImage && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover opacity-45"
          style={{
            backgroundImage: `url("${backgroundImage.url}")`,
            backgroundPosition: toObjectPosition(backgroundImage),
          }}
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/70" />

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {isEditing && onEdit && (
          <div className="mb-6 flex">
            <SectionEditButton
              label="編輯 Footer"
              tone="dark"
              onClick={onEdit}
            />
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              <span translate="no">{content.footerClubName}</span>
            </h2>
            {content.footerDescription && (
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/70">
                {content.footerDescription}
              </p>
            )}
          </div>

          {hasContactInfo && (
            <div>
              <h3 className="text-sm font-semibold text-white/90">聯絡我們</h3>
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                {content.footerInstagramUrl && (
                  <li className="flex items-start gap-2.5">
                    <AtSign
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0 text-white/60"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-white/55">
                        Instagram
                      </span>
                      <a
                        href={content.footerInstagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block break-words text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                      >
                        {instagramHandle}
                      </a>
                    </span>
                  </li>
                )}

                {content.footerAdminContact && (
                  <li className="flex items-start gap-2.5">
                    <Mail
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0 text-white/60"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-white/55">
                        聯絡網站管理員
                      </span>
                      {adminContactHref ? (
                        <a
                          href={adminContactHref}
                          className="block break-words text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                        >
                          <span translate="no">{content.footerAdminContact}</span>
                        </a>
                      ) : (
                        <span className="block break-words text-white/80">
                          <span translate="no">{content.footerAdminContact}</span>
                        </span>
                      )}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {qrCodeImage && (
            <div className="lg:justify-self-end">
              <h3 className="text-sm font-semibold text-white/90">
                社團 QR Code
              </h3>
              <QrCodeImage image={qrCodeImage} />
            </div>
          )}
        </div>

        <div className="mt-12 border-t border-white/15 pt-5">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} <span translate="no">{content.footerClubName}</span>．社團內部網站
          </p>
        </div>
      </div>
    </footer>
  );
}

function QrCodeImage({ image }: { image: HomepageImage }) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <div className="relative mt-3 h-32 w-32 overflow-hidden rounded-2xl border border-white/25 bg-white/10">
      {hasFailed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-white/60">
          <ImageOff size={22} strokeWidth={1.5} />
          <span className="text-[11px]">圖片載入失敗</span>
        </div>
      ) : (
        <Image
          src={image.url}
          alt={image.alt || "社團 QR Code"}
          fill
          unoptimized
          sizes="128px"
          className="object-cover"
          onError={() => setHasFailed(true)}
        />
      )}
    </div>
  );
}
