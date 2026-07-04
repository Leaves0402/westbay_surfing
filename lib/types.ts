export type Role = "pending" | "member" | "board_manager" | "officer" | "admin";

export type SurfLevel = "初階" | "中階" | "中進階" | "進階";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  surf_level: string | null;
  requested_surf_level: string | null;
  requested_surf_level_at: string | null;
  role: Role;
  created_at?: string;
  updated_at?: string;
};

export type PublicMemberProfile = {
  id: string;
  full_name: string | null;
  student_id: string | null;
  surf_level: string | null;
  role: Role;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RentalSlot = {
  id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  board_manager_id: string | null;
  min_surf_level: string | null;
  note: string | null;
  is_open: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RentalRegistration = {
  id: string;
  rental_slot_id: string;
  user_id: string;
  is_paid: boolean;
  paid_at?: string | null;
  paid_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type SurfSpot = {
  id: string;
  name: string;
  county: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type SurfTrip = {
  id: string;
  start_date: string;
  end_date: string;
  capacity: number;
  leader_id: string;
  min_surf_level: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SurfTripSpot = {
  trip_id: string;
  spot_id: string;
};

export type SurfTripCar = {
  id: string;
  trip_id: string;
  leader_id: string;
  capacity: number;
  created_by: string;
  created_at: string;
};

export type SurfTripCarPassenger = {
  id: string;
  car_id: string;
  trip_id: string;
  user_id: string;
  slot_index: number;
  created_at: string;
};

export type SurfTripMessage = {
  id: string;
  trip_id: string;
  user_id: string;
  message: string;
  created_at: string;
};

export const profileSelectColumns =
  "id, email, full_name, student_id, surf_level, requested_surf_level, requested_surf_level_at, role, created_at";

export const roleLabels: Record<Role, string> = {
  pending: "待審核",
  member: "社員",
  board_manager: "板務",
  officer: "幹部",
  admin: "管理員",
};

export const roleOptions: Role[] = [
  "pending",
  "member",
  "board_manager",
  "officer",
  "admin",
];

export const officialMemberRoleOptions: Role[] = [
  "member",
  "board_manager",
  "officer",
  "admin",
];

export const surfLevelOptions: SurfLevel[] = ["初階", "中階", "中進階", "進階"];

export const directlySelectableSurfLevels: SurfLevel[] = ["初階", "中階"];

export const reviewRequiredSurfLevels: SurfLevel[] = ["中進階", "進階"];

export const surfLevelDescriptions: Array<{
  value: SurfLevel;
  title: SurfLevel;
  description: string;
}> = [
  {
    value: "初階",
    title: "初階",
    description:
      "初學，還不會穩定斜跑，正在練習起乘、站穩、控制方向與基本安全觀念。",
  },
  {
    value: "中階",
    title: "中階",
    description:
      "已經可以斜跑，但還不穩定；正在練習判斷浪、選浪、維持速度與基本轉向。",
  },
  {
    value: "中進階",
    title: "中進階",
    description: "可以控制斜跑方向，具備越浪技巧、衝浪禮儀。",
  },
  {
    value: "進階",
    title: "進階",
    description: "已能穩定掌握浪板控制，有自己的板子，開始練習動作。",
  },
];
