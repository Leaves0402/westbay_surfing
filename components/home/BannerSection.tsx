import { bannerSection } from "@/lib/siteContent";

/**
 * 全寬固定背景照片區段。
 * 桌機使用 bg-fixed 製造輕微 parallax；手機改為一般靜態背景，避免 iOS 跳動。
 */
export function BannerSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-800 bg-cover bg-center bg-scroll md:bg-fixed"
        style={{
          backgroundImage: `url("${bannerSection.image.src}")`,
          backgroundPosition: bannerSection.image.objectPosition,
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto flex min-h-[260px] max-w-6xl flex-col justify-center px-4 py-16 sm:min-h-[320px] sm:px-6">
        <p className="text-xl font-bold leading-snug text-white sm:text-3xl">
          {bannerSection.slogan}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-7 text-white/85 sm:text-base">
          {bannerSection.subtitle}
        </p>
      </div>
    </section>
  );
}
