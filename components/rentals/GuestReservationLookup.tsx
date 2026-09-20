"use client";

import { useState } from "react";
import { CalendarDays, Info, Search, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import type { GuestRentalReservation } from "@/lib/guestRentals";
import { formatRentalDate, formatRentalTime } from "@/lib/rentalSlots";
import { createClient } from "@/lib/supabase/client";

export function GuestReservationLookup({
  onReservationChanged,
}: {
  onReservationChanged: () => Promise<void> | void;
}) {
  const { locale } = useLanguage();
  const [phone, setPhone] = useState("");
  const [reservationCode, setReservationCode] = useState("");
  const [reservation, setReservation] = useState<GuestRentalReservation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const lookup = async () => {
    if (!phone.trim() || !reservationCode.trim()) {
      setIsError(true);
      setMessage("請填寫登記時的電話與預約編號。");
      setReservation(null);
      return;
    }

    setIsSearching(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_guest_rental_reservation", {
      target_phone: phone,
      target_reservation_code: reservationCode,
    });

    setIsSearching(false);

    if (error) {
      setReservation(null);
      setIsError(true);
      setMessage(`查詢失敗：${error.message}`);
      return;
    }

    const result = (data ?? [])[0] as GuestRentalReservation | undefined;
    if (!result) {
      setReservation(null);
      setIsError(true);
      setMessage("查無預約，請確認電話與預約編號是否正確。");
      return;
    }

    setReservation(result);
    setMessage("");
  };

  const cancelReservation = async () => {
    if (!reservation?.can_cancel) return;
    if (!window.confirm("確定要取消這筆非社員租板預約嗎？")) return;

    setIsCancelling(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_guest_rental", {
      target_phone: phone,
      target_reservation_code: reservationCode,
    });

    setIsCancelling(false);

    if (error) {
      setIsError(true);
      setMessage(`取消失敗：${error.message}`);
      return;
    }

    setReservation(null);
    setPhone("");
    setReservationCode("");
    setMessage("預約已取消，名額與衝浪板已釋出。");
    await onReservationChanged();
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-slate-500">
          <Search size={18} />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">查詢／取消非社員預約</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            使用登記時的電話與預約編號查詢。開始前至少 24 小時可自行取消；之後請聯絡 Instagram。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="聯絡電話">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            className={fieldControlClasses}
          />
        </FormField>
        <FormField label="預約編號">
          <input
            value={reservationCode}
            onChange={(event) => setReservationCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            className={`${fieldControlClasses} font-mono uppercase`}
          />
        </FormField>
      </div>

      <Button
        variant="outline"
        className="mt-4"
        icon={isSearching ? <Search size={16} className="animate-pulse" /> : <Search size={16} />}
        onClick={() => void lookup()}
        disabled={isSearching || isCancelling}
      >
        {isSearching ? "查詢中..." : "查詢預約"}
      </Button>

      {reservation && (
        <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p translate="no" className="font-semibold text-slate-900">{reservation.guest_name}</p>
              <p className="mt-1 text-slate-500">{reservation.guest_phone}</p>
            </div>
            <Badge tone={reservation.is_paid ? "success" : "warning"}>
              {reservation.is_paid ? "已繳費" : "未繳費"}
            </Badge>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">租板時段</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatRentalDate(reservation.rental_date, locale)}<br />
                {formatRentalTime(reservation.start_time)}–{formatRentalTime(reservation.end_time)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">衝浪板／程度</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                <span translate="no">{reservation.surfboard_name || "未指定"}</span>／{reservation.surf_level}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">費用</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                新台幣 {reservation.rental_fee} 元
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-border pt-4">
            {reservation.can_cancel ? (
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => void cancelReservation()}
                disabled={isCancelling}
              >
                {isCancelling ? "取消中..." : "取消這筆預約"}
              </Button>
            ) : (
              <p className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                <CalendarDays size={16} className="mt-1 shrink-0 text-slate-400" />
                已不足開始前 24 小時，無法自行取消；請聯絡西灣衝浪社 Instagram。
              </p>
            )}
          </div>
        </div>
      )}

      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
            isError
              ? "border-danger/30 bg-danger-light text-danger"
              : "border-success/30 bg-success-light text-success"
          }`}
        >
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </Card>
  );
}
