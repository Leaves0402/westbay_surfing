"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Info,
  Phone,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import { SurfboardPicker } from "@/components/rentals/SurfboardPicker";
import { SurfboardThumbnail } from "@/components/rentals/SurfboardThumbnail";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import {
  GUEST_RENTAL_FEE,
  GUEST_SURF_LEVEL,
  mapGuestSurfboardRows,
  validateGuestRentalDetails,
  type GuestSurfboardRpcRow,
  type PublicRentalSlot,
} from "@/lib/guestRentals";
import { formatRentalDate, formatRentalTime } from "@/lib/rentalSlots";
import { createSignedSurfboardImageUrls } from "@/lib/surfboards";
import { createClient } from "@/lib/supabase/client";
import type { SurfboardWithImages } from "@/lib/types";
import { useDialogAccessibility } from "@/lib/useDialogAccessibility";

type FlowStep = "terms" | "details" | "summary" | "success";

type GuestDetails = {
  name: string;
  phone: string;
  note: string | null;
};

export function GuestRentalFlow({
  slot,
  onClose,
  onSuccess,
}: {
  slot: PublicRentalSlot;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const { locale } = useLanguage();
  const [step, setStep] = useState<FlowStep>("terms");
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [details, setDetails] = useState<GuestDetails | null>(null);
  const [boards, setBoards] = useState<SurfboardWithImages[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [boardError, setBoardError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationCode, setReservationCode] = useState("");
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const safeClose = useCallback(() => {
    if (!isSubmitting && !isPickerOpen) onClose();
  }, [isPickerOpen, isSubmitting, onClose]);
  const panelRef = useDialogAccessibility({ onClose: safeClose, isBusy: isSubmitting });

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId]
  );

  const loadBoards = useCallback(async () => {
    setIsLoadingBoards(true);
    setBoardError("");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_public_beginner_surfboards");

    if (error) {
      setIsLoadingBoards(false);
      setBoards([]);
      setImageUrls({});
      setBoardError(`讀取初階衝浪板失敗：${error.message}`);
      return;
    }

    const loadedBoards = mapGuestSurfboardRows(
      (data ?? []) as GuestSurfboardRpcRow[]
    );
    const storagePaths = loadedBoards.flatMap((board) =>
      board.images.map((image) => image.storage_path)
    );
    const urlsResult = await createSignedSurfboardImageUrls(storagePaths);

    setIsLoadingBoards(false);
    setBoards(loadedBoards);

    if (urlsResult.error !== null) {
      setImageUrls({});
      setBoardError(`讀取衝浪板圖片失敗：${urlsResult.error}`);
      return;
    }

    setImageUrls(urlsResult.urls);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadBoards());
  }, [loadBoards]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const element = termsRef.current;
      if (element && element.scrollHeight <= element.clientHeight + 4) {
        setHasReadTerms(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateTermsReadState = () => {
    const element = termsRef.current;
    if (!element) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) {
      setHasReadTerms(true);
    }
  };

  const continueFromDetails = () => {
    setErrorMessage("");
    const result = validateGuestRentalDetails({ name, phone, note });
    if (result.error || !result.values) {
      setErrorMessage(result.error);
      return;
    }
    if (!isAdult) {
      setErrorMessage("請確認你已年滿 18 歲。非社員租板不開放未成年人。 ");
      return;
    }

    setDetails(result.values);
    setIsPickerOpen(true);
  };

  const chooseBoard = async (surfboardId: string) => {
    setSelectedBoardId(surfboardId);
    setIsPickerOpen(false);
    setStep("summary");
  };

  const submitRegistration = async () => {
    if (!details || !selectedBoard) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("register_guest_rental", {
      target_slot_id: slot.id,
      target_surfboard_id: selectedBoard.id,
      target_name: details.name,
      target_phone: details.phone,
      target_note: details.note,
      target_terms_accepted: termsAccepted,
      target_is_adult: isAdult,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`登記失敗：${error.message}`);
      await loadBoards();
      return;
    }

    const result = (data ?? [])[0] as
      | { registration_id: string; reservation_code: string }
      | undefined;
    if (!result?.reservation_code) {
      setErrorMessage("登記已送出，但未取得預約編號，請立即聯絡社團確認。");
      return;
    }

    setReservationCode(result.reservation_code);
    setStep("success");
    await onSuccess();
  };

  const copyReservationCode = async () => {
    try {
      await navigator.clipboard.writeText(reservationCode);
      setIsCodeCopied(true);
    } catch {
      setIsCodeCopied(false);
    }
  };

  const coverImage = selectedBoard?.images[0];
  const selectedBoardImageUrl = coverImage
    ? imageUrls[coverImage.storage_path] ?? null
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) safeClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-rental-title"
          tabIndex={-1}
          className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">
                {step === "terms" && "步驟 1／4"}
                {step === "details" && "步驟 2／4"}
                {step === "summary" && "步驟 4／4"}
                {step === "success" && "登記完成"}
              </p>
              <h2 id="guest-rental-title" className="truncate font-semibold text-slate-900">
                {step === "terms" && "非社員租板說明"}
                {step === "details" && "填寫租板資料"}
                {step === "summary" && "確認租板資料"}
                {step === "success" && "非社員租板登記成功"}
              </h2>
            </div>
            <button
              type="button"
              aria-label="關閉"
              onClick={safeClose}
              disabled={isSubmitting}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {step === "terms" && (
              <>
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary-light/50 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    {formatRentalDate(slot.rental_date, locale)}，{formatRentalTime(slot.start_time)}–
                    {formatRentalTime(slot.end_time)}
                  </p>
                  <p className="mt-1">非社員一律視為初階，只能選擇初階衝浪板。</p>
                </div>

                <div
                  ref={termsRef}
                  onScroll={updateTermsReadState}
                  className="max-h-[46vh] space-y-4 overflow-y-auto rounded-xl border border-border bg-bg p-4 text-sm leading-7 text-slate-700"
                >
                  <p>
                    非社員租板每次費用為新台幣 <strong>200 元</strong>，領板時可使用現金或轉帳付款。
                  </p>
                  <p>
                    若因使用不當造成器材損壞或遺失，經社團確認後，衝浪板為 3,000 元、板鰭為 500 元、腳繩為 800 元；整套遺失合計 4,300 元。也可補交相同款式及相當狀況的器材。正常使用刮痕不在此限。
                  </p>
                  <p>
                    請於租板時段開始時準時至社辦領取，無法提早領板，並於時段結束前完成歸還。社辦地址：<strong>待補</strong>。若不清楚領取方式，請提前聯絡西灣衝浪社 Instagram；連結位於首頁最下方。
                  </p>
                  <p>
                    本服務僅提供器材租借，不包含衝浪教學、陪同、救生、保險或其他安全保障。請自行評估天候、浪況、場地與個人能力，並自行承擔下水風險。
                  </p>
                  <p>
                    領取時請與社團人員共同確認板況；若發現既有損傷，應在下水前立即提出。
                  </p>
                  <p>
                    聯絡電話用於租板聯絡、付款與器材歸還處理。未登入訪客看不到電話；已登入的正式社員與工作人員可在該時段名單中查看，以利辨識及聯絡。
                  </p>
                  <p>
                    同一電話同時只能保留一筆有效預約。登記成功後請保存預約編號；可用電話與預約編號查詢，並於開始前至少 24 小時自行取消。超過期限請聯絡 Instagram。
                  </p>
                  <p>
                    非社員租板僅開放年滿 18 歲者。已付款的非社員資料會在租板時段結束 24 小時後刪除姓名、電話與備註，只保留匿名化租板與付款紀錄。
                  </p>
                  <p className="font-medium text-primary">你已閱讀到說明最下方。</p>
                </div>

                <label className={`mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm ${
                  hasReadTerms ? "cursor-pointer border-border" : "cursor-not-allowed border-border bg-bg text-slate-400"
                }`}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    disabled={!hasReadTerms}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span>我已完整閱讀並同意上述非社員租板說明。</span>
                </label>
                {!hasReadTerms && (
                  <p className="mt-2 text-xs text-slate-500">請先將說明捲動到最下方。</p>
                )}
              </>
            )}

            {step === "details" && (
              <div className="grid gap-4">
                <div className="rounded-xl border border-primary/20 bg-primary-light/50 p-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">衝浪程度：初階（固定）</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    非社員不需自評程度，系統一律以初階限制時段與板子。
                  </p>
                </div>

                {boardError && (
                  <div className="rounded-xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                    <p>{boardError}</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      icon={<RefreshCw size={16} />}
                      onClick={() => void loadBoards()}
                      disabled={isLoadingBoards}
                    >
                      重新讀取衝浪板
                    </Button>
                  </div>
                )}

                <FormField label="姓名">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={50}
                    autoComplete="name"
                    placeholder="請填寫真實姓名"
                    className={fieldControlClasses}
                  />
                </FormField>

                <FormField label="聯絡電話" hint="可輸入空格或連字號，系統會自動整理。">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={24}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="例如 0912-345-678"
                    className={fieldControlClasses}
                  />
                </FormField>

                <FormField label="備註（選填）" hint={`${note.length}/500`}>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    placeholder="例如領板聯絡事項"
                    className={`min-h-24 ${fieldControlClasses}`}
                  />
                </FormField>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAdult}
                    onChange={(event) => setIsAdult(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span>我確認自己已年滿 18 歲。</span>
                </label>
              </div>
            )}

            {step === "summary" && details && selectedBoard && (
              <div className="grid gap-4">
                <div className="rounded-xl border border-border bg-bg p-4">
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <SummaryItem icon={<CalendarDays size={16} />} label="時段">
                      {formatRentalDate(slot.rental_date, locale)}<br />
                      {formatRentalTime(slot.start_time)}–{formatRentalTime(slot.end_time)}
                    </SummaryItem>
                    <SummaryItem icon={<UserRound size={16} />} label="姓名">
                      {details.name}
                    </SummaryItem>
                    <SummaryItem icon={<Phone size={16} />} label="聯絡電話">
                      {details.phone}
                    </SummaryItem>
                    <SummaryItem icon={<Waves size={16} />} label="程度">
                      {GUEST_SURF_LEVEL}
                    </SummaryItem>
                    <SummaryItem icon={<Wallet size={16} />} label="費用">
                      新台幣 {GUEST_RENTAL_FEE} 元（領板時現金或轉帳）
                    </SummaryItem>
                    <SummaryItem icon={<Waves size={16} />} label="衝浪板">
                      <span className="inline-flex items-center gap-2">
                        <SurfboardThumbnail
                          boardName={selectedBoard.name}
                          imageUrl={selectedBoardImageUrl}
                        />
                        <span translate="no">{selectedBoard.name}</span>
                      </span>
                    </SummaryItem>
                  </dl>
                  {details.note && (
                    <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-slate-600">
                      備註：{details.note}
                    </p>
                  )}
                </div>

                <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light p-3 text-sm leading-6 text-slate-700">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
                  <span>按下確認後才會一次占用名額與板子。成功畫面會顯示預約編號，請務必保存。</span>
                </p>
              </div>
            )}

            {step === "success" && (
              <div className="flex flex-col items-center py-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
                  <CheckCircle2 size={28} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">租板登記成功</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  請準時於時段開始時至社辦領板，並在時段結束前歸還。
                </p>

                <div className="mt-5 w-full rounded-xl border border-primary/30 bg-primary-light/50 p-4">
                  <p className="text-xs font-medium text-slate-500">預約編號</p>
                  <p className="mt-1 break-all font-mono text-2xl font-bold tracking-wider text-primary">
                    {reservationCode}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    icon={<Clipboard size={16} />}
                    onClick={() => void copyReservationCode()}
                  >
                    {isCodeCopied ? "已複製" : "複製預約編號"}
                  </Button>
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light p-3 text-left text-sm leading-6 text-slate-700">
                  <Info size={16} className="mt-1 shrink-0 text-warning" />
                  請保存「電話＋預約編號」。之後查詢或取消時兩者缺一不可；系統不會再顯示這組編號。
                </p>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light p-3 text-sm text-danger">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            {step === "terms" && (
              <>
                <Button variant="outline" onClick={safeClose}>取消</Button>
                <Button
                  variant="primary"
                  onClick={() => setStep("details")}
                  disabled={!hasReadTerms || !termsAccepted}
                >
                  繼續填寫資料
                </Button>
              </>
            )}

            {step === "details" && (
              <>
                <Button
                  variant="outline"
                  icon={<ChevronLeft size={16} />}
                  onClick={() => setStep("terms")}
                >
                  返回說明
                </Button>
                <Button
                  variant="primary"
                  onClick={continueFromDetails}
                  disabled={isLoadingBoards || Boolean(boardError)}
                >
                  {isLoadingBoards ? (
                    <><RefreshCw size={16} className="animate-spin" />讀取板子中...</>
                  ) : "挑選衝浪板"}
                </Button>
              </>
            )}

            {step === "summary" && (
              <>
                <Button
                  variant="outline"
                  icon={<ChevronLeft size={16} />}
                  onClick={() => setIsPickerOpen(true)}
                  disabled={isSubmitting}
                >
                  重新挑板
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void submitRegistration()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "登記中..." : "確認登記租板"}
                </Button>
              </>
            )}

            {step === "success" && (
              <Button variant="primary" fullWidth onClick={onClose}>
                完成
              </Button>
            )}
          </div>
        </div>
      </div>

      {isPickerOpen && (
        <SurfboardPicker
          boards={boards}
          imageUrls={imageUrls}
          profile={{ surf_level: GUEST_SURF_LEVEL }}
          takenSurfboardIds={slot.taken_surfboard_ids}
          isLoading={isLoadingBoards}
          isSubmitting={false}
          loadErrorMessage={boardError}
          confirmLabel="選好，查看最終摘要"
          onClose={() => setIsPickerOpen(false)}
          onConfirm={chooseBoard}
        />
      )}
    </>
  );
}

function SummaryItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 font-medium text-slate-800">{children}</dd>
      </div>
    </div>
  );
}
