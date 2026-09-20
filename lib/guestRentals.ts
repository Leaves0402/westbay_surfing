import type { SurfboardWithImages } from "@/lib/types";

export const GUEST_RENTAL_FEE = 200;
export const GUEST_SURF_LEVEL = "初階";
export const GUEST_RENTAL_TERMS_VERSION = "guest-rental-2026-08-31";

export type PublicRentalRegistration = {
  id: string;
  renter_type: "member" | "guest";
  display_name: string;
  surf_level: string | null;
  is_paid: boolean;
  surfboard_name: string | null;
};

export type PublicRentalSlot = {
  id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  min_surf_level: string | null;
  is_open: boolean;
  registration_count: number;
  remaining_capacity: number;
  registrations: PublicRentalRegistration[];
  taken_surfboard_ids: string[];
};

export type GuestRentalReservation = {
  registration_id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  guest_name: string;
  guest_phone: string;
  surf_level: string;
  surfboard_name: string | null;
  rental_fee: number;
  is_paid: boolean;
  can_cancel: boolean;
  cancellation_deadline: string;
};

export type GuestSurfboardRpcRow = Omit<
  SurfboardWithImages,
  "images" | "created_by" | "created_at" | "updated_at"
> & {
  images: SurfboardWithImages["images"] | null;
};

export function mapGuestSurfboardRows(
  rows: GuestSurfboardRpcRow[]
): SurfboardWithImages[] {
  return rows.map((row) => ({
    ...row,
    images: Array.isArray(row.images) ? row.images : [],
    created_by: "",
    created_at: "",
    updated_at: "",
  }));
}

export function normalizePhoneInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function validateGuestRentalDetails(input: {
  name: string;
  phone: string;
  note: string;
}) {
  const name = input.name.trim();
  const phone = normalizePhoneInput(input.phone);
  const note = input.note.trim();

  if (name.length < 2 || name.length > 50) {
    return { error: "姓名需為 2 至 50 個字。", values: null } as const;
  }
  if (!/^\d{8,15}$/.test(phone)) {
    return { error: "請填寫 8 至 15 碼的有效聯絡電話。", values: null } as const;
  }
  if (note.length > 500) {
    return { error: "備註最多 500 個字。", values: null } as const;
  }

  return {
    error: null,
    values: { name, phone, note: note || null },
  } as const;
}
