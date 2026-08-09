"use client";

import { Suspense } from "react";
import { Info, Waves } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AuthRequiredNotice } from "@/components/home/AuthRequiredNotice";
import { BannerSection } from "@/components/home/BannerSection";
import { ClubIntroSection } from "@/components/home/ClubIntroSection";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { MemberStatusStrip } from "@/components/home/MemberStatusStrip";
import { OfficerSection } from "@/components/home/OfficerSection";
import { PublicFooter } from "@/components/home/PublicFooter";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { heroContent, heroSlides } from "@/lib/siteContent";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function Home() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  return (
    <>
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        variant="overlay"
      />

      <main className="text-slate-950">
        <HeroCarousel slides={heroSlides}>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/80">
            <Waves size={16} strokeWidth={2} />
            NSYSU SURF CLUB
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
            {heroContent.title}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-white/90 sm:text-base sm:leading-8">
            {heroContent.subtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton
              href="/rentals"
              variant="primary"
              className="sm:w-auto"
              fullWidth
            >
              查看租板時段
            </LinkButton>

            {user ? (
              <LinkButton
                href="/profile"
                variant="outline"
                className="border-white/40 !bg-white/15 !text-white hover:!bg-white/25 sm:w-auto"
                fullWidth
              >
                查看我的資料
              </LinkButton>
            ) : (
              <Button
                variant="outline"
                className="border-white/40 !bg-white/15 !text-white hover:!bg-white/25 sm:w-auto"
                fullWidth
                onClick={() => void handleGoogleLogin()}
                disabled={isLoading}
              >
                Google 登入
              </Button>
            )}
          </div>
        </HeroCarousel>

        <Suspense fallback={null}>
          <AuthRequiredNotice
            isLoggedIn={Boolean(user)}
            isLoading={isLoading}
            onLogin={(nextPath) => void handleGoogleLogin(nextPath)}
          />
        </Suspense>

        {user && <MemberStatusStrip user={user} profile={profile} />}

        {statusMessage && (
          <section className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm text-slate-600 sm:px-6">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{statusMessage}</span>
            </div>
          </section>
        )}

        <ClubIntroSection />
        <BannerSection />
        <OfficerSection />
      </main>

      <PublicFooter />
    </>
  );
}
