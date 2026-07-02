export type Role = "pending" | "member" | "board_manager" | "officer" | "admin";

export type SurfLevel = "初階" | "中階" | "中進階" | "進階";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  surf_level: string | null;
  role: Role;
  created_at?: string;
  updated_at?: string;
};

export type PublicMemberProfile = {
  id: string;
  full_name: string | null;
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
  created_at: string;
  updated_at: string;
};

export const profileSelectColumns =
  "id, email, full_name, student_id, surf_level, role, created_at";

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

export const surfLevelOptions: SurfLevel[] = ["初階", "中階", "中進階", "進階"];

export const surfLevelDescriptions: Array<{
  value: SurfLevel;
  title: SurfLevel;
  description: string;
}> = [
  {
    value: "初階",
    title: "初階",
    description: "剛開始接觸衝浪，正在熟悉安全規則、划水、起乘與白浪練習。",
  },
  {
    value: "中階",
    title: "中階",
    description: "能穩定起乘，開始練習轉向、看浪與在安全條件下自行下水。",
  },
  {
    value: "中進階",
    title: "中進階",
    description: "能判斷浪況與路線，具備較好的控板能力，可處理一般外海浪況。",
  },
  {
    value: "進階",
    title: "進階",
    description: "具備成熟的海上判斷、控板與自救能力，可協助照看同伴與活動安全。",
  },
];
