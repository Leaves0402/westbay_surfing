"use client";

import { Suspense, useState } from "react";
import { CircleCheck, Info, Pencil, Waves } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AuthRequiredNotice } from "@/components/home/AuthRequiredNotice";
import { BannerSection } from "@/components/home/BannerSection";
import { ClubIntroSection } from "@/components/home/ClubIntroSection";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { OfficerSection } from "@/components/home/OfficerSection";
import { PublicFooter } from "@/components/home/PublicFooter";
import { AboutEditDialog } from "@/components/home/editor/AboutEditDialog";
import { BannerEditDialog } from "@/components/home/editor/BannerEditDialog";
import { FooterEditDialog } from "@/components/home/editor/FooterEditDialog";
import { HeroEditDialog } from "@/components/home/editor/HeroEditDialog";
import { HomepageEditToolbar } from "@/components/home/editor/HomepageEditToolbar";
import { OfficerManagerDialog } from "@/components/home/editor/OfficerManagerDialog";
import { SectionEditButton } from "@/components/home/editor/SectionEditButton";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { canManageHomepage } from "@/lib/permissions";
import { createDraftFromData } from "@/lib/homepage";
import { useAuthProfile } from "@/lib/useAuthProfile";
import { useHomepageEditor } from "@/lib/useHomepageEditor";

type EditorSection = "hero" | "about" | "banner" | "officers" | "footer" | null;

const statusToneClasses = {
  success: "border-success/30 bg-success-light text-success",
  danger: "border-danger/30 bg-danger-light text-danger",
  warning: "border-warning/30 bg-warning-light text-warning",
} as const;

export default function Home() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const canManage = canManageHomepage(profile);
  const {
    data,
    draft,
    isEditing,
    isDirty,
    isSaving,
    status,
    startEditing,
    cancelEditing,
    updateDraft,
    saveDraft,
    trackObjectUrl,
  } = useHomepageEditor(canManage);

  const [openSection, setOpenSection] = useState<EditorSection>(null);

  // 編輯模式顯示草稿內容，讓修改可以即時預覽。
  const view = draft ?? createDraftFromData(data);
  const editable = isEditing && canManage;

  const closeSection = () => setOpenSection(null);

  return (
    <>
      {editable && (
        <HomepageEditToolbar
          isSaving={isSaving}
          isDirty={isDirty}
          onSave={() => void saveDraft()}
          onCancel={cancelEditing}
        />
      )}

      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <main className={`text-slate-950 ${editable ? "pt-14 sm:pt-12" : ""}`}>
        <HeroCarousel slides={view.heroImages}>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-white/80">
            <Waves size={16} strokeWidth={2} />
            NSYSU SURF CLUB
          </p>

          <h1 translate="no" className="mt-4 text-4xl font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
            {view.content.heroTitle}
          </h1>

          {view.content.heroSubtitle && (
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/90 sm:text-base sm:leading-8">
              {view.content.heroSubtitle}
            </p>
          )}

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

          {editable && (
            <div className="mt-6 flex">
              <SectionEditButton
                label="編輯 Hero"
                tone="dark"
                onClick={() => setOpenSection("hero")}
              />
            </div>
          )}
        </HeroCarousel>

        <Suspense fallback={null}>
          <AuthRequiredNotice
            isLoggedIn={Boolean(user)}
            isLoading={isLoading}
            onLogin={(nextPath) => void handleGoogleLogin(nextPath)}
          />
        </Suspense>

        {/* 幹部以上才看得到的首頁編輯入口 */}
        {canManage && !isEditing && (
          <section className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-slate-600">
                你可以直接編輯首頁的文字、照片與幹部介紹。
              </p>
              <Button
                variant="outline"
                className="shrink-0 !min-h-9 !text-xs"
                icon={<Pencil size={14} />}
                onClick={startEditing}
              >
                編輯首頁
              </Button>
            </div>
          </section>
        )}

        {status && (
          <section
            className={`border-b ${statusToneClasses[status.tone]} bg-opacity-60`}
          >
            <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm sm:px-6">
              {status.tone === "success" ? (
                <CircleCheck size={16} className="mt-0.5 shrink-0" />
              ) : (
                <Info size={16} className="mt-0.5 shrink-0" />
              )}
              <span>{status.text}</span>
            </div>
          </section>
        )}

        {statusMessage && (
          <section className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm text-slate-600 sm:px-6">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{statusMessage}</span>
            </div>
          </section>
        )}

        <ClubIntroSection
          content={view.content}
          isEditing={editable}
          onEdit={() => setOpenSection("about")}
        />

        <BannerSection
          image={view.bannerImage}
          slogan={view.content.bannerSlogan}
          subtitle={view.content.bannerSubtitle}
          isEditing={editable}
          onEdit={() => setOpenSection("banner")}
        />

        <OfficerSection
          officers={view.officers.map((officer) => ({
            id: officer.id,
            displayName: officer.displayName,
            roleTitle: officer.roleTitle,
            bio: officer.bio,
            image: officer.image,
          }))}
          isEditing={editable}
          onManage={() => setOpenSection("officers")}
        />
      </main>

      <PublicFooter
        content={view.content}
        backgroundImage={view.footerImage}
        qrCodeImage={view.qrCodeImage}
        isEditing={editable}
        onEdit={() => setOpenSection("footer")}
      />

      {editable && draft && openSection === "hero" && (
        <HeroEditDialog
          draft={draft}
          onClose={closeSection}
          onApply={updateDraft}
          onTrackObjectUrl={trackObjectUrl}
        />
      )}

      {editable && draft && openSection === "about" && (
        <AboutEditDialog
          draft={draft}
          onClose={closeSection}
          onApply={updateDraft}
        />
      )}

      {editable && draft && openSection === "banner" && (
        <BannerEditDialog
          draft={draft}
          onClose={closeSection}
          onApply={updateDraft}
          onTrackObjectUrl={trackObjectUrl}
        />
      )}

      {editable && draft && openSection === "officers" && (
        <OfficerManagerDialog
          draft={draft}
          onClose={closeSection}
          onApply={updateDraft}
          onTrackObjectUrl={trackObjectUrl}
        />
      )}

      {editable && draft && openSection === "footer" && (
        <FooterEditDialog
          draft={draft}
          onClose={closeSection}
          onApply={updateDraft}
          onTrackObjectUrl={trackObjectUrl}
        />
      )}
    </>
  );
}
