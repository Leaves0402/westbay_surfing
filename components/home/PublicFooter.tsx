import { AtSign, Mail, MapPin, MessageCircle, QrCode } from "lucide-react";
import {
  contactPendingText,
  footerContact,
  footerImage,
} from "@/lib/siteContent";

// 這個 lucide 版本沒有品牌圖示，改用語意相近的通用圖示。
const contactIcons = [Mail, AtSign, MessageCircle, MapPin];

/** 深色海浪照片 Footer。聯絡資料尚未提供時只顯示待補文字，不做成假連結。 */
export function PublicFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-slate-900 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-45"
        style={{ backgroundImage: `url("${footerImage.src}")` }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/70" />

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {footerContact.clubName}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-7 text-white/70">
              {footerContact.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white/90">聯絡我們</h3>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {footerContact.items.map((item, index) => {
                const Icon = contactIcons[index] ?? Mail;

                return (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0 text-white/60"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-white/55">
                        {item.label}
                      </span>
                      {item.value && item.href ? (
                        <a
                          href={item.href}
                          className="block break-words text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="block text-white/70">
                          {item.value ?? contactPendingText}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:justify-self-end">
            <h3 className="text-sm font-semibold text-white/90">社團 QR Code</h3>
            <div className="mt-3 flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/35 bg-white/5 text-white/60">
              <QrCode size={30} strokeWidth={1.5} />
              <span className="text-[11px]">{footerContact.qrCodeNote}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-5">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} {footerContact.clubName}．社團內部網站
          </p>
        </div>
      </div>
    </footer>
  );
}
