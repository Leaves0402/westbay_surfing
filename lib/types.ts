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

export type AdminGovernance = {
  owner_user_id: string;
  additional_admin_count: number;
  additional_admin_limit: number;
};

export type LessonAttendanceOverview = {
  user_id: string;
  attendance_count: number;
  teaching_count: number;
  started_lesson_count: number;
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
  /** 登記時挑選的衝浪板；本功能上線前的舊資料為 null。 */
  surfboard_id: string | null;
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
  participation_counted_at: string | null;
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

export type SurfTripWaitlistEntry = {
  id: string;
  trip_id: string;
  user_id: string;
  waitlist_order: number;
  created_at: string;
};

export type Lesson = {
  id: string;
  lesson_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  waitlist_capacity: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type LessonInstructor = {
  lesson_id: string;
  instructor_id: string;
};

export type LessonParticipant = {
  id: string;
  lesson_id: string;
  user_id: string;
  status: "confirmed" | "waitlist";
  waitlist_order: number | null;
  created_at: string;
  updated_at: string;
};

export type LessonInstructorAttendance = {
  id: string;
  lesson_id: string;
  instructor_id: string;
  checked_in: boolean;
  checked_in_by: string | null;
  checked_in_at: string | null;
};

export type LessonMemberAttendance = {
  id: string;
  lesson_id: string;
  user_id: string;
  checked_in: boolean;
  checked_in_by: string | null;
  checked_in_at: string | null;
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

/** 衝浪板適合程度與社員衝浪程度使用同一套等級。 */
export type SurfboardSuitabilityLevel = SurfLevel;

export type SurfboardBoardType = "軟板" | "硬板" | "長板" | "短板" | "中長板";

export type Surfboard = {
  id: string;
  name: string;
  suitability_level: SurfboardSuitabilityLevel;
  board_types: SurfboardBoardType[];
  /** 浮力，單位公升（L）；未填寫為 null。 */
  buoyancy: number | null;
  /** 長度，呎吋格式（例如 5'4）；未填寫為 null。 */
  length: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SurfboardImage = {
  id: string;
  surfboard_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
};

export type SurfboardWithImages = Surfboard & {
  images: SurfboardImage[];
};

export type SurfboardFormData = {
  name: string;
  suitability_level: SurfboardSuitabilityLevel;
  board_types: SurfboardBoardType[];
  buoyancy: string;
  length: string;
  description: string;
};

export const surfboardSuitabilityLevelOptions: SurfboardSuitabilityLevel[] =
  surfLevelOptions;

export const surfboardBoardTypeOptions: SurfboardBoardType[] = [
  "軟板",
  "硬板",
  "長板",
  "短板",
  "中長板",
];

export const surfboardUnknownValueText = "未知";
