import { clubIntro } from "@/lib/siteContent";

/** 簡潔的社團介紹：只用文字與細線分隔，不做成大型浮動 Card。 */
export function ClubIntroSection() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">
          ABOUT
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {clubIntro.heading}
        </h2>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
          <div className="flex flex-col gap-4">
            {clubIntro.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 12)}
                className="text-sm leading-7 text-slate-600 sm:text-base sm:leading-8"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {clubIntro.highlights.map((highlight) => (
              <div
                key={highlight.title}
                className="border-t border-border pt-3"
              >
                <dt className="text-sm font-semibold text-slate-900">
                  {highlight.title}
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-500">
                  {highlight.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
