import { SectionEditButton } from "@/components/home/editor/SectionEditButton";
import { toObjectPosition, type HomepageImage } from "@/lib/homepage";

/**
 * 全寬固定背景照片區段。
 * 桌機使用 bg-fixed 製造輕微 parallax；手機改為一般靜態背景，避免 iOS 跳動。
 */
export function BannerSection({
  image,
  slogan,
  subtitle,
  isEditing = false,
  onEdit,
}: {
  image: HomepageImage | null;
  slogan: string;
  subtitle: string;
  isEditing?: boolean;
  onEdit?: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-800 bg-cover bg-scroll md:bg-fixed"
        style={
          image
            ? {
                backgroundImage: `url("${image.url}")`,
                backgroundPosition: toObjectPosition(image),
              }
            : undefined
        }
      />
      {/* 遮罩調淡讓照片更亮，文字改用陰影維持可讀性。 */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/25" />

      <div className="relative mx-auto flex min-h-[260px] max-w-6xl flex-col justify-center px-4 py-16 sm:min-h-[320px] sm:px-6">
        {isEditing && onEdit && (
          <div className="mb-4 flex">
            <SectionEditButton
              label="編輯中段區塊"
              tone="dark"
              onClick={onEdit}
            />
          </div>
        )}

        <p className="text-xl font-bold leading-snug text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)] sm:text-3xl">
          {slogan}
        </p>
        {subtitle && (
          <p className="mt-3 max-w-xl text-sm leading-7 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
